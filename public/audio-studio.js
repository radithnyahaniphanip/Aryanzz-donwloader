/* ARYANZZ V90.2 — resilient local MP4 preview and MP3 conversion */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fileInput = $("audioStudioFile");
  if (!fileInput) return;

  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const MODULE_URLS = [
    "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js",
    "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js"
  ];
  const CORE_BASES = [
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm",
    "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm"
  ];
  const WORKER_URL = "/ffmpeg-worker-bootstrap.js?v=90.2";
  const LOAD_TIMEOUT_MS = 90000;
  const FETCH_TIMEOUT_MS = 45000;

  let selectedFile = null, ffmpeg = null, ffmpegPromise = null, controller = null;
  let previewUrl = "", resultUrl = "", cancelled = false, running = false;
  let previewToken = 0;

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
    if(convert){convert.disabled=value||!selectedFile;convert.textContent=value?"Memproses…":"Konversi ke MP3";}
    if(cancel)cancel.hidden=!value;
    fileInput.disabled=value;
    const bitrate=$("audioStudioBitrate"),name=$("audioStudioName");
    if(bitrate)bitrate.disabled=value;if(name)name.disabled=value;
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
    if(preview){preview.pause();preview.removeAttribute("src");preview.load();preview.hidden=true;}
    if(note){note.hidden=true;note.textContent="";}
    if(result){result.hidden=true;result.replaceChildren();}
    if(!file){meta.textContent="Belum ada video dipilih.";convert.disabled=true;return;}
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if(!["mp4","m4v"].includes(ext)&&file.type!=="video/mp4"){meta.textContent="Format tidak didukung. Pilih file video MP4.";convert.disabled=true;return;}
    if(file.size>MAX_FILE_BYTES){meta.textContent="Ukuran file "+formatSize(file.size)+" melebihi batas 100 MB.";convert.disabled=true;return;}
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
      if(note){note.hidden=false;note.textContent="Pratinjau tidak dapat diputar oleh browser HP ini (kemungkinan codec video tidak didukung). Kami sedang membaca durasi MP4; ekstraksi audio tetap bisa dicoba.";}
      status("Codec video tidak didukung untuk pratinjau. Kamu tetap bisa mencoba ekstrak audionya.");
      recoverDuration(file,token);
    };
    preview.load();
    convert.disabled=false;progress(0,"idle");
    status("Video dipilih. Jika pratinjau tidak muncul, coba konversi audio; codec tertentu memang tidak didukung pemutar bawaan HP.");
  }

  async function fetchBlobUrl(url,mime,signal,label) {
    const timeout=new AbortController();
    const timer=setTimeout(()=>timeout.abort(),FETCH_TIMEOUT_MS);
    const abort=()=>timeout.abort();
    signal.addEventListener("abort",abort,{once:true});
    try {
      const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"force-cache",signal:timeout.signal});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const total=Number(response.headers.get("content-length"))||0,reader=response.body?.getReader();
      if(!reader)return URL.createObjectURL(new Blob([await response.arrayBuffer()],{type:mime}));
      const chunks=[];let received=0;
      while(true) {
        const part=await reader.read();if(part.done)break;
        chunks.push(part.value);received+=part.value.byteLength;
        if(total){const base=label==="WASM"?4:2,span=label==="WASM"?14:2;progress(base+Math.min(span,received/total*span));status((label==="WASM"?"Mengunduh komponen mesin MP3 · ":"Memuat komponen FFmpeg · ")+formatSize(received)+" / "+formatSize(total)+"…");}
      }
      return URL.createObjectURL(new Blob(chunks,{type:mime}));
    } catch(error) {
      if(signal.aborted)throw new Error("Proses dibatalkan.");
      throw new Error("Gagal mengunduh komponen "+label+": "+String(error?.message||error));
    } finally {
      clearTimeout(timer);signal.removeEventListener("abort",abort);
    }
  }
  async function fetchWithFallback(paths,mime,signal,label) {
    let lastError;
    for(const path of paths) {
      if(signal.aborted)throw new Error("Proses dibatalkan.");
      try{return await fetchBlobUrl(path,mime,signal,label);}
      catch(error){lastError=error;if(signal.aborted)throw error;}
    }
    throw lastError||new Error("Komponen "+label+" tidak tersedia.");
  }
  async function importWithFallback(signal) {
    let lastError;
    for(const url of MODULE_URLS) {
      if(signal.aborted)throw new Error("Proses dibatalkan.");
      try {
        const mod=await Promise.race([
          import(url),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error("Waktu pemuatan library FFmpeg habis.")),45000))
        ]);
        if(mod?.FFmpeg)return mod;
        throw new Error("Library FFmpeg tidak menyediakan kelas FFmpeg.");
      } catch(error){lastError=error;}
    }
    throw new Error("Library FFmpeg gagal dimuat: "+String(lastError?.message||lastError));
  }
  async function loadEngine(signal) {
    if(ffmpeg?.loaded)return ffmpeg;
    if(ffmpegPromise)return ffmpegPromise;
    ffmpegPromise=(async()=>{
      let instance=null,coreURL="",wasmURL="";
      try {
        status("Mengunduh library konversi…");progress(2);
        const mod=await importWithFallback(signal);
        if(signal.aborted)throw new Error("Proses dibatalkan.");
        instance=new mod.FFmpeg();
        const corePaths=CORE_BASES.map(base=>base+"/ffmpeg-core.js");
        const wasmPaths=CORE_BASES.map(base=>base+"/ffmpeg-core.wasm");
        [coreURL,wasmURL]=await Promise.all([
          fetchWithFallback(corePaths,"text/javascript",signal,"CORE"),
          fetchWithFallback(wasmPaths,"application/wasm",signal,"WASM")
        ]);
        if(signal.aborted)throw new Error("Proses dibatalkan.");
        status("Menyiapkan worker FFmpeg…");progress(19);
        const workerURL=new URL(WORKER_URL,location.origin).href;
        let timer;
        try {
          await Promise.race([
            instance.load({coreURL,wasmURL,classWorkerURL:workerURL},{signal}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Worker FFmpeg tidak berhasil aktif dalam 90 detik. Muat ulang halaman dan coba lagi.")),LOAD_TIMEOUT_MS);})
          ]);
        } finally {clearTimeout(timer);}
        if(signal.aborted)throw new Error("Proses dibatalkan.");
        if(!instance.loaded)throw new Error("Worker FFmpeg belum siap.");
        ffmpeg=instance;
        return instance;
      } catch(error) {
        if(instance){try{instance.terminate();}catch{}}
        throw error;
      } finally {
        if(coreURL)URL.revokeObjectURL(coreURL);
        if(wasmURL)URL.revokeObjectURL(wasmURL);
      }
    })().catch(error=>{ffmpegPromise=null;throw error;});
    return ffmpegPromise;
  }
  function showResult(blob,filename) {
    if(resultUrl)URL.revokeObjectURL(resultUrl);
    resultUrl=URL.createObjectURL(blob);
    const box=$("audioStudioResult");box.replaceChildren();box.hidden=false;
    const title=document.createElement("b");title.textContent="Konversi MP3 berhasil ✓";
    const meta=document.createElement("small");meta.textContent=filename+" · "+formatSize(blob.size)+" · siap disimpan";
    const audio=document.createElement("audio");audio.controls=true;audio.preload="metadata";audio.src=resultUrl;audio.style.cssText="display:block;width:100%;margin:10px 0 12px";
    const link=document.createElement("a");link.href=resultUrl;link.download=filename;link.textContent="↓ Unduh MP3";
    box.append(title,meta,audio,link);
  }
  async function convert() {
    if(!selectedFile||running)return;
    const file=selectedFile;
    cancelled=false;controller=new AbortController();busy(true);
    $("audioStudioResult").hidden=true;progress(1);status("Menyiapkan konversi…");
    const inputName="aryanzz-input.mp4",outputName="aryanzz-audio.mp3";
    let engine=null;
    try {
      engine=await loadEngine(controller.signal);
      if(cancelled||controller.signal.aborted)throw new Error("Proses dibatalkan.");
      status("Membaca file video…");progress(20);
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(!bytes.length)throw new Error("File tidak dapat dibaca.");
      status("Memasukkan video ke mesin konversi · "+formatSize(bytes.byteLength));progress(21);
      await engine.writeFile(inputName,bytes);
      const bitrate=Number($("audioStudioBitrate").value)||192;
      const logHandler=event=>{
        const line=String(event?.message||"");
        const match=line.match(/Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
        if(match)status("Video terbaca · durasi "+match[1]+" · mulai mengekstrak audio…");
      };
      const progressHandler=event=>{
        const n=Number(event?.progress);
        if(Number.isFinite(n)){progress(22+Math.max(0,Math.min(1,n))*75);status("Mengonversi MP4 ke MP3 · "+Math.round(n*100)+"%");}
      };
      engine.on("log",logHandler);engine.on("progress",progressHandler);
      try {
        const code=await engine.exec(["-i",inputName,"-map","0:a:0","-vn","-c:a","libmp3lame","-b:a",bitrate+"k","-ar","44100","-id3v2_version","3","-y",outputName],300000);
        if(code!==0)throw new Error("FFmpeg tidak dapat mengekstrak audio. Pastikan file memiliki trek suara dan format MP4 valid.");
      } finally {engine.off("log",logHandler);engine.off("progress",progressHandler);}
      if(cancelled||controller.signal.aborted)throw new Error("Proses dibatalkan.");
      const output=await engine.readFile(outputName);
      if(!output||output.length<1024)throw new Error("Hasil MP3 kosong. Pastikan video memiliki suara.");
      const filename=safeName($("audioStudioName").value||file.name)+".mp3";
      showResult(new Blob([output],{type:"audio/mpeg"}),filename);
      progress(100,"done");status("Selesai! Putar pratinjau audio atau unduh file MP3.");
    } catch(error) {
      const message=cancelled||controller?.signal.aborted?"Proses dibatalkan.":String(error?.message||error).slice(0,240);
      progress(0,cancelled?"idle":"failed");status(message);
    } finally {
      if(engine?.loaded){try{await engine.deleteFile(inputName);}catch{}try{await engine.deleteFile(outputName);}catch{}}
      controller=null;cancelled=false;busy(false);
    }
  }
  fileInput.addEventListener("change",()=>selectFile(fileInput.files?.[0]));
  $("audioStudioConvert").addEventListener("click",convert);
  $("audioStudioCancel").addEventListener("click",()=>{
    cancelled=true;controller?.abort();
    if(ffmpeg){try{ffmpeg.terminate();}catch{}ffmpeg=null;ffmpegPromise=null;}
    status("Membatalkan proses…");
  });
  window.addEventListener("pagehide",()=>{
    if(ffmpeg){try{ffmpeg.terminate();}catch{}}
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    if(resultUrl)URL.revokeObjectURL(resultUrl);
  });
})();