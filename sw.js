
const CACHE='pateduca-safe-v20260310-2';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa.css',
  './pwa.js',
  './safe_ui_patch.css',
  './safe_ui_patch.js',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>null));
});
self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin){ return; }
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{ const copy=r.clone(); caches.open(CACHE).then(c=>c.put('./index.html', copy)).catch(()=>null); return r; }).catch(async()=> (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./offline.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(cached=> cached || fetch(req).then(r=>{ const copy=r.clone(); caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>null); return r; }).catch(()=>caches.match('./offline.html'))));
});
