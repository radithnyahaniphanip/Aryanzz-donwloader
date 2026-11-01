const CACHE="aryanzz-v67-0";
const SHELL=[
  "/?v=67.0",
  "/manifest.webmanifest?v=67.0",
  "/advanced.js?v=59.5",
  "/v15.js?v=59.5",
  "/v15.css?v=59.5",
  "/v25.css?v=59.5",
  "/v25.js?v=59.5",
  "/owner.css?v=59.5",
  "/owner.js?v=59.5",
  "/downloader.css?v=59.5",
  "/downloader.js?v=59.5",
  "/v59.css?v=59.5",
  "/v59.js?v=59.5",
  "/editor-pro.css?v=65.0",
  "/editor.js?v=65.0",
  "/music-recognition.css?v=67.0",
  "/music-recognition.js?v=67.0"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin||url.pathname.startsWith("/api/"))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.match(event.request).then(match=>match||(/navigate/.test(event.request.mode)?caches.match("/?v=67.0"):Response.error()))));
});
