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

from app.server import StarterChatServer, MODEL, SYSTEM_PROMPT, VECTOR_STORE_ID, client, _save_history  # IMPORTANT: absolute import
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

async def get_optional_user(request: Request):
    """Returns the authenticated user, or None for unauthenticated requests."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.removeprefix("Bearer ").strip()
    try:
        result = supabase.auth.get_user(token)
        return result.user if result.user else None
    except Exception:
        return None

app = FastAPI(title="SCIP RAG Agent API")

_extra = os.getenv("FRONTEND_URL", "")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://scip-eta.vercel.app",
    "https://scip-et.com",
    "https://www.scip-et.com",
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


@app.post("/ask")
async def ask_endpoint(request: Request, _user=Depends(get_optional_user)):
    """Public chat endpoint — no auth required, history saved for logged-in users."""
    body = await request.json()
    messages = body.get("messages", [])

    if not messages:
        return JSONResponse(status_code=400, content={"error": "messages required"})

    auth_header = request.headers.get("Authorization", "")
    access_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

    try:
        response = await client.responses.create(
            model=MODEL,
            input=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            tools=[{"type": "file_search", "vector_store_ids": [VECTOR_STORE_ID]}],
        )
    except Exception as e:
        print(f"OpenAI /ask error: {type(e).__name__}: {e}", flush=True)
        return JSONResponse(status_code=500, content={"error": str(e)})

    output_text = ""
    for out in (response.output or []):
        content_list = getattr(out, "content", None) or []
        for content in content_list:
            text = getattr(content, "text", None)
            if text:
                output_text += text

    if _user and access_token and output_text:
        user_question = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
        )
        if user_question:
            loop = asyncio.get_event_loop()
            loop.run_in_executor(None, _save_history, access_token, str(_user.id), user_question, output_text)

    return JSONResponse({"text": output_text or "I'm sorry, I couldn't generate a response. Please try again."})


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
                # Collect chunks in a background task so asyncio.wait_for
                # keepalive timeouts never cancel the OpenAI RAG request.
                chunks: list[bytes] = []
                done_event = asyncio.Event()

                async def collect():
                    try:
                        async for chunk in result:
                            if isinstance(chunk, bytes):
                                chunks.append(chunk)
                            elif isinstance(chunk, str):
                                chunks.append(chunk.encode())
                            elif hasattr(chunk, "model_dump_json"):
                                chunks.append(f"data: {chunk.model_dump_json()}\n\n".encode())
                            else:
                                chunks.append(f"data: {chunk}\n\n".encode())
                    finally:
                        done_event.set()

                asyncio.create_task(collect())

                while not done_event.is_set():
                    try:
                        await asyncio.wait_for(done_event.wait(), timeout=20)
                    except asyncio.TimeoutError:
                        yield b": keepalive\n\n"

                for chunk in chunks:
                    yield chunk

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
