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
  if(!env.PLATFORM_API_ORIGIN)return json({error:"Backend ekstraksi platform belum dihubungkan. Tautan file media langsung tetap bisa diunduh."},503);
  if(!env.PLATFORM_API_TOKEN)return json({error:"Token backend belum dikonfigurasi pada Cloudflare Worker."},503);
  let origin;try{const parsed=new URL(env.PLATFORM_API_ORIGIN);if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new Error("origin tidak aman");origin=parsed.origin}catch{return json({error:"Konfigurasi backend harus berupa URL HTTPS yang valid."},500)}
  try{
    const response=await fetch(origin+path,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
    return new Response(response.body,{status:response.status,headers:{"content-type":response.headers.get("content-type")||"application/json","content-disposition":response.headers.get("content-disposition")||"","cache-control":"no-store"}});
  }catch{return json({error:"Backend ekstraksi sedang tidak dapat dijangkau."},502)}
}
async function platformStatus(env){
  const configured=!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN);
  if(!configured)return json({ok:false,configured:false,engine:"yt-dlp + FFmpeg",platforms:PLATFORM_HOSTS,message:"Server ekstraksi belum dihubungkan."});
  let origin;
  try{const parsed=new URL(env.PLATFORM_API_ORIGIN);if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new Error("origin tidak aman");origin=parsed.origin}
  catch{return json({ok:false,configured:true,error:"URL backend harus HTTPS."},500)}
  try{
    const response=await fetch(origin+"/api/health",{headers:{accept:"application/json","authorization":"Bearer "+env.PLATFORM_API_TOKEN},signal:AbortSignal.timeout(8000),cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    return json({ok:response.ok&&data.ok===true,configured:true,engine:data.engine||"yt-dlp + FFmpeg",version:data.version||null,platforms:data.platforms||PLATFORM_HOSTS});
  }catch{return json({ok:false,configured:true,error:"Server ekstraksi belum merespons.",engine:"yt-dlp + FFmpeg",platforms:PLATFORM_HOSTS},502)}
}
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
const AUDD_MAX_BYTES=10*1024*1024;
const MUSIC_RATE_BUCKETS=new Map();

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
  const origin=new URL(env.PLATFORM_API_ORIGIN).origin;
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
  let origin;try{origin=new URL(env.PLATFORM_API_ORIGIN).origin;}catch{return json({error:"URL backend tidak valid."},500);}
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
  if(url.pathname==="/api/youtube/status"&&request.method==="GET")return json({ok:true,service:"ARYANZZ YouTube Backend",youtubeDownloader:true,youtubeApiKeyConfigured:!!env.SAVENOW_API_KEY,supportedAudio:[...YOUTUBE_AUDIO_FORMATS],supportedVideo:["360","720","1080","1440","4k"]});
  if(url.pathname==="/api/youtube/info"&&request.method==="GET")return youtubeInfo(request,env);
  if(url.pathname==="/api/youtube/download"&&request.method==="POST")return youtubeStart(request,env);
  if(url.pathname==="/api/youtube/progress"&&request.method==="POST")return youtubeProgress(request,env);
  if(url.pathname==="/api/youtube/file"&&request.method==="GET")return youtubeFile(request,env);
  if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"ARYANZZ",version:"68.0",mode:"cloudflare-worker+external-yt-dlp",directMediaDownload:true,selfHostedDownloader:!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN)||!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN),youtubeDownloader:true,youtubeApiKeyConfigured:!!env.SAVENOW_API_KEY,musicRecognitionConfigured:!!env.AUDD_API_TOKEN,musicFallbackReady:!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN),musicVideoRecognitionReady:!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN)||!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN),platformExtraction:!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN)||!!(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN),platformBackend:(env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN)?"cloudflare-container":env.PLATFORM_API_ORIGIN&&env.PLATFORM_API_TOKEN?"external":"not-configured"});
  if(url.pathname==="/api/info"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/info");if(proxied)return proxied;return info(request);}
  if(url.pathname==="/api/download"&&request.method==="POST"){const proxied=await proxyPlatform(request,env,"/api/download");if(proxied)return proxied;return download(request);}
  if(url.pathname.startsWith("/api/"))return json({error:"Endpoint tidak ditemukan."},404);
  return env.ASSETS.fetch(request);
}};
