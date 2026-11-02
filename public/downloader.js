/* ARYANZZ V73.6 — zero-server direct downloader and community handoff */
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
    ["ted.com","TED"],["archive.org","Internet Archive"],["snackvideo.com","SnackVideo"],["threads.net","Threads"],["bluesky.app","Bluesky"],["kick.com","Kick"],["rumble.com","Rumble"],["odysee.com","Odysee"]
  ];
  let activeDownloadController=null,activeDownloadFfmpeg=null;
  function downloadTimeoutSignal(ms){
    const timeout=AbortSignal.timeout(ms),parent=activeDownloadController?.signal;
    return parent&&typeof AbortSignal.any==="function"?AbortSignal.any([parent,timeout]):parent||timeout;
  }
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
  function formatDownloadSize(bytes){
    const value=Number(bytes)||0;
    if(value<1024*1024)return (value/1024).toFixed(0)+" KB";
    return (value/1048576).toFixed(1)+" MB";
  }
  function sourceFormatBytes(item){
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
    for(const key of ["sizeBytes","size_bytes","contentLength","content_length","fileSize","filesize"]){const bytes=parse(item?.[key]);if(bytes)return bytes;}
    return parse(item?.size);
  }
  function estimateFormatBytes(item,durationSeconds){
    const exact=sourceFormatBytes(item);
    if(exact)return {bytes:exact,exact:true};
    const raw=Number(item?.bitrate)||Number(String(item?.bitrate||"").match(/[\d.]+/)?.[0])||0;
    const bitsPerSecond=raw>0&&raw<10000?raw*1000:raw;
    const seconds=Number(durationSeconds)||0;
    return {bytes:bitsPerSecond>0&&seconds>0?Math.round(bitsPerSecond*seconds/8):0,exact:false};
  }
  function youtubeQualityEstimate(info,height){
    const formats=Array.isArray(info?.formats)?info.formats:[];
    const video=formats.filter(item=>item.mode==="video"&&item.ext==="mp4"&&Number(item.height)===Number(height));
    const progressive=video.filter(item=>!item.videoOnly).sort((a,b)=>(Number(b.bitrate)||0)-(Number(a.bitrate)||0));
    if(progressive.length){
      const size=estimateFormatBytes(progressive[0],info.duration);
      return {kind:"direct",bytes:size.bytes,exact:size.exact,format:progressive[0]};
    }
    const adaptive=video.filter(item=>item.videoOnly).sort((a,b)=>(Number(b.bitrate)||0)-(Number(a.bitrate)||0));
    if(!adaptive.length)return null;
    const selected=adaptive[0],videoSize=estimateFormatBytes(selected,info.duration);
    const audio=formats.filter(item=>item.mode==="audio"&&item.ext==="m4a"&&(!selected.instance||!item.instance||item.instance===selected.instance)).sort((a,b)=>(Number(b.bitrate)||0)-(Number(a.bitrate)||0))[0];
    const audioSize=audio?estimateFormatBytes(audio,info.duration):{bytes:0,exact:false};
    return {kind:"adaptive",bytes:videoSize.bytes&&audioSize.bytes?videoSize.bytes+audioSize.bytes:0,exact:videoSize.exact&&audioSize.exact,format:selected};
  }
  function formatDownloadEta(seconds){
    if(!Number.isFinite(seconds)||seconds<0)return "menghitung…";
    const value=Math.ceil(seconds),minutes=Math.floor(value/60),remaining=value%60;
    return minutes?minutes+" m "+String(remaining).padStart(2,"0")+" d":remaining+" d";
  }
  function updateDownloadProgress(bar,progressText,progressMeta,options={}){
    const {stage="Mengunduh",received=0,total=0,startedAt=Date.now(),base=0,span=95,target="1 file MP4",indeterminate=false}=options;
    const track=bar?.parentElement,known=Number(total)>0,elapsed=Math.max(.5,(Date.now()-startedAt)/1000),speed=received/elapsed;
    let overall=0;
    if(track){
      if(known&&!indeterminate){
        const local=Math.min(1,received/total);overall=Math.min(98,base+local*span);
        track.classList.remove("is-indeterminate");bar.style.width=overall.toFixed(1)+"%";track.setAttribute("aria-valuenow",String(Math.round(overall)));
      }else{track.classList.add("is-indeterminate");bar.style.width="34%";}
    }
    const localPercent=known?Math.min(100,Math.round(received/total*100)):null;
    progressText.textContent=stage+(localPercent===null?"":" · "+localPercent+"%");
    const eta=known&&speed>0?(total-received)/speed:null;
    progressMeta.textContent=(known?"Total "+Math.round(overall)+"% · ":"")+formatDownloadSize(received)+(known?" / "+formatDownloadSize(total):"")+" · "+(speed>0?formatDownloadSize(speed)+"/detik":"mengukur kecepatan")+(eta===null?"":" · sisa ±"+formatDownloadEta(eta))+" · "+target;
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
  function addReadyDownloadLink(container,href,filename,label){
    container?.querySelector(".youtube-ready-link")?.remove();
    const link=make("a","youtube-download youtube-ready-link",label||"⬇ Unduh file sekarang");
    link.href=href;if(filename)link.download=filename;else link.removeAttribute("download");link.rel="noopener";link.setAttribute("aria-label",filename?"Unduh "+filename:(label||"Unduh media"));
    container?.append(link);return link;
  }
  async function saveBrowserBlob(blob,filename,container,label="⬇ Unduh file sekarang"){
    if(!blob||!blob.size)throw new Error("File kosong.");
    const objectUrl=URL.createObjectURL(blob);
    addReadyDownloadLink(container,objectUrl,filename,label);
    setTimeout(()=>URL.revokeObjectURL(objectUrl),10*60*1000);
    return objectUrl;
  }
  async function readBrowserChunk(reader,idleMs=60000){
    let timer;
    try{
      return await Promise.race([
        reader.read(),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Transfer berhenti mengirim data selama 60 detik. Unduhan dihentikan agar tidak menggantung.")),idleMs);})
      ]);
    }finally{if(timer)clearTimeout(timer);}
  }
  function mp4FourCC(bytes,offset){return String.fromCharCode(bytes[offset],bytes[offset+1],bytes[offset+2],bytes[offset+3]);}
  function mp4ReadMvhdDuration(bytes){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=0;
    while(offset+8<=bytes.byteLength){
      let size=view.getUint32(offset),header=8;const type=mp4FourCC(bytes,offset+4);
      if(size===1){if(offset+16>bytes.byteLength)break;size=Number(view.getBigUint64(offset+8));header=16;}
      else if(size===0)size=bytes.byteLength-offset;
      if(size<header||offset+size>bytes.byteLength)break;
      if(type==="mvhd"){
        const p=offset+header,version=view.getUint8(p);
        const scale=view.getUint32(p+(version===1?20:12));
        const duration=version===1?Number(view.getBigUint64(p+24)):view.getUint32(p+16);
        return scale>0&&duration>0?duration/scale:null;
      }
      offset+=size;
    }
    return null;
  }
  async function inspectMp4Blob(blob,expectedDuration=0){
    let offset=0,boxes=0,hasFtyp=false,hasMoov=false,hasMdat=false,duration=null;
    while(offset+8<=blob.size&&boxes++<4096){
      const head=new Uint8Array(await blob.slice(offset,Math.min(blob.size,offset+16)).arrayBuffer());
      if(head.length<8)break;
      const view=new DataView(head.buffer,head.byteOffset,head.byteLength);
      let size=view.getUint32(0),header=8;const type=mp4FourCC(head,4);
      if(size===1){if(head.length<16)throw new Error("Header MP4 64-bit tidak lengkap.");size=Number(view.getBigUint64(8));header=16;}
      else if(size===0)size=blob.size-offset;
      if(!Number.isFinite(size)||size<header||offset+size>blob.size)throw new Error("Struktur MP4 terpotong atau ukuran kotaknya tidak valid ("+type+").");
      if(type==="ftyp")hasFtyp=true;
      if(type==="mdat")hasMdat=true;
      if(type==="moov"){
        hasMoov=true;
        const moov=new Uint8Array(await blob.slice(offset+header,offset+size).arrayBuffer());
        duration=mp4ReadMvhdDuration(moov);
      }
      offset+=size;
    }
    if(boxes>=4096||offset!==blob.size||!hasFtyp||!hasMoov||!hasMdat)throw new Error("File MP4 belum utuh: struktur ftyp/moov/mdat tidak lengkap. File tidak disimpan.");
    if(expectedDuration>0&&duration>0){
      const tolerance=Math.max(3,expectedDuration*0.12);
      if(Math.abs(duration-expectedDuration)>tolerance)throw new Error("Durasi MP4 hasil unduhan ("+duration.toFixed(1)+" detik) berbeda jauh dari durasi sumber ("+expectedDuration.toFixed(1)+" detik). File ditahan agar tidak menyimpan video yang terpotong.");
    }
    if(expectedDuration>5&&duration!==null&&duration<1)throw new Error("Metadata MP4 menunjukkan durasi kurang dari 1 detik, bukan video utuh.");
    return {duration,hasFtyp,hasMoov,hasMdat};
  }

  let aryanzzFfmpegPromise=null;
  async function loadBrowserFfmpeg(progressText,progressMeta,bar,sizeNote=""){
    const engineStatus=progressMeta?.parentElement?.querySelector(".youtube-engine-status");
    const showEngine=text=>{if(engineStatus){engineStatus.hidden=false;engineStatus.textContent=text;}};
    if(aryanzzFfmpegPromise){
      progressText.textContent="Mesin perakit MP4 sudah siap · melanjutkan penggabungan…";
      if(sizeNote)progressMeta.textContent=sizeNote+" Mesin sudah dimuat pada sesi ini.";
      showEngine("Mesin MP4 siap ✓ · melanjutkan tahap penggabungan.");
      return aryanzzFfmpegPromise;
    }
    progressText.textContent="Memuat mesin perakit MP4 · hanya untuk kualitas video+audio terpisah…";
    progressMeta.textContent=(sizeNote?sizeNote+" ":"")+"Mesin lokal sekitar 30 MB diperlukan untuk menyatukan kedua komponen menjadi satu MP4.";
    showEngine("Persiapan mesin MP4 · mengunduh modul dan WebAssembly. Progres ini terpisah dari progres video.");
    aryanzzFfmpegPromise=(async()=>{
      const moduleUrl="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
      const coreBase="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      let ffmpeg=null,coreURL,wasmURL;
      const loadBlob=async(url,type,label)=>{
        const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"force-cache",signal:downloadTimeoutSignal(60000)});
        if(!response.ok)throw new Error("CDN FFmpeg "+label+" HTTP "+response.status);
        const total=Number(response.headers.get("content-length"))||0,reader=response.body?.getReader();
        if(!reader){
          const blob=new Blob([await response.arrayBuffer()],{type});
          showEngine("Mesin MP4 · "+label+" siap · "+formatDownloadSize(blob.size));
          return URL.createObjectURL(blob);
        }
        const chunks=[];let received=0;
        while(true){
          const part=await reader.read();if(part.done)break;
          if(activeDownloadController?.signal.aborted){await reader.cancel().catch(()=>{});throw new Error("Unduhan dibatalkan.");}
          chunks.push(part.value);received+=part.value.byteLength;
          showEngine("Mesin MP4 · "+label+" "+formatDownloadSize(received)+(total?" / "+formatDownloadSize(total):"")+" · memuat komponen…");
        }
        const blob=new Blob(chunks,{type});
        showEngine("Mesin MP4 · "+label+" selesai · "+formatDownloadSize(blob.size));
        return URL.createObjectURL(blob);
      };
      try{
        showEngine("Mesin MP4 · memuat modul JavaScript…");
        const mod=await import(moduleUrl);
        if(activeDownloadController?.signal.aborted)throw new Error("Unduhan dibatalkan.");
        ffmpeg=new mod.FFmpeg();activeDownloadFfmpeg=ffmpeg;
        [coreURL,wasmURL]=await Promise.all([
          loadBlob(coreBase+"/ffmpeg-core.js","text/javascript","CORE"),
          loadBlob(coreBase+"/ffmpeg-core.wasm","application/wasm","WASM")
        ]);
        showEngine("Mesin MP4 · menyiapkan worker lokal…");
        let loadTimer;
        try{
          await Promise.race([
            ffmpeg.load({coreURL,wasmURL,classWorkerURL:new URL("/ffmpeg-worker-bootstrap.js?v=75.0",location.origin).href}),
            new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(new Error("Mesin MP4 belum siap setelah 90 detik. Coba lagi saat jaringan stabil atau pilih kualitas MP4 langsung.")),90000);})
          ]);
        }finally{clearTimeout(loadTimer);}
        if(activeDownloadController?.signal.aborted)throw new Error("Unduhan dibatalkan.");
        showEngine("Mesin MP4 siap ✓ · lanjut mengunduh audio dan menyatukan file.");
        return ffmpeg;
      }catch(error){
        try{ffmpeg?.terminate()}catch{}
        if(activeDownloadFfmpeg===ffmpeg)activeDownloadFfmpeg=null;
        if(error&&typeof error==="object"&&!error.code)error.code="FFMPEG_LOAD_FAILED";
        throw error;
      }finally{
        if(coreURL)URL.revokeObjectURL(coreURL);
        if(wasmURL)URL.revokeObjectURL(wasmURL);
      }
    })().catch(error=>{aryanzzFfmpegPromise=null;throw error;});
    return aryanzzFfmpegPromise;
  }
  let downloadResumeDbPromise=null;
  function openDownloadResumeDb(){
    if(!("indexedDB" in window))return Promise.resolve(null);
    if(downloadResumeDbPromise)return downloadResumeDbPromise;
    downloadResumeDbPromise=new Promise(resolve=>{
      try{
        const request=indexedDB.open("aryanzz-download-resume",1);
        request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("chunks"))db.createObjectStore("chunks",{keyPath:"key"});};
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>resolve(null);
        request.onblocked=()=>resolve(null);
      }catch{resolve(null);}
    });
    return downloadResumeDbPromise;
  }
  async function readDownloadChunk(key){
    const db=await openDownloadResumeDb();if(!db)return null;
    return new Promise(resolve=>{
      try{
        const request=db.transaction("chunks","readonly").objectStore("chunks").get(key);
        request.onsuccess=()=>{const data=request.result?.data;resolve(data?new Uint8Array(data):null);};
        request.onerror=()=>resolve(null);
      }catch{resolve(null);}
    });
  }
  async function writeDownloadChunk(key,bytes){
    const db=await openDownloadResumeDb();if(!db)return false;
    return new Promise(resolve=>{
      try{
        const tx=db.transaction("chunks","readwrite");
        tx.objectStore("chunks").put({key,data:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),savedAt:Date.now()});
        tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false);
      }catch{resolve(false);}
    });
  }
  async function clearDownloadChunks(prefix){
    const db=await openDownloadResumeDb();if(!db)return;
    await new Promise(resolve=>{
      try{
        const tx=db.transaction("chunks","readwrite"),store=tx.objectStore("chunks"),request=store.openCursor();
        request.onsuccess=()=>{const cursor=request.result;if(cursor){if(String(cursor.key).startsWith(prefix))cursor.delete();cursor.continue();}};
        tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();
      }catch{resolve();}
    });
  }
  function downloadResumePrefix(originalUrl,item){
    const identity=[originalUrl,item?.instance||"",item?.provider||"",item?.mode||"",item?.height||0,item?.bitrate||0,item?.ext||""].join("|");
    let hash=2166136261;
    for(let i=0;i<identity.length;i++)hash=Math.imul(hash^identity.charCodeAt(i),16777619);
    return "v729:"+((hash>>>0).toString(36))+":";
  }
  async function fetchWithHeaderTimeout(input,init={},timeout=30000){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout),parent=activeDownloadController?.signal;
    const abort=()=>controller.abort(parent?.reason);
    if(parent?.aborted)abort();else parent?.addEventListener("abort",abort,{once:true});
    try{return await fetch(input,{...init,signal:controller.signal});}
    finally{clearTimeout(timer);parent?.removeEventListener("abort",abort);}
  }
  async function fetchYoutubeTrackRanges(target,total,info,item,bar,progressText,progressMeta,label,base,span,speed){
    const chunkSize=1024*1024,count=Math.ceil(total/chunkSize),output=(()=>{try{return new Uint8Array(total)}catch{throw new Error("Ukuran komponen terlalu besar untuk memori HP. Pilih kualitas MP4 lebih rendah.")}})();
    const prefix=downloadResumePrefix(info.url||"",item),concurrency=Math.max(1,Math.min(5,Number(speed)||3));
    let next=0,received=0,resumed=0,inFlight=0,failure=null;
    const startedAt=Date.now();
    const worker=async()=>{
      while(!failure){
        const index=next++;if(index>=count)return;
        const start=index*chunkSize,end=Math.min(total-1,start+chunkSize-1),expected=end-start+1,key=prefix+index;
        try{
          let part=await readDownloadChunk(key);
          if(!part||part.byteLength!==expected){
            const response=await fetchWithHeaderTimeout(target,{headers:{Range:"bytes="+start+"-"+end},cache:"no-store"},45000);
            if(response.status!==206){
              if(response.body)await response.body.cancel().catch(()=>{});
              if(response.status===200)throw new Error("Server sumber tidak mendukung Range untuk mode paralel.");
              throw new Error("Potongan "+(index+1)+"/"+count+" ditolak (HTTP "+response.status+").");
            }
            const contentRange=response.headers.get("content-range")||"";
            if(contentRange!=="bytes "+start+"-"+end+"/"+total)throw new Error("Rentang byte dari provider tidak cocok; unduhan dihentikan agar file tidak rusak.");
            const reader=response.body?.getReader();
            if(!reader)throw new Error("Browser tidak dapat membaca potongan unduhan.");
            part=new Uint8Array(expected);
            let offset=0;
            while(true){
              const result=await reader.read();if(result.done)break;
              if(offset+result.value.byteLength>expected){await reader.cancel().catch(()=>{});throw new Error("Provider mengirim potongan lebih besar dari rentang yang diminta.");}
              part.set(result.value,offset);offset+=result.value.byteLength;inFlight+=result.value.byteLength;
              updateDownloadProgress(bar,progressText,progressMeta,{stage:resumed?label+" · melanjutkan data tersimpan":label,received:received+inFlight,total,startedAt,base,span,target:"1 file MP4"});
            }
            if(offset!==expected)throw new Error("Ukuran potongan unduhan tidak lengkap.");
            inFlight-=expected;
            const saved=await writeDownloadChunk(key,part);
            if(!saved)progressMeta.textContent="Penyimpanan sementara HP tidak tersedia. Biarkan tab tetap terbuka sampai selesai.";
          }else resumed+=expected;
          output.set(part,start);received+=expected;
          updateDownloadProgress(bar,progressText,progressMeta,{stage:resumed?label+" · melanjutkan data tersimpan":label,received:received+inFlight,total,startedAt,base,span,target:"1 file MP4"});
        }catch(error){failure=error;throw error;}
      }
    };
    const workers=Array.from({length:Math.min(concurrency,count)},()=>worker());
    const settled=await Promise.allSettled(workers);
    const rejected=settled.find(item=>item.status==="rejected");
    if(rejected)throw rejected.reason;
    return output;
  }
  function youtubeMuxMemoryBudget(){
    const memory=Number(navigator.deviceMemory)||4;
    if(memory<=2)return {maxTrack:90*1024*1024,maxCombined:140*1024*1024};
    if(memory<=4)return {maxTrack:280*1024*1024,maxCombined:440*1024*1024};
    return {maxTrack:340*1024*1024,maxCombined:540*1024*1024};
  }
  async function probeYoutubeTrack(item,info){
    const direct=browserHybridMediaUrl(item.url,item.instance||info.instance);
    if(!direct)return null;
    const target="/api/youtube/hybrid/file?url="+encodeURIComponent(direct.href)+"&ext="+encodeURIComponent(item.ext)+"&title="+encodeURIComponent((info.title||"youtube")+"-preflight")+"&instance="+encodeURIComponent(item.instance||info.instance||"");
    try{
      const response=await fetch(target+"&probe=1",{cache:"no-store",signal:downloadTimeoutSignal(12000)});
      const check=await response.json().catch(()=>({}));
      if(response.ok&&check.ok)return {target,totalBytes:Number(check.totalBytes)||0,status:Number(check.status)||0};
    }catch(error){if(activeDownloadController?.signal.aborted)throw new Error("Unduhan dibatalkan.");}
    return null;
  }
  async function fetchYoutubeTrack(item,info,maxBytes,bar,progressText,progressMeta,label,base,span,speed,probeResult=null){
    const direct=browserHybridMediaUrl(item.url,item.instance||info.instance);
    if(!direct)throw new Error("Alamat stream "+label+" tidak lolos pemeriksaan keamanan.");
    const target="/api/youtube/hybrid/file?url="+encodeURIComponent(direct.href)+"&ext="+encodeURIComponent(item.ext)+"&title="+encodeURIComponent((info.title||"youtube")+"-"+label)+"&instance="+encodeURIComponent(item.instance||info.instance||"");
    try{
      const check=probeResult||await (async()=>{const probe=await fetch(target+"&probe=1",{cache:"no-store",signal:downloadTimeoutSignal(45000)});return probe.json().catch(()=>({}));})();
      const total=Number(check.totalBytes)||0;
      if(check.ok&&check.status===206&&total>0){
        if(total>maxBytes)throw new Error(label+" berukuran "+formatDownloadSize(total)+" dan melewati batas aman memori perangkat. Coba kualitas lebih rendah.");
        try{return await fetchYoutubeTrackRanges(target,total,info,item,bar,progressText,progressMeta,label,base,span,speed);}
        catch(error){if(!/tidak mendukung Range/i.test(String(error.message||error)))throw error;}
      }
    }catch(error){
      if(/melewati batas aman memori/.test(String(error.message||error)))throw error;
    }
    let response,browserError;
    try{
      response=await fetchWithHeaderTimeout(direct.href,{mode:"cors",credentials:"omit",cache:"no-store"},45000);
      if(!response.ok)throw new Error("HTTP "+response.status);
    }catch(error){
      browserError=error;
      response=await fetchWithHeaderTimeout(target,{cache:"no-store"},45000);
      if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(label+" tidak bisa diambil: "+(detail.error||browserError.message||"CORS"));}
    }
    const type=String(response.headers.get("content-type")||"").toLowerCase();
    if(type.includes("text/html")||type.includes("application/json")||type.includes("text/plain"))throw new Error("Provider mengirim halaman error untuk "+label+".");
    const total=Number(response.headers.get("content-length")||0);
    if(total>maxBytes)throw new Error(label+" berukuran "+formatDownloadSize(total)+" dan melewati batas aman memori perangkat. Coba kualitas lebih rendah.");
    const reader=response.body?.getReader();
    if(!reader)throw new Error("Browser tidak bisa membaca "+label+".");
    const chunks=[],startedAt=Date.now();let received=0,output=total?new Uint8Array(total):null;
    while(true){
      const part=await reader.read();if(part.done)break;
      received+=part.value.byteLength;
      if(received>maxBytes){await reader.cancel();throw new Error(label+" melewati batas aman memori perangkat. Coba kualitas lebih rendah.");}
      if(output){if(received>output.byteLength)throw new Error("Ukuran stream berubah saat diunduh.");output.set(part.value,received-part.value.byteLength);}
      else chunks.push(part.value);
      updateDownloadProgress(bar,progressText,progressMeta,{stage:label,received,total,startedAt,base,span,target:"1 file MP4"});
    }
    if(!received)throw new Error("Komponen media kosong.");
    if(output&&received!==output.byteLength)output=output.slice(0,received);
    if(!output){output=new Uint8Array(received);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength;}}
    return output;
  }
  async function muxYoutubeMp4(videoItem,audioItem,info,bar,progressText,progressMeta,speed){
    const {maxTrack,maxCombined}=youtubeMuxMemoryBudget();
    const videoPrefix=downloadResumePrefix(info.url||"",videoItem),audioPrefix=downloadResumePrefix(info.url||"",audioItem);
    let videoBytes=null,audioBytes=null,completed=false;
    progressText.textContent="Memeriksa ukuran komponen dan menyiapkan satu MP4…";
    progressMeta.textContent="Mode kecepatan aktif · "+(Math.max(1,Math.min(5,Number(speed)||3)))+" jalur paralel jika sumber mendukung. Ukuran video dan audio diperiksa sebelum penggabungan.";
    const inputVideo="aryanzz-video.mp4",inputAudio="aryanzz-audio.m4a",output="aryanzz-output.mp4";
    let ffmpeg;
    try{
      const [videoProbe,audioProbe]=await Promise.all([probeYoutubeTrack(videoItem,info),probeYoutubeTrack(audioItem,info)]);
      const videoTotal=Number(videoProbe?.totalBytes)||0,audioTotal=Number(audioProbe?.totalBytes)||0;
      if(videoTotal>maxTrack)throw new Error("Komponen video berukuran "+formatDownloadSize(videoTotal)+" dan melewati batas aman memori perangkat. Pilih kualitas MP4 lebih rendah.");
      if(audioTotal>maxTrack)throw new Error("Komponen suara berukuran "+formatDownloadSize(audioTotal)+" dan melewati batas aman memori perangkat. Pilih kualitas MP4 lebih rendah.");
      if(videoTotal&&audioTotal&&videoTotal+audioTotal>maxCombined)throw new Error("Gabungan media "+formatDownloadSize(videoTotal+audioTotal)+" melewati batas aman memori HP. ARYANZZ mencoba kualitas lebih rendah.");
      const measuredSizeNote=videoTotal&&audioTotal?"Ukuran terukur: video "+formatDownloadSize(videoTotal)+" + audio "+formatDownloadSize(audioTotal)+" = "+formatDownloadSize(videoTotal+audioTotal)+".":"Ukuran komponen belum diberikan provider.";
      progressMeta.textContent=measuredSizeNote+" Mode "+({1:"Speed",3:"Max Speed",5:"Mega Speed"}[Number(speed)]||"Max Speed")+" aktif jika sumber mendukung Range.";
      progressText.textContent="Mengunduh video sambil menyiapkan mesin MP4…";
      const videoTask=fetchYoutubeTrack(videoItem,info,maxTrack,bar,progressText,progressMeta,"Tahap 1/3 · Video",0,38,speed,videoProbe).then(bytes=>{
        const track=bar.parentElement;track?.classList.add("is-indeterminate");
        progressText.textContent="Tahap 1/3 · Video · 100% selesai";
        progressMeta.textContent=measuredSizeNote+" Video selesai (38% dari total). Menunggu mesin MP4 siap sebelum mengambil audio…";
        return bytes;
      });
      const [downloadedVideo,readyFfmpeg]=await Promise.all([videoTask,loadBrowserFfmpeg(progressText,progressMeta,bar,measuredSizeNote)]);
      videoBytes=downloadedVideo;ffmpeg=readyFfmpeg;
      const videoSize=videoBytes.byteLength,track=bar.parentElement;
      progressMeta.textContent=measuredSizeNote+" Mesin MP4 disiapkan bersamaan dengan unduhan video agar waktu tunggu lebih singkat.";
      await ffmpeg.writeFile(inputVideo,videoBytes);videoBytes=null;
      progressText.textContent="Tahap 2/3 · Mengambil komponen suara…";
      progressMeta.textContent=measuredSizeNote+" Tahap video selesai 100%; sekarang mengunduh audio. Jangan tutup tab.";track?.classList.remove("is-indeterminate");
      audioBytes=await fetchYoutubeTrack(audioItem,info,maxTrack,bar,progressText,progressMeta,"Tahap 2/3 · Audio",38,38,speed,audioProbe);
      if(videoSize+audioBytes.byteLength>maxCombined)throw new Error("Gabungan media "+formatDownloadSize(videoSize+audioBytes.byteLength)+" melewati batas aman memori HP. ARYANZZ mencoba kualitas lebih rendah.");
      await ffmpeg.writeFile(inputAudio,audioBytes);audioBytes=null;
      track?.classList.add("is-indeterminate");
      progressText.textContent="Tahap 3/3 · Menyatukan MP4…";
      progressMeta.textContent="Target: 1 file MP4 · penggabungan lokal. Jangan tutup tab sampai file diserahkan ke Chrome.";
      const onProgress=event=>{
        const value=Number(event?.progress);if(!Number.isFinite(value))return;
        const pct=Math.max(0,Math.min(1,value)),overall=Math.min(98,78+pct*20);
        track?.classList.remove("is-indeterminate");bar.style.width=overall.toFixed(1)+"%";track?.setAttribute("aria-valuenow",String(Math.round(overall)));
        progressText.textContent="Tahap 3/3 · Menyatukan MP4 · "+Math.round(pct*100)+"%";
        progressMeta.textContent="Total "+Math.round(overall)+"% · hampir selesai";
      };
      ffmpeg.on?.("progress",onProgress);
      let code;
      try{code=await ffmpeg.exec(["-i",inputVideo,"-i",inputAudio,"-map","0:v:0","-map","1:a:0","-c","copy","-movflags","+faststart","-shortest",output],300000);}
      finally{ffmpeg.off?.("progress",onProgress);}
      if(code!==0)throw new Error("Mesin MP4 tidak dapat menyatukan format sumber (kode "+code+").");
      const result=await ffmpeg.readFile(output);
      if(!result||result.length<1024)throw new Error("Hasil MP4 kosong atau tidak lengkap.");
      const blob=new Blob([result],{type:"video/mp4"}),filename=safeFilename((info.outputName||info.title||"aryanzz-youtube").replace(/\.(?:mp4|mp3|m4a|webm|mov)$/i,"")+".mp4");
      progressText.textContent="MP4 selesai dirakit.";
      progressMeta.textContent="Ukuran file "+formatDownloadSize(blob.size)+" · tekan tombol unduh di bawah.";
      await saveBrowserBlob(blob,filename,progressText.parentElement);
      completed=true;
      track?.classList.remove("is-indeterminate");
      bar.style.width="100%";track?.setAttribute("aria-valuenow","100");
      progressText.textContent="File MP4 siap · "+formatDownloadSize(blob.size)+" ✓";
      progressMeta.textContent="Tekan “Unduh MP4 sekarang” untuk menyimpan ke Chrome.";
      remember(info.url||"",filename,"video",videoItem.height);
      return filename;
    }finally{
      videoBytes=null;audioBytes=null;
      if(ffmpeg)for(const name of [inputVideo,inputAudio,output])try{await ffmpeg.deleteFile(name)}catch{}
      if(completed){await clearDownloadChunks(videoPrefix);await clearDownloadChunks(audioPrefix);}
    }
  }
  async function waitForServiceWorkerController(timeoutMs=3500){
    if(navigator.serviceWorker?.controller)return true;
    if(!("serviceWorker" in navigator))return false;
    try{await navigator.serviceWorker.ready;}catch{}
    if(navigator.serviceWorker.controller)return true;
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);navigator.serviceWorker.removeEventListener("controllerchange",changed);resolve(value);};
      const changed=()=>finish(!!navigator.serviceWorker.controller);
      const timer=setTimeout(()=>finish(!!navigator.serviceWorker.controller),timeoutMs);
      navigator.serviceWorker.addEventListener("controllerchange",changed,{once:true});
    });
  }
  async function downloadYoutubeProgressiveCandidate(url,mode,selected,info,bar,progressText,progressMeta,quality){
    const filename=safeFilename((info.outputName||info.title||"aryanzz-youtube").replace(/\.(?:mp4|mp3|m4a|webm|mov)$/i,"")+"."+selected.ext);
    const instance=selected.instance||info.instance;
    const direct=browserHybridMediaUrl(selected.url,instance);
    if(!direct)throw new Error("Alamat stream tidak lolos pemeriksaan keamanan.");
    const params="url="+encodeURIComponent(direct.href)+"&ext="+encodeURIComponent(selected.ext)+"&title="+encodeURIComponent(info.title||"aryanzz-youtube")+"&instance="+encodeURIComponent(instance||"");
    const target="/api/youtube/hybrid/file?"+params;
    const browserTarget="/api/youtube/hybrid/browser-file?"+params;
    const probeTarget=target+"&probe=1";
    const targetName=mode==="video"?"1 file MP4":"1 file audio";
    let transferTarget=target,browserStream=false,actualBytes=0,actualSizeExact=false;
    try{
      const probe=await fetch(probeTarget,{cache:"no-store",signal:downloadTimeoutSignal(12000)});
      const check=await probe.json().catch(()=>({}));
      if(!probe.ok||!check.ok)throw new Error(check.error||"Pemeriksaan stream gagal (HTTP "+probe.status+").");
      actualBytes=Number(check.totalBytes)||0;actualSizeExact=actualBytes>0;
    }catch(workerError){
      if(!await waitForServiceWorkerController())throw new Error("Server komunitas menolak koneksi Cloudflare dan jalur browser belum aktif. Muat ulang ARYANZZ sekali, lalu coba lagi. Detail: "+String(workerError.message||workerError).slice(0,140));
      progressText.textContent="Mencoba koneksi provider dari jaringan HP…";
      progressMeta.textContent="Melewati jalur Cloudflare yang ditolak; Chrome akan menerima stream langsung dari perangkat.";
      const browserProbe=await fetch(browserTarget,{headers:{Range:"bytes=0-0"},cache:"no-store",signal:downloadTimeoutSignal(12000)});
      if(!browserProbe.ok||browserProbe.status!==206){
        const failure=await browserProbe.json().catch(()=>({}));
        throw new Error(failure.error||"Provider juga menolak koneksi browser (HTTP "+browserProbe.status+"). Coba instance lain.");
      }
      const browserType=String(browserProbe.headers.get("content-type")||"").toLowerCase();
      if(browserType.startsWith("text/")||browserType.includes("application/json"))throw new Error("Provider browser mengirim respons non-media.");
      const first=await browserProbe.arrayBuffer();
      if(first.byteLength!==1)throw new Error("Pemeriksaan koneksi browser tidak menerima satu byte media yang valid.");
      const totalMatch=String(browserProbe.headers.get("content-range")||"").match(/\/(\d+)$/);
      actualBytes=Number(totalMatch?.[1])||0;actualSizeExact=actualBytes>0;
      browserStream=true;transferTarget=browserTarget;
    }
    if(!actualBytes){const estimate=estimateFormatBytes(selected,info.duration);actualBytes=estimate.bytes||0;actualSizeExact=estimate.exact;}
    const actualQuality=Number(selected.height)||0,requestedQuality=Number(quality)||0;
    const fellBack=mode==="video"&&actualQuality>0&&requestedQuality>0&&actualQuality!==requestedQuality;
    progressText.textContent=fellBack?"MP4 langsung "+actualQuality+"p tersedia; kualitas "+requestedQuality+"p memerlukan perakitan video dan audio.":"Stream "+(mode==="video"?"MP4":"audio")+" siap untuk Chrome.";
    const sizeLabel=actualBytes?(actualSizeExact?"Ukuran file: ":"Perkiraan ukuran: ±")+formatDownloadSize(actualBytes)+" · ":"";
    progressMeta.textContent=sizeLabel+"Target: "+targetName+" · "+(actualQuality?("kualitas aktual "+actualQuality+"p · "):"")+(browserStream?"koneksi dari jaringan HP, bukan IP Cloudflare. ":"")+"Chrome mengelola transfer dan progres unduhan asli.";
    addReadyDownloadLink(progressText.parentElement,transferTarget,filename,mode==="video"?"⬇ Unduh MP4 sekarang":"⬇ Unduh audio sekarang");
    bar.parentElement?.classList.remove("is-indeterminate");
    bar.style.width="100%";bar.parentElement?.setAttribute("aria-valuenow","100");
    progressText.textContent=(mode==="video"?"MP4 "+(actualQuality?actualQuality+"p ":""):"Audio ")+"siap ✓";
    progressMeta.textContent="Tekan tombol unduh di bawah untuk menyimpan ke Chrome.";
    remember(url,filename,mode,actualQuality||quality);
    return filename;
  }
  async function refreshYoutubeProviderInfo(raw,previousInfo){
    const endpoint="/api/youtube/hybrid/info?url="+encodeURIComponent(raw);
    const response=await fetch(endpoint,{cache:"no-store",signal:downloadTimeoutSignal(12000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.providerReady||!Array.isArray(data.formats)||!data.formats.length)return null;
    const fresh=data.formats.map(item=>({...item,instance:item.instance||data.instance,provider:item.provider||data.provider}));
    const old=Array.isArray(previousInfo.formats)?previousInfo.formats:[];
    const formats=browserDedupeFormats([...fresh,...old]);
    const providers=[...(Array.isArray(data.providers)?data.providers:[]),...(Array.isArray(previousInfo.providers)?previousInfo.providers:[])];
    const uniqueProviders=[...new Map(providers.filter(item=>item?.instance).map(item=>[item.instance,item])).values()];
    return {...data,...previousInfo,providerName:"Hybrid",providerReady:true,formats,providers:uniqueProviders,diagnostics:[...(data.diagnostics||[]),...(previousInfo.diagnostics||[])].slice(0,20)};
  }
  async function downloadYouTube(url,mode,quality,bar,progressText,progressMeta,info={},audioFormat="m4a",speed=3,retryState={refreshed:false,attempted:[]}){
    if(info.providerName!=="Hybrid"||!info.providerReady)throw new Error("Tidak ada stream gratis yang tersedia dari instance komunitas saat ini.");
    const attempted=new Set(Array.isArray(retryState.attempted)?retryState.attempted:[]);
    let ffmpegUnavailable=!!retryState.ffmpegUnavailable;
    const candidateKey=item=>[item.instance||info.instance,item.mode,item.height||0,item.videoOnly?"video-only":"muxed",item.url].join("|");
    const selectProviderCandidates=(formats,maxPerHeight=3,maxTotal=4)=>{
      const counts=new Map(),instances=new Set(),selected=[];
      for(const item of formats){
        const height=Number(item.height)||0,instance=String(item.instance||info.instance||"");
        const key=height+"|"+instance;
        if(instances.has(key)||(counts.get(height)||0)>=maxPerHeight)continue;
        instances.add(key);counts.set(height,(counts.get(height)||0)+1);selected.push(item);
        if(selected.length>=maxTotal)break;
      }
      return selected;
    };
    const all=(Array.isArray(info.formats)?info.formats:[]).filter(item=>item.mode===mode&&item.url);
    let candidates=[];
    if(mode==="audio"){
      candidates=selectProviderCandidates(all.filter(item=>item.ext===audioFormat),2,8);
      if(!candidates.length)candidates=selectProviderCandidates(all,2,8);
    }else{
      const wanted=Number(quality)||480;
      const videoMp4=all.filter(item=>item.ext==="mp4"&&Number(item.height)>0);
      const progressive=videoMp4.filter(item=>!item.videoOnly);
      const adaptive=videoMp4.filter(item=>item.videoOnly);
      const orderByRequestedQuality=formats=>{
        const below=formats.filter(item=>Number(item.height)<=wanted).sort((a,b)=>Number(b.height)-Number(a.height)||Number(b.bitrate)-Number(a.bitrate));
        const above=formats.filter(item=>Number(item.height)>wanted).sort((a,b)=>Number(a.height)-Number(b.height)||Number(b.bitrate)-Number(a.bitrate));
        return [...below,...above];
      };
      const exactProgressive=selectProviderCandidates(progressive.filter(item=>Number(item.height)===wanted).sort((a,b)=>Number(b.bitrate)-Number(a.bitrate)),3,4);
      const exactAdaptive=selectProviderCandidates(adaptive.filter(item=>Number(item.height)===wanted).sort((a,b)=>Number(b.bitrate)-Number(a.bitrate)),3,4);
      const progressiveFallback=selectProviderCandidates(orderByRequestedQuality(progressive.filter(item=>Number(item.height)!==wanted)),2,4);
      const adaptiveFallback=selectProviderCandidates(orderByRequestedQuality(adaptive.filter(item=>Number(item.height)!==wanted)),2,4);
      candidates=[...exactProgressive,...exactAdaptive,...progressiveFallback,...adaptiveFallback];
      if(candidates[0]?.videoOnly){
        progressText.textContent="Kualitas "+wanted+"p · menyiapkan satu MP4 otomatis.";
        progressMeta.textContent="ARYANZZ memeriksa beberapa provider untuk kualitas ini, lalu mencoba MP4 langsung yang lebih ringan bila diperlukan.";
      }else{
        const best=Number(candidates[0]?.height)||0;
        progressText.textContent="Mode MP4 langsung · "+(best?best+"p":"kualitas sumber")+" diprioritaskan.";
        progressMeta.textContent="MP4 yang sudah menyatu dikirim ke Chrome tanpa mesin perakit lokal.";
      }
    }
    const seen=new Set();
    candidates=candidates.filter(item=>{
      const key=candidateKey(item);
      if(seen.has(key)||attempted.has(key))return false;
      seen.add(key);return true;
    });
    if(!candidates.length)throw new Error("Provider tidak menyediakan format "+(mode==="video"?"MP4":"audio")+" baru yang dapat dicoba.");
    const failures=[];
    for(const selected of candidates){
      if(ffmpegUnavailable&&mode==="video"&&selected.videoOnly)continue;
      const instance=selected.instance||info.instance;
      attempted.add(candidateKey(selected));
      progressText.textContent="Menguji "+(selected.provider||"provider")+" · "+(selected.height?selected.height+"p":"audio")+"…";
      progressMeta.textContent="Jika provider menolak stream (403/429), ARYANZZ otomatis beralih ke provider lain yang menyediakan format setara.";
      try{
        if(mode==="video"&&selected.videoOnly){
          const audios=(info.formats||[]).filter(item=>item.mode==="audio"&&item.ext==="m4a"&&(!instance||!item.instance||item.instance===instance)).sort((a,b)=>Number(b.bitrate)-Number(a.bitrate));
          const audioItem=audios[0];
          if(!audioItem)throw new Error("Komponen media tidak lengkap pada provider ini.");
          return await muxYoutubeMp4(selected,audioItem,{...info,url},bar,progressText,progressMeta,speed);
        }
        return await downloadYoutubeProgressiveCandidate(url,mode,selected,info,bar,progressText,progressMeta,quality);
      }catch(error){
        if(activeDownloadController?.signal.aborted)throw new Error("Unduhan dibatalkan.");
        if(error?.code==="FFMPEG_LOAD_FAILED"){ffmpegUnavailable=true;retryState.ffmpegUnavailable=true;const engineStatus=progressMeta?.parentElement?.querySelector(".youtube-engine-status");if(engineStatus)engineStatus.textContent="Mesin MP4 tidak berhasil dimuat; mencoba MP4 langsung yang tersedia."}
        const reason=String(error.message||error).slice(0,180);
        failures.push((selected.provider||"provider")+" "+(instance||"")+": "+reason);
        if(mode==="video"&&/memori|RAM|terlalu besar|out of memory|allocation failed/i.test(reason)){
          const next=candidates.find(item=>item!==selected&&Number(item.height)<Number(selected.height));
          progressText.textContent="Kualitas "+selected.height+"p terlalu berat · mencoba "+(next?next.height+"p":"kualitas MP4 yang lebih ringan")+"…";
          progressMeta.textContent="Data yang sudah tersimpan tetap dipertahankan. Mode "+({1:"Speed",3:"Max Speed",5:"Mega Speed"}[Number(speed)]||"Max Speed")+" aktif jika server mendukung Range.";
        }
      }
    }
    const retryable=failures.some(item=>/HTTP (?:403|429|5\d\d)|koneksi browser|provider juga menolak|network|failed to fetch|ditolak|stream tidak tersedia/i.test(item));
    if(!retryState.refreshed&&retryable){
      progressText.textContent="Provider menolak stream · memperbarui daftar sumber…";
      progressMeta.textContent="ARYANZZ meminta ulang alamat stream agar tautan kedaluwarsa atau instance yang baru pulih bisa dicoba.";
      try{
        const refreshed=await refreshYoutubeProviderInfo(url,info);
        if(refreshed){
          const hasNew=(refreshed.formats||[]).some(item=>item.mode===mode&&item.url&&!attempted.has(candidateKey(item)));
          if(hasNew)return await downloadYouTube(url,mode,quality,bar,progressText,progressMeta,refreshed,audioFormat,speed,{refreshed:true,attempted:[...attempted],ffmpegUnavailable});
        }
      }catch(error){failures.push("Pembaruan provider: "+String(error.message||error).slice(0,140));}
    }
    if(!retryState.publicFallback){
      progressText.textContent="Provider komunitas menolak stream · mencoba jalur publik gratis alternatif…";
      progressMeta.textContent="ARYANZZ mencoba sumber publik kedua tanpa server pribadi atau layanan berbayar.";
      try{
        const publicInfo={...(await postJson("/api/info",{url})),outputName:info.outputName};
        if(publicInfo.providerName==="Public API"&&publicInfo.providerReady){
          progressText.textContent="Sumber alternatif tersedia · menyiapkan tautan unduh…";
          return await downloadFile(url,mode,quality,bar,progressText,publicInfo,audioFormat);
        }
      }catch(error){failures.push("Provider publik alternatif: "+String(error.message||error).slice(0,150));}
    }
    throw new Error("Semua jalur "+(mode==="video"?"MP4":"audio")+" yang tersedia gagal. "+(failures.slice(0,4).join(" | ")||"Coba kualitas lain atau ulangi nanti."));
  }
  async function downloadFile(url, mode, quality, bar, progressText, info={}) {
    if(info.providerName!=="Hybrid"||!info.providerReady)throw new Error("Tidak ada stream gratis yang tersedia dari instance komunitas saat ini.");
    const all=(Array.isArray(info.formats)?info.formats:[]).filter(item=>item.mode===mode&&item.url);
    let candidates=[];
    if(mode==="audio"){
      candidates=all.filter(item=>item.ext===audioFormat);
      if(!candidates.length)candidates=all;
    }else{
      const wanted=Number(quality)||480;
      const videoMp4=all.filter(item=>item.ext==="mp4"&&Number(item.height)>0);
      const progressive=videoMp4.filter(item=>!item.videoOnly);
      const adaptive=videoMp4.filter(item=>item.videoOnly);
      const orderByRequestedQuality=formats=>{
        const below=formats.filter(item=>Number(item.height)<=wanted).sort((a,b)=>Number(b.height)-Number(a.height)||Number(b.bitrate)-Number(a.bitrate));
        const above=formats.filter(item=>Number(item.height)>wanted).sort((a,b)=>Number(a.height)-Number(b.height)||Number(b.bitrate)-Number(a.bitrate));
        return [...below,...above];
      };
      const exactProgressive=progressive.filter(item=>Number(item.height)===wanted).sort((a,b)=>Number(b.bitrate)-Number(a.bitrate));
      const exactAdaptive=adaptive.filter(item=>Number(item.height)===wanted).sort((a,b)=>Number(b.bitrate)-Number(a.bitrate));
      const progressiveFallback=orderByRequestedQuality(progressive.filter(item=>Number(item.height)!==wanted));
      const adaptiveFallback=orderByRequestedQuality(adaptive.filter(item=>Number(item.height)!==wanted));
      const seen=new Set();
      candidates=[...exactProgressive,...exactAdaptive,...progressiveFallback,...adaptiveFallback].filter(item=>{
        const key=[item.instance,item.height,item.videoOnly,item.url].join("|");if(seen.has(key))return false;seen.add(key);return true;
      });
      if(candidates[0]?.videoOnly){
        progressText.textContent="Kualitas "+wanted+"p · menyiapkan satu MP4 otomatis.";
        progressMeta.textContent="Jika memori perangkat tidak cukup, ARYANZZ mencoba MP4 langsung pada kualitas lebih rendah yang tersedia.";
      }else{
        const best=Number(candidates[0]?.height)||0;
        progressText.textContent="Mode MP4 langsung · "+(best?best+"p":"kualitas sumber")+" diprioritaskan.";
        progressMeta.textContent="Target: 1 file MP4 · Chrome mengelola unduhan tanpa merakit file di memori.";
      }
    }
    if(!candidates.length)throw new Error("Provider tidak menyediakan format "+(mode==="video"?"MP4":"audio")+" yang dapat diunduh.");
    const failures=[];
    for(const selected of candidates){
      const instance=selected.instance||info.instance;
      try{
        if(mode==="video"&&selected.videoOnly){
          const audios=(info.formats||[]).filter(item=>item.mode==="audio"&&item.ext==="m4a"&&(!instance||!item.instance||item.instance===instance)).sort((a,b)=>Number(b.bitrate)-Number(a.bitrate));
          const audioItem=audios[0];
          if(!audioItem)throw new Error("Komponen media tidak lengkap pada provider ini.");
          return await muxYoutubeMp4(selected,audioItem,{...info,url},bar,progressText,progressMeta,speed);
        }
        return await downloadYoutubeProgressiveCandidate(url,mode,selected,info,bar,progressText,progressMeta,quality);
      }catch(error){
        if(activeDownloadController?.signal.aborted)throw new Error("Unduhan dibatalkan.");
        const reason=String(error.message||error).slice(0,180);
        failures.push((selected.provider||"provider")+" "+(instance||"")+": "+reason);
        if(mode==="video"&&/memori|RAM|terlalu besar|out of memory|allocation failed/i.test(reason)){
          const next=candidates.find(item=>item!==selected&&Number(item.height)<Number(selected.height));
          progressText.textContent="Kualitas "+selected.height+"p terlalu berat · mencoba "+(next?next.height+"p":"kualitas MP4 yang lebih ringan")+"…";
          progressMeta.textContent="Data yang sudah tersimpan tetap dipertahankan. Mode "+({1:"Speed",3:"Max Speed",5:"Mega Speed"}[Number(speed)]||"Max Speed")+" aktif untuk pengambilan potongan berikutnya.";
        }
      }
    }
    throw new Error("Semua jalur "+(mode==="video"?"MP4":"audio")+" yang tersedia gagal. "+(failures.slice(0,3).join(" | ")||"Coba kualitas lain atau ulangi nanti."));
  }
  async function downloadFile(url, mode, quality, bar, progressText, info={}, requestedAudioFormat="mp3",progressMeta=null) {
    if(info.providerName==="Public API"){
      const all=(Array.isArray(info.formats)?info.formats:[]).filter(item=>item.mode===mode&&item.downloadUrl&&!(mode==="video"&&item.videoOnly));
      let selected=null;
      if(mode==="audio")selected=all.find(item=>item.ext===requestedAudioFormat)||all[0]||null;
      else{
        const wanted=Number(quality)||0;
        selected=all.filter(item=>Number(item.height)>0).sort((a,b)=>{
          const ah=Number(a.height),bh=Number(b.height),aBelow=ah<=wanted,bBelow=bh<=wanted;
          if(aBelow!==bBelow)return aBelow?-1:1;
          return aBelow?bh-ah:ah-bh;
        })[0]||all[0]||null;
      }
      if(!selected)throw new Error("Provider gratis tidak menyediakan stream "+(mode==="audio"?"audio":"video lengkap dengan suara")+". Pilih kualitas lain atau coba tautan lain.");
      const ready=safeUrl(selected.downloadUrl);
      if(!ready||ready.origin!==location.origin||ready.pathname!=="/api/social-file")throw new Error("Tautan unduhan tidak melewati pemeriksaan keamanan ARYANZZ.");
      const probeUrl=new URL(ready.href);probeUrl.searchParams.set("probe","1");
      progressText.textContent="Memeriksa ukuran dan isi media…";
      if(progressMeta)progressMeta.textContent="Memeriksa header MP4/WebM, ukuran total dan dukungan stream sebelum mulai mengunduh.";
      const probeResponse=await fetch(probeUrl.href,{cache:"no-store",credentials:"same-origin",signal:downloadTimeoutSignal(45000)});
      const check=await probeResponse.json().catch(()=>({}));
      if(!probeResponse.ok||!check.valid)throw new Error(check.error||"Pemeriksaan file media gagal (HTTP "+probeResponse.status+").");
      const size=Number(check.bytes)||Number(selected.filesize)||0;
      const filenameBase=safeFilename(info.outputName||info.title||"aryanzz-media").replace(/\.[a-z0-9]{2,5}$/i,"");
      const filename=filenameBase+"."+check.extension;
      const downloadUrl=new URL(ready.href);downloadUrl.searchParams.set("filename",filenameBase);
      if(size)downloadUrl.searchParams.set("expected",String(size));
      const container=bar.parentElement?.parentElement;
      const sizeLabel=size?" · "+formatDownloadSize(size):"";
      if(size>180*1024*1024){
        addReadyDownloadLink(container,downloadUrl.href,"",mode==="audio"?"⬇ Unduh audio langsung lewat Chrome":"⬇ Unduh video langsung lewat Chrome");
        bar.style.width="0%";bar.parentElement?.classList.remove("is-indeterminate");bar.parentElement?.setAttribute("aria-valuenow","0");
        progressText.textContent="File besar terdeteksi · "+formatDownloadSize(size);
        if(progressMeta)progressMeta.textContent="Untuk menghemat RAM HP, file di atas 180 MB dialihkan ke pengelola unduhan Chrome. Status transfer dapat dipantau di notifikasi Unduhan Chrome.";
        remember(url,filename,mode,quality);
        return filename;
      }
      progressText.textContent="Mengunduh "+(mode==="audio"?"audio":"video")+" terverifikasi…";
      if(progressMeta)progressMeta.textContent="0 MB"+(size?" / "+formatDownloadSize(size):"")+" · transfer baru dimulai, belum selesai.";
      const response=await fetch(downloadUrl.href,{cache:"no-store",credentials:"same-origin",signal:downloadTimeoutSignal(15*60*1000)});
      if(!response.ok)throw new Error((await response.clone().json().catch(()=>({}))).error||"Server unduhan menjawab HTTP "+response.status+".");
      browserMediaContentType(response,mode);
      if(response.headers.get("x-aryanzz-media-validation")!=="signature-ok")throw new Error("File tidak lolos pemeriksaan integritas ARYANZZ.");
      const responseSize=Number(response.headers.get("content-length"))||size;
      if(size&&responseSize&&size!==responseSize)throw new Error("Ukuran file berubah setelah pemeriksaan ("+formatDownloadSize(size)+" menjadi "+formatDownloadSize(responseSize)+"). Silakan ulangi agar tidak menyimpan file tidak utuh.");
      if(responseSize>180*1024*1024)throw new Error("File melebihi batas aman penyimpanan sementara browser HP.");
      if(!response.body)throw new Error("Browser tidak menerima aliran file media.");
      const reader=response.body.getReader(),chunks=[];let received=0,lastUi=0;
      try{
        while(true){
          const part=await readBrowserChunk(reader);
          if(part.done)break;
          received+=part.value.byteLength;
          if(received>180*1024*1024)throw new Error("File melebihi batas memori sementara 180 MB. Gunakan unduhan langsung Chrome.");
          chunks.push(part.value);
          const now=Date.now();
          if(now-lastUi>120||received===responseSize){
            lastUi=now;
            if(responseSize){
              const pct=Math.min(99,Math.floor(received/responseSize*100));
              bar.style.width=pct+"%";bar.parentElement?.classList.remove("is-indeterminate");bar.parentElement?.setAttribute("aria-valuenow",String(pct));
              progressText.textContent="Mengunduh "+(mode==="audio"?"audio":"video")+" · "+pct+"%";
              if(progressMeta)progressMeta.textContent=formatDownloadSize(received)+" / "+formatDownloadSize(responseSize)+" diterima.";
            }else{
              bar.parentElement?.classList.add("is-indeterminate");
              progressText.textContent="Mengunduh "+(mode==="audio"?"audio":"video")+" · "+formatDownloadSize(received);
              if(progressMeta)progressMeta.textContent=formatDownloadSize(received)+" diterima · ukuran total belum diberikan provider.";
            }
          }
        }
      }catch(error){await reader.cancel().catch(()=>{});throw error;}
      if(!received)throw new Error("Provider mengirim file kosong.");
      if(responseSize&&received!==responseSize)throw new Error("Transfer tidak lengkap: diterima "+formatDownloadSize(received)+" dari "+formatDownloadSize(responseSize)+". File tidak disimpan.");
      const blob=new Blob(chunks,{type:check.mimeType||selected.mimeType||"application/octet-stream"});
      if(blob.size!==received)throw new Error("Ukuran file hasil rakitan tidak cocok dengan data yang diterima.");
      if(mode==="video"&&["mp4","m4v","mov"].includes(check.extension)){
        progressText.textContent="Memeriksa struktur MP4 dan durasi video…";
        if(progressMeta)progressMeta.textContent="Memastikan kotak video, metadata durasi, dan data gambar/audio lengkap sebelum file disimpan.";
        const mp4Check=await inspectMp4Blob(blob,Number(info.duration)||Number(selected.duration)||0);
        if(progressMeta)progressMeta.textContent="Struktur MP4 lengkap"+(mp4Check.duration?" · durasi "+mp4Check.duration.toFixed(1)+" detik":"")+".";
      }
      await saveBrowserBlob(blob,filename,container,mode==="audio"?"⬇ Simpan audio sekarang":"⬇ Simpan video sekarang");
      bar.style.width="100%";bar.parentElement?.classList.remove("is-indeterminate");bar.parentElement?.setAttribute("aria-valuenow","100");
      progressText.textContent=(mode==="audio"?"Audio ":"Video ")+check.extension.toUpperCase()+" selesai · file utuh ✓";
      if(progressMeta)progressMeta.textContent=formatDownloadSize(received)+" berhasil diterima seluruhnya"+(sizeLabel?" dari "+sizeLabel.replace(/^ · /,""):"")+". Ketuk tombol simpan untuk menyimpan ke perangkat.";
      remember(url,filename,mode,quality);
      return filename;
    }
    const sourceExt=/^[a-z0-9]{2,8}$/i.test(info.extension||"")?info.extension.toLowerCase():"";
    const ext=sourceExt||(mode==="audio"?"mp3":"mp4");
    const filename=safeFilename(info.outputName||info.filename||info.title||("aryanzz-"+(mode==="audio"?"audio":"video-"+quality+"p")+"."+ext));
    const fileUrl="/api/direct-file?url="+encodeURIComponent(url);
    addReadyDownloadLink(bar.parentElement?.parentElement,fileUrl,filename,"⬇ Unduh file sekarang");
    bar.style.width="100%";bar.parentElement?.classList.remove("is-indeterminate");bar.parentElement?.setAttribute("aria-valuenow","100");
    progressText.textContent="Tautan file siap · "+filename;
    if(progressMeta)progressMeta.textContent="Persiapan 100% · ketuk tombol unduh di bawah. Chrome akan menangani transfer dan progres unduhan sesungguhnya.";
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
    box.append(make("span","v690-kicker",platformName(url).toUpperCase()));
    box.append(make("b","v690-title","Tautan "+platformName(url)+" terdeteksi"));
    box.append(make("p","muted","Untuk tautan sosial, buka postingan di platformnya. Salin tautan file media langsung jika tersedia."));
    const actions=make("div","v690-actions");
    const source=make("a","primary","Buka "+platformName(url)+" ↗");
    source.href=url.href;source.target="_blank";source.rel="noopener noreferrer";
    const copy=make("button","tag","Salin link");copy.type="button";
    copy.addEventListener("click",async()=>{
      try{
        if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(url.href);
        else{const area=make("textarea");area.value=url.href;area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();if(!document.execCommand("copy"))throw new Error("copy");area.remove();}
        copy.textContent="Link tersalin ✓";
      }catch{copy.textContent="Salin manual dari kolom URL";}
    });
    actions.append(source,copy);box.append(actions);
    if(error?.message)box.append(make("p","v690-debug",String(error.message).slice(0,180)));
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
    "https://yt.chocolatemoo53.com","https://inv.nadeko.net","https://invidious.nerdvpn.de","https://invidious.tiekoetter.com"
  ];
  async function currentInvidiousInstances(){
    const fallback=BROWSER_INVIDIOUS_INSTANCES.slice();
    try{
      const response=await fetch("https://api.invidious.io/instances.json?sort_by=type,health",{mode:"cors",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});
      if(!response.ok)return fallback;
      const rows=await response.json();
      if(!Array.isArray(rows))return fallback;
      const discovered=rows.map(row=>{
        const raw=Array.isArray(row)?row[0]:row?.uri;
        const meta=Array.isArray(row)?row[1]:row;
        try{
          const u=new URL(raw);
          if(u.protocol!=="https:"||u.username||u.password||u.port||meta?.api!==true||meta?.cors!==true||u.hostname.endsWith(".onion"))return null;
          return u.origin;
        }catch{return null;}
      }).filter(Boolean);
      return [...new Set([...discovered,...fallback])].slice(0,18);
    }catch{return fallback;}
  }
  const BROWSER_MEDIA_ROOTS=["kavin.rocks","leptons.xyz","nosebs.ru","privacy.com.de","adminforge.de","piped.yt","drgns.space","owo.si","ducks.party","codespace.cz","reallyaweso.me","private.coffee","darkness.services","orangenet.cc"];
  function browserProviderRoot(host){
    const labels=String(host||"").toLowerCase().split(".").filter(Boolean);
    if(labels.length<2)return labels.join(".");
    const lastTwo=labels.slice(-2).join(".");
    const compound=new Set(["com.de","co.uk","org.uk","com.au","net.au","co.nz","com.br","co.jp","com.sg"]);
    return compound.has(lastTwo)&&labels.length>=3?labels.slice(-3).join("."):lastTwo;
  }
  function browserHybridMediaUrl(raw,trustedOrigin){
    try{
      const u=new URL(raw,trustedOrigin||undefined);
      if(u.protocol!=="https:"||u.username||u.password)return null;
      const h=u.hostname.toLowerCase();
      if(h==="googlevideo.com"||h.endsWith(".googlevideo.com"))return u;
      if(BROWSER_MEDIA_ROOTS.some(root=>h===root||h.endsWith("."+root)))return u;
      if(trustedOrigin){
        const trusted=new URL(trustedOrigin);
        if(u.origin===trusted.origin)return u;
        const root=browserProviderRoot(trusted.hostname);
        if(root&&(h===root||h.endsWith("."+root)))return u;
      }
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
    return ({18:360,22:720,37:1080,59:480,78:480,82:360,83:480,84:720,85:1080,133:240,134:360,135:480,136:720,137:1080,160:144,264:1440,266:2160,298:720,299:1080})[itag]||0;
  }
  function browserFormatSizeBytes(item){
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
  function browserVideoFormat(item,providerInstance,progressiveSource=false,adaptiveSource=false){
    const mime=String(item?.mimeType||item?.type||item?.mime_type||item?.mime||"").toLowerCase();
    const container=String(item?.format||item?.container||item?.ext||"").toLowerCase();
    const url=browserHybridMediaUrl(item?.url||item?.urlTemplate||"",providerInstance);
    const height=browserVideoHeight(item,url);
    const itag=Number(url?.searchParams?.get("itag")||item?.itag);
    const mp4=mime.includes("video/mp4")||mime.includes("video/x-m4v")||container.includes("mpeg_4")||container==="mp4"||container==="m4v"||String(item?.ext||"").toLowerCase()==="mp4"||String(url?.searchParams?.get("mime")||"").toLowerCase().includes("video/mp4")||(/\.mp4(?:$|[?#])/i.test(url?.pathname||""))||(progressiveSource&&[18,22,37,59,78,82,83,84,85].includes(itag));
    const videoOnly=adaptiveSource||item?.videoOnly===true||item?.isVideoOnly===true||item?.video_only===true;
    if(!url||![144,240,360,480,720,1080,1440,2160].includes(height)||!mp4)return null;
    return {mode:"video",height,quality:height+"p",ext:"mp4",mimeType:"video/mp4",url:url.href,bitrate:Number(item.bitrate)||0,sizeBytes:browserFormatSizeBytes(item),progressive:!videoOnly,videoOnly};
  }
  function browserAudioFormat(item,providerInstance){
    const mime=String(item?.mimeType||item?.type||item?.mime_type||item?.mime||"").toLowerCase(),container=String(item?.format||item?.container||item?.ext||"").toLowerCase(),url=browserHybridMediaUrl(item?.url||"",providerInstance);
    if(!url||!(mime.startsWith("audio/")||["m4a","mp3","webm","opus","ogg"].includes(container)))return null;
    let ext=container==="mpeg"?"mp3":container==="mp4"?"m4a":container;
    if(!["m4a","mp3","webm","opus","ogg","wav","flac"].includes(ext)){if(mime.includes("audio/mp4"))ext="m4a";else if(mime.includes("audio/mpeg"))ext="mp3";else if(mime.includes("audio/webm"))ext="webm";else return null;}
    return {mode:"audio",height:0,quality:String(item.quality||item.audioQuality||item.bitrate||"Audio"),ext,mimeType:mime.split(";")[0],url:url.href,bitrate:Number(item.bitrate)||0,sizeBytes:browserFormatSizeBytes(item)};
  }
  function browserDedupeFormats(formats){
    const seen=new Set();return formats.filter(f=>{const key=f.mode+":"+f.height+":"+f.ext+":"+(f.videoOnly?"video-only":"muxed")+":"+(f.instance||"")+":"+f.url.split("?")[0];if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.mode===b.mode?(a.mode==="video"?a.height-b.height:b.bitrate-a.bitrate):a.mode==="video"?-1:1).map((f,i)=>({...f,id:"f"+i}));
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
      const hasUsableVideo=formats.some(item=>item.mode==="video"&&(!item.videoOnly||formats.some(audio=>audio.mode==="audio"&&audio.ext==="m4a")));
      if(!data.title||!hasUsableVideo)throw new Error("Instance Piped tidak menyediakan stream MP4 dan audio yang kompatibel");
      return {ok:true,providerReady:true,providerName:"Hybrid",provider:"Piped",instance,title:String(data.title).slice(0,300),thumbnail:typeof data.thumbnailUrl==="string"?data.thumbnailUrl:null,duration:Number(data.duration)||null,uploader:String(data.uploader||"").slice(0,160),formats,message:"Stream diperoleh langsung dari browser melalui instance komunitas."};
  }
  async function browserInvidiousInfo(instance,id,signal){
    const data=await browserProviderJson(instance+"/api/v1/videos/"+encodeURIComponent(id)+"?local=true",signal);
      const adaptive=Array.isArray(data.adaptiveFormats)?data.adaptiveFormats:Array.isArray(data.adaptive_formats)?data.adaptive_formats:[];
      const formats=browserDedupeFormats([...((Array.isArray(data.formatStreams)?data.formatStreams:Array.isArray(data.format_streams)?data.format_streams:[]).map(item=>browserVideoFormat(item,instance,true)).filter(Boolean)),...adaptive.map(item=>String(item?.type||item?.mimeType||"").toLowerCase().startsWith("video/")?browserVideoFormat(item,instance,true,true):browserAudioFormat(item,instance)).filter(Boolean)]);
      const rawVideo=Array.isArray(data.formatStreams)?data.formatStreams:Array.isArray(data.format_streams)?data.format_streams:[];
      const videoFormats=formats.filter(item=>item.mode==="video"&&item.ext==="mp4");
      const hasUsableVideo=videoFormats.some(item=>!item.videoOnly||formats.some(audio=>audio.mode==="audio"&&audio.ext==="m4a"));
      if(!data.title||!hasUsableVideo)throw new Error("Tidak menemukan pasangan stream MP4 dan audio di "+instance+" (formatStreams: "+rawVideo.length+", MP4 valid: "+videoFormats.length+").");
      const thumb=Array.isArray(data.videoThumbnails)?data.videoThumbnails.find(x=>x.quality==="maxresdefault")||data.videoThumbnails[0]:null;
      return {ok:true,providerReady:true,providerName:"Hybrid",provider:"Invidious",instance,title:String(data.title).slice(0,300),thumbnail:typeof thumb?.url==="string"?thumb.url:null,duration:Number(data.lengthSeconds)||null,uploader:String(data.author||"").slice(0,160),formats,message:"Stream diperoleh langsung dari browser melalui instance komunitas."};
  }
  async function browserHybridYoutubeInfo(raw){
    const match=(()=>{try{const u=new URL(raw);if(["youtu.be","www.youtu.be"].includes(u.hostname))return u.pathname.split("/").filter(Boolean)[0]||null;return u.searchParams.get("v")||u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,20})/)?.[1]||null;}catch{return null;}})();
    if(!match||! /^[A-Za-z0-9_-]{6,20}$/.test(match))throw new Error("ID video YouTube tidak valid.");
    const tryGroup=(provider,instances,fn)=>{
      const diagnostics=[];
      const controllers=instances.map(()=>browserProviderTimeout(5000));
      const promise=Promise.all(instances.map((instance,i)=>fn(instance,match,controllers[i].signal)
        .then(result=>({...result,instance:result.instance||instance,formats:(result.formats||[]).map(format=>({...format,instance:format.instance||instance,provider:format.provider||result.provider}))}))
        .catch(error=>{diagnostics.push({provider,instance,error:String(error?.message||"permintaan gagal").slice(0,150)});return null;})
        .finally(()=>controllers[i].clear())));
      return {promise,diagnostics,abort:()=>controllers.forEach(controller=>{controller.clear();controller.abort();})};
    };
    const [invidiousInstances,pipedInstances]=await Promise.all([currentInvidiousInstances(),currentPipedInstances()]);
    const available=[];
    const groups=[];
    const inv=invidiousInstances.slice(0,10),piped=pipedInstances.slice(0,20);
    if(inv.length)groups.push(tryGroup("Invidious",inv,browserInvidiousInfo));
    if(piped.length)groups.push(tryGroup("Piped",piped,browserPipedInfo));
    if(groups.length){
      const results=await Promise.all(groups.map(group=>group.promise));
      groups.forEach(group=>group.abort());
      available.push(...results.flat().filter(Boolean));
      // Provider errors are retained so the UI can show why every instance failed.
    }
    if(available.length){
      const primary=available.find(item=>item.provider==="Piped")||available[0];
      const formats=browserDedupeFormats(available.flatMap(result=>(result.formats||[]).map(format=>({...format,instance:format.instance||result.instance,provider:format.provider||result.provider}))));
      return {...primary,providerReady:true,formats,providers:available.map(item=>({provider:item.provider,instance:item.instance,formatCount:item.formats?.length||0})),diagnostics:groups.flatMap(group=>group.diagnostics).slice(0,12)};
    }
    const response=await fetch("/api/youtube/hybrid/info?url="+encodeURIComponent(raw),{cache:"no-store",signal:downloadTimeoutSignal(12000)});
    const fallback=await response.json().catch(()=>({}));
    if(response.ok&&fallback.providerReady)return fallback;
    try{
      const publicInfo=await postJson("/api/info",{url:raw});
      if(publicInfo.providerName==="Public API"&&publicInfo.providerReady)return publicInfo;
    }catch{}
    const diagnostics=[...groups.flatMap(group=>group.diagnostics),...(Array.isArray(fallback.diagnostics)?fallback.diagnostics:[])];
    const detail=diagnostics.slice(0,6).map(item=>{
      let host=String(item.instance||"");try{host=new URL(host).hostname}catch{}
      return (item.provider||"Provider")+" "+host+": "+(item.error||"gagal");
    }).join(" | ");
    throw new Error("MP4 belum tersedia dari provider gratis saat ini."+(detail?" Detail: "+detail:" Tidak ada instance yang mengirim format MP4 yang bisa digunakan.")+" Coba tautan lain nanti; bukan berarti tombol unduhnya rusak.");
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
      const detectedPlatform=platformName(url);
      const host=url.hostname.toLowerCase();
      const isYouTube=["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtu.be","www.youtu.be"].includes(host);
      const info=isYouTube
        ? await browserHybridYoutubeInfo(url.href)
        : await postJson("/api/info", {url:url.href});
      box.replaceChildren();
      const header = make("div", "youtube-heading");
      const details = make("div", "youtube-details");
      details.append(make("b", "youtube-title", info.title || info.filename || "Media siap diunduh"));
      details.append(make("small", "muted", [info.extractor || info.source || platformName(url), duration(info.duration), info.size ? (info.size / 1048576).toFixed(1) + " MB" : ""].filter(Boolean).join(" · ")));
      if(isYouTube&&info.thumbnail){
        try{
          const imageUrl=new URL(info.thumbnail);
          if(imageUrl.protocol==="https:"){
            const thumbAction=make("a","youtube-thumb-download","↓ Unduh thumbnail YouTube");
            thumbAction.href="/api/youtube/hybrid/thumbnail?url="+encodeURIComponent(imageUrl.href)+"&title="+encodeURIComponent(info.title||"aryanzz-thumbnail")+"&instance="+encodeURIComponent(info.instance||"");
            thumbAction.download=safeFilename((info.title||"aryanzz-thumbnail")+".jpg","aryanzz-thumbnail.jpg");
            thumbAction.rel="noopener";
            thumbAction.setAttribute("aria-label","Unduh gambar thumbnail YouTube");
            details.append(thumbAction);
          }
        }catch{}
      }
      header.append(details);
      box.append(header);
      if(isYouTube){
        const videoId=url.hostname.toLowerCase().includes("youtu.be")
          ?url.pathname.split("/").filter(Boolean)[0]||""
          :url.searchParams.get("v")||url.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)?.[1]||"";
        if(/^[A-Za-z0-9_-]{11}$/.test(videoId)){
          const previewWrap=make("div","youtube-embed-wrap");
          const frame=make("iframe","youtube-embed-frame");
          frame.src="https://www.youtube-nocookie.com/embed/"+videoId;
          frame.title="Pratinjau YouTube · "+(info.title||"video");
          frame.loading="lazy";frame.referrerPolicy="strict-origin-when-cross-origin";
          frame.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
          frame.allowFullscreen=true;
          previewWrap.append(frame);box.append(previewWrap);
        }
      }
      if(info.providerName==="Public API"){
        const previewFormat=(info.formats||[]).find(item=>item.mode==="video"&&item.url);
        if(previewFormat){
          const preview=make("video","v737-media-preview");
          const previewSource=safeUrl(previewFormat.previewUrl);
          if(!previewSource||previewSource.origin!==location.origin||previewSource.pathname!=="/api/social-file")throw new Error("Pratinjau media tidak melewati proxy ARYANZZ.");
          preview.src=previewSource.href;preview.controls=true;preview.playsInline=true;preview.preload="metadata";
          if(info.thumbnail)preview.poster=info.thumbnail;
          preview.setAttribute("aria-label","Pratinjau video "+(info.title||"media"));
          const previewStatus=make("small","muted","");
          preview.addEventListener("loadedmetadata",()=>{
            const actual=Number(preview.duration),expected=Number(info.duration)||0;
            if(expected>0&&Number.isFinite(actual)&&Math.abs(actual-expected)>Math.max(3,expected*0.12)){
              previewStatus.textContent="Peringatan: durasi stream "+actual.toFixed(1)+" detik berbeda dari sumber "+expected.toFixed(1)+" detik. Jangan simpan sebelum diperiksa.";
              previewStatus.className="warning";
            }else previewStatus.textContent="Pratinjau siap · "+(Number.isFinite(actual)?actual.toFixed(1)+" detik":"durasi belum tersedia");
          });
          preview.addEventListener("error",()=>{previewStatus.textContent="Pratinjau gagal diputar. Periksa kembali sumber atau format codec video.";previewStatus.className="warning"});
          box.append(preview,previewStatus);
        }else{
          const audioPreview=(info.formats||[]).find(item=>item.mode==="audio"&&item.url);
          if(audioPreview?.previewUrl){const preview=make("audio","v737-audio-preview");preview.src=audioPreview.previewUrl;preview.controls=true;preview.preload="metadata";box.append(preview)}
        }
      }
      if(isYouTube){
        const providerNote=make("p",info.providerReady?"youtube-provider-state":"youtube-provider-state is-offline",info.providerReady?"Sumber tersedia":info.providerMessage||"Sumber sedang sibuk.");
        box.append(providerNote);
      }

      const formatLabel = make("label", "label", "FORMAT");
      const mode = make("select", "field");
      mode.id = "aryMode";
      [["video",isYouTube?"Video MP4":"Video"],["audio",isYouTube?"Audio saja":"Audio MP3 / M4A"]].forEach(([value,label]) => {
        const option = make("option", "", label);
        option.value = value;
        mode.append(option);
      });
      if (info.type === "audio") mode.value = "audio";
      if(info.providerName==="Hybrid"||info.providerName==="Public API"){
        const videoOption=mode.querySelector('option[value="video"]');
        const audioOption=mode.querySelector('option[value="audio"]');
        const hasVideo=(info.formats||[]).some(item=>item.mode==="video");
        const hasAudio=(info.formats||[]).some(item=>item.mode==="audio");
        if(videoOption)videoOption.disabled=!hasVideo;
        if(audioOption)audioOption.disabled=!hasAudio;
        if(!hasVideo&&hasAudio)mode.value="audio";
      }
      const qualityLabel = make("label", "label", "KUALITAS");
      qualityLabel.style.marginTop = "12px";
      const quality = make("select", "field");
      quality.id = "aryQuality";
      const qualityHint=make("p","youtube-quality-hint","");
      const outputNameLabel=make("label","label","NAMA FILE HASIL");
      outputNameLabel.style.marginTop="12px";
      const outputName=make("input","field");outputName.id="aryOutputName";outputName.type="text";outputName.maxLength=90;outputName.value=info.title||"aryanzz-media";outputName.autocomplete="off";outputName.placeholder="Nama file MP4 / MP3";
      const outputNameHint=make("small","muted","Nama ini hanya mengubah file yang disimpan di perangkat. Judul, deskripsi, dan tag YouTube tetap diatur saat mengunggah video.");
      const directMedia=!!info.extension&&!info.extractor;
      const heights = Array.isArray(info.formats)
        ? [...new Set(info.formats.map(item => Number(typeof item === "number" ? item : item.height)).filter(n => Number.isFinite(n)&&n>=100&&n<=4320))].sort((a,b) => a-b)
        : [];
      const progressiveHeights=[...new Set((info.formats||[]).filter(item=>item.mode==="video"&&item.ext==="mp4"&&!item.videoOnly&&Number(item.height)>0).map(item=>Number(item.height)))].sort((a,b)=>a-b);
      const adaptiveHeights=[...new Set((info.formats||[]).filter(item=>item.mode==="video"&&item.ext==="mp4"&&item.videoOnly&&Number(item.height)>0).map(item=>Number(item.height)))].sort((a,b)=>a-b);
      if(directMedia){
        const sourceOption=make("option","","Original · file sumber");sourceOption.value="0";quality.append(sourceOption);quality.disabled=true;
        qualityLabel.textContent="KUALITAS SUMBER";
        const audioOption=mode.querySelector('option[value="audio"]'),videoOption=mode.querySelector('option[value="video"]');
        if(info.type==="audio"){mode.value="audio";if(videoOption)videoOption.disabled=true}
        else{mode.value="video";if(audioOption)audioOption.disabled=true}
        mode.disabled=true;
      }else{
        const available = heights.length ? heights : (isYouTube?[]:(info.providerName==="Public API"?[]:[360,480,720,1080,1440,2160]));
        const quickPool=progressiveHeights.length?progressiveHeights:(adaptiveHeights.length?adaptiveHeights:available);
        const quickHeight=quickPool.filter(height=>height<=480).sort((a,b)=>b-a)[0]||quickPool.filter(height=>height<=720).sort((a,b)=>b-a)[0]||quickPool.slice().sort((a,b)=>a-b)[0];
        if(info.providerName==="Public API"&&!heights.length){
          const original=make("option","","Kualitas asli · sumber");
          original.value="0";original.selected=true;quality.append(original);quality.disabled=true;qualityLabel.textContent="KUALITAS SUMBER";
        }else{
          const qualityOptions=isYouTube
            ?FORMATS.video.filter(item=>available.includes(Number(item[0]))).map(([value,label])=>[Number(value),label])
            :available.map(value=>[value,value+"p · tersedia"]);
          qualityOptions.forEach(([value,label]) => {
            const option = make("option", "", label);
            option.value = String(value);
            if (Number(value) === quickHeight) option.selected = true;
            if(isYouTube){
              const estimate=youtubeQualityEstimate(info,Number(value));
              const route=estimate?.kind==="direct"?" · MP4 langsung":" · gabung otomatis";
              const size=estimate?.bytes?" · "+(estimate.exact?"":"±")+formatDownloadSize(estimate.bytes):"";
              option.textContent=label+route+size;
            }
            quality.append(option);
          });
        }
      }
      const updateQualityHint=()=>{
        const height=Number(quality.value)||0,estimate=youtubeQualityEstimate(info,height);
        qualityHint.hidden=mode.value==="audio"||(!isYouTube&&!(info.providerName==="Public API"&&heights.length));
        if(qualityHint.hidden)return;
        if(!isYouTube){qualityHint.textContent="Pilihan kualitas diambil dari format yang benar-benar dikirim provider. Jika kualitas tertentu tidak tersedia, pilih resolusi terdekat.";return;}
        if(!estimate){qualityHint.textContent="Ukuran belum diberikan provider; ukuran asli akan terbaca saat stream diperiksa.";return;}
        const size=estimate.bytes?(estimate.exact?"Ukuran sumber: ":"Perkiraan ukuran: ±")+formatDownloadSize(estimate.bytes)+". ":"";
        qualityHint.textContent=estimate.kind==="direct"?"MP4 langsung · "+size:"Gabung video + audio otomatis · "+size;
      };
      const speedLabel=make("label","label","KECEPATAN");
      speedLabel.style.marginTop="12px";
      const speedSelect=make("select","field");
      speedSelect.id="aryDownloadSpeed";
      [[1,"Normal · 1 jalur"],[3,"Cepat · 3 jalur"],[5,"Maksimal · 5 jalur"]].forEach(([value,label])=>{const option=make("option","",label);option.value=String(value);if(value===3)option.selected=true;speedSelect.append(option)});
      speedLabel.hidden=!isYouTube||info.providerName==="Public API";speedSelect.hidden=speedLabel.hidden;
      const audioHint = make("p", "muted", directMedia?(info.type==="audio"?"File audio langsung diunduh melalui Chrome; pengelola unduhan browser menangani kecepatan dan percobaan ulang.":"File video langsung diunduh melalui Chrome; sumber yang mendukung Range dapat dilanjutkan oleh pengelola unduhan."):isYouTube?(info.providerReady?(progressiveHeights.length?"MP4 langsung diprioritaskan. Chrome mengelola unduhan di latar belakang; mode kecepatan berlaku pada stream terpisah yang mendukung Range.":"Sumber memisahkan video dan suara; ARYANZZ merakitnya menjadi satu MP4. Potongan 1 MB disimpan lokal. Jika halaman tertutup, buka link yang sama, periksa lagi, lalu tekan Unduh untuk melanjutkan. Tab harus tetap terbuka saat tahap perakitan MP4. Mode kecepatan memakai 1, 3, atau 5 jalur bila server mendukung Range."):"Provider belum menyediakan stream saat ini; coba lagi nanti."):"Tautan platform perlu provider yang mendukung ekstraksi. Tautan file langsung memakai pengelola unduhan Chrome.");
      const note = make("p", "youtube-note", "Hanya unduh konten milikmu atau yang diizinkan.");
      audioHint.hidden=true;
      box.append(formatLabel, mode, qualityLabel, quality, qualityHint, outputNameLabel, outputName, outputNameHint, speedLabel, speedSelect, note);
      outputName.addEventListener("input",()=>{info.outputName=outputName.value.trim().slice(0,90);});
      info.outputName=outputName.value.trim();

      const progress = make("div", "progress-track is-idle");
      progress.setAttribute("role","progressbar");
      progress.setAttribute("aria-label",isYouTube?"Progres unduhan dan penggabungan":"Kesiapan tautan unduhan");
      progress.setAttribute("aria-valuemin","0");
      progress.setAttribute("aria-valuemax","100");
      progress.setAttribute("aria-valuenow","0");
      const bar = make("div", "progress-fill");
      bar.style.width = "0%";
      progress.append(bar);
      const progressText = make("p", "muted", "Siap. Tekan Unduh untuk memulai satu file hasil.");
      const progressMeta = make("small","download-progress-meta","Siap diunduh.");
      const audioFormat=make("select","field");
      audioFormat.id="aryAudioFormat";
      const audioChoices=(info.providerName==="Hybrid"||info.providerName==="Public API")?[...new Set((info.formats||[]).filter(item=>item.mode==="audio").map(item=>item.ext))].map(ext=>[ext,ext.toUpperCase()]):[["mp3","MP3"],["m4a","M4A"]];
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
      const start = make("button", "primary youtube-start", isYouTube&&!info.providerReady?"Sumber belum tersedia":"⬇ Siapkan unduhan");
      start.type = "button";
      const cancel=make("button","tag youtube-cancel","Batalkan");cancel.type="button";cancel.hidden=true;
      const canStart=!isYouTube||!!info.providerReady;
      start.disabled=!canStart;
      if(!canStart)start.title="Semua instance komunitas sedang tidak tersedia. Coba lagi nanti.";
      const fav = make("button", "tag youtube-favorite", "♡ Favorit");
      fav.type = "button";
      fav.addEventListener("click", () => favorite(url.href, info.title || url.href, fav));
      actions.append(start, cancel, fav);
      const engineStatus=make("small","youtube-engine-status","");engineStatus.hidden=true;
      box.append(progress, progressText, progressMeta, engineStatus, actions);
      cancel.addEventListener("click",()=>{
        if(activeDownloadController&&!activeDownloadController.signal.aborted)activeDownloadController.abort();
        if(activeDownloadFfmpeg){try{activeDownloadFfmpeg.terminate()}catch{}activeDownloadFfmpeg=null;aryanzzFfmpegPromise=null;}
        cancel.disabled=true;cancel.textContent="Membatalkan…";
      });
      mode.addEventListener("change", () => {
        quality.disabled = mode.value === "audio"||directMedia;
        qualityLabel.style.opacity = mode.value === "audio" ? ".45" : "1";
        audioFormat.hidden=mode.value!=="audio"||directMedia||audioChoices.length===0;
        audioLabel.hidden=audioFormat.hidden;
        audioBitrate.hidden=true;
        bitrateLabel.hidden=true;
        start.textContent=mode.value==="audio"?"Unduh Audio":"Unduh MP4";
        speedLabel.hidden=!isYouTube||mode.value==="audio"||info.providerName==="Public API";speedSelect.hidden=speedLabel.hidden;
        updateQualityHint();
        progressMeta.textContent=mode.value==="audio"?"Target: 1 file audio · estimasi muncul setelah ukuran sumber terbaca.":"Target: 1 file MP4 · estimasi muncul setelah ukuran sumber terbaca.";
      });
      quality.addEventListener("change",updateQualityHint);
      mode.dispatchEvent(new Event("change"));
      start.addEventListener("click", async () => {
        const runController=new AbortController();activeDownloadController=runController;activeDownloadFfmpeg=null;
        cancel.hidden=false;cancel.disabled=false;cancel.textContent="Batalkan";
        start.disabled = true;
        mode.disabled = true;
        quality.disabled = true;
        start.textContent = "Memproses…";
        progress.classList.remove("is-idle");
        progress.classList.add("is-indeterminate");
        progress.classList.remove("is-failed");
        bar.style.width="0%";
        progress.setAttribute("aria-valuenow","0");
        progressText.textContent="Memeriksa stream dan menyiapkan unduhan…";
        const speedName=({1:"Speed",3:"Max Speed",5:"Mega Speed"})[Number(speedSelect.value)]||"Max Speed";
        progressMeta.textContent="Target: "+(mode.value==="audio"?"1 file audio":"1 file MP4")+" · "+(isYouTube&&mode.value==="video"?speedName+" · "+speedSelect.value+" jalur paralel bila didukung sumber.":"Chrome mengelola kecepatan unduhan.");
        try {
          const downloadInfo={...info,outputName:safeFilename(outputName.value||info.title||"aryanzz-media")};
          const filename = isYouTube&&downloadInfo.providerName!=="Public API" ? await downloadYouTube(url.href,mode.value,Number(quality.value)||480,bar,progressText,progressMeta,downloadInfo,audioFormat.value,Number(speedSelect.value)||3) : await downloadFile(url.href, mode.value, Number(quality.value) || 0, bar, progressText, downloadInfo, audioFormat.value,progressMeta);
          start.textContent = "File siap ✓";start.disabled=true;
        } catch (error) {
          progress.classList.remove("is-indeterminate");progress.classList.add("is-failed");
          bar.style.width="0%";progress.setAttribute("aria-valuenow","0");
          const cancelled=runController.signal.aborted||/dibatalkan/i.test(String(error.message||error));
          status(progressText,cancelled?"Unduhan dibatalkan.":error.message||"Unduhan gagal.",!cancelled);
          progressMeta.textContent=cancelled?"Proses dihentikan. Kamu bisa mulai lagi.":"Belum ada file siap. Coba kualitas lain atau ulangi nanti.";
          start.disabled=false;mode.disabled=false;quality.disabled=mode.value==="audio"||directMedia;audioBitrate.disabled=false;speedSelect.disabled=false;start.textContent="Coba lagi";
        } finally {
          if(activeDownloadController===runController)activeDownloadController=null;
          activeDownloadFfmpeg=null;cancel.hidden=true;cancel.disabled=false;cancel.textContent="Batalkan";
        }
      });
    } catch (error) {
      showError(out,error,url.href);
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
        node.textContent="Gratis · YouTube + provider sosial publik · MP4/MP3 jika tersedia.";
        return;
      }
      if(!health.platformExtraction){
        node.dataset.state="warn";
        node.textContent="Mode gratis · file langsung dan provider komunitas tersedia sesuai dukungan platform.";
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
      node.textContent="Gratis · file langsung lewat Chrome · tautan sosial lewat platform.";
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