const CACHE='media-studio-r2';
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./manifest.webmanifest',
  './favicon.ico','./favicon-32x32.png','./favicon-16x16.png','./apple-touch-icon.png',
  './icon-96.png','./icon-192.png','./icon-512.png','./icon-1024.png'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
