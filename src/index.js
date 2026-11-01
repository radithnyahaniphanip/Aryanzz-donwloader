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
const YOUTUBE_AUDIO_FORMATS=new Set(["mp3","m4a","webm","aac","flac","opus","ogg","wav"]);
const YOUTUBE_VIDEO_FORMATS=new Set(["360","720","1080","1440","mp44k"]);
const MAX_YOUTUBE_BYTES=500*1024*1024;

function isYouTubeUrl(raw){
  try{
    const u=new URL(raw),h=u.hostname.toLowerCase();
    return ["http:","https:"].includes(u.protocol)&&
      ["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtu.be","www.youtu.be","youtube-nocookie.com","www.youtube-nocookie.com"].includes(h);
  }catch{return false;}
}
function normalizeYoutubeFormat(value){
  const requested=String(value||"mp3").toLowerCase().trim();
  const apiFormat=requested==="4k"?"mp44k":requested;
  if(!YOUTUBE_AUDIO_FORMATS.has(apiFormat)&&!YOUTUBE_VIDEO_FORMATS.has(apiFormat))
    throw new Error("Format tidak didukung. Pilih MP3/audio atau video 360p–4K.");
  return {requested:requested==="mp44k"?"4k":requested,apiFormat,audio:YOUTUBE_AUDIO_FORMATS.has(apiFormat)};
}
function savenowHeaders(){return {
  accept:"*/*",
  "accept-language":"id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "cache-control":"no-cache",
  pragma:"no-cache",
  referer:"https://en.loader.to/"
};}
async function savenowRequest(path,env,{requireKey=true,redirect="follow"}={}){
  if(requireKey&&!env.SAVENOW_API_KEY)return {error:"API key downloader YouTube belum dipasang di Cloudflare Worker.",status:503};
  try{
    const response=await fetch(SAVENOW_BASE+path,{
      headers:savenowHeaders(),
      redirect,
      signal:AbortSignal.timeout(25000)
    });
    const raw=await response.text();let data;
    try{data=JSON.parse(raw)}catch{return {error:"Respons layanan downloader tidak valid (HTTP "+response.status+").",status:502};}
    if(!response.ok)return {
      error:data.error||data.message||data.text||("Layanan downloader menjawab HTTP "+response.status+"."),
      status:response.status===401||response.status===403?response.status:502
    };
    return {data};
  }catch(e){return {error:e.message||"Gagal menghubungi layanan downloader.",status:502};}
}
function youtubeInfoUrl(raw){return isYouTubeUrl(raw)?raw:null;}
async function youtubeInfo(request,env){
  const url=new URL(request.url).searchParams.get("url")||"";
  if(!youtubeInfoUrl(url))return json({error:"URL YouTube tidak valid."},400);
  if(!env.SAVENOW_API_KEY)return json({error:"API key downloader YouTube belum dipasang di Cloudflare Worker."},503);
  const params=new URLSearchParams({function:"i",api:env.SAVENOW_API_KEY,u:url});
  const response=await savenowRequest("/ajax/api.php?"+params.toString(),env);
  const data=response.data||{};
  const providerError=response.error||data.error||(data.success===false?(data.message||data.text||"Video tidak dapat diperiksa."):"");
  if(providerError){
    if(/not enough balance|insufficient balance|low balance/i.test(providerError)){
      try{
        const oembedUrl=new URL("https://www.youtube.com/oembed");
        oembedUrl.searchParams.set("url",url);
        oembedUrl.searchParams.set("format","json");
        const oembed=await fetch(oembedUrl.toString(),{headers:{accept:"application/json"},signal:AbortSignal.timeout(10000)});
        if(oembed.ok){
          const preview=await oembed.json();
          if(preview.title)return json({
            ok:true,providerReady:false,
            providerMessage:"Saldo API SaveNow tidak mencukupi. Informasi video berhasil ditemukan, tetapi unduhan baru bisa dimulai setelah saldo provider diisi.",
            title:String(preview.title).slice(0,300),
            thumbnail:typeof preview.thumbnail_url==="string"?preview.thumbnail_url:null,
            duration:null,source:"YouTube"
          });
        }
      }catch{}
    }
    return json({error:providerError},response.status||502);
  }
  if(!data.title&&!data.thumbnail&&!data.duration)return json({error:data.message||data.text||"Informasi video tidak tersedia dari penyedia."},502);
  return json({
    ok:true,providerReady:true,
    title:String(data.title||"YouTube Content").slice(0,300),
    thumbnail:typeof data.thumbnail==="string"?data.thumbnail:null,
    duration:data.duration??null,
    source:"YouTube"
  });
}
function safeFilename(value,format){
  const fallback="aryanzz-youtube."+(YOUTUBE_AUDIO_FORMATS.has(format)?format:"mp4");
  const name=String(value||fallback).replace(/[\\/:"*?<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().slice(0,150);
  return name||fallback;
}
function providerFileUrl(raw){
  let u;try{u=new URL(raw)}catch{throw new Error("URL file dari penyedia tidak valid.");}
  if(u.protocol!=="https:"||u.username||u.password)throw new Error("URL file dari penyedia tidak aman.");
  const h=u.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  if(h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h.endsWith(".internal")||
    h==="::1"||h==="::"||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||
    /^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||
    /^fc[0-9a-f]{2}:/i.test(h)||/^fd[0-9a-f]{2}:/i.test(h)||/^fe80:/i.test(h))
    throw new Error("Alamat file lokal tidak diizinkan.");
  return u;
}
async function fetchProviderFile(raw){
  let current=providerFileUrl(raw);
  for(let hop=0;hop<5;hop++){
    const response=await fetch(current.toString(),{
      method:"GET",redirect:"manual",
      headers:{referer:SAVENOW_BASE+"/","user-agent":"ARYANZZ/28.0 media download"},
      signal:AbortSignal.timeout(60000)
    });
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get("location");
      if(!location)throw new Error("Server file mengirim redirect tanpa tujuan.");
      if(response.body)response.body.cancel().catch(()=>{});
      current=providerFileUrl(new URL(location,current).toString());
      continue;
    }
    return {response,url:current};
  }
  throw new Error("Terlalu banyak pengalihan saat mengambil file.");
}
async function youtubeStart(request,env){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const url=String(body?.url||"").trim();
  if(!isYouTubeUrl(url))return json({error:"URL YouTube tidak valid."},400);
  let format;try{format=normalizeYoutubeFormat(body?.format)}catch(e){return json({error:e.message},400)}
  if(!env.SAVENOW_API_KEY)return json({error:"API key downloader YouTube belum dipasang di Cloudflare Worker."},503);
  const values={
    format:format.apiFormat,url,apikey:env.SAVENOW_API_KEY,
    add_info:"1",allow_extended_duration:"0",no_merge:"0"
  };
  if(format.apiFormat==="mp3")values.audio_quality="320";
  const params=new URLSearchParams(values);
  const response=await savenowRequest("/ajax/download.php?"+params.toString(),env);
  if(response.error)return json({error:response.error},response.status);
  const data=response.data;
  if(!(data.success===1||data.success===true))
    return json({error:data.error||data.message||data.text||"Penyedia tidak menerima permintaan unduhan."},502);
  const id=String(data.id||"").trim();
  const directUrl=data.download_url||data.url||"";
  const info={
    title:String(data.info?.title||data.title||"YouTube Content").slice(0,300),
    thumbnail:data.info?.image||data.thumbnail||null
  };
  if(!id&&directUrl){
    let fileUrl;try{fileUrl=providerFileUrl(directUrl)}catch(e){return json({error:e.message},502)}
    return json({status:true,pending:false,result:{title:info.title,thumbnail:info.thumbnail,format:format.requested,url:fileUrl.toString(),filename:data.filename||null}});
  }
  if(!id)return json({error:"Penyedia menerima respons tanpa ID pekerjaan."},502);
  return json({status:true,pending:true,id,format:format.requested,info,progress:Number(data.progress)||0});
}
async function youtubeProgress(request,env){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const id=String(body?.id||"").trim();
  let format;try{format=normalizeYoutubeFormat(body?.format)}catch(e){return json({error:e.message},400)}
  if(!/^[a-zA-Z0-9_-]{1,300}$/.test(id))return json({error:"ID proses tidak valid."},400);
  const params=new URLSearchParams({id});
  const response=await savenowRequest("/ajax/progress.php?"+params.toString(),env,{requireKey:false,redirect:"manual"});
  if(response.error)return json({error:response.error},response.status);
  const data=response.data,progress=Number(data.progress);
  if(!Number.isFinite(progress))return json({error:data.text||data.message||"Respons progres tidak memiliki nilai progress yang valid."},502);
  if(progress<1000)return json({
    status:true,pending:true,id,format:format.requested,progress,
    text:String(data.text||data.message||"Sedang memproses video.").slice(0,300)
  });
  const downloadUrl=typeof data.download_url==="string"?data.download_url.trim():"";
  if(!(data.success===1||data.success===true)||!downloadUrl)
    return json({error:data.text||data.message||"Proses berakhir tanpa file unduhan yang valid.",progress:1000},502);
  try{providerFileUrl(downloadUrl)}catch(e){return json({error:e.message},502)}
  return json({
    status:true,pending:false,id,format:format.requested,
    result:{
      title:String(body.info?.title||"YouTube Content").slice(0,300),
      thumbnail:typeof body.info?.thumbnail==="string"?body.info.thumbnail:null,
      format:format.requested,
      filename:safeFilename(data.filename,format.requested)
    }
  });
}
async function youtubeFile(request,env){
  const u=new URL(request.url),id=String(u.searchParams.get("id")||"").trim();
  let format;try{format=normalizeYoutubeFormat(u.searchParams.get("format")||"mp3")}catch(e){return json({error:e.message},400)}
  if(!/^[a-zA-Z0-9_-]{1,300}$/.test(id))return json({error:"ID pekerjaan tidak valid."},400);
  const progress=await savenowRequest("/ajax/progress.php?"+new URLSearchParams({id}).toString(),env,{requireKey:false,redirect:"manual"});
  if(progress.error)return json({error:progress.error},progress.status);
  const data=progress.data,pct=Number(data.progress);
  if(!Number.isFinite(pct)||pct<1000)return json({error:"File belum siap. Periksa progres kembali.",progress:Number.isFinite(pct)?pct:0},409);
  const raw=typeof data.download_url==="string"?data.download_url.trim():"";
  if(!(data.success===1||data.success===true)||!raw)return json({error:data.text||data.message||"Penyedia belum menyediakan file unduhan."},502);
  let upstream,url;
  try{({response:upstream,url}=await fetchProviderFile(raw));}
  catch(e){return json({error:e.message||"Gagal mengambil file dari penyedia."},502)}
  if(!upstream.ok||!upstream.body)return json({error:"Server file menjawab HTTP "+upstream.status+"."},502);
  const length=Number(upstream.headers.get("content-length")||0);
  if(length>MAX_YOUTUBE_BYTES){await upstream.body.cancel();return json({error:"File melebihi batas 500 MB untuk unduhan browser."},413);}
  const fallbackExt=format.audio?(format.requested==="mp3"?"mp3":format.requested):"mp4";
  const filename=safeFilename(data.filename||("aryanzz-youtube."+fallbackExt),format.requested);
  const headers=new Headers({
    "content-type":upstream.headers.get("content-type")||(format.audio?"application/octet-stream":"video/mp4"),
    "content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(filename),
    "cache-control":"no-store",
    "x-content-type-options":"nosniff"
  });
  if(length)headers.set("content-length",String(length));
  let received=0;
  const limited=upstream.body.pipeThrough(new TransformStream({
    transform(chunk,controller){
      received+=chunk.byteLength;
      if(received>MAX_YOUTUBE_BYTES){controller.error(new Error("File melebihi batas 500 MB."));return;}
      controller.enqueue(chunk);
    }
  }));
  return new Response(limited,{status:200,headers});
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS"&&url.pathname.startsWith("/api/"))return new Response(null,{status:204,headers:{"access-control-allow-origin":url.origin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type"}});
  if(url.pathname==="/api/youtube/status"&&request.method==="GET")return json({ok:true,service:"ARYANZZ YouTube Backend",youtubeDownloader:true,youtubeApiKeyConfigured:!!env.SAVENOW_API_KEY,supportedAudio:[...YOUTUBE_AUDIO_FORMATS],supportedVideo:["360","720","1080","1440","4k"]});
  if(url.pathname==="/api/youtube/info"&&request.method==="GET")return youtubeInfo(request,env);
  if(url.pathname==="/api/youtube/download"&&request.method==="POST")return youtubeStart(request,env);
  if(url.pathname==="/api/youtube/progress"&&request.method==="POST")return youtubeProgress(request,env);
  if(url.pathname==="/api/youtube/file"&&request.method==="GET")return youtubeFile(request,env);
  if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"ARYANZZ",version:"29.0",mode:"cloudflare-worker",directMediaDownload:true,youtubeDownloader:true,youtubeApiKeyConfigured:!!env.SAVENOW_API_KEY,platformExtraction:!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN),platformBackend:env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN?"configured":"not-configured"});
  if(url.pathname==="/api/info"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/info");if(proxied)return proxied;return info(request);}
  if(url.pathname==="/api/download"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/download");if(proxied)return proxied;return download(request);}
  if(url.pathname.startsWith("/api/"))return json({error:"Endpoint tidak ditemukan."},404);
  return env.ASSETS.fetch(request);
}};
