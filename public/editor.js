/* ARYANZZ V59.5 — local single-clip video editor */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fileInput = $("editorFile");
  const video = $("editorPreview");
  const frame = $("editorPreviewFrame");
  const empty = $("editorEmpty");
  const status = $("editorStatus");
  const output = $("editorOutput");
  const exportButton = $("editorExport");
  const playButton = $("editorPlay");
  const progressBar = $("editorProgressFill");
  if (!fileInput || !video || !frame || !exportButton) return;

  let sourceUrl = "";
  let exportUrl = "";
  let recorder = null;
  let recordingStream = null;
  let sourceStream = null;
  let chunks = [];
  let animationFrame = 0;
  let exporting = false;
  let clipDuration = 0;

  const startInput = $("editorStart");
  const endInput = $("editorEnd");
  const startLabel = $("editorStartLabel");
  const endLabel = $("editorEndLabel");
  const clock = $("editorClock");
  const textInput = $("editorText");
  const overlay = $("editorOverlay");

  const seconds = value => Math.max(0, Number(value) || 0);
  const time = value => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    return h ? [h, String(m).padStart(2, "0"), String(s).padStart(2, "0")].join(":") : [m, String(s).padStart(2, "0")].join(":");
  };
  function message(text, kind) {
    status.textContent = text;
    status.dataset.state = kind || "info";
  }
  function selectedStart() { return seconds(startInput.value); }
  function selectedEnd() { return Math.max(selectedStart() + 0.1, seconds(endInput.value)); }
  function updateLabels() {
    startLabel.textContent = selectedStart().toFixed(1) + "s";
    endLabel.textContent = selectedEnd().toFixed(1) + "s";
    if (clipDuration) clock.textContent = time(video.currentTime) + " / " + time(clipDuration);
  }
  function updatePreview() {
    const brightness = Number($("editorBrightness").value) || 100;
    const contrast = Number($("editorContrast").value) || 100;
    const saturation = Number($("editorSaturation").value) || 100;
    const rotate = Number($("editorRotate").value) || 0;
    video.style.filter = "brightness(" + brightness + "%) contrast(" + contrast + "%) saturate(" + saturation + "%)";
    video.style.transform = "rotate(" + rotate + "deg)";
    frame.dataset.ratio = $("editorRatio").value;
    overlay.textContent = textInput.value.trim();
    overlay.hidden = !textInput.value.trim();
    overlay.dataset.position = $("editorTextPosition").value;
    video.playbackRate = Number($("editorSpeed").value) || 1;
    $("editorBrightnessValue").textContent = brightness + "%";
    $("editorContrastValue").textContent = contrast + "%";
    $("editorSaturationValue").textContent = saturation + "%";
    updateLabels();
  }
  function setEditorEnabled(enabled) {
    [playButton, exportButton, startInput, endInput, $("editorRatio"), $("editorRotate"), $("editorSpeed"), $("editorFilterPreset"), $("editorBrightness"), $("editorContrast"), $("editorSaturation"), $("editorText"), $("editorTextPosition"), $("editorMute"), $("editorQuality"), $("editorReset")].forEach(el => {
      if (el) el.disabled = !enabled;
    });
  }
  function preset(name) {
    const values = {
      none: [100, 100, 100],
      vivid: [108, 112, 135],
      cinematic: [96, 118, 82],
      mono: [100, 112, 0],
      warm: [106, 105, 118]
    }[name] || [100, 100, 100];
    $("editorBrightness").value = values[0];
    $("editorContrast").value = values[1];
    $("editorSaturation").value = values[2];
    updatePreview();
  }
  function dimensions() {
    const ratio = $("editorRatio").value;
    if (ratio === "9:16") return [720, 1280];
    if (ratio === "1:1") return [1080, 1080];
    if (ratio === "4:5") return [864, 1080];
    return [1280, 720];
  }
  function drawFrame(ctx, canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const rotate = ((Number($("editorRotate").value) || 0) % 360 + 360) % 360;
    const swapped = rotate === 90 || rotate === 270;
    const orientedWidth = swapped ? video.videoHeight : video.videoWidth;
    const orientedHeight = swapped ? video.videoWidth : video.videoHeight;
    const scale = Math.max(width / orientedWidth, height / orientedHeight);
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.filter = "brightness(" + $("editorBrightness").value + "%) contrast(" + $("editorContrast").value + "%) saturate(" + $("editorSaturation").value + "%)";
    ctx.translate(width / 2, height / 2);
    ctx.rotate(rotate * Math.PI / 180);
    ctx.drawImage(video, -video.videoWidth * scale / 2, -video.videoHeight * scale / 2, video.videoWidth * scale, video.videoHeight * scale);
    ctx.restore();
    ctx.filter = "none";
    const caption = textInput.value.trim();
    if (caption) {
      const position = $("editorTextPosition").value;
      const fontSize = Math.max(24, Math.round(width * 0.045));
      ctx.save();
      ctx.font = "900 " + fontSize + "px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.82)";
      ctx.lineWidth = Math.max(3, fontSize * 0.13);
      ctx.shadowColor = "rgba(0,0,0,.7)";
      ctx.shadowBlur = 12;
      const y = position === "top" ? height * 0.12 : position === "middle" ? height * 0.5 : height * 0.88;
      ctx.strokeText(caption, width / 2, y, width * 0.86);
      ctx.fillText(caption, width / 2, y, width * 0.86);
      ctx.restore();
    }
  }
  function stopTracks() {
    if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
    if (sourceStream) sourceStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
    sourceStream = null;
  }
  function finishExport() {
    cancelAnimationFrame(animationFrame);
    exporting = false;
    exportButton.disabled = false;
    playButton.disabled = false;
    video.pause();
    stopTracks();
    if (!chunks.length) {
      message("Ekspor berhenti sebelum menghasilkan file. Coba ulangi dengan kualitas lebih rendah.", "error");
      return;
    }
    const mime = recorder && recorder.mimeType ? recorder.mimeType : "video/webm";
    const blob = new Blob(chunks, { type: mime });
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(blob);
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const link = document.createElement("a");
    link.href = exportUrl;
    link.download = "aryanzz-edit-" + Date.now() + "." + ext;
    link.textContent = "↓ Unduh hasil edit (" + ext.toUpperCase() + ")";
    output.replaceChildren();
    const title = document.createElement("b");
    title.textContent = "Video berhasil diekspor";
    const details = document.createElement("small");
    details.textContent = (blob.size / 1048576).toFixed(1) + " MB · " + ext.toUpperCase() + " · disimpan langsung ke perangkat";
    output.append(title, details, link);
    output.hidden = false;
    progressBar.style.width = "100%";
    message("Selesai. Periksa file hasil edit di unduhan perangkat.", "ready");
    recorder = null;
    chunks = [];
  }
  function renderLoop(ctx, canvas, endAt, startAt) {
    if (!exporting || !recorder || recorder.state !== "recording") return;
    if (video.currentTime >= endAt || video.ended) {
      try { recorder.stop(); } catch {}
      return;
    }
    if (video.readyState >= 2) drawFrame(ctx, canvas);
    const pct = Math.max(0, Math.min(99, ((video.currentTime - startAt) / Math.max(0.1, endAt - startAt)) * 100));
    progressBar.style.width = pct.toFixed(1) + "%";
    message("Mengekspor video… " + Math.round(pct) + "%", "busy");
    animationFrame = requestAnimationFrame(() => renderLoop(ctx, canvas, endAt, startAt));
  }
  async function exportVideo() {
    if (!sourceUrl || exporting) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      message("Browser ini belum mendukung ekspor video. Coba Chrome atau Edge versi terbaru.", "error");
      return;
    }
    if (!video.videoWidth || !video.videoHeight) {
      message("Video belum siap. Tunggu preview selesai dimuat.", "error");
      return;
    }
    const startAt = selectedStart();
    const endAt = Math.min(clipDuration, selectedEnd());
    if (endAt <= startAt) {
      message("Atur titik akhir setelah titik mulai.", "error");
      return;
    }
    const canvas = document.createElement("canvas");
    const size = dimensions();
    canvas.width = size[0];
    canvas.height = size[1];
    const ctx = canvas.getContext("2d", { alpha: false });
    const canvasStream = canvas.captureStream(30);
    const muted = $("editorMute").checked;
    video.muted = muted;
    if (!muted) {
      const capture = video.captureStream || video.mozCaptureStream;
      if (capture) {
        try {
          sourceStream = capture.call(video);
          sourceStream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
        } catch {}
      }
    }
    recordingStream = canvasStream;
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"];
    const mime = candidates.find(type => MediaRecorder.isTypeSupported(type));
    const quality = $("editorQuality").value;
    const bitrate = quality === "high" ? 6500000 : quality === "low" ? 1800000 : 3500000;
    chunks = [];
    try {
      recorder = new MediaRecorder(recordingStream, mime ? { mimeType: mime, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate });
    } catch {
      stopTracks();
      message("Browser tidak dapat membuat format video yang didukung.", "error");
      return;
    }
    recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
    recorder.onerror = () => {
      exporting = false;
      exportButton.disabled = false;
      stopTracks();
      message("Terjadi kesalahan saat merekam hasil edit.", "error");
    };
    recorder.onstop = finishExport;
    exportButton.disabled = true;
    playButton.disabled = true;
    output.hidden = true;
    progressBar.style.width = "0%";
    exporting = true;
    try {
      video.playbackRate = Number($("editorSpeed").value) || 1;
      video.currentTime = startAt;
      await new Promise(resolve => {
        if (Math.abs(video.currentTime - startAt) < 0.05) return resolve();
        video.addEventListener("seeked", resolve, { once: true });
      });
      drawFrame(ctx, canvas);
      recorder.start(500);
      await video.play();
      renderLoop(ctx, canvas, endAt, startAt);
      message("Ekspor berjalan. Jangan tutup halaman sampai selesai.", "busy");
    } catch (error) {
      exporting = false;
      exportButton.disabled = false;
      playButton.disabled = false;
      try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch {}
      stopTracks();
      message("Video tidak dapat diputar untuk ekspor: " + (error.message || "izin pemutaran ditolak."), "error");
    }
  }
  function resetEdits() {
    $("editorRatio").value = "16:9";
    $("editorRotate").value = "0";
    $("editorSpeed").value = "1";
    $("editorFilterPreset").value = "none";
    $("editorBrightness").value = "100";
    $("editorContrast").value = "100";
    $("editorSaturation").value = "100";
    $("editorText").value = "";
    $("editorTextPosition").value = "bottom";
    $("editorMute").checked = false;
    $("editorQuality").value = "standard";
    if (clipDuration) {
      startInput.value = "0";
      endInput.value = String(clipDuration);
    }
    updatePreview();
    output.hidden = true;
    progressBar.style.width = "0%";
    message("Pengaturan edit dikembalikan ke awal.", "info");
  }
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      message("Pilih file video, seperti MP4, WebM, atau MOV.", "error");
      return;
    }
    if (file.size > 300 * 1024 * 1024) {
      message("Ukuran file maksimal 300 MB agar aman diproses di browser HP.", "error");
      fileInput.value = "";
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    video.src = sourceUrl;
    video.load();
    $("editorFileName").textContent = file.name + " · " + (file.size / 1048576).toFixed(1) + " MB";
    output.hidden = true;
    message("Memuat video lokal…", "info");
  });
  video.addEventListener("loadedmetadata", () => {
    clipDuration = Number(video.duration) || 0;
    startInput.max = String(clipDuration);
    endInput.max = String(clipDuration);
    startInput.value = "0";
    endInput.value = String(clipDuration);
    empty.hidden = true;
    setEditorEnabled(true);
    updatePreview();
    message("Video siap diedit. File tetap berada di perangkat kamu.", "ready");
  });
  video.addEventListener("timeupdate", () => {
    updateLabels();
    if (!exporting && !video.paused && video.currentTime >= selectedEnd()) {
      video.pause();
      playButton.textContent = "▶ Preview";
    }
  });
  playButton.addEventListener("click", async () => {
    if (!sourceUrl) return;
    if (video.paused) {
      if (video.currentTime < selectedStart() || video.currentTime >= selectedEnd()) video.currentTime = selectedStart();
      video.playbackRate = Number($("editorSpeed").value) || 1;
      try { await video.play(); playButton.textContent = "Ⅱ Pause"; }
      catch { message("Preview tidak dapat diputar. Coba tekan tombol lagi.", "error"); }
    } else {
      video.pause();
      playButton.textContent = "▶ Preview";
    }
  });
  video.addEventListener("pause", () => { if (!exporting) playButton.textContent = "▶ Preview"; });
  [startInput, endInput].forEach(input => input.addEventListener("input", () => {
    if (input === startInput && Number(startInput.value) >= Number(endInput.value)) endInput.value = String(Math.min(clipDuration, Number(startInput.value) + 0.1));
    if (input === endInput && Number(endInput.value) <= Number(startInput.value)) startInput.value = String(Math.max(0, Number(endInput.value) - 0.1));
    updateLabels();
  }));
  ["editorRatio", "editorRotate", "editorSpeed", "editorBrightness", "editorContrast", "editorSaturation", "editorText", "editorTextPosition", "editorMute"].forEach(id => {
    $(id).addEventListener("input", updatePreview);
    $(id).addEventListener("change", updatePreview);
  });
  $("editorFilterPreset").addEventListener("change", event => preset(event.target.value));
  $("editorReset").addEventListener("click", resetEdits);
  exportButton.addEventListener("click", exportVideo);
  setEditorEnabled(false);
  updatePreview();
})();