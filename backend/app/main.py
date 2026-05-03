"""FastAPI entrypoint for ChatKit backend (Render-ready)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app.server import StarterChatServer  # IMPORTANT: absolute import

load_dotenv()

app = FastAPI(title="SCIP RAG Agent API")

# Read frontend URL from env so it doesn't need to be changed in code when domains change.
_frontend_url = os.getenv("FRONTEND_URL", "https://scip-amber.vercel.app")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    _frontend_url,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # change to ["*"] if debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Initialize chat server
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

        # ✅ Streaming response (important for ChatKit)
        if hasattr(result, "__aiter__"):
            return StreamingResponse(
                result,
                media_type="text/event-stream",
            )

        # ✅ JSON-like response object
        if hasattr(result, "json"):
            return Response(
                content=result.json,
                media_type="application/json",
            )

        # ✅ Default JSON response
        return JSONResponse(content=result)

    except Exception as e:
        print("CHATKIT ERROR:", str(e))

        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )