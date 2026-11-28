const V='pocket-v1';
const SHELL=['./','index.html','manifest.webmanifest','favicon.png','icon-192.png','icon-512.png','apple-touch-icon.png',
 'lib/pdf.min.js','lib/pdf.worker.min.js','lib/jszip.min.js','lib/mammoth.browser.min.js','lib/xlsx.full.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=='share').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method==='POST'&&u.pathname.endsWith('/share-target')){
    e.respondWith((async()=>{
      try{
        const fd=await r.formData(); const f=fd.get('file');
        if(f&&f.name!==undefined){
          const c=await caches.open('share');
          await c.put('shared-file',new Response(f,{headers:{'X-Name':encodeURIComponent(f.name),'Content-Type':f.type||'application/octet-stream'}}));
        }
      }catch(err){}
      return Response.redirect('./?shared=1',303);
    })());
    return;
  }
  if(r.method!=='GET')return;
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>hit||fetch(r)));
});
