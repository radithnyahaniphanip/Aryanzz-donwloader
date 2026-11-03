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
async function getUpstream(parsed,method="HEAD",range=null){
  let current=parsed;
  for(let i=0;i<5;i++){
    const headers={"user-agent":"ARYANZZ/73.7 media fetch"};
    if(method==="GET"&&range&&/^bytes=\d*-\d*(?:,\d*-\d*)*$/.test(range))headers.range=range;
    let response=await fetch(current.url.toString(),{method,redirect:"manual",headers});
    if(method==="HEAD"&&[403,405,501].includes(response.status)){
      response=await fetch(current.url.toString(),{method:"GET",redirect:"manual",headers:{"user-agent":"ARYANZZ/73.7 media fetch","range":"bytes=0-0"}});
      if(response.body)response.body.cancel().catch(()=>{});
    }
    if(![301,302,303,307,308].includes(response.status))return {response,parsed:current};
    const loc=response.headers.get("location");if(!loc)return {response,parsed:current};
    current=parseMediaUrl(new URL(loc,current.url).toString());
  }
  throw new Error("Terlalu banyak pengalihan URL.");
}
const PLATFORM_HOSTS=["youtube.com","youtu.be","youtube-nocookie.com","tiktok.com","instagram.com","instagr.am","snackvideo.com","threads.net","facebook.com","fb.watch","pinterest.com","pin.it","x.com","twitter.com","reddit.com","redd.it","vimeo.com","dailymotion.com","dai.ly","soundcloud.com","twitch.tv","streamable.com","tumblr.com","bilibili.com","b23.tv","vk.com","ok.ru","rutube.ru","likee.video","snapchat.com","imgur.com","bandcamp.com","mixcloud.com","ted.com","archive.org","loom.com","rumble.com","odysee.com","weibo.com","xiaohongshu.com","capcut.com","linkedin.com","wechat.com","weixin.qq.com","kakao.com","idntimes.com"];
function isPlatformLink(raw){
  try{const u=new URL(raw);const h=u.hostname.toLowerCase();return ["http:","https:"].includes(u.protocol)&&PLATFORM_HOSTS.some(d=>h===d||h.endsWith("."+d));}catch{return false;}
}
const FREE_MEDIA_API="https://btch-downloader-api-green.vercel.app";
const FREE_PLATFORM_KEYS={
  "youtube.com":"youtube","youtu.be":"youtube","youtube-nocookie.com":"youtube","tiktok.com":"tiktok","instagram.com":"instagram","instagr.am":"instagram",
  "snackvideo.com":"snackvideo","pinterest.com":"pinterest","pin.it":"pinterest",
  "facebook.com":"facebook","fb.watch":"facebook","x.com":"twitter","twitter.com":"twitter",
  "reddit.com":"reddit","redd.it":"reddit","v.redd.it":"reddit","vimeo.com":"vimeo","threads.net":"threads",
  "soundcloud.com":"soundcloud","capcut.com":"capcut"
};
const SOCIAL_RATE_BUCKETS=new Map();
function freePlatformKey(raw){
  try{const host=new URL(raw).hostname.toLowerCase();return Object.entries(FREE_PLATFORM_KEYS).find(([domain])=>host===domain||host.endsWith("."+domain))?.[1]||null}catch{return null}
}
function socialRateLimited(request){
  const ip=request.headers.get("cf-connecting-ip")||"unknown",now=Date.now();
  let bucket=SOCIAL_RATE_BUCKETS.get(ip);
  if(!bucket||now-bucket.started>=60000)bucket={started:now,count:0};
  bucket.count++;SOCIAL_RATE_BUCKETS.set(ip,bucket);
  if(SOCIAL_RATE_BUCKETS.size>1200)for(const [key,value] of SOCIAL_RATE_BUCKETS)if(now-value.started>=60000)SOCIAL_RATE_BUCKETS.delete(key);
  return bucket.count>18;
}
function safePublicMediaUrl(raw){
  try{
    const u=new URL(raw),h=u.hostname.toLowerCase().replace(/^\[|\]$/g,"");
    if(u.protocol!=="https:"||u.username||u.password||u.port)return null;
    if(h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h==="::"||h==="::1"||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||/^fc[0-9a-f]{2}:/i.test(h)||/^fd[0-9a-f]{2}:/i.test(h)||/^fe80:/i.test(h))return null;
    return u;
  }catch{return null}
}
function freeProviderMediaInfo(data,rawUrl,requestUrl){
  const normalized=data?.normalized;
  const media=Array.isArray(normalized?.media)?normalized.media:[];
  const mediaItems=media.slice();
  const rawResult=data?.result||{};
  const rawVideoCandidates=[
    normalized?.video_url,normalized?.videoUrl,normalized?.video?.url,normalized?.video?.download_url,
    rawResult.video_url,rawResult.videoUrl,rawResult.video?.url,rawResult.video?.download_url,
    rawResult.download_url,rawResult.downloadUrl,rawResult.url,data?.video_url,data?.videoUrl,data?.download_url
  ];
  for(const candidate of rawVideoCandidates){
    const item=typeof candidate==="string"?{label:"Video",type:"video",url:candidate}:candidate&&typeof candidate==="object"&&typeof candidate.url==="string"?{label:"Video",type:"video",...candidate}:null;
    if(item?.url&&!mediaItems.some(existing=>existing?.url===item.url))mediaItems.push(item);
  }
  for(const candidate of [rawResult.audio_url,rawResult.audioUrl,rawResult.music?.audio_url,rawResult.music?.url,rawResult.music?.download_url,normalized?.audio_url,normalized?.audioUrl]){
    const item=typeof candidate==="string"?{label:"Audio MP3",type:"audio",url:candidate}:candidate&&typeof candidate==="object"&&typeof candidate.url==="string"?{label:"Audio",type:"audio",...candidate}:null;
    if(item?.url&&!mediaItems.some(existing=>existing?.url===item.url))mediaItems.push(item);
  }
  const title=String(normalized?.title||rawResult.title||rawResult.caption||"Media siap diunduh").slice(0,300);
  const mimeExtensions={
    "video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov","video/x-msvideo":"avi",
    "audio/mpeg":"mp3","audio/mp4":"m4a","audio/aac":"aac","audio/ogg":"ogg","audio/wav":"wav","audio/flac":"flac"
  };
  const formats=mediaItems.map(item=>{
    const mediaUrl=safePublicMediaUrl(item?.url);if(!mediaUrl)return null;
    const label=String(item?.label||item?.type||"Media").slice(0,100);
    const kind=String(item?.type||item?.kind||label).toLowerCase();
    const mime=String(item?.mimeType||item?.mime_type||item?.mimetype||item?.contentType||item?.content_type||"").split(";")[0].trim().toLowerCase();
    const pathExt=(mediaUrl.pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]||"").toLowerCase();
    const declaredExt=String(item?.ext||item?.extension||item?.fileExtension||"").replace(/^\./,"").toLowerCase();
    const ext=mimeExtensions[mime]||(["mp4","webm","mov","m4v","avi","3gp","mp3","m4a","aac","opus","ogg","wav","flac"].includes(pathExt)?pathExt:"")||(["mp4","webm","mov","m4v","avi","3gp","mp3","m4a","aac","opus","ogg","wav","flac"].includes(declaredExt)?declaredExt:"")||(/mp3/i.test(label)?"mp3":/m4a/i.test(label)?"m4a":/webm/i.test(label)?"webm":/mp4|video/i.test(label+ " "+kind)?"mp4":"");
    const image=/image|photo|picture|thumbnail|cover/.test(kind+" "+label)||["jpg","jpeg","png","gif","webp","avif"].includes(pathExt)||["jpg","jpeg","png","gif","webp","avif"].includes(declaredExt);
    if(image)return null;
    const audio=mime.startsWith("audio/")||/audio|mp3|m4a|aac|opus|flac/.test(kind+" "+label)||["mp3","m4a","aac","opus","ogg","wav","flac"].includes(ext);
    const video=mime.startsWith("video/")||/video/.test(kind+" "+label)||["mp4","webm","mov","m4v","avi","3gp"].includes(ext);
    if(!audio&&!video)return null;
    const finalExt=ext||(audio?"mp3":"mp4");
    const rawQuality=item?.height??item?.quality??item?.resolution??item?.qualityLabel??label;
    const qualityMatch=String(rawQuality||"").match(/(?:^|\D)(144|240|360|480|540|576|720|900|960|1080|1440|2160)\s*p?/i)||String(label).match(/(144|240|360|480|540|576|720|900|960|1080|1440|2160)p/i);
    const height=Number(rawQuality)>0?Number(rawQuality):Number(qualityMatch?.[1]||0);
    const videoOnly=video&&(item?.videoOnly===true||item?.video_only===true||item?.hasAudio===false||item?.has_audio===false||item?.audio===false);
    const filenameBase=title.replace(/\.[a-z0-9]{2,5}$/i,"").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,90)||"aryanzz-media";
    const downloadUrl=new URL("/api/social-file",requestUrl);
    downloadUrl.searchParams.set("url",mediaUrl.href);
    downloadUrl.searchParams.set("source",rawUrl);
    downloadUrl.searchParams.set("filename",filenameBase);
    downloadUrl.searchParams.set("ext",finalExt);
    downloadUrl.searchParams.set("mode",audio?"audio":"video");
    const previewUrl=new URL(downloadUrl.href);previewUrl.searchParams.set("preview","1");
    return {mode:audio?"audio":"video",type:audio?"audio":"video",ext:finalExt,height:audio?0:height,videoOnly,hasAudio:video?!videoOnly:undefined,mimeType:mime||null,url:mediaUrl.href,downloadUrl:downloadUrl.href,previewUrl:previewUrl.href,label,filesize:Number(item?.sizeBytes||item?.size_bytes||item?.filesize||item?.size||0)||null};
  }).filter(Boolean);
  const thumbnail=safePublicMediaUrl(normalized?.thumbnail||rawResult.thumbnail||rawResult.cover)?.href||null;
  const duration=Number(normalized?.duration||rawResult.duration||rawResult.video?.duration||0)||null;
  if(!formats.length)return null;
  formats.sort((a,b)=>a.mode===b.mode?(b.height-a.height):a.mode==="video"?-1:1);
  const platformKey=freePlatformKey(rawUrl);
  const mp4Formats=formats.filter(item=>item.mode==="video"&&!item.videoOnly&&["mp4","m4v"].includes(item.ext));
  return {ok:true,providerName:"Public API",providerReady:true,provider:"Free public provider",source:"Provider komunitas gratis",platform:platformKey,title,filename:title,duration,thumbnail,type:formats.some(x=>x.mode==="video")?"video":"audio",formats,capabilities:{linkAccepted:true,preview:formats.some(item=>item.mode==="video"||item.mode==="audio"),mp4:mp4Formats.length>0,audio:formats.some(item=>item.mode==="audio"),mp4Qualities:[...new Set(mp4Formats.map(item=>item.height).filter(Boolean))]}};
}
async function freePublicMediaInfo(rawUrl,requestUrl){
  const key=freePlatformKey(rawUrl);
  if(!key)return json({error:"Platform belum didukung oleh provider gratis."},400);
  const labels={tiktok:"TikTok",instagram:"Instagram",snackvideo:"SnackVideo",capcut:"CapCut",pinterest:"Pinterest",facebook:"Facebook",twitter:"X",reddit:"Reddit",vimeo:"Vimeo",threads:"Threads",soundcloud:"SoundCloud"};
  const label=labels[key]||key;
  const guidance={
    tiktok:"Gunakan tautan video publik, bukan halaman profil atau LIVE.",
    instagram:"Pastikan Reels/postingan berupa video dan dapat dilihat publik. Akun privat, Story yang dibatasi, atau konten yang memerlukan login tidak dapat diekstrak.",
    snackvideo:"Gunakan tautan share video publik, bukan halaman profil atau halaman aplikasi.",
    capcut:"Gunakan tautan share hasil video yang dapat diputar publik. Draft pribadi dan template/proyek yang belum diekspor bukan file MP4 yang bisa diunduh.",
    pinterest:"Gunakan tautan Pin publik yang berisi video; Pin gambar tidak dapat diunduh sebagai MP4.",
    facebook:"Gunakan tautan video/Reels publik yang bisa diputar tanpa login.",
    twitter:"Gunakan tautan post X yang memuat video publik; post teks atau gambar tidak menghasilkan MP4.",
    reddit:"Gunakan post Reddit atau v.redd.it yang memuat video publik; beberapa video memakai audio terpisah.",
    vimeo:"Gunakan video Vimeo publik yang tidak dibatasi password atau pengaturan privasi.",
    threads:"Gunakan post Threads publik yang benar-benar memuat video.",
    soundcloud:"SoundCloud diproses sebagai audio (MP3/M4A jika tersedia), bukan video MP4."
  };
  const endpoint=FREE_MEDIA_API+"/api/download/"+key+"?url="+encodeURIComponent(rawUrl);
  try{
    const response=await fetch(endpoint,{headers:{accept:"application/json"},signal:AbortSignal.timeout(28000),cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data?.success===false){
      const detail=data?.error?.message||data?.error||"Provider gratis menjawab HTTP "+response.status+".";
      return json({error:label+" belum bisa diproses oleh provider gratis. "+String(detail).slice(0,180)+" "+(guidance[key]||"Periksa kembali tautan publik.")},response.status===429?429:502);
    }
    const normalized=freeProviderMediaInfo(data,rawUrl,requestUrl);
    if(!normalized)return json({error:label+" mengenali tautan, tetapi belum mengembalikan stream video/audio yang bisa diputar. "+(guidance[key]||"Gunakan tautan publik langsung.")},502);
    return json(normalized);
  }catch(error){return json({error:"Provider "+label+" sedang tidak dapat dijangkau. Coba lagi sebentar. Detail: "+String(error?.message||error).slice(0,120)},502)}
}

function mediaAsciiAt(bytes,offset,value){
  if(offset<0||offset+value.length>bytes.length)return false;
  for(let i=0;i<value.length;i++)if(bytes[offset+i]!==value.charCodeAt(i))return false;
  return true;
}
function detectSocialMediaSignature(bytes,mode){
  const limit=Math.min(bytes.length,65536);
  for(let i=0;i<=limit-4;i++){
    if(mediaAsciiAt(bytes,i,"ftyp"))return mode==="audio"?{mime:"audio/mp4",ext:"m4a",mode:"audio"}:{mime:"video/mp4",ext:"mp4",mode:"video"};
  }
  if(bytes.length>=4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)return {mime:"video/webm",ext:"webm",mode:"video"};
  if(bytes.length>=12&&mediaAsciiAt(bytes,0,"RIFF")&&mediaAsciiAt(bytes,8,"AVI "))return {mime:"video/x-msvideo",ext:"avi",mode:"video"};
  if(bytes.length>=3&&mediaAsciiAt(bytes,0,"FLV"))return {mime:"video/x-flv",ext:"flv",mode:"video"};
  if(bytes.length>=4&&mediaAsciiAt(bytes,0,"OggS"))return mode==="audio"?{mime:"audio/ogg",ext:"ogg",mode:"audio"}:null;
  if(bytes.length>=4&&mediaAsciiAt(bytes,0,"fLaC"))return {mime:"audio/flac",ext:"flac",mode:"audio"};
  if(bytes.length>=12&&mediaAsciiAt(bytes,0,"RIFF")&&mediaAsciiAt(bytes,8,"WAVE"))return {mime:"audio/wav",ext:"wav",mode:"audio"};
  if(bytes.length>=3&&mediaAsciiAt(bytes,0,"ID3"))return {mime:"audio/mpeg",ext:"mp3",mode:"audio"};
  if(bytes.length>=2&&bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)return mode==="audio"?{mime:"audio/mpeg",ext:"mp3",mode:"audio"}:null;
  return null;
}
function socialFileName(value,ext){
  const base=String(value||"aryanzz-media").replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().slice(0,110).replace(/\.[a-z0-9]{2,5}$/i,"")||"aryanzz-media";
  return base+"."+ext;
}
async function fetchSocialHeaders(url,init,timeoutMs=25000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
async function fetchSocialUpstream(mediaUrl,sourceUrl,rangeHeader){
  const sourceOrigin=new URL(sourceUrl).origin;
  const headers={"user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36","accept":"video/*,audio/*,application/octet-stream;q=0.9,*/*;q=0.8","referer":sourceOrigin+"/","origin":sourceOrigin};
  if(rangeHeader)headers.range=rangeHeader;
  let current=mediaUrl;
  for(let i=0;i<6;i++){
    const response=await fetchSocialHeaders(current.href,{method:"GET",headers,redirect:"manual",cache:"no-store"});
    if(![301,302,303,307,308].includes(response.status))return response;
    const location=response.headers.get("location");
    if(!location)throw new Error("CDN media mengirim pengalihan tanpa alamat tujuan.");
    const next=safePublicMediaUrl(new URL(location,current).href);
    if(!next)throw new Error("Pengalihan CDN menuju alamat yang tidak aman.");
    current=next;
  }
  throw new Error("Terlalu banyak pengalihan dari CDN media.");
}
async function readSocialChunk(reader,idleMs=60000){
  let timer;
  try{
    return await Promise.race([
      reader.read(),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Stream tidak mengirim data selama 60 detik. Unduhan dihentikan agar tidak menggantung.")),idleMs);})
    ]);
  }finally{if(timer)clearTimeout(timer);}
}
function socialMimeForExtension(ext,mode){
  const map={mp4:"video/mp4",webm:"video/webm",mov:"video/quicktime",m4v:"video/mp4",avi:"video/x-msvideo","3gp":"video/3gpp",mp3:"audio/mpeg",m4a:"audio/mp4",aac:"audio/aac",opus:"audio/ogg",ogg:"audio/ogg",wav:"audio/wav",flac:"audio/flac"};
  const mime=map[ext]||"";
  return mime&&mime.startsWith(mode==="audio"?"audio/":"video/")?{mime,ext,mode}:null;
}
async function socialMediaFile(request){
  const u=new URL(request.url),raw=u.searchParams.get("url")||"",source=u.searchParams.get("source")||"",mode=u.searchParams.get("mode")==="audio"?"audio":"video",requestedExt=String(u.searchParams.get("ext")||"mp4").toLowerCase(),filename=u.searchParams.get("filename")||"aryanzz-media",probe=u.searchParams.get("probe")==="1",preview=u.searchParams.get("preview")==="1";
  const mediaUrl=safePublicMediaUrl(raw);
  if(!mediaUrl)return json({error:"Alamat media tidak valid atau tidak aman."},400);
  if(!isPlatformLink(source))return json({error:"Tautan sumber platform tidak valid."},400);
  if(!["mp4","webm","mov","m4v","avi","3gp","mp3","m4a","aac","opus","ogg","wav","flac"].includes(requestedExt))return json({error:"Ekstensi media tidak didukung."},400);
  const browserRange=request.headers.get("range");
  const rangeToRequest=browserRange||(probe?"bytes=0-65535":null);
  const expectedHint=Math.floor(Number(u.searchParams.get("expected"))||0);
  if(expectedHint<0||expectedHint>500*1024*1024)return json({error:"Ukuran file yang diminta tidak valid."},400);
  let upstream=null,lastError="";
  try{upstream=await fetchSocialUpstream(mediaUrl,source,rangeToRequest)}catch(error){lastError=String(error?.message||error).slice(0,160)}
  if(!upstream||![200,206].includes(upstream.status)||!upstream.body){
    if(upstream?.body)await upstream.body.cancel().catch(()=>{});
    const fallback=new URL("/api/fetch-media",FREE_MEDIA_API);
    fallback.searchParams.set("url",mediaUrl.href);
    fallback.searchParams.set("filename",socialFileName(filename,requestedExt));
    const fallbackHeaders={accept:"*/*","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"};
    if(rangeToRequest)fallbackHeaders.range=rangeToRequest;
    try{
      upstream=await fetchSocialHeaders(fallback.href,{headers:fallbackHeaders,cache:"no-store"});
    }catch(error){return json({error:"CDN media dan jalur cadangan provider gagal. "+(lastError||String(error?.message||error).slice(0,120))},502)}
  }
  if(!upstream||![200,206].includes(upstream.status)||!upstream.body)return json({error:"Provider tidak mengirim file media utuh (HTTP "+(upstream?.status||502)+")."},502);
  if(upstream.status===206&&!rangeToRequest){await upstream.body.cancel().catch(()=>{});return json({error:"Provider hanya mengirim sebagian file tanpa permintaan rentang yang diminta."},502);}
  const rawType=String(upstream.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(/^(text\/|application\/(json|xml)|application\/x-mpegurl)/i.test(rawType)){
    await upstream.body.cancel().catch(()=>{});
    return json({error:"Provider mengirim halaman error atau daftar putar, bukan file video/audio."},502);
  }
  const reader=upstream.body.getReader(),parts=[];
  let prefixLength=0,finished=false;
  try{
    while(prefixLength<65536){
      const part=await readSocialChunk(reader);
      if(part.done){finished=true;break;}
      parts.push(part.value);prefixLength+=part.value.byteLength;
    }
  }catch(error){await reader.cancel().catch(()=>{});return json({error:"Gagal membaca awal file media: "+String(error?.message||error).slice(0,160)},502)}
  const prefix=new Uint8Array(prefixLength);let offset=0;
  for(const part of parts){prefix.set(part,offset);offset+=part.byteLength;}
  const rangeHeader=upstream.headers.get("content-range")||"";
  const rangeMatch=rangeHeader.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  const rangeStart=rangeMatch?Number(rangeMatch[1]):0;
  const rangeEnd=rangeMatch?Number(rangeMatch[2]):0;
  const rangeTotal=rangeMatch?Number(rangeMatch[3])||0:0;
  const contentLength=Number(upstream.headers.get("content-length")||0)||0;
  const responseIsPartial=upstream.status===206;
  const expectedBytes=responseIsPartial?(contentLength||Math.max(0,rangeEnd-rangeStart+1)):(contentLength||expectedHint);
  const totalBytes=rangeTotal||(!responseIsPartial?expectedBytes:0)||expectedHint||0;
  let detected=null;
  if(preview){
    detected=socialMimeForExtension(requestedExt,mode);
    if(rangeStart===0&&prefixLength>=8){const signature=detectSocialMediaSignature(prefix,mode);if(!signature||signature.mime!==detected?.mime)detected=null;}
  }else if(rangeStart===0||!responseIsPartial)detected=detectSocialMediaSignature(prefix,mode);
  else if(responseIsPartial)detected=socialMimeForExtension(requestedExt,mode);
  if(!detected||detected.mode!==mode){
    await reader.cancel().catch(()=>{});
    return json({error:"File ditolak: isi file tidak cocok dengan video/audio yang diminta. ARYANZZ tidak akan menyimpan file rusak dengan ekstensi palsu."},415);
  }
  if(responseIsPartial&&!rangeMatch){
    await reader.cancel().catch(()=>{});
    return json({error:"Provider mengirim respons rentang tanpa Content-Range yang valid."},502);
  }
  if(finished&&expectedBytes&&prefixLength!==expectedBytes){
    await reader.cancel().catch(()=>{});
    return json({error:"File media terpotong: provider menyatakan "+expectedBytes+" byte tetapi hanya mengirim "+prefixLength+" byte."},502);
  }
  const actualFilename=socialFileName(filename,detected.ext);
  if(probe){
    await reader.cancel().catch(()=>{});
    return json({ok:true,valid:true,mimeType:detected.mime,extension:detected.ext,bytes:totalBytes||null,rangeSupported:responseIsPartial,contentRange:rangeHeader||null,filename:actualFilename,signature:"valid"});
  }
  let received=prefixLength;
  const body=new ReadableStream({
    async pull(controller){
      if(prefixLength>=0){
        if(prefixLength!==-1){prefixLength=-1;if(prefix.length)controller.enqueue(prefix);return;}
      }
      if(finished){
        if(expectedBytes&&received!==expectedBytes){controller.error(new Error("Unduhan terputus: diterima "+received+" dari "+expectedBytes+" byte."));return;}
        controller.close();return;
      }
      try{
        const part=await readSocialChunk(reader);
        if(part.done){
          finished=true;
          if(expectedBytes&&received!==expectedBytes){controller.error(new Error("Unduhan terputus: diterima "+received+" dari "+expectedBytes+" byte."));return;}
          controller.close();return;
        }
        received+=part.value.byteLength;
        if(expectedBytes&&received>expectedBytes){controller.error(new Error("Provider mengirim data melebihi ukuran file yang dilaporkan."));return;}
        controller.enqueue(part.value);
      }catch(error){controller.error(error);await reader.cancel().catch(()=>{});}
    },
    async cancel(reason){await reader.cancel(reason).catch(()=>{});}
  });
  const headers=new Headers({
    "content-type":detected.mime,
    "content-disposition":(preview?"inline":"attachment")+"; filename*=UTF-8''"+encodeURIComponent(actualFilename),
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "x-aryanzz-media-validation":"signature-ok"
  });
  if(expectedBytes)headers.set("content-length",String(expectedBytes));
  if(upstream.headers.get("accept-ranges")||responseIsPartial)headers.set("accept-ranges","bytes");
  else headers.set("accept-ranges","none");
  if(responseIsPartial&&rangeHeader)headers.set("content-range",rangeHeader);
  return new Response(body,{status:responseIsPartial?206:200,headers});
}
async function proxyPlatform(request,env,path){
  let body;try{body=await request.clone().json()}catch{return json({error:"Body JSON tidak valid."},400)}
  if(!isPlatformLink(body?.url))return null;
  try{parseMediaUrl(body.url);return null}catch{}
  if(!env.PLATFORM_API_ORIGIN||!env.PLATFORM_API_TOKEN){if(socialRateLimited(request))return json({error:"Batas unduhan gratis tercapai. Tunggu satu menit lalu coba lagi."},429);return freePublicMediaInfo(body.url,request.url);}
  let origin;try{const parsed=new URL(env.PLATFORM_API_ORIGIN);if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new Error("origin tidak aman");origin=parsed.origin}catch{return json({error:"Konfigurasi backend harus berupa URL HTTPS yang valid."},500)}
  try{
    const response=await fetch(origin+path,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
    return new Response(response.body,{status:response.status,headers:{"content-type":response.headers.get("content-type")||"application/json","content-disposition":response.headers.get("content-disposition")||"","cache-control":"no-store"}});
  }catch{return json({error:"Backend ekstraksi sedang tidak dapat dijangkau."},502)}
}
async function platformStatus(env){
  const platforms=[
    {id:"youtube",domains:["youtube.com","youtu.be"],pasteLink:true,titleSearch:true,preview:"hybrid",mediaModes:["video","audio"],mp4:"hybrid-provider-dependent"},
    {id:"tiktok",domains:["tiktok.com","vm.tiktok.com","vt.tiktok.com"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"instagram",domains:["instagram.com","instagr.am"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"snackvideo",domains:["snackvideo.com"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"capcut",domains:["capcut.com"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"pinterest",domains:["pinterest.com","pin.it"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"facebook",domains:["facebook.com","fb.watch"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"x",domains:["x.com","twitter.com"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"reddit",domains:["reddit.com","redd.it","v.redd.it"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video","audio"],mp4:"provider-dependent"},
    {id:"vimeo",domains:["vimeo.com"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"threads",domains:["threads.net"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["video"],mp4:"provider-dependent"},
    {id:"soundcloud",domains:["soundcloud.com"],pasteLink:true,titleSearch:true,preview:"range-proxy",mediaModes:["audio"],mp4:"not-applicable"}
  ];
  return json({ok:true,configured:false,backend:"public-community-api",mode:"zero-server",engine:"Cloudflare Worker + public free community extractor",platforms,liveAvailability:"Jalur tiap platform tersedia; hasil nyata tetap bergantung pada provider, visibilitas konten, dan format yang disediakan.",message:"12 platform dikenali untuk tempel tautan atau pencarian judul. Video hanya ditawarkan sebagai MP4 jika provider benar-benar menyediakan MP4 yang valid; SoundCloud diperlakukan sebagai audio, bukan MP4. Konten privat, tautan kedaluwarsa, dan file yang tidak diekspos oleh sumber tidak dapat diekstrak."});
}
function decodeSearchHtml(value){
  return String(value||"").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g," ").trim();
}
function socialSearchDomains(platform){
  const map={tiktok:["tiktok.com"],tiktoklite:["tiktok.com"],instagram:["instagram.com","instagr.am"],instagramlite:["instagram.com","instagr.am"],snackvideo:["snackvideo.com"],pinterest:["pinterest.com"],facebook:["facebook.com","fb.watch"],facebooklite:["facebook.com","fb.watch"],x:["x.com","twitter.com"],reddit:["reddit.com"],vimeo:["vimeo.com"],threads:["threads.net"],soundcloud:["soundcloud.com"],capcut:["capcut.com"],snapchat:["snapchat.com"],idnapp:["idntimes.com"],linkedin:["linkedin.com"],wechat:["wechat.com","weixin.qq.com"],kakaotalk:["kakao.com"],youtube:["youtube.com","youtu.be"]};
  if(platform==="all")return [...new Set(Object.values(map).flat())];
  return map[platform]||[];
}
function socialSearchUrl(platform,query){
  const domains=socialSearchDomains(platform);if(!domains.length)return null;
  const site=domains.map(domain=>"site:"+domain).join(" OR ");
  const url=new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q",site+" "+query);
  return url;
}
async function verifySocialSearchResult(result,requestUrl){
  const key=freePlatformKey(result.url);
  if(!key)return {...result,verified:false,downloadable:false,searchOnly:true,channel:"Hasil publik"};
  const endpoint=FREE_MEDIA_API+"/api/download/"+key+"?url="+encodeURIComponent(result.url);
  try{
    const response=await fetch(endpoint,{headers:{accept:"application/json"},signal:AbortSignal.timeout(9000),cache:"no-store"});
    if(!response.ok)return null;
    const data=await response.json().catch(()=>({}));
    if(data?.success===false)return null;
    const info=freeProviderMediaInfo(data,result.url,requestUrl);
    const playableFormats=(info?.formats||[]).filter(item=>item.previewUrl&&item.downloadUrl&&!item.videoOnly);
    const playable=key==="soundcloud"
      ?playableFormats.find(item=>item.mode==="audio"&&["mp3","m4a","aac","opus","ogg","wav","flac"].includes(item.ext))
      :playableFormats.find(item=>item.mode==="video"&&["mp4","m4v"].includes(item.ext))||playableFormats.find(item=>item.mode==="audio"&&["mp3","m4a"].includes(item.ext));
    if(!playable)return null;
    const probeUrl=new URL(playable.downloadUrl);probeUrl.searchParams.set("probe","1");
    const mediaCheck=await socialMediaFile(new Request(probeUrl.href));
    const mediaData=await mediaCheck.json().catch(()=>({}));
    if(!mediaCheck.ok||!mediaData.valid)return null;
    return {...result,title:result.title||info.title,mediaTitle:info.title||"",thumbnail:info.thumbnail||null,duration:info.duration||null,verified:true,downloadable:true,mediaMode:playable.mode,extension:mediaData.extension,mediaType:mediaData.mimeType};
  }catch{return null}
}
function socialSearchCandidateAllowed(platform,rawUrl){
  const link=safePublicMediaUrl(rawUrl);if(!link)return null;
  if(!socialSearchDomains(platform).some(domain=>link.hostname===domain||link.hostname.endsWith("."+domain)))return null;
  if(platform==="instagram"&&!/(?:^|\/)(?:p|reel|tv|share)\//i.test(link.pathname))return null;
  if(platform==="tiktok"&&!/\/video\//i.test(link.pathname))return null;
  if(platform==="pinterest"&&!/\/pin\//i.test(link.pathname))return null;
  return link;
}
function parseBingSocialCandidates(html,platform){
  const out=[],seen=new Set();
  for(const block of String(html||"").matchAll(/<li\b[^>]*class=["'][^"']*b_algo[^"']*["'][^>]*>[\s\S]*?<\/li>/gi)){
    const anchor=block[0].match(/<h2\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    if(!anchor)continue;
    const href=anchor[1].match(/\bhref=["']([^"']+)["']/i)?.[1];if(!href)continue;
    let url;try{url=new URL(decodeSearchHtml(href))}catch{continue}
    const safe=socialSearchCandidateAllowed(platform,url.href);if(!safe||seen.has(safe.href))continue;
    const title=decodeSearchHtml(anchor[2].replace(/<[^>]+>/g," ")).trim();if(!title)continue;
    const snippet=decodeSearchHtml((block[0].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]||"").replace(/<[^>]+>/g," ")).trim();
    seen.add(safe.href);out.push({title,url:safe.href,snippet,searchEngine:"Bing"});
    if(out.length>=12)break;
  }
  return out;
}
async function searchSocial(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const platform=String(body?.platform||"").toLowerCase(),query=String(body?.query||"").replace(/\s+/g," ").trim();
  if(!socialSearchDomains(platform).length||platform==="youtube")return json({error:"Platform pencarian belum didukung."},400);
  if(query.length<2||query.length>120)return json({error:"Masukkan judul antara 2 sampai 120 karakter."},400);
  if(socialRateLimited(request))return json({error:"Batas pencarian gratis tercapai. Tunggu satu menit lalu coba lagi."},429);
  const normalized=canonicalPublicSearchQuery(query),ddgUrl=socialSearchUrl(platform,normalized);
  const bingUrl=new URL("https://www.bing.com/search");bingUrl.searchParams.set("q",socialSearchDomains(platform).map(domain=>"site:"+domain).join(" OR ")+" "+normalized);
  const headers={accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"};
  const candidates=[],seen=new Set();let providerErrors=[];
  const add=(items)=>{for(const item of items){const safe=socialSearchCandidateAllowed(platform,item.url);if(!safe||seen.has(safe.href))continue;seen.add(safe.href);const score=publicSearchRelevance(query,[item.title,item.snippet].filter(Boolean).join(" "));if(score>=0.16)candidates.push({...item,url:safe.href,__score:score})}};
  try{
    try{
      const response=await fetch(ddgUrl.href,{headers,signal:AbortSignal.timeout(10000),cache:"no-store"});
      if(response.ok){
        const html=await response.text();
        for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
          const attrs=match[1]||"";if(!/\bclass=["'][^"']*\bresult__a\b[^"']*["']/i.test(attrs))continue;
          const href=attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];if(!href)continue;
          let link;try{link=new URL(decodeSearchHtml(href),"https://html.duckduckgo.com")}catch{continue}
          if(link.hostname.endsWith("duckduckgo.com")){const target=link.searchParams.get("uddg");if(target){try{link=new URL(target)}catch{continue}}}
          const safe=socialSearchCandidateAllowed(platform,link.href);if(!safe)continue;
          const title=decodeSearchHtml(match[2].replace(/<[^>]+>/g," ")).trim();
          const snippet=decodeSearchHtml(html.slice(match.index,match.index+1800).match(/class=["']result__snippet["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1]||"");
          add([{title,url:safe.href,snippet,searchEngine:"DuckDuckGo"}]);
          if(candidates.length>=12)break;
        }
      }else providerErrors.push("DuckDuckGo HTTP "+response.status);
    }catch(error){providerErrors.push("DuckDuckGo: "+String(error?.message||error).slice(0,80))}
    if(candidates.length===0){
      try{
        const response=await fetch(bingUrl.href,{headers,signal:AbortSignal.timeout(10000),cache:"no-store"});
        if(response.ok)add(parseBingSocialCandidates(await response.text(),platform));
        else providerErrors.push("Bing HTTP "+response.status);
      }catch(error){providerErrors.push("Bing: "+String(error?.message||error).slice(0,80))}
    }
    candidates.sort((a,b)=>b.__score-a.__score);
    const selected=candidates.slice(0,12);
    const checked=await Promise.all(selected.map(async item=>{
      const {__score,...candidate}=item;
      const verified=await verifySocialSearchResult(candidate,request.url);
      if(verified)return {...verified,sourceTitle:candidate.title,searchOnly:false,searchEngine:candidate.searchEngine};
      return {...candidate,sourceTitle:candidate.title,channel:platform==="tiktok"?"TikTok":platform,verified:false,downloadable:false,searchOnly:true,searchEngine:candidate.searchEngine};
    }));
    const results=checked.map(item=>({...item,searchScore:publicSearchRelevance(query,[item.sourceTitle,item.title,item.snippet,item.mediaTitle].filter(Boolean).join(" "))}))
      .filter(item=>item.searchScore>=0.16)
      .sort((a,b)=>b.searchScore-a.searchScore);
    return json({ok:true,platform,query,normalizedQuery:normalized,results,verifiedCount:results.filter(item=>item.verified).length,searchOnlyCount:results.filter(item=>item.searchOnly).length,unavailableCount:Math.max(0,selected.length-results.length),providers:["DuckDuckGo","Bing"],providerErrors:results.length?[]:providerErrors,verification:"provider-optional; public-source-results-retained"});
  }catch(error){return json({error:"Pencarian publik gagal dijangkau. Coba lagi nanti. "+String(error?.message||error).slice(0,100)},502)}
}

function imageSafeFilename(title,index,ext){
  const base=String(title||"aryanzz-image").replace(/[\\/:*?"<>|\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,72)||"aryanzz-image";
  return base+"-"+String(index+1)+"."+ext;
}
function imageProxyLinks(imageUrl,sourceUrl,requestUrl,title,index){
  const imageParsed=new URL(imageUrl);
  const ext=(imageParsed.pathname.match(/\.(jpe?g|png|webp|gif|avif|bmp)$/i)||[])[1]||String(imageParsed.searchParams.get("format")||"jpg").replace(/[^a-z]/gi,"").slice(0,5)||"jpg";
  const filename=imageSafeFilename(title,index,ext.toLowerCase());
  const make=(preview)=>{
    const u=new URL("/api/image/file",requestUrl);
    u.searchParams.set("url",imageUrl);
    if(sourceUrl)u.searchParams.set("source",sourceUrl);
    u.searchParams.set("filename",filename);
    if(preview)u.searchParams.set("preview","1");
    return u.href;
  };
  return {url:imageUrl,previewUrl:make(true),downloadUrl:make(false),filename};
}
function imageTagAttributes(tag){
  const attrs={};
  for(const match of String(tag||"").matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)){
    attrs[String(match[1]).toLowerCase()]=decodeSearchHtml(match[2]??match[3]??match[4]??"");
  }
  return attrs;
}
function extractPublicImageUrls(html,baseUrl){
  const found=[],seen=new Set();
  const add=(raw)=>{
    if(!raw)return;
    let url;try{url=new URL(decodeSearchHtml(raw).replace(/\\u0026/g,"&"),baseUrl)}catch{return}
    const safe=safePublicMediaUrl(url.href);
    if(!safe)return;
    if(seen.has(safe.href))return;seen.add(safe.href);found.push(safe.href);
  };
  for(const tag of String(html||"").matchAll(/<meta\b[^>]*>/gi)){
    const attrs=imageTagAttributes(tag[0]);
    const key=String(attrs.property||attrs.name||attrs.itemprop||"").toLowerCase();
    if(["og:image","og:image:url","og:image:secure_url","twitter:image","twitter:image:src","image"].includes(key))add(attrs.content||attrs.href);
  }
  for(const tag of String(html||"").matchAll(/<img\b[^>]*>/gi)){
    if(found.length>=12)break;
    const attrs=imageTagAttributes(tag[0]);
    add(attrs["data-src"]||attrs["data-lazy-src"]||attrs.src);
  }
  return found.slice(0,12);
}
async function imagePostMetadata(rawUrl,requestUrl){
  const input=safePublicMediaUrl(rawUrl);
  if(!input)return {ok:false,error:"Tautan harus HTTPS dan berasal dari alamat publik yang aman."};
  if(!isPlatformLink(input.href)){
    let title=input.pathname.split("/").pop()||"Gambar";try{title=decodeURIComponent(title)}catch{}
    return {ok:true,title,platform:"Direct image",images:[{...imageProxyLinks(input.href,"",requestUrl,title,0),title,platform:"Direct image",sourceUrl:""}]};
  }
  try{
    const response=await fetch(input.href,{headers:{accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"},redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!response.ok)return {ok:false,error:"Postingan tidak dapat dibuka secara publik (HTTP "+response.status+")."};
    const finalUrl=safePublicMediaUrl(response.url||input.href);
    if(!finalUrl||!isPlatformLink(finalUrl.href))return {ok:false,error:"Tautan dialihkan ke alamat yang tidak diizinkan."};
    const html=(await response.text()).slice(0,2500000);
    const titleTag=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const titleMatch=html.match(/<meta\b[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*>/i);
    const titleAttrs=titleMatch?imageTagAttributes(titleMatch[0]):{};
    const title=String(titleAttrs.content||decodeSearchHtml(titleTag?.[1]||"Postingan gambar")).slice(0,180);
    const imageUrls=extractPublicImageUrls(html,finalUrl.href);
    const platform=freePlatformKey(finalUrl.href)||"social";
    const images=imageUrls.map((url,index)=>({...imageProxyLinks(url,finalUrl.href,requestUrl,title,index),title,platform,sourceUrl:finalUrl.href}));
    return {ok:true,title,platform,sourceUrl:finalUrl.href,images};
  }catch(error){return {ok:false,error:"Platform tidak mengizinkan pembacaan otomatis atau sedang membatasi akses. "+String(error?.message||error).slice(0,100)}}
}
async function imageExtractV81(request){
  const raw=new URL(request.url).searchParams.get("url")||"";
  const parsedInput=(()=>{try{const u=new URL(raw);if(u.protocol==="http:"&&isPlatformLink(u.href))u.protocol="https:";return safePublicMediaUrl(u.href)}catch{return null}})();
  const input=parsedInput;
  if(!input)return json({ok:false,error:"Tautan harus HTTPS dan berasal dari alamat publik yang aman."},400);
  if(!isPlatformLink(input.href)){
    const direct=await imagePostMetadata(input.href,request.url);
    return direct.ok?json(direct):json(direct,502);
  }
  const post=await resolveSocialImagePost(input.href,request.url);
  if(!post)return json({ok:false,error:"Belum ditemukan file gambar asli pada postingan publik ini. Postingan mungkin berisi video, privat, memerlukan login, atau membatasi akses gambar."},404);
  const canonicalSourceUrl=post.url||input.href;
  const images=post.images.map(image=>({...image,sourceUrl:canonicalSourceUrl,platform:post.platform,title:post.title}));
  return json({ok:true,title:post.title,platform:post.platform,sourceUrl:canonicalSourceUrl,images});
}
async function imageExtract(request){
  const raw=new URL(request.url).searchParams.get("url")||"";
  const result=await imagePostMetadata(raw,request.url);
  return result.ok?json(result):json(result,502);
}
async function imageFile(request){
  const u=new URL(request.url),raw=u.searchParams.get("url")||"",source=u.searchParams.get("source")||"",filename=String(u.searchParams.get("filename")||"aryanzz-image.jpg").replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_").slice(0,120),preview=u.searchParams.get("preview")==="1";
  let current=safePublicMediaUrl(raw);
  if(!current)return json({error:"URL gambar tidak valid atau bukan HTTPS publik."},400);
  if(source&&!isPlatformLink(source))return json({error:"Tautan sumber postingan tidak valid."},400);
  let upstream=null;
  try{
    for(let hop=0;hop<4;hop++){
      upstream=await fetch(current.href,{headers:{accept:"image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.7",...(source?{referer:source}: {})},redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(18000)});
      if([301,302,303,307,308].includes(upstream.status)){
        const location=upstream.headers.get("location");await upstream.body?.cancel().catch(()=>{});
        if(!location) return json({error:"Alamat gambar mengalihkan tanpa tujuan."},502);
        const next=safePublicMediaUrl(new URL(location,current.href).href);
        if(!next)return json({error:"Pengalihan gambar menuju alamat yang tidak aman."},400);
        current=next;continue;
      }
      break;
    }
  }catch(error){return json({error:"Gagal mengambil gambar dari sumber: "+String(error?.message||error).slice(0,120)},502)}
  if(!upstream||!upstream.ok||!upstream.body)return json({error:"File gambar tidak tersedia (HTTP "+(upstream?.status||502)+")."},502);
  const mime=String(upstream.headers.get("content-type")||"").split(";")[0].toLowerCase();
  if(!["image/jpeg","image/png","image/webp","image/gif","image/avif","image/bmp"].includes(mime)){await upstream.body.cancel().catch(()=>{});return json({error:"Sumber tidak mengirim file gambar yang didukung."},415)}
  const size=Number(upstream.headers.get("content-length")||0);
  if(size>25*1024*1024){await upstream.body.cancel().catch(()=>{});return json({error:"Gambar melebihi batas 25 MB."},413)}
  const extension=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/avif":"avif","image/bmp":"bmp"})[mime]||"jpg";
  const cleanBase=filename.replace(/\.[^.]+$/,"");
  const finalFilename=cleanBase+"."+extension;
  const headers=new Headers({"content-type":mime,"content-disposition":(preview?"inline":"attachment")+"; filename*=UTF-8''"+encodeURIComponent(finalFilename),"cache-control":"no-store","x-content-type-options":"nosniff","accept-ranges":"none"});
  if(size)headers.set("content-length",String(size));
  const maxImageBytes=25*1024*1024;
  let streamedBytes=0;
  const limitedBody=upstream.body.pipeThrough(new TransformStream({
    transform(chunk,controller){
      streamedBytes+=chunk.byteLength;
      if(streamedBytes>maxImageBytes){controller.error(new Error("Gambar melebihi batas 25 MB."));return;}
      controller.enqueue(chunk);
    }
  }));
  return new Response(limitedBody,{status:200,headers});
}
async function searchSocialImages(request){return socialImageSearch(request);}

const SOCIAL_IMAGE_EXTENSIONS=new Set(["jpg","jpeg","png","webp","gif","avif","bmp"]);
const SOCIAL_IMAGE_PROXY_BUCKETS=new Map();
function socialImageProxyRateLimited(request){
  const ip=request.headers.get("cf-connecting-ip")||"unknown",now=Date.now();let bucket=SOCIAL_IMAGE_PROXY_BUCKETS.get(ip);
  if(!bucket||now-bucket.started>=60000)bucket={started:now,count:0};bucket.count++;SOCIAL_IMAGE_PROXY_BUCKETS.set(ip,bucket);
  if(SOCIAL_IMAGE_PROXY_BUCKETS.size>1200)for(const [key,value] of SOCIAL_IMAGE_PROXY_BUCKETS)if(now-value.started>=60000)SOCIAL_IMAGE_PROXY_BUCKETS.delete(key);
  return bucket.count>80;
}
function imageExtensionFromUrl(raw){
  try{const ext=(new URL(raw).pathname.match(/\.([a-z0-9]{2,5})$/i)||[])[1]?.toLowerCase()||"";return SOCIAL_IMAGE_EXTENSIONS.has(ext)?(ext==="jpeg"?"jpg":ext):""}catch{return ""}
}
function socialImageProxyUrl(raw,requestUrl,filename,download=false,sourceUrl=""){
  const safe=safePublicMediaUrl(raw);if(!safe)return null;
  const out=new URL("/api/social-image-file",requestUrl);out.searchParams.set("url",safe.href);
  out.searchParams.set("filename",String(filename||"aryanzz-image").slice(0,100));
  const source=safePublicMediaUrl(sourceUrl);if(source)out.searchParams.set("source",source.href);
  if(download)out.searchParams.set("download","1");
  return out.href;
}
function collectImageUrls(value,output,depth=0,forceImage=false){
  if(depth>6||value==null)return;
  if(typeof value==="string"){
    const candidate=value.replace(/\\u0026/g,"&").replace(/\\u003d/g,"=").replace(/\\\//g,"/");
    if(/^https?:\/\//i.test(candidate)&&(forceImage||/\.(?:jpe?g|png|webp|gif|avif|bmp)(?:[?#]|$)/i.test(candidate)||/image|photo|picture/i.test(candidate)))output.push(candidate);
    return;
  }
  if(Array.isArray(value)){for(const item of value.slice(0,80))collectImageUrls(item,output,depth+1,forceImage);return}
  if(typeof value==="object"){
    for(const key of ["url","contentUrl","image","images","photo","photos","picture","pictures","src","display_url","download_url","image_url","original","large","thumbnail_src","media_url","media_url_https"]){
      if(value[key]!==undefined)collectImageUrls(value[key],output,depth+1,["image","images","photo","photos","picture","pictures","image_url"].includes(key)||forceImage);
    }
  }
}
function extractSocialImageCandidates(html,pageUrl,platform){
  const found=[],seen=new Set(),jsonImages=[];
  const add=(raw,source="metadata")=>{
    const value=String(raw||"").replace(/&amp;/g,"&").replace(/\\u0026/g,"&").replace(/\\\//g,"/").trim();
    const safe=safePublicMediaUrl(value);if(!safe||seen.has(safe.href))return;
    if(!imageExtensionFromUrl(safe.href)&&source==="html-image"&&!/image|photo|picture|media/i.test(safe.hostname+safe.pathname))return;
    if(/\.(?:svg|ico)(?:[?#]|$)/i.test(safe.href))return;
    if(/(?:avatar|profile|favicon|logo|emoji|sprite|icon)(?:[._/-]|$)/i.test(safe.href))return;
    seen.add(safe.href);found.push({url:safe.href,source});
  };
  const metaTags=html.match(/<meta\b[^>]*>/gi)||[];
  const meta={};
  for(const tag of metaTags){
    const attrs={};for(const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4]??"";
    const key=String(attrs.property||attrs.name||"").toLowerCase(),content=attrs.content||"";
    if(key&&content)meta[key]=content;
    if(["og:image","og:image:secure_url","twitter:image","twitter:image:src","image"].includes(key))add(content,"metadata");
  }
  const linkTags=html.match(/<link\b[^>]*>/gi)||[];
  for(const tag of linkTags){
    if(!/rel\s*=\s*["'][^"']*image_src/i.test(tag))continue;
    const m=tag.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)')/i);if(m)add(m[1]||m[2],"metadata");
  }
  const scripts=html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
  for(const script of scripts){
    const body=script.replace(/^<script\b[^>]*>/i,"").replace(/<\/script>$/i,"").replace(/&quot;/g,'"').trim();
    try{const parsed=JSON.parse(body);collectImageUrls(parsed,jsonImages)}catch{}
  }
  for(const raw of jsonImages)add(raw,"jsonld");
  const hasVideoMeta=!!(meta["og:video"]||meta["og:video:url"]||meta["twitter:player"]||meta["og:type"]==="video.other"||meta["og:type"]==="video");
  const imageTags=html.match(/<img\b[^>]*>/gi)||[];
  for(const tag of imageTags){
    const attrs={};for(const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4]??"";
    const w=Number(attrs.width||0),h=Number(attrs.height||0),src=attrs.src||attrs["data-src"]||attrs["data-original"]||"";
    if(src&&(w>=180&&h>=180||imageExtensionFromUrl(src)))try{add(new URL(src,pageUrl).href,"html-image")}catch{}
    const srcset=attrs.srcset||"";for(const part of srcset.split(",")){const url=part.trim().split(/\s+/)[0];if(url)try{add(new URL(url,pageUrl).href,"html-image")}catch{}}
  }
  if(hasVideoMeta&&platform!=="pinterest"&&platform!=="reddit"){
    const explicitPhoto=/photo.?mode|image.?post|carousel|multi.?photo|gallery|photo_mode|image_post/i.test(html);
    if(!explicitPhoto)return [];
  }
  return found.slice(0,24);
}
async function fetchSocialPostHtml(pageUrl,timeoutMs=18000){
  let current=safePublicMediaUrl(pageUrl);if(!current)throw new Error("Tautan postingan harus HTTPS dan tidak boleh mengarah ke jaringan lokal.");
  for(let hop=0;hop<6;hop++){
    const response=await fetchSocialHeaders(current.href,{headers:{
      accept:"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36"
    },redirect:"manual",cache:"no-store"},timeoutMs);
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get("location");if(!location)throw new Error("Pengalihan postingan tidak memiliki alamat tujuan.");
      const next=safePublicMediaUrl(new URL(location,current.href).href);
      if(!next)throw new Error("Pengalihan postingan menuju alamat yang tidak aman.");
      current=next;continue;
    }
    if(!response.ok)throw new Error("Halaman sumber menjawab HTTP "+response.status+".");
    const contentType=String(response.headers.get("content-type")||"").toLowerCase();
    if(contentType&&!contentType.includes("text/html")&&!contentType.includes("application/xhtml"))throw new Error("Sumber bukan halaman postingan HTML.");
    const length=Number(response.headers.get("content-length")||0);
    if(length>5*1024*1024){await response.body?.cancel().catch(()=>{});throw new Error("Halaman sumber terlalu besar untuk diproses.");}
    if(!response.body)return {html:"",url:current.href};
    const reader=response.body.getReader(),chunks=[];let total=0;
    try{
      while(total<5*1024*1024){
        const {done,value}=await reader.read();if(done)break;
        total+=value.byteLength;if(total>5*1024*1024){await reader.cancel();break;}
        chunks.push(value);
      }
    }finally{reader.releaseLock?.()}
    const bytes=new Uint8Array(Math.min(total,5*1024*1024));let offset=0;
    for(const chunk of chunks){const part=chunk.subarray(0,Math.max(0,bytes.length-offset));bytes.set(part,offset);offset+=part.byteLength;if(offset>=bytes.length)break}
    return {html:new TextDecoder().decode(bytes),url:current.href};
  }
  throw new Error("Terlalu banyak pengalihan dari halaman postingan.");
}
function providerImageCandidates(data){
  const output=[],n=data?.normalized||{},r=data?.result||{};
  const add=(list,assumeImage)=>{
    if(!Array.isArray(list))return;
    for(const item of list.slice(0,80)){
      if(typeof item==="string"){if(assumeImage)output.push({url:item,type:"image"});continue}
      if(!item||typeof item!=="object")continue;
      const url=item.url||item.image_url||item.download_url||item.src||item.display_url||item.media_url||item.media_url_https;
      const ext=String(item.ext||item.extension||imageExtensionFromUrl(url||"")).toLowerCase();
      const mime=String(item.mime_type||item.mime||item.content_type||"").toLowerCase();
      const explicit=String(item.type||item.kind||item.media_type||"").toLowerCase();
      const isVideo=explicit==="video"||explicit==="audio"||mime.startsWith("video/")||mime.startsWith("audio/")||/\.(?:mp4|m4v|mov|webm|mkv|mp3|m4a|aac|opus)(?:[?#]|$)/i.test(String(url||""));
      const inferred=!isVideo&&(assumeImage||explicit==="image"||explicit==="photo"||explicit==="picture"||mime.startsWith("image/")||SOCIAL_IMAGE_EXTENSIONS.has(ext));
      output.push({...item,url,type:isVideo?"video":inferred?"image":explicit});
    }
  };
  for(const list of [n.images,n.photos,n.pictures,n.gallery,r.images,r.photos,r.pictures,r.gallery,n.carousel,r.carousel])add(list,true);
  for(const list of [n.media,r.media])add(list,false);
  for(const item of [n.image,n.image_url,n.imageUrl,n.photo,n.photo_url,r.image,r.image_url,r.imageUrl,r.photo,r.photo_url]){
    if(typeof item==="string")output.push({url:item,type:"image"});
    else if(item&&typeof item==="object")output.push({...item,url:item.url||item.image_url||item.src,type:"image"});
  }
  return output;
}
async function resolveSocialImagePost(rawUrl,requestUrl,options={}){
  const key=freePlatformKey(rawUrl);if(!key)return null;
  let providerTitle="",providerImages=[];
  const providerUrl=FREE_MEDIA_API+"/api/download/"+key+"?url="+encodeURIComponent(rawUrl);
  const includeProvider=options.includeProvider!==false;
  const tasks=[
    includeProvider?fetch(providerUrl,{headers:{accept:"application/json"},signal:AbortSignal.timeout(Number(options.providerTimeoutMs)||14000),cache:"no-store"}).then(async response=>{
      if(!response.ok)throw new Error("Provider gambar HTTP "+response.status);
      const data=await response.json().catch(()=>({}));
      if(data?.success===false)throw new Error("Provider tidak mendukung konten gambar ini.");
      providerTitle=String(data?.normalized?.title||data?.result?.title||data?.result?.caption||"").slice(0,240);
      providerImages=providerImageCandidates(data);
    }).catch(()=>{}):Promise.resolve(),
    fetchSocialPostHtml(rawUrl,Number(options.timeoutMs)||18000).then(page=>{
      const images=extractSocialImageCandidates(page.html,page.url,key);
      return {html:page.html,url:page.url,images};
    }).catch(()=>null)
  ];
  const page=await tasks[1];
  await tasks[0];
  const rawCandidates=[...(page?.images||[]).map(item=>({...item,type:"image",source:item.source||"post-page"})),...providerImages.map(item=>({...item,url:item.url,source:"provider",type:item.type||item.kind||item.media_type||"image",mime_type:item.mime_type||item.mime||item.content_type||"",width:item.width||item.w||0,height:item.height||item.h||0,ext:item.ext||item.extension||""}))];
  const seen=new Set(),images=[];
  for(const item of rawCandidates){
    const safe=safePublicMediaUrl(item.url);if(!safe||seen.has(safe.href))continue;
    const ext=String(item.ext||item.extension||imageExtensionFromUrl(safe.href)||"").toLowerCase();
    const type=String(item.type||item.kind||item.media_type||"").toLowerCase();
    const mime=String(item.mime_type||item.mime||item.content_type||"").toLowerCase();
    if(["video","audio"].includes(type)||mime.startsWith("video/")||mime.startsWith("audio/"))continue;
    if(ext&&!SOCIAL_IMAGE_EXTENSIONS.has(ext))continue;
    if(!SOCIAL_IMAGE_EXTENSIONS.has(ext)&&!["image","photo","picture"].includes(type))continue;
    seen.add(safe.href);
    const finalExt=ext==="jpeg"?"jpg":(ext||"jpg");
    const filename="aryanzz-"+(images.length+1)+"."+finalExt;
    images.push({
      title:providerTitle||"Gambar postingan",url:safe.href,
      width:Number(item.width)||null,height:Number(item.height)||null,
      ext:finalExt,filename,
      previewUrl:socialImageProxyUrl(safe.href,requestUrl,filename,false,rawUrl),
      downloadUrl:socialImageProxyUrl(safe.href,requestUrl,filename,true,rawUrl)
    });
    if(images.length>=20)break;
  }
  if(!images.length)return null;
  const title=providerTitle||decodeSearchHtml((page?.html||"").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"Postingan gambar").slice(0,240);
  const canonicalSourceUrl=page?.url||rawUrl;
  for(const image of images){image.sourceUrl=canonicalSourceUrl;image.previewUrl=socialImageProxyUrl(image.url,requestUrl,image.filename,false,canonicalSourceUrl);image.downloadUrl=socialImageProxyUrl(image.url,requestUrl,image.filename,true,canonicalSourceUrl)}
  return {title,url:canonicalSourceUrl,platform:key,verified:true,images};
}
async function socialImageInfo(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const raw=String(body?.url||"").trim();
  if(!isPlatformLink(raw)||!freePlatformKey(raw))return json({error:"Tempel tautan postingan publik dari platform yang didukung."},400);
  if(socialRateLimited(request))return json({error:"Batas permintaan gambar gratis tercapai. Tunggu satu menit lalu coba lagi."},429);
  try{
    const post=await resolveSocialImagePost(raw,request.url);
    if(!post)return json({error:"Belum ditemukan file gambar asli pada postingan ini. Bisa jadi postingan berisi video, privat, memerlukan login, atau platform membatasi akses publik."},404);
    return json({ok:true,...post});
  }catch(error){return json({error:"Gagal mengambil gambar postingan: "+String(error?.message||error).slice(0,150)},502)}
}
function socialImagePlatformKey(raw,fallback){const key=freePlatformKey(raw)||fallback;return key==="twitter"?"x":key;}
function socialImageSearchDomainsMatch(raw,platform){
  const safe=safePublicMediaUrl(raw);if(!safe)return null;
  const domains=socialSearchDomains(platform);
  return domains.some(domain=>safe.hostname===domain||safe.hostname.endsWith("."+domain))?safe:null;
}
function canonicalPublicSearchQuery(value){
  return String(value||"").toLowerCase().replace(/green\s*screen/gi,"green screen").replace(/greenscreen/gi,"green screen").replace(/layar\s*hijau/gi,"green screen").replace(/\bkucing\b/gi,"cat").replace(/\banjing\b/gi,"dog").replace(/\blucu\b/gi,"funny").replace(/\bgambar\b/gi,"image").replace(/\bfoto\b/gi,"photo").replace(/\bmusik\b/gi,"music").replace(/\blagu\b/gi,"song").replace(/\s+/g," ").trim();
}
function publicSearchRelevance(query,text){
  const q=canonicalPublicSearchQuery(query),tokens=q.normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(/[^a-z0-9]+/).filter(token=>token.length>1&&!["the","and","for","with","from"].includes(token));
  if(!tokens.length)return 0;
  const hay=" "+canonicalPublicSearchQuery(text).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ")+" ";
  let hits=0;for(const token of tokens)if(hay.includes(" "+token+" "))hits++;
  const coverage=hits/tokens.length,phrase=hay.includes(" "+q+" ")?0.2:0;
  return Math.min(1,coverage*.8+phrase);
}
function parseBingSocialImageResults(html,platform,requestUrl,query,allowWeb=false){
  const results=[],seen=new Set(),domains=socialSearchDomains(platform);
  const tags=String(html||"").matchAll(/<a\b[^>]*class=["'][^"']*\biusc\b[^"']*["'][^>]*>/gi);
  for(const match of tags){
    const attrs=match[0],metaMatch=attrs.match(/\bm=["']([^"']+)["']/i);if(!metaMatch)continue;
    let meta;try{meta=JSON.parse(decodeSearchHtml(metaMatch[1]).replace(/\\u0026/g,"&"))}catch{continue}
    const source=allowWeb?safePublicMediaUrl(meta.purl||meta.surl||meta.url||""):socialImageSearchDomainsMatch(meta.purl||meta.surl||meta.url||"",platform);
    const image=safePublicMediaUrl(String(meta.murl||meta.mediaUrl||meta.turl||"").replace(/&amp;/g,"&"));
    if(!source||!image)continue;
    const resultPlatform=socialImagePlatformKey(source.href,allowWeb?"web":platform);
    if(resultPlatform==="pinterest"&&!/\/pin\//i.test(source.pathname))continue;
    if(resultPlatform==="tiktok"&&!/(?:\/photo\/|\/video\/)/i.test(source.pathname))continue;
    if(resultPlatform==="instagram"&&!/(?:\/p\/|\/reel\/|\/tv\/|\/share\/)/i.test(source.pathname))continue;
    if(/\.(?:svg|ico)(?:[?#]|$)/i.test(image.href)||/(?:avatar|profile|favicon|logo|emoji|sprite|icon)(?:[._/-]|$)/i.test(image.href))continue;
    if(seen.has(image.href))continue;seen.add(image.href);
    const title=decodeSearchHtml(meta.desc||meta.t||meta.title||query)||query;
    if(publicSearchRelevance(query,title)<0.40)continue;
    const index=results.length,ext=imageExtensionFromUrl(image.href)||"jpg";
    const filename=imageSafeFilename(title,index,ext);
    results.push({
      title,platform:resultPlatform,sourceUrl:source.href,url:image.href,
      previewUrl:socialImageProxyUrl(image.href,requestUrl,filename,false,source.href),
      downloadUrl:socialImageProxyUrl(image.href,requestUrl,filename,true,source.href),
      filename,width:Number(meta.w||meta.width)||null,height:Number(meta.h||meta.height)||null,
      verified:true,searchProvider:"Bing Images"
    });
    if(results.length>=19)break;
  }
  return results;
}
function parseSocialImageSearchLinks(html,platform,seen,limit=18){
  if(limit<=0)return [];
  const domains=socialSearchDomains(platform),out=[];
  for(const match of String(html||"").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const attrs=match[1]||"";if(!/\bclass=["'][^"']*\bresult__a\b[^"']*["']/i.test(attrs))continue;
    const hrefMatch=attrs.match(/\bhref=["']([^"']+)["']/i);if(!hrefMatch)continue;
    let link;try{link=new URL(decodeSearchHtml(hrefMatch[1]),"https://html.duckduckgo.com")}catch{continue}
    if(link.hostname.endsWith("duckduckgo.com")){const target=link.searchParams.get("uddg");if(target){try{link=new URL(target)}catch{continue}}}
    if(link.protocol!=="https:"||!domains.some(domain=>link.hostname===domain||link.hostname.endsWith("."+domain)))continue;
    const resultPlatform=freePlatformKey(link.href)||platform;
    if(resultPlatform==="pinterest"&&!/\/pin\//i.test(link.pathname))continue;
    if(resultPlatform==="tiktok"&&!/(?:\/photo\/|\/video\/)/i.test(link.pathname))continue;
    if(resultPlatform==="instagram"&&!/(?:\/p\/|\/reel\/|\/tv\/|\/share\/)/i.test(link.pathname))continue;
    const href=link.href.split("#")[0];if(seen.has(href))continue;seen.add(href);
    const title=decodeSearchHtml(match[2]);if(!title)continue;
    out.push({title,url:href,platform:socialImagePlatformKey(href,platform)});if(out.length>=limit)break;
  }
  return out;
}
async function socialImageSearch(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const platform=String(body?.platform||"").toLowerCase(),query=String(body?.query||"").replace(/\s+/g," ").trim();
  const domains=socialSearchDomains(platform);
  if(!domains.length||!freePlatformKey("https://"+domains[0]))return json({error:"Pencarian gambar untuk platform ini belum tersedia."},400);
  if(query.length<2||query.length>120)return json({error:"Masukkan kata kunci antara 2 sampai 120 karakter."},400);
  if(socialRateLimited(request))return json({error:"Batas pencarian gambar gratis tercapai. Tunggu satu menit lalu coba lagi."},429);
  try{
    const searchPlatforms=["pinterest","tiktok","instagram","facebook","x","reddit","threads","snackvideo","capcut","youtube","vimeo","soundcloud"];
    const fetchBing=async(searchTerm,scope,allowWeb=false)=>{
      const url=new URL("https://www.bing.com/images/search");
      url.searchParams.set("q",canonicalPublicSearchQuery(searchTerm));url.searchParams.set("form","HDRSC3");
      try{
        const response=await fetch(url.href,{headers:{accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"},signal:AbortSignal.timeout(5000),cache:"no-store"});
        return response.ok?parseBingSocialImageResults(await response.text(),scope,request.url,query,allowWeb):[];
      }catch{return []}
    };
    const buckets=[...searchPlatforms.map(key=>({platform:key,results:[]})),{platform:"web",results:[]}];
    if(platform==="all"){
      const general=await fetchBing(query,"all",true);
      for(const item of general){
        const bucket=buckets.find(entry=>entry.platform===(item.platform||""));
        if(bucket&&!bucket.results.some(existing=>existing.url===item.url))bucket.results.push(item);
      }
      for(let offset=0;offset<searchPlatforms.length;offset+=3){
        const batch=searchPlatforms.slice(offset,offset+3).filter(key=>(buckets.find(entry=>entry.platform===key)?.results.length||0)<6);
        const batchResults=await Promise.all(batch.map(async key=>{
          const site=socialSearchDomains(key).map(domain=>"site:"+domain).join(" OR ");
          return {platform:key,results:await fetchBing(site+" "+query,key)};
        }));
        for(const entry of batchResults){
          const bucket=buckets.find(item=>item.platform===entry.platform);
          for(const item of entry.results||[])if(bucket&&!bucket.results.some(existing=>existing.url===item.url))bucket.results.push(item);
        }
        const currentCounts=buckets.map(item=>Math.min(item.results.length,6)).filter(Boolean);
        const currentTotal=currentCounts.reduce((sum,count)=>sum+count,0);
        const currentPlatforms=buckets.filter(item=>item.platform!=="web"&&item.results.length>0).length;
        if(currentTotal>=19&&currentPlatforms>=4)break;
      }
    }else{
      const site=domains.map(domain=>"site:"+domain).join(" OR ");
      const selectedBucket=buckets.find(entry=>entry.platform===platform);
      if(selectedBucket)selectedBucket.results=await fetchBing(site+" "+query,platform);
    }
    const results=[],seenImages=new Set(),platformCounts={};
    const maxPerPlatform=platform==="all"?6:19;
    if(platform==="all"){
      for(let round=0;results.length<19;round++){
        let added=false;
        for(const bucket of buckets){
          const item=bucket.results[round];if(!item)continue;
          const key=item.platform||bucket.platform;
          if((platformCounts[key]||0)>=maxPerPlatform||seenImages.has(item.url))continue;
          seenImages.add(item.url);results.push(item);platformCounts[key]=(platformCounts[key]||0)+1;added=true;
          if(results.length>=19)break;
        }
        if(!added)break;
      }
    }else{
      for(const item of buckets[0]?.results||[]){
        if(seenImages.has(item.url))continue;
        seenImages.add(item.url);results.push(item);platformCounts[item.platform||platform]=(platformCounts[item.platform||platform]||0)+1;
        if(results.length>=19)break;
      }
    }
    let candidates=[];
    const distinctPlatforms=Object.keys(platformCounts).length;
    const distinctSocialPlatforms=Object.keys(platformCounts).filter(key=>key!=="web").length;
    const needsFallback=results.length<19||(platform==="all"&&distinctSocialPlatforms<3);
    if(needsFallback){
      const allDomains=socialSearchDomains(platform),site=allDomains.map(domain=>"site:"+domain).join(" OR ");
      const searchTerm=platform==="all"?"("+site+") "+query:site+" "+query;
      const ddgQueries=[searchTerm,searchTerm+" (image OR photo OR meme OR gambar OR foto OR pin)"];
      const pages=await Promise.all(ddgQueries.map(async term=>{
        const url=new URL("https://html.duckduckgo.com/html/");url.searchParams.set("q",term);
        try{const response=await fetch(url.href,{headers:{accept:"text/html","user-agent":"Mozilla/5.0 (compatible; ARYANZZ/81.4)"},signal:AbortSignal.timeout(11000),cache:"no-store"});return response.ok?await response.text():""}catch{return ""}
      }));
      const seenPosts=new Set();
      for(const page of pages)candidates.push(...parseSocialImageSearchLinks(page,platform,seenPosts,18-candidates.length).filter(item=>publicSearchRelevance(query,item.title)>=0.40));
      const posts=await Promise.all(candidates.slice(0,12).map(item=>resolveSocialImagePost(item.url,request.url,{timeoutMs:8000,providerTimeoutMs:9000}).then(post=>post?{item,post}:null).catch(()=>null)));
      for(const entry of posts.filter(Boolean)){
        for(const image of entry.post.images||[]){
          if(results.length>=19)break;
          const imageUrl=String(image.url||""),key=socialImagePlatformKey(entry.post.url||entry.item.url,entry.post.platform||entry.item.platform||platform);
          if(seenImages.has(imageUrl)||(platform==="all"&&(platformCounts[key]||0)>=maxPerPlatform))continue;
          seenImages.add(imageUrl);
          results.push({...image,title:entry.post.title==="Postingan gambar"?entry.item.title:entry.post.title,platform:key,sourceUrl:entry.post.url||entry.item.url,verified:true,searchProvider:"Public post metadata"});
          platformCounts[key]=(platformCounts[key]||0)+1;
        }
        if(results.length>=19)break;
      }
    }
    const grouped=results.slice(0,19).map(item=>({title:item.title||query,sourceUrl:item.sourceUrl,platform:item.platform||platform,verified:!!item.verified,images:[item]}));
    const counts=grouped.reduce((out,item)=>{const key=socialImagePlatformKey(item.sourceUrl,item.platform||"other");out[key]=(out[key]||0)+1;return out},{});
    return json({ok:true,platform,query,results:grouped,imageCount:grouped.length,verifiedCount:grouped.length,platformCounts:counts,unavailableCount:Math.max(0,candidates.length-grouped.length),searchProvider:"Bing Images + public social posts"});
  }catch(error){return json({error:"Pencarian gambar gagal dijangkau. "+String(error?.message||error).slice(0,120)},502)}
}
async function socialImageFile(request){
  const u=new URL(request.url),raw=u.searchParams.get("url")||"",source=safePublicMediaUrl(raw),sourcePageRaw=u.searchParams.get("source")||"",sourcePage=safePublicMediaUrl(sourcePageRaw);
  if(!source)return json({error:"Alamat gambar tidak valid atau tidak aman."},400);
  if(socialImageProxyRateLimited(request))return json({error:"Batas unduhan gambar gratis tercapai. Tunggu sebentar."},429);
  try{
    let current=source,upstream=null;
    for(let hop=0;hop<6;hop++){
      upstream=await fetchSocialHeaders(current.href,{headers:{
        accept:"image/avif,image/webp,image/apng,image/*;q=0.9,*/*;q=0.5",
        "user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
        referer:sourcePage?sourcePage.href:current.origin+"/"
      },redirect:"manual",cache:"no-store"},22000);
      if([301,302,303,307,308].includes(upstream.status)){
        const location=upstream.headers.get("location");if(!location)throw new Error("CDN gambar mengirim pengalihan tanpa alamat tujuan.");
        const next=safePublicMediaUrl(new URL(location,current.href).href);
        if(!next)throw new Error("Pengalihan CDN gambar menuju alamat yang tidak aman.");
        current=next;continue;
      }
      break;
    }
    if(!upstream||![200,206].includes(upstream.status)||!upstream.body)return json({error:"CDN gambar tidak dapat memberikan file (HTTP "+(upstream?.status||0)+")."},502);
    const finalUrl=current;
    if(!finalUrl){await upstream.body.cancel().catch(()=>{});return json({error:"Pengalihan gambar tidak aman."},400)}
    const mime=String(upstream.headers.get("content-type")||"").split(";")[0].toLowerCase();
    if(!/^image\/(jpeg|png|webp|gif|avif|bmp)$/.test(mime)){await upstream.body.cancel().catch(()=>{});return json({error:"Sumber tidak mengembalikan file gambar yang didukung ("+(mime||"tipe tidak diketahui")+")."},415)}
    const maxBytes=25*1024*1024,length=Number(upstream.headers.get("content-length")||0);
    if(length>maxBytes){await upstream.body.cancel().catch(()=>{});return json({error:"Gambar melebihi batas 25 MB."},413)}
    const reader=upstream.body.getReader();let transferred=0;
    const limited=new ReadableStream({
      async pull(controller){
        try{
          const part=await reader.read();if(part.done){controller.close();return}
          transferred+=part.value.byteLength;
          if(transferred>maxBytes){await reader.cancel();controller.error(new Error("Gambar melebihi batas 25 MB."));return}
          controller.enqueue(part.value);
        }catch(error){controller.error(error)}
      },
      cancel(reason){return reader.cancel(reason)}
    });
    const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/avif":"avif","image/bmp":"bmp"})[mime]||"jpg";
    const base=String(u.searchParams.get("filename")||"aryanzz-image").replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").slice(0,90)||"aryanzz-image";
    const filename=base.replace(/\.[a-z0-9]{2,5}$/i,"")+"."+ext;
    const disposition=u.searchParams.get("download")==="1"?"attachment":"inline";
    return new Response(limited,{status:200,headers:{
      "content-type":mime,"content-disposition":disposition+'; filename="'+filename+'"',
      "cache-control":"public, max-age=300","x-content-type-options":"nosniff",
      "access-control-allow-origin":u.origin
    }});
  }catch(error){return json({error:"Gagal mengambil file gambar: "+String(error?.message||error).slice(0,120)},502)}
}


async function info(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  let parsed;try{parsed=parseMediaUrl(body?.url)}catch(e){return json({error:e.message},400)}
  try{
    const {response,parsed:final}=await getUpstream(parsed,"HEAD");
    if(!response.ok)return json({error:"Server sumber menjawab HTTP "+response.status+"."},502);
    const contentRange=String(response.headers.get("content-range")||"");
    const totalMatch=contentRange.match(/\/(\d+)$/);
    const size=Number(totalMatch?.[1]||response.headers.get("content-length")||0);
    if(size>MAX_BYTES)return json({error:"File melebihi batas 100 MB."},413);
    return json({ok:true,title:fileName(final.url,final.ext),filename:fileName(final.url,final.ext),extension:final.ext,type:["mp3","m4a","aac","wav","ogg","oga","flac","opus","wma","aiff","aif"].includes(final.ext)?"audio":"video",size:size||null,mime:response.headers.get("content-type")||null,source:final.url.hostname});
  }catch(e){return json({error:e.message||"Gagal memeriksa file."},502)}
}
async function download(request){
  let body;
  if(request.method==="GET")body={url:new URL(request.url).searchParams.get("url")||""};
  else{try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}}
  let parsed;try{parsed=parseMediaUrl(body?.url)}catch(e){return json({error:e.message},400)}
  const range=request.headers.get("range");
  let upstream;
  try{const result=await getUpstream(parsed,"GET",range);upstream=result.response;parsed=result.parsed}
  catch(e){return json({error:e.message||"Tidak dapat menghubungi server sumber."},502)}
  if(upstream.status===416){
    const headers=new Headers();
    for(const name of ["content-range","accept-ranges","etag","last-modified"])if(upstream.headers.get(name))headers.set(name,upstream.headers.get(name));
    await upstream.body?.cancel().catch(()=>{});
    return new Response(null,{status:416,headers});
  }
  if(![200,206].includes(upstream.status)||!upstream.body)return json({error:"Server sumber tidak menyediakan file (HTTP "+upstream.status+")."},502);
  const size=Number(upstream.headers.get("content-length")||0);
  const contentRange=String(upstream.headers.get("content-range")||"");
  const totalMatch=contentRange.match(/\/(\d+)$/);
  const totalSize=Number(totalMatch?.[1]||size);
  if(totalSize>MAX_BYTES){await upstream.body.cancel();return json({error:"Ukuran file melebihi batas 100 MB."},413)}
  let received=0;
  const limited=upstream.body.pipeThrough(new TransformStream({transform(chunk,controller){received+=chunk.byteLength;if(received>MAX_BYTES){controller.error(new Error("File melebihi batas 100 MB."));return}controller.enqueue(chunk)}}));
  const headers=new Headers({
    "content-type":upstream.headers.get("content-type")||"application/octet-stream",
    "content-disposition":'attachment; filename="'+fileName(parsed.url,parsed.ext)+'"',
    "cache-control":"no-store",
    "x-content-type-options":"nosniff"
  });
  for(const name of ["content-length","content-range","accept-ranges","etag","last-modified"])if(upstream.headers.get(name))headers.set(name,upstream.headers.get(name));
  if(!headers.has("accept-ranges"))headers.set("accept-ranges","none");
  return new Response(limited,{status:upstream.status,headers});
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
function hybridFormatSizeBytes(item){
  const parse=value=>{
    if(typeof value==="number"&&Number.isFinite(value)&&value>0)return Math.round(value);
    const text=String(value??"").trim();
    if(/^\d{5,}$/.test(text)){const n=Number(text);return Number.isFinite(n)&&n>0?Math.round(n):0;}
    const match=text.match(/^([\d.,]+)\s*(B|KB|KIB|MB|MIB|GB|GIB)$/i);
    if(!match)return 0;
    const amount=Number(match[1].replace(",","."));
    if(!Number.isFinite(amount)||amount<=0)return 0;
    const unit=match[2].toUpperCase(),factor=unit==="B"?1:unit==="KB"?1000:unit==="KIB"?1024:unit==="MB"?1000000:unit==="MIB"?1048576:unit==="GB"?1000000000:1073741824;
    return Math.round(amount*factor);
  };
  for(const key of ["contentLength","content_length","sizeBytes","size_bytes","fileSize","filesize"]){const bytes=parse(item?.[key]);if(bytes)return bytes;}
  return parse(item?.size);
}
function hybridVideoFormat(item,instance,progressiveSource=false,adaptiveSource=false){
  const mime=String(item?.mimeType||item?.type||item?.mime_type||item?.mime||"").toLowerCase(),container=String(item?.format||item?.container||item?.ext||"").toLowerCase();
  const url=hybridMediaUrl(item?.url||item?.urlTemplate||"",instance),height=hybridVideoHeight(item,url);
  const itag=Number(url?.searchParams?.get("itag")||item?.itag);
  const mp4=mime.includes("video/mp4")||mime.includes("video/x-m4v")||container.includes("mpeg_4")||container==="mp4"||container==="m4v"||String(item?.ext||"").toLowerCase()==="mp4"||String(url?.searchParams?.get("mime")||"").toLowerCase().includes("video/mp4")||(/\.mp4(?:$|[?#])/i.test(url?.pathname||""))||(progressiveSource&&[18,22,37,59,78,82,83,84,85].includes(itag));
  const videoOnly=adaptiveSource||item?.videoOnly===true||item?.isVideoOnly===true||item?.video_only===true;
  if(!url||![144,240,360,480,720,1080,1440,2160].includes(height)||!mp4)return null;
  return {mode:"video",height,quality:height+"p",ext:"mp4",mimeType:"video/mp4",url:url.toString(),bitrate:Number(item.bitrate)||0,sizeBytes:hybridFormatSizeBytes(item),videoOnly};
}
function hybridAudioFormat(item,instance){
  const mime=String(item?.mimeType||item?.type||"").toLowerCase(),container=String(item?.format||item?.container||"").toLowerCase(),url=hybridMediaUrl(item?.url||"",instance);
  if(!url||!(mime.startsWith("audio/")||["m4a","mp3","webm","opus","ogg"].includes(container)))return null;
  let ext=container==="mpeg"?"mp3":container==="mp4"?"m4a":container;
  if(!["m4a","mp3","webm","opus","ogg","wav","flac"].includes(ext)){if(mime.includes("audio/mp4"))ext="m4a";else if(mime.includes("audio/mpeg"))ext="mp3";else if(mime.includes("audio/webm"))ext="webm";else return null;}
  return {mode:"audio",height:0,quality:String(item.quality||item.audioQuality||item.bitrate||"Audio"),ext,mimeType:mime.split(";")[0],url:url.toString(),bitrate:Number(item.bitrate)||0,sizeBytes:hybridFormatSizeBytes(item)};
}
function dedupeHybridFormats(formats){
  const seen=new Set();return formats.filter(f=>{const key=f.mode+":"+f.height+":"+f.ext+":"+(f.videoOnly?"video-only":"muxed")+":"+(f.instance||"")+":"+f.url.split("?")[0];if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.mode===b.mode?(a.mode==="video"?a.height-b.height:b.bitrate-a.bitrate):a.mode==="video"?-1:1);
}
async function hybridFetchJson(url,parentSignal){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  const abort=()=>controller.abort();
  if(parentSignal){if(parentSignal.aborted)controller.abort();else parentSignal.addEventListener("abort",abort,{once:true});}
  try{
    const response=await fetch(url,{headers:{accept:"application/json","user-agent":"ARYANZZ/73.6 (public-instance failover)"},signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    if(!(response.headers.get("content-type")||"").toLowerCase().includes("json"))throw new Error("Respons bukan JSON");
    return await response.json();
  }finally{clearTimeout(timer);parentSignal?.removeEventListener("abort",abort);}
}
let hybridPipedRegistryCache=null,hybridPipedRegistryAt=0;
let hybridInvidiousRegistryCache=null,hybridInvidiousRegistryAt=0;
async function currentHybridPipedInstances(){
  if(hybridPipedRegistryCache&&Date.now()-hybridPipedRegistryAt<300000)return hybridPipedRegistryCache.slice();
  const fallback=PIPED_PUBLIC_INSTANCES.slice();
  try{
    const response=await fetch("https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md",{headers:{accept:"text/plain"},signal:AbortSignal.timeout(2500),cache:"no-store"});
    if(!response.ok)throw new Error("Piped directory HTTP "+response.status);
    const markdown=await response.text();
    const found=[...markdown.matchAll(/https:\/\/(?:pipedapi(?:-libre)?|piped-api|api\.piped)\.[a-z0-9.-]+/gi)].map(match=>match[0].replace(/\/$/,""));
    const safe=found.filter(origin=>{try{const u=new URL(origin);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&hybridIsPipedApiInstance(origin);}catch{return false;}});
    hybridPipedRegistryCache=[...new Set([...safe,...fallback])].slice(0,24);
  }catch{hybridPipedRegistryCache=fallback;}
  hybridPipedRegistryAt=Date.now();
  return hybridPipedRegistryCache.slice();
}
async function currentHybridInvidiousInstances(){
  if(hybridInvidiousRegistryCache&&Date.now()-hybridInvidiousRegistryAt<300000)return hybridInvidiousRegistryCache.slice();
  const fallback=INVIDIOUS_PUBLIC_INSTANCES.slice();
  try{
    const response=await fetch("https://api.invidious.io/instances.json?sort_by=type,health",{headers:{accept:"application/json"},signal:AbortSignal.timeout(2500),cache:"no-store"});
    if(!response.ok)throw new Error("Invidious directory HTTP "+response.status);
    const rows=await response.json();if(!Array.isArray(rows))throw new Error("Invidious directory response invalid");
    const discovered=rows.map(row=>{
      const raw=Array.isArray(row)?row[0]:row?.uri,meta=Array.isArray(row)?row[1]:row;
      try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&meta?.api===true&&meta?.cors===true&&!u.hostname.endsWith(".onion")?u.origin:null;}catch{return null;}
    }).filter(Boolean);
    hybridInvidiousRegistryCache=[...new Set([...discovered,...fallback])].slice(0,20);
  }catch{hybridInvidiousRegistryCache=fallback;}
  hybridInvidiousRegistryAt=Date.now();
  return hybridInvidiousRegistryCache.slice();
}
async function hybridProbeGroup(instances,pathFor,parser){
  const provider=parser===hybridFromPiped?"Piped":"Invidious";
  const settled=await Promise.all(instances.map(async instance=>{
    try{
      const data=await hybridFetchJson(instance+pathFor);
      const result=parser(data,instance);
      if(!result)throw new Error("Metadata tidak memuat stream MP4 yang didukung.");
      return {ok:true,result};
    }catch(error){
      return {ok:false,diagnostic:{provider,instance,error:String(error?.message||"permintaan gagal").slice(0,150)}};
    }
  }));
  return {results:settled.filter(item=>item.ok).map(item=>item.result),diagnostics:settled.filter(item=>!item.ok).map(item=>item.diagnostic)};
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
  const [pipedProbe,invProbe]=await Promise.all([
    hybridProbeGroup(piped.slice(0,20),"/streams/"+encodeURIComponent(id),hybridFromPiped),
    hybridProbeGroup(inv.slice(0,10),"/api/v1/videos/"+encodeURIComponent(id)+"?local=true",hybridFromInvidious)
  ]);
  const available=[...pipedProbe.results,...invProbe.results];
  const diagnostics=[...pipedProbe.diagnostics,...invProbe.diagnostics];
  if(available.length){
    const primary=available.find(item=>item.provider==="Piped")||available[0];
    const formats=dedupeHybridFormats([...invProbe.results,...pipedProbe.results].flatMap(result=>(result.formats||[]).map(format=>({...format,instance:result.instance,provider:result.provider}))));
    return json({...primary,providerReady:true,formats:formats.map((format,index)=>({...format,id:"f"+index})),providers:available.map(item=>({provider:item.provider,instance:item.instance,formatCount:item.formats?.length||0})),diagnostics:diagnostics.slice(0,20)});
  }
  {
    let preview={};
    try{const u=new URL("https://www.youtube.com/oembed");u.searchParams.set("url",raw);u.searchParams.set("format","json");const res=await fetch(u.toString(),{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});if(res.ok)preview=await res.json();}catch{}
    return json({ok:true,providerReady:false,providerName:"Hybrid",provider:"Unavailable",title:String(preview.title||"Video YouTube").slice(0,300),thumbnail:typeof preview.thumbnail_url==="string"?preview.thumbnail_url:null,formats:[],providerMessage:"Instance komunitas belum memberikan stream MP4 yang dapat digunakan. Link video tetap valid; coba lagi nanti atau gunakan file yang memang dapat diunduh dari pemiliknya.",diagnostics:diagnostics.slice(0,20)});
  }
}
function hybridFilename(title,ext){
  const clean=String(title||"aryanzz-youtube").replace(/[\\/:*?"<>|\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,90)||"aryanzz-youtube";
  return clean.toLowerCase().endsWith("."+ext)?clean:clean+"."+ext;
}
async function hybridYoutubeValidate(request){
  const u=new URL(request.url),rawStream=u.searchParams.get("url")||"",instance=u.searchParams.get("instance")||"";
  let instanceOrigin=null;
  try{
    const candidate=new URL(instance);
    if(candidate.protocol==="https:"&&!candidate.username&&!candidate.password&&!candidate.port&&candidate.pathname==="/"&&!candidate.search&&!candidate.hash)instanceOrigin=candidate.origin;
  }catch{}
  let trustedInstance;
  if(instanceOrigin){
    const staticInstances=[...PIPED_PUBLIC_INSTANCES,...INVIDIOUS_PUBLIC_INSTANCES];
    let known=staticInstances.some(candidate=>{try{return new URL(candidate).origin===instanceOrigin}catch{return false}});
    if(!known){
      const [pipedInstances,invidiousInstances]=await Promise.all([currentHybridPipedInstances(),currentHybridInvidiousInstances()]);
      known=[...pipedInstances,...invidiousInstances].some(candidate=>{try{return new URL(candidate).origin===instanceOrigin}catch{return false}});
    }
    if(known)trustedInstance=instanceOrigin;
  }
  const stream=hybridMediaUrl(rawStream,trustedInstance),ext=String(u.searchParams.get("ext")||"mp4").toLowerCase();
  if(!stream)return json({error:"URL stream tidak berasal dari host media yang diizinkan atau instance komunitas tidak dikenal."},400);
  if(!["mp4","m4a","mp3","webm","opus","ogg","wav","flac"].includes(ext))return json({error:"Format file tidak didukung."},400);
  const title=hybridFilename(u.searchParams.get("title"),ext);
  return json({ok:true,url:stream.toString(),ext,title,instance:trustedInstance||null});
}
async function hybridYoutubeFile(request){
  const u=new URL(request.url),rawStream=u.searchParams.get("url")||"",instance=u.searchParams.get("instance")||"";
  let instanceOrigin=null;
  try{
    const candidate=new URL(instance);
    if(candidate.protocol==="https:"&&!candidate.username&&!candidate.password&&!candidate.port&&candidate.pathname==="/"&&!candidate.search&&!candidate.hash)instanceOrigin=candidate.origin;
  }catch{}
  let trustedInstance;
  if(instanceOrigin){
    const staticInstances=[...PIPED_PUBLIC_INSTANCES,...INVIDIOUS_PUBLIC_INSTANCES];
    let known=staticInstances.some(candidate=>{try{return new URL(candidate).origin===instanceOrigin}catch{return false}});
    if(!known){
      const [pipedInstances,invidiousInstances]=await Promise.all([currentHybridPipedInstances(),currentHybridInvidiousInstances()]);
      known=[...pipedInstances,...invidiousInstances].some(candidate=>{try{return new URL(candidate).origin===instanceOrigin}catch{return false}});
    }
    if(known)trustedInstance=instanceOrigin;
  }
  const stream=hybridMediaUrl(rawStream,trustedInstance),ext=String(u.searchParams.get("ext")||"mp4").toLowerCase();
  if(!stream)return json({error:"URL stream tidak berasal dari host media yang diizinkan atau instance komunitas tidak dikenal."},400);
  if(!["mp4","m4a","mp3","webm","opus","ogg","wav","flac"].includes(ext))return json({error:"Format file tidak didukung."},400);
  const probe=u.searchParams.get("probe")==="1";
  const title=hybridFilename(u.searchParams.get("title"),ext),range=probe?"bytes=0-0":request.headers.get("range");
  const host=stream.hostname.toLowerCase();
  const androidUA="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
  const desktopUA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const trustedReferer=trustedInstance?trustedInstance+"/":null;
  const profiles=host==="googlevideo.com"||host.endsWith(".googlevideo.com")
    ?[{ua:androidUA,referer:"https://www.youtube.com/",origin:"https://www.youtube.com"},...(trustedReferer?[{ua:androidUA,referer:trustedReferer,origin:trustedInstance}]:[]),{ua:desktopUA}]
    :host.includes("pipedproxy")
      ?[...(trustedReferer?[{ua:androidUA,referer:trustedReferer,origin:trustedInstance}]:[]),{ua:androidUA,referer:"https://piped.video/",origin:"https://piped.video"},{ua:desktopUA}]
      :[...(trustedReferer?[{ua:androidUA,referer:trustedReferer,origin:trustedInstance}]:[]),{ua:androidUA,referer:"https://www.youtube.com/",origin:"https://www.youtube.com"},{ua:desktopUA}];
  let response,current=stream,lastStatus=0;
  try{
    for(let profileIndex=0;profileIndex<profiles.length;profileIndex++){
      current=stream;
      for(let redirect=0;redirect<4;redirect++){
        const profile=profiles[profileIndex],headers={accept:"*/*","user-agent":profile.ua};
        if(profile.referer)headers.referer=profile.referer;
        if(profile.origin)headers.origin=profile.origin;
        if(range&&/^bytes=\d*-\d*(?:,\d*-\d*)*$/.test(range))headers.range=range;
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),probe?10000:30000);
        try{response=await fetch(current.toString(),{headers,redirect:"manual",signal:controller.signal});}
        finally{clearTimeout(timer);}
        if(![301,302,303,307,308].includes(response.status))break;
        const loc=response.headers.get("location");if(!loc)break;
        const next=hybridMediaUrl(new URL(loc,current).toString(),trustedInstance);
        if(!next)return json({error:"Redirect stream menuju host yang tidak diizinkan."},502);
        current=next;
      }
      lastStatus=response?.status||0;
      if(![403,429,500,502,503,504].includes(lastStatus)||profileIndex===profiles.length-1)break;
      if(response?.body)await response.body.cancel().catch(()=>{});
    }
  }catch(e){return json({error:"Gagal mengambil stream dari instance komunitas: "+String(e.message||"network error").slice(0,160)},502)}
  if(!response||![200,206].includes(response.status)||!response.body)return json({error:"Stream tidak tersedia atau ditolak (HTTP "+(response?.status||502)+") dari "+current.hostname+" setelah "+profiles.length+" pola permintaan. Coba provider/instance lain."},502);
  const size=Number(response.headers.get("content-length")||0);
  if(size>MAX_YOUTUBE_BYTES){await response.body.cancel();return json({error:"File melebihi batas 500 MB."},413)}
  if(probe){
    const contentType=String(response.headers.get("content-type")||"").toLowerCase();
    if(contentType.startsWith("text/")||contentType.includes("application/json")||contentType.includes("application/xml")){
      await response.body.cancel().catch(()=>{});
      return json({error:"Provider mengirim respons non-media saat pemeriksaan stream."},502);
    }
    const reader=response.body.getReader();let first;
    try{first=await reader.read()}catch(e){return json({error:"Gagal membaca byte awal stream: "+String(e.message||"network error").slice(0,120)},502)}
    finally{await reader.cancel().catch(()=>{});}
    if(!first||first.done||!first.value?.byteLength)return json({error:"Provider tidak mengirim data media pada pemeriksaan awal."},502);
    const contentRange=response.headers.get("content-range")||"";
    const totalMatch=contentRange.match(/\/(\d+)$/);
    const totalBytes=totalMatch?Number(totalMatch[1]):(response.status===200?size:null);
    return json({ok:true,status:response.status,contentType,contentLength:size||null,contentRange:contentRange||null,totalBytes:totalBytes||null,acceptRanges:response.headers.get("accept-ranges")||null});
  }
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
function hybridThumbnailHostAllowed(url,instanceOrigin){
  const host=url.hostname.toLowerCase();
  const youtubeImage=host==="i.ytimg.com"||host==="img.youtube.com"||host==="yt3.ggpht.com"||host==="yt4.ggpht.com"||host.endsWith(".ytimg.com")||host.endsWith(".googleusercontent.com");
  const instanceImage=!!instanceOrigin&&url.origin===instanceOrigin&&/^\/(?:vi|vi_webp)\//.test(url.pathname);
  return url.protocol==="https:"&&!url.username&&!url.password&&(youtubeImage||instanceImage);
}
async function hybridYoutubeThumbnail(request){
  const u=new URL(request.url),raw=u.searchParams.get("url")||"",instance=u.searchParams.get("instance")||"";
  let image;try{image=new URL(raw)}catch{return json({error:"URL thumbnail tidak valid."},400)}
  let instanceOrigin=null;
  try{
    const candidate=new URL(instance);
    if(candidate.protocol==="https:"&&!candidate.username&&!candidate.password&&!candidate.port&&candidate.pathname==="/"&&!candidate.search&&!candidate.hash){
      const staticInstances=[...PIPED_PUBLIC_INSTANCES,...INVIDIOUS_PUBLIC_INSTANCES];
      let known=staticInstances.some(value=>{try{return new URL(value).origin===candidate.origin}catch{return false}});
      if(!known){
        const [pipedInstances,invidiousInstances]=await Promise.all([currentHybridPipedInstances(),currentHybridInvidiousInstances()]);
        known=[...pipedInstances,...invidiousInstances].some(value=>{try{return new URL(value).origin===candidate.origin}catch{return false}});
      }
      if(known)instanceOrigin=candidate.origin;
    }
  }catch{}
  if(!hybridThumbnailHostAllowed(image,instanceOrigin))return json({error:"Host thumbnail tidak termasuk sumber YouTube yang diizinkan."},400);
  let current=image,response;
  try{
    for(let i=0;i<4;i++){
      response=await fetch(current.toString(),{headers:{accept:"image/avif,image/webp,image/*"},redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(15000)});
      if(![301,302,303,307,308].includes(response.status))break;
      const location=response.headers.get("location");if(!location)return json({error:"Redirect thumbnail tidak memiliki tujuan."},502);
      const next=new URL(location,current);
      if(!hybridThumbnailHostAllowed(next,instanceOrigin))return json({error:"Redirect thumbnail menuju host yang tidak diizinkan."},502);
      current=next;
    }
  }catch(error){return json({error:"Gagal mengambil thumbnail: "+String(error.message||"network error").slice(0,120)},502)}
  if(!response||response.status!==200||!response.body)return json({error:"Thumbnail tidak tersedia (HTTP "+(response?.status||502)+")."},502);
  const contentType=String(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
  if(!contentType.startsWith("image/")){await response.body.cancel().catch(()=>{});return json({error:"Sumber tidak mengirim gambar thumbnail."},502)}
  const size=Number(response.headers.get("content-length")||0);
  if(size>15*1024*1024){await response.body.cancel();return json({error:"Thumbnail melebihi batas 15 MB."},413)}
  const ext=contentType==="image/webp"?"webp":contentType==="image/png"?"png":contentType==="image/avif"?"avif":"jpg";
  const filename=hybridFilename((u.searchParams.get("title")||"aryanzz-thumbnail").replace(/\.[^.]+$/,""),ext);
  let received=0;
  const limited=response.body.pipeThrough(new TransformStream({transform(chunk,controller){received+=chunk.byteLength;if(received>15*1024*1024){controller.error(new Error("Thumbnail melebihi batas 15 MB."));return;}controller.enqueue(chunk)}}));
  return new Response(limited,{status:200,headers:{"content-type":contentType,"content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(filename),"cache-control":"no-store","x-content-type-options":"nosniff"}});
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
async function hybridYouTubeSearch(query){
  const [pipedInstances,invidiousInstances]=await Promise.all([currentHybridPipedInstances(),currentHybridInvidiousInstances()]);
  const candidates=[
    ...pipedInstances.slice(0,3).map(instance=>({instance,provider:"Piped",url:instance+"/search?q="+encodeURIComponent(query)+"&filter=videos"})),
    ...invidiousInstances.slice(0,3).map(instance=>({instance,provider:"Invidious",url:instance+"/api/v1/search?q="+encodeURIComponent(query)+"&type=video"}))
  ];
  if(!candidates.length)return null;
  const controller=new AbortController();
  const normalize=(item,provider)=>{
    const title=String(item?.title||item?.name||"").trim().slice(0,220);
    const id=String(item?.videoId||item?.video_id||item?.id||"").match(/[A-Za-z0-9_-]{11}/)?.[0]||"";
    let raw=String(item?.url||item?.webpage_url||item?.link||"");
    if(raw.startsWith("/"))raw="https://www.youtube.com"+raw;
    if(!isYouTubeUrl(raw)&&id)raw="https://www.youtube.com/watch?v="+id;
    let url="";try{const parsed=new URL(raw);if(isYouTubeUrl(parsed.href))url=parsed.href;}catch{}
    const thumbnails=Array.isArray(item?.videoThumbnails)?item.videoThumbnails:Array.isArray(item?.thumbnails)?item.thumbnails:[];
    const thumbnail=String(item?.thumbnail||item?.thumbnail_url||thumbnails.find(x=>x?.quality==="medium"||x?.quality==="high")?.url||thumbnails[0]?.url||"");
    const channel=String(item?.uploaderName||item?.author||item?.uploader||item?.channel||"").slice(0,120);
    const duration=Number(item?.duration||item?.lengthSeconds||item?.length_seconds)||null;
    return title&&url?{title,url,thumbnail,channel,duration,provider}:null;
  };
  const attempts=candidates.map(async candidate=>{
    const data=await hybridFetchJson(candidate.url,controller.signal);
    const items=Array.isArray(data)?data:Array.isArray(data?.items)?data.items:Array.isArray(data?.results)?data.results:[];
    const results=items.map(item=>normalize(item,candidate.provider)).filter(Boolean);
    if(!results.length)throw new Error(candidate.provider+" tidak menemukan video.");
    controller.abort();
    return {ok:true,results:results.slice(0,8),provider:candidate.provider+" public instances"};
  });
  try{return await Promise.any(attempts);}catch{return null;}
}
async function freeYouTubeSearch(query){
  const endpoint=FREE_MEDIA_API+"/api/download/youtube-search?query="+encodeURIComponent(query)+"&limit=8";
  try{
    const response=await fetch(endpoint,{headers:{accept:"application/json"},signal:AbortSignal.timeout(18000),cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data?.success===false)return json({error:data?.error?.message||data?.error||"Provider pencarian gratis menjawab HTTP "+response.status+"."},502);
    const items=Array.isArray(data?.normalized?.items)?data.normalized.items:Array.isArray(data?.result)?data.result:[];
    const results=items.map(item=>({title:String(item?.title||item?.name||"Video tanpa judul").slice(0,220),url:String(item?.url||item?.webpage_url||item?.link||""),thumbnail:String(item?.thumbnail||item?.thumbnail_url||""),channel:String(item?.author||item?.channel||item?.uploader||""),duration:Number(item?.duration)||null})).filter(item=>item.title&&isYouTubeUrl(item.url)).slice(0,8);
    return json({ok:true,query,results,provider:"Public API"});
  }catch(error){return json({error:"Pencarian YouTube gratis sedang tidak tersedia. "+String(error?.message||error).slice(0,100)},502)}
}
async function searchYouTube(request,env){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const query=String(body?.query||"").replace(/\s+/g," ").trim();
  if(query.length<2)return json({error:"Masukkan minimal 2 karakter untuk mencari judul video."},400);
  if(query.length>160)return json({error:"Judul pencarian maksimal 160 karakter."},400);
  if(!env.PLATFORM_API_ORIGIN||!env.PLATFORM_API_TOKEN){
    if(socialRateLimited(request))return json({error:"Batas pencarian gratis tercapai. Tunggu satu menit lalu coba lagi."},429);
    const hybrid=await hybridYouTubeSearch(query);
    if(hybrid?.results?.length)return json({ok:true,query,results:hybrid.results,provider:hybrid.provider});
    return freeYouTubeSearch(query);
  }
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
  // Serve crawler files explicitly so Google receives deterministic XML/plain-text MIME types.
  if(url.pathname==="/sitemap.xml"&&request.method==="GET"){
    const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/</loc>\n    <lastmod>2026-11-03</lastmod>\n  </url>\n</urlset>\n';
    return new Response(xml,{status:200,headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
  }
  if(url.pathname==="/sitemap.txt"&&request.method==="GET"){
    const sitemap="https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/\n";
    return new Response(sitemap,{status:200,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
  }
  if(url.pathname==="/robots.txt"&&request.method==="GET"){
    const robots='User-agent: *\nAllow: /\n\nSitemap: https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/sitemap.txt\n';
    return new Response(robots,{status:200,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
  }
  if(request.method==="OPTIONS"&&url.pathname.startsWith("/api/"))return new Response(null,{status:204,headers:{"access-control-allow-origin":url.origin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type"}});
  if(url.pathname==="/api/music/scan-video"&&request.method==="POST")return recognizeMusicVideo(request,env);
  if(url.pathname==="/api/music/status"&&request.method==="GET")return musicStatus(env);
  if(url.pathname==="/api/search"&&request.method==="POST")return searchYouTube(request,env);
  if(url.pathname==="/api/social/search"&&request.method==="POST")return searchSocial(request);
  if(url.pathname==="/api/social/images"&&request.method==="POST")return socialImageInfo(request);
  if(url.pathname==="/api/social/image-search"&&request.method==="POST")return socialImageSearch(request);
  if(url.pathname==="/api/social-image-file"&&request.method==="GET")return socialImageFile(request);
  if(url.pathname==="/api/image/search"&&request.method==="POST")return socialImageSearch(request);
  if(url.pathname==="/api/image/extract"&&request.method==="GET")return imageExtractV81(request);
  if(url.pathname==="/api/image/file"&&request.method==="GET")return imageFile(request);
  if(url.pathname==="/api/music/recognize"&&request.method==="POST")return recognizeMusic(request,env);
  if(url.pathname==="/api/platform/status"&&request.method==="GET")return platformStatus(env);
  if(url.pathname==="/api/youtube/status"&&request.method==="GET")return json({ok:true,service:"ARYANZZ YouTube Backend",youtubeDownloader:true,provider:"Dynamic Piped + Invidious hybrid",paidProvider:false,cobalt:false,supportedAudio:["M4A","MP3","WEBM","OPUS"],supportedVideo:["360","480","720","1080","1440","2160"]});
  if(url.pathname==="/api/youtube/hybrid/info"&&request.method==="GET")return hybridYoutubeInfo(request);
  if(url.pathname==="/api/youtube/hybrid/validate"&&request.method==="GET")return hybridYoutubeValidate(request);
   if(url.pathname==="/api/youtube/hybrid/file"&&request.method==="GET")return hybridYoutubeFile(request);
   if(url.pathname==="/api/youtube/hybrid/thumbnail"&&request.method==="GET")return hybridYoutubeThumbnail(request);
  if(url.pathname==="/api/youtube/info"&&request.method==="GET")return youtubeInfo(request,env);
    if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"ARYANZZ",version:"81.4",mode:"cloudflare-worker-zero-server-hybrid",directMediaDownload:true,selfHostedDownloader:false,youtubeDownloader:true,youtubeApiKeyConfigured:false,cobalt:false,paidYoutubeProvider:false,musicRecognitionConfigured:!!env.AUDD_API_TOKEN,musicFallbackReady:false,musicVideoRecognitionReady:false,platformExtraction:true,platformBackend:"public-free-community-api"});
  if(url.pathname==="/api/social-file"&&request.method==="GET")return socialMediaFile(request);
  if(url.pathname==="/api/info"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/info");if(proxied)return proxied;return info(request);}
  if(url.pathname==="/api/direct-file"&&request.method==="GET")return download(request);
  if(url.pathname==="/api/download"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/download");if(proxied)return proxied;return download(request);}
  if(url.pathname.startsWith("/api/"))return json({error:"Endpoint tidak ditemukan."},404);
  return env.ASSETS.fetch(request);
}};
