// In dev (vite dev), use the local proxy. In production builds, use the
// hardcoded values so Vercel env vars can't accidentally override them.
export const CHATKIT_API_URL = import.meta.env.DEV
  ? "/chatkit"
  : "https://scip-noyz.onrender.com";

export const CHATKIT_API_DOMAIN_KEY = import.meta.env.DEV
  ? "domain_pk_localhost_dev"
  : "domain_pk_69f8b39ff3788195a0ad669691b10db60df5b735fe39805f";
