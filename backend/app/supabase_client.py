import os
from urllib.parse import urlparse
from supabase import create_client, Client

_FALLBACK_URL = "https://xpgqpsxttwztdfhuwpmj.supabase.co"
_FALLBACK_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ3Fwc3h0dHd6dGRmaHV3cG1qIiwi"
    "cm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTUxMzQsImV4cCI6MjA5MzM5MTEzNH0"
    ".zmcR106YyQMaDEiUxmWZZCzb4A94ahwNGzwMr9maLCU"
)

# Strip any path suffix — Supabase URL must be the bare project base URL.
_raw = os.getenv("SUPABASE_URL") or _FALLBACK_URL
_parsed = urlparse(_raw)
SUPABASE_URL = f"{_parsed.scheme}://{_parsed.netloc}" if _parsed.netloc else _FALLBACK_URL

SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or _FALLBACK_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
