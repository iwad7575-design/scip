"""FastAPI entrypoint for ChatKit backend (Render-ready)."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

import asyncio
import json
import time

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.server import StarterChatServer, MODEL, SYSTEM_PROMPT, VECTOR_STORE_ID, client, _save_history  # IMPORTANT: absolute import
from app.supabase_client import supabase

bearer = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    t = time.perf_counter()
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: supabase.auth.get_user(credentials.credentials))
        ms = (time.perf_counter() - t) * 1000
        print(f"[TIMING] auth(required): {ms:.0f}ms", flush=True)
        if not result.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return result.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

async def get_optional_user(request: Request):
    """Returns the authenticated user, or None for unauthenticated requests."""
    auth = request.headers.get("Authorization", "")
    t = time.perf_counter()
    if not auth.startswith("Bearer "):
        request.state.auth_ms = 0.0
        return None
    token = auth.removeprefix("Bearer ").strip()
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: supabase.auth.get_user(token))
        request.state.auth_ms = (time.perf_counter() - t) * 1000
        return result.user if result.user else None
    except Exception:
        request.state.auth_ms = (time.perf_counter() - t) * 1000
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


@app.get("/ping")
async def ping():
    """Ultra-lightweight keep-alive endpoint — no DB call."""
    return {"status": "alive"}


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
    """Public chat endpoint — streams SSE text deltas as they arrive."""
    t0 = time.perf_counter()
    auth_ms = getattr(request.state, "auth_ms", 0.0)
    print(f"[TIMING] /ask received | model={MODEL} | auth={auth_ms:.0f}ms | user={'yes' if _user else 'guest'}", flush=True)

    body = await request.json()
    messages = body.get("messages", [])

    if not messages:
        return JSONResponse(status_code=400, content={"error": "messages required"})

    auth_header = request.headers.get("Authorization", "")
    access_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

    t_parse = time.perf_counter()
    print(f"[TIMING] request parsed: {(t_parse - t0)*1000:.0f}ms | messages={len(messages)}", flush=True)

    async def generate():
        full_text = ""
        first_delta_at: list[float] = []
        queue: asyncio.Queue = asyncio.Queue()

        async def run_stream():
            t_openai_start = time.perf_counter()
            print(f"[TIMING] → OpenAI stream starting (file_search max_num_results=5, score_threshold=0.3, max_output_tokens=800)", flush=True)
            try:
                async with client.responses.stream(
                    model=MODEL,
                    input=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                    max_output_tokens=800,
                    tools=[{
                        "type": "file_search",
                        "vector_store_ids": [VECTOR_STORE_ID],
                        "max_num_results": 5,
                        "ranking_options": {"score_threshold": 0.3},
                    }],
                ) as stream:
                    async for event in stream:
                        etype = getattr(event, "type", "")
                        if etype == "response.output_item.added":
                            item_type = getattr(getattr(event, "item", None), "type", "?")
                            print(f"[TIMING] output_item.added type={item_type} at {(time.perf_counter()-t_openai_start)*1000:.0f}ms", flush=True)
                        elif etype == "response.output_text.delta":
                            delta = getattr(event, "delta", "")
                            if delta:
                                if not first_delta_at:
                                    ttft = (time.perf_counter() - t_openai_start) * 1000
                                    total_ttft = (time.perf_counter() - t0) * 1000
                                    first_delta_at.append(time.perf_counter())
                                    print(f"[TIMING] ⚡ FIRST TOKEN: {ttft:.0f}ms after OpenAI call | {total_ttft:.0f}ms end-to-end", flush=True)
                                await queue.put(("delta", delta))
            except Exception as e:
                print(f"[TIMING] OpenAI error after {(time.perf_counter()-t_openai_start)*1000:.0f}ms: {type(e).__name__}: {e}", flush=True)
                await queue.put(("error", str(e)))
            finally:
                t_done = time.perf_counter()
                print(f"[TIMING] ✓ stream done | OpenAI={( t_done - t_openai_start)*1000:.0f}ms | total={( t_done - t0)*1000:.0f}ms | chars={len(full_text)}", flush=True)
                await queue.put(("done", None))

        asyncio.create_task(run_stream())

        while True:
            try:
                kind, value = await asyncio.wait_for(queue.get(), timeout=15)
                if kind == "delta":
                    full_text += value
                    yield f"data: {json.dumps({'delta': value})}\n\n"
                elif kind == "error":
                    yield f"data: {json.dumps({'error': 'Failed to generate a response. Please try again.'})}\n\n"
                    return
                elif kind == "done":
                    break
            except asyncio.TimeoutError:
                print(f"[TIMING] keepalive at {(time.perf_counter()-t0)*1000:.0f}ms (file_search still running)", flush=True)
                yield ": keepalive\n\n"

        if _user and access_token and full_text:
            user_question = next(
                (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
            )
            if user_question:
                loop = asyncio.get_event_loop()
                loop.run_in_executor(None, _save_history, access_token, str(_user.id), user_question, full_text)

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
