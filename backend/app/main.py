"""FastAPI entrypoint for ChatKit backend."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from .server import StarterChatServer

app = FastAPI(title="SCIP RAG Agent API")

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://scip-amber.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
        "backend": "online",
    }


@app.post("/chatkit")
async def chatkit_endpoint(request: Request) -> Response:
    """Handle ChatKit frontend requests."""

    try:
        payload = await request.body()

        result = await chatkit_server.process(
            payload,
            {"request": request},
        )

        # Handle streaming responses
        if hasattr(result, "__aiter__"):
            return StreamingResponse(
                result,
                media_type="text/event-stream",
            )

        # Handle JSON responses
        if hasattr(result, "json"):
            return Response(
                content=result.json,
                media_type="application/json",
            )

        return JSONResponse(content=result)

    except Exception as e:
        print("CHATKIT ERROR:", str(e))

        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )