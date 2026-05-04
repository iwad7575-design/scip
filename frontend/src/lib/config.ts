// In dev (vite dev), use the local proxy. In production builds, use the
// hardcoded values so Vercel env vars can't accidentally override them.
export const CHATKIT_API_URL = import.meta.env.DEV
  ? "/chatkit"
  : "https://scip-noyz.onrender.com/chatkit";

export const ASK_API_URL = import.meta.env.DEV
  ? "/ask"
  : "https://scip-noyz.onrender.com/ask";

export const CHATKIT_API_DOMAIN_KEY = import.meta.env.DEV
  ? "domain_pk_localhost_dev"
  : "domain_pk_69f8bb0636408195afca74ace8a68f83078aac657c9cc0e7";
