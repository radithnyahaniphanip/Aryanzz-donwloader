
(() => {
  "use strict";
  const $=id=>document.getElementById(id),MAX_BYTES=10*1024*1024,SAMPLE_SECONDS=12;
  const HISTORY_KEY="aryanzz-music-history-v1";
  let selectedFile=null,apiReady=false,videoUrlReady=false,busy=false;
  function safeHttps(raw){try{const u=new URL(raw);return u.protocol==="https:"?u.href:null;}catch{return null;}}
  function setMessage(text,error){
    const box=$("musicResult");box.replaceChildren();box.hidden=false;
    const p=document.createElement("p");p.className=error?"music-error":"music-empty";p.textContent=text;box.append(p);
  }
  function refreshButtons(){
    $("musicFileButton").disabled=busy||!apiReady||!selectedFile;
    $("musicFileScanButton").disabled=busy||!apiReady||!selectedFile;
    $("musicMicButton").disabled=busy||!apiReady;
    $("musicUrlButton").disabled=busy||!apiReady||!videoUrlReady;
  }
  function waitForEvent(target,name,timeoutMs){
    return new Promise((resolve,reject)=>{
      let timer;
      const cleanup=()=>{clearTimeout(timer);target.removeEventListener(name,ok);target.removeEventListener("error",bad);};
      const ok=()=>{cleanup();resolve();},bad=()=>{cleanup();reject(new Error("Browser tidak dapat membaca media ini."));};
      timer=setTimeout(()=>{cleanup();reject(new Error("Media terlalu lama dimuat. Coba file lain."));},timeoutMs||15000);
      target.addEventListener(name,ok,{once:true});target.addEventListener("error",bad,{once:true});
    });
  }
  function recorderMime(){
    if(!window.MediaRecorder)return "";
    for(const type of ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"]){
      try{if(MediaRecorder.isTypeSupported(type))return type;}catch{}
    }
    return "";
  }
  async function recordStream(stream,seconds,onTick){
    if(!window.MediaRecorder)throw new Error("Browser ini belum mendukung perekaman audio.");
    const mimeType=recorderMime();let recorder;
    try{recorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);}
    catch{throw new Error("Format perekaman audio tidak didukung oleh browser ini.");}
    const chunks=[];
    const finished=new Promise((resolve,reject)=>{
      recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>reject(new Error("Perekaman audio gagal."));
      recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||mimeType||"audio/webm"}));
    });
    recorder.start(250);
    for(let left=seconds;left>0;left--){if(onTick)onTick(left);await new Promise(r=>setTimeout(r,1000));if(recorder.state==="inactive")break;}
    if(recorder.state!=="inactive")recorder.stop();
    return finished;
  }
  async function captureMediaSample(file,startSeconds,onTick){
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass||!window.MediaRecorder)throw new Error("Browser belum mendukung ekstraksi audio. Coba Chrome terbaru.");
    const isVideo=(file.type||"").startsWith("video/")||/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name||"");
    const media=document.createElement(isVideo?"video":"audio"),objectUrl=URL.createObjectURL(file);
    let context=null,source=null;
    media.preload="auto";media.playsInline=true;media.controls=false;media.src=objectUrl;
    media.style.cssText="position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.append(media);
    try{
      media.load();if(media.readyState<1)await waitForEvent(media,"loadedmetadata",20000);
      const duration=Number(media.duration),offset=Math.max(0,Number(startSeconds)||0);
      if(Number.isFinite(duration)&&duration>0&&offset>=duration)throw new Error("Detik mulai melebihi durasi file. Pilih posisi yang lebih kecil.");
      if(offset>0.1){const seeked=waitForEvent(media,"seeked",15000);media.currentTime=offset;await seeked;}
      context=new AudioContextClass();await context.resume();
      source=context.createMediaElementSource(media);
      const destination=context.createMediaStreamDestination();source.connect(destination);
      const recording=recordStream(destination.stream,SAMPLE_SECONDS,onTick);
      await media.play();
      const blob=await recording;
      if(!blob||blob.size<1000)throw new Error("Audio tidak ditemukan di bagian video tersebut. Coba bagian lain.");
      const ext=blob.type.includes("mp4")?"m4a":blob.type.includes("ogg")?"ogg":"webm";
      return {blob,name:"aryanzz-audio-sample."+ext};
    }finally{
      try{media.pause();}catch{}try{if(source)source.disconnect();}catch{}
      try{if(context)await context.close();}catch{}
      media.remove();URL.revokeObjectURL(objectUrl);
    }
  }
  async function readResponse(response){
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(data.error||"Pencarian lagu gagal. Coba lagi.");
      error.providerErrorCode=data.providerErrorCode??null;
      error.retryable=data.retryable??true;
      throw error;
    }
    return data;
  }
  function addLink(container,label,raw){
    const href=safeHttps(raw);if(!href)return;
    const a=document.createElement("a");a.href=href;a.target="_blank";a.rel="noopener noreferrer";
    a.className="music-result-link";a.textContent=label;container.append(a);
  }
  function getArtwork(result){
    let raw=result.artwork_url||(result.apple_music&&result.apple_music.artwork&&result.apple_music.artwork.url);
    if(typeof raw==="string")raw=raw.replace("{w}","320").replace("{h}","320");
    if(!raw&&result.spotify&&result.spotify.album&&Array.isArray(result.spotify.album.images))
      raw=result.spotify.album.images[0]&&result.spotify.album.images[0].url;
    return safeHttps(raw);
  }
  function readHistory(){
    try{const data=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(data)?data:[];}catch{return [];}
  }
  function renderHistory(){
    const box=$("musicHistory");box.replaceChildren();const items=readHistory();
    if(!items.length){const p=document.createElement("p");p.className="music-history-empty";p.textContent="Belum ada lagu yang dikenali.";box.append(p);return;}
    items.forEach(item=>{
      const row=document.createElement("div");row.className="music-history-row";
      const info=document.createElement("div"),title=document.createElement("b"),artist=document.createElement("small");
      title.textContent=item.title||"Unknown title";artist.textContent=item.artist||"Unknown artist";info.append(title,artist);row.append(info);
      const href=safeHttps(item.song_link);if(href){const a=document.createElement("a");a.href=href;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Buka ↗";row.append(a);}
      box.append(row);
    });
  }
  function remember(result){
    try{
      const item={title:result.title||"Unknown title",artist:result.artist||"Unknown artist",album:result.album||"",song_link:result.song_link||"",at:Date.now()};
      const items=readHistory().filter(x=>!(x.title===item.title&&x.artist===item.artist));
      items.unshift(item);localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,20)));renderHistory();
    }catch{}
  }
  function renderMatch(result){
    const box=$("musicResult");box.replaceChildren();box.hidden=false;
    const card=document.createElement("article");card.className="music-match";
    const coverUrl=getArtwork(result);
    if(coverUrl){const img=document.createElement("img");img.className="music-cover";img.src=coverUrl;img.alt="Cover album";img.loading="lazy";card.append(img);}
    else{const cover=document.createElement("div");cover.className="music-cover music-cover-fallback";cover.textContent="♫";card.append(cover);}
    const details=document.createElement("div");details.className="music-match-details";
    const badge=document.createElement("span");badge.className="music-match-badge";badge.textContent="LAGU DITEMUKAN"+(result.provider?" · "+result.provider:"");
    const title=document.createElement("h3");title.textContent=result.title||"Unknown title";
    const artist=document.createElement("p");artist.className="music-artist";artist.textContent=result.artist||"Unknown artist";
    details.append(badge,title,artist);
    for(const [label,value] of [["Album",result.album],["Rilis",result.release_date],["Terdeteksi pada",result.timecode]]){
      if(value){const small=document.createElement("small");small.textContent=label+": "+value;details.append(small);}
    }
    const links=document.createElement("div");links.className="music-result-links";
    addLink(links,"Buka lagu ↗",result.song_link);
    const apple=result.apple_music&&(result.apple_music.url||result.apple_music.url_canonical);
    const spotify=result.spotify&&(result.spotify.url||(result.spotify.external_urls&&result.spotify.external_urls.spotify));
    addLink(links,"Apple Music ↗",apple);addLink(links,"Spotify ↗",spotify);
    const query=encodeURIComponent([result.title,result.artist].filter(Boolean).join(" "));
    if(query){addLink(links,"Cari di YouTube ↗","https://www.youtube.com/results?search_query="+query);addLink(links,"Cari di Spotify ↗","https://open.spotify.com/search/"+query);}
    details.append(links);card.append(details);box.append(card);
    const note=document.createElement("p");note.className="music-result-note";
    note.textContent="Jika versi DJ/remix tidak dikenali secara persis, hasil mungkin menunjukkan lagu original. Coba bagian drop atau chorus yang lebih jelas.";
    box.append(note);remember(result);
  }
  async function identifyFile(blob,name){
    const form=new FormData();form.append("file",blob,name||"aryanzz-audio-sample.webm");
    return readResponse(await fetch("/api/music/recognize",{method:"POST",body:form,cache:"no-store"}));
  }

  async function identifyVideoScan(url,skip,limit){
    return readResponse(await fetch("/api/music/scan-video",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({url,skip,every:1,limit}),cache:"no-store"
    }));
  }
  async function identifyFileScan(file,skip,limit){
    if(file.size>50*1024*1024)throw new Error("File melebihi batas 50 MB untuk pemindaian DJ.");
    const form=new FormData();form.append("file",file,file.name||"aryanzz-dj-scan.mp4");
    form.append("skip",String(skip));form.append("every","1");form.append("limit",String(limit));
    return readResponse(await fetch("/api/music/scan-video",{method:"POST",body:form,cache:"no-store"}));
  }
  function renderEnterpriseTracks(data){
    const box=$("musicResult");box.replaceChildren();box.hidden=false;
    const tracks=Array.isArray(data.tracks)?data.tracks:[];
    if(!tracks.length){setMessage(data.message||"Belum ada lagu yang cocok pada bagian video yang dipindai.",false);return;}
    const heading=document.createElement("div");heading.className="music-scan-summary";
    const title=document.createElement("b");title.textContent=tracks.length+" hasil lagu ditemukan";
    const meta=document.createElement("small");meta.textContent=(data.provider||"AudD Enterprise")+" · "+(data.scannedChunks||0)+" segmen dipindai";
    heading.append(title,meta);box.append(heading);
    tracks.forEach((track,index)=>{
      const row=document.createElement("article");row.className="music-track-row";
      const top=document.createElement("div");top.className="music-track-top";
      const time=document.createElement("span");time.className="music-track-time";
      const detectedAt=Array.isArray(track.offsets)&&track.offsets.length?track.offsets.join(" · "):track.offset;
      time.textContent=detectedAt||"Waktu tidak tersedia";
      const rank=document.createElement("small");rank.textContent=track.score!=null?"Kecocokan "+track.score+"%":"Track "+(index+1);
      top.append(time,rank);
      const name=document.createElement("h4");name.textContent=track.title||"Unknown title";
      const artist=document.createElement("p");artist.className="music-artist";artist.textContent=track.artist||"Unknown artist";
      row.append(top,name,artist);
      if(track.album){const album=document.createElement("small");album.className="music-track-meta";album.textContent="Album: "+track.album;row.append(album);}
      if(track.timecode){const tc=document.createElement("small");tc.className="music-track-meta";tc.textContent="Posisi pada lagu: "+track.timecode;row.append(tc);}
      const links=document.createElement("div");links.className="music-result-links";
      addLink(links,"Buka lagu ↗",track.song_link);
      const apple=track.apple_music&&(track.apple_music.url||track.apple_music.url_canonical);
      const spotify=track.spotify&&(track.spotify.url||(track.spotify.external_urls&&track.spotify.external_urls.spotify));
      addLink(links,"Apple Music ↗",apple);addLink(links,"Spotify ↗",spotify);
      const query=encodeURIComponent([track.title,track.artist].filter(Boolean).join(" "));
      if(query)addLink(links,"YouTube ↗","https://www.youtube.com/results?search_query="+query);
      row.append(links);box.append(row);remember(track);
    });
    const note=document.createElement("p");note.className="music-result-note";
    note.textContent="Posisi waktu menunjukkan bagian video tempat lagu terdeteksi. Pemindaian mengambil sampel sesuai interval yang dipilih; lagu yang sangat singkat di antara sampel mungkin terlewat. Shazam fallback membatasi pemindaian hingga 30 sampel.";
    box.append(note);
  }

  function showOutcome(data){
    if(data.match&&data.result)renderMatch(data.result);
    else setMessage(data.message||"Belum ada lagu yang cocok. Coba cuplikan lain yang lebih jelas.",false);
  }
  async function loadStatus(){
    const status=$("musicApiStatus");
    try{
      const data=await readResponse(await fetch("/api/music/status",{cache:"no-store"}));
      apiReady=!!data.configured;videoUrlReady=!!data.videoUrlReady;
      status.className="music-status "+(apiReady?"is-ready":"is-warning");
      status.textContent=apiReady?(data.auddConfigured?"AudD token terpasang"+(data.shazamFallbackReady?" · Shazam fallback tersedia":"") :"Shazam fallback terkonfigurasi"):"Music Finder belum aktif. Hubungkan AudD atau Cloudflare Container Shazam.";
      $("musicUrlHelp").textContent=videoUrlReady
        ?(data.auddConfigured?(data.shazamFallbackReady?"Tautan publik dipindai AudD Enterprise; bila kuota/akses AudD gagal, Shazam Container menjadi cadangan.":"Tautan publik memerlukan akses AudD Enterprise yang aktif."):"Tautan publik dipindai oleh Shazam Container. Maksimum 30 sampel per pemindaian DJ.")
        :"Tautan video memerlukan AudD Enterprise atau Cloudflare Container Shazam yang aktif.";
      refreshButtons();
    }catch(error){
      apiReady=false;videoUrlReady=false;status.className="music-status is-warning";
      status.textContent="Tidak dapat memeriksa layanan Music Finder: "+error.message;refreshButtons();
    }
  }
  $("musicFile").addEventListener("change",event=>{
    selectedFile=event.target.files&&event.target.files[0]||null;
    $("musicFileName").textContent=selectedFile?selectedFile.name+" · "+(selectedFile.size/1048576).toFixed(1)+" MB":"Belum ada file dipilih";
    refreshButtons();
  });
  $("musicFileButton").addEventListener("click",async()=>{
    if(!selectedFile||busy)return;
    const offset=Math.max(0,Number($("musicFileOffset").value)||0);busy=true;refreshButtons();
    setMessage("Sedang mengambil cuplikan audio dan mencari kecocokan lagu…",false);
    try{
      const isVideo=(selectedFile.type||"").startsWith("video/")||/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(selectedFile.name||"");
      let blob=selectedFile,name=selectedFile.name||"aryanzz-audio-sample";
      if(isVideo||offset>0||selectedFile.size>MAX_BYTES){
        const sample=await captureMediaSample(selectedFile,offset,left=>$("musicMicStatus").textContent="Mengambil cuplikan audio… "+left+" detik");
        blob=sample.blob;name=sample.name;
      }
      showOutcome(await identifyFile(blob,name));
    }catch(error){setMessage(error.message||"Gagal mengenali lagu dari file.",true);}
    finally{$("musicMicStatus").textContent="Tekan tombol untuk mulai mendengarkan.";busy=false;refreshButtons();}
  });

  $("musicFileScanButton").addEventListener("click",async()=>{
    if(!selectedFile||busy)return;
    const skip=Number($("musicScanSkip").value),limit=Number($("musicScanLimit").value);
    busy=true;refreshButtons();setMessage("Mengirim file ke pemindai lagu DJ mix…",false);
    try{renderEnterpriseTracks(await identifyFileScan(selectedFile,skip,limit));}
    catch(error){setMessage(error.message||"Gagal memindai video/DJ mix.",true);}
    finally{busy=false;refreshButtons();}
  });

  $("musicUrlButton").addEventListener("click",async()=>{
    if(busy)return;const url=$("musicVideoUrl").value.trim();
    if(!url){setMessage("Tempel tautan video terlebih dahulu.",true);return;}
    try{const parsed=new URL(url);if(!["https:","http:"].includes(parsed.protocol))throw new Error("Gunakan tautan video HTTP atau HTTPS.");}
    catch(error){setMessage(error.message||"Tautan video tidak valid.",true);return;}
    const skip=Number($("musicScanSkip").value),limit=Number($("musicScanLimit").value);
    busy=true;refreshButtons();setMessage("Memindai video/DJ mix dan mencari beberapa lagu…",false);
    try{renderEnterpriseTracks(await identifyVideoScan(url,skip,limit));}
    catch(error){setMessage(error.message||"Gagal memindai tautan video/DJ mix.",true);}
    finally{busy=false;refreshButtons();}
  });
  $("musicMicButton").addEventListener("click",async()=>{
    if(busy)return;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setMessage("Browser tidak mendukung akses mikrofon. Gunakan Chrome terbaru atau upload file.",true);return;}
    let stream=null;busy=true;refreshButtons();setMessage("Mendengarkan audio di sekitar perangkat…",false);
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
      const blob=await recordStream(stream,SAMPLE_SECONDS,left=>$("musicMicStatus").textContent="Mendengarkan… "+left+" detik");
      if(!blob||blob.size<1000)throw new Error("Audio mikrofon terlalu pelan atau tidak tertangkap.");
      const ext=blob.type.includes("mp4")?"m4a":blob.type.includes("ogg")?"ogg":"webm";
      showOutcome(await identifyFile(blob,"aryanzz-microphone-sample."+ext));
    }catch(error){setMessage(error.message||"Tidak dapat menggunakan mikrofon.",true);}
    finally{if(stream)stream.getTracks().forEach(track=>track.stop());$("musicMicStatus").textContent="Tekan tombol untuk mulai mendengarkan.";busy=false;refreshButtons();}
  });
  $("musicClearHistory").addEventListener("click",()=>{try{localStorage.removeItem(HISTORY_KEY);}catch{}renderHistory();});
  renderHistory();loadStatus();
})();
