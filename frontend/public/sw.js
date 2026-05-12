const CACHE = 'scip-shell-v1';
const SHELL = ['/', '/logo.png', '/manifest.json', '/favicon.ico'];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SCIP — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#0B2545;color:#fff;
         display:flex;align-items:center;justify-content:center;
         min-height:100dvh;text-align:center;padding:2rem}
    .wrap{max-width:320px}
    .icon{font-size:3rem;margin-bottom:1rem}
    h1{font-size:1.2rem;margin-bottom:.75rem;font-weight:700}
    p{font-size:.9rem;color:rgba(255,255,255,.7);line-height:1.6}
    .btn{display:inline-block;margin-top:1.5rem;padding:.75rem 2rem;
         background:#2ECC71;color:#fff;border-radius:8px;
         font-weight:600;cursor:pointer;border:none;font-size:.9rem}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon">📡</div>
    <h1>You are offline</h1>
    <p>SCIP requires internet to access clinical guidelines.<br><br>Please reconnect to continue.</p>
    <button class="btn" onclick="location.reload()">Try again</button>
  </div>
</body></html>`;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(cached => {
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return caches.match('/').then(root =>
              root || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } })
            );
          }
          return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } });
        })
      )
  );
});
