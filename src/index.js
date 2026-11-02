const MEDIA_EXT = new Set(["mp4","webm","mov","m4v","mkv","avi","mpeg","mpg","m2ts","mts","ts","3gp","ogv","asf","wmv","mp3","m4a","aac","wav","ogg","oga","flac","opus","wma","aiff","aif","mka"]);
const MAX_BYTES = 100 * 1024 * 1024;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}

function auddFailure(data,mode="standard"){
  const err=data?.error;
  const codeValue=err&&typeof err==="object"?(err.error_code??err.code):(data?.error_code??data?.code);
  const code=Number.isFinite(Number(codeValue))?Number(codeValue):null;
  const raw=String((err&&typeof err==="object"?(err.error_message||err.message):(typeof err==="string"?err:""))||data?.message||"").trim();
  let message=raw||"AudD tidak dapat memproses permintaan.";
  if(code===901){
    message="AudD menolak permintaan (kode 901): API token tidak diterima atau batas gratis tanpa token sudah tercapai. Worker ARYANZZ memang memiliki Secret, tetapi AudD belum mengenali nilai token yang dikirim. Pastikan nilainya adalah API token dari dashboard.audd.io, bukan token Cloudflare/GitHub. Jangan mengulang permintaan sebelum token diperiksa.";
  }else if(code===902){
    message="Kuota akun AudD sudah habis (kode 902). Ini batas pemakaian akun AudD, bukan batas ARYANZZ. Periksa Usage/Billing di dashboard AudD atau tunggu periode kuota berikutnya.";
  }else if(code===900){
    message="API token AudD tidak valid (kode 900). Periksa token yang tersimpan pada Secret AUDD_API_TOKEN di Worker.";
  }else if(code===903){
    message="API token AudD dinonaktifkan (kode 903). Buat atau aktifkan token yang valid dari dashboard AudD.";
  }else if(code===904||code===905){
    message=mode==="enterprise"
      ?"Akun/token AudD belum diizinkan memakai endpoint Enterprise (kode "+code+"). Periksa paket dan akses Enterprise pada dashboard AudD."
      :"Akun/token AudD tidak diizinkan memakai metode ini (kode "+code+"). Periksa akses API pada dashboard AudD.";
  }else if(/authorization failed|limit was reached|quota exceeded/i.test(raw)){
    message="AudD mengembalikan kesalahan otorisasi atau batas penggunaan. Secret sudah terpasang di Worker, tetapi respons ini belum memastikan apakah token tidak diterima atau kuota akun habis. Periksa API token dan Usage/Billing pada dashboard AudD sebelum mencoba lagi.";
  }
  return {error:message,provider:"AudD",providerErrorCode:code,retryable:false};
}

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
const PLATFORM_HOSTS=["youtube.com","youtu.be","youtube-nocookie.com","tiktok.com","instagram.com","threads.net","facebook.com","fb.watch","pinterest.com","pin.it","x.com","twitter.com","reddit.com","redd.it","vimeo.com","dailymotion.com","dai.ly","soundcloud.com","twitch.tv","streamable.com","tumblr.com","bilibili.com","b23.tv","vk.com","ok.ru","rutube.ru","likee.video","snapchat.com","imgur.com","bandcamp.com","mixcloud.com","ted.com","archive.org","loom.com","rumble.com","odysee.com","weibo.com","xiaohongshu.com"];
function isPlatformLink(raw){
  try{const u=new URL(raw);const h=u.hostname.toLowerCase();return ["http:","https:"].includes(u.protocol)&&PLATFORM_HOSTS.some(d=>h===d||h.endsWith("."+d));}catch{return false;}
}
async function proxyPlatform(request,env,path){
  let body;try{body=await request.clone().json()}catch{return json({error:"Body JSON tidak valid."},400)}
  if(!isPlatformLink(body?.url))return null;
  // A social-domain URL may still be a direct media file (for example a CDN MP4).
  // Let the direct-file pipeline handle it before requiring a platform extractor.
  try{parseMediaUrl(body.url);return null}catch{}
  if(!env.PLATFORM_API_ORIGIN)return json({error:"Link postingan platform ini memerlukan extractor yang diizinkan. Untuk unduhan langsung, gunakan URL file media MP4/MP3 asli."},503);
  if(!env.PLATFORM_API_TOKEN)return json({error:"Token backend belum dikonfigurasi pada Cloudflare Worker."},503);
  let origin;try{const parsed=new URL(env.PLATFORM_API_ORIGIN);if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new Error("origin tidak aman");origin=parsed.origin}catch{return json({error:"Konfigurasi backend harus berupa URL HTTPS yang valid."},500)}
  try{
    const response=await fetch(origin+path,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
    return new Response(response.body,{status:response.status,headers:{"content-type":response.headers.get("content-type")||"application/json","content-disposition":response.headers.get("content-disposition")||"","cache-control":"no-store"}});
  }catch{return json({error:"Backend ekstraksi sedang tidak dapat dijangkau."},502)}
}
async function platformStatus(env){return json({ok:true,configured:false,backend:"community-handoff",mode:"zero-server",engine:"browser direct download + community provider handoff",platforms:PLATFORM_HOSTS,message:"ARYANZZ tidak menjalankan server ekstraksi sendiri. Tautan file langsung dapat diunduh; tautan media sosial diarahkan ke provider komunitas."});}
async function info(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  let parsed;try{parsed=parseMediaUrl(body?.url)}catch(e){return json({error:e.message},400)}
  try{
    const {response,parsed:final}=await getUpstream(parsed,"HEAD");
    if(!response.ok)return json({error:"Server sumber menjawab HTTP "+response.status+"."},502);
    const size=Number(response.headers.get("content-length")||0);
    if(size>MAX_BYTES)return json({error:"File melebihi batas 100 MB."},413);
    return json({ok:true,title:fileName(final.url,final.ext),filename:fileName(final.url,final.ext),extension:final.ext,type:["mp3","m4a","aac","wav","ogg","oga","flac","opus","wma","aiff","aif"].includes(final.ext)?"audio":"video",size:size||null,mime:response.headers.get("content-type")||null,source:final.url.hostname});
  }catch(e){return json({error:e.message||"Gagal memeriksa file."},502)}
}
async function download(request){
  let body;
  if(request.method==="GET")body={url:new URL(request.url).searchParams.get("url")||""};
  else{try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}}
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

const PIPED_INSTANCES=[
  {id:"kavin",api:"https://pipedapi.kavin.rocks",domain:"kavin.rocks"},
  {id:"adminforge",api:"https://pipedapi.adminforge.de",domain:"adminforge.de"},
];
const INVIDIOUS_INSTANCES=[
  {id:"tiekoetter",api:"https://invidious.tiekoetter.com",domain:"tiekoetter.com"},
  {id:"nerdvpn",api:"https://invidious.nerdvpn.de",domain:"nerdvpn.de"},
];
const MAX_YOUTUBE_BYTES=500*1024*1024;
const AUDD_MAX_BYTES=10*1024*1024;
const MUSIC_RATE_BUCKETS=new Map();
function isYouTubeUrl(raw){
  try{const u=new URL(raw),h=u.hostname.toLowerCase();return ["http:","https:"].includes(u.protocol)&&["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtu.be","www.youtu.be","youtube-nocookie.com","www.youtube-nocookie.com"].includes(h);}catch{return false;}
}
function extractYoutubeId(raw){
  const u=new URL(raw),host=u.hostname.toLowerCase();let id="";
  if(host==="youtu.be"||host==="www.youtu.be")id=u.pathname.split("/").filter(Boolean)[0]||"";
  else if(u.searchParams.has("v"))id=u.searchParams.get("v")||"";
  else{const parts=u.pathname.split("/").filter(Boolean);if(["shorts","embed","live","v"].includes(parts[0]))id=parts[1]||"";}
  return /^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
}
function safeYoutubeName(title,ext){
  const base=String(title||"aryanzz-youtube").replace(/[\\/:\"*?<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().slice(0,120)||"aryanzz-youtube";
  return base.toLowerCase().endsWith("."+ext.toLowerCase())?base:base+"."+ext;
}
function youtubeDownloadUrl(provider,instance,raw,filename,mime){
  const u=new URL("/api/youtube/stream","https://aryanzz.invalid");
  u.searchParams.set("provider",provider);u.searchParams.set("instance",instance);u.searchParams.set("url",raw);u.searchParams.set("filename",filename);u.searchParams.set("mime",mime);
  return u.pathname+u.search;
}
function pipedFormatList(data,instance){
  const formats=(Array.isArray(data.videoStreams)?data.videoStreams:[]).filter(x=>x&&x.videoOnly===false&&String(x.mimeType||"").toLowerCase().startsWith("video/mp4")&&typeof x.url==="string").map(x=>{
    const height=Number(x.height)||Number(String(x.quality||"").match(/\d+/)?.[0])||0;
    if(![144,240,360,480,720,1080,1440,2160].includes(height))return null;
    return {height,quality:String(x.quality||height+"p"),mimeType:"video/mp4",format:"mp4",downloadUrl:youtubeDownloadUrl("piped",instance.id,x.url,safeYoutubeName(data.title||"youtube-"+height,"mp4"),"video/mp4")};
  }).filter(Boolean);
  const audioFormats=(Array.isArray(data.audioStreams)?data.audioStreams:[]).filter(x=>x&&typeof x.url==="string").map(x=>{
    const mime=String(x.mimeType||"").toLowerCase(),format=String(x.format||"").toLowerCase();
    const ext=mime.includes("audio/mp4")||format==="m4a"?"m4a":mime.includes("audio/webm")||format==="webm"?"webm":mime.includes("audio/ogg")||format==="ogg"?"ogg":null;
    if(!ext)return null;
    return {format:ext,label:ext.toUpperCase()+" · "+String(x.quality||"audio"),mimeType:mime||"application/octet-stream",downloadUrl:youtubeDownloadUrl("piped",instance.id,x.url,safeYoutubeName(data.title||"youtube-audio",ext),mime||"application/octet-stream")};
  }).filter(Boolean);
  return {formats,audioFormats};
}
function invidiousFormatList(data,instance){
  const formats=(Array.isArray(data.formatStreams)?data.formatStreams:[]).filter(x=>x&&typeof x.url==="string"&&String(x.container||"").toLowerCase()==="mp4").map(x=>{
    const height=Number(String(x.qualityLabel||x.resolution||"").match(/(\d{3,4})p?/)?.[1])||0;
    if(![144,240,360,480,720,1080,1440,2160].includes(height))return null;
    return {height,quality:String(x.qualityLabel||height+"p"),mimeType:"video/mp4",format:"mp4",downloadUrl:youtubeDownloadUrl("invidious",instance.id,x.url,safeYoutubeName(data.title||"youtube-"+height,"mp4"),"video/mp4")};
  }).filter(Boolean);
  const audioFormats=(Array.isArray(data.adaptiveFormats)?data.adaptiveFormats:[]).filter(x=>x&&typeof x.url==="string"&&String(x.type||"").toLowerCase().startsWith("audio/")).map(x=>{
    const mime=String(x.type||"").toLowerCase(),ext=mime.includes("audio/mp4")?"m4a":mime.includes("audio/webm")?"webm":null;
    if(!ext)return null;
    return {format:ext,label:ext.toUpperCase()+" · "+String(x.audioQuality||"audio"),mimeType:mime,downloadUrl:youtubeDownloadUrl("invidious",instance.id,x.url,safeYoutubeName(data.title||"youtube-audio",ext),mime)};
  }).filter(Boolean);
  return {formats,audioFormats};
}
async function fetchCommunityJson(url){
  const response=await fetch(url,{headers:{accept:"application/json","user-agent":"ARYANZZ/71.0 (public API client)"},redirect:"error",signal:AbortSignal.timeout(4500)});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const data=await response.json();if(!data||typeof data!=="object")throw new Error("JSON tidak valid");return data;
}
async function tryPiped(videoId,instance){
  const data=await fetchCommunityJson(instance.api+"/streams/"+encodeURIComponent(videoId));
  if(!data.title||!Array.isArray(data.videoStreams)&&!Array.isArray(data.audioStreams))throw new Error("Format stream tidak tersedia");
  const normalized=pipedFormatList(data,instance);
  if(!normalized.formats.length&&!normalized.audioFormats.length)throw new Error("Instance tidak menyediakan stream unduhan langsung");
  return {ok:true,providerReady:true,providerName:"Piped",providerInstance:instance.id,title:String(data.title).slice(0,300),thumbnail:typeof data.thumbnailUrl==="string"?data.thumbnailUrl:null,author:String(data.uploader||"").slice(0,180),duration:Number(data.duration)||null,formats:normalized.formats,audioFormats:normalized.audioFormats,source:"Piped community API",providerMessage:"Stream langsung tersedia dari instance komunitas Piped. Kualitas mengikuti stream yang tersedia."};
}
async function tryInvidious(videoId,instance){
  const data=await fetchCommunityJson(instance.api+"/api/v1/videos/"+encodeURIComponent(videoId)+"?region=ID");
  if(!data.title||!data.videoId)throw new Error("Metadata video tidak valid");
  const normalized=invidiousFormatList(data,instance);
  if(!normalized.formats.length&&!normalized.audioFormats.length)throw new Error("Instance tidak menyediakan stream progresif yang dapat diunduh");
  const thumbnail=Array.isArray(data.videoThumbnails)?data.videoThumbnails.find(x=>x.quality==="maxres")?.url||data.videoThumbnails[0]?.url:null;
  return {ok:true,providerReady:true,providerName:"Invidious",providerInstance:instance.id,title:String(data.title).slice(0,300),thumbnail:typeof thumbnail==="string"?thumbnail:null,author:String(data.author||"").slice(0,180),duration:Number(data.lengthSeconds)||null,formats:normalized.formats,audioFormats:normalized.audioFormats,source:"Invidious community API",providerMessage:"Stream langsung tersedia dari instance komunitas Invidious. Video hanya memakai stream MP4 gabungan yang bisa diunduh tanpa proses merge."};
}
async function youtubeInfo(request){
  const raw=new URL(request.url).searchParams.get("url")||"";
  if(!isYouTubeUrl(raw))return json({error:"URL YouTube tidak valid."},400);
  const videoId=extractYoutubeId(raw);if(!videoId)return json({error:"ID video YouTube tidak dapat dibaca."},400);
  const failures=[];
  for(const instance of PIPED_INSTANCES){try{return json(await tryPiped(videoId,instance));}catch(e){failures.push("Piped "+instance.id+": "+String(e.message||e).slice(0,100));}}
  for(const instance of INVIDIOUS_INSTANCES){try{return json(await tryInvidious(videoId,instance));}catch(e){failures.push("Invidious "+instance.id+": "+String(e.message||e).slice(0,100));}}
  let preview={};
  try{const u=new URL("https://www.youtube.com/oembed");u.searchParams.set("url",raw);u.searchParams.set("format","json");const r=await fetch(u.toString(),{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});if(r.ok)preview=await r.json();}catch{}
  return json({ok:true,providerReady:false,providerName:null,title:String(preview.title||"Video YouTube").slice(0,300),thumbnail:typeof preview.thumbnail_url==="string"?preview.thumbnail_url:null,author:String(preview.author_name||"").slice(0,180),duration:null,formats:[],audioFormats:[],source:"YouTube preview",providerMessage:"Informasi video dapat ditampilkan, tetapi semua instance komunitas sedang tidak tersedia atau tidak menyediakan stream yang dapat diunduh. Tidak ada provider berbayar yang dipanggil.",providerFailures:failures.slice(0,7)},200);
}
function streamHostAllowed(provider,instanceId,raw){
  let u;try{u=new URL(raw)}catch{return false;}
  if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443"||u.pathname.toLowerCase().includes("/../"))return false;
  const instances=provider==="piped"?PIPED_INSTANCES:provider==="invidious"?INVIDIOUS_INSTANCES:null;
  const instance=instances?.find(x=>x.id===instanceId);if(!instance)return false;
  const host=u.hostname.toLowerCase();
  if(provider==="piped")return (host===instance.domain||host.endsWith("."+instance.domain))&&/\/videoplayback(?:\/|$)/i.test(u.pathname);
  return (host===instance.domain||host.endsWith("."+instance.domain)||host==="googlevideo.com"||host.endsWith(".googlevideo.com"))&&/\/videoplayback(?:\/|$)/i.test(u.pathname);
}
async function youtubeStream(request){
  if(request.method!=="GET"&&request.method!=="HEAD")return json({error:"Metode unduhan tidak didukung."},405);
  const u=new URL(request.url),provider=u.searchParams.get("provider")||"",instance=u.searchParams.get("instance")||"",raw=u.searchParams.get("url")||"";
  if(!streamHostAllowed(provider,instance,raw))return json({error:"URL stream tidak cocok dengan instance komunitas yang diizinkan."},400);
  let current=new URL(raw),upstream;
  const headers=new Headers({accept:"*/*","user-agent":"ARYANZZ/71.0"});
  const range=request.headers.get("range"),ifRange=request.headers.get("if-range");if(range)headers.set("range",range);if(ifRange)headers.set("if-range",ifRange);
  for(let hop=0;hop<4;hop++){
    if(!streamHostAllowed(provider,instance,current.toString()))return json({error:"Pengalihan stream menuju domain yang tidak diizinkan."},502);
    try{upstream=await fetch(current.toString(),{method:request.method,headers,redirect:"manual",signal:AbortSignal.timeout(60000)});}
    catch(e){return json({error:"Gagal mengambil stream: "+String(e.message||e).slice(0,180)},502);}
    if([301,302,303,307,308].includes(upstream.status)){
      const location=upstream.headers.get("location");if(upstream.body)upstream.body.cancel().catch(()=>{});
      if(!location)return json({error:"Stream mengirim redirect tanpa tujuan."},502);current=new URL(location,current);continue;
    }
    break;
  }
  if(!upstream)return json({error:"Stream tidak tersedia."},502);
  if([301,302,303,307,308].includes(upstream.status))return json({error:"Terlalu banyak pengalihan stream."},502);
  if(!upstream.ok&&upstream.status!==206)return json({error:"Penyedia stream menjawab HTTP "+upstream.status+"."},upstream.status===416?416:502);
  const mime=String(u.searchParams.get("mime")||upstream.headers.get("content-type")||"application/octet-stream").split(";")[0].toLowerCase();
  if(!["video/mp4","audio/mp4","audio/webm","audio/ogg"].includes(mime)) {if(upstream.body)upstream.body.cancel().catch(()=>{});return json({error:"Tipe file stream tidak didukung."},415);}
  const ext=mime==="video/mp4"?"mp4":mime==="audio/mp4"?"m4a":mime==="audio/webm"?"webm":"ogg";
  const filename=safeYoutubeName(u.searchParams.get("filename")||"aryanzz-youtube",ext);
  const responseHeaders=new Headers({"content-type":mime,"content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(filename),"cache-control":"no-store","x-content-type-options":"nosniff","accept-ranges":upstream.headers.get("accept-ranges")||"bytes"});
  for(const name of ["content-length","content-range","etag","last-modified"])if(upstream.headers.get(name))responseHeaders.set(name,upstream.headers.get(name));
  if(request.method==="HEAD")return new Response(null,{status:upstream.status,headers:responseHeaders});
  if(!upstream.body)return json({error:"Stream tidak mengirim isi file."},502);
  const length=Number(upstream.headers.get("content-length")||0);if(length>MAX_YOUTUBE_BYTES){await upstream.body.cancel();return json({error:"File melebihi batas 500 MB."},413);}
  let received=0;
  const body=upstream.body.pipeThrough(new TransformStream({transform(chunk,controller){received+=chunk.byteLength;if(received>MAX_YOUTUBE_BYTES){controller.error(new Error("File melebihi batas 500 MB."));return;}controller.enqueue(chunk);}}));
  return new Response(body,{status:upstream.status,headers:responseHeaders});
}
function musicStatus(env){
  const externalExtractorReady=!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN);
  const shazamReady=externalExtractorReady;
  const auddReady=!!env.AUDD_API_TOKEN;
  const provider=auddReady?(shazamReady?"AudD + Shazam fallback":"AudD"):shazamReady?"Shazam":"Unavailable";
  return json({ok:true,provider,configured:auddReady||shazamReady,
    auddConfigured:auddReady,shazamFallbackConfigured:shazamReady,shazamFallbackReady:shazamReady,
    videoUrlReady:auddReady||shazamReady||externalExtractorReady,
    videoScanProvider:auddReady?(shazamReady?"AudD Enterprise + Shazam fallback":"AudD Enterprise"):shazamReady?"Shazam multi-segment fallback":"Unavailable",
    extractorRequiredForMusicScan:false,sampleSeconds:12,maxUploadBytes:AUDD_MAX_BYTES,
    maxEnterpriseUploadBytes:50*1024*1024,shazamMaxScanChunks:30,auddMaxScanChunks:100,
    note:"Status konfigurasi menunjukkan server backend tersedia; status ini tidak menguji kuota AudD atau menjalankan pengenalan lagu."});
}
async function searchYouTube(request,env){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const query=String(body?.query||"").replace(/\s+/g," ").trim();
  if(query.length<2)return json({error:"Masukkan minimal 2 karakter untuk mencari judul video."},400);
  if(query.length>160)return json({error:"Judul pencarian maksimal 160 karakter."},400);
  if(!env.PLATFORM_API_ORIGIN||!env.PLATFORM_API_TOKEN)
    return json({error:"Pencarian judul membutuhkan backend yt-dlp aktif. Hubungkan backend HTTPS melalui PLATFORM_API_ORIGIN dan PLATFORM_API_TOKEN."},503);
  let origin;
  try{
    const parsed=new URL(env.PLATFORM_API_ORIGIN);
    if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new Error("origin tidak aman");
    origin=parsed.origin;
  }catch{return json({error:"Konfigurasi backend pencarian harus berupa URL HTTPS yang valid."},500)}
  try{
    const response=await fetch(origin+"/api/search",{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},
      body:JSON.stringify({query}),
      signal:AbortSignal.timeout(90000),
      cache:"no-store"
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return json({error:data.error||"Backend pencarian menjawab HTTP "+response.status+"."},response.status);
    const results=Array.isArray(data.results)?data.results.filter(item=>item&&typeof item.title==="string"&&isYouTubeUrl(item.url)).slice(0,8):[];
    return json({ok:true,query,results});
  }catch{return json({error:"Backend pencarian judul tidak dapat dijangkau. Periksa layanan yt-dlp dan coba lagi."},502)}
}
function musicRateLimited(request){
  const ip=request.headers.get("cf-connecting-ip")||"unknown",now=Date.now();
  let bucket=MUSIC_RATE_BUCKETS.get(ip);
  if(!bucket||now-bucket.started>=60000)bucket={started:now,count:0};
  bucket.count++;MUSIC_RATE_BUCKETS.set(ip,bucket);
  if(MUSIC_RATE_BUCKETS.size>1000){
    for(const [key,value] of MUSIC_RATE_BUCKETS)if(now-value.started>=60000)MUSIC_RATE_BUCKETS.delete(key);
  }
  return bucket.count>8;
}
async function platformMusicSample(url,startSeconds,env){
  if(!isPlatformLink(url))throw new Error("Tautan video belum didukung. Gunakan tautan publik dari platform yang tersedia di ARYANZZ.");
  let response;
  if(!env.PLATFORM_API_ORIGIN||!env.PLATFORM_API_TOKEN)
    throw new Error("Server ekstraksi ARYANZZ belum aktif. Upload video dari perangkat atau gunakan tautan setelah backend aktif.");
  let origin;
  try{const parsed=new URL(env.PLATFORM_API_ORIGIN);if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new Error("origin tidak aman");origin=parsed.origin;}
  catch{throw new Error("Konfigurasi URL backend harus berupa HTTPS yang valid.");}
  response=await fetch(origin+"/api/music/sample",{
    method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},
    body:JSON.stringify({url,startSeconds,durationSeconds:12}),
    signal:AbortSignal.timeout(180000),cache:"no-store"
  });
  if(!response.ok){
    const error=await response.json().catch(()=>({}));
    throw new Error(error.error||"Gagal mengambil cuplikan audio dari video.");
  }
  const length=Number(response.headers.get("content-length")||0);
  if(length>AUDD_MAX_BYTES){if(response.body)response.body.cancel().catch(()=>{});throw new Error("Cuplikan audio melebihi batas 10 MB.");}
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength)throw new Error("Cuplikan audio dari video kosong.");
  if(bytes.byteLength>AUDD_MAX_BYTES)throw new Error("Cuplikan audio melebihi batas 10 MB.");
  return new Blob([bytes],{type:"audio/mpeg"});
}
async function shazamRecognize(audioBlob,env){
  if(!env.PLATFORM_API_ORIGIN||!env.PLATFORM_API_TOKEN)return null;
  const backendUrl=new URL(env.PLATFORM_API_ORIGIN);if(backendUrl.protocol!=="https:"||backendUrl.username||backendUrl.password)throw new Error("URL backend harus HTTPS.");const origin=backendUrl.origin;
  const bytes=await audioBlob.arrayBuffer();
  const response=await fetch(origin+"/api/music/recognize",{
    method:"POST",headers:{"content-type":"application/octet-stream","authorization":"Bearer "+env.PLATFORM_API_TOKEN},body:bytes,
    signal:AbortSignal.timeout(60000),cache:"no-store"
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||"Shazam fallback belum dapat mengenali audio.");
  return json({...data,provider:"Shazam"});
}
async function shazamScan(source,skip,every,limit,env,reason){
  if(!env.PLATFORM_API_ORIGIN||!env.PLATFORM_API_TOKEN)
    return json({error:"AudD Enterprise tidak tersedia dan server Shazam cadangan belum terhubung."},503);
  let origin;try{const backendUrl=new URL(env.PLATFORM_API_ORIGIN);if(backendUrl.protocol!=="https:"||backendUrl.username||backendUrl.password)throw new Error("URL backend tidak aman");origin=backendUrl.origin;}catch{return json({error:"URL backend harus HTTPS dan valid."},500);}
  let response;
  try{
    if(source.url){
      response=await fetch(origin+"/api/music/scan",{
        method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},
        body:JSON.stringify({url:source.url,skip,every,limit}),signal:AbortSignal.timeout(300000),cache:"no-store"
      });
    }else{
      response=await fetch(origin+"/api/music/scan",{
        method:"POST",headers:{
          "content-type":"application/octet-stream","authorization":"Bearer "+env.PLATFORM_API_TOKEN,
          "x-media-filename":source.name||"aryanzz-dj-scan.mp4",
          "x-scan-skip":String(skip),"x-scan-every":String(every),"x-scan-limit":String(limit)
        },
        body:await source.file.arrayBuffer(),signal:AbortSignal.timeout(300000),cache:"no-store"
      });
    }
  }catch{return json({error:"Shazam fallback tidak dapat menjangkau server ekstraksi."},502);}
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)return json({error:data.error||"Shazam fallback gagal memindai video."},response.status||502);
  return json({...data,provider:"Shazam fallback",fallbackFrom:reason||"AudD Enterprise"});
}
async function recognizeMusic(request,env){
  if(musicRateLimited(request))return json({error:"Batas pencarian sementara tercapai. Coba lagi sekitar satu menit."},429);
  const contentLength=Number(request.headers.get("content-length")||0);
  if(contentLength>AUDD_MAX_BYTES+1024*1024)return json({error:"Upload terlalu besar. Maksimum cuplikan audio adalah 10 MB."},413);
  let audioBlob=null,audioName="aryanzz-audio-sample.webm";
  const contentType=(request.headers.get("content-type")||"").toLowerCase();
  if(contentType.includes("application/json")){
    let body;try{body=await request.json();}catch{return json({error:"Body JSON tidak valid."},400);}
    const url=String(body?.url||"").trim(),startSeconds=Number(body?.startSeconds??0);
    if(!url||!Number.isFinite(startSeconds)||startSeconds<0||startSeconds>10800)
      return json({error:"Tautan video atau posisi cuplikan tidak valid."},400);
    try{audioBlob=await platformMusicSample(url,startSeconds,env);audioName="aryanzz-video-sample.mp3";}
    catch(error){return json({error:error?.message||"Gagal mengambil audio dari video."},503);}
  }else{
    let incoming;try{incoming=await request.formData();}catch{return json({error:"Form upload tidak valid."},400);}
    const file=incoming.get("file");
    if(!file||typeof file.arrayBuffer!=="function")return json({error:"Pilih file audio atau kirim cuplikan audio hasil ekstraksi video."},400);
    const extension=String(file.name||"").split(".").pop().toLowerCase();
    const audioExtensions=new Set(["mp3","m4a","aac","wav","ogg","oga","flac","opus"]);
    if(!String(file.type||"").toLowerCase().startsWith("audio/")&&!audioExtensions.has(extension))
      return json({error:"File harus berupa audio. Untuk video, gunakan fitur ekstraksi dari browser."},415);
    if(!file.size)return json({error:"File audio kosong."},400);
    if(file.size>AUDD_MAX_BYTES)return json({error:"File audio melebihi batas 10 MB. Pilih bagian video/audio yang lebih pendek."},413);
    audioBlob=file;
    audioName=String(file.name||"aryanzz-audio-sample.webm").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,90);
  }
  if(!audioBlob||!audioBlob.size)return json({error:"Cuplikan audio tidak tersedia."},400);
  if(audioBlob.size>AUDD_MAX_BYTES)return json({error:"Cuplikan audio melebihi batas 10 MB."},413);
  if(!env.AUDD_API_TOKEN){
    if((env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN)){
      try{return await shazamRecognize(audioBlob,env);}
      catch(error){return json({error:"AudD belum dikonfigurasi. Shazam fallback gagal: "+String(error.message||error).slice(0,350)},502);}
    }
    return json({error:"AudD belum memiliki kuota/token aktif dan backend Shazam fallback belum terpasang."},503);
  }
  const form=new FormData();
  form.append("api_token",env.AUDD_API_TOKEN);
  form.append("file",audioBlob,audioName);
  form.append("return","apple_music,spotify");
  form.append("market","id");
  try{
    const response=await fetch("https://api.audd.io/",{method:"POST",body:form,signal:AbortSignal.timeout(30000),cache:"no-store"});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data||data.status!=="success"){
      const failure=auddFailure(data,"standard");
      if((env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN)&&[900,901,902,903,904,905].includes(failure.providerErrorCode)){
        try{return await shazamRecognize(audioBlob,env)||json(failure,502);}
        catch(error){return json({error:"AudD menolak permintaan (kode "+failure.providerErrorCode+"). Shazam fallback juga gagal: "+String(error.message||error).slice(0,300),providerErrorCode:failure.providerErrorCode,retryable:false},502);}
      }
      return json(failure,502);
    }
    const result=Array.isArray(data.result)?data.result[0]:data.result;
    if(!result)return json({ok:true,match:false,message:"Lagu belum ditemukan. Coba bagian video lain yang musiknya terdengar lebih jelas."});
    return json({ok:true,match:true,provider:"AudD",result:{
      title:String(result.title||"Unknown title").slice(0,300),
      artist:String(result.artist||"Unknown artist").slice(0,300),
      album:String(result.album||"").slice(0,300),
      release_date:String(result.release_date||"").slice(0,40),
      label:String(result.label||"").slice(0,200),
      timecode:String(result.timecode||"").slice(0,40),
      song_link:typeof result.song_link==="string"?result.song_link:null,
      apple_music:result.apple_music||null,spotify:result.spotify||null
    }});
  }catch(error){
    return json({error:error?.name==="TimeoutError"?"Pencarian lagu terlalu lama. Coba lagi.":"Tidak dapat menghubungi layanan pengenal lagu."},502);
  }
}


async function recognizeMusicVideo(request,env){
  const contentLength=Number(request.headers.get("content-length")||0);
  const maxBytes=50*1024*1024;
  if(contentLength>maxBytes+1024*1024)return json({error:"File video/audio melebihi batas 50 MB untuk pemindaian DJ."},413);
  const form=new FormData();
  if(env.AUDD_API_TOKEN){
    form.append("api_token",env.AUDD_API_TOKEN);
    form.append("accurate_offsets","true");
  }
  let skip=4,every=1,limit=60,fallbackSource=null;
  const contentType=(request.headers.get("content-type")||"").toLowerCase();
  if(contentType.includes("application/json")){
    let body;try{body=await request.json();}catch{return json({error:"Body JSON tidak valid."},400);}
    const url=String(body?.url||"").trim();
    if(!isPlatformLink(url))return json({error:"Tautan video tidak valid atau platform belum didukung."},400);
    skip=Number(body?.skip??4);every=Number(body?.every??1);limit=Number(body?.limit??60);
    fallbackSource={url};
    form.append("url",url);
  }else{
    let incoming;try{incoming=await request.formData();}catch{return json({error:"Form upload tidak valid."},400);}
    const file=incoming.get("file");
    if(!file||typeof file.arrayBuffer!=="function")return json({error:"Pilih file video/audio untuk dipindai."},400);
    const extension=String(file.name||"").split(".").pop().toLowerCase();
    const allowed=new Set(["mp4","mov","m4v","webm","mkv","avi","mp3","m4a","aac","wav","ogg","oga","flac","opus"]);
    if(!String(file.type||"").toLowerCase().startsWith("audio/")&&
       !String(file.type||"").toLowerCase().startsWith("video/")&&!allowed.has(extension))
      return json({error:"File harus berupa video atau audio yang didukung."},415);
    if(!file.size)return json({error:"File video/audio kosong."},400);
    if(file.size>maxBytes)return json({error:"File video/audio melebihi batas 50 MB."},413);
    skip=Number(incoming.get("skip")??4);every=Number(incoming.get("every")??1);limit=Number(incoming.get("limit")??60);
    const safeName=String(file.name||"aryanzz-dj-scan.mp4").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,90);
    fallbackSource={file,name:safeName};
    form.append("file",file,safeName);
  }
  if(!Number.isInteger(skip)||skip<0||skip>29)return json({error:"Interval pemindaian tidak valid."},400);
  if(!Number.isInteger(every)||every<1||every>3)return json({error:"Jumlah segmen berurutan tidak valid."},400);
  if(!Number.isInteger(limit)||limit<1||limit>100)return json({error:"Batas pemindaian harus 1 sampai 100 segmen."},400);
  form.append("skip",String(skip));
  form.append("every",String(every));
  form.append("limit",String(limit));
  if(musicRateLimited(request))return json({error:"Batas pemindaian sementara tercapai. Coba lagi sekitar satu menit."},429);
  if(!env.AUDD_API_TOKEN)return shazamScan(fallbackSource,skip,every,limit,env,"AudD Enterprise tidak dikonfigurasi");
  let response;
  try{
    response=await fetch("https://enterprise.audd.io/",{
      method:"POST",body:form,signal:AbortSignal.timeout(240000),cache:"no-store"
    });
  }catch(error){
    if((env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN))return shazamScan(fallbackSource,skip,every,limit,env,"AudD Enterprise tidak dapat dijangkau");
    return json({error:error?.name==="TimeoutError"?"Pemindaian video terlalu lama. Coba interval lebih hemat atau video lebih pendek.":"Tidak dapat menghubungi layanan pemindaian AudD."},502);
  }
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data||data.status!=="success"){
    const failure=auddFailure(data,"enterprise");
    if((env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN)&&[900,901,902,903,904,905].includes(failure.providerErrorCode))
      return shazamScan(fallbackSource,skip,every,limit,env,"AudD Enterprise kode "+failure.providerErrorCode);
    return json(failure,502);
  }
  const groups=Array.isArray(data.result)?data.result:[];
  const tracks=[];
  for(const group of groups){
    const offset=String(group?.offset||"");
    const songs=Array.isArray(group?.songs)?group.songs:(group?.title?[group]:[]);
    for(const song of songs){
      if(!song||!song.title)continue;
      tracks.push({
        offset,
        title:String(song.title||"Unknown title").slice(0,300),
        artist:String(song.artist||"Unknown artist").slice(0,300),
        album:String(song.album||"").slice(0,300),
        release_date:String(song.release_date||"").slice(0,40),
        timecode:String(song.timecode||"").slice(0,40),
        score:Number.isFinite(Number(song.score))?Number(song.score):null,
        song_link:typeof song.song_link==="string"?song.song_link:null,
        apple_music:song.apple_music||null,spotify:song.spotify||null
      });
    }
  }
  const grouped=new Map();
  for(const track of tracks){
    const key=[track.title.toLowerCase(),track.artist.toLowerCase()].join("|");
    if(!grouped.has(key))grouped.set(key,{...track,offsets:track.offset?[track.offset]:[]});
    else if(track.offset&&!grouped.get(key).offsets.includes(track.offset))grouped.get(key).offsets.push(track.offset);
  }
  const unique=[...grouped.values()];
  return json({ok:true,match:unique.length>0,provider:"AudD Enterprise",
    scannedChunks:groups.length,tracks:unique.slice(0,300),
    message:unique.length?"Pemindaian selesai.":"Belum ada lagu yang cocok pada segmen yang dipindai."});
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS"&&url.pathname.startsWith("/api/"))return new Response(null,{status:204,headers:{"access-control-allow-origin":url.origin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type"}});
  if(url.pathname==="/api/music/scan-video"&&request.method==="POST")return recognizeMusicVideo(request,env);
  if(url.pathname==="/api/music/status"&&request.method==="GET")return musicStatus(env);
  if(url.pathname==="/api/search"&&request.method==="POST")return searchYouTube(request,env);
  if(url.pathname==="/api/music/recognize"&&request.method==="POST")return recognizeMusic(request,env);
  if(url.pathname==="/api/platform/status"&&request.method==="GET")return platformStatus(env);
  if(url.pathname==="/api/youtube/status"&&request.method==="GET")return json({ok:true,service:"ARYANZZ YouTube Hybrid",mode:"public-community-apis",youtubeDownloader:true,providers:{piped:PIPED_INSTANCES.map(x=>x.id),invidious:INVIDIOUS_INSTANCES.map(x=>x.id)},requiresApiKey:false,requiresPrivateServer:false,supportedVideo:["144","240","360","480","720","1080","1440","2160"],supportedAudio:["m4a","webm","ogg"],note:"Status daftar provider; ketersediaan stream diuji saat pemeriksaan link."});
  if(url.pathname==="/api/youtube/info"&&request.method==="GET")return youtubeInfo(request);
  if(url.pathname==="/api/youtube/stream"&&(request.method==="GET"||request.method==="HEAD"))return youtubeStream(request);
  if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"ARYANZZ",version:"71.0",mode:"cloudflare-worker-zero-server",directMediaDownload:true,selfHostedDownloader:false,youtubeDownloader:true,youtubeApiKeyConfigured:false,musicRecognitionConfigured:!!env.AUDD_API_TOKEN,musicFallbackReady:false,musicVideoRecognitionReady:false,platformExtraction:false,platformBackend:"public-api-hybrid"});
  if(url.pathname==="/api/info"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/info");if(proxied)return proxied;return info(request);}
  if(url.pathname==="/api/direct-file"&&request.method==="GET")return download(request);
  if(url.pathname==="/api/download"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/download");if(proxied)return proxied;return download(request);}
  if(url.pathname.startsWith("/api/"))return json({error:"Endpoint tidak ditemukan."},404);
  return env.ASSETS.fetch(request);
}};
