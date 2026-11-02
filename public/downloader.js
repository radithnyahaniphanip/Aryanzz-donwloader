/* ARYANZZ V69.0 — zero-server direct downloader and community handoff */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const FORMATS = {
    audio: [["mp3","MP3 Audio"],["m4a","M4A Audio"]],
    video: [[144,"144p"],[240,"240p"],[360,"360p"],[480,"480p"],[720,"720p HD"],[1080,"1080p Full HD"],[1440,"1440p · 2K"],[2160,"2160p · 4K"]]
  };
  const PLATFORM_NAMES = [
    ["youtube.com","YouTube"],["youtu.be","YouTube"],["tiktok.com","TikTok"],
    ["instagram.com","Instagram"],["facebook.com","Facebook"],["fb.watch","Facebook"],
    ["pinterest.com","Pinterest"],["pin.it","Pinterest"],["x.com","X"],["twitter.com","X"],
    ["reddit.com","Reddit"],["redd.it","Reddit"],["v.redd.it","Reddit"],
    ["vimeo.com","Vimeo"],["dailymotion.com","Dailymotion"],["soundcloud.com","SoundCloud"],
    ["twitch.tv","Twitch"],["streamable.com","Streamable"],["tumblr.com","Tumblr"],
    ["bilibili.com","Bilibili"],["b23.tv","Bilibili"],["vk.com","VK"],["ok.ru","OK.ru"],
    ["rutube.ru","Rutube"],["likee.video","Likee"],["snapchat.com","Snapchat"],
    ["imgur.com","Imgur"],["bandcamp.com","Bandcamp"],["mixcloud.com","Mixcloud"],
    ["ted.com","TED"],["archive.org","Internet Archive"]
  ];
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function safeUrl(raw) {
    try {
      const url = new URL(raw);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
      return url;
    } catch { return null; }
  }
  function platformName(url) {
    const host = url.hostname.toLowerCase();
    const item = PLATFORM_NAMES.find(([domain]) => host === domain || host.endsWith("." + domain));
    return item ? item[1] : "Direct Media URL";
  }
  function status(el, text, error) {
    el.textContent = text;
    el.className = error ? "warning" : "muted";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
  }
  function duration(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    const s = Math.floor(n), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? [h, String(m).padStart(2,"0"), String(sec).padStart(2,"0")].join(":") : [m, String(sec).padStart(2,"0")].join(":");
  }
  function remember(url, name, mode, quality) {
    try {
      const key = "aryanzz.history.v2";
      const old = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([{url,name,mode,quality,at:Date.now()}, ...old.filter(x => x.url !== url)].slice(0,40)));
    } catch {}
  }
  function favorite(url, name, button) {
    try {
      const key = "aryanzz.favorites.v2";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const exists = list.some(x => x.url === url);
      const next = exists ? list.filter(x => x.url !== url) : [{url,name,at:Date.now()}, ...list].slice(0,40);
      localStorage.setItem(key, JSON.stringify(next));
      button.textContent = exists ? "♡ Favorit" : "♥ Tersimpan";
    } catch { button.textContent = "Favorit tidak tersimpan"; }
  }
  async function postJson(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: {"Content-Type":"application/json","Accept":"application/json"},
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Server downloader tidak dapat memproses tautan.");
    return data;
  }
  function safeFilename(value,fallback){
    const clean=String(value||fallback||"aryanzz-media.bin").replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().slice(0,140);
    return clean||fallback||"aryanzz-media.bin";
  }
  function responseFilename(header){
    if(!header)return "";
    const star=/filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
    if(star){try{return decodeURIComponent(star[1].trim().replace(/^"|"$/g,""))}catch{}}
    const plain=/filename="?([^";]+)"?/i.exec(header);
    return plain?plain[1].trim():"";
  }
  function youtubeFormat(mode,quality,audioFormat="mp3"){
    if(mode==="audio")return audioFormat==="m4a"?"m4a":"mp3";
    const q=Number(quality)||720;
    return q>=2160?"4k":String([360,480,720,1080,1440].includes(q)?q:720);
  }
  function browserMediaContentType(response,mode){
    const type=String(response.headers.get("content-type")||"").toLowerCase();
    if(type.includes("text/html")||type.includes("application/json")||type.includes("text/plain"))throw new Error("Provider mengirim halaman error, bukan file media.");
    if(mode==="video"&&type&&!type.includes("video/")&&!type.includes("application/octet-stream"))throw new Error("Tipe file yang diterima bukan video.");
    if(mode==="audio"&&type&&!type.includes("audio/")&&!type.includes("application/octet-stream"))throw new Error("Tipe file yang diterima bukan audio.");
  }
  async function saveBrowserBlob(blob,filename){
    if(!blob||!blob.size)throw new Error("File kosong.");
    const objectUrl=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=objectUrl;a.download=filename;a.style.display="none";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),120000);
  }
  async function downloadYouTube(url,mode,quality,bar,progressText,info={},audioFormat="m4a"){
    if(info.providerName!=="Hybrid"||!info.providerReady)throw new Error("Tidak ada stream gratis yang tersedia dari instance komunitas saat ini.");
    const candidates=(Array.isArray(info.formats)?info.formats:[]).filter(item=>item.mode===mode&&item.url);
    let selected=null;
    if(mode==="audio")selected=candidates.find(item=>item.ext===audioFormat)||candidates[0];
    else{
      const wanted=Number(quality)||720;
      selected=candidates.find(item=>Number(item.height)===wanted)||candidates.filter(item=>Number(item.height)<=wanted).sort((x,y)=>Number(y.height)-Number(x.height))[0]||candidates.sort((x,y)=>Number(y.height)-Number(x.height))[0];
    }
    if(!selected)throw new Error("Kualitas/format yang dipilih tidak tersedia dari sumber komunitas.");
    const filename=safeFilename((info.title||"aryanzz-youtube")+"."+selected.ext);
    progressText.textContent="Mengambil stream langsung dari browser…";
    const direct=browserHybridMediaUrl(selected.url,info.instance);
    if(!direct)throw new Error("Alamat stream tidak lolos pemeriksaan keamanan.");
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),120000);
      let response;
      try{response=await fetch(direct.href,{mode:"cors",credentials:"omit",cache:"no-store",signal:controller.signal});}
      finally{clearTimeout(timer);}
      if(!response.ok)throw new Error("HTTP "+response.status);
      browserMediaContentType(response,mode);
      const total=Number(response.headers.get("content-length")||0),maxBytes=250*1024*1024;
      if(total>maxBytes)throw new Error("File lebih dari 250 MB; pilih kualitas lebih rendah.");
      const reader=response.body?.getReader();
      if(!reader)throw new Error("Browser tidak menyediakan stream pembacaan file.");
      const chunks=[];let received=0;
      while(true){
        const part=await reader.read();if(part.done)break;
        received+=part.value.byteLength;
        if(received>maxBytes){await reader.cancel();throw new Error("File melebihi batas 250 MB untuk unduhan langsung di browser.");}
        chunks.push(part.value);
        if(total){const pct=Math.min(99,Math.round(received/total*100));bar.style.width=pct+"%";progressText.textContent="Mengunduh "+pct+"% · "+(received/1048576).toFixed(1)+" MB";}
        else progressText.textContent="Mengunduh · "+(received/1048576).toFixed(1)+" MB";
      }
      if(!received)throw new Error("Stream kosong.");
      const blob=new Blob(chunks,{type:selected.mimeType||response.headers.get("content-type")||"application/octet-stream"});
      await saveBrowserBlob(blob,filename);
      bar.style.width="100%";progressText.textContent="File siap disimpan oleh Chrome · "+(received/1048576).toFixed(1)+" MB";
      remember(url,filename,mode,quality);
      return filename;
    }catch(browserError){
      try{
        const target="/api/youtube/hybrid/file?url="+encodeURIComponent(direct.href)+"&ext="+encodeURIComponent(selected.ext)+"&title="+encodeURIComponent(info.title||"aryanzz-youtube")+"&instance="+encodeURIComponent(info.instance||"");
        const fallback=await fetch(target,{cache:"no-store",signal:AbortSignal.timeout(120000)});
        if(!fallback.ok){const detail=await fallback.json().catch(()=>({}));throw new Error(detail.error||("Worker HTTP "+fallback.status));}
        browserMediaContentType(fallback,mode);
        const blob=await fallback.blob();
        if(blob.size>250*1024*1024)throw new Error("File melebihi batas 250 MB untuk penyimpanan browser.");
        await saveBrowserBlob(blob,filename);
        bar.style.width="100%";progressText.textContent="File diterima melalui jalur Worker · "+(blob.size/1048576).toFixed(1)+" MB";
        remember(url,filename,mode,quality);
        return filename;
      }catch(proxyError){
        throw new Error("Unduhan browser gagal: "+String(browserError.message||"CORS")+". Jalur Worker juga gagal: "+String(proxyError.message||"network error")+". Coba instance lain atau ulangi nanti.");
      }
    }
  }
  async function downloadFile(url, mode, quality, bar, progressText, info={}) {
    const sourceExt=/^[a-z0-9]{2,8}$/i.test(info.extension||"")?info.extension.toLowerCase():"";
    const ext=sourceExt||(mode==="audio"?"mp3":"mp4");
    const filename=safeFilename(info.filename||info.title||("aryanzz-"+(mode==="audio"?"audio":"video-"+quality+"p")+"."+ext));
    const fileUrl="/api/direct-file?url="+encodeURIComponent(url);
    const anchor=document.createElement("a");
    anchor.href=fileUrl;anchor.download=filename;anchor.rel="noopener";anchor.style.display="none";
    document.body.append(anchor);anchor.click();anchor.remove();
    bar.style.width="100%";
    progressText.textContent="Unduhan diserahkan ke Chrome · "+filename;
    remember(url,filename,mode,quality);
    return filename;
  }
  function showError(out, error, url) {
    out.hidden = false;
    out.replaceChildren();
    const message=error.message||"Terjadi kesalahan saat memeriksa tautan.";
    const title = make("b", "", "Link belum dapat diproses");
    const note = make("p", "warning", message);
    out.append(title, note);
    let guidance="";
    if(/quota|not enough balance|insufficient balance|saldo/i.test(message))guidance="Batas penggunaan berasal dari penyedia layanan. Periksa paket atau saldo provider; ARYANZZ tidak dapat menambah kuota provider.";
    else if(/backend|platform_api|cloudflare container|yt-dlp|belum dihubungkan|tidak dapat dijangkau|pencarian judul membutuhkan/i.test(message))guidance="Tautan platform dan pencarian judul memerlukan backend yt-dlp yang aktif. Gunakan Cloudflare Container atau backend HTTPS yang sudah dikonfigurasi. Tautan file media langsung tetap dapat diproses tanpa ekstraksi platform.";
    else if(/429|batas pencarian|rate limit/i.test(message))guidance="Terlalu banyak permintaan dalam waktu singkat. Tunggu sebentar sebelum mencoba lagi.";
    else if(/format|kualitas|file melebihi/i.test(message))guidance="Periksa format sumber dan batas ukuran file. Tidak semua platform menyediakan semua kualitas.";
    if(guidance)out.append(make("p","muted",guidance));
    if (url) {
      const link = make("a", "tag", "Buka sumber ↗");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.display = "inline-block";
      out.append(link);
    }
  }
  function showCommunityFallback(out,error,url){
    out.hidden=false;out.replaceChildren();
    const box=make("section","youtube-result v690-fallback");
    box.append(make("span","v690-kicker","SERVERLESS DOWNLOAD · COMMUNITY ROUTE"));
    box.append(make("b","v690-title","Link media sosial terdeteksi"));
    box.append(make("p","muted","ARYANZZ berjalan tanpa server ekstraksi sendiri. Tautan file media langsung bisa diproses di sini; tautan dari platform sosial perlu dibuka melalui instance downloader komunitas yang sedang tersedia."));
    const actions=make("div","v690-actions");
    const directory=make("a","primary","Cari downloader komunitas ↗");
    directory.href="https://cobalt.directory/";directory.target="_blank";directory.rel="noopener noreferrer";
    const source=make("a","tag","Buka tautan sumber ↗");
    source.href=url.href;source.target="_blank";source.rel="noopener noreferrer";
    const copy=make("button","tag","Salin link");copy.type="button";
    copy.addEventListener("click",async()=>{
      try{
        if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(url.href);
        else{const area=make("textarea");area.value=url.href;area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();if(!document.execCommand("copy"))throw new Error("copy");area.remove();}
        copy.textContent="Link tersalin ✓";
      }catch{copy.textContent="Salin manual dari kolom URL";}
    });
    actions.append(directory,source,copy);box.append(actions);
    const steps=make("ol","v690-steps");
    ["Buka direktori instance Cobalt dan pilih frontend yang aktif serta mendukung platform sumber.","Tempel URL yang sama pada halaman downloader komunitas tersebut.","Unduh file dari halaman provider. ARYANZZ tidak menerima atau menyimpan media itu."].forEach(t=>steps.append(make("li","",t)));
    box.append(steps);
    box.append(make("p","v690-note","Ketersediaan instance, batas pemakaian, dan kebijakan privasi ditentukan pemiliknya. Jangan masukkan kata sandi atau tautan privat. Jika instance tidak tersedia, coba instance lain di direktori."));
    if(error?.message)box.append(make("p","v690-debug","Info: "+(platformName(url)==="Direct Media URL"?error.message:"Postingan sosial memerlukan extractor; URL file MP4/MP3 langsung tetap didukung.")));
    out.append(box);
  }
  const BROWSER_PIPED_INSTANCES=[
    "https://pipedapi.kavin.rocks","https://pipedapi.leptons.xyz","https://pipedapi.nosebs.ru",
    "https://pipedapi-libre.kavin.rocks","https://piped-api.privacy.com.de","https://pipedapi.adminforge.de",
    "https://api.piped.yt","https://pipedapi.drgns.space","https://pipedapi.owo.si",
    "https://pipedapi.ducks.party","https://piped-api.codespace.cz","https://pipedapi.reallyaweso.me",
    "https://api.piped.private.coffee","https://pipedapi.darkness.services","https://pipedapi.orangenet.cc"
  ];
  async function currentPipedInstances(){
    const fallback=BROWSER_PIPED_INSTANCES.slice();
    try{
      const response=await fetch("https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md",{mode:"cors",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(2500)});
      if(!response.ok)return fallback;
      const markdown=await response.text();
      const found=[...markdown.matchAll(/https:\/\/(?:pipedapi(?:-libre)?|piped-api|api\.piped)\.[a-z0-9.-]+/gi)].map(m=>m[0].replace(/\/$/,""));
      const safe=found.filter(origin=>{try{const u=new URL(origin);return u.protocol==="https:"&&/^(?:pipedapi(?:-libre)?|piped-api|api\.piped)\.[a-z0-9.-]+$/i.test(u.hostname);}catch{return false;}});
      return [...new Set([...safe,...fallback])].slice(0,24);
    }catch{return fallback;}
  }
  const BROWSER_INVIDIOUS_INSTANCES=[
    "https://inv.nadeko.net","https://invidious.nerdvpn.de","https://yt.chocolatemoo53.com","https://invidious.tiekoetter.com"
  ];
  const BROWSER_MEDIA_ROOTS=["kavin.rocks","leptons.xyz","nosebs.ru","privacy.com.de","adminforge.de","piped.yt","drgns.space","owo.si","ducks.party","codespace.cz","reallyaweso.me","private.coffee","darkness.services","orangenet.cc"];
  function browserHybridMediaUrl(raw,trustedOrigin){
    try{
      const u=new URL(raw,trustedOrigin||undefined);
      if(u.protocol!=="https:"||u.username||u.password)return null;
      const h=u.hostname.toLowerCase();
      if(h==="googlevideo.com"||h.endsWith(".googlevideo.com"))return u;
      if(BROWSER_MEDIA_ROOTS.some(root=>h===root||h.endsWith("."+root)))return u;
      if(trustedOrigin&&u.origin===new URL(trustedOrigin).origin)return u;
      return null;
    }catch{return null;}
  }
  function browserVideoHeight(item,url){
    const direct=Number(item?.height);
    if(Number.isFinite(direct)&&direct>=100&&direct<=4320)return direct;
    const labels=[item?.qualityLabel,item?.quality,item?.resolution,item?.size,item?.label].filter(Boolean).map(String);
    for(const label of labels){
      const dimensions=label.match(/\d{2,4}\s*[x×]\s*(\d{2,4})/i);
      if(dimensions)return Number(dimensions[1]);
      const p=label.match(/(?:^|\D)(\d{3,4})\s*p(?:\D|$)/i);
      if(p)return Number(p[1]);
    }
    const itag=Number(url?.searchParams?.get("itag")||item?.itag);
    return ({17:144,18:360,22:720,37:1080,59:480,78:480})[itag]||0;
  }
  function browserVideoFormat(item,providerInstance,progressiveSource=false){
    const mime=String(item?.mimeType||item?.type||item?.mime_type||item?.mime||"").toLowerCase();
    const container=String(item?.format||item?.container||item?.ext||"").toLowerCase();
    const url=browserHybridMediaUrl(item?.url||item?.urlTemplate||"",providerInstance);
    const height=browserVideoHeight(item,url);
    const mp4=mime.includes("video/mp4")||mime.includes("video/x-m4v")||container.includes("mpeg_4")||container==="mp4"||container==="m4v"||(progressiveSource&&/\.mp4(?:$|[?#])/i.test(url?.pathname||""));
    if(!url||![144,240,360,480,720,1080,1440,2160].includes(height)||item?.videoOnly===true||!mp4)return null;
    return {mode:"video",height,quality:height+"p",ext:"mp4",mimeType:"video/mp4",url:url.href,bitrate:Number(item.bitrate)||0,progressive:true};
  }
  function browserAudioFormat(item,providerInstance){
    const mime=String(item?.mimeType||item?.type||item?.mime_type||item?.mime||"").toLowerCase(),container=String(item?.format||item?.container||item?.ext||"").toLowerCase(),url=browserHybridMediaUrl(item?.url||"",providerInstance);
    if(!url||!(mime.startsWith("audio/")||["m4a","mp3","webm","opus","ogg"].includes(container)))return null;
    let ext=container==="mpeg"?"mp3":container==="mp4"?"m4a":container;
    if(!["m4a","mp3","webm","opus","ogg","wav","flac"].includes(ext)){if(mime.includes("audio/mp4"))ext="m4a";else if(mime.includes("audio/mpeg"))ext="mp3";else if(mime.includes("audio/webm"))ext="webm";else return null;}
    return {mode:"audio",height:0,quality:String(item.quality||item.audioQuality||item.bitrate||"Audio"),ext,mimeType:mime.split(";")[0],url:url.href,bitrate:Number(item.bitrate)||0};
  }
  function browserDedupeFormats(formats){
    const seen=new Set();return formats.filter(f=>{const key=f.mode+":"+f.height+":"+f.ext+":"+f.url.split("?")[0];if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.mode===b.mode?(a.mode==="video"?a.height-b.height:b.bitrate-a.bitrate):a.mode==="video"?-1:1).map((f,i)=>({...f,id:"f"+i}));
  }
  async function browserProviderJson(url,signal){
    const response=await fetch(url,{mode:"cors",credentials:"omit",headers:{accept:"application/json"},cache:"no-store",signal});
    if(!response.ok)throw new Error("HTTP "+response.status);
    if(!(response.headers.get("content-type")||"").toLowerCase().includes("json"))throw new Error("Respons bukan JSON");
    return response.json();
  }
  function browserProviderTimeout(ms){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);
    return {signal:controller.signal,clear:()=>clearTimeout(timer),abort:()=>controller.abort()};
  }
  async function browserPipedInfo(instance,id,signal){
    const data=await browserProviderJson(instance+"/streams/"+encodeURIComponent(id),signal);
      const formats=browserDedupeFormats([...(Array.isArray(data.videoStreams)?data.videoStreams.map(item=>browserVideoFormat(item,instance)).filter(Boolean):[]),...(Array.isArray(data.audioStreams)?data.audioStreams.map(item=>browserAudioFormat(item,instance)).filter(Boolean):[])]);
      if(!data.title||!formats.some(item=>item.mode==="video"))throw new Error("Instance Piped tidak menyediakan MP4 progresif; lanjutkan mencari instance video lain");
      return {ok:true,providerReady:true,providerName:"Hybrid",provider:"Piped",instance,title:String(data.title).slice(0,300),thumbnail:typeof data.thumbnailUrl==="string"?data.thumbnailUrl:null,duration:Number(data.duration)||null,uploader:String(data.uploader||"").slice(0,160),formats,message:"Stream diperoleh langsung dari browser melalui instance komunitas."};
  }
  async function browserInvidiousInfo(instance,id,signal){
    const data=await browserProviderJson(instance+"/api/v1/videos/"+encodeURIComponent(id)+"?fields=title,videoId,author,lengthSeconds,videoThumbnails,formatStreams,adaptiveFormats",signal);
      const formats=browserDedupeFormats([...(Array.isArray(data.formatStreams)?data.formatStreams.map(item=>browserVideoFormat(item,instance,true)).filter(Boolean):[]),...(Array.isArray(data.adaptiveFormats)?data.adaptiveFormats.map(item=>browserAudioFormat(item,instance)).filter(Boolean):[])]);
      if(!data.title||!formats.some(item=>item.mode==="video"&&item.ext==="mp4"))throw new Error("Instance Invidious ini hanya mengembalikan audio atau tidak memiliki MP4 progresif; lanjutkan ke instance berikutnya");
      const thumb=Array.isArray(data.videoThumbnails)?data.videoThumbnails.find(x=>x.quality==="maxresdefault")||data.videoThumbnails[0]:null;
      return {ok:true,providerReady:true,providerName:"Hybrid",provider:"Invidious",instance,title:String(data.title).slice(0,300),thumbnail:typeof thumb?.url==="string"?thumb.url:null,duration:Number(data.lengthSeconds)||null,uploader:String(data.author||"").slice(0,160),formats,message:"Stream diperoleh langsung dari browser melalui instance komunitas."};
  }
  async function browserHybridYoutubeInfo(raw){
    const match=(()=>{try{const u=new URL(raw);if(["youtu.be","www.youtu.be"].includes(u.hostname))return u.pathname.split("/").filter(Boolean)[0]||null;return u.searchParams.get("v")||u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,20})/)?.[1]||null;}catch{return null;}})();
    if(!match||! /^[A-Za-z0-9_-]{6,20}$/.test(match))throw new Error("ID video YouTube tidak valid.");
    const tryGroup=async(instances,fn)=>{
      const controllers=instances.map(()=>browserProviderTimeout(4500));
      try{return await Promise.any(instances.map((instance,i)=>fn(instance,match,controllers[i].signal).finally(()=>controllers[i].clear())));}
      catch{throw new Error("Semua instance pada kelompok ini gagal atau tidak mengizinkan akses browser.");}
      finally{controllers.forEach(t=>t.abort());}
    };
    let pipedError;
    const pipedInstances=await currentPipedInstances();
    for(let offset=0;offset<pipedInstances.length;offset+=5){
      try{return await tryGroup(pipedInstances.slice(offset,offset+5),browserPipedInfo);}
      catch(error){pipedError=error;}
    }
    try{return await tryGroup(BROWSER_INVIDIOUS_INSTANCES,browserInvidiousInfo);}
    catch(invidiousError){
        const response=await fetch("/api/youtube/hybrid/info?url="+encodeURIComponent(raw),{cache:"no-store",signal:AbortSignal.timeout(35000)});
        const fallback=await response.json().catch(()=>({}));
        if(response.ok&&fallback.providerReady)return fallback;
        throw new Error("Browser dan server belum menemukan instance komunitas yang berfungsi. Piped: "+(pipedError?.message||"gagal")+" · Invidious: "+invidiousError.message);
    }
  }
  async function checkLink(url, button) {
    const out = $("downloadResult");
    out.hidden = false;
    out.replaceChildren();
    const box = make("section", "youtube-result");
    const heading = make("b", "", "Memeriksa " + platformName(url) + "…");
    const intro = make("p", "muted", "Memeriksa apakah tautan bisa diunduh langsung dari browser ARYANZZ.");
    box.append(heading, intro);
    out.append(box);
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Memeriksa…";
    try {
      if(platformName(url)==="TikTok")throw new Error("TikTok sementara dinonaktifkan. ARYANZZ V70.1 difokuskan pada YouTube dan tautan file langsung.");
      const host=url.hostname.toLowerCase();
      const isYouTube=["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtu.be","www.youtu.be"].includes(host);
      const info=isYouTube
        ? await browserHybridYoutubeInfo(url.href)
        : await postJson("/api/info", {url:url.href});
      box.replaceChildren();
      const header = make("div", "youtube-heading");
      if (info.thumbnail) {
        try {
          const imageUrl = new URL(info.thumbnail);
          if (imageUrl.protocol === "https:" || imageUrl.protocol === "http:") {
            const img = make("img", "youtube-thumbnail");
            img.src = imageUrl.href;
            img.alt = "Thumbnail media";
            img.loading = "lazy";
            header.append(img);
          }
        } catch {}
      }
      const details = make("div", "youtube-details");
      details.append(make("b", "youtube-title", info.title || info.filename || "Media siap diunduh"));
      details.append(make("small", "muted", [info.extractor || info.source || platformName(url), duration(info.duration), info.size ? (info.size / 1048576).toFixed(1) + " MB" : ""].filter(Boolean).join(" · ")));
      header.append(details);
      box.append(header);
      if(isYouTube){
        const providerNote=make("p",info.providerReady?"youtube-provider-state":"youtube-provider-state is-offline",info.providerReady?("Sumber aktif: "+info.provider+" · "+info.instance):info.providerMessage||"Instance komunitas sedang tidak tersedia.");
        box.append(providerNote);
      }

      const formatLabel = make("label", "label", "PILIH FORMAT");
      const mode = make("select", "field");
      mode.id = "aryMode";
      [["video","Video"],["audio","Audio MP3 / M4A"]].forEach(([value,label]) => {
        const option = make("option", "", label);
        option.value = value;
        mode.append(option);
      });
      if (info.type === "audio") mode.value = "audio";
      if(isYouTube&&info.providerName==="Hybrid"){
        const videoOption=mode.querySelector('option[value="video"]');
        const audioOption=mode.querySelector('option[value="audio"]');
        const hasVideo=(info.formats||[]).some(item=>item.mode==="video");
        const hasAudio=(info.formats||[]).some(item=>item.mode==="audio");
        if(videoOption)videoOption.disabled=!hasVideo;
        if(audioOption)audioOption.disabled=!hasAudio;
        if(!hasVideo&&hasAudio)mode.value="audio";
      }
      const qualityLabel = make("label", "label", "KUALITAS VIDEO");
      qualityLabel.style.marginTop = "12px";
      const quality = make("select", "field");
      quality.id = "aryQuality";
      const directMedia=!!info.extension&&!info.extractor;
      const heights = Array.isArray(info.formats)
        ? [...new Set(info.formats.map(item => Number(typeof item === "number" ? item : item.height)).filter(n => [144,240,360,480,720,1080,1440,2160].includes(n)))].sort((a,b) => a-b)
        : [];
      if(directMedia){
        const sourceOption=make("option","","Original · file sumber");sourceOption.value="0";quality.append(sourceOption);quality.disabled=true;
        qualityLabel.textContent="KUALITAS SUMBER";
        const audioOption=mode.querySelector('option[value="audio"]'),videoOption=mode.querySelector('option[value="video"]');
        if(info.type==="audio"){mode.value="audio";if(videoOption)videoOption.disabled=true}
        else{mode.value="video";if(audioOption)audioOption.disabled=true}
        mode.disabled=true;
      }else{
        const available = heights.length ? heights : (isYouTube?[]:[360,480,720,1080,1440,2160]);
        FORMATS.video.filter(item => available.includes(Number(item[0]))).forEach(([value,label]) => {
          const option = make("option", "", label);
          option.value = String(value);
          if (Number(value) === (heights.includes(720)?720:available[0])) option.selected = true;
          quality.append(option);
        });
      }
      const audioHint = make("p", "muted", directMedia?(info.type==="audio"?"File audio langsung akan diunduh dalam format sumber, tanpa konversi.":"File video langsung akan diunduh dalam kualitas aslinya."):isYouTube?(info.providerReady?"Pilihan kualitas dan format berasal dari stream yang tersedia pada instance komunitas. Video hanya menawarkan MP4 progresif agar audio dan video sudah menyatu.":"Tidak ada stream yang tersedia sekarang; coba lagi nanti."):"Audio/video mengikuti format yang tersedia dari sumber. Tidak ada server ekstraksi milik ARYANZZ.");
      const note = make("p", "youtube-note", "Unduh hanya media milik sendiri atau konten yang memang diizinkan. Kualitas mengikuti file sumber.");
      box.append(formatLabel, mode, qualityLabel, quality, audioHint, note);

      const progress = make("div", "progress-track");
      const bar = make("div", "progress-fill");
      bar.style.width = "0%";
      progress.append(bar);
      const progressText = make("p", "muted", "Siap. Pilih format dan kualitas, lalu mulai unduh.");
      const audioFormat=make("select","field");
      audioFormat.id="aryAudioFormat";
      const audioChoices=isYouTube&&info.providerName==="Hybrid"?[...new Set((info.formats||[]).filter(item=>item.mode==="audio").map(item=>item.ext))].map(ext=>[ext,ext.toUpperCase()]):[["mp3","MP3"],["m4a","M4A"]];
      audioChoices.forEach(([value,label])=>{const option=make("option","",label);option.value=value;audioFormat.append(option)});
      audioFormat.hidden=true;
      const audioLabel=make("label","label","FORMAT AUDIO");
      audioLabel.style.marginTop="12px";audioLabel.hidden=true;
      const bitrateLabel=make("label","label","BITRATE AUDIO");
      bitrateLabel.style.marginTop="12px";bitrateLabel.hidden=true;
      const audioBitrate=make("select","field");
      audioBitrate.id="aryAudioBitrate";
      [["128","128 kbps"],["256","256 kbps"],["320","320 kbps"]].forEach(([value,label])=>{const option=make("option","",label);option.value=value;if(value==="320")option.selected=true;audioBitrate.append(option)});
      audioBitrate.hidden=true;
      box.append(audioLabel,audioFormat,bitrateLabel,audioBitrate);
      const actions = make("div", "feature-row");
      const start = make("button", "primary youtube-start", isYouTube&&!info.providerReady?"Extractor belum aktif":"⬇ Download via Chrome");
      start.type = "button";
      const canStart=!isYouTube||!!info.providerReady;
      start.disabled=!canStart;
      if(!canStart)start.title="Semua instance komunitas sedang tidak tersedia. Coba lagi nanti.";
      const fav = make("button", "tag youtube-favorite", "♡ Favorit");
      fav.type = "button";
      fav.addEventListener("click", () => favorite(url.href, info.title || url.href, fav));
      actions.append(start, fav);
      box.append(progress, progressText, actions);
      mode.addEventListener("change", () => {
        quality.disabled = mode.value === "audio"||directMedia;
        qualityLabel.style.opacity = mode.value === "audio" ? ".45" : "1";
        audioFormat.hidden=mode.value!=="audio"||directMedia||audioChoices.length===0;
        audioLabel.hidden=audioFormat.hidden;
        audioBitrate.hidden=true;
        bitrateLabel.hidden=audioBitrate.hidden;
      });
      mode.dispatchEvent(new Event("change"));
      start.addEventListener("click", async () => {
        start.disabled = true;
        mode.disabled = true;
        quality.disabled = true;
        start.textContent = "Memproses…";
        try {
          const filename = isYouTube ? await downloadYouTube(url.href,mode.value,Number(quality.value)||720,bar,progressText,info,audioFormat.value,audioBitrate.value) : await downloadFile(url.href, mode.value, Number(quality.value) || 720, bar, progressText, info);
          progressText.textContent = "Permintaan unduhan dikirim ke Chrome: " + filename;
          start.textContent = "Unduhan dimulai ✓";
        } catch (error) {
          status(progressText, error.message || "Unduhan gagal.", true);
          start.disabled = false;
          mode.disabled = false;
          quality.disabled = mode.value === "audio"||directMedia;
          audioBitrate.disabled=false;
          start.textContent = "Coba lagi";
        }
      });
    } catch (error) {
      const platform=platformName(url);
      if(platform==="YouTube")showError(out,error,url.href);
      else if(platform==="TikTok")showError(out,new Error("TikTok sementara tidak didukung. ARYANZZ V71.0 difokuskan ke YouTube dan tautan file langsung."),url.href);
      else showError(out,error,url.href);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
  async function refreshBackendStatus(){
    const node=$("backendStatus");
    if(!node)return;
    try{
      const healthResponse=await fetch("/api/health",{cache:"no-store"});
      const health=await healthResponse.json().catch(()=>({}));
      if(!healthResponse.ok){
        node.dataset.state="warn";
        node.textContent="Status Worker belum dapat dibaca. Unduhan file langsung tetap bisa dicoba.";
        return;
      }
      if(health.mode==="cloudflare-worker-zero-server-hybrid"&&health.youtubeDownloader){
        const hybridResponse=await fetch("/api/youtube/status",{cache:"no-store"});
        const hybrid=await hybridResponse.json().catch(()=>({}));
        node.dataset.state=hybridResponse.ok&&hybrid.provider==="Piped + Invidious hybrid"?"ok":"warn";
        node.textContent="Mode gratis · YouTube Hybrid aktif (Piped + Invidious). Ketersediaan instance dicek saat link diperiksa; TikTok sementara nonaktif.";
        return;
      }
      if(!health.platformExtraction){
        node.dataset.state="warn";
        node.textContent="Mode gratis · file langsung dikirim ke unduhan Chrome; link sosial memerlukan provider komunitas.";
        return;
      }
      const response=await fetch("/api/platform/status",{cache:"no-store"});
      const data=await response.json().catch(()=>({}));
      if(response.ok&&data.ok){
        node.dataset.state="ok";
        node.textContent="Backend aktif · "+(data.backend||"yt-dlp")+(data.engine?" · "+data.engine:"");
      }else{
        node.dataset.state="warn";
        node.textContent="Backend terpasang tetapi belum siap. "+(data.message||data.error||"Coba lagi sebentar.")+" File media langsung tetap tersedia.";
      }
    }catch{
      node.dataset.state="warn";
      node.textContent="Mode tanpa server: file media langsung tetap tersedia; tautan sosial memerlukan provider komunitas.";
    }
  }
  function init() {
    refreshBackendStatus();
    const button = $("analyze");
    const input = $("url");
    if (!button || !input) return;
    button.addEventListener("click", event => {
      const raw = input.value.trim();
      const url = safeUrl(raw);
      if (!url) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const out = $("downloadResult");
        out.hidden = false;
        out.replaceChildren(make("b", "", "URL tidak valid"), make("p", "warning", "Masukkan tautan HTTP atau HTTPS yang benar."));
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      checkLink(url, button);
    }, true);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        button.click();
      }
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();