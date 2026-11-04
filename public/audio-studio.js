/* ARYANZZ V89 — focused local MP4 to MP3 converter */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fileInput = $("audioStudioFile");
  if (!fileInput) return;
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const moduleUrl = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
  const LOAD_TIMEOUT_MS = 60000;
  const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
  let selectedFile = null, ffmpeg = null, ffmpegPromise = null, controller = null;
  let previewUrl = "", resultUrl = "", cancelled = false, running = false;

  const formatSize = bytes => bytes < 1048576 ? (bytes / 1024).toFixed(0) + " KB" : (bytes / 1048576).toFixed(1) + " MB";
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
  function selectFile(file) {
    selectedFile=null;
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl="";}
    const preview=$("audioStudioPreview"),meta=$("audioStudioFileMeta"),convert=$("audioStudioConvert"),result=$("audioStudioResult");
    if(result){result.hidden=true;result.replaceChildren();}
    if(!file){meta.textContent="Belum ada video dipilih.";preview.hidden=true;preview.removeAttribute("src");convert.disabled=true;return;}
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if(!["mp4","m4v"].includes(ext) && file.type!=="video/mp4"){meta.textContent="Format tidak didukung. Pilih file video MP4.";convert.disabled=true;return;}
    if(file.size>MAX_FILE_BYTES){meta.textContent="Ukuran file "+formatSize(file.size)+" melebihi batas 100 MB.";convert.disabled=true;return;}
    if(!file.size){meta.textContent="File kosong atau tidak dapat dibaca.";convert.disabled=true;return;}
    selectedFile=file;
    meta.textContent=file.name+" · "+formatSize(file.size)+" · siap dikonversi";
    $("audioStudioName").value=safeName(file.name);
    previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.hidden=false;preview.load();
    convert.disabled=false;progress(0,"idle");status("Video siap. Pilih kualitas MP3 lalu tekan Konversi ke MP3.");
  }
  async function blobUrl(url,mime,signal,label) {
    const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"force-cache",signal});
    if(!response.ok)throw new Error("Gagal memuat mesin konversi (HTTP "+response.status+").");
    const total=Number(response.headers.get("content-length"))||0,reader=response.body?.getReader();
    if(!reader)return URL.createObjectURL(new Blob([await response.arrayBuffer()],{type:mime}));
    const chunks=[];let received=0;
    while(true){const part=await reader.read();if(part.done)break;chunks.push(part.value);received+=part.value.byteLength;
      if(total){const base=label==="WASM"?4:2,span=label==="WASM"?14:2;progress(base+Math.min(span,received/total*span));status((label==="WASM"?"Mengunduh komponen mesin MP3 · ":"Memuat komponen FFmpeg · ")+formatSize(received)+(total?" / "+formatSize(total):"")+"…");}}
    return URL.createObjectURL(new Blob(chunks,{type:mime}));
  }
  async function loadEngine(signal) {
    if(ffmpeg)return ffmpeg;if(ffmpegPromise)return ffmpegPromise;
    ffmpegPromise=(async()=>{
      status("Memuat mesin konversi MP3…");progress(2);
      const mod=await import(moduleUrl);if(signal.aborted)throw new Error("Proses dibatalkan.");
      const instance=new mod.FFmpeg();
      const [coreURL,wasmURL]=await Promise.all([
        blobUrl(coreBase+"/ffmpeg-core.js","text/javascript",signal,"CORE"),
        blobUrl(coreBase+"/ffmpeg-core.wasm","application/wasm",signal,"WASM")
      ]);
      try{status("Mengaktifkan mesin konversi…");progress(19);
        const workerURL=new URL("/ffmpeg-worker-bootstrap.js?v=89.2",location.origin).href;
        await Promise.race([
          instance.load({coreURL,wasmURL,classWorkerURL:workerURL}),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error("Mesin FFmpeg tidak merespons dalam 60 detik. Periksa koneksi internet lalu muat ulang halaman.")),LOAD_TIMEOUT_MS))
        ]);
        if(signal.aborted){instance.terminate();throw new Error("Proses dibatalkan.");}
        ffmpeg=instance;return instance;
      }catch(error){instance.terminate();throw error;}
      finally{URL.revokeObjectURL(coreURL);URL.revokeObjectURL(wasmURL);}
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
    cancelled=false;controller=new AbortController();busy(true);$("audioStudioResult").hidden=true;progress(1);status("Membaca video MP4…");
    const inputName="aryanzz-input.mp4",outputName="aryanzz-audio.mp3";
    try{
      const engine=await loadEngine(controller.signal);
      if(cancelled||controller.signal.aborted)throw new Error("Proses dibatalkan.");
      status("Membaca video MP4 dari perangkat…");progress(20);
      const bytes=new Uint8Array(await selectedFile.arrayBuffer());
      if(!bytes.length)throw new Error("File tidak dapat dibaca.");
      status("Memasukkan video ke mesin konversi · "+formatSize(bytes.byteLength));progress(20);
      await engine.writeFile(inputName,bytes);
      const bitrate=Number($("audioStudioBitrate").value)||192;
      const progressHandler=event=>{const n=Number(event?.progress);if(Number.isFinite(n)){progress(20+Math.max(0,Math.min(1,n))*78);status("Mengonversi MP4 ke MP3 · "+Math.round(n*100)+"%");}};
      engine.on("progress",progressHandler);
      try{
        const code=await engine.exec(["-i",inputName,"-map","0:a:0","-vn","-c:a","libmp3lame","-b:a",bitrate+"k","-ar","44100","-id3v2_version","3","-y",outputName],300000);
        if(code!==0)throw new Error("Video tidak memiliki trek audio yang dapat dikonversi.");
      }finally{engine.off?.("progress",progressHandler);}
      if(cancelled||controller.signal.aborted)throw new Error("Proses dibatalkan.");
      const output=await engine.readFile(outputName);
      if(!output||output.length<1024)throw new Error("Hasil MP3 kosong. Pastikan video memiliki suara.");
      const filename=safeName($("audioStudioName").value||selectedFile.name)+".mp3";
      const blob=new Blob([output],{type:"audio/mpeg"});
      showResult(blob,filename);progress(100,"done");status("Selesai! Putar pratinjau atau unduh file MP3.");
    }catch(error){
      const message=cancelled||controller?.signal.aborted?"Proses dibatalkan.":String(error?.message||error).slice(0,220);
      progress(0,cancelled?"idle":"failed");status(message);
    }finally{
      if(ffmpeg){try{await ffmpeg.deleteFile(inputName);}catch{}try{await ffmpeg.deleteFile(outputName);}catch{}}
      controller=null;cancelled=false;busy(false);
    }
  }
  fileInput.addEventListener("change",()=>selectFile(fileInput.files?.[0]));
  $("audioStudioConvert").addEventListener("click",convert);
  $("audioStudioCancel").addEventListener("click",()=>{
    cancelled=true;controller?.abort();
    if(ffmpeg){try{ffmpeg.terminate();}catch{}ffmpeg=null;ffmpegPromise=null;}
    status("Membatalkan konversi…");
  });
  window.addEventListener("pagehide",()=>{if(ffmpeg){try{ffmpeg.terminate();}catch{}}if(previewUrl)URL.revokeObjectURL(previewUrl);if(resultUrl)URL.revokeObjectURL(resultUrl);});
})();