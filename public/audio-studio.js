/* ARYANZZ V90.2 — resilient local MP4 preview and MP3 conversion */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fileInput = $("audioStudioFile");
  if (!fileInput) return;

  const MOBILE_DEVICE = Boolean(navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const DEVICE_MEMORY_GB = Number(navigator.deviceMemory) || 0;
  const MAX_FILE_BYTES = MOBILE_DEVICE ? (DEVICE_MEMORY_GB > 0 && DEVICE_MEMORY_GB <= 4 ? 50 : DEVICE_MEMORY_GB > 0 && DEVICE_MEMORY_GB <= 6 ? 70 : 80) * 1024 * 1024 : 100 * 1024 * 1024;
  const MODULE_URLS = [
    "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js",
    "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js"
  ];
  const CORE_BASES = [
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm",
    "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm"
  ];
  // Use the same upstream FFmpeg class worker as the tested YouTube mux path.
  // This avoids maintaining a second, subtly incompatible worker protocol on mobile.
  const WORKER_URL = "/ffmpeg-worker-bootstrap.js?v=92.2";
  const LOAD_TIMEOUT_MS = 75000;
  const FETCH_TIMEOUT_MS = 45000;

  let selectedFile = null, ffmpeg = null, ffmpegPromise = null, controller = null;
  let previewUrl = "", compatiblePreviewUrl = "", resultUrl = "", cancelled = false, running = false;
  let previewToken = 0, encoderSupportPromise = null;

  const formatSize = bytes => bytes < 1048576 ? (bytes / 1024).toFixed(0) + " KB" : (bytes / 1048576).toFixed(1) + " MB";
  const formatTime = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return "";
    const n = Math.floor(seconds), h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
    return h ? [h,m,s].map(v=>String(v).padStart(2,"0")).join(":") : [m,s].map(v=>String(v).padStart(2,"0")).join(":");
  };
  const safeName = value => String(value || "aryanzz-audio").normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/\.[^.]+$/, "").slice(0, 80) || "aryanzz-audio";
  function status(message) { const el=$("audioStudioStatus"); if(el)el.textContent=message; }
  function progress(value,state="running") {
    const track=$("audioStudioProgressTrack"),bar=$("audioStudioProgressBar");
    const n=Math.max(0,Math.min(100,Number(value)||0));
    if(bar)bar.style.width=n.toFixed(1)+"%";
    if(track){track.setAttribute("aria-valuenow",String(Math.round(n)));track.classList.toggle("is-running",state==="running");track.classList.toggle("is-failed",state==="failed");}
  }
  function busy(value) {
    running=value;
    const convert=$("audioStudioConvert"),cancel=$("audioStudioCancel");
    if(convert){convert.disabled=value||!selectedFile;convert.textContent=value?"Memproses…":"Konversi ke "+($("audioStudioFormat")?.value||"mp3").toUpperCase();}
    if(cancel)cancel.hidden=!value;
    const previewConvert=$("audioStudioPreviewConvert");if(previewConvert)previewConvert.disabled=value;
    const diagnosticsButton=$("audioStudioTestEngine");if(diagnosticsButton)diagnosticsButton.disabled=value;
    fileInput.disabled=value;
    const bitrate=$("audioStudioBitrate"),name=$("audioStudioName"),start=$("audioStudioStart"),end=$("audioStudioEnd"),format=$("audioStudioFormat"),volume=$("audioStudioVolume");
    if(bitrate)bitrate.disabled=value;if(name)name.disabled=value;if(start)start.disabled=value;if(end)end.disabled=value;if(format)format.disabled=value;if(volume)volume.disabled=value;
    if(!value&&typeof syncAudioOptions==="function")syncAudioOptions();
  }
  function updateFileMeta(extra="") {
    const meta=$("audioStudioFileMeta");
    if(meta&&selectedFile)meta.textContent=selectedFile.name+" · "+formatSize(selectedFile.size)+(extra?" · "+extra:"");
  }

  // Read the MP4 movie-header duration even when the phone cannot decode its video codec.
  function parseMp4Duration(buffer) {
    try {
      const view=new DataView(buffer),len=view.byteLength;
      const containers=new Set(["moov","trak","mdia","minf","stbl","edts","dinf","udta"]);
      function walk(start,end,depth) {
        if(depth>8)return null;
        let p=start;
        while(p+8<=end) {
          let size=view.getUint32(p),type=String.fromCharCode(view.getUint8(p+4),view.getUint8(p+5),view.getUint8(p+6),view.getUint8(p+7)),header=8;
          if(size===1){if(p+16>end)return null;const big=view.getBigUint64(p+8);if(big>BigInt(Number.MAX_SAFE_INTEGER))return null;size=Number(big);header=16;}
          else if(size===0)size=end-p;
          if(size<header||p+size>end)return null;
          const payload=p+header,boxEnd=p+size;
          if(type==="mvhd") {
            const version=view.getUint8(payload);
            const scaleOffset=version===1?payload+20:payload+12;
            const durationOffset=version===1?payload+24:payload+16;
            const timescale=view.getUint32(scaleOffset);
            if(!timescale)return null;
            const duration=version===1?Number(view.getBigUint64(durationOffset)):view.getUint32(durationOffset);
            if(Number.isFinite(duration)&&duration>0)return duration/timescale;
          }
          if(containers.has(type)){const found=walk(payload,boxEnd,depth+1);if(found)return found;}
          p=boxEnd;
        }
        return null;
      }
      return walk(0,len,0);
    } catch { return null; }
  }
  async function recoverDuration(file,token) {
    try {
      const buffer=await file.arrayBuffer();
      const duration=parseMp4Duration(buffer);
      if(token!==previewToken||!selectedFile)return;
      if(duration) {
        const label="durasi "+formatTime(duration);
        updateFileMeta(label+( $("audioStudioPreview").error ? " · codec preview tidak didukung browser" : " · siap dikonversi"));
        const note=$("audioStudioPreviewNote");
        if(note&&$("audioStudioPreview").error)note.textContent="Browser HP ini tidak mendukung codec video di dalam MP4. Durasi berhasil dibaca ("+formatTime(duration)+"). Ekstraksi audio tetap dapat dicoba.";
      }
    } catch {}
  }
  function selectFile(file) {
    previewToken++;
    const token=previewToken;
    selectedFile=null;
    const preview=$("audioStudioPreview"),note=$("audioStudioPreviewNote"),meta=$("audioStudioFileMeta"),convert=$("audioStudioConvert"),result=$("audioStudioResult");
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl="";}
    if(compatiblePreviewUrl){URL.revokeObjectURL(compatiblePreviewUrl);compatiblePreviewUrl="";}
    if(preview){preview.pause();preview.removeAttribute("src");preview.load();preview.hidden=true;}
    if(note){note.hidden=true;note.textContent="";}
    const previewConvert=$("audioStudioPreviewConvert");if(previewConvert){previewConvert.hidden=true;previewConvert.disabled=false;}
    if(result){result.hidden=true;result.replaceChildren();}
    if(!file){meta.textContent="Belum ada video dipilih.";convert.disabled=true;return;}
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if(!["mp4","m4v"].includes(ext)&&file.type!=="video/mp4"){meta.textContent="Format tidak didukung. Pilih file video MP4.";convert.disabled=true;return;}
    if(file.size>MAX_FILE_BYTES){meta.textContent="Ukuran file "+formatSize(file.size)+" melebihi batas perangkat "+formatSize(MAX_FILE_BYTES)+". Kurangi ukuran video atau gunakan perangkat dengan kapasitas lebih besar.";convert.disabled=true;return;}
    if(!file.size){meta.textContent="File kosong atau tidak dapat dibaca.";convert.disabled=true;return;}
    selectedFile=file;
    $("audioStudioName").value=safeName(file.name);
    updateFileMeta("memuat pratinjau…");
    previewUrl=URL.createObjectURL(file);
    preview.preload="auto";preview.controls=true;preview.playsInline=true;preview.src=previewUrl;preview.hidden=false;
    preview.onloadedmetadata=()=>{
      if(token!==previewToken)return;
      const d=Number(preview.duration);
      updateFileMeta((Number.isFinite(d)&&d>0?"durasi "+formatTime(d)+" · ":"")+"siap dikonversi");
      if(note){note.hidden=true;note.textContent="";}
    };
    preview.onerror=()=>{
      if(token!==previewToken)return;
      if(note){note.hidden=false;note.textContent="Pratinjau asli tidak didukung oleh browser HP ini. Coba buat pratinjau kompatibel H.264; proses ini dilakukan lokal di perangkat.";} 
      const previewConvert=$("audioStudioPreviewConvert");if(previewConvert)previewConvert.hidden=false;
      status("Codec video tidak didukung untuk pratinjau. Kamu tetap bisa mencoba ekstrak audionya.");
      recoverDuration(file,token);
    };
    preview.load();
    convert.disabled=false;progress(0,"idle");
    status("Video dipilih. Jika pratinjau tidak muncul, coba konversi audio; codec tertentu memang tidak didukung pemutar bawaan HP.");
  }

  async function fetchBlobUrl(url,mime,signal,label) {
    const timeout=new AbortController();
    let timer=null;
    const armIdleTimeout=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>timeout.abort(),FETCH_TIMEOUT_MS);
    };
    const abort=()=>timeout.abort();
    signal.addEventListener("abort",abort,{once:true});
    armIdleTimeout();
    try {
      const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"force-cache",signal:timeout.signal});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const total=Number(response.headers.get("content-length"))||0,reader=response.body?.getReader();
      if(!reader) {
        const blob=new Blob([await response.arrayBuffer()],{type:mime});
        return URL.createObjectURL(blob);
      }
      const chunks=[];let received=0;
      while(true) {
        const part=await reader.read();
        if(part.done)break;
        chunks.push(part.value);received+=part.value.byteLength;
        armIdleTimeout();
        if(total){
          const base=label==="WASM"?4:2,span=label==="WASM"?14:2;
          progress(base+Math.min(span,received/total*span));
          status((label==="WASM"?"Mengunduh komponen mesin MP3 · ":"Memuat komponen FFmpeg · ")+formatSize(received)+" / "+formatSize(total)+"…");
        } else {
          status((label==="WASM"?"Mengunduh komponen mesin MP3 · ":"Memuat komponen FFmpeg · ")+formatSize(received)+"…");
        }
      }
      return URL.createObjectURL(new Blob(chunks,{type:mime}));
    } catch(error) {
      if(signal.aborted)throw new Error("Proses dibatalkan.");
      if(timeout.signal.aborted)throw new Error("Koneksi CDN tidak mengirim data selama 45 detik. Coba lagi atau gunakan jaringan yang lebih stabil.");
      throw new Error("Gagal mengunduh komponen "+label+": "+String(error?.message||error));
    } finally {
      clearTimeout(timer);signal.removeEventListener("abort",abort);
    }
  }
  async function importWithFallback(signal) {
    let lastError;
    for(const url of MODULE_URLS) {
      if(signal.aborted)throw new Error("Proses dibatalkan.");
      let timer=null;
      try {
        const mod=await Promise.race([
          import(url),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Waktu pemuatan library FFmpeg habis.")),45000);})
        ]);
        if(mod?.FFmpeg)return mod;
        throw new Error("Library FFmpeg tidak menyediakan kelas FFmpeg.");
      } catch(error){lastError=error;if(signal.aborted)throw new Error("Proses dibatalkan.");}
      finally {clearTimeout(timer);}
    }
    throw new Error("Library FFmpeg gagal dimuat dari CDN utama maupun cadangan: "+String(lastError?.message||lastError));
  }
  async function loadEngine(signal) {
    if(ffmpeg?.loaded)return ffmpeg;
    if(ffmpegPromise)return ffmpegPromise;
    ffmpegPromise=(async()=>{
      let lastError=null;
      try {
        status("Memuat library konversi…");progress(2);
        const mod=await importWithFallback(signal);
        if(signal.aborted)throw new Error("Proses dibatalkan.");
        const workerURL=new URL(WORKER_URL,location.origin).href;
        for(let index=0;index<CORE_BASES.length;index++) {
          if(signal.aborted)throw new Error("Proses dibatalkan.");
          const base=CORE_BASES[index];
          let instance=null,timer=null;
          try {
            instance=new mod.FFmpeg();
            status(index===0?"Menghubungkan worker FFmpeg…":"Mencoba CDN cadangan untuk mesin FFmpeg…");
            progress(index===0?12:16);
            await Promise.race([
              instance.load({
                classWorkerURL:workerURL,
                coreURL:base+"/ffmpeg-core.js",
                wasmURL:base+"/ffmpeg-core.wasm"
              },{signal}),
              new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Mesin FFmpeg belum siap setelah 75 detik pada CDN "+(index===0?"utama":"cadangan")+". ")),LOAD_TIMEOUT_MS);})
            ]);
            if(signal.aborted)throw new Error("Proses dibatalkan.");
            if(!instance.loaded)throw new Error("Worker FFmpeg merespons, tetapi core belum siap.");
            ffmpeg=instance;
            status("Mesin FFmpeg siap · siap memproses video.");
            progress(20);
            return instance;
          } catch(error) {
            lastError=error;
            if(instance){try{instance.terminate();}catch{}}
            if(signal.aborted)throw new Error("Proses dibatalkan.");
          } finally {clearTimeout(timer);}
        }
        throw new Error("Mesin FFmpeg gagal dimuat dari CDN utama maupun cadangan: "+String(lastError?.message||lastError));
      } catch(error) {
        throw error;
      }
    })().catch(error=>{ffmpegPromise=null;throw error;});
    return ffmpegPromise;
  }
  function showResult(blob,filename) {
    if(resultUrl)URL.revokeObjectURL(resultUrl);
    resultUrl=URL.createObjectURL(blob);
    const box=$("audioStudioResult");box.replaceChildren();box.hidden=false;
    const title=document.createElement("b");title.textContent="Konversi audio berhasil ✓";
    const meta=document.createElement("small");meta.textContent=filename+" · "+formatSize(blob.size)+" · siap disimpan";
    const audio=document.createElement("audio");audio.controls=true;audio.preload="metadata";audio.src=resultUrl;audio.style.cssText="display:block;width:100%;margin:10px 0 12px";
    const link=document.createElement("a");link.href=resultUrl;link.download=filename;link.textContent="↓ Unduh "+filename.split(".").pop().toUpperCase();
    box.append(title,meta,audio,link);
  }
  async function makeCompatiblePreview() {
    if(!selectedFile||running)return;
    const file=selectedFile;
    cancelled=false;controller=new AbortController();busy(true);
    const inputName="aryanzz-preview-source.mp4",outputName="aryanzz-preview-compatible.mp4";
    let engine=null;
    try {
      status("Menyiapkan mesin untuk pratinjau kompatibel…");progress(1);
      engine=await loadEngine(controller.signal);
      if(controller.signal.aborted)throw new Error("Proses dibatalkan.");
      status("Membaca video untuk membuat pratinjau…");progress(20);
      await engine.writeFile(inputName,new Uint8Array(await file.arrayBuffer()));
      status("Mengubah video ke format H.264 yang kompatibel dengan HP…");progress(24);
      const code=await engine.exec(["-i",inputName,"-map","0:v:0","-an","-vf","scale='min(960,iw)':-2","-c:v","libx264","-preset","ultrafast","-crf","30","-pix_fmt","yuv420p","-movflags","+faststart","-y",outputName],300000);
      if(code!==0)throw new Error("Encoder H.264 tidak tersedia atau video tidak memiliki trek gambar.");
      if(controller.signal.aborted)throw new Error("Proses dibatalkan.");
      const output=await engine.readFile(outputName);
      if(!output||output.length<1024)throw new Error("Pratinjau kompatibel tidak berhasil dibuat.");
      if(compatiblePreviewUrl)URL.revokeObjectURL(compatiblePreviewUrl);
      compatiblePreviewUrl=URL.createObjectURL(new Blob([output],{type:"video/mp4"}));
      const preview=$("audioStudioPreview");
      preview.pause();preview.src=compatiblePreviewUrl;preview.hidden=false;preview.load();
      const note=$("audioStudioPreviewNote");
      if(note){note.hidden=false;note.textContent="Pratinjau kompatibel H.264 berhasil dibuat. Tekan Play untuk memutar video.";}
      $("audioStudioPreviewConvert").hidden=true;
      progress(100,"done");status("Pratinjau video siap diputar. File asli tetap digunakan untuk ekstraksi MP3.");
    } catch(error) {
      progress(0,cancelled?"idle":"failed");
      status(cancelled||controller?.signal.aborted?"Proses dibatalkan.":"Pratinjau kompatibel gagal: "+String(error?.message||error).slice(0,180));
    } finally {
      if(engine?.loaded){try{await engine.deleteFile(inputName);}catch{}try{await engine.deleteFile(outputName);}catch{}}
      controller=null;cancelled=false;busy(false);
    }
  }
  async function detectEncoders(engine) {
    if(encoderSupportPromise)return encoderSupportPromise;
    encoderSupportPromise=(async()=>{
      const lines=[];
      const handler=event=>{const line=String(event?.message||"");if(line)lines.push(line);};
      engine.on("log",handler);
      try {
        const code=await engine.exec(["-hide_banner","-encoders"],120000);
        if(code!==0)throw new Error("FFmpeg tidak dapat membaca daftar encoder.");
        const output=lines.join("\n");
        const names=["libmp3lame","pcm_s16le","aac","flac"];
        const supported={};
        for(const name of names)supported[name]=new RegExp("(?:^|\\s)"+name+"(?:\\s|$)","m").test(output);
        return supported;
      } finally {engine.off("log",handler);}
    })().catch(error=>{encoderSupportPromise=null;throw error;});
    return encoderSupportPromise;
  }
  async function convert() {
    if(!selectedFile||running)return;
    const file=selectedFile;
    cancelled=false;controller=new AbortController();busy(true);
    $("audioStudioResult").hidden=true;progress(1);status("Menyiapkan konversi…");
    const inputName="aryanzz-input.mp4";
    const format=$("audioStudioFormat")?.value||"mp3";
    const extension=({mp3:"mp3",wav:"wav",aac:"aac",flac:"flac"})[format]||"mp3";
    const mime=({mp3:"audio/mpeg",wav:"audio/wav",aac:"audio/aac",flac:"audio/flac"})[format]||"audio/mpeg";
    const outputName="aryanzz-audio."+extension;
    let engine=null;
    try {
      engine=await loadEngine(controller.signal);
      if(cancelled||controller.signal.aborted)throw new Error("Proses dibatalkan.");
      status("Memeriksa dukungan format audio…");
      const supported=await detectEncoders(engine);
      const requiredEncoder=({mp3:"libmp3lame",wav:"pcm_s16le",aac:"aac",flac:"flac"})[format];
      if(!supported[requiredEncoder])throw new Error("Encoder "+format.toUpperCase()+" tidak tersedia pada mesin browser ini. Jalankan Uji mesin & format untuk melihat format yang didukung.");
      status("Membaca file video…");progress(20);
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(!bytes.length)throw new Error("File tidak dapat dibaca.");
      status("Memasukkan video ke mesin konversi · "+formatSize(bytes.byteLength));progress(21);
      await engine.writeFile(inputName,bytes);
      bytes.fill(0);
      const bitrate=Number($("audioStudioBitrate").value)||192;
      const startValue=$("audioStudioStart")?.value.trim()||"";
      const endValue=$("audioStudioEnd")?.value.trim()||"";
      const startSeconds=startValue===""?0:Number(startValue);
      const endSeconds=endValue===""?0:Number(endValue);
      if(!Number.isFinite(startSeconds)||startSeconds<0)throw new Error("Waktu mulai harus berupa angka 0 atau lebih.");
      if(endValue!==""&&(!Number.isFinite(endSeconds)||endSeconds<=startSeconds))throw new Error("Waktu akhir harus lebih besar daripada waktu mulai.");
      const volume=Number($("audioStudioVolume")?.value||100)/100;
      if(!Number.isFinite(volume)||volume<0.5||volume>1.5)throw new Error("Volume hasil harus antara 50% sampai 150%.");
      const ffmpegArgs=[];
      if(startSeconds>0)ffmpegArgs.push("-ss",String(startSeconds));
      ffmpegArgs.push("-i",inputName);
      if(endValue!=="")ffmpegArgs.push("-t",String(endSeconds-startSeconds));
      ffmpegArgs.push("-map","0:a:0","-vn");
      if(Math.abs(volume-1)>0.001)ffmpegArgs.push("-af","volume="+volume.toFixed(2));
      if(format==="mp3")ffmpegArgs.push("-c:a","libmp3lame","-b:a",bitrate+"k","-ar","44100","-id3v2_version","3");
      else if(format==="wav")ffmpegArgs.push("-c:a","pcm_s16le","-ar","44100");
      else if(format==="aac")ffmpegArgs.push("-c:a","aac","-b:a",bitrate+"k","-f","adts");
      else if(format==="flac")ffmpegArgs.push("-c:a","flac","-compression_level","5");
      else throw new Error("Format hasil tidak didukung.");
      ffmpegArgs.push("-y",outputName);
      const logHandler=event=>{
        const line=String(event?.message||"");
        const match=line.match(/Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
        if(match)status("Video terbaca · durasi "+match[1]+" · mulai mengekstrak audio…");
      };
      const progressHandler=event=>{
        const n=Number(event?.progress);
        if(Number.isFinite(n)){progress(22+Math.max(0,Math.min(1,n))*75);status("Mengonversi MP4 ke "+format.toUpperCase()+" · "+Math.round(n*100)+"%");}
      };
      engine.on("log",logHandler);engine.on("progress",progressHandler);
      try {
        const code=await engine.exec(ffmpegArgs,300000);
        if(code!==0)throw new Error("Mesin konversi tidak mendukung encoder "+({mp3:"MP3",wav:"WAV",aac:"AAC",flac:"FLAC"}[format]||format)+", atau file tidak memiliki trek suara. Coba MP3 atau periksa file video.");
      } finally {engine.off("log",logHandler);engine.off("progress",progressHandler);}
      if(cancelled||controller.signal.aborted)throw new Error("Proses dibatalkan.");
      const output=await engine.readFile(outputName);
      if(!output||output.length<1024)throw new Error("Hasil "+extension.toUpperCase()+" kosong. Pastikan video memiliki trek suara.");
      const filename=safeName($("audioStudioName").value||file.name)+"."+extension;
      showResult(new Blob([output],{type:mime}),filename);
      progress(100,"done");status("Selesai! Putar pratinjau audio atau unduh file "+extension.toUpperCase()+".");
    } catch(error) {
      const message=cancelled||controller?.signal.aborted?"Proses dibatalkan.":String(error?.message||error).slice(0,240);
      progress(0,cancelled?"idle":"failed");status(message);
    } finally {
      if(engine?.loaded){try{await engine.deleteFile(inputName);}catch{}try{await engine.deleteFile(outputName);}catch{}}
      controller=null;cancelled=false;busy(false);
    }
  }
  const formatSelect=$("audioStudioFormat"),bitrateSelect=$("audioStudioBitrate"),volumeSlider=$("audioStudioVolume"),volumeValue=$("audioStudioVolumeValue");
  const diagnosticsButton=$("audioStudioTestEngine"),diagnosticsResult=$("audioStudioDiagnosticsResult");
  diagnosticsButton?.addEventListener("click",async()=>{
    if(running)return;
    cancelled=false;controller=new AbortController();busy(true);
    if(diagnosticsResult){diagnosticsResult.hidden=false;diagnosticsResult.textContent="Memuat mesin FFmpeg dan memeriksa encoder di perangkat ini…";}
    try{
      const engine=await loadEngine(controller.signal);
      const supported=await detectEncoders(engine);
      const labels=[["MP3","libmp3lame"],["WAV","pcm_s16le"],["AAC","aac"],["FLAC","flac"]];
      const summary=labels.map(([label,key])=>label+": "+(supported[key]?"tersedia":"tidak tersedia")).join(" · ");
      if(diagnosticsResult)diagnosticsResult.textContent="Pemeriksaan selesai — "+summary+". Hasil bergantung pada build mesin FFmpeg dan browser perangkat.";
      status("Uji mesin selesai. Pilih format yang ditandai tersedia.");
    }catch(error){
      const message=cancelled||controller?.signal.aborted?"Uji dibatalkan.":String(error?.message||error).slice(0,200);
      if(diagnosticsResult)diagnosticsResult.textContent="Uji mesin gagal: "+message;
      status(message);
    }finally{controller=null;cancelled=false;busy(false);}
  });

  const fileLimitLabel=document.querySelector('label.audio-file-drop small');
  if(fileLimitLabel)fileLimitLabel.textContent="MP4 · Maksimal "+formatSize(MAX_FILE_BYTES)+" pada perangkat ini · Proses lokal di browser";
  function syncAudioOptions(){
    const format=formatSelect?.value||"mp3";
    const convertButton=$("audioStudioConvert");if(convertButton)convertButton.textContent=running?"Memproses…":"Konversi ke "+format.toUpperCase();
    if(bitrateSelect)bitrateSelect.disabled=running||format==="wav"||format==="flac";
    if(bitrateSelect?.parentElement)bitrateSelect.parentElement.style.opacity=(format==="wav"||format==="flac")?".55":"1";
    if(volumeValue&&volumeSlider)volumeValue.textContent=volumeSlider.value+"%";
  }
  formatSelect?.addEventListener("change",syncAudioOptions);
  volumeSlider?.addEventListener("input",syncAudioOptions);
  syncAudioOptions();
  fileInput.addEventListener("change",()=>selectFile(fileInput.files?.[0]));
  $("audioStudioConvert").addEventListener("click",convert);
  $("audioStudioPreviewConvert")?.addEventListener("click",makeCompatiblePreview);
  $("audioStudioCancel").addEventListener("click",()=>{
    cancelled=true;controller?.abort();
    if(ffmpeg){try{ffmpeg.terminate();}catch{}ffmpeg=null;ffmpegPromise=null;}
    status("Membatalkan proses…");
  });
  window.addEventListener("pagehide",()=>{
    if(ffmpeg){try{ffmpeg.terminate();}catch{}}
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    if(compatiblePreviewUrl)URL.revokeObjectURL(compatiblePreviewUrl);
    if(resultUrl)URL.revokeObjectURL(resultUrl);
  });
})();