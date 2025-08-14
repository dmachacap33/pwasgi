const CACHE_NAME='rag-prebuilt-v1';
const ASSETS=['./','./index.html','./manifest.webmanifest','./src/app.js','./src/rag.js','./src/ui.css','./assets/icon-192.png','./assets/icon-512.png','./knowledge/index-manifest.json'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE_NAME);await c.addAll(ASSETS);self.skipWaiting();})())});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  const isIndex=url.pathname.includes('/knowledge/index/');
  if(isIndex){
    event.respondWith((async()=>{try{const net=await fetch(event.request);const cache=await caches.open(CACHE_NAME);cache.put(event.request,net.clone());return net;}catch{const cached=await caches.match(event.request);return cached||Response.error();}})());
    return;
  }
  event.respondWith(caches.match(event.request).then(res=>res||fetch(event.request)));
});
