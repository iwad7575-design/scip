import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://xpgqpsxttwztdfhuwpmj.supabase.co";

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ3Fwc3h0dHd6dGRmaHV3cG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTUxMzQsImV4cCI6MjA5MzM5MTEzNH0.zmcR106YyQMaDEiUxmWZZCzb4A94ahwNGzwMr9maLCU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
