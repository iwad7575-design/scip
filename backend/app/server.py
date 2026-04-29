"""ChatKit server connected to your OpenAI RAG Workflow."""

from __future__ import annotations

from typing import Any, AsyncIterator

from agents import (
    Agent,
    Runner,
    FileSearchTool,
    ModelSettings,
)
from openai.types.shared.reasoning import Reasoning

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

# ---------------------------------------------------
# FILE SEARCH TOOL (YOUR VECTOR STORE)
# ---------------------------------------------------

file_search = FileSearchTool(
    vector_store_ids=[
        "vs_69d7ea3f2f5c8191abfee9317ddcb1b8"
    ]
)

# ---------------------------------------------------
# YOUR REAL RAG AGENT
# ---------------------------------------------------

assistant_agent = Agent[AgentContext[dict[str, Any]]](
    name="SCIP RAG Agent",
    model=MODEL,
    instructions="""
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
""",
    tools=[file_search],
    model_settings=ModelSettings(
        store=True,
        reasoning=Reasoning(
            effort="low",
            summary="auto"
        )
    ),
)

# ---------------------------------------------------
# CHATKIT SERVER
# ---------------------------------------------------

class StarterChatServer(ChatKitServer[dict[str, Any]]):
    """ChatKit server using your custom RAG agent."""

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
        agent_input = await simple_to_agent_input(items)

        agent_context = AgentContext(
            thread=thread,
            store=self.store,
            request_context=context,
        )

        # RUN YOUR REAL AGENT
        result = Runner.run_streamed(
            assistant_agent,
            agent_input,
            context=agent_context,
        )

        async for event in stream_agent_response(
            agent_context,
            result
        ):
            yield event