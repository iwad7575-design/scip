"""FastAPI entrypoint for ChatKit backend."""

from __future__ import annotations

from chatkit.server import StreamingResult
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from .server import StarterChatServer

app = FastAPI(title="SCIP RAG Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create chat server
chatkit_server = StarterChatServer()


@app.get("/")
async def root():
    return {
        "status": "running",
        "agent": "SCIP RAG Agent",
        "backend": "online"
    }


@app.post("/chatkit")
async def chatkit_endpoint(request: Request) -> Response:
    """Handle ChatKit frontend requests."""

    payload = await request.body()

    result = await chatkit_server.process(
        payload,
        {"request": request},
    )

    if isinstance(result, StreamingResult):
        return StreamingResponse(
            result,
            media_type="text/event-stream"
        )

    if hasattr(result, "json"):
        return Response(
            content=result.json,
            media_type="application/json"
        )

    return JSONResponse(result)