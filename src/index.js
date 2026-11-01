const MEDIA_EXT = new Set(["mp4","webm","mov","m4v","mp3","m4a","aac","wav","ogg","oga","flac"]);
const MAX_BYTES = 100 * 1024 * 1024;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function parseMediaUrl(raw){
  let u;try{u=new URL(raw)}catch{throw new Error("URL tidak valid.")}
  if(!["http:","https:"].includes(u.protocol))throw new Error("Hanya URL HTTP/HTTPS yang diizinkan.");
  if(u.username||u.password)throw new Error("URL dengan kredensial tidak diizinkan.");
  const h=u.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  if(h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h==="::1"||h==="::"||
    /^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)||/^fc[0-9a-f]{2}:/i.test(h)||/^fd[0-9a-f]{2}:/i.test(h)||/^fe80:/i.test(h))
    throw new Error("Alamat jaringan lokal tidak diizinkan.");
  const ext=(u.pathname.split(".").pop()||"").toLowerCase();
  if(!MEDIA_EXT.has(ext))throw new Error("Gunakan tautan file langsung MP4, WebM, MP3, atau format media yang didukung.");
  return {url:u,ext};
}
function fileName(u,ext){let n;try{n=decodeURIComponent(u.pathname.split("/").pop()||"")}catch{n=""}n=(n||"aryanzz-media."+ext).replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,100);if(!n.includes("."))n+="."+ext;return n}
async function getUpstream(parsed,method="HEAD"){
  let current=parsed;
  for(let i=0;i<5;i++){
    let response=await fetch(current.url.toString(),{method,redirect:"manual",headers:{"user-agent":"ARYANZZ/2.0 media fetch"}});
    if(method==="HEAD"&&[403,405,501].includes(response.status)){
      response=await fetch(current.url.toString(),{method:"GET",redirect:"manual",headers:{"user-agent":"ARYANZZ/2.0 media fetch","range":"bytes=0-0"}});
      if(response.body)response.body.cancel().catch(()=>{});
    }
    if(![301,302,303,307,308].includes(response.status))return {response,parsed:current};
    const loc=response.headers.get("location");if(!loc) return {response,parsed:current};
    current=parseMediaUrl(new URL(loc,current.url).toString());
  }
  throw new Error("Terlalu banyak pengalihan URL.");
}
const PLATFORM_HOSTS=["youtube.com","youtu.be","youtube-nocookie.com","tiktok.com","instagram.com","facebook.com","fb.watch","pinterest.com","pin.it"];
function isPlatformLink(raw){
  try{const u=new URL(raw);const h=u.hostname.toLowerCase();return ["http:","https:"].includes(u.protocol)&&PLATFORM_HOSTS.some(d=>h===d||h.endsWith("."+d));}catch{return false;}
}
async function proxyPlatform(request,env,path){
  let body;try{body=await request.clone().json()}catch{return json({error:"Body JSON tidak valid."},400)}
  if(!isPlatformLink(body?.url))return null;
  if(!env.PLATFORM_API_ORIGIN)return json({error:"Backend ekstraksi platform belum dihubungkan. Tautan file media langsung tetap bisa diunduh."},503);
  if(!env.PLATFORM_API_TOKEN)return json({error:"Token backend belum dikonfigurasi pada Cloudflare Worker."},503);
  let origin;try{origin=new URL(env.PLATFORM_API_ORIGIN).origin}catch{return json({error:"Konfigurasi backend tidak valid."},500)}
  try{
    const response=await fetch(origin+path,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},body:JSON.stringify(body)});
    return new Response(response.body,{status:response.status,headers:{"content-type":response.headers.get("content-type")||"application/json","content-disposition":response.headers.get("content-disposition")||"","cache-control":"no-store"}});
  }catch{return json({error:"Backend ekstraksi sedang tidak dapat dijangkau."},502)}
}
async function info(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  let parsed;try{parsed=parseMediaUrl(body?.url)}catch(e){return json({error:e.message},400)}
  try{
    const {response,parsed:final}=await getUpstream(parsed,"HEAD");
    if(!response.ok)return json({error:"Server sumber menjawab HTTP "+response.status+"."},502);
    const size=Number(response.headers.get("content-length")||0);
    if(size>MAX_BYTES)return json({error:"File melebihi batas 100 MB."},413);
    return json({ok:true,title:fileName(final.url,final.ext),filename:fileName(final.url,final.ext),extension:final.ext,type:["mp3","m4a","aac","wav","ogg","oga","flac"].includes(final.ext)?"audio":"video",size:size||null,mime:response.headers.get("content-type")||null,source:final.url.hostname});
  }catch(e){return json({error:e.message||"Gagal memeriksa file."},502)}
}
async function download(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  let parsed;try{parsed=parseMediaUrl(body?.url)}catch(e){return json({error:e.message},400)}
  let upstream;
  try{const result=await getUpstream(parsed,"GET");upstream=result.response;parsed=result.parsed}
  catch(e){return json({error:e.message||"Tidak dapat menghubungi server sumber."},502)}
  if(!upstream.ok||!upstream.body)return json({error:"Server sumber tidak menyediakan file (HTTP "+upstream.status+")."},502);
  const size=Number(upstream.headers.get("content-length")||0);
  if(size>MAX_BYTES){await upstream.body.cancel();return json({error:"Ukuran file melebihi batas 100 MB."},413)}
  let received=0;
  const limited=upstream.body.pipeThrough(new TransformStream({transform(chunk,controller){received+=chunk.byteLength;if(received>MAX_BYTES){controller.error(new Error("File melebihi batas 100 MB."));return}controller.enqueue(chunk)}}));
  const headers=new Headers({"content-type":upstream.headers.get("content-type")||"application/octet-stream","content-disposition":'attachment; filename="'+fileName(parsed.url,parsed.ext)+'"',"cache-control":"no-store","x-content-type-options":"nosniff"});
  if(size)headers.set("content-length",String(size));
  return new Response(limited,{status:200,headers});
}

const SAVENOW_BASE="https://p.savenow.to";
const YOUTUBE_FORMATS=new Set(["mp3","m4a","webm","aac","flac","opus","ogg","wav","144","240","360","480","720","1080","1440","4k"]);
function isYouTubeUrl(raw){
  try{
    const u=new URL(raw),h=u.hostname.toLowerCase();
    return ["http:","https:"].includes(u.protocol)&&
      ["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtu.be","www.youtu.be"].includes(h);
  }catch{return false;}
}
function savenowHeaders(){return {
  accept:"*/*",
  "accept-language":"id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "cache-control":"no-cache",
  pragma:"no-cache",
  referer:"https://en.loader.to/"
};}
async function savenowRequest(path,env){
  if(!env.SAVENOW_API_KEY)return {error:"API key downloader YouTube belum dipasang di Cloudflare Worker.",status:503};
  const response=await fetch(SAVENOW_BASE+path,{
    headers:savenowHeaders(),
    signal:AbortSignal.timeout(25000)
  });
  const raw=await response.text();let data;
  try{data=JSON.parse(raw)}catch{return {error:"Respons layanan downloader tidak valid (HTTP "+response.status+").",status:502};}
  if(!response.ok)return {error:data.error||"Layanan downloader menjawab HTTP "+response.status+".",status:502};
  return {data};
}
function youtubeResult(initial,data,format){
  const fileUrl=data.download_url||data.url||initial.download_url||initial.url;
  if(!fileUrl)return null;
  let parsed;try{parsed=new URL(fileUrl)}catch{return null;}
  if(!["http:","https:"].includes(parsed.protocol))return null;
  return {status:true,pending:false,result:{
    title:initial.info?.title||"YouTube Content",
    thumbnail:initial.info?.image||null,
    format,
    filename:data.filename||null,
    url:parsed.toString(),
    expiresIn:data.expires_in||null
  }};
}
async function youtubeStart(request,env){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  if(!isYouTubeUrl(body?.url))return json({error:"URL YouTube tidak valid."},400);
  const format=String(body?.format||"mp3").toLowerCase();
  if(!YOUTUBE_FORMATS.has(format))return json({error:"Format tidak didukung."},400);
  const params=new URLSearchParams({format,url:body.url,apikey:env.SAVENOW_API_KEY||"",add_info:"1"});
  try{
    const response=await savenowRequest("/api/v2/download?"+params.toString(),env);
    if(response.error)return json({error:response.error},response.status);
    const initial=response.data;
    if(!initial.success)return json({error:initial.error||"Gagal memulai proses download."},502);
    const ready=youtubeResult(initial,initial,format);if(ready)return json(ready);
    if(!initial.id)return json({error:"ID proses download tidak ditemukan."},502);
    return json({status:true,pending:true,id:String(initial.id),format,info:{
      title:initial.info?.title||"YouTube Content",
      thumbnail:initial.info?.image||null
    }});
  }catch(e){return json({error:e.message||"Gagal menghubungi layanan downloader."},502)}
}
async function youtubeProgress(request,env){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const id=String(body?.id||"");
  const format=String(body?.format||"mp3").toLowerCase();
  if(!/^[a-zA-Z0-9_-]{1,160}$/.test(id))return json({error:"ID proses tidak valid."},400);
  if(!YOUTUBE_FORMATS.has(format))return json({error:"Format tidak didukung."},400);
  const params=new URLSearchParams({id,_:String(Date.now())});
  try{
    const response=await savenowRequest("/api/progress?"+params.toString(),env);
    if(response.error)return json({error:response.error},response.status);
    const data=response.data;
    const initial={info:body.info||{}};
    const ready=youtubeResult(initial,data,format);if(ready)return json(ready);
    if(data.error||/fail|error|gagal/i.test(data.text||""))return json({error:data.text||data.error||"Proses download gagal."},502);
    return json({status:true,pending:true,text:typeof data.text==="string"?data.text:"",progress:data.progress??null});
  }catch(e){return json({error:e.message||"Gagal memeriksa proses download."},502)}
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS"&&url.pathname.startsWith("/api/"))return new Response(null,{status:204,headers:{"access-control-allow-origin":url.origin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type"}});
  if(url.pathname==="/api/youtube/download"&&request.method==="POST")return youtubeStart(request,env);
  if(url.pathname==="/api/youtube/progress"&&request.method==="POST")return youtubeProgress(request,env);
  if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"ARYANZZ",version:"27.1",mode:"cloudflare-worker",directMediaDownload:true,youtubeDownloader:true,youtubeApiKeyConfigured:!!env.SAVENOW_API_KEY,platformExtraction:!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN),platformBackend:env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN?"configured":"not-configured"});
  if(url.pathname==="/api/info"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/info");if(proxied)return proxied;return info(request);}
  if(url.pathname==="/api/download"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/download");if(proxied)return proxied;return download(request);}
  if(url.pathname.startsWith("/api/"))return json({error:"Endpoint tidak ditemukan."},404);
  return env.ASSETS.fetch(request);
}};
