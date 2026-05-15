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
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);
