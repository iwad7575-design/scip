"""ChatKit server connected to OpenAI Responses API (RAG-enabled)."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from openai import AsyncOpenAI
from pydantic import BaseModel

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

VECTOR_STORE_ID = os.getenv("VECTOR_STORE_ID", "vs_69d7ea3f2f5c8191abfee9317ddcb1b8")


def extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, dict) and c.get("type") == "text":
                parts.append(c.get("text", ""))
        return " ".join(parts)
    return ""


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

        items_page = await self.store.load_thread_items(
            thread.id,
            after=None,
            limit=MAX_RECENT_ITEMS,
            order="desc",
            context=context,
        )

        items = list(reversed(items_page.data))

        messages = []
        for it in items:
            if hasattr(it, "content"):
                text = extract_text(it.content)
                if text:
                    messages.append(text)

        user_input = messages[-1] if messages else ""

        response = await client.responses.create(
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

        output_text = ""
        if response.output:
            for out in response.output:
                if out.type == "message":
                    for content in out.content:
                        if content.type == "output_text":
                            output_text += content.text

        assistant_item = AssistantMessageItem(
            id=str(uuid.uuid4()),
            thread_id=thread.id,
            created_at=datetime.now(timezone.utc),
            content=[AssistantMessageContent(text=output_text)],
        )

        yield ThreadItemAddedEvent(item=assistant_item)
        yield ThreadItemDoneEvent(item=assistant_item)
