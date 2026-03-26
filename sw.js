const CACHE='pateduca-core-v20260326-1';
const APP_SHELL=[
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa.css',
  './pwa.js',
  './safe_ui_patch.css',
  './safe_ui_patch.js',
  './educator_patch.css',
  './educator_patch.js',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).catch(()=>null));
});

self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e=>{
  if(e.data && e.data.type==='SKIP_WAITING') self.skipWaiting();
});

async function fromCacheFirst(req){
  const cached = await caches.match(req, {ignoreSearch:true});
  if(cached) return cached;
  const res = await fetch(req);
  if(res && res.ok){
    const copy = res.clone();
    caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>null);
  }
  return res;
}

async function fromNetworkFirst(req){
  try{
    const res = await fetch(req);
    if(res && res.ok){
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>null);
    }
    return res;
  }catch(_){
    return (await caches.match(req, {ignoreSearch:true}))
      || (await caches.match('./index.html'))
      || (await caches.match('./offline.html'));
  }
}

self.addEventListener('fetch', e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  if(url.origin!==self.location.origin){
    return;
  }

  if(req.mode==='navigate'){
    e.respondWith(fromNetworkFirst(req));
    return;
  }

  const isAppShell =
    APP_SHELL.some(path => url.pathname.endsWith(path.replace('./','/'))) ||
    /\.(?:css|js|webmanifest|png|jpg|jpeg|svg|woff2?)$/i.test(url.pathname);

  e.respondWith(isAppShell ? fromCacheFirst(req) : fromNetworkFirst(req));
});
