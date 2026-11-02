/* ARYANZZ V74.0 — browser-local MP4 to audio converter and sound controls */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const SETTINGS_KEY = "aryanzz.audio.studio.v74";
  const HISTORY_KEY = "aryanzz.audio.history.v74";
  const MAX_FILE_BYTES = 120 * 1024 * 1024;
  const CONTROL_IDS = [
    "audioOutputFormat","audioBitrate","audioFilename","audioTitle","audioArtist",
    "audioAlbum","audioYear","audioGenre","audioKeywords","audioPitch","audioTempo",
    "audioVolume","audioEq60","audioEq250","audioEq1000","audioEq4000","audioEq12000"
  ];
  const DEFAULTS = {
    audioOutputFormat:"mp3",audioBitrate:"320",audioFilename:"",audioTitle:"",
    audioArtist:"",audioAlbum:"",audioYear:"",audioGenre:"",audioKeywords:"",
    audioPitch:"0",audioTempo:"1",audioVolume:"100",audioEq60:"0",
    audioEq250:"0",audioEq1000:"0",audioEq4000:"0",audioEq12000:"0"
  };
  const $status = () => $("audioStudioStatus");
  let selectedFile = null;
  let ffmpeg = null;
  let ffmpegPromise = null;
  let running = false;
  let cancelRequested = false;
  let outputUrl = null;
  let sourceUrl = null;

  function setStatus(message, isError=false) {
    const node = $status();
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("warning", !!isError);
    node.setAttribute("aria-live","polite");
  }
  function safeRead(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  }
  function saveSettings() {
    const data = {};
    CONTROL_IDS.forEach(id => { const node=$(id); if(node) data[id]=node.value; });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
      const saved = $("audioSettingsStatus");
      if(saved) saved.textContent = "Pengaturan tersimpan otomatis di perangkat ini.";
      window.dispatchEvent(new Event("aryanzz:backup-change"));
    } catch {
      const saved = $("audioSettingsStatus");
      if(saved) saved.textContent = "Penyimpanan penuh. Pengaturan belum tersimpan.";
    }
  }
  function loadSettings() {
    const stored = safeRead(SETTINGS_KEY,{});
    CONTROL_IDS.forEach(id => {
      const node=$(id);
      if(node && stored && stored[id] !== undefined) node.value=String(stored[id]);
    });
    updateRangeLabels();
  }
  function updateRangeLabels() {
    const map = [
      ["audioPitch","audioPitchValue",v => (Number(v)>0?"+":"")+Number(v).toFixed(1)+" semitone"],
      ["audioTempo","audioTempoValue",v => Number(v).toFixed(2)+"×"],
      ["audioVolume","audioVolumeValue",v => Number(v)+"%"],
      ["audioEq60","audioEq60Value",v => (Number(v)>0?"+":"")+Number(v)+" dB"],
      ["audioEq250","audioEq250Value",v => (Number(v)>0?"+":"")+Number(v)+" dB"],
      ["audioEq1000","audioEq1000Value",v => (Number(v)>0?"+":"")+Number(v)+" dB"],
      ["audioEq4000","audioEq4000Value",v => (Number(v)>0?"+":"")+Number(v)+" dB"],
      ["audioEq12000","audioEq12000Value",v => (Number(v)>0?"+":"")+Number(v)+" dB"]
    ];
    map.forEach(([inputId,outputId,format]) => {
      const input=$(inputId),output=$(outputId);
      if(input&&output) output.textContent=format(input.value);
    });
  }
  function fileSize(bytes) {
    if(bytes < 1024*1024) return Math.round(bytes/1024)+" KB";
    return (bytes/1048576).toFixed(1)+" MB";
  }
  function cleanName(value) {
    return String(value||"aryanzz-audio").replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().slice(0,90)||"aryanzz-audio";
  }
  function triggerDownload(blob, filename) {
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function rememberOutput(item) {
    const old=safeRead(HISTORY_KEY,[]);
    const list=[item,...(Array.isArray(old)?old.filter(x=>x.name!==item.name):[])].slice(0,20);
    try { localStorage.setItem(HISTORY_KEY,JSON.stringify(list)); } catch {}
    const listNode=$("audioHistory");
    if(listNode) {
      listNode.replaceChildren();
      if(!list.length) listNode.textContent="Belum ada hasil konversi.";
      list.forEach(row=>{
        const line=document.createElement("div");
        line.className="saved-row";
        const name=document.createElement("b");
        name.textContent=row.name;
        const meta=document.createElement("small");
        meta.textContent=new Date(row.at).toLocaleString("id-ID")+" · "+row.format.toUpperCase();
        line.append(name,meta);listNode.append(line);
      });
    }
    window.dispatchEvent(new Event("aryanzz:backup-change"));
  }
  function renderHistory() {
    const node=$("audioHistory");
    if(!node)return;
    const list=safeRead(HISTORY_KEY,[]);
    node.replaceChildren();
    if(!Array.isArray(list)||!list.length){node.textContent="Belum ada hasil konversi.";return;}
    list.forEach(row=>{
      const line=document.createElement("div");line.className="saved-row";
      const name=document.createElement("b");name.textContent=row.name||"File audio";
      const meta=document.createElement("small");meta.textContent=new Date(row.at).toLocaleString("id-ID")+" · "+String(row.format||"").toUpperCase();
      line.append(name,meta);node.append(line);
    });
  }
  function updateFilePreview() {
    const file=selectedFile;
    const name=$("audioFileName"),audio=$("audioSourcePreview"),video=$("audioVideoPreview");
    if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
    if(!file) {
      if(name)name.textContent="Belum ada file dipilih";
      if(audio){audio.pause();audio.removeAttribute("src");audio.hidden=true;}
      if(video){video.pause();video.removeAttribute("src");video.hidden=true;}
      return;
    }
    sourceUrl=URL.createObjectURL(file);
    if(name)name.textContent=file.name+" · "+fileSize(file.size);
    const isVideo=file.type.startsWith("video/")||/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name);
    if(video&&audio) {
      if(isVideo){audio.pause();audio.hidden=true;video.hidden=false;video.src=sourceUrl;video.load();}
      else{video.pause();video.hidden=true;audio.hidden=false;audio.src=sourceUrl;audio.load();}
    }
    const title=$("audioTitle"),filename=$("audioFilename");
    const stem=file.name.replace(/\.[^.]+$/,"");
    if(title&&!title.value)title.value=stem;
    if(filename&&!filename.value)filename.value=cleanName(stem);
    saveSettings();
  }
  async function loadFfmpeg() {
    if(ffmpeg) return ffmpeg;
    if(ffmpegPromise) return ffmpegPromise;
    setStatus("Mengunduh mesin konversi lokal. Pertahankan halaman tetap terbuka…");
    ffmpegPromise=(async()=>{
      const moduleUrl="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
      const coreBase="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      const fetchBlob=async(url,type)=>{
        const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"force-cache"});
        if(!response.ok)throw new Error("CDN FFmpeg menjawab HTTP "+response.status);
        return URL.createObjectURL(new Blob([await response.arrayBuffer()],{type}));
      };
      let coreURL=null,wasmURL=null;
      try {
        const module=await import(moduleUrl);
        const engine=new module.FFmpeg();
        [coreURL,wasmURL]=await Promise.all([
          fetchBlob(coreBase+"/ffmpeg-core.js","text/javascript"),
          fetchBlob(coreBase+"/ffmpeg-core.wasm","application/wasm")
        ]);
        await engine.load({
          coreURL,
          wasmURL,
          classWorkerURL:new URL("/ffmpeg-worker-bootstrap.js?v=73.7",location.origin).href
        });
        ffmpeg=engine;
        return engine;
      } finally {
        if(coreURL)URL.revokeObjectURL(coreURL);
        if(wasmURL)URL.revokeObjectURL(wasmURL);
      }
    })().catch(error=>{ffmpegPromise=null;throw error;});
    return ffmpegPromise;
  }
  function setProgress(value) {
    const bar=$("audioProgressBar");
    if(bar)bar.style.width=Math.max(0,Math.min(100,value))+"%";
  }
  function metadataArgs() {
    const pairs=[
      ["title","audioTitle"],["artist","audioArtist"],["album","audioAlbum"],
      ["date","audioYear"],["genre","audioGenre"]
    ];
    const args=["-map_metadata","-1"];
    pairs.forEach(([tag,id])=>{
      const value=$(id)?.value.trim();
      if(value)args.push("-metadata",tag+"="+value.slice(0,180));
    });
    const keywords=$("audioKeywords")?.value.trim();
    if(keywords)args.push("-metadata","comment=Keywords: "+keywords.slice(0,400));
    return args;
  }
  function audioFilter() {
    const filters=[];
    const semitones=Number($("audioPitch")?.value||0);
    const pitchFactor=Math.pow(2,semitones/12);
    if(Math.abs(semitones)>.01) {
      filters.push("asetrate=48000*"+pitchFactor.toFixed(6));
      filters.push("aresample=48000");
      filters.push("atempo="+(1/pitchFactor).toFixed(6));
    }
    const tempo=Number($("audioTempo")?.value||1);
    if(Math.abs(tempo-1)>.005)filters.push("atempo="+tempo.toFixed(4));
    const volume=Math.max(0,Math.min(2,Number($("audioVolume")?.value||100)/100));
    filters.push("volume="+volume.toFixed(3));
    const bands=[
      [60,"audioEq60"],[250,"audioEq250"],[1000,"audioEq1000"],
      [4000,"audioEq4000"],[12000,"audioEq12000"]
    ];
    bands.forEach(([freq,id])=>{
      const gain=Number($(id)?.value||0);
      if(Math.abs(gain)>.05)filters.push("equalizer=f="+freq+":width_type=q:width=1:g="+gain.toFixed(2));
    });
    return filters.join(",");
  }
  function outputExtension() {
    return $("audioOutputFormat")?.value||"mp3";
  }
  async function convert() {
    if(running)return;
    if(!selectedFile){setStatus("Pilih file MP4 atau audio terlebih dahulu.",true);return;}
    if(selectedFile.size>MAX_FILE_BYTES){setStatus("File terlalu besar untuk pemrosesan stabil di browser HP. Batas saat ini 120 MB.",true);return;}
    const format=outputExtension(),bitrate=$("audioBitrate")?.value||"320";
    const base=cleanName($("audioFilename")?.value||selectedFile.name.replace(/\.[^.]+$/,"")).replace(/\.[a-z0-9]{2,5}$/i,"");
    const filename=base+"."+format;
    const sourceExt=(selectedFile.name.match(/\.([a-z0-9]{2,8})$/i)?.[1]||"mp4").toLowerCase();
    const inputName="aryanzz-input."+sourceExt;
    const outputName="aryanzz-output."+format;
    const convertButton=$("audioConvert"),cancelButton=$("audioCancel");
    running=true;
    cancelRequested=false;
    if(convertButton){convertButton.disabled=true;convertButton.textContent="Mengonversi…";}
    if(cancelButton){cancelButton.hidden=false;cancelButton.disabled=false;}
    setProgress(0);
    try {
      const engine=await loadFfmpeg();
      if(cancelRequested)throw new Error("Proses dibatalkan.");
      setStatus("Menyiapkan file dan filter audio…");
      await engine.writeFile(inputName,new Uint8Array(await selectedFile.arrayBuffer()));
      if(cancelRequested)throw new Error("Proses dibatalkan.");
      const args=["-y","-i",inputName,"-vn","-map","0:a:0?","-af",audioFilter(),...metadataArgs()];
      if(format==="mp3")args.push("-c:a","libmp3lame","-b:a",bitrate+"k","-id3v2_version","3");
      else if(format==="m4a")args.push("-c:a","aac","-b:a",bitrate==="320"?"256k":bitrate+"k","-movflags","+faststart");
      else args.push("-c:a","pcm_s16le");
      args.push(outputName);
      const progressHandler=event=>{
        const value=Number(event?.progress);
        if(Number.isFinite(value))setProgress(Math.round(Math.max(0,Math.min(.99,value)) * 100));
      };
      engine.on("progress",progressHandler);
      setStatus("Mengonversi audio dan menerapkan pengaturan…");
      let code;
      try { code=await engine.exec(args,300000); }
      finally { engine.off("progress",progressHandler); }
      if(cancelRequested)throw new Error("Proses dibatalkan.");
      if(code!==0)throw new Error("Mesin konversi tidak dapat menyelesaikan file. Coba format lain atau file yang lebih kecil.");
      const result=await engine.readFile(outputName);
      if(!result||result.length<256)throw new Error("Hasil konversi kosong atau tidak lengkap.");
      const mime=format==="mp3"?"audio/mpeg":format==="m4a"?"audio/mp4":"audio/wav";
      const blob=new Blob([result],{type:mime});
      if(outputUrl)URL.revokeObjectURL(outputUrl);
      outputUrl=URL.createObjectURL(blob);
      const output=$("audioOutputResult");
      if(output){
        output.hidden=false;output.replaceChildren();
        const title=document.createElement("b");title.textContent="Konversi berhasil · "+filename;
        const detail=document.createElement("p");detail.className="muted";detail.textContent=fileSize(blob.size)+" · "+format.toUpperCase()+" · hasil disimpan di perangkat saat kamu mengunduhnya.";
        const preview=document.createElement("audio");preview.controls=true;preview.src=outputUrl;preview.className="v74-audio-preview";
        const link=document.createElement("a");link.className="primary";link.href=outputUrl;link.download=filename;link.textContent="⬇ Simpan "+format.toUpperCase();
        output.append(title,detail,preview,link);
      }
      setProgress(100);
      setStatus("Selesai. Dengarkan hasilnya, lalu tekan Simpan untuk mengunduh file.");
      rememberOutput({name:filename,format,at:Date.now(),size:blob.size});
      try { await engine.deleteFile(inputName); await engine.deleteFile(outputName); } catch {}
    } catch(error) {
      if(cancelRequested)setStatus("Proses dibatalkan. File sumber asli tidak diubah.");
      else setStatus(error?.message||"Konversi gagal. Periksa koneksi dan coba lagi.",true);
      setProgress(0);
    } finally {
      running=false;
      if(convertButton){convertButton.disabled=false;convertButton.textContent="Konversi sekarang";}
      if(cancelButton){cancelButton.hidden=true;cancelButton.disabled=false;}
    }
  }
  function applyPreset(name) {
    const presets={
      flat:[0,0,0,0,0],
      bass:[6,4,0,-1,-2],
      vocal:[-3,1,4,3,-2],
      treble:[-2,-1,0,4,6],
      club:[5,3,0,3,4]
    };
    const values=presets[name]||presets.flat;
    ["audioEq60","audioEq250","audioEq1000","audioEq4000","audioEq12000"].forEach((id,i)=>{const node=$(id);if(node)node.value=String(values[i]);});
    updateRangeLabels();saveSettings();
  }
  async function copyKeywords() {
    const title=$("audioTitle")?.value.trim()||"";
    const keywords=$("audioKeywords")?.value.trim()||"";
    const text=[title,keywords].filter(Boolean).join("\n");
    if(!text){setStatus("Isi judul dan kata kunci terlebih dahulu.",true);return;}
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Judul dan kata kunci berhasil disalin untuk kolom upload YouTube.");
    } catch {
      setStatus("Clipboard tidak tersedia. Salin judul dan kata kunci secara manual.",true);
    }
  }
  function cancel() {
    if(!running)return;
    cancelRequested=true;
    try { ffmpeg?.terminate(); } catch {}
    ffmpeg=null;ffmpegPromise=null;
    setStatus("Membatalkan proses konversi…");
    setProgress(0);
    if($("audioCancel"))$("audioCancel").disabled=true;
  }
  function init() {
    if(!$("audioStudio"))return;
    loadSettings();
    CONTROL_IDS.forEach(id=>{
      const node=$(id);
      node?.addEventListener("input",()=>{updateRangeLabels();saveSettings();});
      node?.addEventListener("change",()=>{updateRangeLabels();saveSettings();});
    });
    $("audioInput")?.addEventListener("change",event=>{
      selectedFile=event.target.files?.[0]||null;
      if(selectedFile&&selectedFile.size>MAX_FILE_BYTES){
        setStatus("File melebihi batas 120 MB. Pilih file lebih kecil agar HP tidak kehabisan memori.",true);
        selectedFile=null;event.target.value="";updateFilePreview();return;
      }
      updateFilePreview();
      setStatus(selectedFile?"File siap. Atur pitch, tempo, equalizer, dan nama hasil.":"Belum ada file dipilih.");
    });
    $("audioPreset")?.addEventListener("change",event=>applyPreset(event.target.value));
    $("audioSaveSettings")?.addEventListener("click",()=>{saveSettings();setStatus("Pengaturan audio berhasil disimpan di perangkat ini.");});
    $("audioResetSettings")?.addEventListener("click",()=>{
      Object.entries(DEFAULTS).forEach(([id,value])=>{if($(id))$(id).value=value;});
      updateRangeLabels();saveSettings();setStatus("Pengaturan audio dikembalikan ke nilai awal.");
    });
    $("audioCopyKeywords")?.addEventListener("click",copyKeywords);
    $("audioConvert")?.addEventListener("click",convert);
    $("audioCancel")?.addEventListener("click",cancel);
    renderHistory();
    setStatus("Pilih video atau audio untuk memulai. Semua pemrosesan dilakukan di browser.");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();