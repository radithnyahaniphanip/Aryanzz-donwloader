/* ARYANZZ V74 — local MP4/audio to MP3 studio */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fileInput = $("audioStudioFile");
  if (!fileInput) return;
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const HISTORY_KEY = "aryanzz.audio-studio.history.v74";
  const SETTINGS_KEY = "aryanzz.audio-studio.settings.v75";
  const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const moduleUrl = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
  const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
  let selectedFile = null, ffmpeg = null, ffmpegPromise = null, controller = null;
  let previewUrl = "", resultUrl = "", cancelled = false, running = false;

  const formatSize = bytes => bytes < 1048576 ? (bytes / 1024).toFixed(0) + " KB" : (bytes / 1048576).toFixed(1) + " MB";
  const safeName = value => String(value || "aryanzz-audio").normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/\.[^.]+$/, "").slice(0, 80) || "aryanzz-audio";
  const setStatus = message => { const node = $("audioStudioStatus"); if (node) node.textContent = message; };
  const safeMetadata = value => String(value || "").replace(/[\\u0000-\\u001f\\u007f]/g, " ").replace(/\\s+/g, " ").trim().slice(0, 120);
  function setProgress(value, state = "running") {
    const track = $("audioStudioProgressTrack"), bar = $("audioStudioProgressBar");
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    if (bar) bar.style.width = percent.toFixed(1) + "%";
    if (track) { track.setAttribute("aria-valuenow", String(Math.round(percent))); track.classList.toggle("is-running", state === "running"); track.classList.toggle("is-failed", state === "failed"); }
  }
  function setBusy(value) {
    running = value;
    $("audioStudioConvert").disabled = value || !selectedFile;
    $("audioStudioCancel").hidden = !value;
    fileInput.disabled = value;
    ["audioStudioBitrate","audioStudioName","audioStudioTitle","audioStudioArtist","audioStudioPitch","audioStudioTempo","audioStudioVolume"].forEach(id=>{const control=$(id);if(control)control.disabled=value;});
    $("audioStudioEq").querySelectorAll("input").forEach(input => input.disabled = value);
  }
  function restoreSettings(){
    try{
      const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");
      const set=(id,value,min,max)=>{const node=$(id);if(node&&value!==undefined&&Number.isFinite(Number(value)))node.value=String(Math.max(min,Math.min(max,Number(value))));};
      set("audioStudioPitch",saved.pitch,-12,12);set("audioStudioTempo",saved.tempo,50,200);set("audioStudioVolume",saved.volume,50,200);set("audioStudioBitrate",saved.bitrate,128,320);
      if($("audioStudioName")&&saved.name)$("audioStudioName").value=String(saved.name).slice(0,90);
      if($("audioStudioTitle")&&saved.title)$("audioStudioTitle").value=String(saved.title).slice(0,100);
      if($("audioStudioArtist")&&saved.artist)$("audioStudioArtist").value=String(saved.artist).slice(0,80);
      if(Array.isArray(saved.eq))$("audioStudioEq").querySelectorAll("input").forEach((input,index)=>{if(Number.isFinite(Number(saved.eq[index])))input.value=String(Math.max(-12,Math.min(12,Number(saved.eq[index]))));});
    }catch{}
  }
  function saveSettings(){
    try{
      localStorage.setItem(SETTINGS_KEY,JSON.stringify({
        pitch:Number($("audioStudioPitch").value),tempo:Number($("audioStudioTempo").value),
        volume:Number($("audioStudioVolume").value),bitrate:Number($("audioStudioBitrate").value),
        name:$("audioStudioName").value,title:$("audioStudioTitle").value,artist:$("audioStudioArtist").value,
        eq:[...$("audioStudioEq").querySelectorAll("input")].map(input=>Number(input.value))
      }));
    }catch{}
  }
  function updateControls() {
    $("audioStudioPitchValue").textContent = Number($("audioStudioPitch").value) + " semitone";
    $("audioStudioTempoValue").textContent = $("audioStudioTempo").value + "%";
    $("audioStudioVolumeValue").textContent = $("audioStudioVolume").value + "%";
    $("audioStudioEq").querySelectorAll("input").forEach(input => {
      const output = input.parentElement.querySelector("output");
      if (output) output.textContent = Number(input.value) + " dB";
    });
    saveSettings();
  }
  function applyPreset(name) {
    const presets = {
      bass: [5, 7, 5, 3, 0, -1, 0, 1, 2, 2],
      vocal: [-2, -1, 0, 2, 3, 4, 3, 2, 0, -1],
      treble: [-2, -1, 0, 0, 0, 1, 2, 4, 5, 4],
      flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };
    const values = presets[name] || presets.flat;
    $("audioStudioEq").querySelectorAll("input").forEach((input, index) => { input.value = String(values[index]); });
    updateControls();
    setStatus("Preset " + name + " diterapkan. Pengaturan akan dipakai saat ekspor.");
  }
  function updateSelectedFile(file) {
    selectedFile = file || null;
    const meta = $("audioStudioFileMeta"), preview = $("audioStudioPreview"), convert = $("audioStudioConvert");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    $("audioStudioResult").hidden = true;
    $("audioStudioResult").replaceChildren();
    if (!selectedFile) {
      meta.textContent = "Belum ada file dipilih.";
      preview.hidden = true;
      convert.disabled = true;
      return;
    }
    const ext = selectedFile.name.split(".").pop().toLowerCase();
    const supported = /^(mp4|m4v|mov|webm|mkv|mp3|m4a|aac|wav|ogg|oga|flac|3gp)$/i.test(ext) || /^audio\//i.test(selectedFile.type);
    if (!supported) {
      selectedFile = null; meta.textContent = "Format file belum didukung. Pilih MP4, MOV, WEBM, MP3, M4A, WAV, OGG, atau FLAC."; convert.disabled = true; return;
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      selectedFile = null; meta.textContent = "File " + formatSize(file.size) + " melewati batas 100 MB agar browser HP tidak kehabisan memori."; convert.disabled = true; return;
    }
    meta.textContent = selectedFile.name + " · " + formatSize(selectedFile.size) + " · diproses lokal";
    $("audioStudioName").value = safeName(selectedFile.name);
    $("audioStudioTitle").value = safeName(selectedFile.name);
    saveSettings();
    previewUrl = URL.createObjectURL(selectedFile);
    preview.src = previewUrl;
    preview.hidden = false;
    preview.load();
    convert.disabled = false;
    setProgress(0, "idle");
    setStatus("File siap. Atur suara, lalu tekan Konversi ke MP3.");
  }
  async function fetchBlobUrl(url, mime, signal, label) {
    const response = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache", signal });
    if (!response.ok) throw new Error("CDN mesin audio menjawab HTTP " + response.status + ".");
    const total = Number(response.headers.get("content-length")) || 0, reader = response.body?.getReader();
    if (!reader) return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: mime }));
    const chunks = []; let received = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      chunks.push(part.value); received += part.value.byteLength;
      if (label === "WASM" && total > 0) {
        setProgress(5 + Math.min(14, received / total * 14));
        setStatus("Mengunduh mesin MP3 · " + formatSize(received) + (total ? " / " + formatSize(total) : "") + "…");
      }
    }
    return URL.createObjectURL(new Blob(chunks, { type: mime }));
  }
  async function loadEngine(signal) {
    if (ffmpeg) return ffmpeg;
    if (ffmpegPromise) return ffmpegPromise;
    ffmpegPromise = (async () => {
      setStatus("Memuat modul konversi MP3…"); setProgress(3);
      const mod = await import(moduleUrl);
      if (signal.aborted) throw new Error("Proses dibatalkan.");
      const instance = new mod.FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        fetchBlobUrl(coreBase + "/ffmpeg-core.js", "text/javascript", signal, "CORE"),
        fetchBlobUrl(coreBase + "/ffmpeg-core.wasm", "application/wasm", signal, "WASM")
      ]);
      try {
        setStatus("Menyiapkan mesin audio lokal…"); setProgress(19);
        await instance.load({ coreURL, wasmURL, classWorkerURL: new URL("/ffmpeg-worker-bootstrap.js?v=75.0", location.origin).href });
        if (signal.aborted) { instance.terminate(); throw new Error("Proses dibatalkan."); }
        ffmpeg = instance;
        return instance;
      } catch (error) { instance.terminate(); throw error; }
      finally { URL.revokeObjectURL(coreURL); URL.revokeObjectURL(wasmURL); }
    })().catch(error => { ffmpegPromise = null; throw error; });
    return ffmpegPromise;
  }
  function buildFilters() {
    const filters = [];
    const semitones = Number($("audioStudioPitch").value) || 0;
    if (semitones) {
      const ratio = Math.pow(2, semitones / 12);
      filters.push("asetrate=44100*" + ratio.toFixed(6), "aresample=44100", "atempo=" + (1 / ratio).toFixed(6));
    }
    const tempo = Math.max(0.5,Math.min(2,Number($("audioStudioTempo").value)/100||1));
    if(Math.abs(tempo-1)>0.001)filters.push("atempo="+tempo.toFixed(3));
    const volume = Number($("audioStudioVolume").value) / 100;
    if (Math.abs(volume - 1) > 0.001) filters.push("volume=" + volume.toFixed(2));
    $("audioStudioEq").querySelectorAll("input").forEach(input => {
      const gain = Number(input.value) || 0, frequency = Number(input.dataset.frequency);
      if (gain) filters.push("equalizer=f=" + frequency + ":t=q:w=1:g=" + gain.toFixed(1));
    });
    filters.push("alimiter=limit=0.95");
    return filters;
  }
  function saveHistory(filename, bytes) {
    try {
      const old = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const next = [{ filename, bytes, at: Date.now(), pitch: Number($("audioStudioPitch").value), tempo:Number($("audioStudioTempo").value), volume: Number($("audioStudioVolume").value), bitrate: Number($("audioStudioBitrate").value), title:safeMetadata($("audioStudioTitle").value), artist:safeMetadata($("audioStudioArtist").value) }, ...(Array.isArray(old) ? old : [])].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
  }
  function showResult(blob, filename) {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    const box = $("audioStudioResult"); box.replaceChildren(); box.hidden = false;
    const title = document.createElement("b"); title.textContent = "MP3 berhasil dibuat ✓";
    const meta = document.createElement("small"); meta.textContent = filename + " · " + formatSize(blob.size) + " · siap disimpan";
    const audio = document.createElement("audio"); audio.controls = true; audio.preload = "metadata"; audio.src = resultUrl; audio.style.cssText = "display:block;width:100%;margin:8px 0 12px";
    const link = document.createElement("a"); link.href = resultUrl; link.download = filename; link.textContent = "↓ Unduh MP3";
    box.append(title, meta, audio, link);
    saveHistory(filename, blob.size);
  }
  async function convert() {
    if (!selectedFile || running) return;
    cancelled = false; controller = new AbortController(); setBusy(true);
    $("audioStudioConvert").textContent = "Memproses…"; $("audioStudioResult").hidden = true;
    setProgress(1); setStatus("Membaca file dan menyiapkan konversi…");
    let inputName = "aryanzz-source." + (selectedFile.name.split(".").pop().toLowerCase() || "mp4");
    try {
      const engine = await loadEngine(controller.signal);
      if (cancelled || controller.signal.aborted) throw new Error("Proses dibatalkan.");
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      if (!bytes.byteLength) throw new Error("File kosong atau tidak dapat dibaca.");
      setStatus("Memuat file ke mesin audio · " + formatSize(bytes.byteLength) + "…"); setProgress(20);
      await engine.writeFile(inputName, bytes);
      const filters = buildFilters(), bitrate = Number($("audioStudioBitrate").value) || 192;
      const outputName = "aryanzz-output.mp3";
      const titleTag=safeMetadata($("audioStudioTitle").value||$("audioStudioName").value||"ARYANZZ Audio");
      const artistTag=safeMetadata($("audioStudioArtist").value);
      const args = ["-i", inputName, "-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-b:a", bitrate + "k", "-ar", "44100", "-id3v2_version", "3", "-write_id3v1", "1", "-metadata", "title="+titleTag];
      if(artistTag)args.push("-metadata","artist="+artistTag);
      args.push("-af",filters.join(","),"-y",outputName);
      const progressHandler = event => {
        const value = Number(event?.progress);
        if (Number.isFinite(value)) { const percent = Math.max(0, Math.min(1, value)); setProgress(20 + percent * 78); setStatus("Mengonversi audio ke MP3 · " + Math.round(percent * 100) + "%"); }
      };
      engine.on("progress", progressHandler);
      try {
        setStatus("Mengonversi audio dan menerapkan efek…");
        const code = await engine.exec(args, 300000);
        if (code !== 0) throw new Error("FFmpeg gagal mengolah audio (kode " + code + "). Pastikan file memiliki trek suara.");
      } finally { engine.off?.("progress", progressHandler); }
      if (cancelled || controller.signal.aborted) throw new Error("Proses dibatalkan.");
      const output = await engine.readFile(outputName);
      if (!output || output.length < 1024) throw new Error("Hasil MP3 kosong. File mungkin tidak memiliki trek audio.");
      const filename = safeName($("audioStudioName").value) + ".mp3";
      const blob = new Blob([output], { type: "audio/mpeg" });
      showResult(blob, filename); setProgress(100, "done");
      setStatus("Konversi selesai. Pratinjau hasil atau tekan Unduh MP3.");
    } catch (error) {
      const message = cancelled || controller?.signal.aborted ? "Proses dibatalkan." : String(error?.message || error).slice(0, 240);
      setProgress(0, cancelled ? "idle" : "failed"); setStatus(message);
    } finally {
      if (ffmpeg && inputName) { try { await ffmpeg.deleteFile(inputName); } catch {} try { await ffmpeg.deleteFile("aryanzz-output.mp3"); } catch {} }
      controller = null; cancelled = false; setBusy(false); $("audioStudioConvert").textContent = "Konversi ke MP3";
    }
  }
  fileInput.addEventListener("change", () => updateSelectedFile(fileInput.files?.[0]));
  $("audioStudioPitch").addEventListener("input", updateControls);
  $("audioStudioTempo").addEventListener("input", updateControls);
  $("audioStudioVolume").addEventListener("input", updateControls);
  ["audioStudioName","audioStudioTitle","audioStudioArtist","audioStudioBitrate"].forEach(id=>$(id).addEventListener("input",saveSettings));
  $("audioStudioBitrate").addEventListener("change",saveSettings);
  $("audioStudioEq").addEventListener("input", updateControls);
  $("audioStudioEqReset").addEventListener("click", () => applyPreset("flat"));
  document.querySelectorAll("[data-audio-preset]").forEach(button => button.addEventListener("click", () => applyPreset(button.dataset.audioPreset)));
  $("audioStudioConvert").addEventListener("click", convert);
  $("audioStudioCancel").addEventListener("click", () => {
    cancelled = true; controller?.abort();
    if (ffmpeg) { try { ffmpeg.terminate(); } catch {} ffmpeg = null; ffmpegPromise = null; }
    setStatus("Membatalkan proses konversi…");
  });
  window.addEventListener("pagehide", () => { if (ffmpeg) { try { ffmpeg.terminate(); } catch {} } if (previewUrl) URL.revokeObjectURL(previewUrl); if (resultUrl) URL.revokeObjectURL(resultUrl); });
  restoreSettings();
  updateControls();
})();
