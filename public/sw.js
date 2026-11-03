const CACHE="aryanzz-v81-2";
const SHELL=["/?v=81.2","/manifest.webmanifest?v=81.2","/v674.css?v=81.2","/v674.js?v=81.2","/v677.css?v=67.7","/v677.js?v=67.7","/v680.css?v=71.0","/v680.js?v=71.0","/advanced.js?v=59.5","/v15.js?v=59.5","/v15.css?v=59.5","/v25.css?v=80.0","/v25.js?v=80.0","/owner.css?v=59.5","/owner.js?v=59.5","/downloader.css?v=81.2","/downloader.js?v=81.2","/ffmpeg-worker-bootstrap.js?v=80.0","/v59.css?v=59.5","/v59.js?v=59.5","/editor-pro.css?v=65.0","/editor.js?v=65.0","/music-recognition.css?v=71.0","/music-recognition.js?v=71.0","/v690.css?v=71.0","/audio-studio.css?v=80.0","/audio-studio.js?v=80.0","/image-studio.css?v=81.2","/image-studio.js?v=81.2"];
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
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;if(u.pathname==="/api/youtube/hybrid/browser-file"){e.respondWith(browserMediaDownload(e.request));return;}if(u.pathname.startsWith("/api/"))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,cp)))}return r}).catch(()=>caches.match(e.request).then(r=>r||(/navigate/.test(e.request.mode)?caches.match("/?v=80.0"):Response.error()))))});
