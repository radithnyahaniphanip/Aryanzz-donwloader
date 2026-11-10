const CACHE="aryanzz-build-__ARYANZZ_VERSION__";
const RELEASE_CHANNEL="V1";
const SHELL=["/auth-gate.css?v=__ARYANZZ_VERSION__","/auth-gate.js?v=__ARYANZZ_VERSION__","/guest-access.js?v=__ARYANZZ_VERSION__","/text-protection.css?v=__ARYANZZ_VERSION__","/text-protection.js?v=__ARYANZZ_VERSION__","/auth-profile-v1.css?v=2","/auth-reset-v1.css?v=2","/update-manager.js?v=__ARYANZZ_VERSION__",
  "/workspace-home.css?v=__ARYANZZ_VERSION__","/workspace-tools.css?v=__ARYANZZ_VERSION__","/workspace-library.css?v=__ARYANZZ_VERSION__","/workspace-navigation.css?v=__ARYANZZ_VERSION__",
  "/workspace-home.js?v=__ARYANZZ_VERSION__","/workspace-layout.js?v=__ARYANZZ_VERSION__","/workspace-library.js?v=__ARYANZZ_VERSION__","/workspace-tools.js?v=__ARYANZZ_VERSION__","/wa-quote-generator.js?v=__ARYANZZ_VERSION__","/wa-quote-generator.css?v=__ARYANZZ_VERSION__","/workspace-navigation.js?v=__ARYANZZ_VERSION__","/workspace-guides.js?v=__ARYANZZ_VERSION__","/workspace-guides.css?v=__ARYANZZ_VERSION__","/workspace-manifest.json?v=__ARYANZZ_VERSION__","/favicon.svg?v=__ARYANZZ_VERSION__","/theme-studio.css?v=__ARYANZZ_VERSION__","/theme-studio.js?v=__ARYANZZ_VERSION__","/speed-test.js?v=94.6","/?v=__ARYANZZ_VERSION__","/panduan.html","/v89.css?v=93.2","/v95-ui.css?v=__ARYANZZ_VERSION__","/manifest.webmanifest?v=__ARYANZZ_VERSION__","/v674.css?v=94.25.0","/v674.js?v=94.25.0","/v677.css?v=85.3","/v677.js?v=67.7","/v680.css?v=71.0","/v680.js?v=71.0","/advanced.js?v=92.5","/v15.js?v=59.5","/v15.css?v=59.5","/v25.css?v=__ARYANZZ_VERSION__","/v25.js?v=__ARYANZZ_VERSION__","/owner.css?v=__ARYANZZ_VERSION__","/brand-refresh.css?v=82.1","/owner.js?v=__ARYANZZ_VERSION__","/downloader.css?v=88.3&build=__ARYANZZ_VERSION__","/downloader.js?v=94.25.0&build=__ARYANZZ_VERSION__","/network-mode.js?v=__ARYANZZ_VERSION__","/ffmpeg-worker-bootstrap.js?v=92.2","/v59.css?v=59.5","/v59.js?v=59.5","/editor-pro.css?v=65.0","/editor.js?v=65.0","/music-recognition.css?v=71.0","/music-recognition.js?v=71.0","/v690.css?v=71.0","/audio-studio.css?v=92.0","/audio-studio.js?v=92.5","/media-studio.css?v=92.0","/media-studio.js?v=92.0","/download-queue.css?v=92.0","/download-queue.js?v=92.0","/image-studio.css?v=81.4","/image-studio.js?v=81.4","/preview-fix.css?v=1.1","/search-session-fix.css?v=94.12.2","/link-bypass.css?v=94.0","/link-bypass.js?v=94.0","/stage1-tools.css?v=__ARYANZZ_VERSION__","/stage1-tools-panel.html","/emote-studio.css?v=__ARYANZZ_VERSION__","/emote-studio.html","/emote-studio.js?v=__ARYANZZ_VERSION__","/stage1-tools-core.js?v=__ARYANZZ_VERSION__","/stage1-video-tools.js?v=__ARYANZZ_VERSION__","/stage1-image-tools.js?v=__ARYANZZ_VERSION__","/stage1-file-tools.js?v=__ARYANZZ_VERSION__","/stage1-dev-tools.js?v=__ARYANZZ_VERSION__"];
const OFFLINE_DB_NAME="aryanzz-offline-v1",OFFLINE_DB_VERSION=1;
function openOfflineDb(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(OFFLINE_DB_NAME,OFFLINE_DB_VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   for(const name of ["api","library","media","settings"])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name==="library"?"sourceUrl":"key"});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error("Offline database unavailable"));
 });
}
async function offlineSetting(){
 try{
  const db=await openOfflineDb();
  const record=await new Promise((resolve,reject)=>{
   const request=db.transaction("settings","readonly").objectStore("settings").get("mode");
   request.onsuccess=()=>resolve(request.result||null);
   request.onerror=()=>reject(request.error);
  });
  return record?.value==="offline";
 }catch{return false}
}
function offlineMediaKey(rawUrl){
 try{
  const u=new URL(rawUrl,self.location.origin);
  if(u.origin!==self.location.origin)return "";
  if(u.pathname==="/api/social-file")return [u.searchParams.get("source")||"",u.searchParams.get("url")||"",u.searchParams.get("mode")||"video",u.searchParams.get("ext")||"mp4"].join("|");
  if(u.pathname==="/api/youtube/hybrid/browser-file")return ["youtube",u.searchParams.get("url")||"",u.searchParams.get("instance")||"","video",u.searchParams.get("ext")||"mp4"].join("|");
  return "";
 }catch{return ""}
}
async function offlineMediaEntry(key){
 if(!key)return null;
 try{
  const db=await openOfflineDb();
  return await new Promise((resolve,reject)=>{
   const request=db.transaction("media","readonly").objectStore("media").get(key);
   request.onsuccess=()=>resolve(request.result||null);
   request.onerror=()=>reject(request.error);
  });
 }catch{return null}
}
function serveOfflineBlob(request,entry){
 const blob=entry?.blob;
 if(!(blob instanceof Blob))return new Response(JSON.stringify({error:"File offline tidak valid."}),{status:503,headers:{"content-type":"application/json","cache-control":"no-store"}});
 const size=blob.size,type=entry.mimeType||blob.type||"application/octet-stream",range=request.headers.get("range"),url=new URL(request.url);
 const base={"content-type":type,"accept-ranges":"bytes","cache-control":"no-store","x-content-type-options":"nosniff"};
 if(url.searchParams.get("probe")==="1"){
  if(!entry.verified)return new Response(JSON.stringify({valid:false,error:"File offline belum lolos validasi."}),{status:422,headers:{"content-type":"application/json","cache-control":"no-store"}});
  return new Response(JSON.stringify({valid:true,bytes:size,mimeType:type,extension:entry.extension||url.searchParams.get("ext")||"mp4",rangeSupported:true,offline:true}),{status:200,headers:{"content-type":"application/json","cache-control":"no-store"}});
 }
 if(entry.verified)base["x-aryanzz-media-validation"]="signature-ok";
 if(!range)return new Response(blob,{status:200,headers:{...base,"content-length":String(size)}});
 const match=range.match(/^bytes=(\d*)-(\d*)$/i);
 if(!match)return new Response(null,{status:416,headers:{...base,"content-range":"bytes */"+size}});
 let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]||0));
 let end=match[1]?Number(match[2]||size-1):size-1;
 if(!match[1]&&match[2])end=size-1;
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=size)return new Response(null,{status:416,headers:{...base,"content-range":"bytes */"+size}});
 end=Math.min(end,size-1);
 const part=blob.slice(start,end+1,type);
 return new Response(part,{status:206,headers:{...base,"content-length":String(part.size),"content-range":"bytes "+start+"-"+end+"/"+size}});
}
async function offlineAwareFile(request,onlineHandler){
 const key=offlineMediaKey(request.url);
 const offline=await offlineSetting()||!self.navigator.onLine;
 if(offline){
  const entry=await offlineMediaEntry(key);
  if(entry)return serveOfflineBlob(request,entry);
  return new Response(JSON.stringify({error:"File belum disimpan offline. Aktifkan Mode Online, periksa tautan, lalu tekan Simpan untuk offline."}),{status:503,headers:{"content-type":"application/json","cache-control":"no-store"}});
 }
 let response=null;
 try{
  response=await onlineHandler(request);
  if(response.ok||response.status<500)return response;
 }catch{}
 const entry=await offlineMediaEntry(key);
 if(entry)return serveOfflineBlob(request,entry);
 return response||new Response(JSON.stringify({error:"Koneksi stream terputus dan belum ada salinan offline."}),{status:502,headers:{"content-type":"application/json","cache-control":"no-store"}});
}

async function browserMediaDownload(request){
  const incoming=new URL(request.url),raw=incoming.searchParams.get("url")||"",instance=incoming.searchParams.get("instance")||"",ext=String(incoming.searchParams.get("ext")||"mp4").toLowerCase(),title=String(incoming.searchParams.get("title")||"aryanzz-media");
  const validationUrl=new URL("/api/youtube/hybrid/validate",self.location.origin);
  validationUrl.searchParams.set("url",raw);validationUrl.searchParams.set("instance",instance);validationUrl.searchParams.set("ext",ext);validationUrl.searchParams.set("title",title);
  let validation;
  try{
    const response=await fetch(validationUrl.toString(),{cache:"no-store",credentials:"same-origin"});
    validation=await response.json().catch(()=>({}));
    if(!response.ok||!validation.ok)return new Response(JSON.stringify({error:validation.error||"Validasi sumber media ditolak."}),{status:response.status||400,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch(error){return new Response(JSON.stringify({error:"Validasi stream gagal: "+String(error.message||error)}),{status:502,headers:{"content-type":"application/json","cache-control":"no-store"}});}
  const range=request.headers.get("range");
  const host=new URL(validation.url).hostname.toLowerCase();
  const refs=host==="googlevideo.com"||host.endsWith(".googlevideo.com")
    ?["https://www.youtube.com/",validation.instance?validation.instance+"/":null]
    :host.includes("pipedproxy")
      ?[validation.instance?validation.instance+"/":null,"https://piped.video/"]
      :[validation.instance?validation.instance+"/":null,"https://www.youtube.com/"];
  let upstream=null,lastError="";
  for(const referrer of refs.filter(Boolean).concat([null])){
    try{
      const headers={accept:"*/*"};
      if(range)headers.range=range;
      upstream=await fetch(validation.url,{method:"GET",mode:"cors",credentials:"omit",cache:"no-store",redirect:"follow",headers,referrer:referrer||"about:client",referrerPolicy:"strict-origin-when-cross-origin"});
      if(![403,429,500,502,503,504].includes(upstream.status))break;
      lastError="HTTP "+upstream.status;
      if(upstream.body)await upstream.body.cancel().catch(()=>{});
    }catch(error){lastError=String(error.message||"network/CORS error");upstream=null;}
  }
  if(!upstream||![200,206].includes(upstream.status)||!upstream.body)return new Response(JSON.stringify({error:"Koneksi browser ke provider gagal: "+(lastError||("HTTP "+(upstream?.status||502)))}),{status:502,headers:{"content-type":"application/json","cache-control":"no-store"}});
  if(range&&upstream.status!==206){await upstream.body.cancel().catch(()=>{});return new Response(JSON.stringify({error:"Provider browser tidak mendukung unduhan parsial/resume (HTTP "+upstream.status+")."}),{status:502,headers:{"content-type":"application/json","cache-control":"no-store"}});}
  const contentType=String(upstream.headers.get("content-type")||"").split(";")[0].toLowerCase();
  if(contentType.startsWith("text/")||contentType.includes("json")||contentType.includes("xml")){await upstream.body.cancel().catch(()=>{});return new Response(JSON.stringify({error:"Provider browser mengirim halaman, bukan file media."}),{status:502,headers:{"content-type":"application/json","cache-control":"no-store"}});}
  const contentRange=String(upstream.headers.get("content-range")||""),totalMatch=contentRange.match(/\/(\d+)$/);
  const total=Number(totalMatch?.[1]||upstream.headers.get("content-length")||0);
  if(total>500*1024*1024){await upstream.body.cancel().catch(()=>{});return new Response(JSON.stringify({error:"File melebihi batas 500 MB."}),{status:413,headers:{"content-type":"application/json","cache-control":"no-store"}});}
  const clean=(validation.title||"aryanzz-media").replace(/[\\/:*?"<>|\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,90)||"aryanzz-media";
  const filename=clean.toLowerCase().endsWith("."+ext)?clean:clean+"."+ext;
  const headers=new Headers({"content-type":contentType||({mp4:"video/mp4",m4a:"audio/mp4",mp3:"audio/mpeg",webm:"video/webm",opus:"audio/ogg",ogg:"audio/ogg",wav:"audio/wav",flac:"audio/flac"}[ext]||"application/octet-stream"),"content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(filename),"cache-control":"no-store","x-content-type-options":"nosniff","accept-ranges":upstream.headers.get("accept-ranges")||"bytes"});
  for(const name of ["content-length","content-range","etag","last-modified"])if(upstream.headers.get(name))headers.set(name,upstream.headers.get(name));
  let received=0;
  const limited=upstream.body.pipeThrough(new TransformStream({transform(chunk,controller){received+=chunk.byteLength;if(received>500*1024*1024){controller.error(new Error("File melebihi batas 500 MB."));return;}controller.enqueue(chunk);}}));
  return new Response(limited,{status:upstream.status,headers});
}
// Release 95: take control immediately and let the update manager verify the live Worker build.
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const u=new URL(e.request.url);
 if(u.origin!==location.origin)return;
 if(u.pathname==="/api/youtube/hybrid/browser-file"){e.respondWith(offlineAwareFile(e.request,browserMediaDownload));return;}
 if(u.pathname==="/api/social-file"){e.respondWith(offlineAwareFile(e.request,request=>fetch(request)));return;}
 if(u.pathname.startsWith("/api/"))return;
 const critical=e.request.mode==="navigate"||["/","/index.html","/sw.js","/release.json","/manifest.webmanifest"].includes(u.pathname);
 if(critical){
  e.respondWith(fetch(new Request(e.request,{cache:"no-store"})).catch(()=>caches.match(e.request).then(r=>r||(/navigate/.test(e.request.mode)?caches.match("/?v=__ARYANZZ_VERSION__"):Response.error()))));
  return;
 }
 e.respondWith(fetch(e.request).then(r=>{
  if(r.ok&&r.headers.get("cache-control")!=="no-store"){const cp=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,cp)))}
  return r;
 }).catch(()=>caches.match(e.request).then(r=>r||Response.error())));
});
