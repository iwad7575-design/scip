"""ChatKit server connected to OpenAI Responses API (RAG-enabled)."""

from __future__ import annotations

import asyncio
import os
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

        try:
            response = await client.responses.create(
                model=MODEL,
                input=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                tools=[{"type": "file_search", "vector_store_ids": [VECTOR_STORE_ID]}],
            )
        except Exception as e:
            print(f"OpenAI API error: {type(e).__name__}: {e}", flush=True)
            raise

        print(f"OpenAI response output types: {[getattr(o, 'type', type(o).__name__) for o in (response.output or [])]}", flush=True)

        output_text = ""
        for out in (response.output or []):
            # Capture text from any output item that has a content list
            content_list = getattr(out, "content", None) or []
            for content in content_list:
                text = getattr(content, "text", None)
                if text:
                    output_text += text

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
