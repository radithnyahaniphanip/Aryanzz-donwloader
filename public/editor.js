/* ARYANZZ V60.0 — Creative Studio Pro: multi-clip local editor */
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
  const clipList = $("editorClipList");
  const musicInput = $("editorMusicFile");
  const musicAudio = $("editorMusicAudio");
  if (!fileInput || !video || !frame || !exportButton || !clipList) return;

  const MAX_CLIPS = 8;
  const MAX_FILE = 300 * 1024 * 1024;
  let clips = [];
  const archive = new Map();
  let selectedId = null;
  let musicFile = null;
  let musicUrl = "";
  let exportUrl = "";
  let recorder = null;
  let recordingStream = null;
  let animationFrame = 0;
  let exporting = false;
  let exportError = "";
  let pendingProject = null;
  let history = [];
  let future = [];
  let audioContext = null;
  let audioDestination = null;
  let videoSourceNode = null;
  let musicSourceNode = null;
  let videoPreviewGain = null;
  let videoRecordGain = null;
  let musicPreviewGain = null;
  let musicRecordGain = null;

  const startInput = $("editorStart");
  const endInput = $("editorEnd");
  const startLabel = $("editorStartLabel");
  const endLabel = $("editorEndLabel");
  const clock = $("editorClock");
  const scrub = $("editorScrub");
  const textInput = $("editorText");
  const overlay = $("editorOverlay");
  const time = value => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    return h ? [h,String(m).padStart(2,"0"),String(s).padStart(2,"0")].join(":") : [m,String(s).padStart(2,"0")].join(":");
  };
  const seconds = value => Math.max(0, Number(value) || 0);
  const makeId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "clip-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const selectedClip = () => clips.find(clip => clip.id === selectedId) || null;
  const settingsIds = [
    "editorRatio","editorRotate","editorSpeed","editorTransition","editorFilterPreset",
    "editorBrightness","editorContrast","editorSaturation","editorText","editorTextColor",
    "editorTextPosition","editorTextSize","editorMute","editorResolution","editorQuality"
  ];

  function message(text, kind) {
    status.textContent = text;
    status.dataset.state = kind || "info";
  }
  function getSettings() {
    const settings = {};
    settingsIds.forEach(id => {
      const el = $(id);
      if (el) settings[id] = el.type === "checkbox" ? el.checked : el.value;
    });
    settings.editorMusicVolume = $("editorMusicVolume").value;
    return settings;
  }
  function setSettings(settings) {
    if (!settings || typeof settings !== "object") return;
    settingsIds.forEach(id => {
      if (settings[id] === undefined) return;
      const el = $(id);
      if (!el) return;
      if (el.type === "checkbox") el.checked = !!settings[id];
      else el.value = String(settings[id]);
    });
    if (settings.editorMusicVolume !== undefined) $("editorMusicVolume").value = String(settings.editorMusicVolume);
    updatePreview();
    updateMusicVolume();
  }
  function snapshot() {
    return {
      clips: clips.map(clip => ({ id:clip.id,start:clip.start,end:clip.end })),
      selectedId,
      settings:getSettings()
    };
  }
  function recordUndo() {
    history.push(snapshot());
    if (history.length > 40) history.shift();
    future = [];
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    $("editorUndo").disabled = history.length === 0 || exporting;
    $("editorRedo").disabled = future.length === 0 || exporting;
  }
  async function restoreSnapshot(state) {
    if (!state) return;
    clips = state.clips.map(item => {
      const original = archive.get(item.id);
      return original ? Object.assign({},original,{start:item.start,end:item.end}) : null;
    }).filter(Boolean);
    selectedId = clips.some(clip => clip.id === state.selectedId) ? state.selectedId : (clips[0] && clips[0].id) || null;
    setSettings(state.settings);
    renderTimeline();
    await loadSelectedClip();
    updateEditorState();
  }
  async function undo() {
    if (!history.length || exporting) return;
    future.push(snapshot());
    const state = history.pop();
    await restoreSnapshot(state);
    updateHistoryButtons();
    message("Perubahan terakhir dibatalkan.", "info");
  }
  async function redo() {
    if (!future.length || exporting) return;
    history.push(snapshot());
    const state = future.pop();
    await restoreSnapshot(state);
    updateHistoryButtons();
    message("Perubahan diterapkan kembali.", "info");
  }
  function armUndo(el) {
    if (!el) return;
    el.addEventListener("focus",() => {
      if (el.dataset.undoArmed !== "1") {
        recordUndo();
        el.dataset.undoArmed = "1";
      }
    });
    el.addEventListener("change",() => { delete el.dataset.undoArmed; });
    el.addEventListener("blur",() => { delete el.dataset.undoArmed; });
  }
  function formatBytes(bytes) {
    return bytes >= 1024 * 1024 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1,Math.round(bytes / 1024)) + " KB";
  }
  function totalDuration() {
    return clips.reduce((sum,clip) => sum + Math.max(0,clip.end - clip.start),0);
  }
  function updateEditorState() {
    const hasClips = clips.length > 0;
    const clip = selectedClip();
    const enabledIds = [
      "editorPlay","editorJumpStart","editorScrub","editorStart","editorEnd",
      "editorRatio","editorRotate","editorSpeed","editorTransition","editorFilterPreset",
      "editorBrightness","editorContrast","editorSaturation","editorText","editorTextColor",
      "editorTextPosition","editorTextSize","editorMute","editorResolution","editorQuality",
      "editorReset","editorExport"
    ];
    enabledIds.forEach(id => { const el=$(id); if(el) el.disabled = !hasClips || exporting; });
    $("editorSplit").disabled = !clip || exporting;
    $("editorMoveUp").disabled = !clip || clips.findIndex(item=>item.id===selectedId)<=0 || exporting;
    $("editorMoveDown").disabled = !clip || clips.findIndex(item=>item.id===selectedId)>=clips.length-1 || exporting;
    $("editorRemoveClip").disabled = !clip || exporting;
    $("editorMusicVolume").disabled = !musicFile || exporting;
    $("editorRemoveMusic").disabled = !musicFile || exporting;
    $("editorSaveProject").disabled = !hasClips || exporting;
    $("editorClipCount").textContent = clips.length + " klip · " + totalDuration().toFixed(1) + " detik";
    $("editorFileName").textContent = hasClips ? clips.length + " klip dimuat · " + formatBytes(clips.reduce((s,c)=>s+c.file.size,0)) : "Belum ada klip";
    $("editorSelectedClipName").textContent = clip ? clip.file.name : "Belum ada klip dipilih";
    $("editorPreviewMeta").textContent = $("editorRatio").value + " · " + $("editorResolution").value + "p canvas";
    empty.hidden = hasClips;
    updateHistoryButtons();
  }
  function selectedStart() {
    const clip = selectedClip();
    return clip ? clip.start : 0;
  }
  function selectedEnd() {
    const clip = selectedClip();
    return clip ? clip.end : 0;
  }
  function updateLabels() {
    const clip = selectedClip();
    startLabel.textContent = selectedStart().toFixed(1) + "s";
    endLabel.textContent = selectedEnd().toFixed(1) + "s";
    if (clip) {
      clock.textContent = time(video.currentTime) + " / " + time(clip.duration);
      scrub.max = String(clip.duration);
      scrub.value = String(Math.min(clip.duration,video.currentTime || 0));
    } else {
      clock.textContent = "00:00 / 00:00";
      scrub.max = "0";
      scrub.value = "0";
    }
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
    overlay.style.color = $("editorTextColor").value;
    overlay.style.fontSize = $("editorTextSize").value + "px";
    video.playbackRate = Number($("editorSpeed").value) || 1;
    $("editorBrightnessValue").textContent = brightness + "%";
    $("editorContrastValue").textContent = contrast + "%";
    $("editorSaturationValue").textContent = saturation + "%";
    $("editorTextSizeValue").textContent = $("editorTextSize").value + " px";
    $("editorPreviewMeta").textContent = $("editorRatio").value + " · " + $("editorResolution").value + "p canvas";
    updateLabels();
  }
  function preset(name) {
    const values = {
      none:[100,100,100], vivid:[108,112,135], cinematic:[96,118,82],
      mono:[100,112,0], warm:[106,105,118], cool:[103,108,112]
    }[name] || [100,100,100];
    $("editorBrightness").value = values[0];
    $("editorContrast").value = values[1];
    $("editorSaturation").value = values[2];
    updatePreview();
  }
  function readDuration(url) {
    return new Promise((resolve,reject) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        const duration = Number(probe.duration);
        probe.removeAttribute("src");
        probe.load();
        Number.isFinite(duration) && duration > 0 ? resolve(duration) : reject(new Error("Durasi video tidak terbaca."));
      };
      probe.onerror = () => reject(new Error("File video tidak dapat dibaca oleh browser."));
      probe.src = url;
    });
  }
  function waitForEvent(target, success, failure, timeout) {
    return new Promise((resolve,reject) => {
      let timer = 0;
      const cleanup = () => {
        clearTimeout(timer);
        target.removeEventListener(success,onSuccess);
        if (failure) target.removeEventListener(failure,onFailure);
      };
      const onSuccess = () => { cleanup(); resolve(); };
      const onFailure = () => { cleanup(); reject(new Error("Video gagal dimuat.")); };
      target.addEventListener(success,onSuccess,{once:true});
      if (failure) target.addEventListener(failure,onFailure,{once:true});
      timer = setTimeout(() => { cleanup(); reject(new Error("Waktu memuat video habis.")); },timeout || 15000);
    });
  }
  async function loadClipMedia(clip) {
    if (!clip) return;
    if (video.src !== clip.url) {
      video.pause();
      const ready = waitForEvent(video,"loadedmetadata","error",20000);
      video.src = clip.url;
      video.load();
      await ready;
    }
    clip.duration = Number(video.duration) || clip.duration;
    clip.start = Math.max(0,Math.min(clip.start,Math.max(0,clip.duration-0.1)));
    clip.end = Math.max(clip.start+0.1,Math.min(clip.end,clip.duration));
    startInput.max = String(clip.duration);
    endInput.max = String(clip.duration);
    startInput.value = String(clip.start);
    endInput.value = String(clip.end);
    $("editorSelectedClipName").textContent = clip.file.name;
    empty.hidden = true;
    updatePreview();
  }
  async function seekVideo(value) {
    const target = Math.max(0,Math.min(Number(value)||0,video.duration||0));
    if (Math.abs(video.currentTime-target) < 0.035) return;
    const done = waitForEvent(video,"seeked","error",10000);
    video.currentTime = target;
    await done;
  }
  async function loadSelectedClip() {
    const clip = selectedClip();
    if (!clip) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      empty.hidden = false;
      updateLabels();
      return;
    }
    try {
      await loadClipMedia(clip);
      await seekVideo(clip.start);
      updatePreview();
    } catch(error) {
      message(error.message,"error");
    }
  }
  function renderTimeline() {
    clipList.replaceChildren();
    if (!clips.length) {
      const note = document.createElement("div");
      note.className = "editor-timeline-empty";
      note.textContent = "Klip video akan muncul di sini. Tambahkan beberapa klip untuk menyusun cerita.";
      clipList.append(note);
      updateEditorState();
      return;
    }
    clips.forEach((clip,index) => {
      const card = document.createElement("div");
      card.className = "editor-clip-card" + (clip.id===selectedId ? " is-selected" : "");
      card.dataset.clipId = clip.id;
      const select = document.createElement("button");
      select.type = "button";
      select.className = "editor-clip-select";
      const number = document.createElement("span");
      number.className = "editor-clip-number";
      number.textContent = String(index+1).padStart(2,"0");
      const info = document.createElement("span");
      info.className = "editor-clip-info";
      const name = document.createElement("b");
      name.textContent = clip.file.name;
      const meta = document.createElement("small");
      meta.textContent = time(clip.start) + " — " + time(clip.end) + " · " + Math.max(0,clip.end-clip.start).toFixed(1) + "s";
      info.append(name,meta);
      select.append(number,info);
      select.addEventListener("click",async() => {
        selectedId = clip.id;
        renderTimeline();
        await loadSelectedClip();
        updateEditorState();
      });
      const actions = document.createElement("span");
      actions.className = "editor-clip-actions";
      [["↑","Naik",()=>moveClip(index,-1)],["↓","Turun",()=>moveClip(index,1)],["×","Hapus",()=>removeClip(clip.id)]].forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item[0];
        button.title = item[1];
        button.disabled = exporting || (item[1]==="Naik"&&index===0) || (item[1]==="Turun"&&index===clips.length-1);
        button.addEventListener("click",item[2]);
        actions.append(button);
      });
      card.append(select,actions);
      clipList.append(card);
    });
    updateEditorState();
  }
  function updateClipTrim() {
    const clip = selectedClip();
    if (!clip) return;
    clip.start = seconds(startInput.value);
    clip.end = Math.max(clip.start+0.1,Math.min(clip.duration,seconds(endInput.value)));
    if (clip.end <= clip.start) clip.end = Math.min(clip.duration,clip.start+0.1);
    startInput.value = String(clip.start);
    endInput.value = String(clip.end);
    renderTimeline();
    updateLabels();
  }
  async function addVideoFiles(fileCollection, project) {
    const incoming = Array.from(fileCollection || []);
    if (!incoming.length) return;
    const fileByName = new Map(incoming.map(file => [file.name,file]));
    const descriptors = project && Array.isArray(project.clips)
      ? project.clips.map(item => ({ file:fileByName.get(item.name),item })).filter(x=>x.file)
      : incoming.map(file => ({file,item:null}));
    const remaining = Math.max(0,MAX_CLIPS-clips.length);
    if (descriptors.length > remaining) {
      message("Maksimal " + MAX_CLIPS + " klip dalam satu proyek. " + remaining + " slot tersisa.","error");
    }
    const toAdd = descriptors.slice(0,remaining);
    const urls = new Map();
    let added = 0;
    for (const descriptor of toAdd) {
      const file = descriptor.file;
      if (!file.type.startsWith("video/") || file.size > MAX_FILE) {
        message("Lewati " + file.name + ": file harus video dan maksimal 300 MB.","error");
        continue;
      }
      let url = urls.get(file);
      if (!url) {
        url = URL.createObjectURL(file);
        urls.set(file,url);
      }
      try {
        const duration = await readDuration(url);
        const item = descriptor.item || {};
        const clip = {
          id:makeId(),file,url,duration,
          start:Math.max(0,Math.min(Number(item.start)||0,duration-0.1)),
          end:Math.max(0,Math.min(Number(item.end)||duration,duration))
        };
        if (clip.end <= clip.start) clip.end = duration;
        clips.push(clip);
        archive.set(clip.id,clip);
        added++;
      } catch(error) {
        URL.revokeObjectURL(url);
        message(file.name + ": " + error.message,"error");
      }
    }
    if (project && project.settings) setSettings(project.settings);
    if (added) {
      selectedId = clips[clips.length-1].id;
      renderTimeline();
      await loadSelectedClip();
      message(added + " klip siap diedit. Susun urutan pada timeline.","ready");
    }
    if (project && project.musicName) {
      message("Proyek dibuka. Pilih ulang file musik: " + project.musicName,"info");
    }
    updateEditorState();
  }
  function moveClip(index,direction) {
    const next = index + direction;
    if (next < 0 || next >= clips.length || exporting) return;
    recordUndo();
    const item = clips.splice(index,1)[0];
    clips.splice(next,0,item);
    selectedId = item.id;
    renderTimeline();
    loadSelectedClip();
    message("Urutan klip diperbarui.","info");
  }
  function removeClip(id) {
    if (exporting) return;
    const index = clips.findIndex(clip=>clip.id===id);
    if (index<0) return;
    recordUndo();
    clips.splice(index,1);
    selectedId = clips[Math.min(index,clips.length-1)]?.id || null;
    renderTimeline();
    loadSelectedClip();
    message("Klip dihapus dari timeline. Undo dapat mengembalikannya.","info");
  }
  function splitClip() {
    const clip = selectedClip();
    if (!clip || exporting) return;
    const point = video.currentTime;
    if (point <= clip.start+0.15 || point >= clip.end-0.15) {
      message("Posisikan playhead di tengah klip untuk melakukan split.","error");
      return;
    }
    recordUndo();
    const originalEnd = clip.end;
    const right = Object.assign({},clip,{id:makeId(),start:point,end:originalEnd});
    clip.end = point;
    archive.set(right.id,right);
    const index = clips.findIndex(item=>item.id===clip.id);
    clips.splice(index+1,0,right);
    selectedId = right.id;
    renderTimeline();
    loadSelectedClip();
    message("Klip berhasil dibagi menjadi dua bagian.","ready");
  }
  function dimensions() {
    const ratio = $("editorRatio").value;
    const resolution = Number($("editorResolution").value) || 720;
    if (ratio === "9:16") return [Math.round(resolution*9/16),resolution];
    if (ratio === "1:1") return [resolution,resolution];
    if (ratio === "4:5") return [Math.round(resolution*4/5),resolution];
    return [Math.round(resolution*16/9),resolution];
  }
  function drawCaption(ctx,width,height) {
    const caption = textInput.value.trim();
    if (!caption) return;
    const fontSize = Math.max(18,Number($("editorTextSize").value)||42);
    const position = $("editorTextPosition").value;
    const y = position==="top" ? height*0.12 : position==="middle" ? height*0.5 : height*0.88;
    const maxWidth = width*0.86;
    ctx.save();
    ctx.font = "900 " + fontSize + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = $("editorTextColor").value || "#fff";
    ctx.strokeStyle = "rgba(0,0,0,.86)";
    ctx.lineWidth = Math.max(3,fontSize*0.13);
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0,0,0,.7)";
    ctx.shadowBlur = 10;
    const words = caption.split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach(word => {
      const test = line ? line + " " + word : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    const lineHeight = fontSize*1.16;
    const firstY = y - ((lines.length-1)*lineHeight)/2;
    lines.slice(0,3).forEach((text,index) => {
      const lineY = firstY + index*lineHeight;
      ctx.strokeText(text,width/2,lineY,maxWidth);
      ctx.fillText(text,width/2,lineY,maxWidth);
    });
    ctx.restore();
  }
  function drawFrame(ctx,canvas,fadeAlpha) {
    const width = canvas.width, height = canvas.height;
    const rotate = ((Number($("editorRotate").value)||0)%360+360)%360;
    const rotatedWidth = rotate===90||rotate===270 ? video.videoHeight : video.videoWidth;
    const rotatedHeight = rotate===90||rotate===270 ? video.videoWidth : video.videoHeight;
    const scale = Math.max(width/rotatedWidth,height/rotatedHeight);
    ctx.save();
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,width,height);
    ctx.filter = "brightness("+$("editorBrightness").value+"%) contrast("+$("editorContrast").value+"%) saturate("+$("editorSaturation").value+"%)";
    ctx.translate(width/2,height/2);
    ctx.rotate(rotate*Math.PI/180);
    ctx.drawImage(video,-video.videoWidth*scale/2,-video.videoHeight*scale/2,video.videoWidth*scale,video.videoHeight*scale);
    ctx.restore();
    ctx.filter = "none";
    drawCaption(ctx,width,height);
    if (fadeAlpha !== undefined && fadeAlpha < 1) {
      ctx.fillStyle = "rgba(0,0,0," + Math.max(0,Math.min(1,1-fadeAlpha)) + ")";
      ctx.fillRect(0,0,width,height);
    }
  }
  function setupAudioGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext) audioContext = new AudioContextClass();
    if (!audioDestination) audioDestination = audioContext.createMediaStreamDestination();
    if (!videoSourceNode) {
      videoSourceNode = audioContext.createMediaElementSource(video);
      videoPreviewGain = audioContext.createGain();
      videoRecordGain = audioContext.createGain();
      videoSourceNode.connect(videoPreviewGain);
      videoPreviewGain.connect(audioContext.destination);
      videoSourceNode.connect(videoRecordGain);
      videoRecordGain.connect(audioDestination);
    }
    if (musicFile && !musicSourceNode) {
      musicSourceNode = audioContext.createMediaElementSource(musicAudio);
      musicPreviewGain = audioContext.createGain();
      musicRecordGain = audioContext.createGain();
      musicSourceNode.connect(musicPreviewGain);
      musicPreviewGain.connect(audioContext.destination);
      musicSourceNode.connect(musicRecordGain);
      musicRecordGain.connect(audioDestination);
    }
    return audioDestination;
  }
  function setAudioExportMode(active) {
    if (!audioContext) return;
    const muted = $("editorMute").checked;
    if (videoPreviewGain) videoPreviewGain.gain.setTargetAtTime(active?0:1,audioContext.currentTime,0.02);
    if (videoRecordGain) videoRecordGain.gain.setTargetAtTime(active&&!muted?1:0,audioContext.currentTime,0.02);
    if (musicPreviewGain) musicPreviewGain.gain.setTargetAtTime(0,audioContext.currentTime,0.02);
    if (musicRecordGain) musicRecordGain.gain.setTargetAtTime(active&&musicFile?Number($("editorMusicVolume").value)/100:0,audioContext.currentTime,0.02);
  }
  function setExportProgress(done,total,current,clip) {
    const speed = Number($("editorSpeed").value)||1;
    const clipDone = Math.max(0,current-clip.start)/speed;
    const pct = Math.min(99,Math.max(0,((done+clipDone)/Math.max(0.1,total))*100));
    progressBar.style.width = pct.toFixed(1)+"%";
    message("Mengekspor "+(clips.findIndex(item=>item.id===clip.id)+1)+"/"+clips.length+" · "+Math.round(pct)+"%","busy");
  }
  function renderClipSegment(ctx,canvas,clip,done,total) {
    return new Promise((resolve,reject) => {
      const fadeDuration = $("editorTransition").value==="fade" ? 0.35 : 0;
      const speed = Number($("editorSpeed").value)||1;
      const tick = () => {
        if (!exporting) { reject(new Error("Ekspor dihentikan.")); return; }
        if (video.ended || video.currentTime >= clip.end-0.015) {
          video.pause();
          drawFrame(ctx,canvas,1);
          resolve();
          return;
        }
        if (video.readyState >= 2) {
          let alpha = 1;
          if (fadeDuration > 0) {
            alpha = Math.min(1,(video.currentTime-clip.start)/fadeDuration,(clip.end-video.currentTime)/fadeDuration);
            alpha = Math.max(0,alpha);
          }
          drawFrame(ctx,canvas,alpha);
          setExportProgress(done,total,video.currentTime,clip);
        }
        animationFrame = requestAnimationFrame(tick);
      };
      tick();
    });
  }
  function finishExport() {
    cancelAnimationFrame(animationFrame);
    exporting = false;
    setAudioExportMode(false);
    if (musicAudio) { musicAudio.pause(); musicAudio.currentTime=0; }
    if (recordingStream) recordingStream.getTracks().forEach(track=>track.stop());
    recordingStream = null;
    exportButton.disabled = false;
    updateEditorState();
    if (exportError) {
      message(exportError,"error");
      exportError = "";
      recorder = null;
      return;
    }
    if (!recorder || !recorder.mimeType || !window.MediaRecorder) {
      message("Browser tidak menghasilkan file ekspor.","error");
      recorder = null;
      return;
    }
    const mime = recorder.mimeType || "video/webm";
    const blob = new Blob(exportChunks,{type:mime});
    if (!blob.size) {
      message("File hasil kosong. Coba ekspor ulang dengan resolusi lebih rendah.","error");
      recorder = null;
      return;
    }
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(blob);
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const link = document.createElement("a");
    link.href = exportUrl;
    link.download = "aryanzz-studio-" + Date.now() + "." + ext;
    link.textContent = "↓ Unduh hasil edit ("+ext.toUpperCase()+")";
    output.replaceChildren();
    const title = document.createElement("b");
    title.textContent = "Video berhasil diekspor";
    const details = document.createElement("small");
    details.textContent = (blob.size/1048576).toFixed(1)+" MB · "+ext.toUpperCase()+" · "+clips.length+" klip · file diproses lokal";
    output.append(title,details,link);
    output.hidden = false;
    progressBar.style.width = "100%";
    message("Ekspor selesai. Hasil edit siap diunduh.","ready");
    recorder = null;
    exportChunks = [];
    updateEditorState();
    loadSelectedClip();
  }
  let exportChunks = [];
  async function exportVideo() {
    if (!clips.length || exporting) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      message("Browser ini belum mendukung ekspor video. Gunakan Chrome atau Edge terbaru.","error");
      return;
    }
    if (!video.videoWidth || !video.videoHeight) {
      message("Preview video belum siap. Tunggu sampai video selesai dimuat.","error");
      return;
    }
    const validClips = clips.filter(clip=>clip.end-clip.start>0.1);
    if (!validClips.length) {
      message("Tidak ada durasi klip yang dapat diekspor.","error");
      return;
    }
    const size = dimensions();
    const canvas = document.createElement("canvas");
    canvas.width = size[0];
    canvas.height = size[1];
    const ctx = canvas.getContext("2d",{alpha:false});
    if (!ctx) { message("Canvas tidak tersedia pada browser ini.","error"); return; }
    const canvasStream = canvas.captureStream(30);
    let audioGraph = null;
    try {
      audioGraph = setupAudioGraph();
      if (audioGraph) {
        await audioContext.resume();
        audioGraph.stream.getAudioTracks().forEach(track=>canvasStream.addTrack(track));
      } else {
        const capture = video.captureStream || video.mozCaptureStream;
        if (capture) {
          const fallback = capture.call(video);
          fallback.getAudioTracks().forEach(track=>canvasStream.addTrack(track));
        }
      }
    } catch(error) {
      message("Audio mix tidak tersedia. Video tetap dapat diekspor tanpa musik latar.","error");
    }
    recordingStream = canvasStream;
    setAudioExportMode(true);
    const candidates = ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4"];
    const mime = candidates.find(type=>MediaRecorder.isTypeSupported(type));
    const quality = $("editorQuality").value;
    const bitrate = quality==="high" ? 6500000 : quality==="low" ? 1800000 : 3500000;
    exportChunks = [];
    exportError = "";
    try {
      recorder = new MediaRecorder(recordingStream,mime?{mimeType:mime,videoBitsPerSecond:bitrate}:{videoBitsPerSecond:bitrate});
    } catch(error) {
      setAudioExportMode(false);
      canvasStream.getTracks().forEach(track=>track.stop());
      recordingStream = null;
      message("Browser tidak dapat membuat file ekspor dengan format yang didukung.","error");
      return;
    }
    recorder.ondataavailable = event=>{if(event.data&&event.data.size)exportChunks.push(event.data);};
    recorder.onerror = () => {
      exportError = "Terjadi kesalahan saat merekam hasil edit.";
      exporting = false;
      try { if(recorder&&recorder.state!=="inactive")recorder.stop(); } catch {}
    };
    recorder.onstop = finishExport;
    exportButton.disabled = true;
    playButton.disabled = true;
    output.hidden = true;
    progressBar.style.width = "0%";
    exporting = true;
    updateEditorState();
    try {
      const speed = Number($("editorSpeed").value)||1;
      const total = validClips.reduce((sum,clip)=>sum+(clip.end-clip.start)/speed,0);
      if (musicFile) {
        musicAudio.loop = true;
        musicAudio.currentTime = 0;
        musicAudio.volume = 1;
        await musicAudio.play().catch(()=>{});
      }
      recorder.start(500);
      let done = 0;
      for (const clip of validClips) {
        if (!exporting) throw new Error("Ekspor dihentikan.");
        await loadClipMedia(clip);
        await seekVideo(clip.start);
        video.playbackRate = speed;
        await video.play();
        await renderClipSegment(ctx,canvas,clip,done,total);
        done += (clip.end-clip.start)/speed;
      }
      if (recorder && recorder.state!=="inactive") recorder.stop();
    } catch(error) {
      exportError = error.message || "Ekspor gagal.";
      exporting = false;
      try { if(recorder&&recorder.state!=="inactive")recorder.stop(); else finishExport(); } catch { finishExport(); }
    }
  }
  function resetEdits() {
    recordUndo();
    $("editorRatio").value = "16:9";
    $("editorRotate").value = "0";
    $("editorSpeed").value = "1";
    $("editorTransition").value = "cut";
    $("editorFilterPreset").value = "none";
    $("editorBrightness").value = "100";
    $("editorContrast").value = "100";
    $("editorSaturation").value = "100";
    $("editorText").value = "";
    $("editorTextColor").value = "#ffffff";
    $("editorTextPosition").value = "bottom";
    $("editorTextSize").value = "42";
    $("editorMute").checked = false;
    $("editorResolution").value = "720";
    $("editorQuality").value = "standard";
    updatePreview();
    output.hidden = true;
    progressBar.style.width = "0%";
    message("Pengaturan visual dikembalikan ke awal.","info");
  }
  function updateMusicVolume() {
    const volume = Number($("editorMusicVolume").value)||0;
    $("editorMusicVolumeValue").textContent = volume+"%";
    if (musicAudio) musicAudio.volume = volume/100;
    if (musicRecordGain && audioContext && !exporting) musicRecordGain.gain.setTargetAtTime(0,audioContext.currentTime,0.02);
  }
  function saveProject() {
    if (!clips.length) return;
    const project = {
      app:"ARYANZZ Creative Studio Pro",
      version:"60.0",
      savedAt:new Date().toISOString(),
      settings:getSettings(),
      clips:clips.map(clip=>({name:clip.file.name,start:clip.start,end:clip.end,duration:clip.duration})),
      musicName:musicFile?musicFile.name:null
    };
    const blob = new Blob([JSON.stringify(project,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aryanzz-project-"+Date.now()+".json";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    message("File proyek berhasil disimpan. Simpan juga file video dan musik sumbernya.","ready");
  }
  async function loadProjectFile(file) {
    try {
      const project = JSON.parse(await file.text());
      if (project.app!=="ARYANZZ Creative Studio Pro" || !Array.isArray(project.clips) || project.clips.length>MAX_CLIPS) {
        throw new Error("File proyek ARYANZZ tidak valid atau jumlah klip melebihi batas.");
      }
      pendingProject = project;
      message("Pilih file video sumber dengan nama yang sama seperti saat proyek disimpan.","info");
      fileInput.click();
    } catch(error) {
      message(error.message||"File proyek tidak dapat dibuka.","error");
    }
  }
  function addMusic(file) {
    if (!file) return;
    if (!file.type.startsWith("audio/") || file.size>MAX_FILE) {
      message("Pilih file audio maksimal 300 MB.","error");
      return;
    }
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    musicFile = file;
    musicUrl = URL.createObjectURL(file);
    musicAudio.src = musicUrl;
    musicAudio.loop = true;
    musicAudio.load();
    $("editorMusicName").textContent = file.name;
    $("editorMusicDetail").textContent = formatBytes(file.size)+" · musik latar lokal";
    $("editorMusicVolume").disabled = false;
    $("editorRemoveMusic").disabled = false;
    updateMusicVolume();
    message("Musik latar ditambahkan. Volume dapat diatur pada track audio.","ready");
  }
  function removeMusic() {
    if (!musicFile) return;
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    musicFile = null;
    musicUrl = "";
    musicAudio.pause();
    musicAudio.removeAttribute("src");
    musicAudio.load();
    $("editorMusicName").textContent = "AUDIO TRACK";
    $("editorMusicDetail").textContent = "Belum ada musik latar";
    $("editorMusicVolume").disabled = true;
    $("editorRemoveMusic").disabled = true;
    message("Track musik dihapus.","info");
  }

  fileInput.addEventListener("change",async() => {
    const files = Array.from(fileInput.files||[]);
    if (!files.length) return;
    const project = pendingProject;
    pendingProject = null;
    await addVideoFiles(files,project);
    fileInput.value = "";
  });
  musicInput.addEventListener("change",() => {
    const file = musicInput.files && musicInput.files[0];
    if (file) addMusic(file);
    musicInput.value = "";
  });
  video.addEventListener("loadedmetadata",() => {
    const clip = selectedClip();
    if (!clip || video.src!==clip.url) return;
    clip.duration = Number(video.duration)||clip.duration;
    startInput.max = String(clip.duration);
    endInput.max = String(clip.duration);
    startInput.value = String(clip.start);
    endInput.value = String(clip.end);
    empty.hidden = false;
    updatePreview();
  });
  video.addEventListener("timeupdate",() => {
    updateLabels();
    const clip = selectedClip();
    if (!exporting && clip && !video.paused && video.currentTime>=clip.end) {
      video.pause();
      playButton.textContent = "▶";
    }
  });
  playButton.addEventListener("click",async() => {
    const clip = selectedClip();
    if (!clip || exporting) return;
    if (video.paused) {
      if (video.currentTime<clip.start || video.currentTime>=clip.end) await seekVideo(clip.start);
      video.playbackRate = Number($("editorSpeed").value)||1;
      try { await video.play(); playButton.textContent = "Ⅱ"; }
      catch { message("Preview tidak dapat diputar. Tekan tombol sekali lagi.","error"); }
    } else {
      video.pause();
      playButton.textContent = "▶";
    }
  });
  video.addEventListener("pause",() => { if (!exporting) playButton.textContent="▶"; });
  $("editorJumpStart").addEventListener("click",()=>{const clip=selectedClip();if(clip){seekVideo(clip.start);}});
  scrub.addEventListener("input",()=>{if(!exporting)video.currentTime=Number(scrub.value)||0;});
  startInput.addEventListener("pointerdown",recordUndo);
  endInput.addEventListener("pointerdown",recordUndo);
  startInput.addEventListener("change",updateClipTrim);
  endInput.addEventListener("change",updateClipTrim);
  startInput.addEventListener("input",() => {
    const clip=selectedClip();if(!clip)return;
    if(Number(startInput.value)>=Number(endInput.value))endInput.value=String(Math.min(clip.duration,Number(startInput.value)+0.1));
    updateLabels();
  });
  endInput.addEventListener("input",() => {
    const clip=selectedClip();if(!clip)return;
    if(Number(endInput.value)<=Number(startInput.value))startInput.value=String(Math.max(0,Number(endInput.value)-0.1));
    updateLabels();
  });
  settingsIds.forEach(id => {
    const el=$(id);
    armUndo(el);
    el.addEventListener("input",updatePreview);
    el.addEventListener("change",() => {
      if(id==="editorFilterPreset")preset(el.value);
      else updatePreview();
    });
  });
  $("editorMusicVolume").addEventListener("input",updateMusicVolume);
  $("editorSplit").addEventListener("click",splitClip);
  $("editorMoveUp").addEventListener("click",()=>moveClip(clips.findIndex(c=>c.id===selectedId),-1));
  $("editorMoveDown").addEventListener("click",()=>moveClip(clips.findIndex(c=>c.id===selectedId),1));
  $("editorRemoveClip").addEventListener("click",()=>removeClip(selectedId));
  $("editorUndo").addEventListener("click",undo);
  $("editorRedo").addEventListener("click",redo);
  $("editorReset").addEventListener("click",resetEdits);
  $("editorExport").addEventListener("click",exportVideo);
  $("editorSaveProject").addEventListener("click",saveProject);
  $("editorLoadProject").addEventListener("click",()=>$("editorProjectFile").click());
  $("editorProjectFile").addEventListener("change",() => {
    const file=$("editorProjectFile").files&&$("editorProjectFile").files[0];
    if(file)loadProjectFile(file);
    $("editorProjectFile").value="";
  });
  $("editorRemoveMusic").addEventListener("click",removeMusic);

  document.addEventListener("keydown",event => {
    const target=event.target;
    if(target && ["INPUT","TEXTAREA","SELECT"].includes(target.tagName))return;
    if(event.code==="Space" && !event.repeat && clips.length && !exporting) {
      event.preventDefault();
      playButton.click();
    }
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z") {
      event.preventDefault();
      if(event.shiftKey)redo();else undo();
    }
    if((event.key==="Delete"||event.key==="Backspace")&&selectedClip()&&!exporting) {
      event.preventDefault();
      removeClip(selectedId);
    }
  });
  window.addEventListener("pagehide",() => {
    video.pause();
    musicAudio.pause();
    clips.forEach(clip=>{try{URL.revokeObjectURL(clip.url);}catch{}});
    if(musicUrl)URL.revokeObjectURL(musicUrl);
    if(exportUrl)URL.revokeObjectURL(exportUrl);
    if(audioContext)audioContext.close().catch(()=>{});
  });

  [startInput,endInput].forEach(armUndo);
  updateEditorState();
  updatePreview();
  updateMusicVolume();
})();