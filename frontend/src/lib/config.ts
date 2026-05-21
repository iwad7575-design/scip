// Use runtime hostname to detect dev — build-time import.meta.env.DEV is
// unreliable on Vercel and evaluates true, sending requests to the wrong URL.
const _local = window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1';

const RENDER = "https://scip-noyz.onrender.com";

export const CHATKIT_API_URL = _local ? "/chatkit" : `${RENDER}/chatkit`;
export const ASK_API_URL     = _local ? "/ask"     : `${RENDER}/ask`;
export const BACKEND_HEALTH_URL = _local ? "/health" : `${RENDER}/health`;
export const BACKEND_PING_URL   = _local ? "/ping"   : `${RENDER}/ping`;
export const SHARE_API_URL      = _local ? "/share"  : `${RENDER}/share`;

export const CHATKIT_API_DOMAIN_KEY = _local
  ? "domain_pk_localhost_dev"
  : "domain_pk_69f8bb0636408195afca74ace8a68f83078aac657c9cc0e7";

// Base URL for direct fetch calls (empty string = Vite proxy on localhost)
export const BACKEND_URL = _local ? "" : RENDER;
