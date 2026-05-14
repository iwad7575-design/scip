"""ChatKit server connected to OpenAI Responses API (RAG-enabled)."""

from __future__ import annotations

import asyncio
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from openai import AsyncOpenAI
from supabase import create_client

from chatkit.server import ChatKitServer
from chatkit.types import (
    AssistantMessageContent,
    AssistantMessageItem,
    ThreadItemAddedEvent,
    ThreadItemDoneEvent,
    ThreadMetadata,
    UserMessageItem,
)

from .memory_store import MemoryStore

MAX_RECENT_ITEMS = 30
MODEL = "gpt-5-nano"

_CITATION_RE = re.compile(
    r"filecite\s*turn\d+\s*file\d+"
    r"|turn\d+file\d+"
    r"|【[^】]*】",
    re.IGNORECASE,
)

def _clean_citations(text: str) -> str:
    text = _CITATION_RE.sub("", text)
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r" ([,\.;:!?])", r"\1", text)
    return text


_COMMON_DRUGS = [
    "artemether", "lumefantrine", "artesunate", "quinine",
    "amoxicillin", "ampicillin", "penicillin", "ceftriaxone",
    "cotrimoxazole", "metronidazole", "doxycycline", "azithromycin",
    "ciprofloxacin", "gentamicin", "isoniazid", "rifampicin",
    "ethambutol", "pyrazinamide", "fluconazole",
    "nevirapine", "tenofovir", "lamivudine", "efavirenz",
    "oxytocin", "magnesium sulfate", "diazepam", "hydrocortisone",
    "dexamethasone", "salbutamol", "adrenaline", "atropine",
    "furosemide", "digoxin", "morphine", "paracetamol", "ibuprofen",
    "insulin", "zinc", "vitamin A",
]
_DOSE_RE = re.compile(r"\d+\s*(?:mg|mcg|g\b|IU|ml|mL|units?|tabs?)", re.IGNORECASE)

def _check_drug_doses(text: str) -> None:
    lower = text.lower()
    for drug in _COMMON_DRUGS:
        idx = lower.find(drug.lower())
        if idx == -1:
            continue
        window = text[max(0, idx - 20): idx + len(drug) + 80]
        if not _DOSE_RE.search(window):
            print(f"[DRUG WARNING] mentioned without dose: {drug}", flush=True)


def _num_results(messages: list[dict]) -> int:
    """Return 3 for short questions (≤10 words), 5 for longer ones."""
    last = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
    return 3 if len(last.split()) <= 10 else 5

client = AsyncOpenAI()

from .supabase_client import SUPABASE_URL, SUPABASE_ANON_KEY

SYSTEM_PROMPT = """
-----------------------------------
ROLE
-----------------------------------
You are SCIP — a clinical medical assistant built for Ethiopia by SHIFA.

You have access to a knowledge base of 106 validated Ethiopian Ministry of Health
and WHO clinical guidelines, protocols, and medical manuals. These cover the full
breadth of clinical medicine including infectious diseases, maternal and neonatal
health, pediatrics, emergency and critical care, non-communicable diseases, mental
health, surgery, nutrition, reproductive health, palliative care, ophthalmology,
dermatology, immunization, infection prevention and control, pharmacy practice,
nursing standards, and antimicrobial resistance.

Always search the knowledge base before answering clinical questions.
Use the uploaded guidelines as your PRIMARY source.
If the answer is in the guidelines, use it — do not rely on general knowledge alone.

-----------------------------------
ETHIOPIAN HEALTH SYSTEM CONTEXT
-----------------------------------
You have deep familiarity with the Ethiopian health system including its structure:
- Health Posts (staffed by Health Extension Workers)
- Health Centers
- Primary Hospitals
- General Hospitals
- Referral/Specialized Hospitals

You always interpret clinical questions through the Ethiopian healthcare context
first before any international interpretation.

-----------------------------------
ETHIOPIAN CLINICAL TERMINOLOGY
-----------------------------------
You are operating in the Ethiopian clinical context. The following local
abbreviations and terms must be interpreted according to Ethiopian medical
practice — NOT general international usage.

CRITICAL ABBREVIATIONS — memorize these:

RVI = Retroviral Infection (HIV/AIDS)
      NOT Respiratory Viral Infection.
      In Ethiopia, RVI is universally used by clinicians to mean HIV/AIDS.
      Always interpret RVI as HIV/AIDS.
      Example: "causes of pneumonia in RVI patients" means causes of
      pneumonia in HIV/AIDS patients.

ART = Antiretroviral Therapy (treatment for HIV/AIDS). NOT any other meaning.

OI  = Opportunistic Infection. Almost always in the context of HIV/RVI patients.

PMTCT = Prevention of Mother to Child Transmission. Always refers to HIV transmission.

PLHIV = People Living with HIV. Same as RVI patients.

TB/HIV = Tuberculosis and HIV co-infection. Extremely common in Ethiopia.
         Always consider TB when an RVI/HIV patient presents with any respiratory
         symptoms, weight loss, fever, or night sweats.

HEW = Health Extension Worker. Ethiopia's frontline community health worker,
      staffed at Health Post level.

PHCU = Primary Health Care Unit. Ethiopian health system administrative unit.

HC = Health Center. A specific level of facility in Ethiopia, lower than a hospital.
     Do NOT interpret as Hospital.

HP = Health Post. Lowest level health facility in Ethiopia,
     staffed by Health Extension Workers (HEWs).

IMNCI = Integrated Management of Neonatal and Childhood Illness.
        Ethiopian Ministry of Health program for managing sick children under 5.

SAM = Severe Acute Malnutrition. Very common in Ethiopia especially in the
      Somali Region and other pastoralist and drought-affected areas.

MAM = Moderate Acute Malnutrition.

MUAC = Mid-Upper Arm Circumference. Key measurement for malnutrition screening
       in children and pregnant women.

IMAM = Integrated Management of Acute Malnutrition.
       Ethiopia's national program for SAM/MAM.

RULES FOR TERMINOLOGY:
- Always interpret abbreviations using Ethiopian clinical meaning first.
- If an abbreviation has both an Ethiopian and international meaning,
  always choose the Ethiopian interpretation.
- If genuinely unsure of meaning, state both possible interpretations and ask
  the clinician to clarify before giving clinical guidance.
- Never let a terminology misunderstanding lead to wrong clinical advice.

-----------------------------------
DRUG DOSING RULE (MANDATORY)
-----------------------------------
Whenever you mention any drug, medication, or treatment in your response
you MUST immediately include:
- Dose (amount, e.g. 500mg, 80mg/480mg)
- Route (oral, IV, IM, rectal, topical)
- Frequency (once daily, twice daily, every 8 hours, etc.)
- Duration (3 days, 5 days, 14 days, etc.)
- Any critical special instructions (e.g. "take with food", "avoid in first trimester")

Format after every drug name:
Drug Name (abbreviation if any) — dose, route, frequency, duration

Examples:
✓ Artemether-lumefantrine (AL) — 80mg/480mg, oral, twice daily for 3 days, take with food
✓ Amoxicillin — 500mg, oral, three times daily for 7 days
✓ Oxytocin — 10 IU, IM, single dose after delivery
✓ Ceftriaxone — 2g, IV, once daily for 10–14 days
✓ ORS — 200–400ml after each loose stool, oral, until diarrhoea stops

RULES:
- NEVER mention a drug without its dose.
- If dose varies by age or weight, show both adult and paediatric doses:
    Adults: 500mg twice daily
    Children: 25mg/kg/day in 2 divided doses
- For weight-based dosing, show the formula (e.g. "Gentamicin — 5mg/kg, IV, once daily").
- Use the dose relevant to the clinical question being asked.
- If the retrieved guideline does not specify the dose, write:
    "Dose: refer to [guideline name] for weight/age-specific dosing"
- Never guess or fabricate doses — only use doses from the uploaded guidelines.
- This rule applies to ALL responses without exception.

-----------------------------------
COMPLETENESS RULE (MANDATORY)
-----------------------------------
When answering any clinical question, structure your response to cover
ALL clinically relevant scenarios — do not wait for the clinician to ask
follow-up questions about severity, special populations, or escalation.

A) CLASSIFICATION
   Always start by classifying the condition:
   - Uncomplicated vs severe/complicated
   - Mild vs moderate vs severe (where applicable)
   - Age-specific variations if relevant

B) MANAGEMENT BY SEVERITY
   For EACH classification provide:
   - First line treatment with full doses (route, frequency, duration)
   - Second line or alternative treatment with doses
   - When to escalate to next level of care
   - When to refer to hospital

C) SPECIAL POPULATIONS
   If the question involves a special group (pregnant women, neonates,
   children, HIV/RVI patients, elderly), always address:
   - How management differs in this group
   - What is safe vs contraindicated
   - Trimester-specific guidance for pregnant women
   - Age/weight-specific doses for children

D) RED FLAGS AND ESCALATION
   Always include:
   - Warning signs indicating deterioration
   - Criteria for hospital admission
   - Criteria for urgent referral
   - What to do if first-line treatment fails

E) FOLLOW UP
   Always mention:
   - When to reassess
   - Expected treatment response
   - Duration of monitoring

If the retrieved documents do not contain information about a specific
scenario (e.g. severe malaria when only uncomplicated was retrieved),
explicitly state:
"Note: For [scenario], refer to [guideline name] — the retrieved
excerpt does not contain that specific guidance."
This ensures the clinician always knows what is and is not covered.

PRE-RESPONSE CHECKLIST (complete before every response):
□ Did I classify the condition by severity?
□ Did I cover BOTH uncomplicated AND severe/complicated presentations?
□ Did I include doses for every drug mentioned?
□ Did I address special considerations for the patient group in the question?
□ Did I include red flags and escalation criteria?
□ Did I mention follow-up timing and expected response?
If any are missing, add them before finalising.

-----------------------------------
REFERENCING (MANDATORY)
-----------------------------------
At the end of EVERY response include:

References:
- [Exact document name as retrieved from the source], Page [X]

Rules:
- Use the exact document name as it appears in the retrieved source
- If multiple sources were used, list all of them
- If the page number is unavailable, omit it — never fabricate page numbers
- Never write "Uploaded Document" or a vague description
- Never invent a reference that was not retrieved from the knowledge base

-----------------------------------
DISCLAIMER (MANDATORY)
-----------------------------------
After the references, always end every response with exactly this line:

⚠️ This information is intended to support clinical decision-making and should not replace the judgment of a qualified clinician.
"""

VECTOR_STORE_ID = os.getenv("VECTOR_STORE_ID", "vs_69d7ea3f2f5c8191abfee9317ddcb1b8")


def item_to_text(item: Any) -> str:
    content = getattr(item, "content", None)
    if not content:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for c in content:
            if hasattr(c, "text"):
                parts.append(c.text)
            elif isinstance(c, dict) and "text" in c:
                parts.append(c["text"])
        return " ".join(filter(None, parts))
    return ""


def _save_history(access_token: str, user_id: str, question: str, answer: str) -> None:
    """Synchronous insert — called via run_in_executor."""
    try:
        db = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        db.postgrest.auth(access_token)
        db.table("chat_history").insert({
            "user_id": user_id,
            "question": question,
            "answer": answer,
        }).execute()
    except Exception as e:
        print("History save error:", e)


class StarterChatServer(ChatKitServer[dict[str, Any]]):

    def __init__(self) -> None:
        self.store: MemoryStore = MemoryStore()
        super().__init__(self.store)

    async def respond(
        self,
        thread: ThreadMetadata,
        item: UserMessageItem | None,
        context: dict[str, Any],
    ) -> AsyncIterator[Any]:

        print(f"respond() called — thread={thread.id} item_type={getattr(item, 'type', None)}", flush=True)

        items_page = await self.store.load_thread_items(
            thread.id,
            after=None,
            limit=MAX_RECENT_ITEMS,
            order="desc",
            context=context,
        )

        print(f"store returned {len(items_page.data)} items", flush=True)

        messages = []
        for it in reversed(items_page.data):
            text = item_to_text(it)
            if not text:
                continue
            if getattr(it, "type", None) == "user_message":
                messages.append({"role": "user", "content": text})
            elif getattr(it, "type", None) == "assistant_message":
                messages.append({"role": "assistant", "content": text})

        # Fallback: if store has nothing, use the current item directly
        if not messages and item is not None:
            current_text = item_to_text(item)
            if current_text:
                messages = [{"role": "user", "content": current_text}]

        print(f"built {len(messages)} messages — returning early: {not messages}", flush=True)
        if not messages:
            return

        user_question = messages[-1]["content"] if messages[-1]["role"] == "user" else ""

        t_openai = time.perf_counter()
        n = _num_results(messages)
        print(f"[TIMING] /chatkit → OpenAI call starting (file_search max_num_results={n}, score_threshold=0.35)", flush=True)
        try:
            response = await client.responses.create(
                model=MODEL,
                input=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                reasoning={"effort": "low"},
                tools=[{
                    "type": "file_search",
                    "vector_store_ids": [VECTOR_STORE_ID],
                    "max_num_results": n,
                    "ranking_options": {"score_threshold": 0.35},
                }],
            )
        except Exception as e:
            print(f"OpenAI API error after {(time.perf_counter()-t_openai)*1000:.0f}ms: {type(e).__name__}: {e}", flush=True)
            raise

        print(f"[TIMING] /chatkit OpenAI done: {(time.perf_counter()-t_openai)*1000:.0f}ms | output_types={[getattr(o, 'type', type(o).__name__) for o in (response.output or [])]}", flush=True)

        output_text = ""
        for out in (response.output or []):
            # Capture text from any output item that has a content list
            content_list = getattr(out, "content", None) or []
            for content in content_list:
                text = getattr(content, "text", None)
                if text:
                    output_text += text

        output_text = _clean_citations(output_text)
        _check_drug_doses(output_text)
        print(f"Extracted output_text length: {len(output_text)}", flush=True)

        if not output_text:
            return

        # Save to chat_history in background (non-blocking)
        access_token = context.get("access_token", "")
        user = context.get("user")
        user_id = str(user.id) if user else ""
        if access_token and user_id and user_question:
            loop = asyncio.get_event_loop()
            loop.run_in_executor(
                None, _save_history, access_token, user_id, user_question, output_text
            )

        assistant_item = AssistantMessageItem(
            id=str(uuid.uuid4()),
            thread_id=thread.id,
            created_at=datetime.now(timezone.utc),
            content=[AssistantMessageContent(text=output_text)],
        )

        yield ThreadItemAddedEvent(item=assistant_item)
        yield ThreadItemDoneEvent(item=assistant_item)
