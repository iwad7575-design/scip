"""FastAPI entrypoint for ChatKit backend (Render-ready)."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app.server import StarterChatServer  # IMPORTANT: absolute import
from app.supabase_client import supabase

app = FastAPI(title="SCIP RAG Agent API")

_extra = os.getenv("FRONTEND_URL", "")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://scip-eta.vercel.app",
    *([_extra] if _extra else []),
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


@app.get("/health")
async def health():
    try:
        # Lightweight check — list auth settings (no rows fetched)
        supabase.auth.get_session()
        return {"status": "ok", "supabase": "connected"}
    except Exception as e:
        return {"status": "ok", "supabase": f"error: {str(e)}"}


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
            async def encode_stream():
                async for chunk in result:
                    if isinstance(chunk, bytes):
                        yield chunk
                    elif isinstance(chunk, str):
                        yield chunk.encode()
                    elif hasattr(chunk, "model_dump_json"):
                        yield f"data: {chunk.model_dump_json()}\n\n".encode()
                    else:
                        yield f"data: {chunk}\n\n".encode()
            return StreamingResponse(
                encode_stream(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
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