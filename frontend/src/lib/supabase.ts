import { createClient } from "@supabase/supabase-js";

// Read the URL hash synchronously BEFORE createClient() runs.
// Supabase's initialization is async and clears the hash before any React
// effect fires, so this is the only reliable time to capture it.
const _raw = typeof window !== "undefined" ? window.location.hash : "";
const _hp = new URLSearchParams(_raw.replace(/^#/, ""));
export const initialAuthType = _hp.get("type");
export const initialAccessToken = _hp.get("access_token");
export const initialRefreshToken = _hp.get("refresh_token");

export const supabase = createClient(
  "https://xpgqpsxttwztdfhuwpmj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ3Fwc3h0dHd6dGRmaHV3cG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTUxMzQsImV4cCI6MjA5MzM5MTEzNH0.zmcR106YyQMaDEiUxmWZZCzb4A94ahwNGzwMr9maLCU"
);
