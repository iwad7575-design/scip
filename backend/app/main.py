"""FastAPI entrypoint for ChatKit backend (Render-ready)."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

import asyncio
import base64
import json
import math
import re
import secrets
import string
import time
from collections import OrderedDict
from datetime import datetime, timezone, timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.server import StarterChatServer, call_via_proxy, call_via_proxy_stream, PROXY_URL  # IMPORTANT: absolute import
from app.supabase_client import supabase, supabase_admin

bearer = HTTPBearer()

limiter = Limiter(key_func=get_remote_address)

# ── In-memory response cache ──────────────────────────────────────────────────
# Increment CACHE_VERSION whenever system prompt / instructions change to
# instantly invalidate all existing cached answers.

CACHE_VERSION = "v37"
COMMISSION_RATE = 0.10   # referral commission — 10% of amount paid

_CACHE_TTL = 1_800    # 30 minutes
_CACHE_SIZE = 50
_STREAM_TIMEOUT_S = 55  # Cancel OpenAI call if no first token within this time

_CITATION_RE = re.compile(
    r"filecite\s*turn\d+\s*file\d+"   # fileciteturn0file1  (full pattern)
    r"|turn\d+file\d+"                 # turn0file0
    r"|【[^】]*】"                     # 【4:0†source】
    r"|filecite\w*"                    # orphaned filecite prefix split across streaming chunks
    r"|□"                              # Unicode box separator between citation tokens
    r"|\[\d+\]",                       # [1], [2] footnote-style citation markers
    re.IGNORECASE,
)

def _clean_citations(text: str) -> str:
    text = _CITATION_RE.sub("", text)
    text = re.sub(r" {2,}", " ", text)          # collapse double spaces
    text = re.sub(r" ([,\.;:!?])", r"\1", text) # remove space before punctuation
    return text


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


_DETAILED_TERMS = [
    "detailed", "explain", "describe", "comprehensive", "full", "complete",
    "workup", "approach", "overview", "how to", "tell me about",
    "what are the", "all", "list all", "investigate", "investigation",
]
_HIV_TERMS = [
    "rvi", "hiv", "aids", "plhiv", "antiretroviral", "art", "cd4",
    "opportunistic", "oi",
]
_MANAGEMENT_TERMS = [
    "management", "treatment", "treat", "manage", "gi oi", "opportunistic",
]

def _num_results(messages: list[dict]) -> int:
    last = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
    q = last.lower()
    is_detailed   = any(t in q for t in _DETAILED_TERMS)
    is_hiv        = any(t in q for t in _HIV_TERMS)
    is_management = any(t in q for t in _MANAGEMENT_TERMS)
    if is_detailed:
        n = 6
    elif is_hiv and is_management:
        n = 6
    elif is_hiv or is_management:
        n = 5
    else:
        n = 5
    return min(max(n, 5), 6)

# ─────────────────────────────────────────────────────────────────────────────

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    t = time.perf_counter()
    try:
        loop = asyncio.get_running_loop()
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
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, lambda: supabase.auth.get_user(token))
        request.state.auth_ms = (time.perf_counter() - t) * 1000
        return result.user if result.user else None
    except Exception:
        request.state.auth_ms = (time.perf_counter() - t) * 1000
        return None

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")
ADMIN_EMAIL  = os.getenv("ADMIN_EMAIL", "")

app = FastAPI(title="SCIP RAG Agent API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("startup")
async def _startup():
    _cache._data.clear()
    print(f"[CACHE] Cleared on startup (version={CACHE_VERSION})", flush=True)

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


@app.post("/admin/clear-cache")
async def clear_cache(secret: str = Header(None)):
    if not ADMIN_SECRET or secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    count = len(_cache._data)
    _cache._data.clear()
    print(f"[CACHE] Manually cleared via admin endpoint ({count} entries removed)", flush=True)
    return {"cleared": count, "version": CACHE_VERSION, "message": f"Cleared {count} entries"}


@app.get("/admin/stats")
async def admin_stats(user=Depends(get_current_user)):
    if not ADMIN_EMAIL or getattr(user, "email", "") != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Unauthorized")

    pending      = supabase_admin.table("payments").select("id").eq("status", "pending_review").execute()
    paid_subs    = supabase_admin.table("subscriptions").select("id").neq("plan_tier", "free").eq("status", "active").execute()
    all_subs     = supabase_admin.table("subscriptions").select("id").execute()
    referrals    = supabase_admin.table("referrals").select("id").execute()

    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    revenue_rows = supabase_admin.table("payments").select("amount_etb").eq("status", "approved").gte("created_at", first_of_month.isoformat()).execute()
    total_revenue = sum(float(p["amount_etb"]) for p in revenue_rows.data)

    return {
        "pending_payments":              len(pending.data),
        "active_paid_subscriptions":     len(paid_subs.data),
        "total_revenue_etb_this_month":  total_revenue,
        "total_referrals":               len(referrals.data),
        "total_subscriptions":           len(all_subs.data),
    }


@app.get("/admin/referral-stats")
async def admin_referral_stats(user=Depends(get_current_user)):
    if not ADMIN_EMAIL or getattr(user, "email", "") != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Unauthorized")

    result = supabase_admin.table("referrals").select(
        "referral_code, referrer_id, referred_id, status, created_at"
    ).execute()

    stats: dict = {}
    for row in result.data:
        code = row["referral_code"]
        if code not in stats:
            stats[code] = {
                "code": code,
                "referrer_id": row["referrer_id"],
                "total": 0,
                "active": 0,
                "pending": 0,
            }
        stats[code]["total"] += 1
        if row["status"] == "active":
            stats[code]["active"] += 1
        else:
            stats[code]["pending"] += 1

    return {
        "referral_codes": list(stats.values()),
        "total_referrals": len(result.data),
        "total_active": sum(1 for r in result.data if r["status"] == "active"),
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
@limiter.limit("20/minute")
async def ask_endpoint(request: Request, _user=Depends(get_optional_user)):
    """Public chat endpoint — streams SSE text deltas as they arrive."""
    t0 = time.perf_counter()
    auth_ms = getattr(request.state, "auth_ms", 0.0)
    print(f"[TIMING] /ask received | model=gpt-5-nano | auth={auth_ms:.0f}ms | user={'yes' if _user else 'guest'}", flush=True)

    body = await request.json()
    messages = body.get("messages", [])

    if not messages:
        return JSONResponse(status_code=400, content={"error": "messages required"})

    auth_header = request.headers.get("Authorization", "")
    access_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

    t_parse = time.perf_counter()
    print(f"[TIMING] request parsed: {(t_parse - t0)*1000:.0f}ms | messages_received={len(messages)} (only last user question sent to proxy)", flush=True)

    # Extract last user question for cache lookup
    user_messages = [m for m in messages if m.get("role") == "user"]
    user_question = user_messages[-1].get("content", "") if user_messages else ""
    is_single_turn = len(user_messages) == 1  # Only cache first-turn; follow-ups depend on context

    # Token limit check — only for logged-in users
    if _user:
        limit_check = await check_token_limit(str(_user.id))
        if not limit_check["allowed"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "token_limit_reached",
                    "message": (
                        f"You have used all {limit_check['questions_limit']} questions "
                        f"on your {limit_check['plan']} plan. Upgrade to continue."
                    ),
                    "plan": limit_check["plan"],
                    "upgrade_url": "/pricing",
                },
            )

    # ── Cache hit: stream the cached answer immediately ───────────────────────
    cache_key = f"{CACHE_VERSION}:{user_question}"
    if is_single_turn and user_question:
        cached = _cache.get(cache_key)
        if cached:
            print(f"[CACHE] ✓ hit | chars={len(cached)} | question={user_question[:60]}", flush=True)

            if _user:
                asyncio.ensure_future(consume_tokens(str(_user.id), user_question, cached))

            async def _cached_gen():
                yield f"data: {json.dumps({'delta': cached})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

            return StreamingResponse(
                _cached_gen(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

    async def generate():
        full_text = ""
        t_proxy = time.perf_counter()
        first_chunk = True
        try:
            print(f"[PROXY] → streaming from proxy for: {user_question[:60]}", flush=True)
            async for chunk in call_via_proxy_stream(user_question):
                if first_chunk:
                    print(f"[PROXY] ✓ first chunk at {(time.perf_counter()-t_proxy)*1000:.0f}ms", flush=True)
                    first_chunk = False
                full_text += chunk
                yield f"data: {json.dumps({'delta': chunk})}\n\n"

            if not full_text:
                yield f"data: {json.dumps({'error': 'Failed to generate a response. Please try again.'})}\n\n"
                return

            print(f"[PROXY] ✓ stream done in {(time.perf_counter()-t_proxy)*1000:.0f}ms | chars={len(full_text)}", flush=True)

            # Run post-processing on the complete assembled text
            cleaned_text = _clean_citations(full_text)

            if is_single_turn and user_question:
                _cache.set(cache_key, cleaned_text)
                print(f"[CACHE] stored | chars={len(cleaned_text)} | question={user_question[:60]}", flush=True)

            if _user:
                asyncio.ensure_future(consume_tokens(str(_user.id), user_question, cleaned_text))

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            print(f"[PROXY] ✗ stream error: {e}", flush=True)
            if not full_text:
                yield f"data: {json.dumps({'error': 'Failed to generate a response. Please try again.'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _generate_share_id() -> str:
    return secrets.token_urlsafe(16)


@app.post("/share")
async def create_share(request: Request, _user=Depends(get_optional_user)):
    """Create a shareable link for a conversation."""
    body = await request.json()
    messages = body.get("messages", [])
    user_id = body.get("user_id")

    print(f"[SHARE] POST /share | messages={len(messages)} | user_id={user_id}", flush=True)

    if not messages:
        return JSONResponse(status_code=400, content={"error": "messages required"})

    share_id = _generate_share_id()
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(None, lambda: supabase.from_("shared_responses").insert({
            "share_id": share_id,
            "messages": messages,
            "created_by": user_id,
        }).execute())
        # supabase-py v2 can return empty data on silent failure — verify insert succeeded
        if not result.data:
            print(f"[SHARE] Insert returned no data — table may not exist. Result: {result}", flush=True)
            return JSONResponse(status_code=500, content={"error": "Share could not be saved. The shared_responses table may not exist in Supabase."})
        print(f"[SHARE] Created share_id={share_id}", flush=True)
        return {"share_id": share_id}
    except Exception as e:
        print(f"[SHARE] Exception creating share: {type(e).__name__}: {e}", flush=True)
        return JSONResponse(status_code=500, content={"error": f"Failed to create share: {type(e).__name__}"})


@app.get("/share/{share_id}")
async def get_share(share_id: str):
    """Return a shared conversation by share_id."""
    print(f"[SHARE] GET /share/{share_id}", flush=True)
    loop = asyncio.get_running_loop()
    try:
        # maybe_single() returns None data instead of raising when no rows found
        result = await loop.run_in_executor(
            None,
            lambda: supabase.from_("shared_responses")
                .select("*")
                .eq("share_id", share_id)
                .eq("is_active", True)
                .maybe_single()
                .execute(),
        )
    except Exception as e:
        print(f"[SHARE] DB error for {share_id}: {type(e).__name__}: {e}", flush=True)
        return JSONResponse(status_code=500, content={"error": "Database error"})

    row = result.data if result else None
    print(f"[SHARE] Query result for {share_id}: {'found' if row else 'not found'}", flush=True)

    if not row:
        return JSONResponse(status_code=404, content={"error": "Share not found"})

    expires_at = row.get("expires_at")
    if expires_at:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > exp:
            return JSONResponse(status_code=404, content={"error": "Share has expired"})

    # Increment view_count fire-and-forget (ensure_future accepts futures from run_in_executor)
    new_count = row.get("view_count", 0) + 1
    asyncio.ensure_future(loop.run_in_executor(
        None,
        lambda: supabase.from_("shared_responses")
            .update({"view_count": new_count})
            .eq("share_id", share_id)
            .execute(),
    ))

    return {
        "share_id": share_id,
        "messages": row["messages"],
        "created_at": row.get("created_at"),
        "expires_at": row.get("expires_at"),
    }


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


# ── Referral system ───────────────────────────────────────────────────────────

def _generate_referral_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(8))


@app.post("/auth/check-email")
async def check_email(request: Request):
    body = await request.json()
    email = body.get("email", "").lower().strip()
    if not email:
        raise HTTPException(400, "Email required")
    try:
        users = supabase_admin.auth.admin.list_users(page=1, per_page=1000)
        for user in users:
            if user.email and user.email.lower() == email:
                return {
                    "exists": True,
                    "confirmed": user.email_confirmed_at is not None,
                }
        return {"exists": False, "confirmed": False}
    except Exception:
        # If check fails, let signup proceed and rely on Supabase's own validation
        return {"exists": False, "confirmed": False}


@app.get("/referral/code")
async def get_referral_code(user=Depends(get_current_user)):
    user_id = str(user.id)
    result = supabase_admin.table("referral_codes").select("code").eq("user_id", user_id).execute()
    if result.data:
        code = result.data[0]["code"]
    else:
        code = _generate_referral_code()
        supabase_admin.table("referral_codes").insert({"user_id": user_id, "code": code}).execute()
    return {
        "code": code,
        "link": f"https://scip-et.com/signup?ref={code}",
        "commission_rate": "10%",
        "message": "Share this link. Earn 10% of every subscription fee, every month your referral stays subscribed.",
    }


@app.get("/referral/stats")
async def get_referral_stats(user=Depends(get_current_user)):
    user_id = str(user.id)
    referrals = supabase_admin.table("referrals").select("*").eq("referrer_id", user_id).execute()
    earnings  = supabase_admin.table("referral_earnings").select("*").eq("referrer_id", user_id).execute()
    credits   = supabase_admin.table("question_credits").select("*").eq("user_id", user_id).execute()

    active_referral_rows = [r for r in referrals.data if r["status"] == "active"]
    active_referrals = len(active_referral_rows)

    # Calculate actual monthly commission from each referred user's current plan price
    monthly_earning_potential = 0.0
    if active_referral_rows:
        referred_ids = [r["referred_id"] for r in active_referral_rows]
        paid_subs = supabase_admin.table("subscriptions").select("user_id, plan_tier") \
            .in_("user_id", referred_ids).eq("status", "active").neq("plan_tier", "free").execute()
        if paid_subs.data:
            plan_tiers = list({s["plan_tier"] for s in paid_subs.data})
            plans_res = supabase_admin.table("subscription_plans").select("tier, price_etb") \
                .in_("tier", plan_tiers).execute()
            price_map = {p["tier"]: float(p["price_etb"]) for p in plans_res.data}
            monthly_earning_potential = round(
                sum(price_map.get(s["plan_tier"], 0) * COMMISSION_RATE for s in paid_subs.data), 2
            )

    return {
        "total_referrals": len(referrals.data),
        "active_referrals": active_referrals,
        "pending_earnings_etb": sum(
            e["commission_amount"] for e in earnings.data if e["status"] == "pending"
        ),
        "total_paid_etb": sum(
            e["commission_amount"] for e in earnings.data if e["status"] == "paid"
        ),
        "monthly_earning_potential": monthly_earning_potential,
        "free_questions_remaining": credits.data[0]["free_questions_remaining"] if credits.data else 0,
    }


@app.post("/referral/apply")
async def apply_referral(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    ref_code = body.get("ref_code", "").upper().strip()
    user_id = str(user.id)

    if not ref_code:
        raise HTTPException(status_code=400, detail="Referral code required")

    referrer = supabase_admin.table("referral_codes").select("user_id").eq("code", ref_code).execute()
    if not referrer.data:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    referrer_id = referrer.data[0]["user_id"]
    if referrer_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")

    user_data = supabase_admin.auth.admin.get_user_by_id(user_id)
    created_at = user_data.user.created_at
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - created_at > timedelta(minutes=60):
        raise HTTPException(status_code=400, detail="Referral links are only valid for new accounts")

    existing = supabase_admin.table("referrals").select("id").eq("referred_id", user_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Referral already applied")

    supabase_admin.table("referrals").insert({
        "referrer_id": referrer_id,
        "referred_id": user_id,
        "referral_code": ref_code,
        "status": "active",
    }).execute()

    existing_credits = supabase_admin.table("question_credits").select("*").eq("user_id", user_id).execute()
    if existing_credits.data:
        curr = existing_credits.data[0]
        supabase_admin.table("question_credits").update({
            "free_questions_remaining": curr["free_questions_remaining"] + 10,
            "total_earned": curr["total_earned"] + 10,
            "updated_at": "now()",
        }).eq("user_id", user_id).execute()
    else:
        supabase_admin.table("question_credits").insert({
            "user_id": user_id,
            "free_questions_remaining": 10,
            "total_earned": 10,
        }).execute()

    return {"success": True, "message": "Referral applied! You have 10 free questions.", "free_questions": 10}


@app.post("/referral/credits/add")
async def add_credits(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    questions = int(body.get("questions", 5))
    reason = body.get("reason", "signup_bonus")
    user_id = str(user.id)

    existing = supabase_admin.table("question_credits").select("*").eq("user_id", user_id).execute()
    if existing.data:
        curr = existing.data[0]
        supabase_admin.table("question_credits").update({
            "free_questions_remaining": curr["free_questions_remaining"] + questions,
            "total_earned": curr["total_earned"] + questions,
        }).eq("user_id", user_id).execute()
    else:
        supabase_admin.table("question_credits").insert({
            "user_id": user_id,
            "free_questions_remaining": questions,
            "total_earned": questions,
        }).execute()

    return {"success": True, "questions_added": questions, "reason": reason}


@app.get("/referral/credits")
async def get_credits(user=Depends(get_current_user)):
    user_id = str(user.id)
    credits = supabase_admin.table("question_credits").select("*").eq("user_id", user_id).execute()
    return {
        "free_questions_remaining": credits.data[0]["free_questions_remaining"] if credits.data else 0
    }


@app.post("/subscription/create-free")
async def create_free_subscription(user=Depends(get_current_user)):
    user_id = str(user.id)
    existing = supabase_admin.table("subscriptions").select("id").eq("user_id", user_id).execute()
    if existing.data:
        return {"success": True, "message": "Subscription already exists"}
    now = datetime.now(timezone.utc)
    supabase_admin.table("subscriptions").insert({
        "user_id":                user_id,
        "plan_tier":              "free",
        "status":                 "active",
        "tokens_used_this_month": 0,
        "tokens_limit":           94000,
        "current_period_start":   now.isoformat(),
        "current_period_end":     (now + timedelta(days=30)).isoformat(),
    }).execute()
    return {"success": True, "message": "Free subscription created"}


@app.get("/admin/student-verifications")
async def admin_student_verifications(status: str = "pending", user=Depends(get_current_user)):
    if str(user.email) != os.getenv("ADMIN_EMAIL", ""):
        raise HTTPException(status_code=403, detail="Admin only")
    result = supabase_admin.table("student_verifications").select("*").eq("status", status).order("created_at", desc=False).execute()
    return {"verifications": result.data}


@app.post("/admin/student/approve")
async def approve_student(request: Request, user=Depends(get_current_user)):
    if str(user.email) != os.getenv("ADMIN_EMAIL", ""):
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    vid = body.get("id")
    row = supabase_admin.table("student_verifications").select("user_id").eq("id", vid).execute()
    student_user_id = row.data[0]["user_id"] if row.data else None
    supabase_admin.table("student_verifications").update({
        "status":      "verified",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", vid).execute()
    if student_user_id:
        supabase_admin.table("notifications").insert({
            "user_id": student_user_id,
            "type":    "student_id_verified",
            "title":   "✅ Student ID Verified!",
            "message": "Your student ID has been verified.",
        }).execute()
    return {"success": True}


@app.post("/admin/student/reject")
async def reject_student(request: Request, user=Depends(get_current_user)):
    if str(user.email) != os.getenv("ADMIN_EMAIL", ""):
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    vid    = body.get("id")
    reason = body.get("reason", "ID could not be verified")
    row = supabase_admin.table("student_verifications").select("user_id").eq("id", vid).execute()
    student_user_id = row.data[0]["user_id"] if row.data else None
    supabase_admin.table("student_verifications").update({
        "status":           "rejected",
        "rejection_reason": reason,
        "reviewed_at":      datetime.now(timezone.utc).isoformat(),
    }).eq("id", vid).execute()
    if student_user_id:
        supabase_admin.table("notifications").insert({
            "user_id": student_user_id,
            "type":    "student_id_rejected",
            "title":   "❌ Student ID Not Verified",
            "message": f"Your student ID could not be verified. Reason: {reason}. "
                       "Please upload a clearer image of your valid student ID card.",
        }).execute()
    return {"success": True}


@app.get("/admin/student-id-url/{vid}")
async def get_student_id_url(vid: str, user=Depends(get_current_user)):
    if str(user.email) != os.getenv("ADMIN_EMAIL", ""):
        raise HTTPException(status_code=403, detail="Admin only")
    row = supabase_admin.table("student_verifications").select("document_url").eq("id", vid).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Not found")
    path = row.data[0]["document_url"]
    signed = supabase_admin.storage.from_("student-ids").create_signed_url(path, 3600)
    return {"url": signed.get("signedURL") or signed.get("signed_url")}


# ─────────────────────────────────────────────────────────────────────────────
# SUBSCRIPTION & TOKEN TRACKING
# ─────────────────────────────────────────────────────────────────────────────

def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


async def check_token_limit(user_id: str) -> dict:
    sub = supabase_admin.table("subscriptions").select("*").eq("user_id", user_id).execute()

    if not sub.data:
        now = datetime.now(timezone.utc)
        sub_data = {
            "user_id":                user_id,
            "plan_tier":              "free",
            "status":                 "active",
            "tokens_used_this_month": 0,
            "tokens_limit":           94000,
            "current_period_start":   now.isoformat(),
            "current_period_end":     (now + timedelta(days=30)).isoformat(),
        }
        supabase_admin.table("subscriptions").insert(sub_data).execute()
        return {
            "allowed":            True,
            "tokens_used":        0,
            "tokens_limit":       94000,
            "tokens_remaining":   94000,
            "plan":               "free",
            "questions_remaining": 94000 // 4700,
            "questions_used":     0,
            "questions_limit":    94000 // 4700,
        }

    s = sub.data[0]

    # Reset if monthly period has expired
    period_end = datetime.fromisoformat(s["current_period_end"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > period_end:
        now = datetime.now(timezone.utc)
        supabase_admin.table("subscriptions").update({
            "tokens_used_this_month": 0,
            "current_period_start":   now.isoformat(),
            "current_period_end":     (now + timedelta(days=30)).isoformat(),
        }).eq("user_id", user_id).execute()
        s["tokens_used_this_month"] = 0

    tokens_remaining = s["tokens_limit"] - s["tokens_used_this_month"]
    return {
        "allowed":             tokens_remaining > 1000,
        "tokens_used":         s["tokens_used_this_month"],
        "tokens_limit":        s["tokens_limit"],
        "tokens_remaining":    tokens_remaining,
        "plan":                s["plan_tier"],
        "questions_remaining": math.floor(tokens_remaining / 4700),
        "questions_used":      math.floor(s["tokens_used_this_month"] / 4700),
        "questions_limit":     math.floor(s["tokens_limit"] / 4700),
    }


async def consume_tokens(user_id: str, question: str, response: str) -> int:
    try:
        input_tokens  = estimate_tokens(question) + 2000  # +2000 for system prompt overhead
        output_tokens = estimate_tokens(response)
        total_tokens  = input_tokens + output_tokens

        sub = supabase_admin.table("subscriptions").select("tokens_used_this_month").eq("user_id", user_id).execute()
        if sub.data:
            current = sub.data[0]["tokens_used_this_month"]
            supabase_admin.table("subscriptions").update({
                "tokens_used_this_month": current + total_tokens,
            }).eq("user_id", user_id).execute()
            print(f"[TOKENS] +{total_tokens} tokens for user {user_id[:8]} (total={current + total_tokens})", flush=True)
        else:
            print(f"[TOKENS] no subscription row found for user {user_id[:8]}", flush=True)

        try:
            supabase_admin.table("token_usage_log").insert({
                "user_id":          user_id,
                "question_tokens":  input_tokens,
                "response_tokens":  output_tokens,
                "total_tokens":     total_tokens,
                "question_preview": question[:100],
            }).execute()
        except Exception as log_err:
            print(f"[TOKENS] token_usage_log insert failed (non-critical): {log_err}", flush=True)

        return total_tokens
    except Exception as e:
        print(f"[TOKENS] consume_tokens FAILED for user {user_id[:8]}: {e}", flush=True)
        return 0


# ─────────────────────────────────────────────────────────────────────────────
# PLANS & SUBSCRIPTION ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/plans")
async def get_plans():
    plans = supabase_admin.table("subscription_plans").select("*").eq("active", True).execute()
    return {"plans": plans.data}


@app.get("/subscription/me")
async def get_my_subscription(user=Depends(get_current_user)):
    return await check_token_limit(str(user.id))


# ─────────────────────────────────────────────────────────────────────────────
# PAYMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/payment/submit")
async def submit_payment(request: Request, user=Depends(get_current_user)):
    body    = await request.json()
    user_id = str(user.id)

    plan_tier             = body.get("plan_tier")
    amount_etb            = body.get("amount_etb")
    payment_method        = body.get("payment_method")
    transaction_reference = body.get("transaction_reference", "")
    screenshot_base64     = body.get("screenshot_base64")
    filename              = body.get("filename", "payment.jpg")

    if not all([plan_tier, amount_etb, screenshot_base64]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    plan = supabase_admin.table("subscription_plans").select("*").eq("tier", plan_tier).execute()
    if not plan.data:
        raise HTTPException(status_code=404, detail="Invalid plan")

    expected = plan.data[0]["price_etb"]
    if float(amount_etb) < float(expected):
        raise HTTPException(status_code=400, detail=f"Amount must be at least {expected} ETB")

    try:
        img_data = base64.b64decode(screenshot_base64)
        path = f"{user_id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        supabase_admin.storage.from_("payment-screenshots").upload(path, img_data, {"content-type": "image/jpeg"})
        screenshot_url = path
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    payment = supabase_admin.table("payments").insert({
        "user_id":               user_id,
        "plan_tier":             plan_tier,
        "amount_etb":            amount_etb,
        "payment_method":        payment_method,
        "transaction_reference": transaction_reference,
        "screenshot_url":        screenshot_url,
        "status":                "pending_review",
    }).execute()

    return {
        "success":    True,
        "payment_id": payment.data[0]["id"],
        "message":    "Payment submitted for review. Your subscription will be activated within 1-24 hours.",
        "status":     "pending_review",
    }


@app.post("/student/verify")
async def submit_student_id(request: Request, user=Depends(get_current_user)):
    body    = await request.json()
    user_id = str(user.id)

    document_base64 = body.get("document_base64")
    document_type   = body.get("document_type", "student_id")
    institution     = body.get("institution", "")
    filename        = body.get("filename", "student_id.jpg")
    content_type    = body.get("content_type", "image/jpeg")

    if not document_base64:
        raise HTTPException(status_code=400, detail="Document required")

    try:
        doc_data = base64.b64decode(document_base64)
        path = f"{user_id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        supabase_admin.storage.from_("student-ids").upload(path, doc_data, {"content-type": content_type})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    existing = supabase_admin.table("student_verifications").select("id").eq("user_id", user_id).execute()
    if existing.data:
        supabase_admin.table("student_verifications").update({
            "document_url":  path,
            "document_type": document_type,
            "institution":   institution,
            "status":        "pending",
        }).eq("user_id", user_id).execute()
    else:
        supabase_admin.table("student_verifications").insert({
            "user_id":       user_id,
            "document_url":  path,
            "document_type": document_type,
            "institution":   institution,
        }).execute()

    return {"success": True, "message": "Student ID submitted for verification. This usually takes 1-24 hours."}


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: PAYMENT MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/admin/payments")
async def admin_get_payments(status: str = "pending_review", user=Depends(get_current_user)):
    if not ADMIN_EMAIL or getattr(user, "email", "") != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Unauthorized")
    payments = (
        supabase_admin.table("payments")
        .select("*")
        .eq("status", status)
        .order("created_at", desc=False)
        .execute()
    )
    return {"payments": payments.data}


@app.get("/admin/payment/screenshot/{payment_id}")
async def admin_get_screenshot(payment_id: str, user=Depends(get_current_user)):
    if not ADMIN_EMAIL or getattr(user, "email", "") != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Unauthorized")
    payment = supabase_admin.table("payments").select("screenshot_url").eq("id", payment_id).execute()
    if not payment.data:
        raise HTTPException(status_code=404, detail="Payment not found")
    path = payment.data[0]["screenshot_url"]
    signed = supabase_admin.storage.from_("payment-screenshots").create_signed_url(path, 300)
    return {"signed_url": signed.get("signedURL") or signed.get("signed_url") or signed.get("signedUrl")}


@app.post("/admin/payment/approve")
async def approve_payment(request: Request, user=Depends(get_current_user)):
    if not ADMIN_EMAIL or getattr(user, "email", "") != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Unauthorized")

    body       = await request.json()
    payment_id = body.get("payment_id")

    payment = supabase_admin.table("payments").select("*").eq("id", payment_id).execute()
    if not payment.data:
        raise HTTPException(status_code=404, detail="Payment not found")

    p         = payment.data[0]
    user_id   = p["user_id"]
    plan_tier = p["plan_tier"]

    plan = supabase_admin.table("subscription_plans").select("*").eq("tier", plan_tier).execute()
    if not plan.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    pl         = plan.data[0]
    now        = datetime.now(timezone.utc)
    period_end = now + timedelta(days=30)

    existing_sub = supabase_admin.table("subscriptions").select("id").eq("user_id", user_id).execute()
    if existing_sub.data:
        supabase_admin.table("subscriptions").update({
            "plan_tier":              plan_tier,
            "status":                 "active",
            "tokens_limit":           pl["token_limit"],
            "tokens_used_this_month": 0,
            "current_period_start":   now.isoformat(),
            "current_period_end":     period_end.isoformat(),
            "updated_at":             now.isoformat(),
        }).eq("user_id", user_id).execute()
    else:
        supabase_admin.table("subscriptions").insert({
            "user_id":                user_id,
            "plan_tier":              plan_tier,
            "status":                 "active",
            "tokens_limit":           pl["token_limit"],
            "tokens_used_this_month": 0,
            "current_period_start":   now.isoformat(),
            "current_period_end":     period_end.isoformat(),
        }).execute()

    supabase_admin.table("payments").update({
        "status":      "approved",
        "reviewed_at": now.isoformat(),
    }).eq("id", payment_id).execute()

    supabase_admin.table("notifications").insert({
        "user_id": user_id,
        "type":    "payment_approved",
        "title":   "✅ Payment Approved!",
        "message": f"Your payment for the {plan_tier.title()} plan has been approved. "
                   f"Your account is now active with {pl['question_estimate']} questions per month.",
    }).execute()

    # Track referral commission — 10% of the actual amount paid
    try:
        ref_row = supabase_admin.table("referrals").select("referrer_id") \
            .eq("referred_id", user_id).eq("status", "active").execute()
        if ref_row.data:
            referrer_id = ref_row.data[0]["referrer_id"]
            commission  = round(float(p["amount_etb"]) * COMMISSION_RATE, 2)
            supabase_admin.table("referral_earnings").insert({
                "referrer_id":      referrer_id,
                "referred_id":      user_id,
                "payment_id":       payment_id,
                "commission_amount": commission,
                "status":           "pending",
            }).execute()
            print(f"[REFERRAL] Commission {commission} ETB queued for referrer {referrer_id[:8]}", flush=True)
    except Exception as ref_err:
        print(f"[REFERRAL] Commission tracking failed (non-critical): {ref_err}", flush=True)

    return {"success": True, "message": f"Payment approved. User upgraded to {plan_tier}."}


@app.post("/admin/payment/reject")
async def reject_payment(request: Request, user=Depends(get_current_user)):
    if not ADMIN_EMAIL or getattr(user, "email", "") != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Unauthorized")

    body       = await request.json()
    payment_id = body.get("payment_id")
    reason     = body.get("reason", "Payment could not be verified")

    payment = supabase_admin.table("payments").select("user_id").eq("id", payment_id).execute()
    user_id = payment.data[0]["user_id"] if payment.data else None

    supabase_admin.table("payments").update({
        "status":           "rejected",
        "rejection_reason": reason,
        "reviewed_at":      datetime.now(timezone.utc).isoformat(),
    }).eq("id", payment_id).execute()

    if user_id:
        supabase_admin.table("notifications").insert({
            "user_id": user_id,
            "type":    "payment_rejected",
            "title":   "❌ Payment Not Verified",
            "message": f"Your payment could not be verified. Reason: {reason}. "
                       "Please resubmit with a clear screenshot showing the transaction details.",
        }).execute()

    return {"success": True, "message": "Payment rejected"}


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    notifs = supabase_admin.table("notifications") \
        .select("*") \
        .eq("user_id", str(user.id)) \
        .order("created_at", desc=True) \
        .limit(20) \
        .execute()
    return {"notifications": notifs.data}


@app.post("/notifications/read")
async def mark_notifications_read(user=Depends(get_current_user)):
    supabase_admin.table("notifications") \
        .update({"read": True}) \
        .eq("user_id", str(user.id)) \
        .execute()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN USERS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/admin/users")
async def admin_users(user=Depends(get_current_user)):
    if str(user.email) != os.getenv("ADMIN_EMAIL", ""):
        raise HTTPException(status_code=403, detail="Admin only")
    subs = supabase_admin.table("subscriptions").select("*").order("created_at", desc=True).execute()
    # Batch-fetch all users to avoid N+1 calls
    try:
        all_users = supabase_admin.auth.admin.list_users()
        users_by_id = {str(u.id): u for u in (all_users if isinstance(all_users, list) else [])}
    except Exception:
        users_by_id = {}
    result = []
    for s in subs.data:
        u = users_by_id.get(s["user_id"])
        result.append({
            "user_id":                s["user_id"],
            "email":                  u.email if u else "—",
            "plan_tier":              s["plan_tier"],
            "status":                 s["status"],
            "tokens_used_this_month": s["tokens_used_this_month"],
            "tokens_limit":           s["tokens_limit"],
            "current_period_end":     s.get("current_period_end"),
            "last_sign_in":           str(u.last_sign_in_at) if u else None,
            "created_at":             s["created_at"],
        })
    return {"users": result, "total": len(result)}
