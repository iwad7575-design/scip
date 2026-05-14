"""FastAPI entrypoint for ChatKit backend (Render-ready)."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

import asyncio
import json
import re
import time
from collections import OrderedDict

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.server import StarterChatServer, MODEL, SYSTEM_PROMPT, VECTOR_STORE_ID, client, _save_history  # IMPORTANT: absolute import
from app.supabase_client import supabase

bearer = HTTPBearer()

# ── In-memory response cache ──────────────────────────────────────────────────
# Stores up to 50 single-turn question→answer pairs for 24 hours.
# Only caches the first message in a session (multi-turn answers depend on
# prior context, so the same last message can produce different answers).

_CACHE_TTL = 86_400   # 24 hours
_CACHE_SIZE = 50
_STREAM_TIMEOUT_S = 55  # Cancel OpenAI call if no first token within this time

_CITATION_RE = re.compile(
    r"filecite\s*turn\d+\s*file\d+"   # fileciteturn0file1  (full pattern)
    r"|turn\d+file\d+"                 # turn0file0
    r"|【[^】]*】"                     # 【4:0†source】
    r"|filecite\w*",                   # orphaned filecite prefix split across streaming chunks
    re.IGNORECASE,
)

def _clean_citations(text: str) -> str:
    text = _CITATION_RE.sub("", text)
    text = re.sub(r" {2,}", " ", text)          # collapse double spaces
    text = re.sub(r" ([,\.;:!?])", r"\1", text) # remove space before punctuation
    return text


_COMMON_DRUGS = [
    "artemether", "lumefantrine", "artesunate", "quinine",
    "amoxicillin", "ampicillin", "penicillin", "ceftriaxone",
    "cotrimoxazole", "metronidazole", "doxycycline", "azithromycin",
    "ciprofloxacin", "gentamicin", "isoniazid", "rifampicin",
    "ethambutol", "pyrazinamide", "fluconazole",
    "nevirapine", "tenofovir", "lamivudine", "efavirenz",
    "oxytocin", "magnesium sulfate", "diazepam", "hydrocortisone",
    "dexamethasone", "salbutamol", "adrenaline", "atropine",
    "furosemide", "digoxin", "morphine", "paracetamol", "ibuprofen",
    "insulin", "zinc", "vitamin A",
]
_DOSE_RE = re.compile(r"\d+\s*(?:mg|mcg|g\b|IU|ml|mL|units?|tabs?)", re.IGNORECASE)

def _check_drug_doses(text: str) -> None:
    lower = text.lower()
    for drug in _COMMON_DRUGS:
        idx = lower.find(drug.lower())
        if idx == -1:
            continue
        window = text[max(0, idx - 20): idx + len(drug) + 80]
        if not _DOSE_RE.search(window):
            print(f"[DRUG WARNING] mentioned without dose: {drug}", flush=True)


class _ResponseCache:
    def __init__(self) -> None:
        self._data: OrderedDict[str, tuple[str, float]] = OrderedDict()

    def _key(self, q: str) -> str:
        return " ".join(q.lower().strip().split())

    def get(self, question: str) -> str | None:
        k = self._key(question)
        entry = self._data.get(k)
        if entry is None:
            return None
        answer, ts = entry
        if time.time() - ts > _CACHE_TTL:
            del self._data[k]
            return None
        self._data.move_to_end(k)
        return answer

    def set(self, question: str, answer: str) -> None:
        if not answer.strip():
            return
        k = self._key(question)
        if k in self._data:
            self._data.move_to_end(k)
        elif len(self._data) >= _CACHE_SIZE:
            self._data.popitem(last=False)  # evict oldest
        self._data[k] = (answer, time.time())


_cache = _ResponseCache()


def _num_results(messages: list[dict]) -> int:
    """Return 3 for short questions (≤10 words), 5 for longer ones."""
    last = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
    return 3 if len(last.split()) <= 10 else 5

# ─────────────────────────────────────────────────────────────────────────────

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

    # Extract last user question for cache lookup
    user_messages = [m for m in messages if m.get("role") == "user"]
    user_question = user_messages[-1].get("content", "") if user_messages else ""
    is_single_turn = len(user_messages) == 1  # Only cache first-turn; follow-ups depend on context

    # ── Cache hit: stream the cached answer immediately ───────────────────────
    if is_single_turn and user_question:
        cached = _cache.get(user_question)
        if cached:
            print(f"[CACHE] ✓ hit | chars={len(cached)} | question={user_question[:60]}", flush=True)

            async def _cached_gen():
                yield f"data: {json.dumps({'delta': cached})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

            return StreamingResponse(
                _cached_gen(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

    num_results = _num_results(messages)
    print(f"[TIMING] num_results={num_results} (question words: {len(user_question.split())})", flush=True)

    async def generate():
        nonlocal user_question
        full_text = ""
        first_delta_at: list[float] = []
        queue: asyncio.Queue = asyncio.Queue()
        got_first_token = False

        async def run_stream():
            t_openai_start = time.perf_counter()
            print(
                f"[TIMING] → OpenAI stream starting "
                f"(file_search max_num_results={num_results}, score_threshold=0.35)",
                flush=True,
            )
            try:
                async with client.responses.stream(
                    model=MODEL,
                    input=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                    reasoning={"effort": "low"},
                    tools=[{
                        "type": "file_search",
                        "vector_store_ids": [VECTOR_STORE_ID],
                        "max_num_results": num_results,
                        "ranking_options": {"score_threshold": 0.35},
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
                                await queue.put(("delta", _clean_citations(delta)))
            except asyncio.CancelledError:
                print(f"[TIMING] ⏰ stream cancelled by watchdog (no first token in {_STREAM_TIMEOUT_S}s)", flush=True)
            except Exception as e:
                print(f"[TIMING] OpenAI error after {(time.perf_counter()-t_openai_start)*1000:.0f}ms: {type(e).__name__}: {e}", flush=True)
                queue.put_nowait(("error", str(e)))
            finally:
                t_done = time.perf_counter()
                print(f"[TIMING] ✓ stream done | total={( t_done - t0)*1000:.0f}ms | chars={len(full_text)}", flush=True)
                queue.put_nowait(("done", None))

        stream_task = asyncio.create_task(run_stream())

        # Watchdog: cancel the OpenAI call if no first token within timeout
        async def _watchdog():
            await asyncio.sleep(_STREAM_TIMEOUT_S)
            if not stream_task.done() and not got_first_token:
                stream_task.cancel()
                queue.put_nowait(("error", "timeout"))

        asyncio.create_task(_watchdog())

        while True:
            try:
                kind, value = await asyncio.wait_for(queue.get(), timeout=15)
                if kind == "delta":
                    got_first_token = True  # type: ignore[assignment]  # nonlocal via closure
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

        if full_text:
            _check_drug_doses(full_text)

        # Store in cache (single-turn questions only, non-empty answers)
        if is_single_turn and user_question and full_text:
            _cache.set(user_question, full_text)
            print(f"[CACHE] stored | chars={len(full_text)} | question={user_question[:60]}", flush=True)

        if _user and access_token and full_text:
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
