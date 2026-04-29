"""ChatKit server connected to OpenAI Responses API (RAG-enabled)."""

from __future__ import annotations

from typing import Any, AsyncIterator

from openai import OpenAI

from chatkit.agents import (
    AgentContext,
    simple_to_agent_input,
    stream_agent_response,
)
from chatkit.server import ChatKitServer
from chatkit.types import (
    ThreadMetadata,
    ThreadStreamEvent,
    UserMessageItem,
)

from .memory_store import MemoryStore

# ---------------------------------------------------
# SETTINGS
# ---------------------------------------------------

MAX_RECENT_ITEMS = 30
MODEL = "gpt-5-nano"

client = OpenAI()

# ---------------------------------------------------
# SYSTEM PROMPT
# ---------------------------------------------------

SYSTEM_PROMPT = """
-----------------------------------
ROLE
-----------------------------------
You are a clinical medical assistant for Ethiopia.

Use the uploaded guidelines as your PRIMARY source.

Always search the vector store before answering clinical questions.

-----------------------------------
REFERENCING (MANDATORY)
-----------------------------------
At the end of EVERY response include:

References:
- [Exact Guideline Name], Page [X]

Allowed guideline names:
- Standard Treatment Guidelines for General Hospitals
- National Antenatal Care Guideline (2022)
- National Malaria Guidelines (2018)

Rules:
- Use exact names
- If multiple sources used, list all
- If page number unavailable, omit page
- Never fabricate page numbers
- Never write Uploaded Document
"""

VECTOR_STORE_ID = "vs_69d7ea3f2f5c8191abfee9317ddcb1b8"

# ---------------------------------------------------
# CHATKIT SERVER
# ---------------------------------------------------

class StarterChatServer(ChatKitServer[dict[str, Any]]):
    """ChatKit server using OpenAI Responses API with file search."""

    def __init__(self) -> None:
        self.store: MemoryStore = MemoryStore()
        super().__init__(self.store)

    async def respond(
        self,
        thread: ThreadMetadata,
        item: UserMessageItem | None,
        context: dict[str, Any],
    ) -> AsyncIterator[ThreadStreamEvent]:

        # Load previous conversation
        items_page = await self.store.load_thread_items(
            thread.id,
            after=None,
            limit=MAX_RECENT_ITEMS,
            order="desc",
            context=context,
        )

        items = list(reversed(items_page.data))

        # Convert chat history into plain text
        messages = []
        for it in items:
            if hasattr(it, "content"):
                messages.append(it.content)

        user_input = "\n".join(messages)

        # Call OpenAI Responses API with file search
        response = client.responses.create(
            model=MODEL,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
            ],
            tools=[
                {
                    "type": "file_search",
                    "vector_store_ids": [VECTOR_STORE_ID],
                }
            ],
        )

        # Extract model output text safely
        output_text = ""
        if response.output:
            for item in response.output:
                if item.type == "message":
                    for content in item.content:
                        if content.type == "output_text":
                            output_text += content.text

        # Stream back as ChatKit-compatible event
        yield ThreadStreamEvent(
            type="response.output_text.delta",
            delta=output_text,
        )

        yield ThreadStreamEvent(
            type="response.completed",
        )