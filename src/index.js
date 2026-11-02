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

const AUDD_MAX_BYTES=10*1024*1024;
const MAX_YOUTUBE_BYTES=500*1024*1024;
const MUSIC_RATE_BUCKETS=new Map();
function isYouTubeUrl(raw){
  try{const u=new URL(raw),h=u.hostname.toLowerCase();return ["http:","https:"].includes(u.protocol)&&["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtu.be","www.youtu.be","youtube-nocookie.com","www.youtube-nocookie.com"].includes(h);}catch{return false;}
}
const PIPED_PUBLIC_INSTANCES=[
"https://pipedapi.kavin.rocks","https://pipedapi.leptons.xyz","https://pipedapi.nosebs.ru",
"https://pipedapi-libre.kavin.rocks","https://piped-api.privacy.com.de","https://pipedapi.adminforge.de",
"https://api.piped.yt","https://pipedapi.drgns.space","https://pipedapi.owo.si",
"https://pipedapi.ducks.party","https://piped-api.codespace.cz","https://pipedapi.reallyaweso.me",
"https://api.piped.private.coffee","https://pipedapi.darkness.services","https://pipedapi.orangenet.cc"
];
const INVIDIOUS_PUBLIC_INSTANCES=["https://inv.nadeko.net","https://invidious.nerdvpn.de","https://yt.chocolatemoo53.com","https://invidious.tiekoetter.com"];
const HYBRID_MEDIA_ROOTS=["kavin.rocks","leptons.xyz","nosebs.ru","privacy.com.de","adminforge.de","piped.yt","drgns.space","owo.si","ducks.party","codespace.cz","reallyaweso.me","private.coffee","darkness.services","orangenet.cc"];
function youtubeVideoId(raw){
  try{const u=new URL(raw),h=u.hostname.toLowerCase();if(h==="youtu.be"||h==="www.youtu.be")return u.pathname.split("/").filter(Boolean)[0]||null;const v=u.searchParams.get("v");if(v)return v;return u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,20})/)?.[1]||null;}catch{return null;}
}
function hybridProviderRoot(host){
  const labels=String(host||"").toLowerCase().split(".").filter(Boolean);
  if(labels.length<2)return labels.join(".");
  const lastTwo=labels.slice(-2).join(".");
  const compound=new Set(["com.de","co.uk","org.uk","com.au","net.au","co.nz","com.br","co.jp","com.sg"]);
  return compound.has(lastTwo)&&labels.length>=3?labels.slice(-3).join("."):lastTwo;
}
function hybridIsPipedApiInstance(raw){
  try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&(/^(?:pipedapi(?:-libre)?|piped-api)\.[a-z0-9.-]+$/i.test(u.hostname)||/^api\.piped\.[a-z0-9.-]+$/i.test(u.hostname));}catch{return false;}
}
function hybridMediaUrl(raw,trustedOrigin){
  try{
    const u=new URL(raw,trustedOrigin||undefined);
    if(u.protocol!=="https:"||u.username||u.password)return null;
    const h=u.hostname.toLowerCase();
    if(h==="googlevideo.com"||h.endsWith(".googlevideo.com"))return u;
    if(HYBRID_MEDIA_ROOTS.some(root=>h===root||h.endsWith("."+root)))return u;
    if(trustedOrigin){
      const trusted=new URL(trustedOrigin);
      if(u.origin===trusted.origin)return u;
      const root=hybridProviderRoot(trusted.hostname);
      if(root&&(h===root||h.endsWith("."+root)))return u;
    }
    return null;
  }catch{return null;}
}
function hybridVideoHeight(item,url){
  const direct=Number(item?.height);if(Number.isFinite(direct)&&direct>=100&&direct<=4320)return direct;
  for(const label of [item?.qualityLabel,item?.quality,item?.resolution,item?.size,item?.label].filter(Boolean).map(String)){
    const dimensions=label.match(/\d{2,4}\s*[x×]\s*(\d{2,4})/i);if(dimensions)return Number(dimensions[1]);
    const p=label.match(/(?:^|\D)(\d{3,4})\s*p(?:\D|$)/i);if(p)return Number(p[1]);
  }
  const itag=Number(url?.searchParams?.get("itag")||item?.itag);
  return ({18:360,22:720,37:1080,59:480,78:480,82:360,83:480,84:720,85:1080,133:240,134:360,135:480,136:720,137:1080,160:144,264:1440,266:2160,298:720,299:1080})[itag]||0;
}
function hybridVideoFormat(item,instance,progressiveSource=false,adaptiveSource=false){
  const mime=String(item?.mimeType||item?.type||item?.mime_type||item?.mime||"").toLowerCase(),container=String(item?.format||item?.container||item?.ext||"").toLowerCase();
  const url=hybridMediaUrl(item?.url||item?.urlTemplate||"",instance),height=hybridVideoHeight(item,url);
  const itag=Number(url?.searchParams?.get("itag")||item?.itag);
  const mp4=mime.includes("video/mp4")||mime.includes("video/x-m4v")||container.includes("mpeg_4")||container==="mp4"||container==="m4v"||String(item?.ext||"").toLowerCase()==="mp4"||String(url?.searchParams?.get("mime")||"").toLowerCase().includes("video/mp4")||(/\.mp4(?:$|[?#])/i.test(url?.pathname||""))||(progressiveSource&&[18,22,37,59,78,82,83,84,85].includes(itag));
  const videoOnly=adaptiveSource||item?.videoOnly===true||item?.isVideoOnly===true||item?.video_only===true;
  if(!url||![144,240,360,480,720,1080,1440,2160].includes(height)||!mp4)return null;
  return {mode:"video",height,quality:height+"p",ext:"mp4",mimeType:"video/mp4",url:url.toString(),bitrate:Number(item.bitrate)||0,videoOnly};
}
function hybridAudioFormat(item,instance){
  const mime=String(item?.mimeType||item?.type||"").toLowerCase(),container=String(item?.format||item?.container||"").toLowerCase(),url=hybridMediaUrl(item?.url||"",instance);
  if(!url||!(mime.startsWith("audio/")||["m4a","mp3","webm","opus","ogg"].includes(container)))return null;
  let ext=container==="mpeg"?"mp3":container==="mp4"?"m4a":container;
  if(!["m4a","mp3","webm","opus","ogg","wav","flac"].includes(ext)){if(mime.includes("audio/mp4"))ext="m4a";else if(mime.includes("audio/mpeg"))ext="mp3";else if(mime.includes("audio/webm"))ext="webm";else return null;}
  return {mode:"audio",height:0,quality:String(item.quality||item.audioQuality||item.bitrate||"Audio"),ext,mimeType:mime.split(";")[0],url:url.toString(),bitrate:Number(item.bitrate)||0};
}
function dedupeHybridFormats(formats){
  const seen=new Set();return formats.filter(f=>{const key=f.mode+":"+f.height+":"+f.ext+":"+(f.videoOnly?"video-only":"muxed")+":"+(f.instance||"")+":"+f.url.split("?")[0];if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.mode===b.mode?(a.mode==="video"?a.height-b.height:b.bitrate-a.bitrate):a.mode==="video"?-1:1);
}
async function hybridFetchJson(url,parentSignal){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  const abort=()=>controller.abort();
  if(parentSignal){if(parentSignal.aborted)controller.abort();else parentSignal.addEventListener("abort",abort,{once:true});}
  try{
    const response=await fetch(url,{headers:{accept:"application/json","user-agent":"ARYANZZ/72.2 (public-instance failover)"},signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    if(!(response.headers.get("content-type")||"").toLowerCase().includes("json"))throw new Error("Respons bukan JSON");
    return await response.json();
  }finally{clearTimeout(timer);parentSignal?.removeEventListener("abort",abort);}
}
async function currentHybridPipedInstances(){
  const fallback=PIPED_PUBLIC_INSTANCES.slice();
  try{
    const response=await fetch("https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md",{headers:{accept:"text/plain"},signal:AbortSignal.timeout(2500),cache:"no-store"});
    if(!response.ok)return fallback;
    const markdown=await response.text();
    const found=[...markdown.matchAll(/https:\/\/(?:pipedapi(?:-libre)?|piped-api|api\.piped)\.[a-z0-9.-]+/gi)].map(match=>match[0].replace(/\/$/,""));
    const safe=found.filter(origin=>{try{const u=new URL(origin);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&hybridIsPipedApiInstance(origin);}catch{return false;}});
    return [...new Set([...safe,...fallback])].slice(0,24);
  }catch{return fallback;}
}
async function currentHybridInvidiousInstances(){
  const fallback=INVIDIOUS_PUBLIC_INSTANCES.slice();
  try{
    const response=await fetch("https://api.invidious.io/instances.json?sort_by=type,health",{headers:{accept:"application/json"},signal:AbortSignal.timeout(2500),cache:"no-store"});
    if(!response.ok)return fallback;
    const rows=await response.json();if(!Array.isArray(rows))return fallback;
    const discovered=rows.map(row=>{
      const raw=Array.isArray(row)?row[0]:row?.uri,meta=Array.isArray(row)?row[1]:row;
      try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&meta?.api===true&&meta?.cors===true&&!u.hostname.endsWith(".onion")?u.origin:null;}catch{return null;}
    }).filter(Boolean);
    return [...new Set([...fallback,...discovered])].slice(0,20);
  }catch{return fallback;}
}
async function hybridProbeGroup(instances,pathFor,parser){
  const settled=await Promise.allSettled(instances.map(async instance=>{
    const data=await hybridFetchJson(instance+pathFor);
    const result=parser(data,instance);
    if(!result)throw new Error("Instance tidak menyediakan pasangan stream MP4/audio yang didukung.");
    return result;
  }));
  return settled.filter(item=>item.status==="fulfilled").map(item=>item.value);
}
function hybridFromPiped(data,instance){
  const formats=dedupeHybridFormats([...(Array.isArray(data.videoStreams)?data.videoStreams.map(item=>hybridVideoFormat(item,instance)).filter(Boolean):[]),...(Array.isArray(data.audioStreams)?data.audioStreams.map(item=>hybridAudioFormat(item,instance)).filter(Boolean):[])]);
  const hasUsableVideo=formats.some(item=>item.mode==="video"&&(!item.videoOnly||formats.some(audio=>audio.mode==="audio"&&audio.ext==="m4a")));
  if(!hasUsableVideo||!data.title)return null;
  return {ok:true,providerReady:true,providerName:"Hybrid",provider:"Piped",instance,title:String(data.title).slice(0,300),thumbnail:typeof data.thumbnailUrl==="string"?data.thumbnailUrl:null,duration:Number(data.duration)||null,uploader:String(data.uploader||"").slice(0,160),formats:formats.map((f,i)=>({...f,id:"f"+i})),message:"Stream progresif tersedia dari instance komunitas."};
}
function hybridFromInvidious(data,instance){
  const adaptive=Array.isArray(data.adaptiveFormats)?data.adaptiveFormats:Array.isArray(data.adaptive_formats)?data.adaptive_formats:[];
  const formats=dedupeHybridFormats([...((Array.isArray(data.formatStreams)?data.formatStreams:Array.isArray(data.format_streams)?data.format_streams:[]).map(item=>hybridVideoFormat(item,instance,true)).filter(Boolean)),...adaptive.map(item=>String(item?.type||item?.mimeType||"").toLowerCase().startsWith("video/")?hybridVideoFormat(item,instance,true,true):hybridAudioFormat(item,instance)).filter(Boolean)]);
  const hasUsableVideo=formats.some(item=>item.mode==="video"&&item.ext==="mp4"&&(!item.videoOnly||formats.some(audio=>audio.mode==="audio"&&audio.ext==="m4a")));
  if(!hasUsableVideo||!data.title)return null;const thumb=Array.isArray(data.videoThumbnails)?data.videoThumbnails.find(x=>x.quality==="maxresdefault")||data.videoThumbnails[0]:null;
  return {ok:true,providerReady:true,providerName:"Hybrid",provider:"Invidious",instance,title:String(data.title).slice(0,300),thumbnail:typeof thumb?.url==="string"?thumb.url:null,duration:Number(data.lengthSeconds)||null,uploader:String(data.author||"").slice(0,160),formats:formats.map((f,i)=>({...f,id:"f"+i})),message:"Stream progresif tersedia dari instance komunitas."};
}
async function hybridYoutubeInfo(request){
  const raw=new URL(request.url).searchParams.get("url")||"";
  if(!isYouTubeUrl(raw))return json({error:"URL YouTube tidak valid."},400);
  const id=youtubeVideoId(raw);
  if(!id||!/^[A-Za-z0-9_-]{6,20}$/.test(id))return json({error:"ID video YouTube tidak valid."},400);
  const [piped,inv]=await Promise.all([currentHybridPipedInstances(),currentHybridInvidiousInstances()]);
  const [pipedResults,invResults]=await Promise.all([
    hybridProbeGroup(piped,"/streams/"+encodeURIComponent(id),hybridFromPiped),
    hybridProbeGroup(inv,"/api/v1/videos/"+encodeURIComponent(id),hybridFromInvidious)
  ]);
  const available=[...pipedResults,...invResults];
  if(available.length){
    const primary=available.find(item=>item.provider==="Piped")||available[0];
    const formats=dedupeHybridFormats(available.flatMap(result=>(result.formats||[]).map(format=>({...format,instance:result.instance,provider:result.provider}))));
    return json({...primary,providerReady:true,formats:formats.map((format,index)=>({...format,id:"f"+index})),providers:available.map(item=>({provider:item.provider,instance:item.instance,formatCount:item.formats?.length||0}))});
  }
  {
    let preview={};
    try{const u=new URL("https://www.youtube.com/oembed");u.searchParams.set("url",raw);u.searchParams.set("format","json");const res=await fetch(u.toString(),{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});if(res.ok)preview=await res.json();}catch{}
    return json({ok:true,providerReady:false,providerName:"Hybrid",provider:"Unavailable",title:String(preview.title||"Video YouTube").slice(0,300),thumbnail:typeof preview.thumbnail_url==="string"?preview.thumbnail_url:null,formats:[],providerMessage:"Instance komunitas belum memberikan stream MP4 yang dapat digunakan. Link video tetap valid; coba lagi nanti atau gunakan file yang memang dapat diunduh dari pemiliknya.",diagnostics:[]});
  }
}
function hybridFilename(title,ext){
  const clean=String(title||"aryanzz-youtube").replace(/[\\/:*?"<>|\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,90)||"aryanzz-youtube";
  return clean.toLowerCase().endsWith("."+ext)?clean:clean+"."+ext;
}
async function hybridYoutubeFile(request){
  const u=new URL(request.url),rawStream=u.searchParams.get("url")||"",instance=u.searchParams.get("instance")||"";
  const trustedInstance=[...PIPED_PUBLIC_INSTANCES,...INVIDIOUS_PUBLIC_INSTANCES].some(candidate=>{try{return new URL(candidate).origin===new URL(instance).origin}catch{return false}})||hybridIsPipedApiInstance(instance)?instance:undefined;
  const stream=hybridMediaUrl(rawStream,trustedInstance),ext=String(u.searchParams.get("ext")||"mp4").toLowerCase();
  if(!stream)return json({error:"URL stream tidak berasal dari host media yang diizinkan atau instance komunitas tidak dikenal."},400);
  if(!["mp4","m4a","mp3","webm","opus","ogg","wav","flac"].includes(ext))return json({error:"Format file tidak didukung."},400);
  const title=hybridFilename(u.searchParams.get("title"),ext),range=request.headers.get("range");let current=stream,response;
  try{
    for(let i=0;i<4;i++){
      const headers={accept:"*/*","user-agent":"Mozilla/5.0 (compatible; ARYANZZ/71.0)"};if(range&&/^bytes=\d*-\d*(,\d*-\d*)*$/.test(range))headers.range=range;
      response=await fetch(current.toString(),{headers,redirect:"manual",signal:AbortSignal.timeout(30000)});
      if(![301,302,303,307,308].includes(response.status))break;const loc=response.headers.get("location");if(!loc)break;
      const next=hybridMediaUrl(new URL(loc,current).toString(),trustedInstance);if(!next)return json({error:"Redirect stream menuju host yang tidak diizinkan."},502);current=next;
    }
  }catch(e){return json({error:"Gagal mengambil stream dari instance komunitas: "+String(e.message||"network error").slice(0,160)},502)}
  if(!response||![200,206].includes(response.status)||!response.body)return json({error:"Stream tidak tersedia atau ditolak (HTTP "+(response?.status||502)+"). Coba format/instance lain."},502);
  const size=Number(response.headers.get("content-length")||0);if(size>MAX_YOUTUBE_BYTES){await response.body.cancel();return json({error:"File melebihi batas 500 MB."},413)}
  const mime=ext==="mp4"?"video/mp4":ext==="m4a"?"audio/mp4":ext==="mp3"?"audio/mpeg":ext==="webm"?"video/webm":ext==="opus"?"audio/ogg":ext==="ogg"?"audio/ogg":ext==="wav"?"audio/wav":"audio/flac";
  const headers=new Headers({"content-type":mime,"content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(title),"cache-control":"no-store","x-content-type-options":"nosniff","accept-ranges":response.headers.get("accept-ranges")||"bytes"});
  for(const h of ["content-length","content-range"])if(response.headers.get(h))headers.set(h,response.headers.get(h));
  let received=0;
  const limited=response.body.pipeThrough(new TransformStream({transform(chunk,controller){
    received+=chunk.byteLength;
    if(received>MAX_YOUTUBE_BYTES){controller.error(new Error("File melebihi batas 500 MB."));return;}
    controller.enqueue(chunk);
  }}));
  return new Response(limited,{status:response.status,headers});
}
function youtubeInfoUrl(raw){return isYouTubeUrl(raw)?raw:null;}
async function youtubeInfo(request,env){return hybridYoutubeInfo(request);}
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
  if(url.pathname==="/api/youtube/status"&&request.method==="GET")return json({ok:true,service:"ARYANZZ YouTube Backend",youtubeDownloader:true,provider:"Dynamic Piped + Invidious hybrid",paidProvider:false,cobalt:false,supportedAudio:["M4A","MP3","WEBM","OPUS"],supportedVideo:["360","480","720","1080","1440","2160"]});
  if(url.pathname==="/api/youtube/hybrid/info"&&request.method==="GET")return hybridYoutubeInfo(request);
  if(url.pathname==="/api/youtube/hybrid/file"&&request.method==="GET")return hybridYoutubeFile(request);
  if(url.pathname==="/api/youtube/info"&&request.method==="GET")return youtubeInfo(request,env);
    if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"ARYANZZ",version:"72.2",mode:"cloudflare-worker-zero-server-hybrid",directMediaDownload:true,selfHostedDownloader:false,youtubeDownloader:true,youtubeApiKeyConfigured:false,cobalt:false,paidYoutubeProvider:false,musicRecognitionConfigured:!!env.AUDD_API_TOKEN,musicFallbackReady:false,musicVideoRecognitionReady:false,platformExtraction:false,platformBackend:"community-handoff"});
  if(url.pathname==="/api/info"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/info");if(proxied)return proxied;return info(request);}
  if(url.pathname==="/api/direct-file"&&request.method==="GET")return download(request);
  if(url.pathname==="/api/download"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/download");if(proxied)return proxied;return download(request);}
  if(url.pathname.startsWith("/api/"))return json({error:"Endpoint tidak ditemukan."},404);
  return env.ASSETS.fetch(request);
}};
