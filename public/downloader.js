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
  function formatDownloadSize(bytes){
    const value=Number(bytes)||0;
    if(value<1024*1024)return (value/1024).toFixed(0)+" KB";
    return (value/1048576).toFixed(1)+" MB";
  }
  function formatDownloadEta(seconds){
    if(!Number.isFinite(seconds)||seconds<0)return "menghitung…";
    const value=Math.ceil(seconds),minutes=Math.floor(value/60),remaining=value%60;
    return minutes?minutes+" m "+String(remaining).padStart(2,"0")+" d":remaining+" d";
  }
  function updateDownloadProgress(bar,progressText,progressMeta,options={}){
    const {stage="Mengunduh",received=0,total=0,startedAt=Date.now(),base=0,span=95,target="1 file MP4",indeterminate=false}=options;
    const track=bar?.parentElement,known=Number(total)>0,elapsed=Math.max(.5,(Date.now()-startedAt)/1000),speed=received/elapsed;
    if(track){
      if(known&&!indeterminate){
        const local=Math.min(1,received/total),overall=Math.min(99,base+local*span);
        track.classList.remove("is-indeterminate");
        bar.style.width=overall.toFixed(1)+"%";
        track.setAttribute("aria-valuenow",String(Math.round(overall)));
      }else{
        track.classList.add("is-indeterminate");
        bar.style.width="34%";
      }
    }
    const localPercent=known?Math.min(100,Math.round(received/total*100)):null;
    progressText.textContent=stage+(localPercent===null?"":" · "+localPercent+"%")+" · "+formatDownloadSize(received)+(known?" / "+formatDownloadSize(total):"");
    const eta=known&&speed>0?(total-received)/speed:null;
    progressMeta.textContent="Target: "+target+" · "+(speed>0?formatDownloadSize(speed)+"/detik":"mengukur kecepatan")+(eta===null?" · estimasi tahap menunggu ukuran sumber":" · sisa tahap ±"+formatDownloadEta(eta));
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

  let aryanzzFfmpegPromise=null;
  async function loadBrowserFfmpeg(progressText,progressMeta,bar){
    if(aryanzzFfmpegPromise){
      progressText.textContent="Mesin MP4 sudah siap · melanjutkan penggabungan…";
      return aryanzzFfmpegPromise;
    }
    progressText.textContent="Menyiapkan mesin MP4 (sekali pada perangkat ini)…";
    progressMeta.textContent="Target: 1 file MP4 · menyiapkan komponen lokal, ukuran sekitar 30 MB.";
    bar.parentElement?.classList.add("is-indeterminate");
    aryanzzFfmpegPromise=(async()=>{
      const moduleUrl="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
      const coreBase="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      const loadBlob=async(url,type)=>{
        const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"force-cache"});
        if(!response.ok)throw new Error("CDN FFmpeg HTTP "+response.status);
        return URL.createObjectURL(new Blob([await response.arrayBuffer()],{type}));
      };
      let coreURL,wasmURL;
      try{
        const mod=await import(moduleUrl);
        const ffmpeg=new mod.FFmpeg();
        [coreURL,wasmURL]=await Promise.all([loadBlob(coreBase+"/ffmpeg-core.js","text/javascript"),loadBlob(coreBase+"/ffmpeg-core.wasm","application/wasm")]);
        await ffmpeg.load({coreURL,wasmURL,classWorkerURL:new URL("/ffmpeg-worker-bootstrap.js?v=72.4",location.origin).href});
        return ffmpeg;
      }finally{
        if(coreURL)URL.revokeObjectURL(coreURL);
        if(wasmURL)URL.revokeObjectURL(wasmURL);
      }
    })().catch(error=>{aryanzzFfmpegPromise=null;throw error;});
    return aryanzzFfmpegPromise;
  }
  async function fetchYoutubeTrack(item,info,maxBytes,bar,progressText,progressMeta,label,base,span){
    const direct=browserHybridMediaUrl(item.url,item.instance||info.instance);
    if(!direct)throw new Error("Alamat stream "+label+" tidak lolos pemeriksaan keamanan.");
    let response,browserError;
    try{
      response=await fetch(direct.href,{mode:"cors",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw new Error("HTTP "+response.status);
    }catch(error){
      browserError=error;
      const target="/api/youtube/hybrid/file?url="+encodeURIComponent(direct.href)+"&ext="+encodeURIComponent(item.ext)+"&title="+encodeURIComponent((info.title||"youtube")+"-"+label)+"&instance="+encodeURIComponent(item.instance||info.instance||"");
      response=await fetch(target,{cache:"no-store",signal:AbortSignal.timeout(120000)});
      if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(label+" tidak bisa diambil: "+(detail.error||browserError.message||"CORS"));}
    }
    const type=String(response.headers.get("content-type")||"").toLowerCase();
    if(type.includes("text/html")||type.includes("application/json")||type.includes("text/plain"))throw new Error("Provider mengirim halaman error untuk "+label+".");
    const total=Number(response.headers.get("content-length")||0),reader=response.body?.getReader();
    if(total>maxBytes)throw new Error(label+" melebihi batas memori HP. Pilih kualitas lebih rendah.");
    if(!reader)throw new Error("Browser tidak bisa membaca "+label+".");
    const chunks=[],startedAt=Date.now();let received=0;
    while(true){
      const part=await reader.read();if(part.done)break;
      received+=part.value.byteLength;
      if(received>maxBytes){await reader.cancel();throw new Error(label+" melebihi batas memori HP. Pilih kualitas lebih rendah.");}
      chunks.push(part.value);
      updateDownloadProgress(bar,progressText,progressMeta,{stage:label,received,total,startedAt,base,span,target:"1 file MP4"});
    }
    if(!received)throw new Error("Komponen media kosong.");
    const bytes=new Uint8Array(received);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return bytes;
  }
  async function muxYoutubeMp4(videoItem,audioItem,info,bar,progressText,progressMeta){
    const maxTrack=110*1024*1024,maxCombined=180*1024*1024;
    progressText.textContent="Menyusun satu file MP4 · mengambil komponen 1/2…";
    progressMeta.textContent="Target: 1 file MP4 · komponen diproses otomatis, tidak ada file audio terpisah.";
    const videoBytes=await fetchYoutubeTrack(videoItem,info,maxTrack,bar,progressText,progressMeta,"Komponen MP4 1/2",0,38);
    const audioBytes=await fetchYoutubeTrack(audioItem,info,maxTrack,bar,progressText,progressMeta,"Komponen MP4 2/2",38,38);
    if(videoBytes.byteLength+audioBytes.byteLength>maxCombined)throw new Error("Ukuran gabungan terlalu besar untuk memori HP. Pilih kualitas lebih rendah.");
    const ffmpeg=await loadBrowserFfmpeg(progressText,progressMeta,bar);
    const inputVideo="aryanzz-video.mp4",inputAudio="aryanzz-audio.m4a",output="aryanzz-output.mp4";
    try{
      await ffmpeg.writeFile(inputVideo,videoBytes);
      await ffmpeg.writeFile(inputAudio,audioBytes);
      const track=bar.parentElement;
      track?.classList.add("is-indeterminate");
      progressText.textContent="Tahap akhir · merakit satu file MP4 di perangkat…";
      progressMeta.textContent="Target: 1 file MP4 · penggabungan lokal, jangan tutup Chrome.";
      const onProgress=event=>{
        const value=Number(event?.progress);
        if(!Number.isFinite(value))return;
        const pct=Math.max(0,Math.min(1,value));
        track?.classList.remove("is-indeterminate");
        bar.style.width=(78+pct*20).toFixed(1)+"%";
        track?.setAttribute("aria-valuenow",String(Math.round(78+pct*20)));
        progressText.textContent="Merakit MP4 · "+Math.round(pct*100)+"%";
        progressMeta.textContent="Target: 1 file MP4 · tahap final";
      };
      ffmpeg.on?.("progress",onProgress);
      let code;
      try{
        code=await ffmpeg.exec(["-i",inputVideo,"-i",inputAudio,"-map","0:v:0","-map","1:a:0","-c","copy","-movflags","+faststart","-shortest",output],120000);
      }finally{ffmpeg.off?.("progress",onProgress);}
      if(code!==0)throw new Error("Mesin MP4 tidak dapat menyatukan format sumber (kode "+code+").");
      const result=await ffmpeg.readFile(output);
      if(!result||result.length<1024)throw new Error("Hasil MP4 kosong atau tidak lengkap.");
      const blob=new Blob([result],{type:"video/mp4"}),filename=safeFilename((info.title||"aryanzz-youtube")+".mp4");
      progressText.textContent="Menyiapkan hasil MP4 untuk Chrome…";
      progressMeta.textContent="Target: 1 file MP4 · menyimpan hasil akhir.";
      await saveBrowserBlob(blob,filename);
      track?.classList.remove("is-indeterminate");
      bar.style.width="100%";track?.setAttribute("aria-valuenow","100");
      progressText.textContent="MP4 siap · "+formatDownloadSize(blob.size)+" · dikirim ke unduhan Chrome.";
      progressMeta.textContent="Selesai diproses · 1 file MP4. Chrome akan mengelola penyimpanan.";
      remember(info.url||"",filename,"video",videoItem.height);
      return filename;
    }finally{
      for(const name of [inputVideo,inputAudio,output])try{await ffmpeg.deleteFile(name)}catch{}
    }
  }
  async function downloadYoutubeProgressiveCandidate(url,mode,selected,info,bar,progressText,progressMeta,quality){
    const filename=safeFilename((info.title||"aryanzz-youtube")+"."+selected.ext);
    const instance=selected.instance||info.instance;
    const direct=browserHybridMediaUrl(selected.url,instance);
    if(!direct)throw new Error("Alamat stream tidak lolos pemeriksaan keamanan.");
    let browserError;
    const targetName=mode==="video"?"1 file MP4":"1 file audio";
    const consume=async response=>{
      browserMediaContentType(response,mode);
      const total=Number(response.headers.get("content-length")||0),maxBytes=250*1024*1024;
      if(total>maxBytes)throw new Error("File lebih dari 250 MB; pilih kualitas lebih rendah.");
      const reader=response.body?.getReader();
      if(!reader)throw new Error("Browser tidak menyediakan stream pembacaan file.");
      const chunks=[],startedAt=Date.now();let received=0;
      while(true){
        const part=await reader.read();if(part.done)break;
        received+=part.value.byteLength;
        if(received>maxBytes){await reader.cancel();throw new Error("File melebihi batas 250 MB untuk unduhan langsung di browser.");}
        chunks.push(part.value);
        updateDownloadProgress(bar,progressText,progressMeta,{stage:"Mengunduh "+(mode==="video"?"MP4":"audio"),received,total,startedAt,base:0,span:96,target:targetName});
      }
      if(!received)throw new Error("Stream media kosong.");
      return new Blob(chunks,{type:selected.mimeType||(mode==="video"?"video/mp4":"audio/mp4")});
    };
    try{
      const response=await fetch(direct.href,{mode:"cors",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const blob=await consume(response);
      progressText.textContent="Menyiapkan file untuk unduhan Chrome…";
      progressMeta.textContent="Target: "+targetName+" · menyimpan hasil.";
      await saveBrowserBlob(blob,filename);
      bar.parentElement?.classList.remove("is-indeterminate");
      bar.style.width="100%";bar.parentElement?.setAttribute("aria-valuenow","100");
      progressText.textContent=(mode==="video"?"MP4":"Audio")+" siap · "+formatDownloadSize(blob.size)+" · dikirim ke Chrome.";
      progressMeta.textContent="Selesai diproses · "+targetName+". Chrome mengelola penyimpanan.";
      remember(url,filename,mode,quality);return filename;
    }catch(error){browserError=error;}
    const target="/api/youtube/hybrid/file?url="+encodeURIComponent(direct.href)+"&ext="+encodeURIComponent(selected.ext)+"&title="+encodeURIComponent(info.title||"aryanzz-youtube")+"&instance="+encodeURIComponent(instance||"");
    const fallback=await fetch(target,{cache:"no-store",signal:AbortSignal.timeout(120000)});
    if(!fallback.ok){const detail=await fallback.json().catch(()=>({}));throw new Error("Browser: "+String(browserError.message||"CORS")+". Worker: "+String(detail.error||("HTTP "+fallback.status)));}
    const blob=await consume(fallback);
    progressText.textContent="Menyiapkan file untuk unduhan Chrome…";
    progressMeta.textContent="Target: "+targetName+" · menyimpan hasil.";
    await saveBrowserBlob(blob,filename);
    bar.parentElement?.classList.remove("is-indeterminate");
    bar.style.width="100%";bar.parentElement?.setAttribute("aria-valuenow","100");
    progressText.textContent=(mode==="video"?"MP4":"Audio")+" siap · "+formatDownloadSize(blob.size)+" · dikirim ke Chrome.";
    progressMeta.textContent="Selesai diproses · "+targetName+". Chrome mengelola penyimpanan.";
    remember(url,filename,mode,quality);return filename;
  }
  async function downloadYouTube(url,mode,quality,bar,progressText,progressMeta,info={},audioFormat="m4a"){
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
      const exactProgressive=progressive.filter(item=>Number(item.height)===wanted);
      const exactAdaptive=adaptive.filter(item=>Number(item.height)===wanted);
      if(exactProgressive.length){
        candidates=exactProgressive.sort((a,b)=>Number(b.bitrate)-Number(a.bitrate));
      }else if(exactAdaptive.length){
        candidates=exactAdaptive.sort((a,b)=>Number(b.bitrate)-Number(a.bitrate));
      }else if(progressive.length){
        candidates=orderByRequestedQuality(progressive);
      }else{
        candidates=orderByRequestedQuality(adaptive);
      }
      if(candidates[0]?.videoOnly){
        progressText.textContent="Sumber memisahkan komponen media · merakit satu file MP4 otomatis.";
        progressMeta.textContent="Target: 1 file MP4 · tidak ada file audio terpisah yang disimpan.";
      }else{
        const best=Number(candidates[0]?.height)||0;
        progressText.textContent="Mode cepat · satu stream MP4 lengkap diprioritaskan"+(best&&best<wanted?" · kualitas tersedia "+best+"p.":".");
        progressMeta.textContent="Target: 1 file MP4 · tanpa penggabungan tambahan.";
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
          return await muxYoutubeMp4(selected,audioItem,{...info,url},bar,progressText,progressMeta);
        }
        return await downloadYoutubeProgressiveCandidate(url,mode,selected,info,bar,progressText,progressMeta,quality);
      }catch(error){
        failures.push((selected.provider||"provider")+" "+(instance||"")+": "+String(error.message||error).slice(0,160));
      }
    }
    throw new Error("Semua jalur MP4 yang tersedia gagal. "+(failures[0]||"Coba kualitas lebih rendah atau ulangi nanti."));
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
      return [...new Set([...fallback,...discovered])].slice(0,18);
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
  function browserVideoFormat(item,providerInstance,progressiveSource=false,adaptiveSource=false){
    const mime=String(item?.mimeType||item?.type||item?.mime_type||item?.mime||"").toLowerCase();
    const container=String(item?.format||item?.container||item?.ext||"").toLowerCase();
    const url=browserHybridMediaUrl(item?.url||item?.urlTemplate||"",providerInstance);
    const height=browserVideoHeight(item,url);
    const itag=Number(url?.searchParams?.get("itag")||item?.itag);
    const mp4=mime.includes("video/mp4")||mime.includes("video/x-m4v")||container.includes("mpeg_4")||container==="mp4"||container==="m4v"||String(item?.ext||"").toLowerCase()==="mp4"||String(url?.searchParams?.get("mime")||"").toLowerCase().includes("video/mp4")||(/\.mp4(?:$|[?#])/i.test(url?.pathname||""))||(progressiveSource&&[18,22,37,59,78,82,83,84,85].includes(itag));
    const videoOnly=adaptiveSource||item?.videoOnly===true||item?.isVideoOnly===true||item?.video_only===true;
    if(!url||![144,240,360,480,720,1080,1440,2160].includes(height)||!mp4)return null;
    return {mode:"video",height,quality:height+"p",ext:"mp4",mimeType:"video/mp4",url:url.href,bitrate:Number(item.bitrate)||0,progressive:!videoOnly,videoOnly};
  }
  function browserAudioFormat(item,providerInstance){
    const mime=String(item?.mimeType||item?.type||item?.mime_type||item?.mime||"").toLowerCase(),container=String(item?.format||item?.container||item?.ext||"").toLowerCase(),url=browserHybridMediaUrl(item?.url||"",providerInstance);
    if(!url||!(mime.startsWith("audio/")||["m4a","mp3","webm","opus","ogg"].includes(container)))return null;
    let ext=container==="mpeg"?"mp3":container==="mp4"?"m4a":container;
    if(!["m4a","mp3","webm","opus","ogg","wav","flac"].includes(ext)){if(mime.includes("audio/mp4"))ext="m4a";else if(mime.includes("audio/mpeg"))ext="mp3";else if(mime.includes("audio/webm"))ext="webm";else return null;}
    return {mode:"audio",height:0,quality:String(item.quality||item.audioQuality||item.bitrate||"Audio"),ext,mimeType:mime.split(";")[0],url:url.href,bitrate:Number(item.bitrate)||0};
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
    const data=await browserProviderJson(instance+"/api/v1/videos/"+encodeURIComponent(id),signal);
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
    const tryGroup=(instances,fn)=>{
      const controllers=instances.map(()=>browserProviderTimeout(5000));
      const promise=Promise.all(instances.map((instance,i)=>fn(instance,match,controllers[i].signal)
        .then(result=>({...result,instance:result.instance||instance,formats:(result.formats||[]).map(format=>({...format,instance:format.instance||instance,provider:format.provider||result.provider}))}))
        .catch(()=>null).finally(()=>controllers[i].clear())));
      return {promise,abort:()=>controllers.forEach(controller=>{controller.clear();controller.abort();})};
    };
    const [invidiousInstances,pipedInstances]=await Promise.all([currentInvidiousInstances(),currentPipedInstances()]);
    const available=[];
    const groups=[];
    const inv=invidiousInstances.slice(0,5),piped=pipedInstances.slice(0,5);
    if(inv.length)groups.push(tryGroup(inv,browserInvidiousInfo));
    if(piped.length)groups.push(tryGroup(piped,browserPipedInfo));
    if(groups.length){
      const results=await Promise.all(groups.map(group=>group.promise));
      groups.forEach(group=>group.abort());
      available.push(...results.flat().filter(Boolean));
      // Only the first five instances per provider are checked for a fast first result.
    }
    if(available.length){
      const primary=available.find(item=>item.provider==="Piped")||available[0];
      const formats=browserDedupeFormats(available.flatMap(result=>(result.formats||[]).map(format=>({...format,instance:format.instance||result.instance,provider:format.provider||result.provider}))));
      return {...primary,providerReady:true,formats,providers:available.map(item=>({provider:item.provider,instance:item.instance,formatCount:item.formats?.length||0}))};
    }
    const response=await fetch("/api/youtube/hybrid/info?url="+encodeURIComponent(raw),{cache:"no-store",signal:AbortSignal.timeout(12000)});
    const fallback=await response.json().catch(()=>({}));
    if(response.ok&&fallback.providerReady)return fallback;
    throw new Error("MP4 belum tersedia saat ini. Instance komunitas tidak mengirim stream yang dapat digunakan. Ini bukan kesalahan link; coba lagi nanti.");
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
      if(info.thumbnail){
        const thumbAction=make("button","tag","↓ Unduh thumbnail");thumbAction.type="button";
        thumbAction.addEventListener("click",async()=>{
          const safe=safeUrl(info.thumbnail);if(!safe)return;
          thumbAction.disabled=true;thumbAction.textContent="Menyiapkan thumbnail…";
          try{
            const response=await fetch(safe.href,{mode:"cors",credentials:"omit",cache:"no-store"});
            if(!response.ok)throw new Error("HTTP "+response.status);
            if(!(response.headers.get("content-type")||"").toLowerCase().startsWith("image/"))throw new Error("Sumber bukan gambar.");
            const blob=await response.blob();if(!blob.size)throw new Error("Thumbnail kosong.");
            const objectUrl=URL.createObjectURL(blob),a=make("a");
            a.href=objectUrl;a.download=safeFilename((info.title||"aryanzz-thumbnail").replace(/\.[^.]+$/,"")+".jpg","aryanzz-thumbnail.jpg");
            document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
            thumbAction.textContent="Thumbnail tersimpan ✓";
          }catch(error){
            thumbAction.disabled=false;thumbAction.textContent="Buka thumbnail ↗";
            thumbAction.onclick=()=>window.open(safe.href,"_blank","noopener");
            box.append(make("p","muted","Situs sumber memblokir unduhan langsung. Thumbnail dibuka di tab baru agar bisa disimpan manual."));
          }
        });
        box.append(thumbAction);
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
      [["video",isYouTube?"Video MP4":"Video"],["audio",isYouTube?"Audio saja":"Audio MP3 / M4A"]].forEach(([value,label]) => {
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
        const available = heights.length ? heights : (isYouTube?[]:[360,480,720,1080,1440,2160]);
        const quickPool=progressiveHeights.length?progressiveHeights:(adaptiveHeights.length?adaptiveHeights:available);
        const quickHeight=quickPool.filter(height=>height<=480).sort((a,b)=>b-a)[0]||quickPool.filter(height=>height<=720).sort((a,b)=>b-a)[0]||quickPool.slice().sort((a,b)=>a-b)[0];
        FORMATS.video.filter(item => available.includes(Number(item[0]))).forEach(([value,label]) => {
          const option = make("option", "", label);
          option.value = String(value);
          if (Number(value) === quickHeight) option.selected = true;
          if(isYouTube)option.textContent=label+(progressiveHeights.includes(Number(value))?" · MP4 langsung":" · rakit otomatis");
          quality.append(option);
        });
      }
      const audioHint = make("p", "muted", directMedia?(info.type==="audio"?"File audio langsung akan diunduh dalam format sumber, tanpa konversi.":"File video langsung akan diunduh dalam kualitas aslinya."):isYouTube?(info.providerReady?(progressiveHeights.length?"Mode Cepat: satu stream MP4 lengkap diprioritaskan. Jika kualitas tinggi hanya tersedia terpisah, ARYANZZ dapat merakitnya otomatis menjadi satu file MP4.":"Sumber hanya menyediakan komponen video dan suara terpisah. ARYANZZ merakitnya otomatis menjadi satu MP4; tidak ada file audio terpisah yang disimpan."):"Tidak ada stream yang tersedia sekarang; coba lagi nanti."):"Audio/video mengikuti format yang tersedia dari sumber. Tidak ada server ekstraksi milik ARYANZZ.");
      const note = make("p", "youtube-note", "Unduh hanya media milik sendiri atau konten yang memang diizinkan. Kualitas mengikuti file sumber.");
      box.append(formatLabel, mode, qualityLabel, quality, audioHint, note);

      const progress = make("div", "progress-track is-idle");
      progress.setAttribute("role","progressbar");
      progress.setAttribute("aria-label","Progres unduhan");
      progress.setAttribute("aria-valuemin","0");
      progress.setAttribute("aria-valuemax","100");
      progress.setAttribute("aria-valuenow","0");
      const bar = make("div", "progress-fill");
      bar.style.width = "0%";
      progress.append(bar);
      const progressText = make("p", "muted", "Siap. Tekan Unduh untuk memulai satu file hasil.");
      const progressMeta = make("small","download-progress-meta","Target: 1 file MP4 · estimasi waktu muncul setelah ukuran sumber terbaca.");
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
      box.append(progress, progressText, progressMeta, actions);
      mode.addEventListener("change", () => {
        quality.disabled = mode.value === "audio"||directMedia;
        qualityLabel.style.opacity = mode.value === "audio" ? ".45" : "1";
        audioFormat.hidden=mode.value!=="audio"||directMedia||audioChoices.length===0;
        audioLabel.hidden=audioFormat.hidden;
        audioBitrate.hidden=true;
        bitrateLabel.hidden=true;
        start.textContent=mode.value==="audio"?"Unduh Audio":"Unduh MP4";
        progressMeta.textContent=mode.value==="audio"?"Target: 1 file audio · estimasi muncul setelah ukuran sumber terbaca.":"Target: 1 file MP4 · estimasi muncul setelah ukuran sumber terbaca.";
      });
      mode.dispatchEvent(new Event("change"));
      start.addEventListener("click", async () => {
        start.disabled = true;
        mode.disabled = true;
        quality.disabled = true;
        start.textContent = "Memproses…";
        progress.classList.remove("is-idle");
        progress.classList.add("is-indeterminate");
        bar.style.width="34%";
        progressText.textContent="Menyiapkan unduhan…";
        progressMeta.textContent="Target: "+(mode.value==="audio"?"1 file audio":"1 file MP4")+" · membaca ukuran sumber untuk menghitung estimasi.";
        try {
          const filename = isYouTube ? await downloadYouTube(url.href,mode.value,Number(quality.value)||480,bar,progressText,progressMeta,info,audioFormat.value) : await downloadFile(url.href, mode.value, Number(quality.value) || 480, bar, progressText, info);
          if(!isYouTube){
            progress.classList.remove("is-indeterminate");
            bar.style.width="100%";progress.setAttribute("aria-valuenow","100");
            progressText.textContent="Permintaan unduhan dikirim ke Chrome: "+filename;
            progressMeta.textContent="Chrome mengelola proses penyimpanan dan notifikasi unduhan.";
          }
          start.textContent = "Unduhan dikirim ✓";
        } catch (error) {
          progress.classList.remove("is-indeterminate");
          status(progressText, error.message || "Unduhan gagal.", true);
          progressMeta.textContent="Belum selesai · periksa kualitas atau coba lagi setelah provider tersedia.";
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