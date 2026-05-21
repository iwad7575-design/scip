import os
from urllib.parse import urlparse
from supabase import create_client, Client

# Strip any path suffix — Supabase URL must be the bare project base URL.
_raw = os.environ["SUPABASE_URL"]
_parsed = urlparse(_raw)
SUPABASE_URL = f"{_parsed.scheme}://{_parsed.netloc}" if _parsed.netloc else _raw

SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Service-role client — bypasses RLS for server-side writes.
# Falls back to anon client if the key is not configured (dev environments).
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY)
