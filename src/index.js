const BUILD_VERSION = "__ARYANZZ_VERSION__";
import { PLATFORM_CATALOG, PLATFORM_DOMAINS, PLATFORM_CATALOG_BY_ID, platformForHost } from "./platform-catalog.js";
import { handleAuthRequest, moderationGate } from "./auth.js";
import { MembershipStore } from "./membership-store.js";
const MEDIA_EXT = new Set(["mp4","webm","mov","m4v","mkv","avi","mpeg","mpg","m2ts","mts","ts","3gp","ogv","asf","wmv","mp3","m4a","aac","wav","ogg","oga","flac","opus","wma","aiff","aif","mka"]);
const MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_PUBLIC_ORIGIN = "https://aryanzz-donwloader.aryanz.workers.dev";
function getPublicOrigin(env) {
  const configured = String(env?.ARYANZZ_PUBLIC_ORIGIN || DEFAULT_PUBLIC_ORIGIN).trim();
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return DEFAULT_PUBLIC_ORIGIN;
    return parsed.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}
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
const PLATFORM_HOSTS=PLATFORM_DOMAINS;
function isPlatformLink(raw){
  try{const u=new URL(raw);const h=u.hostname.toLowerCase();return ["http:","https:"].includes(u.protocol)&&PLATFORM_HOSTS.some(d=>h===d||h.endsWith("."+d));}catch{return false;}
}
const FREE_MEDIA_API="https://btch-downloader-api-green.vercel.app";
function freePlatformKey(raw){
  try{return platformForHost(new URL(raw).hostname)?.providerKey||null}catch{return null}
}
const SOCIAL_RATE_BUCKETS=new Map();
function socialRateLimited(request){
  const ip=request.headers.get("cf-connecting-ip")||"unknown",now=Date.now();
  let bucket=SOCIAL_RATE_BUCKETS.get(ip);
  if(!bucket||now-bucket.started>=60000)bucket={started:now,count:0};
  bucket.count++;SOCIAL_RATE_BUCKETS.set(ip,bucket);
  if(SOCIAL_RATE_BUCKETS.size>1200)for(const [key,value] of SOCIAL_RATE_BUCKETS)if(now-value.started>=60000)SOCIAL_RATE_BUCKETS.delete(key);
  return bucket.count>30;
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
    const image=mime.startsWith("image/")||/image|photo|picture|thumbnail|cover/.test(kind+" "+label)||["jpg","jpeg","png","gif","webp","avif","bmp"].includes(pathExt)||["jpg","jpeg","png","gif","webp","avif","bmp"].includes(declaredExt);
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
  const width=Number(normalized?.width||normalized?.videoWidth||normalized?.video_width||normalized?.video?.width||rawResult.width||rawResult.video?.width||data?.width)||null;
  const height=Number(normalized?.height||normalized?.videoHeight||normalized?.video_height||normalized?.video?.height||rawResult.height||rawResult.video?.height||data?.height)||null;
  if(!formats.length)return null;
  formats.sort((a,b)=>a.mode===b.mode?(b.height-a.height):a.mode==="video"?-1:1);
  const platformKey=platformIdForUrl(rawUrl)||freePlatformKey(rawUrl);
  const mp4Formats=formats.filter(item=>item.mode==="video"&&!item.videoOnly&&["mp4","m4v"].includes(item.ext));
  return {ok:true,providerName:"Public API",providerReady:true,provider:"Free public provider",platform:platformKey,title,filename:title,duration,thumbnail,width,height,aspectRatio:width&&height?width/height:null,type:formats.some(x=>x.mode==="video")?"video":"audio",formats,capabilities:{linkAccepted:true,preview:formats.some(item=>item.mode==="video"||item.mode==="audio"),mp4:mp4Formats.length>0,audio:formats.some(item=>item.mode==="audio"),mp4Qualities:[...new Set(mp4Formats.map(item=>item.height).filter(Boolean))]}};
}

async function verifyTikTokPhotoVideoFormats(info,canonicalUrl){
  let photoRoute=false;
  try{photoRoute=/\/photo\//i.test(new URL(canonicalUrl).pathname)}catch{}
  if(!photoRoute||!info||!Array.isArray(info.formats))return info;
  const candidates=info.formats.filter(item=>item?.mode==="video"&&item?.downloadUrl).slice(0,6);
  const verified=[];
  for(const item of candidates){
    try{
      const probeUrl=new URL(item.downloadUrl);
      if(probeUrl.origin!==new URL(item.downloadUrl).origin||probeUrl.pathname!=="/api/social-file")continue;
      probeUrl.searchParams.set("probe","1");
      const response=await socialMediaFile(new Request(probeUrl.href));
      const data=await response.json().catch(()=>({}));
      if(response.ok&&data.valid===true&&String(data.mimeType||"").startsWith("video/")){
        verified.push({...item,ext:data.extension||item.ext,mimeType:data.mimeType,verified:true});
      }
    }catch{}
  }
  const verifiedUrls=new Set(verified.map(item=>item.downloadUrl));
  info.formats=[...verified,...info.formats.filter(item=>item?.mode!=="video"||verifiedUrls.has(item.downloadUrl))];
  if(!verified.length){
    info.directDownloadAvailable=false;
    info.downloadMessage="TikTok Photo Mode dapat dibuka melalui pemutar resmi, tetapi provider publik tidak memberikan stream video MP4 yang lolos pemeriksaan. ARYANZZ tidak akan mengganti gambar/audio menjadi MP4 palsu.";
    const photoItemId=extractTikTokItemId(canonicalUrl);
    if(photoItemId&&/^\d{8,}$/.test(photoItemId)){
      const player=new URL("https://www.tiktok.com/player/v1/"+photoItemId);
      for(const [key,value] of Object.entries({controls:"1",timestamp:"1",description:"1",music_info:"1",rel:"0"}))player.searchParams.set(key,value);
      info.embedUrl=player.href;
      info.embedId=photoItemId;
      info.providerName="TikTok Photo Mode · official embed";
    }else{
      try{
        const embed=await fetchTikTokOEmbed(canonicalUrl,6500);
        info.embedUrl=embed.embedUrl;
        info.embedId=embed.id;
        info.embedAuthor=embed.author||null;
        info.title=info.title||embed.title;
        info.thumbnail=info.thumbnail||embed.thumbnail||null;
        info.providerName="TikTok Photo Mode · official embed";
      }catch{}
    }
  }
  return info;
}

function extractGenericPublicMediaCandidates(html,pageUrl){
  const output=[],seen=new Set();
  const audioExts=new Set(["mp3","m4a","aac","opus","ogg","wav","flac"]);
  const videoExts=new Set(["mp4","webm","mov","m4v","avi","3gp"]);
  const mimeExtensions={"video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov","video/x-msvideo":"avi","video/3gpp":"3gp","audio/mpeg":"mp3","audio/mp4":"m4a","audio/aac":"aac","audio/ogg":"ogg","audio/wav":"wav","audio/flac":"flac"};
  const decode=value=>String(value||"").replace(/&amp;/gi,"&").replace(/\\u0026/gi,"&").replace(/\\u003d/gi,"=").replace(/\\\//g,"/").trim();
  const add=(raw,kind="",mime="",label="")=>{
    const value=decode(raw);if(!value||/^(?:data|blob|javascript):/i.test(value))return;
    let safe;try{safe=safePublicMediaUrl(new URL(value,pageUrl).href)}catch{return}
    if(!safe)return;
    const ext=(safe.pathname.match(/\.([a-z0-9]{2,5})$/i)||[])[1]?.toLowerCase()||"";
    const contentType=String(mime||"").split(";")[0].trim().toLowerCase();
    const isAudio=contentType.startsWith("audio/")||audioExts.has(ext)||kind==="audio";
    const isVideo=contentType.startsWith("video/")||videoExts.has(ext)||kind==="video";
    if(!isAudio&&!isVideo)return;
    if(ext&&!audioExts.has(ext)&&!videoExts.has(ext))return;
    if(!ext&&!contentType)return;
    const mode=isAudio?"audio":"video";
    const finalExt=ext||mimeExtensions[contentType]|| (mode==="audio"?"mp3":"mp4");
    const finalMime=contentType||Object.keys(mimeExtensions).find(key=>mimeExtensions[key]===finalExt)||"";
    const key=safe.href+"|"+mode;if(seen.has(key))return;seen.add(key);
    output.push({url:safe.href,type:mode,mode,ext:finalExt,mimeType:finalMime,label:String(label||(mode==="audio"?"Audio":"Video")).slice(0,90)});
  };
  const readAttrs=tag=>{
    const attrs={};
    for(const match of String(tag||"").matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[match[1].toLowerCase()]=match[2]??match[3]??match[4]??"";
    return attrs;
  };
  const meta={};
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
    // Keep Open Graph parsing independent from the broader HTML attribute parser.
    // Some public pages reorder attributes or use punctuation-heavy OG property names.
    const keyMatch=tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch=tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    const key=String(keyMatch?.[1]||"").toLowerCase();
    if(key&&contentMatch?.[1]){
      if(!meta[key])meta[key]=[];
      meta[key].push(contentMatch[1]);
    }
  }
  const metaValues=value=>Array.isArray(value)?value:(value?[value]:[]);
  const videoKeys=["og:video","og:video:url","og:video:secure_url","twitter:player:stream","twitter:player:stream:url"];
  const audioKeys=["og:audio","og:audio:url","og:audio:secure_url","twitter:audio:src"];
  const videoMime=metaValues(meta["og:video:type"])[0]||metaValues(meta["twitter:player:stream:content_type"])[0]||"";
  const audioMime=metaValues(meta["og:audio:type"])[0]||"";
  for(const key of videoKeys)for(const raw of metaValues(meta[key]))add(raw,"video",videoMime,"Video");
  for(const key of audioKeys)for(const raw of metaValues(meta[key]))add(raw,"audio",audioMime,"Audio");
  for(const tag of html.match(/<(?:video|audio|source)\b[^>]*>/gi)||[]){
    const attrs=readAttrs(tag),tagName=String(tag.match(/^<\s*(video|audio|source)/i)?.[1]||"").toLowerCase();
    const src=attrs.src||attrs["data-src"]||attrs["data-url"]||attrs["data-original"]||"";
    if(!src)continue;
    const mode=tagName==="audio"||String(attrs.type||"").toLowerCase().startsWith("audio/")?"audio":"video";
    add(src,mode,attrs.type||"",mode==="audio"?"Audio":"Video");
  }
  const walk=(value,parentType="",depth=0)=>{
    if(depth>10||value==null)return;
    if(Array.isArray(value)){for(const item of value.slice(0,80))walk(item,parentType,depth+1);return}
    if(typeof value!=="object")return;
    const type=[parentType,value["@type"],value.type].filter(Boolean).join(" ").toLowerCase();
    for(const [key,item] of Object.entries(value)){
      if(typeof item==="string"){
        if(/^(?:videoUrl|video_url|playUrl|play_url|downloadUrl|download_url|streamUrl|stream_url)$/i.test(key)||(key==="contentUrl"&&type.includes("video")))add(item,"video",value.encodingFormat||value.fileFormat||"","Video");
        if(/^(?:audioUrl|audio_url|audioDownloadUrl|audio_download_url|musicUrl|music_url|musicDownloadUrl|music_download_url|soundUrl|sound_url|originalAudioUrl|original_audio_url|playableUrl|playable_url)$/i.test(key)||(key==="contentUrl"&&type.includes("audio")))add(item,"audio",value.encodingFormat||value.fileFormat||value.mimeType||"","Audio / soundtrack");
      }else if(item&&typeof item==="object")walk(item,type,depth+1);
    }
  };
  const scripts=html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
  for(const script of scripts){
    const body=script.replace(/^<script\b[^>]*>/i,"").replace(/<\/script>$/i,"").trim();
    let parsed=null;try{parsed=JSON.parse(body)}catch{const first=body.indexOf("{"),last=body.lastIndexOf("}");if(first>=0&&last>first)try{parsed=JSON.parse(body.slice(first,last+1))}catch{}}
    if(parsed)walk(parsed);
  }
  const decoded=decode(html);
  const patterns=[
    {regex:/"(?:contentUrl|videoUrl|video_url|playUrl|play_url|downloadUrl|download_url|streamUrl|stream_url)"\s*:\s*"((?:\\.|[^"\\])+)"/gi,mode:"video"},
    {regex:/"(?:audioUrl|audio_url|audioDownloadUrl|audio_download_url|musicUrl|music_url|musicDownloadUrl|music_download_url|soundUrl|sound_url|originalAudioUrl|original_audio_url|playableUrl|playable_url)"\s*:\s*"((?:\\.|[^"\\])+)"/gi,mode:"audio"}
  ];
  for(const pattern of patterns)for(const match of decoded.matchAll(pattern.regex))add(match[1],pattern.mode,"",pattern.mode==="audio"?"Audio":"Video");
  return output.slice(0,20);
}
async function genericPublicPageMediaInfo(rawUrl,requestUrl,platformEntry,timeoutMs=11000){
  try{
    const page=await fetchSocialPostHtml(rawUrl,timeoutMs);
    const titleMatch=page.html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']{1,300})["']/i)||page.html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
    const title=String(titleMatch?.[1]||platformEntry.name+" media").replace(/&amp;/gi,"&").slice(0,300);
    const thumbnail=extractSocialImageCandidates(page.html,page.url,platformEntry.id)[0]?.url||null;
    const media=extractGenericPublicMediaCandidates(page.html,page.url);
    const dimensions=extractSocialVideoDimensions(page.html);
    const normalized=freeProviderMediaInfo({normalized:{title,thumbnail,media,...dimensions}},rawUrl,requestUrl);
    if(!normalized)return json({ok:false,platform:platformEntry.id,title,thumbnail,providerName:"Public page metadata fallback",provider:"Generic public metadata",experimental:true,fallbackTried:true,directDownloadAvailable:false,error:platformEntry.name+" tidak mengekspos file video/audio langsung pada halaman publik. Konten privat, DRM, atau player streaming memerlukan extractor khusus."},502);
    return json({...normalized,...dimensions,platform:platformEntry.id,providerName:"Public page metadata fallback",provider:"Generic public metadata",extractor:"Public page metadata",fallbackUsed:true,experimental:true,directDownloadAvailable:true,canonicalUrl:page.url},200);
  }catch(error){
    return json({ok:false,platform:platformEntry.id,providerName:"Public page metadata fallback",provider:"Generic public metadata",experimental:true,fallbackTried:true,directDownloadAvailable:false,error:platformEntry.name+" belum dapat dibaca melalui jalur metadata publik: "+String(error?.message||error).slice(0,180)},502);
  }
}
async function platformMediaInfo(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const raw=String(body?.url||"").trim();
  if(raw.length>3000)return json({error:"Tautan terlalu panjang."},400);
  let parsed;try{parsed=new URL(raw)}catch{return json({error:"Tautan tidak valid."},400)}
  if(!["http:","https:"].includes(parsed.protocol)||parsed.username||parsed.password||parsed.port)return json({error:"Gunakan tautan publik HTTP/HTTPS yang valid."},400);
  const platformEntry=platformForHost(parsed.hostname);
  if(parsed.protocol==="http:"&&platformEntry)parsed.protocol="https:";
  if(!platformEntry)return json({ok:false,error:"GAGAL — domain tautan tidak dikenali sebagai platform yang didukung."},400);
  const key=platformEntry.providerKey;
  const expected=String(body?.expectedPlatform||"").toLowerCase();
  if(!expected||expected==="all")return json({ok:false,error:"Pilih satu platform khusus. AI Search lintas platform tidak menggunakan endpoint unduhan ini."},400);
  const expectedEntry=PLATFORM_CATALOG_BY_ID.get(expected);
  if(key==="aio"){
    if(!expectedEntry||expectedEntry.id!==platformEntry.id)return json({ok:false,error:"GAGAL — tautan "+platformEntry.name+" tidak sesuai dengan platform yang dipilih."},400);
    return genericPublicPageMediaInfo(parsed.href,request.url,platformEntry,body?.fast===true?5200:11000);
  }
  const normalizedExpected=expectedEntry?.providerKey||({x:"twitter",twitter:"twitter",instagramlite:"instagram",facebooklite:"facebook",tiktoklite:"tiktok"})[expected]||expected;
  if(normalizedExpected!==key)return json({ok:false,error:"GAGAL — tautan "+key+" ditolak karena endpoint ini khusus untuk "+normalizedExpected+"."},400);
  return freePublicMediaInfo(parsed.href,request.url,{fast:body?.fast===true});
}
async function snackVideoNativePageFallback(rawUrl,requestUrl,timeoutMs=8500){
  const response=await fetch(rawUrl,{
    redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(timeoutMs),
    headers:{
      "user-agent":"Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      "accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language":"id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });
  if(!response.ok)throw new Error("Halaman SnackVideo menjawab HTTP "+response.status+".");
  const finalUrl=response.url||rawUrl;
  const finalHost=new URL(finalUrl).hostname.toLowerCase();
  if(!/(^|\.)(snackvideo\.com|kwai\.com|kuaishou\.com)$/.test(finalHost))throw new Error("Redirect keluar dari domain SnackVideo/Kwai ditolak.");
  let html=await response.text();
  if(html.length>5000000)html=html.slice(0,5000000);
  const decoded=html.replaceAll("\\/","/").replaceAll("&amp;","&").replaceAll("\\u002F","/").replaceAll("\\u002f","/").replaceAll("\\u0026","&").replaceAll("\\u003D","=").replaceAll("\\u003d","=");
  const candidates=[];
  const add=value=>{
    if(typeof value!=="string"||!value.trim())return;
    let candidate=value.trim().replaceAll("\\/","/").replaceAll("&amp;","&").replaceAll("\\u0026","&");
    if(candidate.startsWith("//"))candidate="https:"+candidate;
    if(safePublicMediaUrl(candidate)&&/\.(?:mp4|m3u8)(?:[?#]|$)/i.test(candidate))candidates.push(candidate);
  };
  const keyPattern=/"(?:playUrl|play_url|videoUrl|video_url|mainMvUrl|main_mv_url|downloadUrl|download_url)"\s*:\s*"([^"]{12,2000})"/gi;
  for(const match of decoded.matchAll(keyPattern))add(match[1]);
  const mediaPattern=/https?:\/\/[^"'\\\s<>]{8,2500}?(?:kwai\.net|snackvideo|kwai-cdn)[^"'\\\s<>]{0,1500}?\.(?:mp4|m3u8)(?:\?[^"'\\\s<>]*)?/gi;
  for(const match of decoded.matchAll(mediaPattern))add(match[0]);
  const titleMatch=decoded.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  const ogTitle=decoded.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,300})["']/i);
  const ogImage=decoded.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{1,1200})["']/i);
  const canonical=decoded.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const title=String(ogTitle?.[1]||titleMatch?.[1]||"Video SnackVideo").replace(/\s*[-|]\s*SnackVideo.*$/i,"").slice(0,300);
  const thumbnail=String(ogImage?.[1]||"");
  const durationMatch=decoded.match(/"(?:duration|durationSeconds|duration_seconds|videoDuration|video_duration|durationMs|duration_ms)"\s*:\s*(\d+(?:\.\d+)?)/i)||decoded.match(/<meta[^>]+(?:property|name)=["']video:duration["'][^>]+content=["'](\d+(?:\.\d+)?)["']/i);
  let duration=Number(durationMatch?.[1]||0)||null;
  if(duration&&/(?:durationMs|duration_ms)/i.test(durationMatch?.[0]||""))duration/=1000;
  if(duration&&duration>86400)duration/=1000;
  const unique=[...new Set(candidates)];
  if(!unique.length)throw new Error("Halaman publik berhasil dibuka, tetapi URL stream MP4 tidak ditemukan pada HTML.");
  const media=unique.slice(0,12).map((url,index)=>({type:"video",kind:"video",label:"MP4"+(index?" alternatif "+(index+1):""),url}));
  const normalized=freeProviderMediaInfo({normalized:{title,thumbnail,duration,media}},rawUrl,requestUrl);
  if(!normalized)throw new Error("Stream dari halaman SnackVideo tidak lolos validasi media.");
  normalized.providerName="SnackVideo native page fallback";
  normalized.provider="Direct public page";
  normalized.fallbackUsed=true;
  normalized.canonicalUrl=canonical?.[1]||finalUrl;
  return json(normalized);
}
async function snackVideoFallbackMediaInfo(rawUrl,requestUrl){
  const tasks=[
    (async()=>{
      const endpoint=new URL("https://backend1.tioo.eu.org/api/downloader/snackvideo");
      endpoint.searchParams.set("url",rawUrl);
      const response=await fetch(endpoint.href,{headers:{accept:"application/json"},signal:AbortSignal.timeout(6500),cache:"no-store"});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data||data.status===false||data.success===false)throw new Error("Provider alternatif Tioo HTTP "+response.status+".");
      const root=data.result&&typeof data.result==="object"?data.result:data.data&&typeof data.data==="object"?data.data:data;
      const links=Array.isArray(root.links)?root.links:Array.isArray(root.downloads)?root.downloads:[];
      const candidates=[root.videoUrl,root.video_url,root.download_url,root.downloadUrl,root.result?.videoUrl,root.result?.video_url,root.result?.download_url,...links.map(item=>typeof item==="string"?item:item?.url||item?.videoUrl||item?.download_url)].filter(value=>typeof value==="string"&&value.trim());
      const videoUrl=candidates.find(value=>safePublicMediaUrl(value));
      if(!videoUrl)throw new Error("Provider Tioo tidak memberikan URL video publik.");
      const title=String(root.title||root.caption||root.description||"Video SnackVideo").slice(0,300);
      const thumbnail=String(root.thumbnail||root.cover||"");
      const duration=Number(root.duration||0)||null;
      const quality=String(root.quality||root.resolution||"MP4");
      const media=[{type:"video",kind:"video",label:quality+" MP4",url:videoUrl,height:Number(String(quality).match(/(144|240|360|480|540|576|720|900|960|1080|1440|2160)/)?.[1]||0)||undefined}];
      const normalized=freeProviderMediaInfo({normalized:{title,thumbnail,duration,media}},rawUrl,requestUrl);
      if(!normalized)throw new Error("Stream Tioo tidak lolos validasi media.");
      normalized.providerName="Tioo SnackVideo fallback";
      normalized.provider="Free public fallback";
      normalized.fallbackUsed=true;
      return normalized;
    })(),
    snackVideoNativePageFallback(rawUrl,requestUrl,8500).then(response=>response.json()).then(data=>{
      if(!data?.ok||!Array.isArray(data.formats)||!data.formats.length)throw new Error(data?.error||"Native page tidak menemukan MP4.");
      return data;
    })
  ];
  try{
    const fastest=await Promise.any(tasks);
    fastest.fallbackUsed=true;
    return json(fastest);
  }catch(error){
    const errors=(error?.errors||[]).map(item=>String(item?.message||item).slice(0,150));
    throw new Error(errors.join(" | ")||"Semua jalur publik SnackVideo gagal.");
  }
}

function extractSocialVideoDuration(html){
  const decoded=String(html||"").replaceAll("\\u0022",'"').replaceAll("\\u003A",":").replaceAll("\\u003a",":").replaceAll("\\u002F","/").replaceAll("\\/", "/").replaceAll("&quot;",'"');
  const candidates=[];
  const pattern=/"(durationMs|duration_ms|durationSeconds|duration_seconds|videoDuration|video_duration|lengthSeconds|length_seconds|duration)"\s*:\s*(\d+(?:\.\d+)?)/gi;
  for(const match of decoded.matchAll(pattern)){
    let seconds=Number(match[2]);
    if(/ms/i.test(match[1])||seconds>86400)seconds/=1000;
    if(seconds>0&&seconds<=86400)candidates.push(seconds);
  }
  const meta=decoded.match(/<meta[^>]+(?:property|name)=["']video:duration["'][^>]+content=["'](\d+(?:\.\d+)?)["']/i);
  if(meta){const seconds=Number(meta[1]);if(seconds>0&&seconds<=86400)candidates.push(seconds);}
  return candidates.find(seconds=>seconds>=1&&seconds<=3600)||candidates[0]||null;
}

function extractSocialVideoDimensions(html){
  const source=String(html||"").replaceAll("\\u0022",'"').replaceAll("\\u003A",":").replaceAll("\\u003a",":").replaceAll("\\u002F","/").replaceAll("\\/","/").replaceAll("&quot;",'"');
  const meta={};
  for(const tag of source.matchAll(/<meta\b[^>]*>/gi)){
    const attrs={};
    for(const match of tag[0].matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[match[1].toLowerCase()]=match[2]??match[3]??match[4]??"";
    const key=String(attrs.property||attrs.name||"").toLowerCase();
    if(key&&attrs.content)meta[key]=attrs.content;
  }
  const number=value=>{const parsed=Number(String(value||"").match(/\d{2,5}/)?.[0]||0);return parsed>=100&&parsed<=20000?parsed:0};
  let width=number(meta["og:video:width"]||meta["video:width"]||meta["twitter:player:width"]);
  let height=number(meta["og:video:height"]||meta["video:height"]||meta["twitter:player:height"]);
  if(!width||!height){
    const directWidth=source.match(/"(?:videoWidth|video_width|video_width_px)"\s*:\s*["']?(\d{2,5})/i);
    const directHeight=source.match(/"(?:videoHeight|video_height|video_height_px)"\s*:\s*["']?(\d{2,5})/i);
    width=width||number(directWidth?.[1]);height=height||number(directHeight?.[1]);
  }
  if(!width||!height){
    const objects=[...source.matchAll(/"(?:video|videoInfo|video_info|videoData|video_data)"\s*:\s*\{([^{}]{0,12000})\}/gi)];
    for(const object of objects){
      const objectWidth=number(object[1].match(/"width"\s*:\s*["']?(\d{2,5})/i)?.[1]);
      const objectHeight=number(object[1].match(/"height"\s*:\s*["']?(\d{2,5})/i)?.[1]);
      if(objectWidth&&objectHeight){width=width||objectWidth;height=height||objectHeight;break;}
    }
  }
  return width&&height?{width,height,aspectRatio:width/height}:{};
}
async function enrichTikTokDuration(info,canonicalUrl){
  if(!info||Number(info.duration)>0)return info;
  try{
    const page=await fetchSocialPostHtml(canonicalUrl,9000);
    const duration=extractSocialVideoDuration(page.html);
    if(duration)info.duration=duration;
  }catch{}
  return info;
}

async function enrichInstagramDuration(info,canonicalUrl){
  if(!info||Number(info.duration)>0||info.imageOnly===true)return info;
  const hasVideo=String(info.type||"").toLowerCase()==="video"||(Array.isArray(info.formats)&&info.formats.some(item=>item?.mode==="video"));
  if(!hasVideo)return info;
  try{
    const page=await fetchSocialPostHtml(canonicalUrl,9000);
    const duration=extractSocialVideoDuration(page.html);
    if(duration)info.duration=duration;
  }catch{}
  return info;
}
function tikTokUrlCandidates(rawUrl,canonicalUrl){
  const candidates=[],seen=new Set();
  const add=value=>{
    const safe=safePublicMediaUrl(value);
    if(!safe||platformIdForUrl(safe.href)!=="tiktok"||seen.has(safe.href))return;
    seen.add(safe.href);candidates.push(safe.href);
  };
  const canonical=String(canonicalUrl||"");
  const photoMatch=canonical.match(/^https:\/\/www\.tiktok\.com\/@([^/]+)\/photo\/(\d{8,})/i)||canonical.match(/^https:\/\/www\.tiktok\.com\/photo\/(\d{8,})/i);
  if(photoMatch){
    const username=photoMatch.length===3?photoMatch[1]:"";
    const itemId=photoMatch.length===3?photoMatch[2]:photoMatch[1];
    if(username)add("https://www.tiktok.com/@"+username+"/video/"+itemId);
    add("https://www.tiktok.com/video/"+itemId);
  }
  add(canonicalUrl);
  add(rawUrl);
  for(const value of candidates.slice()){
    let url;try{url=new URL(value)}catch{continue}
    const match=url.pathname.match(/^\/(?:@[^/]*\/)?(?:video|photo)\/(\d{8,})/i);
    if(match){
      add("https://www.tiktok.com/video/"+match[1]);
      add("https://www.tiktok.com/@/video/"+match[1]);
    }
  }
  return candidates;
}
async function freePublicMediaInfo(rawUrl,requestUrl,options={}){
  const fast=options.fast===true;
  const key=freePlatformKey(rawUrl);
  if(!key)return json({error:"Platform belum didukung oleh provider gratis."},400);
  const labels={tiktok:"TikTok",instagram:"Instagram",snackvideo:"SnackVideo",capcut:"CapCut",pinterest:"Pinterest",facebook:"Facebook",twitter:"X",reddit:"Reddit",vimeo:"Vimeo",threads:"Threads",soundcloud:"SoundCloud"};
  const label=platformForHost(new URL(rawUrl).hostname)?.name||labels[key]||key;
  const guidance={
    tiktok:"Jika video bisa diputar tanpa login, salin ulang tautan dari menu Bagikan. Video privat, LIVE, dibatasi umur/wilayah, atau memerlukan login tidak dapat diambil oleh provider publik.",
    instagram:"Pastikan Reels/postingan berupa video dan dapat dilihat publik. Akun privat, Story yang dibatasi, atau konten yang memerlukan login tidak dapat diekstrak.",
    snackvideo:"Gunakan tautan share video publik, bukan halaman profil atau halaman aplikasi.",
    capcut:"Gunakan tautan share hasil video yang dapat diputar publik. Draft pribadi dan template/proyek yang belum diekspor bukan file MP4 yang bisa diunduh.",
    pinterest:"Gunakan tautan Pin publik yang berisi video; Pin gambar tidak dapat diunduh sebagai MP4.",
    facebook:"Gunakan tautan postingan publik. Postingan foto diproses melalui ekstraksi gambar, sedangkan lagu hanya dapat diunduh jika halaman publik menyediakan stream audio langsung. Postingan privat, login-only, DRM, atau musik yang tidak diekspos sebagai file audio tidak dapat dipaksa diunduh.",
    twitter:"Gunakan tautan post X yang memuat video publik; post teks atau gambar tidak menghasilkan MP4.",
    reddit:"Gunakan post Reddit atau v.redd.it yang memuat video publik; beberapa video memakai audio terpisah.",
    vimeo:"Gunakan video Vimeo publik yang tidak dibatasi password atau pengaturan privasi.",
    threads:"Gunakan post Threads publik yang benar-benar memuat video.",
    soundcloud:"SoundCloud diproses sebagai audio (MP3/M4A jika tersedia), bukan video MP4."
  };
  let canonicalUrl=rawUrl,resolutionError="";
  try{canonicalUrl=await resolveSocialShortLink(rawUrl,key,fast?5200:(key==="tiktok"?8000:key==="facebook"?9500:11000))}
  catch(error){
    resolutionError=String(error?.message||error).slice(0,180);
    if(key==="facebook"&&resolutionError==="facebook_login_required")
      return json({ok:false,error:"Facebook meminta login untuk membaca postingan ini. ARYANZZ hanya dapat memproses tautan yang dapat diakses publik tanpa login.",errorType:"login_required",providerName:"Facebook public resolver",provider:"Public Reader",fallbackTried:true},403);
  }
  const isTikTokPhotoRoute=key==="tiktok"&&(()=>{try{return /\/photo\//i.test(new URL(canonicalUrl).pathname)}catch{return false}})();
  const providerUrls=key==="tiktok"?(isTikTokPhotoRoute?[canonicalUrl]:tikTokUrlCandidates(rawUrl,canonicalUrl)):[canonicalUrl];
  if(key==="snackvideo"){
    try{return await snackVideoFallbackMediaInfo(canonicalUrl,requestUrl)}
    catch(error){return json({error:"SnackVideo belum dapat diproses melalui dua jalur publik yang diuji paralel: "+String(error?.message||error).slice(0,300)+". Pastikan tautan share video dapat dibuka tanpa login.",provider:"Concurrent public fallback cascade",fallbackTried:true},502)}
  }
  let primaryError=resolutionError;
  try{
    let response=null,data={},attempts=fast?1:(key==="instagram"?2:1);
    const primaryTargets=key==="tiktok"?providerUrls.slice(0,fast?1:4)
      :(key==="threads"||key==="twitter")?[...new Set([canonicalUrl,rawUrl])].slice(0,2):[canonicalUrl];
    const primaryResults=await Promise.allSettled(primaryTargets.map(async targetUrl=>{
      let candidateResponse=null,candidateData={};
      for(let attempt=0;attempt<attempts;attempt++){
        try{
          const endpoint=FREE_MEDIA_API+"/api/download/"+key+"?url="+encodeURIComponent(targetUrl);
          candidateResponse=await fetch(endpoint,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",...(key==="instagram"?{referer:"https://www.instagram.com/"}:{})},signal:AbortSignal.timeout(fast?5500:(key==="snackvideo"?12000:key==="tiktok"?10000:14000)),cache:"no-store"});
          candidateData=await candidateResponse.json().catch(()=>({}));
          if(candidateResponse.ok||candidateResponse.status<500||attempt===attempts-1)break;
        }catch(error){
          if(attempt===attempts-1)throw error;
        }
        await new Promise(resolve=>setTimeout(resolve,650));
      }
      return {response:candidateResponse,data:candidateData,targetUrl};
    }));
    const fulfilled=primaryResults.filter(item=>item.status==="fulfilled").map(item=>item.value);
    // A 200 OK with no playable media is not a successful extraction. Prefer the
    // candidate that actually contains a normalized media format.
    const chosen=fulfilled.find(item=>item.response?.ok&&item.data?.success!==false&&freeProviderMediaInfo(item.data,canonicalUrl,requestUrl))
      ||fulfilled.find(item=>item.response?.ok)||fulfilled[0];
    if(chosen){response=chosen.response;data=chosen.data;}
    else if(primaryResults.length)primaryError=String(primaryResults[0].reason?.message||primaryResults[0].reason||"Provider utama gagal").slice(0,180);
    if(response?.ok&&data?.success!==false){
      const normalized=freeProviderMediaInfo(data,canonicalUrl,requestUrl);
      if(normalized){
        if(key==="instagram"&&!fast){
          try{
            const alternative=normalizeWeirdDlInstagramData(await fetchWeirdDlInstagramData(canonicalUrl,9000),canonicalUrl,requestUrl);
            if(alternative){
              await enrichInstagramDuration(alternative,canonicalUrl);
              return json({...alternative,canonicalUrl:canonicalUrl!==rawUrl?canonicalUrl:undefined});
            }
          }catch{}
          await enrichInstagramDuration(normalized,canonicalUrl);
        }
        // Photo Mode needs strict media signature checks even on the quick path;
        // video/photo spoofing must never be traded for speed.
        if(key==="tiktok"&&fast&&isTikTokPhotoRoute)await verifyTikTokPhotoVideoFormats(normalized,canonicalUrl);
        if(key==="tiktok"&&!fast){
          if(!isTikTokPhotoRoute){
            try{
              const fallback=await tikwmFallbackMediaInfo(canonicalUrl,requestUrl,providerUrls.filter(value=>value!==canonicalUrl));
              const seen=new Set(),combined=[];
              for(const item of [...(fallback.formats||[]),...(normalized.formats||[])]){
                const identity=String(item?.downloadUrl||item?.url||"")+"|"+String(item?.mode||"");
                if(!item?.downloadUrl||seen.has(identity))continue;
                seen.add(identity);combined.push(item);
              }
              if(combined.length)normalized.formats=combined;
              normalized.fallbackUsed=true;
              normalized.providerName=[fallback.providerName,normalized.providerName].filter(Boolean).join(" + ");
              normalized.title=normalized.title||fallback.title;
              normalized.duration=Number(normalized.duration)||Number(fallback.duration)||null;
            }catch(error){normalized.fallbackDiagnostic=String(error?.message||error).slice(0,180)}
          }
          await verifyTikTokPhotoVideoFormats(normalized,canonicalUrl);
          if(!isTikTokPhotoRoute)await enrichTikTokDuration(normalized,canonicalUrl);
        }
        return json({...normalized,fastResponse:fast,canonicalUrl:canonicalUrl!==rawUrl?canonicalUrl:undefined});
      }
      primaryError="Provider utama tidak mengembalikan stream video/audio yang valid.";
    }else{
      const detail=data?.error?.message||data?.error||"HTTP "+(response?.status||502);
      primaryError=String(detail).slice(0,140);
    }
  }catch(error){primaryError=String(error?.message||error).slice(0,140)}
  if(key==="facebook"){
    try{
      const response=await facebookPublicReaderMediaInfo(canonicalUrl,requestUrl,8500);
      const fallback=await response.clone().json().catch(()=>({}));
      if(response.ok&&fallback.ok&&Array.isArray(fallback.formats)&&fallback.formats.length)
        return json({...fallback,providerName:"Facebook public-reader fallback",provider:"HTML media fallback",fallbackUsed:true,primaryProviderError:primaryError.slice(0,300)});
      if(response.status===403)return response;
      primaryError+="; Facebook public reader: "+String(fallback.error||"tidak menemukan stream video langsung").slice(0,220);
    }catch(error){primaryError+="; Facebook public reader: "+String(error?.message||error).slice(0,180)}
  }
  if(key==="tiktok"&&isTikTokPhotoRoute){
    const photoItemId=extractTikTokItemId(canonicalUrl);
    if(photoItemId){
      const player=new URL("https://www.tiktok.com/player/v1/"+photoItemId);
      for(const [name,value] of Object.entries({controls:"1",timestamp:"1",description:"1",music_info:"1",rel:"0"}))player.searchParams.set(name,value);
      return json({ok:true,platform:"tiktok",title:"TikTok Photo Mode",duration:null,formats:[],embedUrl:player.href,embedId:photoItemId,providerName:"TikTok Photo Mode · official embed",providerReady:true,directDownloadAvailable:false,downloadMessage:"Pemutar resmi TikTok tersedia. Provider publik belum memberikan foto asli atau stream MP4 yang lolos validasi.",canonicalUrl:canonicalUrl!==rawUrl?canonicalUrl:undefined,diagnostics:primaryError.slice(0,900)},200);
    }
  }
  if(key==="tiktok"){
    try{
      const fallback=await tikwmFallbackMediaInfo(canonicalUrl,requestUrl,providerUrls.filter(value=>value!==canonicalUrl));
      await verifyTikTokPhotoVideoFormats(fallback,canonicalUrl);
      await enrichTikTokDuration(fallback,canonicalUrl);
      return json({...fallback,canonicalUrl:canonicalUrl!==rawUrl?canonicalUrl:undefined});
    }catch(error){
      primaryError+="; TikTok fallback: "+String(error?.message||error).slice(0,900);
    }
  }
  // Attempt TikTok's public item metadata and page extraction before generic scraping.
  // This path was implemented but not previously wired into the fallback cascade.
  if(key==="tiktok"&&!isTikTokPhotoRoute){
    try{
      const nativeData=await tikTokNativePageFallback(canonicalUrl,requestUrl,7000);
      if(nativeData?.ok!==false&&Array.isArray(nativeData.formats)&&nativeData.formats.some(item=>item?.downloadUrl||item?.url)){
        return json({...nativeData,providerName:"TikTok native public metadata fallback",fallbackUsed:true,canonicalUrl:canonicalUrl!==rawUrl?canonicalUrl:undefined});
      }
      primaryError+="; TikTok native: no verified direct media";
    }catch(error){primaryError+="; TikTok native: "+String(error?.message||error).slice(0,180)}
  }
  if(key==="tiktok"&&!isTikTokPhotoRoute){
    try{
      const entry=platformForHost(new URL(canonicalUrl).hostname)||platformForHost(new URL(rawUrl).hostname);
      const response=await genericPublicPageMediaInfo(canonicalUrl,requestUrl,entry,6500);
      const fallback=await response.json().catch(()=>({}));
      if(response.ok&&fallback.ok&&Array.isArray(fallback.formats)&&fallback.formats.length){
        return json({...fallback,providerName:"TikTok public-page fallback",provider:"HTML media fallback",fallbackUsed:true,primaryProviderError:primaryError.slice(0,300)});
      }
      primaryError+="; TikTok HTML fallback: "+String(fallback.error||"no direct media").slice(0,140);
    }catch(error){primaryError+="; TikTok HTML fallback: "+String(error?.message||error).slice(0,140)}
  }
  if(key==="tiktok"){
    const embedTargets=[...new Set([rawUrl,canonicalUrl,...providerUrls])].slice(0,3);
    const embedResults=await Promise.allSettled(embedTargets.map(target=>fetchTikTokOEmbed(target,6500)));
    const available=embedResults.find(item=>item.status==="fulfilled");
    if(available){
      const embed=available.value;
      return json({
        ok:true,platform:"tiktok",title:embed.title||"Video TikTok",extractor:"TikTok Embed Player",
        thumbnail:embed.thumbnail||null,duration:null,formats:[],embedUrl:embed.embedUrl,embedId:embed.id,
        embedAuthor:embed.author||null,providerName:"TikTok Embed Player",providerReady:true,
        directDownloadAvailable:false,
        downloadMessage:"Player resmi TikTok tersedia, tetapi provider publik belum memberikan file MP4 langsung untuk tautan ini.",
        canonicalUrl:canonicalUrl!==rawUrl?canonicalUrl:undefined,
        diagnostics:primaryError.slice(0,900)
      },200);
    }
    const embedErrors=embedResults.filter(item=>item.status==="rejected").map(item=>String(item.reason?.message||item.reason).slice(0,100));
    if(embedErrors.length)primaryError+="; TikTok oEmbed: "+embedErrors.join(" | ").slice(0,260);
  }
  if(key==="instagram"){
    try{
      const fallback=normalizeWeirdDlInstagramData(await fetchWeirdDlInstagramData(canonicalUrl,9000),canonicalUrl,requestUrl);
      if(fallback){
        await enrichInstagramDuration(fallback,canonicalUrl);
        return json({...fallback,canonicalUrl:canonicalUrl!==rawUrl?canonicalUrl:undefined});
      }
    }catch(error){primaryError+="; WeirdDL: "+String(error?.message||error).slice(0,120)}
  }
  if(key==="snackvideo"){
    try{return await snackVideoFallbackMediaInfo(canonicalUrl,requestUrl)}
    catch(error){
      try{
        const entry=platformForHost(new URL(canonicalUrl).hostname);
        const response=await genericPublicPageMediaInfo(canonicalUrl,requestUrl,entry,7500);
        const fallback=await response.json().catch(()=>({}));
        if(response.ok&&fallback.ok&&Array.isArray(fallback.formats)&&fallback.formats.length)return json({...fallback,providerName:"SnackVideo public-page fallback",provider:"HTML media fallback",fallbackUsed:true});
      }catch{}
      return json({error:"SnackVideo belum dapat diproses. Provider utama: "+(primaryError||"gagal")+"; provider alternatif: "+String(error?.message||error).slice(0,150)+". "+guidance[key],provider:"Fallback cascade",fallbackTried:true},502);
    }
  }
  if(key!=="youtube"&&key!=="tiktok"&&key!=="snackvideo"&&key!=="facebook"){
    try{
      const entry=platformForHost(new URL(canonicalUrl).hostname)||platformForHost(new URL(rawUrl).hostname);
      if(entry){
        const response=await genericPublicPageMediaInfo(canonicalUrl,requestUrl,entry,7500);
        const fallback=await response.json().catch(()=>({}));
        if(response.ok&&fallback.ok&&Array.isArray(fallback.formats)&&fallback.formats.length){
          return json({...fallback,providerName:"Public page metadata fallback",provider:"HTML media fallback",fallbackUsed:true,primaryProviderError:primaryError.slice(0,300)});
        }
        primaryError+="; HTML metadata fallback: "+String(fallback.error||"tidak menemukan file media langsung").slice(0,180);
      }
    }catch(error){primaryError+="; HTML metadata fallback: "+String(error?.message||error).slice(0,160)}
  }
  const restricted=key==="tiktok"&&/protected|age.?restricted|status\s*10216|login required|requires login|private|Native TikTok metadata/i.test(primaryError);
  const userMessage=restricted
    ? "TikTok tidak mengirim stream video publik untuk tautan ini. Provider juga gagal mengambil metadata; video mungkin dibatasi usia, privasi, wilayah, atau memerlukan login. Coba tautan video lain yang dapat diputar tanpa login."
    : label+" belum bisa diproses oleh provider gratis. "+(primaryError||"Provider tidak mengembalikan hasil.").slice(0,320)+" "+(guidance[key]||"Periksa kembali tautan publik.");
  return json({ok:false,error:userMessage,diagnostics:primaryError.slice(0,1100),errorType:restricted?"source_unavailable_or_restricted":"provider_unavailable",provider:"Fallback cascade",fallbackTried:true,canonicalUrl:canonicalUrl!==rawUrl?canonicalUrl:undefined},502);
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
  const base=String(value||"aryanzz-media").replace(/[\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().slice(0,110).replace(/\.[a-z0-9]{2,5}$/i,"")||"aryanzz-media";
  return base+"."+ext;
}
async function fetchSocialHeaders(url,init,timeoutMs=25000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
async function fetchSocialUpstream(mediaUrl,sourceUrl,rangeHeader,options={}){
  const sourceOrigin=new URL(sourceUrl).origin,mediaOrigin=mediaUrl.origin;
  const baseHeaders={"user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36","accept":"video/*,audio/*,application/octet-stream;q=0.9,*/*;q=0.8"};
  const profiles=[
    {name:"source-referer",headers:{referer:sourceOrigin+"/",origin:sourceOrigin}},
    {name:"cdn-referer",headers:{referer:mediaOrigin+"/",origin:mediaOrigin}},
    {name:"no-referer",headers:{}}
  ];
  const uniqueProfiles=profiles.filter((profile,index,array)=>array.findIndex(item=>JSON.stringify(item.headers)===JSON.stringify(profile.headers))===index);
  const diagnostics=[];
  const attempt=async(profile,requestedRange)=>{
    let current=mediaUrl;
    for(let hop=0;hop<6;hop++){
      const headers={...baseHeaders,...profile.headers};
      if(requestedRange)headers.range=requestedRange;
      const response=await fetchSocialHeaders(current.href,{method:"GET",headers,redirect:"manual",cache:"no-store"},7500);
      if([301,302,303,307,308].includes(response.status)){
        const location=response.headers.get("location");
        if(!location){await response.body?.cancel().catch(()=>{});throw new Error("CDN media mengirim pengalihan tanpa alamat tujuan.");}
        const next=safePublicMediaUrl(new URL(location,current).href);
        if(!next){await response.body?.cancel().catch(()=>{});throw new Error("Pengalihan CDN menuju alamat yang tidak aman.");}
        current=next;continue;
      }
      const contentType=String(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
      const contentRange=String(response.headers.get("content-range")||"");
      const validRange=response.status!==206||/^bytes\s+\d+-\d+\/\d+$/i.test(contentRange);
      const errorMime=/^(text\/|application\/(?:json|xml|x-mpegurl))/i.test(contentType);
      if([200,206].includes(response.status)&&response.body&&!errorMime&&validRange&&(response.status!==206||requestedRange))return response;
      diagnostics.push(profile.name+" HTTP "+response.status+(contentType?" "+contentType:"")+(response.status===206&&!validRange?" invalid Content-Range":""));
      await response.body?.cancel().catch(()=>{});
      return null;
    }
    throw new Error("Terlalu banyak pengalihan dari CDN media.");
  };
  for(const profile of uniqueProfiles){
    try{const response=await attempt(profile,rangeHeader);if(response)return response;}
    catch(error){diagnostics.push(profile.name+": "+String(error?.message||error).slice(0,100));}
  }
  if(rangeHeader&&options.allowFullFallback===true){
    for(const profile of uniqueProfiles){
      try{const response=await attempt(profile,null);if(response)return response;}
      catch(error){diagnostics.push(profile.name+" tanpa Range: "+String(error?.message||error).slice(0,100));}
    }
  }
  throw new Error("CDN menolak variasi permintaan media"+(diagnostics.length?": "+diagnostics.slice(0,6).join("; ").slice(0,420):"."));
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
  const u=new URL(request.url),raw=u.searchParams.get("url")||"",source=u.searchParams.get("source")||"",mode=u.searchParams.get("mode")==="audio"?"audio":"video",requestedExt=String(u.searchParams.get("ext")||"mp4").toLowerCase(),filename=u.searchParams.get("filename")||"aryanzz-media",probeMode=String(u.searchParams.get("probe")||""),probe=probeMode==="1"||probeMode==="full",preview=u.searchParams.get("preview")==="1";
  const mediaUrl=safePublicMediaUrl(raw);
  if(!mediaUrl)return json({error:"Alamat media tidak valid atau tidak aman."},400);
  if(!isPlatformLink(source))return json({error:"Tautan sumber platform tidak valid."},400);
  if(!["mp4","webm","mov","m4v","avi","3gp","mp3","m4a","aac","opus","ogg","wav","flac"].includes(requestedExt))return json({error:"Ekstensi media tidak didukung."},400);
  const browserRange=request.headers.get("range");
  const rangeToRequest=browserRange||(probe&&probeMode!=="full"?"bytes=0-65535":null);
  const expectedHint=Math.floor(Number(u.searchParams.get("expected"))||0);
  if(expectedHint<0||expectedHint>500*1024*1024)return json({error:"Ukuran file yang diminta tidak valid."},400);
  let upstream=null,lastError="",lastStatus=0;
  try{upstream=await fetchSocialUpstream(mediaUrl,source,rangeToRequest,{allowFullFallback:probe&&probeMode!=="full"});}catch(error){lastError=String(error?.message||error).slice(0,420);}
  if(!upstream||![200,206].includes(upstream.status)||!upstream.body){
    if(upstream?.body)await upstream.body.cancel().catch(()=>{});
    const fallback=new URL("/api/fetch-media",FREE_MEDIA_API);
    fallback.searchParams.set("url",mediaUrl.href);
    fallback.searchParams.set("filename",socialFileName(filename,requestedExt));
    const fallbackRanges=rangeToRequest&&probe&&probeMode!=="full"?[rangeToRequest,null]:[rangeToRequest];
    for(const fallbackRange of fallbackRanges){
      const fallbackHeaders={accept:"*/*","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"};
      if(fallbackRange)fallbackHeaders.range=fallbackRange;
      try{
        const response=await fetchSocialHeaders(fallback.href,{headers:fallbackHeaders,cache:"no-store"},7500);
        const contentType=String(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
        const validPartial=response.status!==206||!!String(response.headers.get("content-range")||"").match(/^bytes\s+\d+-\d+\/\d+$/i);
        if([200,206].includes(response.status)&&response.body&&!/^(text\/|application\/(?:json|xml|x-mpegurl))/i.test(contentType)&&validPartial&&(response.status!==206||fallbackRange)){
          upstream=response;break;
        }
        lastStatus=response.status;
        lastError="Jalur provider cadangan HTTP "+response.status+(contentType?" "+contentType:"");
        await response.body?.cancel().catch(()=>{});
      }catch(error){lastError=String(error?.message||error).slice(0,180);}
    }
  }
  if(!upstream||![200,206].includes(upstream.status)||!upstream.body){
    return json({error:"Provider tidak mengirim file media utuh (HTTP "+(lastStatus||upstream?.status||502)+").",diagnostics:{mediaHost:mediaUrl.hostname,detail:lastError||"Semua jalur CDN dan provider cadangan gagal."}},502);
  }
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
    if(rangeStart===0&&prefixLength>=8){
      const signature=detectSocialMediaSignature(prefix,mode);
      detected=signature&&signature.mode===mode?signature:null;
    }
  }else if(rangeStart===0||!responseIsPartial)detected=detectSocialMediaSignature(prefix,mode);
  else if(responseIsPartial)detected=socialMimeForExtension(requestedExt,mode);
  if(!detected||detected.mode!==mode){
    const actual=detectSocialMediaSignature(prefix,"video")||detectSocialMediaSignature(prefix,"audio");
    const actualMime=actual?.mime||rawType||"signature media tidak dikenali";
    await reader.cancel().catch(()=>{});
    return json({error:"File ditolak: isi sumber terdeteksi sebagai "+actualMime+", bukan "+(mode==="audio"?"audio":"video")+" yang diminta. ARYANZZ tidak akan menyimpan file rusak dengan ekstensi palsu.",detectedMime:actual?.mime||rawType||null,requestedMode:mode},415);
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
  const platforms=PLATFORM_CATALOG.map(platform=>{
    const searchModes=platformSearchModes(platform.id);
    return {
      id:platform.id,name:platform.name,domains:platform.domains,aliasOf:platform.aliasOf||null,
      pasteLink:platform.pasteLink,titleSearch:searchModes.length>0,inputModes:platform.inputModes,preview:platform.preview,mediaModes:platform.mediaModes,
      searchModes,supportsVideoSearch:searchModes.includes("video"),supportsImageSearch:searchModes.includes("image"),
      mp4:platform.mp4,providerKey:platform.providerKey,extractorStatus:platform.extractorStatus,
      searchEnabled:searchModes.length>0
    };
  });
  const dedicated=platforms.filter(platform=>platform.extractorStatus==="dedicated").length;
  return json({
    ok:true,configured:false,backend:"public-community-api",mode:"zero-server",
    engine:"Cloudflare Worker + public free community extractor",
    platformCount:PLATFORM_CATALOG.length,dedicatedCount:dedicated,
    experimentalCount:PLATFORM_CATALOG.length-dedicated,platforms,
    searchablePlatformCounts:{
      video:new Set(platforms.filter(platform=>platform.searchModes.includes("video")&&!platform.aliasOf).map(platform=>platform.id)).size,
      image:new Set(platforms.filter(platform=>platform.searchModes.includes("image")&&!platform.aliasOf).map(platform=>platform.id)).size
    },
    liveAvailability:"Katalog tetap memuat 200 pilihan untuk deteksi tautan. Menu Cari Judul hanya menampilkan platform dengan provider khusus untuk jenis media yang dipilih; setiap hasil video atau gambar masih harus lolos pemeriksaan file aktual sebelum ditampilkan.",
    message:"Jumlah 200 adalah jumlah pilihan katalog, bukan klaim bahwa semuanya mendukung semua jenis media. Platform eksperimental tetap dapat dicoba melalui tempel tautan, tetapi tidak dimasukkan ke hasil Cari Judul video/gambar sampai memiliki jalur provider yang dapat diverifikasi."
  });
}
function decodeSearchHtml(value){
  return String(value||"").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g," ").trim();
}
function socialSearchDomains(platform){
  if(platform==="all")return PLATFORM_DOMAINS;
  return PLATFORM_CATALOG_BY_ID.get(platform)?.domains||[];
}
function platformIdForUrl(raw){
  try{return platformForHost(new URL(raw).hostname)?.id||null}catch{return null}
}
function canonicalPlatformId(id){
  const platform=PLATFORM_CATALOG_BY_ID.get(id);
  return platform?.aliasOf||id;
}
function platformSearchModes(id){
  const entry=PLATFORM_CATALOG_BY_ID.get(String(id||"").toLowerCase());
  const platform=entry?.aliasOf?PLATFORM_CATALOG_BY_ID.get(entry.aliasOf):entry;
  if(!platform||platform.providerKey==="aio")return [];
  return (platform.mediaModes||[]).filter(mode=>["video","image","audio"].includes(mode));
}
function platformSupportsSearchMode(id,mode){
  return platformSearchModes(id).includes(String(mode||"").toLowerCase());
}
function socialSearchQueryVariants(query){
  const original=String(query||"").replace(/\s+/g," ").trim();
  const normalized=original.normalize("NFKC").replace(/[#_]+/g," ").replace(/\s+/g," ").trim();
  const variants=[original,normalized];
  const lower=normalized.toLowerCase();
  const green=/green\s*screen|greenscreen|layar\s*hijau|chroma\s*key/.test(lower);
  const meme=/\bmeme(s)?\b|memes|meme lucu/.test(lower);
  const cat=/meme\s+kucing|kucing\s+meme|meme\s+cat|cat\s+meme|kucing/.test(lower);
  const audio=/\b(audio|lagu|musik|music|song|sound|suara|remix|dj|instrumental|ost)\b/.test(lower);
  const image=/\b(gambar|foto|image|photo|wallpaper|png|sticker|stiker)\b/.test(lower);
  const add=(...terms)=>variants.push(...terms);
  if(green){
    add(normalized.replace(/greenscreen/ig,"green screen").replace(/layar\s*hijau/ig,"green screen"));
    if(meme)add("green screen meme","green screen meme template","chroma key meme","greenscreen meme template","green screen reaction meme");
    else add("green screen video","green screen template","chroma key video","green screen overlay","green background video");
    if(cat)add("green screen cat meme","green screen meme kucing","cat green screen meme");
  }
  if(meme){
    add(normalized+" meme template",normalized+" reaction meme",normalized+" funny meme");
    if(cat)add("cat meme","funny cat meme","meme kucing lucu","kucing meme video");
  }
  if(audio)add(normalized+" audio",normalized+" full song",normalized+" instrumental",normalized+" remix");
  if(image)add(normalized+" image",normalized+" photo",normalized+" wallpaper",normalized+" png");
  if(!green&&!meme&&!audio&&!image){
    add(normalized+" video",normalized+" clips",normalized+" shorts",normalized+" tutorial");
  }
  const seen=new Set();
  return variants.map(value=>value.replace(/\s+/g," ").trim()).filter(value=>value.length>=2&&!seen.has(value.toLowerCase())&&seen.add(value.toLowerCase())).slice(0,12);
}
function socialSearchUrl(platform,query){
  const domains=socialSearchDomains(platform);if(!domains.length)return null;
  const site=domains.map(domain=>"site:"+domain).join(" OR ");
  const url=new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q",site+" "+query);
  return url;
}
function collectTikTokSearchItems(value,out,seen,depth=0){
  if(depth>14||!value||typeof value!=="object")return;
  if(Array.isArray(value)){for(const item of value)collectTikTokSearchItems(item,out,seen,depth+1);return}
  const id=String(value.id||value.video?.id||"");
  const desc=String(value.desc||value.video?.desc||"").trim();
  const author=value.author||value.authorInfo||value.video?.author||{};
  const username=String(author.uniqueId||author.unique_id||author.username||"").trim();
  if(/^\d{8,}$/.test(id)&&username&&desc){
    const url="https://www.tiktok.com/@"+encodeURIComponent(username)+"/video/"+id;
    if(!seen.has(url)){seen.add(url);out.push({title:desc,url,snippet:desc,platform:"tiktok",searchProvider:"TikTok public search"});}
  }
  for(const [key,item] of Object.entries(value))if(item&&typeof item==="object"&&key!=="author"&&key!=="authorInfo")collectTikTokSearchItems(item,out,seen,depth+1);
}
async function searchTikTokPublicPage(query){
  const url=new URL("https://www.tiktok.com/search/video");url.searchParams.set("q",query);
  try{
    const response=await fetch(url.href,{headers:{accept:"text/html,application/xhtml+xml","accept-language":"en-US,en;q=0.9,id;q=0.8","user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36","referer":"https://www.tiktok.com/"},signal:AbortSignal.timeout(9000),cache:"no-store"});
    const html=response.ok?await response.text():"";const items=[],seen=new Set();let universalDiagnostics={rootKeys:[],scopeKeys:[],searchScope:null,preview:""};
    for(const match of html.matchAll(/<script[^>]*id=["'](?:__UNIVERSAL_DATA_FOR_REHYDRATION__|SIGI_STATE)["'][^>]*>([\s\S]*?)<\/script>/gi)){
      try{
        const parsed=JSON.parse(match[1]);
        universalDiagnostics.rootKeys=Object.keys(parsed||{}).slice(0,30);
        const scope=parsed?.__DEFAULT_SCOPE__||{};universalDiagnostics.scopeKeys=Object.keys(scope).slice(0,60);
        const searchEntry=Object.entries(scope).find(([key])=>/search/i.test(key));
        if(searchEntry){universalDiagnostics.searchScope=searchEntry[0];universalDiagnostics.preview=JSON.stringify(searchEntry[1]).slice(0,2600)}
        collectTikTokSearchItems(parsed,items,seen);
      }catch{}
    }
    if(!items.length){
      for(const match of html.matchAll(/https?:\/\/www\.tiktok\.com\/@([A-Za-z0-9._-]+)\/video\/(\d{8,})/g)){
        const url="https://www.tiktok.com/@"+match[1]+"/video/"+match[2];if(seen.has(url))continue;seen.add(url);
        const at=Math.max(0,match.index-700),snippet=decodeSearchHtml(html.slice(at,match.index+500).replace(/<[^>]+>/g," ")).slice(0,260);
        items.push({title:snippet||"Video TikTok publik",url,snippet,platform:"tiktok",searchProvider:"TikTok public page"});
      }
    }
    const scriptIds=[...html.matchAll(/<script[^>]*id=["']([^"']+)["']/gi)].map(match=>match[1]).slice(0,20);
    const videoLinks=[...html.matchAll(/https?:\/\/www\.tiktok\.com\/@[A-Za-z0-9._-]+\/video\/\d{8,}/g)].map(match=>match[0]).slice(0,5);
    const pageTitle=decodeSearchHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
    return {items,status:response.status,bytes:html.length,pageTitle,scriptIds,videoLinks,hasUniversalData:html.includes("__UNIVERSAL_DATA_FOR_REHYDRATION__"),hasSigiState:html.includes("SIGI_STATE"),universalDiagnostics};
  }catch(error){return {items:[],status:0,bytes:0,error:String(error?.message||error).slice(0,100)}}
}
function decodeBingSocialResultUrl(raw){
  let link;try{link=new URL(decodeSearchHtml(raw),"https://www.bing.com")}catch{return null}
  if(link.hostname==="www.bing.com"||link.hostname==="bing.com"){
    const encoded=link.searchParams.get("u")||link.searchParams.get("url")||"";
    if(encoded.startsWith("a1")){
      try{let value=encoded.slice(2).replace(/-/g,"+").replace(/_/g,"/");while(value.length%4)value+="=";const target=new URL(atob(value));if(target.protocol==="https:")return target}catch{}
    }
  }
  return link;
}
function parseBingSocialVideoResults(html,platform,query,seen){
  const domains=socialSearchDomains(platform),out=[];
  for(const match of String(html||"").matchAll(/<li\b[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)){
    const block=match[1]||"",anchor=block.match(/<h2[^>]*>\s*<a\b([^>]*)>([\s\S]*?)<\/a>/i);if(!anchor)continue;
    const href=anchor[1].match(/\bhref=["']([^"']+)["']/i)?.[1];if(!href)continue;
    const link=decodeBingSocialResultUrl(href);if(!link)continue;
    if(link.protocol!=="https:"||!domains.some(domain=>link.hostname===domain||link.hostname.endsWith("."+domain)))continue;
    const key=freePlatformKey(link.href);if(!key)continue;
    if(key==="tiktok"&&!/\/video\//i.test(link.pathname))continue;
    if(key==="instagram"&&!/\/(?:p|reel|tv|share)\//i.test(link.pathname))continue;
    if(key==="pinterest"&&!/\/pin\//i.test(link.pathname))continue;
    const url=link.href.split("#")[0];if(seen.has(url))continue;
    const title=decodeSearchHtml(anchor[2]);if(!title)continue;
    const snippet=decodeSearchHtml(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]||"");
    if(publicSearchRelevance(query,title+" "+snippet)<0.25)continue;
    seen.add(url);out.push({title,url,snippet,platform:key,searchProvider:"Bing Web"});
  }
  // Fallback parser for Bing layouts that expose social permalinks outside legacy b_algo list markup.
  for(const match of String(html||"").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const attrs=match[1]||"",href=attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];if(!href)continue;
    const link=decodeBingSocialResultUrl(href);if(!link||link.protocol!=="https:"||!domains.some(domain=>link.hostname===domain||link.hostname.endsWith("."+domain)))continue;
    const key=freePlatformKey(link.href);if(!key)continue;
    if(key==="tiktok"&&!/\/video\//i.test(link.pathname))continue;
    if(key==="instagram"&&!/\/(?:p|reel|tv|share)\//i.test(link.pathname))continue;
    if(key==="pinterest"&&!/\/pin\//i.test(link.pathname))continue;
    const url=link.href.split("#")[0];if(seen.has(url))continue;
    const rawTitle=decodeSearchHtml((match[2]||"").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
    const title=rawTitle||decodeSearchHtml(attrs.match(/\btitle=["']([^"']+)["']/i)?.[1]||"")||((key==="tiktok"?"Video TikTok ":"Konten ")+query);
    const context=String(html||"").slice(Math.max(0,match.index-350),Math.min(String(html||"").length,match.index+1300));
    const snippet=decodeSearchHtml(context.replace(/<[^>]+>/g," ").replace(/\s+/g," ")).slice(0,500);
    if(publicSearchRelevance(query,title+" "+snippet)<0.18)continue;
    seen.add(url);out.push({title,url,snippet,platform:key,searchProvider:"Bing Web"});
  }
  return out;
}
async function verifyYouTubeSearchResult(result,requestUrl,desiredMode="video"){
  const searchOnly=()=>({...result,platform:"youtube",verified:false,downloadable:false,searchOnly:true,mediaMode:desiredMode,channel:"YouTube · stream belum diverifikasi"});
  const videoId=youtubeVideoId(result.url);
  if(!videoId)return searchOnly();
  let info=null,instance="";
  const provider=String(result.provider||"").toLowerCase();
  try{
    const parsed=new URL(String(result.instance||""));
    if(parsed.protocol==="https:"&&!parsed.username&&!parsed.password&&!parsed.port&&parsed.pathname==="/"&&!parsed.search&&!parsed.hash)instance=parsed.origin;
  }catch{}
  if(instance&&provider==="piped"&&hybridIsPipedApiInstance(instance)){
    try{
      const data=await hybridFetchJson(instance+"/streams/"+encodeURIComponent(videoId));
      info=hybridFromPiped(data,instance);
    }catch{}
  }else if(instance&&provider==="invidious"){
    try{
      const known=(await currentHybridInvidiousInstances()).some(value=>{try{return new URL(value).origin===instance}catch{return false}});
      if(known){
        const data=await hybridFetchJson(instance+"/api/v1/videos/"+encodeURIComponent(videoId)+"?local=true");
        info=hybridFromInvidious(data,instance);
      }
    }catch{}
  }
  const hasPlayable=()=>Array.isArray(info?.formats)&&info.formats.some(format=>desiredMode==="audio"
    ?format?.mode==="audio"&&["m4a","mp3","aac","opus","ogg","wav","flac"].includes(String(format.ext||"").toLowerCase())
    :format?.mode==="video"&&["mp4","webm"].includes(String(format.ext||"").toLowerCase())&&format.videoOnly!==true);
  if(!hasPlayable()){
    try{
      const infoUrl=new URL("/api/youtube/hybrid/info",requestUrl);
      infoUrl.searchParams.set("url",result.url);
      const response=await hybridYoutubeInfo(new Request(infoUrl.href));
      const data=await response.json().catch(()=>null);
      if(response.ok&&data?.providerReady===true)info=data;
    }catch{}
  }
  if(!hasPlayable())return searchOnly();
  const formats=Array.isArray(info.formats)?info.formats:[];
  const playable=desiredMode==="audio"
    ?formats.find(format=>format?.mode==="audio"&&["m4a","mp3","aac","opus","ogg","wav","flac"].includes(String(format.ext||"").toLowerCase()))
    :formats.find(format=>format?.mode==="video"&&["mp4","webm"].includes(String(format.ext||"").toLowerCase())&&format.videoOnly!==true);
  if(!playable?.url)return searchOnly();
  const ext=String(playable.ext||"").toLowerCase();
  const probeUrl=new URL("/api/youtube/hybrid/file",requestUrl);
  probeUrl.searchParams.set("url",playable.url);
  probeUrl.searchParams.set("instance",playable.instance||info.instance||instance);
  probeUrl.searchParams.set("ext",ext);
  probeUrl.searchParams.set("title",info.title||result.title||"ARYANZZ search");
  probeUrl.searchParams.set("probe","1");
  const probeResponse=await hybridYoutubeFile(new Request(probeUrl.href));
  const probe=await probeResponse.json().catch(()=>({}));
  if(!probeResponse.ok||probe?.ok!==true||probe.signatureValid!==true)return searchOnly();
  return {...result,platform:"youtube",title:info.title||result.title,channel:info.uploader||result.channel||"YouTube",thumbnail:info.thumbnail||result.thumbnail||null,duration:Number(info.duration)||result.duration||null,verified:true,downloadable:true,mediaMode:desiredMode,extension:ext,mediaType:probe.contentType||playable.mimeType||null,provider:info.provider||result.provider||"YouTube Hybrid"};
}
async function verifySocialSearchResult(result,requestUrl,desiredMode="video"){
  const key=freePlatformKey(result.url),platformId=platformIdForUrl(result.url);
  const searchOnly=()=>({...result,platform:platformId||result.platform||"unknown",verified:false,downloadable:false,searchOnly:true,mediaMode:desiredMode==="audio"?"audio":"video",channel:"Hasil publik · unduhan belum diverifikasi"});
  if(platformId==="youtube"||key==="youtube")return {...result,platform:"youtube",verified:false,downloadable:false,searchOnly:true,mediaMode:desiredMode,channel:result.channel||"YouTube · periksa saat dipilih"};
  if(!key||!platformSupportsSearchMode(platformId,desiredMode))return searchOnly();
  const endpoint=FREE_MEDIA_API+"/api/download/"+key+"?url="+encodeURIComponent(result.url);
  try{
    const response=await fetch(endpoint,{headers:{accept:"application/json"},signal:AbortSignal.timeout(9000),cache:"no-store"});
    if(!response.ok)return searchOnly();
    const data=await response.json().catch(()=>({}));
    if(data?.success===false)return searchOnly();
    const info=freeProviderMediaInfo(data,result.url,requestUrl);
    const playableFormats=(info?.formats||[]).filter(item=>item.previewUrl&&item.downloadUrl&&!item.videoOnly);
    const mode=desiredMode;
    const playable=mode==="audio"
      ?playableFormats.find(item=>item.mode==="audio"&&["mp3","m4a","aac","opus","ogg","wav","flac"].includes(item.ext))
      :mode==="video"
        ?playableFormats.find(item=>item.mode==="video"&&["mp4","m4v"].includes(item.ext))
        :key==="soundcloud"
          ?playableFormats.find(item=>item.mode==="audio"&&["mp3","m4a","aac","opus","ogg","wav","flac"].includes(item.ext))
          :playableFormats.find(item=>item.mode==="video"&&["mp4","m4v"].includes(item.ext))||playableFormats.find(item=>item.mode==="audio"&&["mp3","m4a"].includes(item.ext));
    if(!playable)return searchOnly();
    const probeUrl=new URL(playable.downloadUrl);probeUrl.searchParams.set("probe","1");
    const mediaCheck=await socialMediaFile(new Request(probeUrl.href));
    const mediaData=await mediaCheck.json().catch(()=>({}));
    if(!mediaCheck.ok||!mediaData.valid)return searchOnly();
    return {...result,platform:platformId||key,title:result.title||info.title,mediaTitle:info.title||"",thumbnail:info.thumbnail||null,duration:info.duration||null,verified:true,downloadable:true,mediaMode:playable.mode,previewUrl:playable.mode==="audio"?playable.previewUrl:null,downloadUrl:playable.mode==="audio"?playable.downloadUrl:null,extension:mediaData.extension,mediaType:mediaData.mimeType};
  }catch{return searchOnly()}
}
function extractSocialSearchThumbnail(html,pageUrl){
  for(const tag of String(html||"").matchAll(/<meta\b[^>]*>/gi)){
    const attrs={};
    for(const match of tag[0].matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[match[1].toLowerCase()]=match[2]??match[3]??match[4]??"";
    const key=String(attrs.property||attrs.name||"").toLowerCase();
    if(!["og:image","og:image:secure_url","twitter:image","twitter:image:src","image","og:video:thumbnail"].includes(key)||!attrs.content)continue;
    try{
      const candidate=safePublicMediaUrl(new URL(decodeSearchHtml(attrs.content),pageUrl).href);
      if(candidate&&!/\.(?:svg|ico)(?:[?#]|$)/i.test(candidate.href)&&!/(?:avatar|profile|favicon|logo|emoji|sprite|icon)(?:[._/-]|$)/i.test(candidate.href))return candidate.href;
    }catch{}
  }
  return null;
}
function youtubeSearchThumbnail(rawUrl){
  try{
    const url=new URL(rawUrl),host=url.hostname.toLowerCase().replace(/^www\./,"");
    if(host==="youtu.be"||host==="youtube.com"||host.endsWith(".youtube.com")){
      const id=host==="youtu.be"?url.pathname.split("/").filter(Boolean)[0]:url.searchParams.get("v")||url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
      if(id&&/^[A-Za-z0-9_-]{6,20}$/.test(id))return "https://i.ytimg.com/vi/"+id+"/hqdefault.jpg";
    }
  }catch{}
  return null;
}
async function enrichSocialSearchThumbnails(items,limit=12){
  const output=items.slice(),queue=[];
  for(let index=0;index<Math.min(output.length,limit);index++){
    const current=output[index],existing=safePublicMediaUrl(current?.thumbnail||"");
    if(existing){output[index]={...current,thumbnail:existing.href};continue;}
    const youtube=youtubeSearchThumbnail(current?.url||"");
    if(youtube){output[index]={...current,thumbnail:youtube};continue;}
    if(current?.url)queue.push(index);
  }
  let cursor=0;
  const worker=async()=>{
    while(cursor<queue.length){
      const index=queue[cursor++],item=output[index];
      try{
        const page=await fetchSocialPostHtml(item.url,4500);
        const thumbnail=extractSocialSearchThumbnail(page.html,page.url);
        if(thumbnail)output[index]={...item,thumbnail};
      }catch{}
    }
  };
  await Promise.all(Array.from({length:Math.min(6,queue.length)},()=>worker()));
  return output;
}
function parseGoogleSocialVideoResults(html,platform,query,seen){
  const domains=socialSearchDomains(platform),out=[];
  for(const match of String(html||"").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const attrs=match[1]||"",raw=attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if(!raw)continue;
    let link;try{link=new URL(decodeSearchHtml(raw),"https://www.google.com")}catch{continue}
    if(link.hostname==="www.google.com"||link.hostname==="google.com"){
      if(!/^\/url\/?$/.test(link.pathname))continue;
      const target=link.searchParams.get("q")||link.searchParams.get("url")||link.searchParams.get("adurl")||"";
      if(!target)continue;
      try{link=new URL(target)}catch{continue}
    }
    if(link.protocol!=="https:"||!domains.some(domain=>link.hostname===domain||link.hostname.endsWith("."+domain)))continue;
    const key=freePlatformKey(link.href);if(!key)continue;
    if(key==="tiktok"&&!/\/video\//i.test(link.pathname))continue;
    if(key==="instagram"&&!/\/(?:p|reel|tv|share)\//i.test(link.pathname))continue;
    if(key==="pinterest"&&!/\/pin\//i.test(link.pathname))continue;
    const href=link.href.split("#")[0];if(seen.has(href))continue;
    const title=decodeSearchHtml((match[2].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||match[2]).replace(/<[^>]+>/g," "));
    if(!title)continue;
    const snippet=decodeSearchHtml(match[2].replace(/<[^>]+>/g," ")).slice(0,300);
    if(publicSearchRelevance(query,title+" "+snippet)<0.16)continue;
    seen.add(href);out.push({title,url:href,snippet,platform:key,searchProvider:"Google Video/Web"});
    if(out.length>=100)break;
  }
  return out;
}
async function searchSocial(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const platform=String(body?.platform||"").toLowerCase(),query=String(body?.query||"").replace(/\s+/g," ").trim();
  const requestedMode=String(body?.mediaType||"video").toLowerCase();
  const desiredMode=requestedMode==="audio"?"audio":"video";
  const canonicalPlatform=platform==="all"?"all":canonicalPlatformId(platform);
  const domains=socialSearchDomains(platform);
  if(!domains.length)return json({ok:false,error:"Platform pencarian belum didukung."},400);
  if(platform!=="all"&&!platformSupportsSearchMode(canonicalPlatform,desiredMode)){
    const name=PLATFORM_CATALOG_BY_ID.get(canonicalPlatform)?.name||platform;
    return json({ok:false,error:name+" belum memiliki provider "+desiredMode+" terverifikasi untuk Cari Judul. Gunakan Tempel Tautan untuk pemeriksaan manual jika sumbernya publik."},400);
  }
  if(query.length<2||query.length>120)return json({error:"Masukkan judul antara 2 sampai 120 karakter."},400);
  if(socialRateLimited(request))return json({error:"Batas pencarian gratis tercapai. Tunggu satu menit lalu coba lagi."},429);
  const site=domains.map(domain=>"site:"+domain).join(" OR ");
  const searchTargets=platform==="all"
    ?PLATFORM_CATALOG.filter(item=>!item.aliasOf&&platformSupportsSearchMode(item.id,desiredMode))
    :[PLATFORM_CATALOG_BY_ID.get(canonicalPlatform)].filter(Boolean);
  // Use the primary indexed domain per provider; OR-chains of site: operators were unreliable.
  const searchSites=platform==="all"
    ?searchTargets.slice(0,15).map(item=>item.domains?.[0]?"site:"+item.domains[0]:"").filter(Boolean)
    :domains.map(domain=>"site:"+domain);
  async function boundedLookup(inputs,task,parallel=6){
    const out=new Array(inputs.length);let cursor=0;
    await Promise.all(Array.from({length:Math.min(parallel,inputs.length)},async()=>{
      while(cursor<inputs.length){const index=cursor++;try{out[index]=await task(inputs[index])}catch{out[index]=""}}
    }));
    return out;
  }
  try{
    const baseVariants=socialSearchQueryVariants(query);
    const variants=(desiredMode==="audio"
      ? [query,query+" audio",query+" song",query+" soundtrack",query+" instrumental",...baseVariants]
      : desiredMode==="video"
        ? [query,query+" video",query+" clip",query+" shorts",query+" DJ remix",query+" official video",...baseVariants]
        : baseVariants).filter((value,index,array)=>array.indexOf(value)===index).slice(0,platform==="all"?3:12);
    const searchTerms=platform==="all"?[query]:variants.slice(0,4);
    const pages=await boundedLookup(searchTerms.flatMap(term=>searchSites.map(searchSite=>({term,searchSite}))),async ({term,searchSite})=>{
      const url=new URL("https://html.duckduckgo.com/html/");url.searchParams.set("q",(searchSite?searchSite+" ":"")+term);
      const response=await fetch(url.href,{headers:{accept:"text/html","user-agent":"Mozilla/5.0 (compatible; ARYANZZ/86.2; +https://aryanzz-donwloader.aryanz.workers.dev)"},signal:AbortSignal.timeout(4600),cache:"no-store"});
      return response.ok?await response.text():"";
    });
    const candidates=[],seen=new Set(),candidateBuckets=new Map();
    for(const html of pages){
      const anchors=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
      for(const match of html.matchAll(anchors)){
        const attrs=match[1]||"";
        if(!/\bclass=["'][^"']*\bresult__a\b[^"']*["']/i.test(attrs))continue;
        const hrefMatch=attrs.match(/\bhref=["']([^"']+)["']/i);if(!hrefMatch)continue;
        let link;try{link=new URL(decodeSearchHtml(hrefMatch[1]),"https://html.duckduckgo.com")}catch{continue}
        if(link.hostname.endsWith("duckduckgo.com")){const target=link.searchParams.get("uddg");if(target){try{link=new URL(target)}catch{continue}}}
        if(link.protocol!=="https:"||!domains.some(domain=>link.hostname===domain||link.hostname.endsWith("."+domain)))continue;
        if(canonicalPlatform==="instagram"&&!/\/(?:p|reel|tv|share)\//i.test(link.pathname))continue;
        if(canonicalPlatform==="tiktok"&&!/\/video\//i.test(link.pathname))continue;
        if(canonicalPlatform==="pinterest"&&!/\/pin\//i.test(link.pathname))continue;
        const href=link.href.split("#")[0];if(seen.has(href))continue;seen.add(href);
        const title=decodeSearchHtml(match[2].replace(/<[^>]+>/g," "));if(!title)continue;
        const snippetMatch=html.slice(match.index,match.index+1800).match(/class=["']result__snippet["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
        const candidate={title,url:href,snippet:decodeSearchHtml((snippetMatch?.[1]||"").replace(/<[^>]+>/g," "))};
        const key=platformIdForUrl(href)||"other";
        if(!candidateBuckets.has(key))candidateBuckets.set(key,[]);
        candidateBuckets.get(key).push(candidate);
      }
    }
    if(platform==="all"){
      for(let round=0;round<40&&candidates.length<500;round++){
        for(const list of candidateBuckets.values())if(list[round]&&candidates.length<500)candidates.push(list[round]);
      }
    }else{
      for(const list of candidateBuckets.values())candidates.push(...list.slice(0,100));
      candidates.splice(100);
    }
    const ddgCandidateCount=candidates.length;
    const discoveredProviderCount=new Set(candidates.map(item=>canonicalPlatformId(platformIdForUrl(item.url)||""))).size;
    const enoughFirstPass=(platform==="all"?(candidates.length>=6&&discoveredProviderCount>=2):candidates.length>=4);
    const bingQueries=enoughFirstPass?[]:platform==="all"
      ?searchTargets.filter(item=>!candidateBuckets.has(item.id)).slice(0,5).map(item=>({term:query,searchSite:"site:"+item.domains[0]}))
      :searchTerms.flatMap(term=>searchSites.map(searchSite=>({term,searchSite})));
    const bingPages=await boundedLookup(bingQueries,async ({term,searchSite})=>{
      const url=new URL("https://www.bing.com/search");url.searchParams.set("q",(searchSite?searchSite+" ":"")+term);url.searchParams.set("form","QBLH");
      const response=await fetch(url.href,{headers:{accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"},signal:AbortSignal.timeout(4600),cache:"no-store"});
      return response.ok?await response.text():"";
    });
    let bingCandidateCount=0;
    for(const page of bingPages){const parsed=parseBingSocialVideoResults(page,platform,query,seen);bingCandidateCount+=parsed.length;candidates.push(...parsed)}
    const enoughSecondPass=platform==="all"?(candidates.length>=6&&new Set(candidates.map(item=>canonicalPlatformId(platformIdForUrl(item.url)||""))).size>=2):candidates.length>=4;
    const googleQueries=enoughSecondPass?[]:platform==="all"
      ?searchTargets.filter(item=>!candidates.some(candidate=>canonicalPlatformId(platformIdForUrl(candidate.url))===item.id)).slice(0,3).map(item=>({term:query,searchSite:"site:"+item.domains[0]}))
      :variants.slice(0,2).map(term=>({term,searchSite:site}));
    const googlePages=await boundedLookup(googleQueries,async ({term,searchSite})=>{
      const url=new URL("https://www.google.com/search");url.searchParams.set("q",(searchSite?searchSite+" ":"")+term);url.searchParams.set("tbm","vid");url.searchParams.set("num","30");url.searchParams.set("filter","0");
      const response=await fetch(url.href,{headers:{accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36","accept-language":"id-ID,id;q=0.9,en-US;q=0.8"},signal:AbortSignal.timeout(4600),cache:"no-store"});
      return response.ok?await response.text():"";
    });
    let googleCandidateCount=0;
    for(const page of googlePages){const parsed=parseGoogleSocialVideoResults(page,platform,query,seen);googleCandidateCount+=parsed.length;candidates.push(...parsed)}
    let tiktokPageDiagnostics={status:null,bytes:0,count:0,queries:[]};
    if((platform==="tiktok"||platform==="tiktoklite"||platform==="all")&&!candidates.some(item=>platformIdForUrl(item.url)==="tiktok")){
      const directPages=await Promise.all(variants.slice(0,platform==="all"?1:3).map(term=>searchTikTokPublicPage(term)));
      for(let index=0;index<directPages.length;index++){
        const direct=directPages[index];
        tiktokPageDiagnostics.queries.push({query:variants[index],status:direct.status,bytes:direct.bytes,count:direct.items.length});
        if(index===0)tiktokPageDiagnostics={...tiktokPageDiagnostics,status:direct.status,bytes:direct.bytes,count:direct.items.length,pageTitle:direct.pageTitle,scriptIds:direct.scriptIds,videoLinks:direct.videoLinks,hasUniversalData:direct.hasUniversalData,hasSigiState:direct.hasSigiState};
        for(const item of direct.items){if(!seen.has(item.url)){seen.add(item.url);candidates.push(item)}}
      }
    }
    if((platform==="all"||platform==="youtube")&&!candidates.some(item=>platformIdForUrl(item.url)==="youtube"&&publicSearchRelevance(query,item.title+" "+(item.snippet||""))>=0.16)){
      // Community YouTube providers are only used when the indexed search found no YouTube candidate.
      const youtubeTerms=[query,query+" lagu",query+" song",query+" official audio",query+" DJ remix",...variants]
        .map(value=>String(value||"").replace(/\s+/g," ").trim())
        .filter((value,index,array)=>value.length>=2&&array.indexOf(value)===index).slice(0,platform==="all"?3:5);
      const [hybridPages,directYoutube]=await Promise.all([
        Promise.all(youtubeTerms.slice(0,platform==="all"?1:2).map(term=>hybridYouTubeSearch(term))),
        freeYouTubeSearchItems(query,youtubeTerms.slice(0,platform==="all"?2:3),platform==="all"?6300:7500)
      ]);
      for(const page of hybridPages)for(const item of page?.results||[]){
        if(!seen.has(item.url)){seen.add(item.url);candidates.push({...item,platform:"youtube",snippet:item.channel||"YouTube video",searchProvider:item.provider||"YouTube public search"});}
      }
      // Official/community search and public fallback already ran concurrently.
      for(const item of directYoutube){
        if(!seen.has(item.url)){seen.add(item.url);candidates.push({...item,platform:"youtube",snippet:item.channel||"YouTube video",searchProvider:item.searchProvider||"YouTube public search"});}
      }
    }
    const platformScopedCandidates=platform==="all"
      ?candidates.filter(item=>platformSupportsSearchMode(platformIdForUrl(item.url),desiredMode))
      :candidates.filter(item=>{
        const itemPlatform=platformIdForUrl(item.url);
        return !!itemPlatform&&canonicalPlatformId(itemPlatform)===canonicalPlatform&&platformSupportsSearchMode(itemPlatform,desiredMode);
      });
    const relevantCandidates=platformScopedCandidates.filter(item=>{
      const score=strictTitleIntentScore(query,item.title,item.snippet||"");
      return score>=0.7;
    });
    const orderedCandidates=platform==="all"?(()=>{const buckets=new Map();for(const item of relevantCandidates){const key=canonicalPlatformId(platformIdForUrl(item.url)||"other");if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item)}const out=[];for(let round=0;round<12;round++)for(const list of buckets.values())if(list[round])out.push(list[round]);return out})():relevantCandidates;
    // Verify the first candidates for direct download availability, but do not discard valid public title results.
    // Search discovery and download extraction are separate stages: an unverified result can still be opened and checked on selection.
    // Public title discovery and playable-file verification are separate. Verify the stream when the result is selected.
    const verificationLimit=0;
    const verificationCandidates=orderedCandidates.slice(0,verificationLimit);
    const checked=await Promise.all(verificationCandidates.map(item=>verifySocialSearchResult(item,request.url,desiredMode)));
    const verifiedResults=checked.filter(item=>item?.verified===true&&item?.downloadable===true&&item.mediaMode===desiredMode);
    let youtubeFallbackAttempted=false,youtubeFallbackCandidateCount=0,youtubeFallbackCandidates=[],youtubeFallbackVerified=[];
    if(!verifiedResults.length&&relevantCandidates.length===0&&platform!=="all"&&platform!=="youtube"&&(desiredMode==="video"||desiredMode==="audio")){
      youtubeFallbackAttempted=true;
      const youtubeTerms=[query,query+" lagu",query+" song",query+" official video",query+" official audio",...baseVariants]
        .map(value=>String(value||"").replace(/\s+/g," ").trim())
        .filter((value,index,array)=>value.length>=2&&array.indexOf(value)===index).slice(0,4);
      const [youtubePages,directYoutube]=await Promise.all([
        Promise.all(youtubeTerms.slice(0,2).map(term=>hybridYouTubeSearch(term))),
        freeYouTubeSearchItems(query,youtubeTerms.slice(0,2),6500)
      ]);
      const youtubeCandidates=[],youtubeSeen=new Set();
      for(const page of youtubePages)for(const item of page?.results||[]){
        if(!youtubeSeen.has(item.url)){youtubeSeen.add(item.url);youtubeCandidates.push({...item,platform:"youtube",snippet:item.snippet||item.channel||"YouTube video",searchProvider:item.searchProvider||item.provider||"YouTube public search"});}
      }
      for(const item of directYoutube)if(!youtubeSeen.has(item.url)){youtubeSeen.add(item.url);youtubeCandidates.push({...item,platform:"youtube",snippet:item.snippet||item.channel||"YouTube video",searchProvider:item.searchProvider||"YouTube public search"});}
      const relevantYoutube=youtubeCandidates.filter(item=>strictTitleIntentScore(query,item.title,item.snippet||"")>=0.7);
      youtubeFallbackCandidates=relevantYoutube.slice(0,20);
      youtubeFallbackCandidateCount=relevantYoutube.length;
      // Penelusuran judul menampilkan kandidat publik terlebih dahulu; verifikasi media pada pemilihan hasil.
      // Tidak perlu menunggu delapan pemeriksaan stream unduhan.
    }
    const verifiedUrls=new Set(verifiedResults.map(item=>item.url));
    const resultLimit=platform==="all"?36:20;
    const searchOnlyCandidates=orderedCandidates
      .filter(item=>item?.url&&!verifiedUrls.has(item.url))
      .slice(0,resultLimit)
      .map(item=>({...item,platform:platformIdForUrl(item.url)||item.platform||"unknown",mediaMode:desiredMode,verified:false,downloadable:false,searchOnly:true,channel:item.channel||item.searchProvider||"Hasil publik"}));
    const fallbackSearchOnly=youtubeFallbackCandidates
      .filter(item=>item?.url&&!verifiedUrls.has(item.url))
      .map(item=>({...item,platform:"youtube",mediaMode:desiredMode,verified:false,downloadable:false,searchOnly:true,channel:item.channel||item.searchProvider||"YouTube"}));
    const resultSeen=new Set(),results=[];
    for(const item of [...verifiedResults,...searchOnlyCandidates,...fallbackSearchOnly]){
      if(!item?.url||resultSeen.has(item.url))continue;
      resultSeen.add(item.url);results.push(item);
      if(results.length>=resultLimit)break;
    }
    const fallbackUsed=platform!=="all"&&platform!=="youtube"&&(fallbackSearchOnly.length>0||verifiedResults.some(item=>item.platform==="youtube"));
    const resultsWithThumbnails=results; // Kandidat tanpa gambar tidak menunggu pengambilan thumbnail eksternal.
    const searchOnlyCount=resultsWithThumbnails.filter(item=>item.searchOnly===true).length;
    const verifiedCount=resultsWithThumbnails.filter(item=>item.verified===true&&item.downloadable===true).length;
    const verificationFailedCount=Math.max(0,checked.length-verifiedResults.length);
    const unsupportedCandidateCount=Math.max(0,candidates.length-platformScopedCandidates.length);
    return json({ok:true,platform,query,mediaType:desiredMode,results:resultsWithThumbnails,candidateCount:candidates.length+youtubeFallbackCandidateCount,ddgCandidateCount,bingCandidateCount,relevantCount:relevantCandidates.length,thumbnailCount:resultsWithThumbnails.filter(item=>item.thumbnail).length,verifiedCount,searchOnlyCount,unavailableCount:Math.max(0,relevantCandidates.length+youtubeFallbackCandidateCount-resultsWithThumbnails.length),unsupportedCandidateCount,verificationFailedCount,fallbackUsed,youtubeFallbackAttempted,youtubeFallbackCandidateCount,platformSearchTargetCount:searchTargets.length,searchEngineQueryCount:searchTerms.length*searchSites.length+bingQueries.length+googleQueries.length,candidateSamples:candidates.slice(0,5).map(item=>({title:item.title,url:item.url,score:publicSearchRelevance(query,item.title+" "+item.snippet)})),providerDiagnostics:{ddgPages:pages.length,ddgNonEmpty:pages.filter(Boolean).length,bingPages:bingPages.length,bingNonEmpty:bingPages.filter(Boolean).length,googlePages:googlePages.length,googleNonEmpty:googlePages.filter(Boolean).length,googleCandidateCount,ddgResultLinkCount:pages.reduce((sum,page)=>sum+[...page.matchAll(/class=["'][^"']*\bresult__a\b/gi)].length,0),bingCandidateCount,tiktokPublicPage:tiktokPageDiagnostics,youtubeFallbackAttempted,youtubeFallbackCandidateCount,platformSearchTargetCount:searchTargets.length,searchEngineQueryCount:searchTerms.length*searchSites.length+bingQueries.length+googleQueries.length},searchVariants:variants,verification:"download-verified-on-search-or-selection",verificationLimit,searchScope:fallbackUsed?"selected-platform-with-youtube-fallback":platform==="all"?"per-platform-public-search":"selected-provider-platform",returnedPublicResults:resultsWithThumbnails.length,verifiedChecks:checked.length});  }catch(error){return json({error:"Pencarian publik gagal dijangkau. Coba lagi nanti. "+String(error?.message||error).slice(0,100)},502)}
}

function imageSafeFilename(title,index,ext){
  const base=String(title||"aryanzz-image").replace(/[\/:*?"<>|\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,72)||"aryanzz-image";
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
  const diagnostics={};
  const post=await resolveSocialImagePost(input.href,request.url,{diagnostics});
  if(!post)return json({ok:false,error:"Belum ditemukan file gambar asli pada postingan publik ini. Postingan mungkin berisi video, privat, memerlukan login, atau membatasi akses gambar.",diagnostics:diagnostics.value||null},404);
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
  const u=new URL(request.url),raw=u.searchParams.get("url")||"",source=u.searchParams.get("source")||"",filename=String(u.searchParams.get("filename")||"aryanzz-image.jpg").replace(/[\/:*?"<>|\u0000-\u001f]/g,"_").slice(0,120),preview=u.searchParams.get("preview")==="1";
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
        const redirectTarget=new URL(location,current.href);if(redirectTarget.protocol==="http:")redirectTarget.protocol="https:";const next=safePublicMediaUrl(redirectTarget.href);
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
  if(depth>12||value==null)return;
  if(typeof value==="string"){
    const candidate=value.replace(/\\u0026/g,"&").replace(/\\u003d/g,"=").replace(/\\\//g,"/");
    if(/^https?:\/\//i.test(candidate)&&(forceImage||/\.(?:jpe?g|png|webp|gif|avif|bmp)(?:[?#]|$)/i.test(candidate)||/image|photo|picture/i.test(candidate)))output.push(candidate);
    return;
  }
  if(Array.isArray(value)){for(const item of value.slice(0,80))collectImageUrls(item,output,depth+1,forceImage);return}
  if(typeof value==="object"){
    for(const key of ["url","urlList","url_list","contentUrl","image","images","photo","photos","picture","pictures","src","displayImage","display_image","displayImages","display_images","imageURL","image_urls","display_url","download_url","image_url","original","large","thumbnail_src","thumbnail_url","thumbnail_resources","media_url","media_url_https","originCover","origin_cover","cover","imagePost","image_post","imagePostInfo","image_post_info","photoPost","photo_post","image_versions2","image_versions","image_candidates","display_resources","displayResources","candidates","carousel","carousel_media","edge_sidecar_to_children","edges","node","gallery","resources","items","media","itemInfo","item_info","itemStruct","item_struct","itemModule","item_module","itemList","item_list","data","props","pageProps","result","results","post","postInfo","post_info","shortcode_media","graphql","webapp.video-detail","aweme_detail","awemeDetail","videoDetail","video_detail","__DEFAULT_SCOPE__"]){
      const normalizedKey=key.toLowerCase();
      if(value[key]!==undefined)collectImageUrls(value[key],output,depth+1,["image","images","photo","photos","picture","pictures","image_url","displayimage","display_image","displayimages","display_images","imageurl","image_urls","urllist","url_list","origincover","origin_cover","imagepost","image_post","imagepostinfo","image_post_info","photopost","photo_post","image_versions2","image_versions","image_candidates","display_resources","carousel","carousel_media","edge_sidecar_to_children","thumbnail_resources","candidates","gallery"].includes(normalizedKey)||forceImage);
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
  // TikTok Photo Mode and other JS-rendered galleries can expose image arrays in hydration JSON.
  for(const match of String(html||"").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs=match[1]||"",body=String(match[2]||"").trim();
    if(!body||body.length>2500000)continue;
    const id=attrs.match(/\bid=["']([^"']+)["']/i)?.[1]||"";
    if(!/__UNIVERSAL_DATA_FOR_REHYDRATION__|SIGI_STATE|__NEXT_DATA__|__FRONTITY_CONNECT_STATE__/i.test(id)&&!/"(?:imagePost|imagePostInfo|displayImages|display_images|photoPost|image_post|photo_post|imageURL|urlList|display_url|image_versions2|carousel_media|edge_sidecar_to_children|shortcode_media|thumbnail_resources)"/i.test(body))continue;
    let parsed=null;
    try{parsed=JSON.parse(body)}catch{
      const first=body.indexOf("{"),last=body.lastIndexOf("}");
      if(first>=0&&last>first){try{parsed=JSON.parse(body.slice(first,last+1))}catch{}}
    }
    if(parsed)collectImageUrls(parsed,jsonImages);
  }
  for(const raw of jsonImages)add(raw,"jsonld");
  const hasVideoMeta=!!(meta["og:video"]||meta["og:video:url"]||meta["twitter:player"]||meta["og:type"]==="video.other"||meta["og:type"]==="video");
  const isTikTokPhotoRoute=platform==="tiktok"&&((()=>{try{return /\/photo\//i.test(new URL(pageUrl).pathname)}catch{return false}})()||/imagePostInfo|image_post_info|photomode-image/i.test(String(html||"")));
  if(isTikTokPhotoRoute)for(const image of extractTikTokPhotoProxyImages(html))add(image.url,"jsonld");
  const imageTags=html.match(/<img\b[^>]*>/gi)||[];
  for(const tag of imageTags){
    const attrs={};for(const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4]??"";
    const w=Number(attrs.width||0),h=Number(attrs.height||0),src=attrs.src||attrs["data-src"]||attrs["data-original"]||"";
    if(src&&(w>=180&&h>=180||imageExtensionFromUrl(src)))try{add(new URL(src,pageUrl).href,"html-image")}catch{}
    const srcset=attrs.srcset||"";for(const part of srcset.split(",")){const url=part.trim().split(/\s+/)[0];if(url)try{add(new URL(url,pageUrl).href,"html-image")}catch{}}
  }
  if(hasVideoMeta&&platform!=="pinterest"&&platform!=="reddit"&&!isTikTokPhotoRoute){
    const explicitPhoto=/photo.?mode|image.?post|carousel|multi.?photo|gallery|photo_mode|image_post|display_url|image_versions2|carousel_media|edge_sidecar_to_children|shortcode_media/i.test(html);
    if(!explicitPhoto)return [];
  }
  return found.slice(0,35);
}
async function fetchSocialPostHtml(pageUrl,timeoutMs=18000){
  let current=safePublicMediaUrl(pageUrl);if(!current)throw new Error("Tautan postingan harus HTTPS dan tidak boleh mengarah ke jaringan lokal.");
  for(let hop=0;hop<6;hop++){
    const isTikTokHost=current.hostname==="tiktok.com"||current.hostname.endsWith(".tiktok.com");
    const isThreadsHost=platformForHost(current.hostname)?.id==="threads";
    const baseHeaders={
      accept:"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language":"en-US,en;q=0.9,id;q=0.8"
    };
    const headerVariants=isTikTokHost?[
      {...baseHeaders,"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",referer:"https://www.tiktok.com/"},
      {...baseHeaders,"user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",referer:"https://www.tiktok.com/",origin:"https://www.tiktok.com"}
    ]:isThreadsHost?[
      {...baseHeaders,"user-agent":"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",referer:"https://www.threads.com/"},
      {...baseHeaders,"user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36"}
    ]:[{...baseHeaders,"user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"}];
    let response=null,lastResponseError="";
    for(const requestHeaders of headerVariants){
      response=await fetchSocialHeaders(current.href,{headers:requestHeaders,redirect:"manual",cache:"no-store"},timeoutMs);
      if((isTikTokHost||isThreadsHost)&&[403,429,500,502,503,504].includes(response.status)&&headerVariants.length>1){
        lastResponseError="HTTP "+response.status;
        await response.body?.cancel().catch(()=>{});
        continue;
      }
      break;
    }
    if(!response)throw new Error(lastResponseError||"Halaman sumber tidak dapat dibaca.");
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get("location");if(!location)throw new Error("Pengalihan postingan tidak memiliki alamat tujuan.");
      const redirectUrl=new URL(location,current.href);
      if(redirectUrl.protocol==="http:"&&isPlatformLink(redirectUrl.href))redirectUrl.protocol="https:";
      const next=safePublicMediaUrl(redirectUrl.href);
      if(!next)throw new Error("Pengalihan postingan menuju alamat yang tidak aman atau HTTPS tidak tersedia.");
      if(isThreadsHost&&platformForHost(next.hostname)?.id!=="threads")throw new Error("Tautan Threads mengalihkan ke domain di luar Threads.");
      current=next;continue;
    }
    if(!response.ok)throw new Error("Halaman sumber menjawab HTTP "+response.status+".");
    const contentType=String(response.headers.get("content-type")||"").toLowerCase();
    if(contentType&&!contentType.includes("text/html")&&!contentType.includes("application/xhtml"))throw new Error("Sumber bukan halaman postingan HTML.");
    const length=Number(response.headers.get("content-length")||0);
    if(length>5*1024*1024){await response.body?.cancel().catch(()=>{});throw new Error("Halaman sumber terlalu besar untuk diproses.");}
    if(!response.body)return {html:"",url:current.href,status:response.status};
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
    return {html:new TextDecoder().decode(bytes),url:current.href,status:response.status};
  }
  throw new Error("Terlalu banyak pengalihan dari halaman postingan.");
}
function canonicalSocialPostUrl(rawUrl,key){
  try{
    const u=new URL(rawUrl);
    if(key==="facebook")return canonicalFacebookPostUrl(u.href);
    if(key==="instagram"){
      const match=u.pathname.match(/^\/(p|reel|reels|tv)\/([^/]+)/i);
      if(match){
        const canonical="https://www.instagram.com/"+match[1].toLowerCase()+"/"+match[2]+"/";
        const shareToken=u.searchParams.get("xtok")||u.searchParams.get("igsh");
        return shareToken?canonical+"?"+(u.searchParams.has("xtok")?"xtok":"igsh")+"="+encodeURIComponent(shareToken):canonical;
      }
    }
    return u.href;
  }catch{return rawUrl}
}
function decodeTikTokPageValue(value){
  return String(value||"").replace(/\\u002f/gi,"/").replace(/\\u0026/gi,"&").replace(/\\u003d/gi,"=").replace(/\\\//g,"/").replace(/&amp;/gi,"&").replace(/&#x2f;/gi,"/").replace(/&quot;/gi,'"').trim();
}
function tikTokTagAttributes(tag){
  const attrs={};
  for(const match of String(tag||"").matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)){
    attrs[match[1].toLowerCase()]=match[3]??match[4]??match[5]??"";
  }
  return attrs;
}
function extractTikTokCanonicalUrl(html,pageUrl){
  const source=decodeTikTokPageValue(html),candidates=[];
  const add=raw=>{
    let url;try{url=new URL(decodeTikTokPageValue(raw).replace(/^["']|["']$/g,""),pageUrl)}catch{return}
    if(url.protocol!=="https:"||platformIdForUrl(url.href)!=="tiktok"||/^(?:vt|vm)\.tiktok\.com$/i.test(url.hostname))return;
    const emptyUsername=url.pathname.match(/^\/@\/video\/(\d{8,})/i);
    if(emptyUsername){url.pathname="/video/"+emptyUsername[1];url.search="";}
    if(!(/^\/@[^/]+\/video\/\d{8,}/i.test(url.pathname)||/^\/video\/\d{8,}/i.test(url.pathname)||/^\/t\/[^/]+/i.test(url.pathname)))return;
    url.hash="";
    if(/^\/@[^/]+\/video\/\d+/i.test(url.pathname))url.search="";
    if(!candidates.includes(url.href))candidates.push(url.href);
  };
  for(const match of source.matchAll(/<(?:link|meta)\b[^>]*>/gi)){
    const attrs=tikTokTagAttributes(match[0]);
    if(match[0].slice(0,5).toLowerCase()==="<link"&&String(attrs.rel||"").toLowerCase().split(/\s+/).includes("canonical"))add(attrs.href);
    if(match[0].slice(0,5).toLowerCase()==="<meta"&&["og:url","twitter:url","al:ios:url"].includes(String(attrs.property||attrs.name||"").toLowerCase()))add(attrs.content);
  }
  for(const match of source.matchAll(/"(?:canonicalUrl|webVideoUrl|web_video_url|shareUrl|share_url)"\s*:\s*"([^"]{12,1200})"/gi))add(match[1]);
  add(pageUrl);
  return candidates[0]||null;
}
function collectTikTokUrlValues(value,output=[],depth=0){
  if(depth>7||value==null)return output;
  if(typeof value==="string"){
    const text=decodeTikTokPageValue(value).trim();
    if(/^https?:\/\//i.test(text)||text.startsWith("//"))output.push(text);
    else if((text.startsWith("[")||text.startsWith("{"))&&text.length<120000){
      try{collectTikTokUrlValues(JSON.parse(text),output,depth+1)}catch{}
    }
    return output;
  }
  if(Array.isArray(value)){for(const item of value.slice(0,50))collectTikTokUrlValues(item,output,depth+1);return output;}
  if(typeof value==="object"){
    for(const key of ["UrlList","urlList","url_list","urls","url","uri","src","imageURL","imageUrl","displayImage","display_image","originImage","origin_image","downloadUrl","download_url","image","images","thumbnail","thumbnailUrl","thumbnail_url","cover","dynamicCover","dynamic_cover"])if(value[key]!==undefined)collectTikTokUrlValues(value[key],output,depth+1);
  }
  return output;
}
function extractTikTokPublicPageInfo(html,pageUrl,rawUrl,requestUrl){
  const source=decodeTikTokPageValue(html),records=[],media=[],seen=new Set();
  const walk=(value,depth=0)=>{
    if(depth>18||!value||typeof value!=="object"||records.length>40)return;
    if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}
    const video=value.video&&typeof value.video==="object"?value.video:null;
    const directFields=["playAddr","downloadAddr","play_addr","download_addr","playUrl","downloadUrl","videoUrl","video_url","bitrateInfo","bitrate_info"];
    const videoSignals=["downloadAddr","download_addr","bitrateInfo","bitrate_info","originCover","origin_cover","dynamicCover","dynamic_cover","cover","ratio","videoQuality","video_quality","width","height"];
    if(video&&directFields.some(key=>video[key]!==undefined))records.push({item:value,video});
    else if(!video&&videoSignals.some(key=>value[key]!==undefined)&&directFields.some(key=>value[key]!==undefined))records.push({item:value,video:value});
    for(const child of Object.values(value))if(child&&typeof child==="object")walk(child,depth+1);
  };
  for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs=tikTokTagAttributes("<script "+(match[1]||"")+">");
    const body=String(match[2]||"").trim();
    if(!body||body.length>3000000)continue;
    if(!/__UNIVERSAL_DATA_FOR_REHYDRATION__|SIGI_STATE/i.test(attrs.id||"")&&!/"(?:playAddr|downloadAddr|play_addr|download_addr|bitrateInfo|bitrate_info)"/i.test(body))continue;
    let parsed=null;
    try{parsed=JSON.parse(body)}catch{
      const first=body.indexOf("{"),last=body.lastIndexOf("}");
      if(first>=0&&last>first){try{parsed=JSON.parse(body.slice(first,last+1))}catch{}}
    }
    if(parsed)walk(parsed);
  }
  const add=(raw,label,height=0)=>{
    for(const candidate of collectTikTokUrlValues(raw)){
      const value=decodeTikTokPageValue(candidate);
      const safe=safePublicMediaUrl(value);if(!safe||seen.has(safe.href))continue;
      seen.add(safe.href);
      const pathExt=(safe.pathname.match(/\.(mp4|webm|mov|m4v)$/i)||[])[1]?.toLowerCase()||"mp4";
      const ext=pathExt==="m4v"?"mp4":pathExt;
      const mime=ext==="webm"?"video/webm":ext==="mov"?"video/quicktime":"video/mp4";
      media.push({type:"video",kind:"video",label:"TikTok "+label,url:safe.href,ext,mimeType:mime,height:Number(height)||0});
    }
  };
  let title="",thumbnail=null,duration=0,author=null;
  for(const record of records){
    const item=record.item||{},video=record.video||{};
    title=title||String(item.desc||item.description||item.shareInfo?.shareTitle||item.share_info?.share_title||video.desc||"").trim();
    author=author||item.author?.uniqueId||item.author?.unique_id||item.author?.nickname||null;
    duration=duration||Number(video.duration)||Number(video.durationMs||video.duration_ms)/1000||0;
    if(!thumbnail){
      for(const field of ["originCover","origin_cover","cover","dynamicCover","dynamic_cover","thumbnail"]){
        const candidate=collectTikTokUrlValues(video[field])[0];
        const safe=safePublicMediaUrl(decodeTikTokPageValue(candidate||""));
        if(safe){thumbnail=safe.href;break;}
      }
    }
    const variants=video.bitrateInfo||video.bitrate_info||[];
    if(Array.isArray(variants))for(const variant of variants.slice().sort((a,b)=>Number(b?.Bitrate||b?.bitrate||0)-Number(a?.Bitrate||a?.bitrate||0))){
      const quality=String(variant?.GearName||variant?.gear_name||variant?.quality||variant?.QualityType||"");
      const height=Number(quality.match(/(144|240|360|480|540|576|720|900|960|1080|1440|2160)/)?.[1]||variant?.height||0);
      add(variant?.PlayAddr||variant?.playAddr||variant?.play_addr||variant?.UrlList||variant?.url_list,"stream "+(quality||"variant"),height);
    }
    add(video.downloadAddr||video.download_addr,"download");
    add(video.playAddr||video.play_addr,"stream");
    add(video.playUrl||video.play_url||video.videoUrl||video.video_url,"video");
  }
  const meta={};
  for(const match of source.matchAll(/<meta\b[^>]*>/gi)){
    const attrs=tikTokTagAttributes(match[0]);
    const key=String(attrs.property||attrs.name||"").toLowerCase();
    if(key&&attrs.content)meta[key]=attrs.content;
  }
  for(const key of ["og:video","og:video:url","og:video:secure_url","twitter:player:stream"])if(meta[key])add(meta[key],"public video");
  title=title||decodeTikTokPageValue(meta["og:title"]||"")||"Video TikTok";
  if(!thumbnail&&meta["og:image"]){const safe=safePublicMediaUrl(decodeTikTokPageValue(meta["og:image"]));if(safe)thumbnail=safe.href;}
  duration=duration||extractSocialVideoDuration(source)||0;
  if(!media.length)throw new Error("Halaman TikTok tidak menyediakan URL stream video publik. Video mungkin privat, dibatasi umur/wilayah, memerlukan login, atau halaman TikTok tidak mengirim metadata media.");
  const normalized=freeProviderMediaInfo({normalized:{kind:"media",title,thumbnail,duration:duration||null,media}},rawUrl,requestUrl);
  if(!normalized)throw new Error("Metadata TikTok ditemukan, tetapi stream tidak lolos normalisasi media.");
  normalized.providerName="TikTok public page fallback";
  normalized.provider="TikTok public page";
  normalized.fallbackUsed=true;
  normalized.author=author;
  normalized.canonicalUrl=extractTikTokCanonicalUrl(source,pageUrl)||pageUrl;
  return normalized;
}
async function fetchTikTokOEmbed(rawUrl,timeoutMs=6500){
  const endpoint=new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url",rawUrl);
  const response=await fetch(endpoint.href,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"},signal:AbortSignal.timeout(timeoutMs),cache:"no-store"});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload||!["video","rich"].includes(String(payload.type||"").toLowerCase()))throw new Error("TikTok oEmbed HTTP "+response.status+": "+String(payload?.error||payload?.message||"metadata embed tidak tersedia").slice(0,100));
  const html=String(payload.html||"");
  const id=String(payload.embed_product_id||html.match(/\/player\/v1\/(\d{8,})/i)?.[1]||html.match(/data-video-id=[\"'](\d{8,})[\"']/i)?.[1]||"");
  if(!/^\d{8,}$/.test(id))throw new Error("TikTok oEmbed tidak mengembalikan ID player yang valid.");
  const player=new URL("https://www.tiktok.com/player/v1/"+id);
  for(const [key,value] of Object.entries({controls:"1",timestamp:"1",description:"1",music_info:"1",rel:"0"}))player.searchParams.set(key,value);
  let thumbnail=null;
  try{const safe=safePublicMediaUrl(payload.thumbnail_url);if(safe)thumbnail=safe.href}catch{}
  return {id,title:String(payload.title||"Video TikTok").slice(0,240),author:String(payload.author_name||"").slice(0,120),thumbnail,embedUrl:player.href};
}
function extractTikTokVideoId(value){
  try{
    const url=new URL(value);
    const path=url.pathname.match(/\/(?:@[^/]*\/)?video\/(\d{8,})/i);
    return path?.[1]||url.searchParams.get("itemId")||url.searchParams.get("item_id")||url.searchParams.get("share_item_id")||null;
  }catch{return null}
}
function extractTikTokItemId(value){
  try{
    const url=new URL(value);
    const path=url.pathname.match(/\/(?:@[^/]*\/)?(?:video|photo)\/(\d{8,})/i);
    return path?.[1]||url.searchParams.get("itemId")||url.searchParams.get("item_id")||url.searchParams.get("share_item_id")||null;
  }catch{return null}
}
async function fetchTikTokPhotoImageData(rawUrl,timeoutMs=9000){
  const itemId=extractTikTokItemId(rawUrl);
  if(!itemId)throw new Error("ID postingan foto TikTok tidak ditemukan.");
  const webHeaders={accept:"application/json,text/plain,*/*","accept-language":"en-US,en;q=0.9","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",referer:"https://www.tiktok.com/"};
  const appHeaders={accept:"application/json,text/plain,*/*","accept-language":"en-US,en;q=0.9","user-agent":"com.zhiliaoapp.musically/350202 (Linux; U; Android 14; en_US; Pixel 7; Build/UP1A.231005.007; Cronet/TTNetVersion:6.0.0.0)",referer:"https://www.tiktok.com/"};
  const variants=[
    {name:"item-detail",url:new URL("https://www.tiktok.com/api/item/detail/"),params:{itemId,aid:"1988",app_name:"tiktok_web",device_platform:"web_pc"},headers:webHeaders},
    {name:"post-item-list",url:new URL("https://www.tiktok.com/api/post/item_list/"),params:{itemId,aid:"1988",app_name:"tiktok_web",device_platform:"web_pc",count:"1",cursor:"0"},headers:webHeaders},
    {name:"tiktokv-aweme-detail-web-us",url:new URL("https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/aweme/detail/"),params:{aweme_id:itemId,aid:"1988",app_name:"tiktok_web",device_platform:"webapp",version_code:"230400"},headers:webHeaders},
    {name:"tiktokv-aweme-detail-web-alisg",url:new URL("https://api16-normal-c-alisg.tiktokv.com/aweme/v1/aweme/detail/"),params:{aweme_id:itemId,aid:"1988",app_name:"tiktok_web",device_platform:"webapp",version_code:"230400"},headers:webHeaders},
    {name:"tiktokv-aweme-detail-app-us",url:new URL("https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/aweme/detail/"),params:{aweme_id:itemId,aid:"1988",app_name:"musical_ly",device_platform:"android",version_code:"350202",channel:"googleplay",os_version:"14",device_type:"Pixel 7"},headers:appHeaders},
    {name:"tiktokv-aweme-detail-app-alisg",url:new URL("https://api16-normal-c-alisg.tiktokv.com/aweme/v1/aweme/detail/"),params:{aweme_id:itemId,aid:"1988",app_name:"musical_ly",device_platform:"android",version_code:"350202",channel:"googleplay",os_version:"14",device_type:"Pixel 7"},headers:appHeaders}
  ];
  let lastDiagnostic="";
  for(let index=0;index<variants.length;index++){
    const variant=variants[index];
    for(const [key,value] of Object.entries(variant.params))variant.url.searchParams.set(key,value);
    const perAttempt=Math.max(2500,Math.floor(timeoutMs/variants.length));
    let response,payload;
    try{
      response=await fetch(variant.url.href,{headers:variant.headers||webHeaders,signal:AbortSignal.timeout(perAttempt),cache:"no-store"});
      payload=await response.json().catch(()=>null);
    }catch(error){
      lastDiagnostic=variant.name+": "+String(error?.message||error).slice(0,100);
      continue;
    }
    const root=payload?.data&&typeof payload.data==="object"?payload.data:payload;
    const list=Array.isArray(root?.itemList)?root.itemList:Array.isArray(root?.item_list)?root.item_list:Array.isArray(root?.items)?root.items:Array.isArray(root?.aweme_list)?root.aweme_list:[];
    const item=payload?.itemInfo?.itemStruct||payload?.item_info?.item_struct||root?.itemInfo?.itemStruct||root?.item_info?.item_struct||root?.itemStruct||root?.item_struct||root?.aweme_detail||root?.awemeDetail||root?.item||list.find(entry=>entry&&typeof entry==="object")||null;
    const imagePost=item?.imagePost||item?.image_post||item?.photoPost||item?.photo_post||item?.images||item?.imageList||null;
    const sourceImages=Array.isArray(imagePost)?imagePost:Array.isArray(imagePost?.images)?imagePost.images:Array.isArray(imagePost?.imageList)?imagePost.imageList:Array.isArray(imagePost?.image_list)?imagePost.image_list:Array.isArray(item?.image_post_info?.images)?item.image_post_info.images:Array.isArray(item?.imagePostInfo?.images)?item.imagePostInfo.images:Array.isArray(item?.image_post_info?.display_images)?item.image_post_info.display_images:Array.isArray(item?.imagePostInfo?.displayImages)?item.imagePostInfo.displayImages:Array.isArray(imagePost?.image_post_info?.images)?imagePost.image_post_info.images:[];
    if(response.ok&&item&&sourceImages.length){
      const seen=new Set(),images=[];
      for(const entry of sourceImages.slice(0,35)){
        const candidates=[
          ...collectTikTokUrlValues(entry?.imageURL||entry?.imageUrl||entry?.displayImage||entry?.display_image||entry?.originImage||entry?.origin_image||entry?.urlList||entry),
          ...collectTikTokUrlValues(entry?.thumbnail)
        ];
        for(const candidate of candidates){
          const safe=safePublicMediaUrl(decodeTikTokPageValue(candidate));
          if(!safe||seen.has(safe.href))continue;
          seen.add(safe.href);
          images.push({url:safe.href,type:"image",ext:imageExtensionFromUrl(safe.href)||"jpg",source:"TikTok "+variant.name});
          break;
        }
      }
      if(images.length)return {title:String(item.desc||item.description||"TikTok Photo Mode").slice(0,240),author:String(item.author?.nickname||item.author?.uniqueId||"").slice(0,100),images,source:variant.name};
      lastDiagnostic=variant.name+": imagePost tidak berisi URL foto publik yang aman.";
      continue;
    }
    const statusCode=payload?.statusCode??payload?.status_code??"unknown";
    const statusMessage=String(payload?.statusMsg||payload?.status_msg||payload?.message||payload?.error||"").slice(0,90);
    const keys=Object.keys(payload||{}).slice(0,9).join(",");
    const itemKeys=Object.keys(item||{}).slice(0,10).join(",");
    lastDiagnostic=variant.name+" HTTP "+response.status+" status "+statusCode+(statusMessage?" "+statusMessage:"")+" keys="+keys+(itemKeys?" item="+itemKeys:"");
  }
  throw new Error("TikTok tidak mengembalikan galeri foto publik. "+lastDiagnostic.slice(0,170));
}
function extractTikTokPhotoProxyImages(text){
  const normalized=decodeTikTokPageValue(String(text||"")).replace(/&amp;/gi,"&").replace(/\\u0026/gi,"&").replace(/\\u003d/gi,"=").replace(/\\\//g,"/");
  const urls=[...normalized.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)].map(match=>match[0].replace(/[),.;\]}]+$/g,""));
  const seen=new Set(),images=[];
  for(const raw of urls){
    const safe=safePublicMediaUrl(raw);if(!safe||seen.has(safe.href))continue;
    if(!/(?:tiktokcdn|byteoversea|ibytedtos|muscdn|tiktokv)/i.test(safe.hostname))continue;
    const ext=imageExtensionFromUrl(safe.href);
    if(!SOCIAL_IMAGE_EXTENSIONS.has(ext)&&!/photomode-image/i.test(safe.pathname))continue;
    seen.add(safe.href);
    images.push({url:safe.href,type:"image",ext:ext||"jpg",source:"TikTok official embed proxy"});
    if(images.length>=35)break;
  }
  return images;
}
async function fetchTikTokPhotoEmbedProxy(canonicalUrl,timeoutMs=14000){
  const itemId=extractTikTokItemId(canonicalUrl);
  if(!itemId)throw new Error("ID Photo Mode tidak tersedia untuk jalur proxy.");
  const target="https://www.tiktok.com/embed/v2/"+itemId;
  const encoded=encodeURIComponent(target);
  const headers={"accept":"text/html,text/plain,*/*","x-return-format":"html","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"};
  const jina=[
    {name:"Jina Reader HTML",url:"https://r.jina.ai/http://www.tiktok.com/embed/v2/"+itemId,headers},
    {name:"CORS.dev → Jina Reader",url:"https://proxy.cors.dev/https://r.jina.ai/http://www.tiktok.com/embed/v2/"+itemId,headers:{accept:"text/plain,text/html,*/*"}},
    {name:"Jina Reader HTTPS",url:"https://r.jina.ai/https://www.tiktok.com/embed/v2/"+itemId,headers}
  ];
  const fallbacks=[
    {name:"AllOrigins",url:"https://api.allorigins.win/raw?url="+encoded,headers:{accept:"text/html,*/*"}},
    {name:"CodeTabs",url:"https://api.codetabs.com/v1/proxy?quest="+encoded,headers:{accept:"text/html,*/*"}},
    {name:"CorsProxy",url:"https://corsproxy.io/?url="+encoded,headers:{accept:"text/html,*/*"}}
  ];
  const deadline=Date.now()+Math.max(5000,timeoutMs);
  const readEndpoint=async endpoint=>{
    const remaining=deadline-Date.now();
    if(remaining<=0)throw new Error("Batas waktu provider habis.");
    const response=await fetch(endpoint.url,{headers:endpoint.headers,redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(Math.min(remaining,8000))});
    if(!response.ok){await response.body?.cancel().catch(()=>{});throw new Error(endpoint.name+" HTTP "+response.status);}
    const body=(await response.text()).slice(0,5000000);
    const parsed=extractSocialImageCandidates(body,target,"tiktok").filter(item=>{try{return /photomode/i.test(new URL(item.url).pathname)}catch{return false}});
    const discovered=extractTikTokPhotoProxyImages(body);
    const seen=new Set(),images=[];
    for(const item of [...parsed,...discovered]){
      const safe=safePublicMediaUrl(item.url);if(!safe||seen.has(safe.href))continue;
      seen.add(safe.href);images.push({...item,url:safe.href,type:"image"});
      if(images.length>=35)break;
    }
    if(!images.length)throw new Error(endpoint.name+" tidak menemukan URL galeri Photo Mode.");
    return {title:"TikTok Photo Mode",images,source:endpoint.name};
  };
  const errors=[];
  // Jina is the only public route observed returning the full imagePostInfo gallery.
  for(const endpoint of jina){
    try{return await readEndpoint(endpoint)}
    catch(error){
      const message=String(error?.message||error);
      errors.push(message.slice(0,100));
      if(/HTTP 429/.test(message)&&Date.now()<deadline-900){
        await new Promise(resolve=>setTimeout(resolve,650));
        try{return await readEndpoint(endpoint)}
        catch(retryError){errors.push(String(retryError?.message||retryError).slice(0,100))}
      }
    }
  }
  const remaining=deadline-Date.now();
  if(remaining>500){
    const attempts=fallbacks.map(readEndpoint);
    try{return await Promise.any(attempts)}
    catch(error){
      const details=Array.isArray(error?.errors)?error.errors.map(item=>String(item?.message||item).slice(0,90)).join(" | "):String(error?.message||error);
      errors.push(details);
    }
  }
  throw new Error("Galeri foto TikTok belum bisa diambil dari provider publik. "+errors.join(" | ").slice(0,260));
}
async function tikTokItemDetailFallback(rawUrl,requestUrl,timeoutMs=8000){
  const videoId=extractTikTokItemId(rawUrl);
  if(!videoId)throw new Error("ID video belum tersedia untuk endpoint metadata TikTok.");
  const endpoint=new URL("https://www.tiktok.com/api/item/detail/");
  endpoint.searchParams.set("itemId",videoId);
  endpoint.searchParams.set("aid","1988");
  endpoint.searchParams.set("app_name","tiktok_web");
  endpoint.searchParams.set("device_platform","web_pc");
  const response=await fetch(endpoint.href,{headers:{accept:"application/json,text/plain,*/*","accept-language":"en-US,en;q=0.9","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",referer:"https://www.tiktok.com/video/"+videoId},signal:AbortSignal.timeout(timeoutMs),cache:"no-store"});
  const payload=await response.json().catch(()=>null);
  const item=payload?.itemInfo?.itemStruct||payload?.item_info?.item_struct||payload?.itemStruct||payload?.item||null;
  const statusCode=Number(payload?.statusCode??payload?.status_code??0);
  if(!response.ok||!item?.video||statusCode!==0)throw new Error("TikTok item detail HTTP "+response.status+" (status "+(Number.isFinite(statusCode)?statusCode:"unknown")+") tanpa metadata video publik.");
  const html='<script id="SIGI_STATE" type="application/json">'+JSON.stringify(payload)+'</script>';
  return extractTikTokPublicPageInfo(html,rawUrl,rawUrl,requestUrl);
}
async function tikTokNativePageFallback(rawUrl,requestUrl,timeoutMs=9000){
  let apiError="";
  try{return await tikTokItemDetailFallback(rawUrl,requestUrl,Math.min(timeoutMs,8000))}
  catch(error){apiError=String(error?.message||error).slice(0,180)}
  try{
    const page=await fetchSocialPostHtml(rawUrl,timeoutMs);
    const canonical=extractTikTokCanonicalUrl(page.html,page.url)||page.url;
    const info=extractTikTokPublicPageInfo(page.html,canonical,rawUrl,requestUrl);
    info.fallbackDiagnostic=apiError||null;
    return info;
  }catch(error){
    throw new Error("Item detail: "+(apiError||"tidak tersedia")+"; public page: "+String(error?.message||error).slice(0,180));
  }
}
function decodeFacebookReaderValue(value){
  return String(value||"").replace(/\\([_?&#=])/g,"$1").replace(/\\\//g,"/").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').trim();
}
function canonicalFacebookPostUrl(rawUrl){
  let u;try{u=new URL(rawUrl)}catch{return rawUrl}
  if(platformIdForUrl(u.href)!=="facebook")return u.href;
  if(u.pathname==="/story.php"){
    const story=u.searchParams.get("story_fbid")||u.searchParams.get("fbid");
    const owner=u.searchParams.get("id");
    if(story&&owner)return "https://www.facebook.com/permalink.php?story_fbid="+encodeURIComponent(story)+"&id="+encodeURIComponent(owner);
  }
  const group=u.pathname.match(/^\/groups\/(\d+)\/(?:permalink|posts)\/(\d+)\/?/i);
  if(group)return "https://www.facebook.com/groups/"+group[1]+"/posts/"+group[2]+"/";
  u.hash="";
  return u.href;
}
function facebookMobilePageUrl(rawUrl){
  const parsed=safePublicMediaUrl(rawUrl);
  if(!parsed||platformIdForUrl(parsed.href)!=="facebook")return rawUrl;
  if(parsed.hostname==="www.facebook.com"||parsed.hostname==="facebook.com")parsed.hostname="m.facebook.com";
  return parsed.href;
}
function extractFacebookEmbeddedMediaCandidates(html,pageUrl){
  const source=String(html||"").replace(/\\u0026/gi,"&").replace(/\\u003d/gi,"=").replace(/\\u003a/gi,":").replace(/\\\//g,"/");
  const output=[],seen=new Set();
  const add=(raw,height=0,label="Facebook video")=>{
    const value=decodeFacebookReaderValue(raw);
    let safe;try{safe=safePublicMediaUrl(new URL(value,pageUrl).href)}catch{return}
    if(!safe||seen.has(safe.href))return;
    const ext=(safe.pathname.match(/\.(mp4|m4v|webm)(?:$)/i)||[])[1]?.toLowerCase()||"mp4";
    seen.add(safe.href);
    output.push({url:safe.href,type:"video",kind:"video",mode:"video",ext,mimeType:ext==="webm"?"video/webm":"video/mp4",height:Number(height)||0,label});
  };
  const videoKeys=new Set(["playable_url","playable_url_quality_hd","playable_url_quality_sd","browser_native_hd_url","browser_native_sd_url","hd_src","sd_src","progressive_url","video_src","video_url","videourl","playurl","play_addr","playaddr","download_addr","downloadaddr"]);
  const walk=(value,depth=0)=>{
    if(depth>12||!value||typeof value!=="object")return;
    if(Array.isArray(value)){for(const item of value.slice(0,100))walk(item,depth+1);return}
    const height=Number(value.height||value.video_height||value.videoHeight)||0;
    for(const [key,item] of Object.entries(value)){
      if(typeof item==="string"&&videoKeys.has(key.toLowerCase())&&/^https?:\/\//i.test(decodeFacebookReaderValue(item)))add(item,height,key.toLowerCase().includes("hd")?"Facebook HD video":"Facebook video");
      else if(item&&typeof item==="object")walk(item,depth+1);
    }
  };
  for(const match of source.matchAll(/<(?:script)\b[^>]*>([\s\S]*?)<\/script>/gi)){
    const body=String(match[1]||"").trim();if(!body||body.length>3000000)continue;
    let parsed=null;try{parsed=JSON.parse(body)}catch{
      const first=body.indexOf("{"),last=body.lastIndexOf("}");
      if(first>=0&&last>first)try{parsed=JSON.parse(body.slice(first,last+1))}catch{}
    }
    if(parsed)walk(parsed);
    for(const entry of body.matchAll(/"(?:playable_url|playable_url_quality_hd|playable_url_quality_sd|browser_native_hd_url|browser_native_sd_url|hd_src|sd_src|progressive_url|video_src|video_url|videoUrl|playUrl|play_addr|download_addr)"\s*:\s*"((?:\\.|[^"\\])+)"/gi))add(entry[1]);
  }
  return output.slice(0,16);
}

async function fetchFacebookPublicReader(rawUrl,timeoutMs=9000){
  const parsed=safePublicMediaUrl(rawUrl);
  if(!parsed||platformIdForUrl(parsed.href)!=="facebook")throw new Error("Tautan Facebook publik tidak valid.");
  const mobileUrl=facebookMobilePageUrl(parsed.href);
  const candidates=[mobileUrl,canonicalFacebookPostUrl(parsed.href)].filter((value,index,array)=>array.indexOf(value)===index);
  const errors=[];let sawLogin=false;
  for(const candidate of candidates){
    try{
      const page=await fetchSocialPostHtml(candidate,timeoutMs);
      const finalSafe=safePublicMediaUrl(page.url||candidate);
      const finalUrl=finalSafe?.href||candidate;
      const html=String(page.html||"").slice(0,5000000);
      const titleMatch=html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']{1,300})["']/i)||html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
      const title=String(titleMatch?.[1]||"Facebook media").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim().slice(0,300);
      const images=extractSocialImageCandidates(html,finalUrl,"facebook");
      const media=[...extractGenericPublicMediaCandidates(html,finalUrl),...extractFacebookEmbeddedMediaCandidates(html,finalUrl)].filter(item=>item.mode==="video"||item.type==="video");
      const loginRedirect=/\/login(?:\.php)?(?:[/?#]|$)/i.test(new URL(finalUrl).pathname);
      const hasPostContent=!!(images.length||media.length||/<meta\b[^>]*(?:og:title|og:video|og:image)/i.test(html)||/Shared with Public|All reactions:|comments?/i.test(html));
      const loginPage=loginRedirect||(/Log into Facebook|Email or mobile number|Log in to Facebook/i.test(html)&&!hasPostContent);
      if(loginPage&&!hasPostContent)throw new Error("facebook_login_required");
      return {body:html,html,finalUrl,hasPostContent,images,media,title,source:"Facebook mobile public page"};
    }catch(error){
      const message=String(error?.message||error);
      if(message==="facebook_login_required"){sawLogin=true;continue;}
      errors.push(message.slice(0,120));
    }
  }
  // Last resort: a text reader can sometimes expose public posts when Facebook's
  // own mobile page is temporarily unavailable to the Worker.
  try{
    const readerUrl="https://r.jina.ai/http://"+parsed.hostname+parsed.pathname+parsed.search;
    const response=await fetch(readerUrl,{
      headers:{accept:"text/plain","user-agent":"Mozilla/5.0 (compatible; ARYANZZ Public Link Resolver/1.0)"},
      signal:AbortSignal.timeout(timeoutMs),cache:"no-store"
    });
    if(!response.ok)throw new Error("Facebook public reader HTTP "+response.status+".");
    const body=(await response.text()).slice(0,1500000);
    const finalMatch=body.match(/^Final URL:\s*(https?:\/\/[^\s]+)/mi);
    const finalUrl=finalMatch?decodeFacebookReaderValue(finalMatch[1]):null;
    const hasPostContent=/Markdown Content:\s*[\s\S]*?(?:##\s*\[|Shared with Public|All reactions:|comments?)/i.test(body);
    const loginRedirect=!!finalUrl&&/\/login(?:\.php)?(?:[/?#]|$)/i.test(finalUrl);
    if((loginRedirect||(/Log into Facebook|Email or mobile number/i.test(body)&&!hasPostContent))&&!hasPostContent)throw new Error("facebook_login_required");
    return {body,finalUrl,hasPostContent,images:[],media:[],title:(body.match(/^Title:\s*(.{1,300}?)(?:\s*\|\s*Facebook)?$/mi)||[])[1]||"Facebook media",source:"Facebook text reader"};
  }catch(error){
    if(String(error?.message||error)==="facebook_login_required")sawLogin=true;
    else errors.push(String(error?.message||error).slice(0,120));
  }
  if(sawLogin)throw new Error("facebook_login_required");
  throw new Error(errors.join(" | ")||"Facebook public page unavailable.");
}
async function resolveFacebookShareLink(rawUrl,timeoutMs=10000){
  const parsed=safePublicMediaUrl(rawUrl);
  if(!parsed||platformIdForUrl(parsed.href)!=="facebook")return rawUrl;
  // Keep short share URLs intact for the primary provider. The public-reader
  // fallback resolves them once, avoiding two sequential requests on weak networks.
  return canonicalFacebookPostUrl(parsed.href);
}
async function facebookPublicReaderMediaInfo(rawUrl,requestUrl,timeoutMs=9000){
  let page;
  try{page=await fetchFacebookPublicReader(rawUrl,timeoutMs)}
  catch(error){
    const detail=String(error?.message||error);
    const login=detail==="facebook_login_required";
    const accessLimited=/HTTP\s*(?:400|403|406|429)|rate.?limit|temporarily blocked/i.test(detail);
    const message=login
      ?"Facebook meminta login untuk membaca postingan ini. ARYANZZ hanya memproses postingan yang memang dapat diakses publik tanpa login."
      :accessLimited
        ?"Facebook sedang membatasi pembacaan otomatis dari server ARYANZZ. Pastikan postingan benar-benar publik dan dapat dibuka tanpa login. Jika Facebook tidak menyediakan stream video publik, file MP4 tidak dapat diambil."
        :"Facebook belum dapat dibaca melalui jalur metadata publik. Pastikan tautan benar dan coba lagi saat layanan Facebook stabil.";
    return json({
      ok:false,error:message,
      errorType:login?"login_required":accessLimited?"public_access_limited":"public_reader_unavailable",
      providerName:"Facebook mobile/public reader fallback",provider:"Facebook public page",
      fallbackTried:true,diagnostics:{detail:detail.slice(0,180)}
    },login?403:502);
  }
  const body=String(page.body||"");
  const titleMatch=body.match(/^Title:\s*(.{1,300}?)(?:\s*\|\s*Facebook)?$/mi);
  const title=String(page.title||titleMatch?.[1]||"Facebook media").replace(/\s+/g," ").trim().slice(0,300);
  const candidates=[],seen=new Set();
  const add=(value,declared={})=>{
    const decoded=decodeFacebookReaderValue(String(typeof value==="string"?value:declared.url||"").replace(/[),\]]+$/,""));
    const safe=safePublicMediaUrl(decoded);
    if(!safe||seen.has(safe.href))return;
    const ext=String(declared.ext||declared.extension||(safe.pathname.match(/\.(mp4|m4v|webm)$/i)||[])[1]||"").replace(/^\./,"").toLowerCase();
    const mime=String(declared.mimeType||declared.mime_type||"").split(";")[0].toLowerCase();
    if(!mime.startsWith("video/")&&!["mp4","m4v","webm"].includes(ext)&&!/\.(?:mp4|m4v|webm)(?:[?#]|$)/i.test(safe.href))return;
    seen.add(safe.href);
    candidates.push({type:"video",kind:"video",mode:"video",label:declared.label||"Video Facebook",url:safe.href,ext:ext||"mp4",mimeType:mime||"video/"+(ext||"mp4"),height:Number(declared.height)||0});
  };
  for(const item of Array.isArray(page.media)?page.media:[])add(item.url,item);
  for(const match of body.matchAll(/https?:\/\/[^\s"'<>()[\]]{8,3000}\.(?:mp4|m4v|webm)(?:\?[^\s"'<>()[\]]*)?/gi))add(match[0]);
  for(const match of body.matchAll(/(?:video|media)\s*(?:url|src)\s*[:=]\s*["']?(https?:\/\/[^\s"'<>]{8,3000})/gi))add(match[1]);
  const canonicalUrl=page.finalUrl?canonicalFacebookPostUrl(page.finalUrl):canonicalFacebookPostUrl(rawUrl);
  const normalized=freeProviderMediaInfo({normalized:{title,thumbnail:page.images?.[0]?.url||null,media:candidates}},canonicalUrl,requestUrl);
  if(normalized)return json({...normalized,providerName:"Facebook mobile/public-page fallback",provider:"Facebook public page · direct media metadata",extractor:"Facebook mobile page",fallbackUsed:true,canonicalUrl,diagnostics:{source:page.source||"Facebook public page",imagesFound:Number(page.images?.length)||0}});
  const imageCount=Number(page.images?.length)||0;
  return json({
    ok:false,platform:"facebook",title,canonicalUrl,
    error:imageCount
      ?"Postingan Facebook ini terbaca sebagai postingan bergambar, bukan video yang menyediakan stream MP4 langsung. Gunakan mode gambar untuk mengambil foto yang tersedia."
      :"Postingan Facebook dapat dibaca, tetapi halaman publik tidak mengekspos URL stream video langsung. Pastikan tautan menuju video/Reels publik, bukan postingan teks atau konten yang memerlukan login.",
    errorType:imageCount?"image_only_post":"no_public_video_stream",
    providerName:"Facebook mobile/public-page fallback",provider:"Facebook public page",fallbackTried:true,directDownloadAvailable:false,
    diagnostics:{source:page.source||"Facebook public page",imagesFound:imageCount}
  },502);
}
async function resolveSocialShortLink(rawUrl,key,timeoutMs=11000){
  const canonical=canonicalSocialPostUrl(rawUrl,key);
  if(key==="facebook")return resolveFacebookShareLink(canonical,timeoutMs);
  // Threads /share/ URLs are share wrappers, not media posts. Resolve to a real /post/ URL first.
  if(key==="threads"){
    let shared;try{shared=new URL(canonical)}catch{return canonical}
    if(/^\/share\/[^/]+\/?$/i.test(shared.pathname)){
      try{
        const page=await fetchSocialPostHtml(shared.href,timeoutMs);
        const candidates=[page.url];
        for(const match of String(page.html||"").matchAll(/<(?:link|meta)\b[^>]*(?:rel=["']canonical["']|property=["']og:url["'])[^>]*>/gi)){
          const tag=match[0];const raw=tag.match(/(?:href|content)=["']([^"']+)["']/i)?.[1];if(raw)candidates.push(raw.replace(/&amp;/g,"&"));
        }
        for(const raw of candidates){
          let target;try{target=new URL(raw,shared.href)}catch{continue}
          if(platformIdForUrl(target.href)==="threads"&&/^\/(?:@[^/]+\/)?post\/[^/]+\/?$/i.test(target.pathname))return target.href;
        }
      }catch{}
    }
  }
  let input;try{input=new URL(canonical)}catch{return canonical}
  const host=input.hostname.toLowerCase();
  const shortLink=(key==="tiktok"&&/^(?:vt|vm)\.tiktok\.com$/.test(host))
    ||(key==="instagram"&&host==="instagr.am")
    ||(key==="pinterest"&&host==="pin.it");
  if(!shortLink)return canonical;
  try{
    const page=await fetchSocialPostHtml(canonical,timeoutMs);
    const finalUrl=key==="tiktok"?(extractTikTokCanonicalUrl(page.html,page.url)||canonicalSocialPostUrl(page.url,key)):canonicalSocialPostUrl(page.url,key);
    if(platformIdForUrl(finalUrl)===key)return finalUrl;
  }catch{}
  return canonical;
}
async function fetchTikwmData(rawUrl,timeoutMs=10000){
  const endpoint=new URL("https://www.tikwm.com/api/");
  endpoint.searchParams.set("url",rawUrl);
  endpoint.searchParams.set("hd","1");
  const response=await fetch(endpoint.href,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36"},signal:AbortSignal.timeout(timeoutMs),cache:"no-store"});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload||Number(payload.code)!==0||!payload.data||typeof payload.data!=="object")
    throw new Error("TikWM HTTP "+response.status+": "+String(payload?.msg||payload?.message||"respons tidak berisi data media").slice(0,100));
  return payload.data;
}
function normalizeTikTokFallbackPayload(data,rawUrl,requestUrl,providerName){
  const media=[],seen=new Set();
  const imageExts=new Set(["jpg","jpeg","png","gif","webp","avif","bmp"]);
  const videoExts=new Set(["mp4","m4v","mov","webm","mkv","3gp"]);
  const audioExts=new Set(["mp3","m4a","aac","opus","ogg","wav","flac"]);
  const add=(url,label,type,ext,mimeType,height=0,descriptor={})=>{
    if(typeof url!=="string"||!url.trim()||seen.has(url))return;
    const safe=safePublicMediaUrl(url);if(!safe)return;
    const mime=String(mimeType||descriptor?.mime_type||descriptor?.mime||descriptor?.content_type||descriptor?.contentType||"").split(";")[0].trim().toLowerCase();
    const pathExt=(safe.pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]||"").toLowerCase();
    const declaredExt=String(ext||descriptor?.ext||descriptor?.extension||"").replace(/^\./,"").toLowerCase();
    const actualExt=pathExt||declaredExt;
    const descriptorType=String([type,descriptor?.type,descriptor?.kind,descriptor?.media_type,descriptor?.label].filter(Boolean).join(" ")).toLowerCase();
    const image=/image|photo|picture|thumbnail|cover/.test(descriptorType)||mime.startsWith("image/")||imageExts.has(actualExt);
    if(image)return;
    const audio=type==="audio"||mime.startsWith("audio/")||audioExts.has(actualExt)||/\baudio\b/.test(descriptorType);
    const video=type==="video"||mime.startsWith("video/")||videoExts.has(actualExt)||/\bvideo\b/.test(descriptorType);
    if(!audio&&!video)return;
    const finalExt=audio?(audioExts.has(actualExt)?actualExt:(ext||"mp3")):(videoExts.has(actualExt)?actualExt:(ext||"mp4"));
    const identity=safe.href+"|"+(audio?"audio":"video");if(seen.has(identity))return;seen.add(identity);
    media.push({type:audio?"audio":"video",kind:audio?"audio":"video",label:String(label||type||finalExt).slice(0,100),url:safe.href,ext:finalExt,mimeType:mime||(audio?"audio/mpeg":"video/mp4"),height:Number(height)||0});
  };
  const downloads=Array.isArray(data?.downloads)?data.downloads:[];
  const mediaGroups=Array.isArray(data?.media)?data.media:[];
  for(const group of mediaGroups){
    const groupType=String(group?.type||group?.kind||group?.media_type||"").toLowerCase();
    for(const variant of (Array.isArray(group?.variants)?group.variants:[])){
      const variantType=String(variant?.type||variant?.kind||variant?.media_type||groupType).toLowerCase();
      const mime=String(variant?.mime_type||variant?.mime||variant?.content_type||variant?.contentType||"").toLowerCase();
      const ext=String(variant?.ext||variant?.extension||variant?.container||"").toLowerCase();
      if(/image|photo|picture/.test(groupType+" "+variantType)||mime.startsWith("image/")||imageExts.has(ext))continue;
      const audio=groupType==="audio"||variantType==="audio"||mime.startsWith("audio/")||audioExts.has(ext)||ext==="mp3";
      const video=groupType==="video"||variantType==="video"||mime.startsWith("video/")||videoExts.has(ext)||(!audio&&!/image|photo|picture/.test(groupType+" "+variantType));
      if(!audio&&!video)continue;
      const quality=String(variant?.quality||variant?.label||variant?.container||"MP4");
      add(variant?.url||variant?.download_url||variant?.downloadUrl,quality,audio?"audio":"video",ext||(audio?"mp3":"mp4"),mime||(audio?"audio/mpeg":"video/mp4"),Number(variant?.height)||Number(quality.match(/(144|240|360|480|540|576|720|900|960|1080|1440|2160)p?/i)?.[1]||0),variant);
    }
  }
  for(const item of downloads){
    const type=String(item?.type||item?.kind||item?.media_type||"").toLowerCase();
    const mime=String(item?.mime_type||item?.mime||item?.content_type||item?.contentType||"").toLowerCase();
    const ext=String(item?.ext||item?.extension||item?.container||"").toLowerCase();
    if(/image|photo|picture/.test(type)||mime.startsWith("image/")||imageExts.has(ext))continue;
    const audio=ext==="mp3"||audioExts.has(ext)||mime.startsWith("audio/")||/mp3|audio/.test(type);
    const quality=String(item?.quality||item?.label||type||ext||"MP4");
    const height=Number(quality.match(/(144|240|360|480|540|576|720|900|960|1080|1440|2160)p?/i)?.[1]||0);
    add(item?.url||item?.download_url||item?.downloadUrl,quality,audio?"audio":"video",ext||(audio?"mp3":"mp4"),mime||(audio?"audio/mpeg":"video/mp4"),height,item);
  }
  add(data?.hdplay,"MP4 HD tanpa watermark","video","mp4","video/mp4");
  add(data?.play,"MP4 tanpa watermark","video","mp4","video/mp4");
  add(data?.wmplay,"MP4 dengan watermark","video","mp4","video/mp4");
  add(data?.download_url||data?.video_url||data?.videoUrl,"MP4 tanpa watermark","video","mp4","video/mp4");
  add(data?.author?.audio_url||data?.audio_url||data?.music_url||data?.music,"Audio MP3","audio","mp3","audio/mpeg");
  if(!media.some(item=>item.type==="video"))throw new Error(providerName+" tidak memberikan stream video MP4 yang valid.");
  const groupDurationMs=mediaGroups.find(group=>Number(group?.durationMs)>0)?.durationMs;
  const durationSeconds=Number(data.duration||data.author?.duration||(Number(groupDurationMs)>0?Number(groupDurationMs)/1000:0))||0;
  const normalized=freeProviderMediaInfo({normalized:{title:data.title||data.text||data.desc||"Video TikTok",thumbnail:data.thumbnail||data.cover||data.origin_cover,duration:durationSeconds,media}},rawUrl,requestUrl);
  if(!normalized)throw new Error("Stream "+providerName+" tidak lolos normalisasi media.");
  normalized.providerName=providerName+" fallback";
  normalized.provider=providerName+" public API";
  normalized.fallbackUsed=true;
  normalized.author=data.author?.nickname||data.author?.username||data.author?.unique_id||data.author||null;
  return normalized;
}
async function tikwmFallbackMediaInfo(rawUrl,requestUrl,alternateUrls=[]){
  const urls=[...new Set([rawUrl,...alternateUrls].filter(value=>typeof value==="string"&&value.trim()))];
  const errors=[];
  const providersFor=targetUrl=>[
    {name:"DrummerDuck",run:async()=>{
      const endpoint=new URL("https://download-tktk-video.drummerduck.com/api/extract");
      endpoint.searchParams.set("url",targetUrl);
      const response=await fetch(endpoint.href,{headers:{accept:"application/json"},signal:AbortSignal.timeout(9000),cache:"no-store"});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||payload?.ok!==true||!payload.data)throw new Error("DrummerDuck HTTP "+response.status+": "+String(payload?.error?.message||payload?.error||"no media data").slice(0,90));
      return payload.data;
    }},
    {name:"Seekubo",run:async()=>{
      const response=await fetch("https://tk.seekubo.com/api/v2/parse",{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({url:targetUrl}),signal:AbortSignal.timeout(9000),cache:"no-store"});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.success||!payload.data)throw new Error("Seekubo HTTP "+response.status+": "+String(payload?.error?.message||payload?.error?.code||"no data").slice(0,90));
      return payload.data;
    }},
    {name:"TDownV4",run:async()=>{
      const endpoint=new URL("https://tdownv4.sl-bjs.workers.dev/");
      endpoint.searchParams.set("down",targetUrl);
      const response=await fetch(endpoint.href,{headers:{accept:"application/json"},signal:AbortSignal.timeout(9000),cache:"no-store"});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload||payload.content_type!=="video"||!payload.download_url)throw new Error("TDownV4 HTTP "+response.status+": "+String(payload?.error||"no video URL").slice(0,90));
      return payload;
    }},
    {name:"TikWM",run:()=>fetchTikwmData(targetUrl,9000)}
  ];
  const tasks=urls.flatMap(targetUrl=>providersFor(targetUrl).map(provider=>({targetUrl,...provider})));
  const results=await Promise.allSettled(tasks.map(task=>task.run()));
  for(let i=0;i<results.length;i++){
    const result=results[i],task=tasks[i];
    if(result.status!=="fulfilled"){errors.push(task.name+" ("+new URL(task.targetUrl).hostname+"): "+String(result.reason?.message||result.reason).slice(0,95));continue;}
    try{return normalizeTikTokFallbackPayload(result.value,task.targetUrl,requestUrl,task.name)}
    catch(error){errors.push(task.name+": "+String(error?.message||error).slice(0,95));}
  }
  const nativeErrors=[];
  const nativeResults=await Promise.allSettled(urls.slice(0,2).map(targetUrl=>tikTokNativePageFallback(targetUrl,requestUrl,8000)));
  for(let index=0;index<nativeResults.length;index++){
    const result=nativeResults[index],targetUrl=urls[index];
    if(result.status==="fulfilled"){await verifyTikTokPhotoVideoFormats(result.value,targetUrl);return result.value;}
    nativeErrors.push(new URL(targetUrl).hostname+": "+String(result.reason?.message||result.reason).slice(0,180));
  }
  const providerSummary=errors.slice(0,8).join("; ").slice(0,260);
  const nativeSummary=nativeErrors.join("; ").slice(0,300);
  throw new Error((providerSummary?"Providers: "+providerSummary+"; ":"")+"Native TikTok metadata: "+(nativeSummary||"no public metadata response"));
}
function providerImageCandidates(data){
  const output=[],n=data?.normalized||{},r=data?.result||{};
  const add=(list,assumeImage)=>{
    if(!Array.isArray(list))return;
    for(const item of list.slice(0,80)){
      if(typeof item==="string"){if(assumeImage)output.push({url:item,type:"image"});continue}
      if(!item||typeof item!=="object")continue;
      let url=item.url||item.image_url||item.download_url||item.src||item.display_url||item.media_url||item.media_url_https;
      if(!url&&assumeImage){
        const nested=[];collectImageUrls(item,nested,0,true);
        for(const candidate of nested)output.push({...item,url:candidate,type:"image"});
        continue;
      }
      const ext=String(item.ext||item.extension||imageExtensionFromUrl(url||"")).toLowerCase();
      const mime=String(item.mime_type||item.mime||item.content_type||"").toLowerCase();
      const explicit=String(item.type||item.kind||item.media_type||"").toLowerCase();
      const isVideo=explicit==="video"||explicit==="audio"||mime.startsWith("video/")||mime.startsWith("audio/")||/\.(?:mp4|m4v|mov|webm|mkv|mp3|m4a|aac|opus)(?:[?#]|$)/i.test(String(url||""));
      const inferred=!isVideo&&(assumeImage||explicit==="image"||explicit==="photo"||explicit==="picture"||mime.startsWith("image/")||SOCIAL_IMAGE_EXTENSIONS.has(ext));
      output.push({...item,url,type:isVideo?"video":inferred?"image":explicit});
    }
  };
  for(const list of [n.images,n.photos,n.pictures,n.gallery,n.image_urls,n.photo_images,r.images,r.photos,r.pictures,r.gallery,r.image_urls,r.photo_images,n.carousel,r.carousel,n.imagePost?.images,r.imagePost?.images,n.photoPost?.images,r.photoPost?.images])add(list,true);
  for(const list of [n.media,r.media])add(list,false);
  for(const item of [n.image,n.image_url,n.imageUrl,n.photo,n.photo_url,r.image,r.image_url,r.imageUrl,r.photo,r.photo_url]){
    if(typeof item==="string")output.push({url:item,type:"image"});
    else if(item&&typeof item==="object")output.push({...item,url:item.url||item.image_url||item.src,type:"image"});
  }
  return output;
}
async function fetchWeirdDlInstagramData(rawUrl,timeoutMs=9000){
  const endpoint=new URL("https://weirddl.sbs/api/info");
  endpoint.searchParams.set("url",rawUrl);
  const response=await fetch(endpoint.href,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36"},signal:AbortSignal.timeout(timeoutMs),cache:"no-store"});
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.ok!==true||!Array.isArray(data.media))throw new Error("WeirdDL Instagram HTTP "+response.status+": "+String(data?.error||data?.message||"metadata tidak tersedia").slice(0,100));
  return data;
}
function normalizeWeirdDlInstagramData(data,rawUrl,requestUrl){
  const media=Array.isArray(data?.media)?data.media:[];
  const videos=media.filter(item=>String(item?.type||item?.kind||"").toLowerCase()==="video"||String(item?.mime_type||item?.mime||"").toLowerCase().startsWith("video/"));
  const images=media.filter(item=>String(item?.type||item?.kind||"").toLowerCase()==="image"||String(item?.mime_type||item?.mime||"").toLowerCase().startsWith("image/")||["jpg","jpeg","png","webp","avif","gif"].includes(String(item?.ext||item?.extension||"").toLowerCase()));
  const durationValue=data?.durationMs??data?.duration_ms??data?.durationSeconds??data?.duration_seconds??data?.videoDuration??data?.video_duration??data?.duration??data?.video?.duration??data?.result?.duration??data?.normalized?.duration;
  const rawDuration=Number(durationValue);
  const duration=Number.isFinite(rawDuration)&&rawDuration>0?(data?.durationMs!=null||data?.duration_ms!=null||rawDuration>86400?rawDuration/1000:rawDuration):null;
  if(videos.length){
    const normalized=freeProviderMediaInfo({normalized:{title:data.title||"Instagram video",thumbnail:data.thumbnail,duration,media:videos}},rawUrl,requestUrl);
    if(normalized){normalized.providerName="WeirdDL Instagram fallback";normalized.provider="Public Instagram media API";normalized.fallbackUsed=true;return normalized;}
  }
  if(images.length&&!videos.length){
    return {ok:true,providerReady:true,providerName:"WeirdDL Instagram photo resolver",provider:"Public Instagram image post",platform:"instagram",title:String(data.title||"Foto Instagram").slice(0,300),filename:String(data.title||"Instagram-photo").slice(0,300),duration:null,thumbnail:safePublicMediaUrl(data.thumbnail||"")?.href||null,type:"image",formats:[],imageOnly:true,capabilities:{linkAccepted:true,preview:true,mp4:false,audio:false,mp4Qualities:[]}};
  }
  return null;
}
async function resolveSocialImagePost(rawUrl,requestUrl,options={}){
  const providerKey=freePlatformKey(rawUrl);
  const key=platformIdForUrl(rawUrl)||providerKey;
  if(!key)return null;
  const canonicalUrl=await resolveSocialShortLink(rawUrl,key);
  let providerTitle="",providerImages=[],tikwmImages=[];
  const isTikTokPhotoRoute=key==="tiktok"&&(()=>{try{return /\/photo\//i.test(new URL(canonicalUrl).pathname)}catch{return false}})();
  const providerUrl=FREE_MEDIA_API+"/api/download/"+(providerKey||key)+"?url="+encodeURIComponent(canonicalUrl);
  // Experimental catalogue entries still get safe public-page metadata extraction;
  // only established provider keys are sent to the community extractor API.
  const includeProvider=options.includeProvider!==false&&providerKey!=="aio"&&!isTikTokPhotoRoute;
  let oembedImage=null,weirdDlImages=[];
  const tasks=[
    includeProvider?fetch(providerUrl,{headers:{accept:"application/json"},signal:AbortSignal.timeout(Number(options.providerTimeoutMs)||12000),cache:"no-store"}).then(async response=>{
      if(!response.ok)throw new Error("Provider gambar HTTP "+response.status);
      const data=await response.json().catch(()=>({}));
      if(data?.success===false)throw new Error("Provider tidak mendukung konten gambar ini.");
      providerTitle=String(data?.normalized?.title||data?.result?.title||data?.result?.caption||"").slice(0,240);
      providerImages=providerImageCandidates(data);
    }).catch(()=>{}):Promise.resolve(),
    (async()=>{
      if(isTikTokPhotoRoute){
        let page=null;
        try{
          const proxyData=await fetchTikTokPhotoEmbedProxy(canonicalUrl,Number(options.proxyTimeoutMs)||13000);
          providerTitle=providerTitle||proxyData.title;
          page={url:canonicalUrl,html:"",title:proxyData.title,images:proxyData.images};
          if(options.diagnostics)options.diagnostics.value={source:"TikTok Photo Mode",proxy:{ok:true,source:proxyData.source,imageCount:proxyData.images.length}};
        }catch(error){
          if(options.diagnostics)options.diagnostics.value={source:"TikTok Photo Mode",proxy:{ok:false,error:String(error?.message||error).slice(0,200)}};
          try{
            const photoData=await fetchTikTokPhotoImageData(canonicalUrl,Number(options.photoTimeoutMs)||7500);
            providerTitle=providerTitle||photoData.title;
            page={url:canonicalUrl,html:"",title:photoData.title,images:photoData.images.map(item=>({...item,type:"image",source:"TikTok item detail"}))};
            if(options.diagnostics)options.diagnostics.value={...(options.diagnostics.value||{}),itemDetail:{ok:true,imageCount:page.images.length,author:photoData.author||null}};
          }catch(detailError){
            if(options.diagnostics)options.diagnostics.value={...(options.diagnostics.value||{}),itemDetail:{ok:false,error:String(detailError?.message||detailError).slice(0,180)}};
          }
        }
        return page;
      }
      const pageRequestUrl=key==="facebook"?facebookMobilePageUrl(canonicalUrl):canonicalUrl;
      let page=await fetchSocialPostHtml(pageRequestUrl,Number(options.timeoutMs)||12000).then(result=>{
        const images=extractSocialImageCandidates(result.html,result.url,key);
        if(options.diagnostics)options.diagnostics.value={source:"public-page",status:result.status,bytes:result.html.length,imageCount:images.length};
        if(key==="tiktok"&&options.diagnostics){
          const excerpt=pattern=>{const index=result.html.search(pattern);return index<0?null:result.html.slice(Math.max(0,index-180),Math.min(result.html.length,index+520)).replace(/\s+/g," ").slice(0,700)};
          options.diagnostics.value={source:"official-embed-v2",status:result.status,bytes:result.html.length,imageCount:images.length,hasImagePost:/imagePost|image_post|photoPost|photo_post/i.test(result.html),hasImageURL:/imageURL|imageUrl|urlList/i.test(result.html),hasCaptcha:/captcha|verify to continue|access denied/i.test(result.html),imageURLExcerpt:excerpt(/imageURL|imageUrl|urlList/i)};
        }
        return {...result,images};
      }).catch(error=>{
        if(options.diagnostics)options.diagnostics.value={source:key==="tiktok"?"official-embed-v2":"public-page",error:String(error?.message||error).slice(0,180)};
        return null;
      });
      const tikTokPhotoSignals=key==="tiktok"&&(/photo.?mode|imagePost|image_post|photoPost|photo_post|imageURL|imageUrl|multi.?photo|carousel|image_post_info/i.test(page?.html||"")||isTikTokPhotoRoute);
      if((!page||!page.images?.length)&&tikTokPhotoSignals){
        try{
          const photoData=await fetchTikTokPhotoImageData(canonicalUrl,Number(options.photoTimeoutMs)||7500);
          providerTitle=providerTitle||photoData.title;
          const images=photoData.images.map(item=>({...item,type:"image",source:"TikTok item detail"}));
          page={...(page||{url:canonicalUrl,html:""}),title:photoData.title,images};
          if(options.diagnostics)options.diagnostics.value={...(options.diagnostics.value||{}),itemDetail:{ok:true,imageCount:images.length,author:photoData.author||null}};
        }catch(error){
          if(options.diagnostics)options.diagnostics.value={...(options.diagnostics.value||{}),itemDetail:{ok:false,error:String(error?.message||error).slice(0,180)}};
        }
      }
      if((!page||!page.images?.length)&&key==="instagram"){
        const postMatch=canonicalUrl.match(/\/(p|reel|reels|tv)\/([^/]+)/i);
        if(postMatch){
          const shareQuery=new URL(canonicalUrl).search;
          const postBase="https://www.instagram.com/"+postMatch[1].toLowerCase()+"/"+postMatch[2]+"/";
          const variants=[postBase+"embed/captioned/"+shareQuery,postBase+"embed/"+shareQuery];
          const fallbacks=await Promise.all(variants.map(url=>fetchSocialPostHtml(url,8500).then(result=>({...result,images:extractSocialImageCandidates(result.html,result.url,key)})).catch(()=>null)));
          const best=fallbacks.filter(Boolean).sort((a,b)=>(b.images?.length||0)-(a.images?.length||0))[0];
          if(best&&(!page||(best.images?.length||0)>(page.images?.length||0)))page=best;
        }
      }
      return page;
    })(),
    key==="tiktok"&&!isTikTokPhotoRoute?fetchTikwmData(canonicalUrl,9000).then(data=>{
      providerTitle=providerTitle||String(data.title||"").slice(0,240);
      tikwmImages=providerImageCandidates({normalized:{images:data.images,photos:data.photos,gallery:data.gallery}});
    }).catch(()=>{}):Promise.resolve(),
    Promise.resolve(),
    key==="instagram"?(async()=>{
      try{
        const endpoint=new URL("https://www.instagram.com/api/v1/oembed/");
        endpoint.searchParams.set("url",canonicalUrl);
        const response=await fetch(endpoint.href,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36"},signal:AbortSignal.timeout(9000),cache:"no-store"});
        const data=await response.json().catch(()=>null);
        const safe=safePublicMediaUrl(data?.thumbnail_url||"");
        if(response.ok&&safe){
          oembedImage={url:safe.href,type:"image",width:Number(data.thumbnail_width)||0,height:Number(data.thumbnail_height)||0,source:"instagram-oembed"};
          providerTitle=providerTitle||String(data.title||"").slice(0,240);
        }
      }catch{}
    })():Promise.resolve(),
    key==="instagram"?(async()=>{
      try{
        const data=await fetchWeirdDlInstagramData(canonicalUrl,9000);
        providerTitle=providerTitle||String(data.title||"").slice(0,240);
        const images=(Array.isArray(data.media)?data.media:[]).filter(item=>String(item?.type||item?.kind||"").toLowerCase()==="image"||["jpg","jpeg","png","webp","avif","gif"].includes(String(item?.ext||item?.extension||"").toLowerCase()));
        weirdDlImages=providerImageCandidates({normalized:{title:data.title,media:images}}).filter(item=>item.type==="image").map(item=>({...item,source:"WeirdDL"}));
      }catch{}
    })():Promise.resolve()
  ];
  const page=await tasks[1];
  await Promise.all([tasks[0],tasks[2],tasks[3],tasks[4],tasks[5]]);
  const rawCandidates=[...(page?.images||[]).map(item=>({...item,type:"image",source:item.source||"post-page"})),...providerImages.map(item=>({...item,url:item.url,source:"provider",type:item.type||item.kind||item.media_type||"image",mime_type:item.mime_type||item.mime||item.content_type||"",width:item.width||item.w||0,height:item.height||item.h||0,ext:item.ext||item.extension||""})),...(oembedImage?[oembedImage]:[]),...weirdDlImages,...tikwmImages.map(item=>({...item,url:item.url,source:"TikWM",type:"image"}))];
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
    if(images.length>=35)break;
  }
  if(!images.length)return null;
  const title=providerTitle||decodeSearchHtml((page?.html||"").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"Postingan gambar").slice(0,240);
  const canonicalSourceUrl=key==="tiktok"?canonicalUrl:(page?.url||canonicalUrl);
  for(const image of images){image.sourceUrl=canonicalSourceUrl;image.previewUrl=socialImageProxyUrl(image.url,requestUrl,image.filename,false,canonicalSourceUrl);image.downloadUrl=socialImageProxyUrl(image.url,requestUrl,image.filename,true,canonicalSourceUrl)}
  return {title,url:canonicalSourceUrl,platform:key,provider:providerKey==="aio"?"public-page-metadata":"provider-and-public-page",verified:true,images};
}
async function socialImageInfo(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const raw=String(body?.url||"").trim();
  if(!isPlatformLink(raw)||!freePlatformKey(raw))return json({error:"Tempel tautan postingan publik dari platform yang didukung."},400);
  if(socialRateLimited(request))return json({error:"Batas permintaan gambar gratis tercapai. Tunggu satu menit lalu coba lagi."},429);
  try{
    const diagnostics={};
    const post=await resolveSocialImagePost(raw,request.url,{diagnostics});
    if(!post)return json({error:"Belum ditemukan file gambar asli pada postingan ini. Bisa jadi postingan berisi video, privat, memerlukan login, atau platform membatasi akses publik.",diagnostics:diagnostics.value||null},404);
    return json({ok:true,...post});
  }catch(error){return json({error:"Gagal mengambil gambar postingan: "+String(error?.message||error).slice(0,150)},502)}
}
function socialImagePlatformKey(raw,fallback){const id=platformIdForUrl(raw);const key=id?canonicalPlatformId(id):(freePlatformKey(raw)||fallback);return key==="twitter"?"x":key;}
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
  let score=Math.min(1,coverage*.8+phrase);
  if(/green\s*screen|greenscreen|layar\s*hijau/i.test(String(query||""))&&/green\s*screen|greenscreen|chroma\s*key|layar\s*hijau|green\s*background/i.test(String(text||"")))score=Math.max(score,0.42);
  if(/meme\s+kucing|kucing\s+meme|cat\s+meme/i.test(String(query||""))&&/cat|kucing|kitten|meow/i.test(String(text||"")))score=Math.max(score,0.38);
  return score;
}
function strictTitleIntentScore(query,title,snippet=""){
  const stop=new Set(["dj","remix","official","video","audio","music","lagu","song","full","hd","viral","the","and","for","with","from"]);
  const normalize=value=>String(value||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const tokens=[...new Set(normalize(query).split(" ").filter(token=>token.length>1&&!stop.has(token)))];
  if(!tokens.length)return publicSearchRelevance(query,title+" "+snippet);
  const titleWords=new Set(normalize(title).split(" "));
  const snippetWords=new Set(normalize(snippet).split(" "));
  const titleMatches=tokens.filter(token=>titleWords.has(token)).length;
  // Snippets often contain recommendations for unrelated tracks. Require the actual title
  // to match all distinctive words; a matching description alone is not an exact title match.
  if(titleMatches!==tokens.length)return 0;
  return 1;
}
function parseBingSocialImageResults(html,platform,requestUrl,query,allowWeb=false){
  const results=[],seen=new Set(),domains=socialSearchDomains(platform);
  const tags=String(html||"").matchAll(/<a\b[^>]*class=["'][^"']*\biusc\b[^"']*["'][^>]*>/gi);
  for(const match of tags){
    const attrs=match[0],metaMatch=attrs.match(/\bm\s*=\s*'([^']*)'/i)||attrs.match(/\bm\s*=\s*"((?:&quot;|[^"])*)"/i);if(!metaMatch)continue;
    let meta;try{meta=JSON.parse(decodeSearchHtml(metaMatch[1]).replace(/\\u0026/g,"&"))}catch{continue}
    const source=allowWeb?safePublicMediaUrl(meta.purl||meta.surl||meta.url||""):socialImageSearchDomainsMatch(meta.purl||meta.surl||meta.url||"",platform);
    const image=safePublicMediaUrl(String(meta.murl||meta.mediaUrl||meta.turl||"").replace(/&amp;/g,"&"));
    if(!source||!image)continue;
    const resultPlatform=socialImagePlatformKey(source.href,allowWeb?"web":platform);
    if(resultPlatform==="pinterest"&&!/\/pin\//i.test(source.pathname))continue;
    if(resultPlatform==="tiktok"&&!/\/photo\//i.test(source.pathname))continue;
    if(resultPlatform==="instagram"&&!/(?:\/p\/|\/reel\/|\/tv\/|\/share\/)/i.test(source.pathname))continue;
    if(/\.(?:svg|ico)(?:[?#]|$)/i.test(image.href)||/(?:avatar|profile|favicon|logo|emoji|sprite|icon)(?:[._/-]|$)/i.test(image.href))continue;
    if(seen.has(image.href))continue;seen.add(image.href);
    const title=decodeSearchHtml(meta.desc||meta.t||meta.title||query)||query;
    if(publicSearchRelevance(query,title)<0.12)continue;
    const index=results.length,ext=imageExtensionFromUrl(image.href)||"jpg";
    const filename=imageSafeFilename(title,index,ext);
    results.push({
      title,platform:resultPlatform,sourceUrl:source.href,url:image.href,
      previewUrl:socialImageProxyUrl(image.href,requestUrl,filename,false,source.href),
      downloadUrl:socialImageProxyUrl(image.href,requestUrl,filename,true,source.href),
      filename,width:Number(meta.w||meta.width)||null,height:Number(meta.h||meta.height)||null,
      verified:true,searchProvider:"Bing Images"
    });
    if(results.length>=100)break;
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
    const resultPlatform=socialImagePlatformKey(link.href,platform);
    if(resultPlatform==="pinterest"&&!/\/pin\//i.test(link.pathname))continue;
    if(resultPlatform==="tiktok"&&!/\/photo\//i.test(link.pathname))continue;
    if(resultPlatform==="instagram"&&!/(?:\/p\/|\/reel\/|\/tv\/|\/share\/)/i.test(link.pathname))continue;
    const href=link.href.split("#")[0];if(seen.has(href))continue;seen.add(href);
    const title=decodeSearchHtml(match[2]);if(!title)continue;
    out.push({title,url:href,platform:socialImagePlatformKey(href,platform)});if(out.length>=limit)break;
  }
  return out;
}
async function verifySocialImageSearchResult(item,requestUrl){
  const sourceUrl=String(item?.sourceUrl||"");
  const platformId=platformIdForUrl(sourceUrl);
  if(!platformSupportsSearchMode(platformId,"image"))return null;
  let preview;
  try{preview=new URL(item.previewUrl,requestUrl)}catch{return null}
  if(preview.origin!==new URL(requestUrl).origin||preview.pathname!=="/api/social-image-file")return null;
  try{
    preview.searchParams.set("probe","1");
    const response=await socialImageFile(new Request(preview.href));
    const data=await response.json().catch(()=>({}));
    const mime=String(data.mimeType||"").split(";")[0].toLowerCase();
    if(!response.ok||data.valid!==true||!/^image\/(?:jpeg|png|webp|gif|avif|bmp)$/.test(mime))return null;
    return {...item,platform:canonicalPlatformId(platformId),verified:true,mediaVerified:true,mimeType:mime,imageSignature:data.signature||null};
  }catch{return null}
}
async function socialImageSearch(request){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const platform=String(body?.platform||"").toLowerCase(),query=String(body?.query||"").replace(/\s+/g," ").trim();
  const domains=socialSearchDomains(platform);
  const canonicalPlatform=platform==="all"?"all":canonicalPlatformId(platform);
  if(!domains.length)return json({ok:false,error:"Platform pencarian gambar belum didukung."},400);
  if(platform!=="all"&&!platformSupportsSearchMode(canonicalPlatform,"image")){
    const name=PLATFORM_CATALOG_BY_ID.get(canonicalPlatform)?.name||platform;
    return json({ok:false,error:name+" belum memiliki provider gambar terverifikasi untuk Cari Judul. Gunakan Tempel Tautan untuk pemeriksaan manual jika sumbernya publik."},400);
  }
  if(query.length<2||query.length>120)return json({error:"Masukkan kata kunci antara 2 sampai 120 karakter."},400);
  if(socialRateLimited(request))return json({error:"Batas pencarian gambar gratis tercapai. Tunggu satu menit lalu coba lagi."},429);
  try{
    // Build result buckets from the full live catalogue. AIO/experimental platforms
    // must keep their real platform IDs instead of collapsing into the generic "aio" provider key.
    const imageSearchPlatforms=[...new Set(PLATFORM_CATALOG
      .filter(item=>platformSearchModes(item.id).includes("image"))
      .map(item=>canonicalPlatformId(item.id)))];
    // Only query platforms with a provider-backed image route; AIO-only entries stay in link mode.
    const targetedAllPlatforms=imageSearchPlatforms.filter((key,index,array)=>array.indexOf(key)===index);
    const fetchBing=async(searchTerm,scope,allowWeb=false,first=1)=>{
      const url=new URL("https://www.bing.com/images/search");
      url.searchParams.set("q",canonicalPublicSearchQuery(searchTerm));url.searchParams.set("form","HDRSC3");url.searchParams.set("count","50");url.searchParams.set("first",String(first));
      try{
        const response=await fetch(url.href,{headers:{accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"},signal:AbortSignal.timeout(5000),cache:"no-store"});
        return response.ok?parseBingSocialImageResults(await response.text(),scope,request.url,query,allowWeb):[];
      }catch{return []}
    };
    const buckets=imageSearchPlatforms.map(key=>({platform:key,results:[]}));
    if(platform==="all"){
      const general=await fetchBing(query,"all",true);
      for(const item of general){
        const key=canonicalPlatformId(item.platform||"");
        if(!platformSupportsSearchMode(key,"image"))continue;
        const bucket=buckets.find(entry=>entry.platform===key);
        if(bucket&&!bucket.results.some(existing=>existing.url===item.url))bucket.results.push({...item,platform:key});
      }
      // All supported image providers are searched concurrently in a bounded set.
      const pending=targetedAllPlatforms.filter(key=>(buckets.find(entry=>entry.platform===key)?.results.length||0)<4);
      const additional=await Promise.all(pending.map(async key=>{
        const site=socialSearchDomains(key).map(domain=>"site:"+domain).join(" OR ");
        return {platform:key,results:await fetchBing(site+" "+query,key)};
      }));
      for(const entry of additional){
        const bucket=buckets.find(item=>item.platform===entry.platform);
        for(const item of entry.results||[])if(bucket&&!bucket.results.some(existing=>existing.url===item.url))bucket.results.push(item);
      }
    }else{
      const site=domains.map(domain=>"site:"+domain).join(" OR ");
      const selectedBucket=buckets.find(entry=>entry.platform===canonicalPlatform);
      if(selectedBucket){
        const normalizedQuery=query.replace(/greenscreen/ig,"green screen");
        const terms=[query,normalizedQuery,query+" image",query+" photo",query+" meme",query+" wallpaper",normalizedQuery+" background",normalizedQuery+" template",normalizedQuery+" overlay","chroma key "+normalizedQuery,"meme template "+normalizedQuery,normalizedQuery+" png"];
        const focusedTerms=[...new Set([query,normalizedQuery,query+" image",query+" photo",normalizedQuery+" background"])].slice(0,4);
        const batches=await Promise.all(focusedTerms.map(term=>fetchBing(site+" "+term,platform,false,1)));
        const seenItems=new Set();for(const batch of batches)for(const item of batch){if(!seenItems.has(item.url)){seenItems.add(item.url);selectedBucket.results.push(item)}if(selectedBucket.results.length>=100)break;}
      }
    }
    const results=[],seenImages=new Set(),platformCounts={};
    const maxPerPlatform=platform==="all"?3:24;
    const maxResults=24;
    if(platform==="all"){
      for(let round=0;results.length<maxResults;round++){
        let added=false;
        for(const bucket of buckets){
          const item=bucket.results[round];if(!item)continue;
          const key=item.platform||bucket.platform;
          if((platformCounts[key]||0)>=maxPerPlatform||seenImages.has(item.url))continue;
          seenImages.add(item.url);results.push(item);platformCounts[key]=(platformCounts[key]||0)+1;added=true;
          if(results.length>=maxResults)break;
        }
        if(!added)break;
      }
    }else{
      for(const item of (buckets.find(entry=>entry.platform===canonicalPlatform)?.results||[])){
        if(seenImages.has(item.url))continue;
        seenImages.add(item.url);results.push(item);platformCounts[item.platform||platform]=(platformCounts[item.platform||platform]||0)+1;
        if(results.length>=maxResults)break;
      }
    }
    let candidates=[];
    const distinctPlatforms=Object.keys(platformCounts).length;
    const distinctSocialPlatforms=Object.keys(platformCounts).filter(key=>key!=="web").length;
    const needsFallback=results.length<4||(platform==="all"&&distinctSocialPlatforms<2);
    if(needsFallback){
      const allDomains=socialSearchDomains(platform),site=allDomains.map(domain=>"site:"+domain).join(" OR ");
      const searchTerm=platform==="all"?"("+site+") "+query:site+" "+query;
      const ddgQueries=[searchTerm,searchTerm+" (image OR photo OR meme OR gambar OR foto OR pin)"];
      const pages=await Promise.all(ddgQueries.map(async term=>{
        const url=new URL("https://html.duckduckgo.com/html/");url.searchParams.set("q",term);
        try{const response=await fetch(url.href,{headers:{accept:"text/html","user-agent":"Mozilla/5.0 (compatible; ARYANZZ/81.4)"},signal:AbortSignal.timeout(5000),cache:"no-store"});return response.ok?await response.text():""}catch{return ""}
      }));
      const seenPosts=new Set();
      for(const page of pages)candidates.push(...parseSocialImageSearchLinks(page,platform,seenPosts,50-candidates.length).filter(item=>publicSearchRelevance(query,item.title)>=0.12));
      const eligibleCandidates=candidates.filter(item=>platformSupportsSearchMode(platformIdForUrl(item.url),"image"));
      const posts=await Promise.all(eligibleCandidates.slice(0,platform==="all"?4:6).map(item=>resolveSocialImagePost(item.url,request.url,{timeoutMs:5000,providerTimeoutMs:5500}).then(post=>post?{item,post}:null).catch(()=>null)));
      for(const entry of posts.filter(Boolean)){
        for(const image of entry.post.images||[]){
          if(results.length>=100)break;
          const imageUrl=String(image.url||""),key=socialImagePlatformKey(entry.post.url||entry.item.url,entry.post.platform||entry.item.platform||platform);
          if(seenImages.has(imageUrl)||(platform==="all"&&(platformCounts[key]||0)>=maxPerPlatform))continue;
          seenImages.add(imageUrl);
          results.push({...image,title:entry.post.title==="Postingan gambar"?entry.item.title:entry.post.title,platform:key,sourceUrl:entry.post.url||entry.item.url,verified:true,searchProvider:"Public post metadata"});
          platformCounts[key]=(platformCounts[key]||0)+1;
        }
        if(results.length>=100)break;
      }
    }
    const verificationCandidates=results.slice(0,platform==="all"?12:12).filter(item=>platformSupportsSearchMode(platformIdForUrl(item.sourceUrl),"image"));
    // Probe the true MIME/signature concurrently; do not mark unchecked images as verified.
    const verifiedImages=(await Promise.all(verificationCandidates.map(item=>verifySocialImageSearchResult(item,request.url)))).filter(Boolean);
    const grouped=verifiedImages.map(item=>({title:item.title||query,sourceUrl:item.sourceUrl,platform:item.platform||platform,verified:true,images:[item]}));
    const counts=grouped.reduce((out,item)=>{const key=socialImagePlatformKey(item.sourceUrl,item.platform||"other");out[key]=(out[key]||0)+1;return out},{});
    return json({ok:true,platform,query,results:grouped,imageCount:grouped.length,verifiedCount:grouped.length,platformCounts:counts,searchablePlatformCount:imageSearchPlatforms.length,unsupportedCandidateCount:Math.max(0,results.length-verificationCandidates.length),failedImageChecks:Math.max(0,verificationCandidates.length-grouped.length),unavailableCount:Math.max(0,candidates.length-grouped.length),searchProvider:"Bing Images + provider-backed source filtering + live image MIME verification"});
  }catch(error){return json({error:"Pencarian gambar gagal dijangkau. "+String(error?.message||error).slice(0,120)},502)}
}
function imageSignatureMatches(bytes,mime){
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  if(mime==="image/jpeg")return b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(mime==="image/png")return b.length>=8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b[4]===0x0d&&b[5]===0x0a&&b[6]===0x1a&&b[7]===0x0a;
  if(mime==="image/gif")return b.length>=6&&String.fromCharCode(...b.slice(0,6)).match(/^GIF8[79]a$/)!==null;
  if(mime==="image/webp")return b.length>=12&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP";
  if(mime==="image/avif")return b.length>=12&&String.fromCharCode(...b.slice(4,8))==="ftyp"&&/^(?:avif|avis)$/.test(String.fromCharCode(...b.slice(8,12)));
  if(mime==="image/bmp")return b.length>=2&&b[0]===0x42&&b[1]===0x4d;
  return false;
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
        const redirectTarget=new URL(location,current.href);if(redirectTarget.protocol==="http:")redirectTarget.protocol="https:";const next=safePublicMediaUrl(redirectTarget.href);
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
    if(u.searchParams.get("probe")==="1"){
      const reader=upstream.body.getReader(),parts=[];let total=0,done=false;
      try{
        while(total<16&&!done){
          const part=await reader.read();done=!!part.done;
          if(part.value){parts.push(part.value);total+=part.value.byteLength;}
        }
      }finally{await reader.cancel().catch(()=>{});}
      const sample=new Uint8Array(Math.min(total,32));let offset=0;
      for(const part of parts){const take=Math.min(part.byteLength,sample.length-offset);if(take<=0)break;sample.set(part.subarray(0,take),offset);offset+=take;}
      const valid=imageSignatureMatches(sample,mime);
      if(!valid)return json({valid:false,mimeType:mime,error:"Isi file tidak cocok dengan signature gambar yang didukung."},415);
      const extension=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/avif":"avif","image/bmp":"bmp"})[mime]||"";
      return json({valid:true,mimeType:mime,extension,signature:mime.slice(6)},200);
    }
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
    const base=String(u.searchParams.get("filename")||"aryanzz-image").replace(/[\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").slice(0,90)||"aryanzz-image";
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
const INVIDIOUS_PUBLIC_INSTANCES=["https://inv.nadeko.net","https://invidious.nerdvpn.de","https://invidious.tiekoetter.com"];
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
  return ({18:360,22:720,37:1080,59:480,78:480,82:360,83:480,84:720,85:1080,133:240,134:360,135:480,136:720,137:1080,160:144,264:1440,266:2160,271:1440,272:2160,298:720,299:1080,308:1440,313:2160,315:2160})[itag]||0;
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
  const itag=Number(url?.searchParams?.get("itag")||item?.itag),declaredExt=String(item?.ext||"").toLowerCase();
  const mp4=mime.includes("video/mp4")||mime.includes("video/x-m4v")||container.includes("mpeg_4")||container==="mp4"||container==="m4v"||declaredExt==="mp4"||String(url?.searchParams?.get("mime")||"").toLowerCase().includes("video/mp4")||(/\.mp4(?:$|[?#])/i.test(url?.pathname||""))||(progressiveSource&&[18,22,37,59,78,82,83,84,85,264,266].includes(itag));
  const webm=mime.includes("video/webm")||container==="webm"||declaredExt==="webm"||(/\.webm(?:$|[?#])/i.test(url?.pathname||""));
  const ext=mp4?"mp4":webm?"webm":"";
  const videoOnly=adaptiveSource||item?.videoOnly===true||item?.isVideoOnly===true||item?.video_only===true||item?.hasAudio===false||item?.has_audio===false;
  if(!url||![144,240,360,480,720,1080,1440,2160].includes(height)||!ext)return null;
  return {mode:"video",height,quality:height+"p",ext,mimeType:ext==="webm"?"video/webm":"video/mp4",url:url.toString(),bitrate:Number(item.bitrate)||0,sizeBytes:hybridFormatSizeBytes(item),videoOnly};
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
      try{const u=new URL(raw);const unhealthy=u.hostname.toLowerCase()==="yt.chocolatemoo53.com";return !unhealthy&&u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&meta?.api===true&&meta?.cors===true&&!u.hostname.endsWith(".onion")?u.origin:null;}catch{return null;}
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
  const hasUsableVideo=formats.some(item=>item.mode==="video"&&["mp4","webm"].includes(item.ext)&&(!item.videoOnly||formats.some(audio=>audio.mode==="audio"&&(item.ext==="webm"?["webm","opus"].includes(audio.ext):audio.ext==="m4a"))));
  const isLive=Boolean(data.isLive||data.isLiveStream||data.is_live||data.is_live_stream||data.liveStream||data.livestream);
  const isUpcoming=Boolean(data.isUpcoming||data.is_upcoming);
  if((!hasUsableVideo&&!isLive&&!isUpcoming)||!data.title)return null;
  return {ok:true,providerReady:true,providerName:"Hybrid",provider:"Piped",instance,title:String(data.title).slice(0,300),thumbnail:typeof data.thumbnailUrl==="string"?data.thumbnailUrl:null,duration:Number(data.duration)||null,uploader:String(data.uploader||"").slice(0,160),isLive,isUpcoming,formats:formats.map((f,i)=>({...f,id:"f"+i})),message:isLive?"Siaran langsung terdeteksi.":"Stream tersedia dari instance komunitas."};
}
function hybridFromInvidious(data,instance){
  const adaptive=Array.isArray(data.adaptiveFormats)?data.adaptiveFormats:Array.isArray(data.adaptive_formats)?data.adaptive_formats:[];
  const formats=dedupeHybridFormats([...((Array.isArray(data.formatStreams)?data.formatStreams:Array.isArray(data.format_streams)?data.format_streams:[]).map(item=>hybridVideoFormat(item,instance,true)).filter(Boolean)),...adaptive.map(item=>String(item?.type||item?.mimeType||"").toLowerCase().startsWith("video/")?hybridVideoFormat(item,instance,true,true):hybridAudioFormat(item,instance)).filter(Boolean)]);
  const hasUsableVideo=formats.some(item=>item.mode==="video"&&["mp4","webm"].includes(item.ext)&&(!item.videoOnly||formats.some(audio=>audio.mode==="audio"&&(item.ext==="webm"?["webm","opus"].includes(audio.ext):audio.ext==="m4a"))));
  const isLive=Boolean(data.liveNow||data.isLive||data.is_live||data.liveStream);
  const isUpcoming=Boolean(data.isUpcoming||data.is_upcoming);
  if((!hasUsableVideo&&!isLive&&!isUpcoming)||!data.title)return null;const thumb=Array.isArray(data.videoThumbnails)?data.videoThumbnails.find(x=>x.quality==="maxresdefault")||data.videoThumbnails[0]:null;
  return {ok:true,providerReady:true,providerName:"Hybrid",provider:"Invidious",instance,title:String(data.title).slice(0,300),thumbnail:typeof thumb?.url==="string"?thumb.url:null,duration:Number(data.lengthSeconds)||null,uploader:String(data.author||"").slice(0,160),isLive,isUpcoming,formats:formats.map((f,i)=>({...f,id:"f"+i})),message:isLive?"Siaran langsung terdeteksi.":"Stream tersedia dari instance komunitas."};
}
const HYBRID_INNERTUBE_CLIENTS=[
  {name:"ANDROID",version:"20.10.38",header:"3",context:{clientName:"ANDROID",clientVersion:"20.10.38",androidSdkVersion:34,hl:"en",gl:"US"},ua:"com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip"},
  {name:"IOS",version:"20.10.4",header:"5",context:{clientName:"IOS",clientVersion:"20.10.4",deviceModel:"iPhone16,2",osName:"iPhone",osVersion:"18.0.1",hl:"en",gl:"US"},ua:"com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_0_1 like Mac OS X)"},
  {name:"TVHTML5",version:"7.20250612.16.00",header:"7",context:{clientName:"TVHTML5",clientVersion:"7.20250612.16.00",clientScreen:"TV",hl:"en",gl:"US"},ua:"Mozilla/5.0 (SMART-TV; LINUX; Tizen 8.0) AppleWebKit/537.36"}
];
async function hybridInnerTubePlayer(videoId,client){
  const response=await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false",{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json","origin":"https://www.youtube.com","referer":"https://www.youtube.com/","user-agent":client.ua,"x-youtube-client-name":client.header,"x-youtube-client-version":client.version},
    body:JSON.stringify({context:{client:client.context},videoId,contentCheckOk:true,racyCheckOk:true}),
    signal:AbortSignal.timeout(6500),cache:"no-store"
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data)throw new Error("YouTube InnerTube "+client.name+" HTTP "+response.status);
  const details=data.videoDetails||{},micro=data.microformat?.playerMicroformatRenderer||{},liveDetails=micro.liveBroadcastDetails||{},streaming=data.streamingData||{};
  const playability=String(data.playabilityStatus?.status||"");
  const isUpcoming=Boolean(liveDetails.isUpcoming||liveDetails.is_upcoming||(playability==="LIVE_STREAM_OFFLINE"&&liveDetails.startTimestamp&&!liveDetails.endTimestamp));
  const isLive=Boolean(liveDetails.isLiveNow||liveDetails.is_live_now||details.isLive===true||(details.isLiveContent===true&&!liveDetails.endTimestamp&&!Number(details.lengthSeconds)&&Boolean(streaming.hlsManifestUrl)));
  if(playability&&playability!=="OK"&&!(playability==="LIVE_STREAM_OFFLINE"&&isUpcoming))throw new Error("YouTube "+client.name+": "+playability+" "+String(data.playabilityStatus?.reason||"").slice(0,90));
  const progressive=(Array.isArray(streaming.formats)?streaming.formats:[])
    .map(item=>hybridVideoFormat(item,"https://www.youtube.com",true,false)).filter(Boolean);
  const adaptive=(Array.isArray(streaming.adaptiveFormats)?streaming.adaptiveFormats:[])
    .map(item=>String(item?.mimeType||item?.type||"").toLowerCase().startsWith("video/")
      ?hybridVideoFormat(item,"https://www.youtube.com",false,true)
      :hybridAudioFormat(item,"https://www.youtube.com")).filter(Boolean);
  const formats=dedupeHybridFormats([...progressive,...adaptive]);
  const usable=formats.some(item=>item.mode==="video"&&["mp4","webm"].includes(item.ext)&&(!item.videoOnly||formats.some(audio=>audio.mode==="audio"&&(item.ext==="webm"?["webm","opus"].includes(audio.ext):audio.ext==="m4a"))));
  if(!usable&&!isLive&&!isUpcoming)throw new Error("YouTube "+client.name+" tidak mengembalikan URL MP4/WebM langsung yang dapat dipakai.");
  const thumbs=Array.isArray(details.thumbnail?.thumbnails)?details.thumbnail.thumbnails:[];
  const thumbnail=thumbs.slice().sort((a,b)=>(Number(b.width)||0)-(Number(a.width)||0))[0]?.url||null;
  const isLiveArchive=Boolean(details.isLiveContent&&!isLive&&!isUpcoming&&Number(details.lengthSeconds)>0);
  return {ok:true,providerReady:true,providerName:"Hybrid",provider:"YouTube InnerTube",instance:"https://www.youtube.com",videoId,title:String(details.title||"Video YouTube").slice(0,300),thumbnail,duration:Number(details.lengthSeconds)||null,uploader:String(details.author||"").slice(0,160),isLive,isUpcoming,isLiveArchive,liveStatus:isLive?"LIVE":isUpcoming?"UPCOMING":isLiveArchive?"ARCHIVE":null,liveManifestAvailable:Boolean(streaming.hlsManifestUrl||streaming.dashManifestUrl),liveEmbedUrl:"https://www.youtube-nocookie.com/embed/"+videoId,formats:formats.map((item,index)=>({...item,id:"f"+index,instance:"https://www.youtube.com",provider:"YouTube InnerTube"})),message:isLive?"Siaran langsung YouTube tersedia melalui pemutar resmi.":isUpcoming?"Siaran YouTube akan dimulai.":"Stream YouTube tersedia melalui jalur cadangan."};
}
async function hybridInnerTubeGroup(videoId){
  const settled=await Promise.all(HYBRID_INNERTUBE_CLIENTS.map(async client=>{
    try{return {ok:true,result:await hybridInnerTubePlayer(videoId,client)}}
    catch(error){return {ok:false,diagnostic:{provider:"YouTube InnerTube "+client.name,error:String(error?.message||error).slice(0,150)}}}
  }));
  return {results:settled.filter(item=>item.ok).map(item=>item.result),diagnostics:settled.filter(item=>!item.ok).map(item=>item.diagnostic)};
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
  const hasDirectProgressive=available.some(item=>(item.formats||[]).some(format=>format.mode==="video"&&["mp4","webm"].includes(format.ext)&&!format.videoOnly));
  const maxCommunityHeight=Math.max(0,...available.flatMap(item=>(item.formats||[]).filter(format=>format.mode==="video").map(format=>Number(format.height)||0)));
  const liveHint=available.some(item=>item.isLive||item.isUpcoming);
  if(!hasDirectProgressive||maxCommunityHeight<1440||liveHint){
    const innerTube=await hybridInnerTubeGroup(id);
    available.push(...innerTube.results);
    diagnostics.push(...innerTube.diagnostics);
  }
  if(available.length){
    const isLive=available.some(item=>item.isLive),isUpcoming=available.some(item=>item.isUpcoming),isLiveArchive=available.some(item=>item.isLiveArchive);
    const primary=available.find(item=>item.isLive||item.isUpcoming)||available.find(item=>(item.formats||[]).some(format=>format.mode==="video"&&!format.videoOnly))||available[0];
    const formats=dedupeHybridFormats(available.flatMap(result=>(result.formats||[]).map(format=>({...format,instance:format.instance||result.instance,provider:format.provider||result.provider}))));
    return json({...primary,videoId:id,isLive,isUpcoming,isLiveArchive,liveStatus:isLive?"LIVE":isUpcoming?"UPCOMING":isLiveArchive?"ARCHIVE":null,liveEmbedUrl:"https://www.youtube-nocookie.com/embed/"+id,providerReady:true,formats:formats.map((format,index)=>({...format,id:"f"+index})),providers:available.map(item=>({provider:item.provider,instance:item.instance,formatCount:item.formats?.length||0})),diagnostics:diagnostics.slice(0,20)});
  }
  {
    let preview={};
    try{const u=new URL("https://www.youtube.com/oembed");u.searchParams.set("url",raw);u.searchParams.set("format","json");const res=await fetch(u.toString(),{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});if(res.ok)preview=await res.json();}catch{}
    return json({ok:true,providerReady:false,providerName:"Hybrid",provider:"Unavailable",videoId:id,liveEmbedUrl:"https://www.youtube-nocookie.com/embed/"+id,title:String(preview.title||"Video YouTube").slice(0,300),thumbnail:typeof preview.thumbnail_url==="string"?preview.thumbnail_url:null,formats:[],providerMessage:"Instance komunitas belum memberikan stream MP4 yang dapat digunakan. Link video tetap valid; coba lagi nanti atau gunakan file yang memang dapat diunduh dari pemiliknya.",diagnostics:diagnostics.slice(0,20)});
  }
}
function hybridFilename(title,ext){
  const clean=String(title||"aryanzz-youtube").replace(/[\/:*?"<>|\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,90)||"aryanzz-youtube";
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
function hybridMediaSignatureMatches(bytes,ext){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  const ascii=(start,end)=>String.fromCharCode(...data.slice(start,end));
  if(ext==="mp4"||ext==="m4a")return data.length>=8&&ascii(4,8)==="ftyp";
  if(ext==="webm")return data.length>=4&&data[0]===0x1a&&data[1]===0x45&&data[2]===0xdf&&data[3]===0xa3;
  if(ext==="mp3")return data.length>=3&&(ascii(0,3)==="ID3"||(data[0]===0xff&&(data[1]&0xe0)===0xe0));
  if(ext==="ogg"||ext==="opus")return data.length>=4&&ascii(0,4)==="OggS";
  if(ext==="wav")return data.length>=12&&ascii(0,4)==="RIFF"&&ascii(8,12)==="WAVE";
  if(ext==="flac")return data.length>=4&&ascii(0,4)==="fLaC";
  return false;
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
  const title=hybridFilename(u.searchParams.get("title"),ext),range=probe?"bytes=0-15":request.headers.get("range");
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
    const reader=response.body.getReader(),chunks=[];let collected=0;
    try{
      while(collected<16){
        const part=await reader.read();
        if(part.done)break;
        if(part.value?.byteLength){chunks.push(part.value);collected+=part.value.byteLength;}
      }
    }catch(e){return json({error:"Gagal membaca byte awal stream: "+String(e.message||"network error").slice(0,120)},502)}
    finally{await reader.cancel().catch(()=>{});}
    const sample=new Uint8Array(Math.min(16,collected));let offset=0;
    for(const chunk of chunks){const take=Math.min(chunk.byteLength,sample.length-offset);if(take>0)sample.set(chunk.subarray(0,take),offset);offset+=take;if(offset>=sample.length)break;}
    const signatureValid=hybridMediaSignatureMatches(sample,ext);
    if(!signatureValid)return json({error:"Byte awal stream tidak cocok dengan format "+ext.toUpperCase()+"."},415);
    const contentRange=response.headers.get("content-range")||"";
    const totalMatch=contentRange.match(/\/(\d+)$/);
    const totalBytes=totalMatch?Number(totalMatch[1]):(response.status===200?size:null);
    return json({ok:true,status:response.status,contentType,contentLength:size||null,contentRange:contentRange||null,totalBytes:totalBytes||null,acceptRanges:response.headers.get("accept-ranges")||null,signatureValid:true,firstChunkBytes:collected});
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
function youtubeSearchText(value){
  if(typeof value==="string")return value.trim();
  if(!value||typeof value!=="object")return "";
  if(typeof value.simpleText==="string")return value.simpleText.trim();
  if(Array.isArray(value.runs))return value.runs.map(run=>String(run?.text||"")).join("").trim();
  return String(value.accessibility?.accessibilityData?.label||"").trim();
}
function youtubeSearchDuration(value){
  const text=youtubeSearchText(value);
  if(!text)return null;
  const parts=text.split(":").map(Number);
  if(!parts.length||parts.some(part=>!Number.isFinite(part)||part<0))return null;
  return parts.reduce((total,part)=>total*60+part,0)||null;
}
function collectYouTubeSearchItems(value,out,seen,depth=0){
  if(depth>22||!value||typeof value!=="object")return;
  if(Array.isArray(value)){for(const item of value)collectYouTubeSearchItems(item,out,seen,depth+1);return;}
  const renderer=value.videoRenderer||value.gridVideoRenderer||null;
  if(renderer){
    const id=String(renderer.videoId||renderer.navigationEndpoint?.watchEndpoint?.videoId||"").trim();
    const title=youtubeSearchText(renderer.title||renderer.headline);
    if(/^[A-Za-z0-9_-]{11}$/.test(id)&&title&&!seen.has(id)){
      seen.add(id);
      const thumbs=Array.isArray(renderer.thumbnail?.thumbnails)?renderer.thumbnail.thumbnails:[];
      const thumbnail=thumbs.slice().sort((a,b)=>(Number(b.width)||0)-(Number(a.width)||0))[0]?.url||null;
      const channel=youtubeSearchText(renderer.ownerText||renderer.shortBylineText||renderer.longBylineText);
      const duration=youtubeSearchDuration(renderer.lengthText||renderer.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text);
      const snippet=[channel,youtubeSearchText(renderer.viewCountText),youtubeSearchText(renderer.publishedTimeText)].filter(Boolean).join(" · ");
      out.push({title,url:"https://www.youtube.com/watch?v="+id,thumbnail,channel,duration,snippet,platform:"youtube",mediaMode:"video",provider:"YouTube InnerTube",instance:"https://www.youtube.com",searchProvider:"YouTube official search",verified:false,downloadable:false,searchOnly:true});
    }
  }
  for(const [key,item] of Object.entries(value))if(item&&typeof item==="object"&&key!=="videoRenderer"&&key!=="gridVideoRenderer")collectYouTubeSearchItems(item,out,seen,depth+1);
}
async function hybridInnerTubeSearch(query,parentSignal){
  const attempts=HYBRID_INNERTUBE_CLIENTS.map(async client=>{
    const timeout=AbortSignal.timeout(7000);
    const signal=parentSignal?AbortSignal.any([parentSignal,timeout]):timeout;
    const response=await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false",{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json","origin":"https://www.youtube.com","referer":"https://www.youtube.com/","user-agent":client.ua,"x-youtube-client-name":client.header,"x-youtube-client-version":client.version},
      body:JSON.stringify({context:{client:client.context},query,params:"EgIQAQ%3D%3D"}),
      signal,cache:"no-store"
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data)throw new Error("YouTube search "+client.name+" HTTP "+response.status);
    const results=[],seen=new Set();
    collectYouTubeSearchItems(data,results,seen);
    if(!results.length)throw new Error("YouTube search "+client.name+" tidak mengembalikan video.");
    return {ok:true,results:results.slice(0,20),provider:"YouTube official InnerTube search"};
  });
  try{return await Promise.any(attempts);}catch{return null;}
}
async function youtubeHtmlSearch(query,parentSignal){
  // The public results page embeds real videoRenderer records in ytInitialData.
  // This route does not require a stream extractor or forge media URLs.
  const url=new URL("https://www.youtube.com/results");url.searchParams.set("search_query",query);
  try{
    const signal=parentSignal?AbortSignal.any([parentSignal,AbortSignal.timeout(7000)]):AbortSignal.timeout(7000);
    const response=await fetch(url.href,{
      headers:{accept:"text/html,application/xhtml+xml","accept-language":"id-ID,id;q=0.9,en-US;q=0.8",
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        cookie:"CONSENT=YES+cb"},
      cache:"no-store",signal
    });
    if(!response.ok)return null;
    const html=(await response.text()).slice(0,5000000);
    let parsed=null;
    for(const pattern of [/(?:var\s+ytInitialData|window\[\s*["']ytInitialData["']\s*\])\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/i,/(?:var\s+ytInitialData|window\[\s*["']ytInitialData["']\s*\])\s*=\s*(\{[\s\S]*?\})\s*;/i]){
      const found=html.match(pattern);
      if(found){try{parsed=JSON.parse(found[1]);break;}catch{}}
    }
    if(!parsed)return null;
    const results=[],seen=new Set();
    collectYouTubeSearchItems(parsed,results,seen);
    const relevant=results.filter(item=>publicSearchRelevance(query,item.title+" "+(item.channel||""))>=0.16);
    if(!relevant.length)return null;
    return {ok:true,results:relevant.slice(0,20).map(item=>({...item,searchProvider:"YouTube public results page"})),provider:"YouTube public results page"};
  }catch{return null;}
}
async function hybridYouTubeSearch(query){
  const controller=new AbortController();
  const isRelevant=results=>Array.isArray(results)&&results.some(item=>publicSearchRelevance(query,item.title+" "+(item.channel||""))>=0.16);
  const directAttempt=hybridInnerTubeSearch(query,controller.signal).then(result=>{
    if(!isRelevant(result?.results))throw new Error("YouTube InnerTube returned no relevant titles");
    controller.abort();
    return result;
  });
  const htmlAttempt=youtubeHtmlSearch(query,controller.signal).then(result=>{
    if(!isRelevant(result?.results))throw new Error("YouTube results page unavailable");
    controller.abort();
    return result;
  });
  const [pipedInstances,invidiousInstances]=await Promise.all([currentHybridPipedInstances(),currentHybridInvidiousInstances()]);
  const candidates=[
    ...pipedInstances.slice(0,3).map(instance=>({instance,provider:"Piped",url:instance+"/search?q="+encodeURIComponent(query)+"&filter=videos"})),
    ...invidiousInstances.slice(0,3).map(instance=>({instance,provider:"Invidious",url:instance+"/api/v1/search?q="+encodeURIComponent(query)+"&type=video"}))
  ];
  const normalize=(item,provider,instance)=>{
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
    return title&&url?{title,url,thumbnail,channel,duration,provider,instance,platform:"youtube",mediaMode:"video",verified:false,downloadable:false,searchOnly:true,searchProvider:provider+" public search"}:null;
  };
  const attempts=candidates.map(async candidate=>{
    const data=await hybridFetchJson(candidate.url,controller.signal);
    const items=Array.isArray(data)?data:Array.isArray(data?.items)?data.items:Array.isArray(data?.results)?data.results:[];
    const results=items.map(item=>normalize(item,candidate.provider,candidate.instance)).filter(Boolean);
    const relevant=results.filter(item=>publicSearchRelevance(query,item.title+" "+(item.channel||""))>=0.16);
    if(!relevant.length)throw new Error(candidate.provider+" tidak menemukan judul yang sesuai.");
    controller.abort();
    return {ok:true,results:relevant.slice(0,8),provider:candidate.provider+" public instances"};
  });
  attempts.push(directAttempt,htmlAttempt);
  try{return await Promise.any(attempts);}catch{return null;}
}
async function freeYouTubeSearchItems(query,queryVariants=null,timeoutMs=18000){
  const variants=Array.isArray(queryVariants)&&queryVariants.length?queryVariants:[query];
  const responses=await Promise.all(variants.slice(0,5).map(async term=>{
    const endpoint=FREE_MEDIA_API+"/api/download/youtube-search?query="+encodeURIComponent(term)+"&limit=12";
    try{
      const response=await fetch(endpoint,{headers:{accept:"application/json"},signal:AbortSignal.timeout(Math.max(1000,Number(timeoutMs)||18000)),cache:"no-store"});
      if(!response.ok)return [];
      const data=await response.json().catch(()=>({}));
      if(data?.success===false)return [];
      const items=Array.isArray(data?.normalized?.items)?data.normalized.items:Array.isArray(data?.result)?data.result:[];
      return items.map(item=>({title:String(item?.title||item?.name||"Video tanpa judul").slice(0,220),url:String(item?.url||item?.webpage_url||item?.link||""),thumbnail:String(item?.thumbnail||item?.thumbnail_url||""),channel:String(item?.author||item?.channel||item?.uploader||""),duration:Number(item?.duration)||null,platform:"youtube",searchProvider:"YouTube public search"})).filter(item=>item.title&&isYouTubeUrl(item.url));
    }catch{return []}
  }));
  const seen=new Set(),results=[];
  for(const list of responses)for(const item of list)if(!seen.has(item.url)){seen.add(item.url);results.push(item)}
  return results;
}
async function freeYouTubeSearch(query,queryVariants=null){
  const results=await freeYouTubeSearchItems(query,queryVariants);
  if(!results.length)return json({error:"Sumber pencarian publik YouTube sedang tidak mengembalikan hasil. Coba lagi sebentar."},502);
  return json({ok:true,query,results:results.slice(0,20).map(item=>({...item,platform:"youtube",mediaMode:"video",verified:false,downloadable:false,searchOnly:true,searchProvider:item.searchProvider||"YouTube public search"})),provider:"Public API · pencarian kata kunci terkait",searchOnlyCount:results.length});
}
async function searchYouTube(request,env){
  let body;try{body=await request.json()}catch{return json({error:"Body JSON tidak valid."},400)}
  const query=String(body?.query||"").replace(/\s+/g," ").trim();
  if(query.length<2)return json({error:"Masukkan minimal 2 karakter untuk mencari judul video."},400);
  if(query.length>160)return json({error:"Judul pencarian maksimal 160 karakter."},400);
  const publicFallback=async()=>{
    const variants=socialSearchQueryVariants(query).slice(0,5);
    const hybridLists=await Promise.all(variants.map(term=>hybridYouTubeSearch(term)));
    const seen=new Set(),hybridResults=[];
    for(const result of hybridLists)for(const item of result?.results||[])if(!seen.has(item.url)){seen.add(item.url);hybridResults.push(item)}
    if(hybridResults.length)return json({ok:true,query,results:hybridResults.slice(0,20).map(item=>({...item,platform:"youtube",mediaMode:"video",verified:item.verified===true&&item.downloadable===true,downloadable:item.downloadable===true,searchOnly:!(item.verified===true&&item.downloadable===true),searchProvider:item.searchProvider||item.provider||"YouTube public search"})),provider:"YouTube official search + public instances",fallbackUsed:true,searchOnlyCount:hybridResults.filter(item=>item.verified!==true||item.downloadable!==true).length});
    return freeYouTubeSearch(query,variants);
  };
  if(!env.PLATFORM_API_ORIGIN||!env.PLATFORM_API_TOKEN){
    if(socialRateLimited(request))return json({error:"Batas pencarian gratis tercapai. Tunggu satu menit lalu coba lagi."},429);
    return publicFallback();
  }
  let origin;
  try{
    const parsed=new URL(env.PLATFORM_API_ORIGIN);
    if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new Error("origin tidak aman");
    origin=parsed.origin;
  }catch{return publicFallback()}
  try{
    const response=await fetch(origin+"/api/search",{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},
      body:JSON.stringify({query}),
      signal:AbortSignal.timeout(18000),
      cache:"no-store"
    });
    const data=await response.json().catch(()=>({}));
    if(response.ok){
      const results=Array.isArray(data.results)?data.results.filter(item=>item&&typeof item.title==="string"&&isYouTubeUrl(item.url)).slice(0,20).map(item=>({...item,platform:"youtube",mediaMode:"video",verified:item.verified===true&&item.downloadable===true,downloadable:item.downloadable===true,searchOnly:!(item.verified===true&&item.downloadable===true),searchProvider:item.searchProvider||"ARYANZZ extraction backend"})):[];
      if(results.length)return json({ok:true,query,results,provider:"ARYANZZ extraction backend",searchOnlyCount:results.filter(item=>item.searchOnly).length});
    }
  }catch{}
  // A configured backend can still be offline, rate-limited, or return an empty result.
  // Do not leave title search at a dead end: try public Piped/Invidious and free API routes.
  return publicFallback();
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



const SFL_BYPASS_HOSTS=new Set(["sf1.gl","sfl.gl","sflink.io"]);
function safeBypassUrl(raw){
  let u;try{u=new URL(raw)}catch{return null}
  const h=u.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  if(u.protocol!=="https:"||u.username||u.password||u.port)return null;
  if(h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h==="::"||h==="::1"||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||/^fc[0-9a-f]{2}:/i.test(h)||/^fd[0-9a-f]{2}:/i.test(h)||/^fe80:/i.test(h))return null;
  return u;
}
async function bypassSflLink(request){
  const raw=new URL(request.url).searchParams.get("url")||"";
  let current=safeBypassUrl(raw);
  if(!current||!SFL_BYPASS_HOSTS.has(current.hostname.toLowerCase()))return json({ok:false,error:"Masukkan tautan SFL yang didukung (sf1.gl atau sfl.gl)."},400);
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  const now=Date.now();let bucket=SFL_BYPASS_BUCKETS.get(ip);
  if(!bucket||now-bucket.started>60000)bucket={started:now,count:0};
  bucket.count++;SFL_BYPASS_BUCKETS.set(ip,bucket);
  if(bucket.count>12)return json({ok:false,error:"Batas pemeriksaan sementara tercapai. Coba lagi sebentar."},429);
  let lastStatus=0;
  try{
    for(let hop=0;hop<7;hop++){
      const response=await fetch(current.toString(),{method:"GET",redirect:"manual",cache:"no-store",headers:{accept:"text/html,application/xhtml+xml,*/*;q=0.8","user-agent":"Mozilla/5.0 (compatible; ARYANZZ Link Resolver/1.0)"} ,signal:AbortSignal.timeout(9000)});
      lastStatus=response.status;
      if([301,302,303,307,308,300].includes(response.status)){
        const location=response.headers.get("location");
        if(!location)return json({ok:false,error:"SFL memberi pengalihan tanpa alamat tujuan."},502);
        const next=safeBypassUrl(new URL(location,current).toString());
        if(!next)return json({ok:false,error:"Alamat tujuan tidak aman atau tidak didukung."},400);
        current=next;continue;
      }
      const type=response.headers.get("content-type")||"";
      if(type.includes("text/html")){
        const body=(await response.text()).slice(0,750000);
        const candidates=[
          body.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"']+)/i)?.[1],
          body.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)?.[1],
          body.match(/(?:window\.)?location\.replace\(\s*["']([^"']+)["']\s*\)/i)?.[1],
          body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
        ].filter(Boolean);
        for(const candidate of candidates){
          const next=safeBypassUrl(new URL(candidate.replace(/&amp;/g,"&"),current).toString());
          if(next&&next.href!==current.href){current=next;break;}
        }
        if(current.hostname.toLowerCase()===new URL(raw).hostname.toLowerCase())return json({ok:false,error:"Tujuan belum dapat ditemukan otomatis. Halaman ini mungkin memerlukan JavaScript, CAPTCHA, atau verifikasi."},422);
        continue;
      }
      return json({ok:true,url:current.href,host:current.hostname,status:lastStatus,hops:hop+1});
    }
    return json({ok:false,error:"Tautan memiliki terlalu banyak pengalihan."},422);
  }catch(error){return json({ok:false,error:"Gagal memeriksa tautan: "+String(error.message||"jaringan tidak tersedia")},502);}
}
const SFL_BYPASS_BUCKETS=new Map();


const workerHandler = {async fetch(request,env){
  const url=new URL(request.url);
  const publicOrigin=getPublicOrigin(env);
  const moderationResponse=await moderationGate(request,env);
  if(moderationResponse)return moderationResponse;
  // Serve crawler files explicitly so Google receives deterministic XML/plain-text MIME types.
  if(url.pathname==="/sitemap.xml"&&request.method==="GET"){
    const lastmod=new Date().toISOString().slice(0,10);
    const sitemapPaths=["/","/panduan","/download-video","/download-mp3","/download-gambar"];
    const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemapPaths.map(path=>'  <url>\n    <loc>'+publicOrigin+path+'</loc>\n    <lastmod>'+lastmod+'</lastmod>\n  </url>').join('\n')+'\n</urlset>\n';
    return new Response(xml,{status:200,headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
  }
  if(url.pathname==="/sitemap.txt"&&request.method==="GET"){
    const sitemapPaths=["/","/panduan","/download-video","/download-mp3","/download-gambar"];
    const sitemap=sitemapPaths.map(path=>publicOrigin+path).join("\n")+"\n";
    return new Response(sitemap,{status:200,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
  }
  if(url.pathname==="/robots.txt"&&request.method==="GET"){
    const robots="User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: "+publicOrigin+"/sitemap.xml\n";
    return new Response(robots,{status:200,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
  }
  if(request.method==="OPTIONS"&&url.pathname.startsWith("/api/"))return new Response(null,{status:204,headers:{"access-control-allow-origin":url.origin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type"}});
  if(url.pathname==="/api/speedtest/ping"&&request.method==="GET")return new Response(null,{status:204,headers:{"cache-control":"no-store","timing-allow-origin":"*"}});
  if(url.pathname==="/api/speedtest/download"&&request.method==="GET"){
    const requested=Number(url.searchParams.get("bytes")||524288);
    const bytes=Math.max(65536,Math.min(4194304,Number.isFinite(requested)?Math.floor(requested):524288));
    const body=new Uint8Array(bytes);
    for(let i=0;i<bytes;i++)body[i]=(i*31+17)&255;
    return new Response(body,{status:200,headers:{"content-type":"application/octet-stream","content-length":String(bytes),"cache-control":"no-store, no-cache, must-revalidate","pragma":"no-cache","timing-allow-origin":"*","x-content-type-options":"nosniff"}});
  }
  if(url.pathname==="/api/speedtest/upload"&&request.method==="POST"){
    const declared=Number(request.headers.get("content-length")||0);
    if(declared>2097152)return json({ok:false,error:"Ukuran tes upload terlalu besar."},413);
    const body=await request.arrayBuffer();
    if(body.byteLength>2097152)return json({ok:false,error:"Ukuran tes upload terlalu besar."},413);
    return json({ok:true,received:body.byteLength});
  }
  if(url.pathname==="/api/link-bypass"&&request.method==="GET")return bypassSflLink(request);
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
    if(url.pathname==="/api/security/status"&&request.method==="GET")return json({ok:true,security:{active:true,mode:"worker-edge-defense",controls:["origin-validation","method-allowlist","content-type-validation","request-size-guard","per-ip-endpoint-rate-limits","content-security-policy","strict-transport-security","frame-protection","mime-sniffing-protection","request-id","sanitized-error-handling"],events:{blockedOrigin:SECURITY_EVENTS.blockedOrigin,rateLimited:SECURITY_EVENTS.rateLimited,oversizedRequest:SECURITY_EVENTS.oversizedRequest,blockedMethod:SECURITY_EVENTS.blockedMethod},note:"Event counters are per Worker isolate and are not a global security incident log."}});
  if(url.pathname.startsWith("/api/membership/")||url.pathname.startsWith("/api/cosmetics/")||url.pathname.startsWith("/api/redeem/"))return json({ok:false,error:"Fitur ini sudah tidak tersedia."},410);
  if(url.pathname.startsWith("/api/auth/"))return handleAuthRequest(request,env);
  if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"ARYANZZ",version:"V1",publicVersion:"V1",buildId:env.ARYANZZ_BUILD_VERSION||BUILD_VERSION,securityActive:true,mode:"cloudflare-worker-zero-server-hybrid",directMediaDownload:true,selfHostedDownloader:false,youtubeDownloader:true,youtubeApiKeyConfigured:false,cobalt:false,paidYoutubeProvider:false,musicRecognitionConfigured:!!env.AUDD_API_TOKEN,musicFallbackReady:false,musicVideoRecognitionReady:false,platformExtraction:true,platformBackend:"public-free-community-api"});
  if(url.pathname==="/api/social-file"&&request.method==="GET")return socialMediaFile(request);
  if(url.pathname==="/api/platform/info"&&request.method==="POST")return platformMediaInfo(request);
  if(url.pathname==="/api/info"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/info");if(proxied)return proxied;return info(request);}
  if(url.pathname==="/api/direct-file"&&request.method==="GET")return download(request);
  if(url.pathname==="/api/download"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/download");if(proxied)return proxied;return download(request);}
  if(url.pathname.startsWith("/api/"))return json({error:"Endpoint tidak ditemukan."},404);

  const assetResponse=await env.ASSETS.fetch(request);
  const canonicalHtmlPaths=new Set(["/","/index.html","/panduan","/download-video","/download-mp3","/download-gambar"]);
  if(request.method==="GET"&&canonicalHtmlPaths.has(url.pathname)&&assetResponse.ok&&(assetResponse.headers.get("content-type")||"").toLowerCase().includes("text/html")){
    const html=(await assetResponse.text()).replaceAll(DEFAULT_PUBLIC_ORIGIN,publicOrigin);
    const headers=new Headers(assetResponse.headers);
    headers.set("cache-control","no-store, no-cache, must-revalidate, max-age=0");
    headers.set("pragma","no-cache");
    headers.set("expires","0");
    return new Response(html,{status:assetResponse.status,statusText:assetResponse.statusText,headers});
  }
  if(request.method==="GET"&&["/","/index.html","/sw.js","/release.json","/manifest.webmanifest","/robots.txt","/sitemap.xml"].includes(url.pathname)){
    const headers=new Headers(assetResponse.headers);
    headers.set("cache-control","no-store, no-cache, must-revalidate, max-age=0");
    headers.set("pragma","no-cache");
    headers.set("expires","0");
    return new Response(assetResponse.body,{status:assetResponse.status,statusText:assetResponse.statusText,headers});
  }
  return assetResponse;
}};

const SECURITY_BUCKETS=new Map();
const SECURITY_EVENTS={blockedOrigin:0,rateLimited:0,oversizedRequest:0,blockedMethod:0};
const SECURITY_LIMITS=[
  {match:/^\/api\/(?:social\/search|social\/image-search|image\/search|search)$/,limit:30},
  {match:/^\/api\/(?:social-file|image\/file|social-image-file|direct-file)$/,limit:90},
  {match:/^\/api\//,limit:90}
];
function securityClientKey(request){
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  return ip.length<=80?ip:"unknown";
}
function securityRateLimit(request,url){
  const now=Date.now(),path=url.pathname,rule=SECURITY_LIMITS.find(item=>item.match.test(path));
  if(!rule)return false;
  const key=securityClientKey(request)+"|"+path;
  let bucket=SECURITY_BUCKETS.get(key);
  if(!bucket||now-bucket.started>=60000)bucket={started:now,count:0};
  bucket.count++;SECURITY_BUCKETS.set(key,bucket);
  if(SECURITY_BUCKETS.size>5000){
    for(const [entry,value] of SECURITY_BUCKETS)if(now-value.started>=120000)SECURITY_BUCKETS.delete(entry);
  }
  return bucket.count>rule.limit;
}
function securityHeaders(response,requestId){
  const headers=new Headers(response.headers);
  headers.set("x-content-type-options","nosniff");
  headers.set("x-frame-options","DENY");
  headers.set("referrer-policy","strict-origin-when-cross-origin");
  headers.set("permissions-policy","camera=(self), microphone=(self), geolocation=()");
  headers.set("strict-transport-security","max-age=15552000; includeSubDomains");
  headers.set("cross-origin-opener-policy","same-origin");
  headers.set("content-security-policy","default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https: wss: blob:; worker-src 'self' blob:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self' https:; frame-ancestors 'none'; upgrade-insecure-requests");
  headers.set("x-robots-tag",headers.get("x-robots-tag")||"index, follow");
  headers.set("x-request-id",requestId);
  headers.delete("server");
  headers.delete("x-powered-by");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function securityError(message,status,requestId){
  return securityHeaders(json({ok:false,error:message,requestId},status),requestId);
}
async function securityFetch(request,env){
  const url=new URL(request.url);
  const requestId=crypto.randomUUID();
  if(!["GET","HEAD","POST","OPTIONS"].includes(request.method)){
    SECURITY_EVENTS.blockedMethod++;
    return securityError("Metode permintaan tidak diizinkan.",405,requestId);
  }
  if(url.pathname.startsWith("/api/")){
    if(url.search.length>8192)return securityError("Parameter permintaan terlalu panjang.",414,requestId);
    const origin=request.headers.get("origin");
    if(origin){
      let parsedOrigin;
      try{parsedOrigin=new URL(origin)}catch{SECURITY_EVENTS.blockedOrigin++;return securityError("Origin permintaan tidak valid.",403,requestId)}
      if(parsedOrigin.origin!==url.origin){
        SECURITY_EVENTS.blockedOrigin++;
        return securityError("Permintaan lintas situs diblokir oleh perlindungan ARYANZZ.",403,requestId);
      }
    }
    if(request.method==="OPTIONS"){
      const headers=new Headers({
        "access-control-allow-origin":url.origin,
        "access-control-allow-methods":"GET,POST,OPTIONS",
        "access-control-allow-headers":"Content-Type",
        "access-control-max-age":"600",
        "vary":"Origin"
      });
      return securityHeaders(new Response(null,{status:204,headers}),requestId);
    }
    if(request.method==="POST"){
      const contentType=(request.headers.get("content-type")||"").toLowerCase();
      if(contentType&&!(/^(application\/json|application\/octet-stream|multipart\/form-data)(?:;|$)/.test(contentType))){
        return securityError("Jenis konten permintaan tidak diizinkan.",415,requestId);
      }
      const length=Number(request.headers.get("content-length")||0);
      const maxBytes=contentType.startsWith("application/json")?2*1024*1024:105*1024*1024;
      if(Number.isFinite(length)&&length>maxBytes){
        SECURITY_EVENTS.oversizedRequest++;
        return securityError("Ukuran permintaan melebihi batas keamanan.",413,requestId);
      }
    }
    if(securityRateLimit(request,url)){
      SECURITY_EVENTS.rateLimited++;
      return securityError("Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.",429,requestId);
    }
  }
  try{
    const response=await workerHandler.fetch(request,env);
    return securityHeaders(response,requestId);
  }catch(error){
    console.error("[ARYANZZ_SECURITY] worker_exception",requestId,error instanceof Error?error.name:"unknown");
    return securityError("Layanan sementara tidak tersedia. Coba lagi nanti.",500,requestId);
  }
}
export { MembershipStore };
export default {fetch:securityFetch};

