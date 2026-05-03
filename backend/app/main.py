"""FastAPI entrypoint for ChatKit backend (Render-ready)."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

import asyncio

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.server import StarterChatServer  # IMPORTANT: absolute import
from app.supabase_client import supabase

bearer = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        result = supabase.auth.get_user(credentials.credentials)
        if not result.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return result.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

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
async def chatkit_endpoint(request: Request, _user=Depends(get_current_user)) -> Response:
    """Handle ChatKit frontend requests."""

    try:
        payload = await request.body()

        auth_header = request.headers.get("Authorization", "")
        access_token = auth_header.removeprefix("Bearer ").strip()

        result = await chatkit_server.process(
            payload,
            {"request": request, "user": _user, "access_token": access_token},
        )

        # ✅ Streaming response (important for ChatKit)
        if hasattr(result, "__aiter__"):
            async def encode_stream():
                # Send SSE keep-alive comments while waiting for the OpenAI
                # RAG pipeline so the browser doesn't hit the idle timeout.
                async def _next(it):
                    try:
                        return await it.__anext__(), False
                    except StopAsyncIteration:
                        return None, True

                it = result.__aiter__()
                while True:
                    try:
                        chunk, done = await asyncio.wait_for(_next(it), timeout=20)
                        if done:
                            break
                        if isinstance(chunk, bytes):
                            yield chunk
                        elif isinstance(chunk, str):
                            yield chunk.encode()
                        elif hasattr(chunk, "model_dump_json"):
                            yield f"data: {chunk.model_dump_json()}\n\n".encode()
                        else:
                            yield f"data: {chunk}\n\n".encode()
                    except asyncio.TimeoutError:
                        yield b": keepalive\n\n"

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