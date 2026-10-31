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
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS"&&url.pathname.startsWith("/api/"))return new Response(null,{status:204,headers:{"access-control-allow-origin":url.origin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type"}});
  if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"ARYANZZ",version:"5.0",mode:"cloudflare-worker",directMediaDownload:true,platformExtraction:false,platformBackend:"not-configured"});
  if(url.pathname==="/api/info"&&request.method==="POST")return info(request);
  if(url.pathname==="/api/download"&&request.method==="POST")return download(request);
  if(url.pathname.startsWith("/api/"))return json({error:"Endpoint tidak ditemukan."},404);
  return env.ASSETS.fetch(request);
}};
