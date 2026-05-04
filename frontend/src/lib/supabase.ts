import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://xpgqpsxttwztdfhuwpmj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ3Fwc3h0dHd6dGRmaHV3cG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTUxMzQsImV4cCI6MjA5MzM5MTEzNH0.zmcR106YyQMaDEiUxmWZZCzb4A94ahwNGzwMr9maLCU"
);
