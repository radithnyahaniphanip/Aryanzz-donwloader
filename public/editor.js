/* ARYANZZ V65.0 — Ultimate Creative Studio: local multi-track editor */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fileInput = $("editorFile");
  const video = $("editorPreview");
  const previewCanvas = $("editorPreviewCanvas");
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
  const audioTrackList = $("editorAudioTrackList");
  const subtitleInput = $("editorSubtitleFile");
  if (!fileInput || !video || !frame || !exportButton || !clipList) return;

  const MAX_CLIPS = 8;
  const MAX_FILE = 300 * 1024 * 1024;
  let clips = [];
  const archive = new Map();
  let selectedId = null;
  let audioTracks = [];
  let subtitles = [];
  let subtitleFileName = "";
  let chromaCanvas = null;
  let exportUrl = "";
  let recorder = null;
  let recordingStream = null;
  let transientAudioTracks = [];
  let animationFrame = 0;
  let exporting = false;
  let exportError = "";
  let history = [];
  let future = [];
  let audioContext = null;
  let audioDestination = null;
  let videoSourceNode = null;
  let videoPreviewGain = null;
  let videoRecordGain = null;
  let lastAudioSync = 0;

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
  function defaultMotion() { return {zoomStart:1,zoomEnd:1.15,panX:0,panY:0,easing:"ease"}; }
  function timelineOffset(clip) {
    const index=clips.findIndex(item=>item.id===clip?.id);
    const speed=Number($("editorSpeed").value)||1;
    return clips.slice(0,Math.max(0,index)).reduce((sum,item)=>sum+Math.max(0,item.end-item.start)/speed,0);
  }
  function motionAt(clip,localTime) {
    const motion = clip && clip.motion ? clip.motion : defaultMotion();
    let t = clip ? Math.max(0,Math.min(1,(localTime-clip.start)/Math.max(.1,clip.end-clip.start))) : 0;
    if (motion.easing==="ease") t=t*t*(3-2*t);
    return {
      zoom:(Number(motion.zoomStart)||1)+((Number(motion.zoomEnd)||1)-(Number(motion.zoomStart)||1))*t,
      panX:Number(motion.panX)||0,
      panY:Number(motion.panY)||0
    };
  }
  function setMotionControls(clip) {
    const motion=clip&&clip.motion?clip.motion:defaultMotion();
    $("editorZoomStart").value=String(Math.round((Number(motion.zoomStart)||1)*100));
    $("editorZoomEnd").value=String(Math.round((Number(motion.zoomEnd)||1)*100));
    $("editorPanX").value=String(motion.panX||0);
    $("editorPanY").value=String(motion.panY||0);
    $("editorMotionEasing").value=motion.easing||"ease";
    updateMotionLabels();
  }
  function updateMotionLabels() {
    $("editorZoomStartValue").textContent=$("editorZoomStart").value+"%";
    $("editorZoomEndValue").textContent=$("editorZoomEnd").value+"%";
    $("editorPanXValue").textContent=$("editorPanX").value;
    $("editorPanYValue").textContent=$("editorPanY").value;
  }
  function applyMotionControls() {
    const clip=selectedClip(); if(!clip)return;
    clip.motion={
      zoomStart:Number($("editorZoomStart").value)/100,
      zoomEnd:Number($("editorZoomEnd").value)/100,
      panX:Number($("editorPanX").value),
      panY:Number($("editorPanY").value),
      easing:$("editorMotionEasing").value
    };
    updateMotionLabels();
    updatePreview();
  }
  function parseSrtTime(value) {
    const match=value.trim().match(/(\\d{2}):(\\d{2}):(\\d{2})[,\.](\\d{1,3})/);
    return match ? Number(match[1])*3600+Number(match[2])*60+Number(match[3])+Number(match[4].padEnd(3,"0"))/1000 : 0;
  }
  function parseSrt(source) {
    return String(source||"").replace(/\\r/g,"").split(/\\n\\s*\\n/).map(block=>{
      const lines=block.split("\\n").map(line=>line.trim()).filter(Boolean);
      const timing=lines.findIndex(line=>line.includes("-->"));
      if(timing<0)return null;
      const parts=lines[timing].split("-->");
      const start=parseSrtTime(parts[0]||"");
      const end=parseSrtTime(parts[1]||"");
      const text=lines.slice(timing+1).join("\\n").replace(/<[^>]*>/g,"");
      return end>start&&text?{start,end,text}:null;
    }).filter(Boolean).sort((a,b)=>a.start-b.start);
  }
  function captionAt(projectTime,clip) {
    const subtitle=subtitles.find(item=>projectTime>=item.start&&projectTime<=item.end);
    return subtitle ? {text:subtitle.text,start:subtitle.start,end:subtitle.end,isSubtitle:true} :
      {text:textInput.value.trim(),start:timelineOffset(clip||selectedClip()),end:totalDuration(),isSubtitle:false};
  }
  function textAnimationState(caption,projectTime) {
    const mode=$("editorTextAnimation").value;
    const duration=.5;
    const t=Math.max(0,Math.min(1,(projectTime-caption.start)/duration));
    if(mode==="fade")return {opacity:t,transform:"translateY(0) scale(1)"};
    if(mode==="slide")return {opacity:t,transform:"translateY("+(1-t)*20+"px) scale(1)"};
    if(mode==="pop")return {opacity:t,transform:"translateY(0) scale("+(0.72+t*.28)+")"};
    return {opacity:1,transform:"none"};
  }
  function updateAudioGraphGains() {
    if(!audioContext)return;
    audioTracks.forEach(track=>{
      track.audio.volume=1;
      if(track.previewGain)track.previewGain.gain.setTargetAtTime(exporting?0:track.volume,audioContext.currentTime,.02);
      if(track.recordGain)track.recordGain.gain.setTargetAtTime(exporting?track.volume:0,audioContext.currentTime,.02);
    });
  }
  const makeId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "clip-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const selectedClip = () => clips.find(clip => clip.id === selectedId) || null;
  const settingsIds = [
    "editorRatio","editorRotate","editorSpeed","editorTransition","editorFilterPreset",
    "editorBrightness","editorContrast","editorSaturation","editorText","editorTextColor",
    "editorTextPosition","editorTextSize","editorTextAnimation","editorChromaEnabled",
    "editorChromaColor","editorChromaTolerance","editorBackgroundColor",
    "editorMute","editorResolution","editorQuality"
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
    updatePreview();
    renderAudioTracks();
    updateAudioGraphGains();
  }
  function snapshot() {
    return {
      clips: clips.map(clip => ({ id:clip.id,start:clip.start,end:clip.end,motion:clip.motion?{...clip.motion}:defaultMotion() })),
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
      return original ? Object.assign({},original,{start:item.start,end:item.end,motion:item.motion?{...item.motion}:defaultMotion()}) : null;
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
    el.addEventListener("pointerdown",() => {
      if (el.dataset.undoArmed !== "pointer") recordUndo();
      el.dataset.undoArmed = "pointer";
    });
    el.addEventListener("focus",() => {
      if (!el.dataset.undoArmed) {
        recordUndo();
        el.dataset.undoArmed = "keyboard";
      }
    });
    el.addEventListener("pointerup",() => { delete el.dataset.undoArmed; });
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
    const hasClips=clips.length>0;
    const clip=selectedClip();
    const enabledIds=[
      "editorPlay","editorJumpStart","editorScrub","editorStart","editorEnd",
      "editorRatio","editorRotate","editorSpeed","editorTransition","editorFilterPreset",
      "editorBrightness","editorContrast","editorSaturation","editorText","editorTextColor",
      "editorTextPosition","editorTextSize","editorTextAnimation","editorMute",
      "editorZoomStart","editorZoomEnd","editorPanX","editorPanY","editorMotionEasing",
      "editorChromaEnabled","editorChromaColor","editorChromaTolerance","editorBackgroundColor",
      "editorResolution","editorQuality","editorReset","editorExport"
    ];
    enabledIds.forEach(id=>{const el=$(id);if(el)el.disabled=!hasClips||exporting;});
    $("editorSplit").disabled=!clip||exporting;
    $("editorMoveUp").disabled=!clip||clips.findIndex(item=>item.id===selectedId)<=0||exporting;
    $("editorMoveDown").disabled=!clip||clips.findIndex(item=>item.id===selectedId)>=clips.length-1||exporting;
    $("editorRemoveClip").disabled=!clip||exporting;
    $("editorSaveProject").disabled=!hasClips||exporting;
    musicInput.disabled=exporting||audioTracks.length>=3;
    subtitleInput.disabled=exporting;
    $("editorAudioCount").textContent=audioTracks.length+"/3";
    $("editorClearSubtitles").disabled=!subtitles.length||exporting;
    $("editorSubtitleStatus").textContent=subtitles.length?subtitles.length+" cue · "+subtitleFileName:"Belum ada subtitle";
    $("editorSubtitleDetail").textContent=subtitles.length?subtitles.length+" subtitle dimuat dari "+subtitleFileName+".":"Import file SRT untuk menampilkan subtitle otomatis pada timeline.";
    $("editorClipCount").textContent=clips.length+" klip · "+totalDuration().toFixed(1)+" detik";
    const uniqueFiles=new Set(clips.map(item=>item.file));
    $("editorFileName").textContent=hasClips?clips.length+" klip dimuat · "+formatBytes(Array.from(uniqueFiles).reduce((sum,file)=>sum+file.size,0)):"Belum ada klip";
    $("editorSelectedClipName").textContent=clip?clip.file.name:"Belum ada klip dipilih";
    $("editorPreviewMeta").textContent=$("editorRatio").value+" · "+$("editorResolution").value+"p canvas";
    empty.hidden=hasClips;
    renderAudioTracks();
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
    const brightness=Number($("editorBrightness").value)||100;
    const contrast=Number($("editorContrast").value)||100;
    const saturation=Number($("editorSaturation").value)||100;
    const rotate=Number($("editorRotate").value)||0;
    const clip=selectedClip();
    const motion=motionAt(clip,video.currentTime||0);
    video.style.filter="brightness("+brightness+"%) contrast("+contrast+"%) saturate("+saturation+"%)";
    video.style.transform="translate("+motion.panX*.35+"%, "+motion.panY*.35+"%) scale("+motion.zoom+") rotate("+rotate+"deg)";
    frame.dataset.ratio=$("editorRatio").value;
    const speed=Number($("editorSpeed").value)||1;
    const projectTime=clip?timelineOffset(clip)+Math.max(0,(video.currentTime||clip.start)-clip.start)/speed:0;
    const caption=captionAt(projectTime,clip);
    overlay.textContent=caption.text;
    const chromaPreview=$("editorChromaEnabled").checked;
    overlay.hidden=!caption.text||chromaPreview;
    previewCanvas.hidden=!chromaPreview;
    video.style.visibility=chromaPreview?"hidden":"visible";
    if(chromaPreview&&video.readyState>=2&&video.videoWidth){
      const ratio=$("editorRatio").value;
      const size=ratio==="9:16"?[304,540]:ratio==="1:1"?[480,480]:ratio==="4:5"?[432,540]:[540,304];
      if(previewCanvas.width!==size[0]||previewCanvas.height!==size[1]){previewCanvas.width=size[0];previewCanvas.height=size[1];}
      const previewCtx=previewCanvas.getContext("2d",{alpha:false});
      drawFrame(previewCtx,previewCanvas,1,clip,projectTime);
    }
    overlay.dataset.position=$("editorTextPosition").value;
    overlay.dataset.animation=$("editorTextAnimation").value;
    const animated=textAnimationState(caption,projectTime);
    overlay.style.opacity=String(animated.opacity);
    overlay.style.transform=animated.transform;
    overlay.style.color=$("editorTextColor").value;
    overlay.style.fontSize=$("editorTextSize").value+"px";
    video.playbackRate=Number($("editorSpeed").value)||1;
    $("editorBrightnessValue").textContent=brightness+"%";
    $("editorContrastValue").textContent=contrast+"%";
    $("editorSaturationValue").textContent=saturation+"%";
    $("editorTextSizeValue").textContent=$("editorTextSize").value+" px";
    $("editorPreviewMeta").textContent=$("editorRatio").value+" · "+$("editorResolution").value+"p canvas";
    updateLabels();
    updateMotionLabels();
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
    setMotionControls(clip);
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
    if (!project && clips.length) recordUndo();
    const remaining = Math.max(0,MAX_CLIPS-clips.length);
    if (project) { clips = []; selectedId = null; history = []; future = []; }
    if (project && !descriptors.length) { message("File video sumber tidak ditemukan. Pilih file proyek dan semua video sumber dalam satu kali pemilihan.","error"); return; }
    if (project && descriptors.length !== project.clips.length) message("Sebagian sumber video tidak ditemukan. Klip yang cocok saja yang akan dimuat.","error");
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
          end:Math.max(0,Math.min(Number(item.end)||duration,duration)),
          motion:item.motion?{...defaultMotion(),...item.motion}:defaultMotion()
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
    const right = Object.assign({},clip,{id:makeId(),start:point,end:originalEnd,motion:{...clip.motion}});
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
  function drawCaption(ctx,width,height,clip,projectTime) {
    const caption=captionAt(projectTime||0,clip);
    if(!caption.text)return;
    const fontSize=Math.max(18,Number($("editorTextSize").value)||42);
    const position=$("editorTextPosition").value;
    const y=position==="top"?height*.12:position==="middle"?height*.5:height*.88;
    const maxWidth=width*.86;
    const animated=textAnimationState(caption,projectTime||0);
    ctx.save();
    ctx.globalAlpha=animated.opacity;
    ctx.translate(width/2,height/2);
    if($("editorTextAnimation").value==="slide")ctx.translate(0,(1-animated.opacity)*20);
    if($("editorTextAnimation").value==="pop")ctx.scale(.72+animated.opacity*.28,.72+animated.opacity*.28);
    ctx.translate(-width/2,-height/2);
    ctx.font="900 "+fontSize+"px system-ui, sans-serif";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillStyle=$("editorTextColor").value||"#fff";
    ctx.strokeStyle="rgba(0,0,0,.9)";
    ctx.lineWidth=Math.max(3,fontSize*.14);
    ctx.lineJoin="round";
    ctx.shadowColor="rgba(0,0,0,.75)";
    ctx.shadowBlur=10;
    const words=caption.text.split(/\\s+/);
    const lines=[];
    let line="";
    words.forEach(word=>{
      const test=line?line+" "+word:word;
      if(line&&ctx.measureText(test).width>maxWidth){lines.push(line);line=word;}
      else line=test;
    });
    if(line)lines.push(line);
    const lineHeight=fontSize*1.16;
    const firstY=y-((lines.length-1)*lineHeight)/2;
    if(caption.isSubtitle){
      const boxWidth=Math.min(maxWidth,Math.max(...lines.map(item=>ctx.measureText(item).width))+30);
      ctx.fillStyle="rgba(0,0,0,.56)";
      ctx.fillRect((width-boxWidth)/2,firstY-lineHeight*.55,boxWidth,lines.length*lineHeight+lineHeight*.1);
      ctx.fillStyle=$("editorTextColor").value||"#fff";
    }
    lines.slice(0,3).forEach((text,index)=>{
      const lineY=firstY+index*lineHeight;
      ctx.strokeText(text,width/2,lineY,maxWidth);
      ctx.fillText(text,width/2,lineY,maxWidth);
    });
    ctx.restore();
  }
  function drawVideoLayer(target,width,height,clip) {
    const rotate=((Number($("editorRotate").value)||0)%360+360)%360;
    const rotatedWidth=rotate===90||rotate===270?video.videoHeight:video.videoWidth;
    const rotatedHeight=rotate===90||rotate===270?video.videoWidth:video.videoHeight;
    const baseScale=Math.max(width/rotatedWidth,height/rotatedHeight);
    const motion=motionAt(clip,video.currentTime||0);
    const scale=baseScale*motion.zoom;
    const panX=motion.panX*width/300;
    const panY=motion.panY*height/300;
    target.save();
    if(target.canvas===chromaCanvas)target.clearRect(0,0,width,height);
    target.filter="brightness("+$("editorBrightness").value+"%) contrast("+$("editorContrast").value+"%) saturate("+$("editorSaturation").value+"%)";
    target.translate(width/2+panX,height/2+panY);
    target.rotate(rotate*Math.PI/180);
    target.drawImage(video,-video.videoWidth*scale/2,-video.videoHeight*scale/2,video.videoWidth*scale,video.videoHeight*scale);
    target.restore();
    target.filter="none";
  }
  function applyChromaKey(sourceCanvas) {
    const source=sourceCanvas.getContext("2d",{willReadFrequently:true});
    const image=source.getImageData(0,0,sourceCanvas.width,sourceCanvas.height);
    const pixels=image.data;
    const hex=$("editorChromaColor").value||"#00ff00";
    const key=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
    const tolerance=Number($("editorChromaTolerance").value)||65;
    const feather=22;
    for(let i=0;i<pixels.length;i+=4){
      const dr=pixels[i]-key[0],dg=pixels[i+1]-key[1],db=pixels[i+2]-key[2];
      const distance=Math.sqrt(dr*dr+dg*dg+db*db);
      if(distance<=tolerance)pixels[i+3]=0;
      else if(distance<tolerance+feather)pixels[i+3]=Math.round(pixels[i+3]*(distance-tolerance)/feather);
    }
    source.putImageData(image,0,0);
  }
  function drawFrame(ctx,canvas,fadeAlpha,clip,projectTime) {
    const width=canvas.width,height=canvas.height;
    ctx.save();
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle=$("editorBackgroundColor").value||"#101827";
    ctx.fillRect(0,0,width,height);
    if($("editorChromaEnabled").checked){
      if(!chromaCanvas)chromaCanvas=document.createElement("canvas");
      if(chromaCanvas.width!==width||chromaCanvas.height!==height){chromaCanvas.width=width;chromaCanvas.height=height;}
      const chromaCtx=chromaCanvas.getContext("2d",{willReadFrequently:true});
      drawVideoLayer(chromaCtx,width,height,clip);
      try{applyChromaKey(chromaCanvas);ctx.drawImage(chromaCanvas,0,0);}
      catch(error){ctx.drawImage(chromaCanvas,0,0);message("Chroma key tidak dapat diproses pada perangkat ini. Coba resolusi 720p.","error");}
    }else{
      drawVideoLayer(ctx,width,height,clip);
    }
    drawCaption(ctx,width,height,clip,projectTime||0);
    if(fadeAlpha!==undefined&&fadeAlpha<1){
      ctx.fillStyle="rgba(0,0,0,"+Math.max(0,Math.min(1,1-fadeAlpha))+")";
      ctx.fillRect(0,0,width,height);
    }
    ctx.restore();
  }
    function renderAudioTracks() {
    if(!audioTrackList)return;
    audioTrackList.replaceChildren();
    $("editorAudioCount").textContent=audioTracks.length+"/3";
    if(!audioTracks.length){
      const emptyTrack=document.createElement("div");
      emptyTrack.className="editor-timeline-empty";
      emptyTrack.textContent="Belum ada audio. Tambahkan musik, narasi, atau efek suara.";
      audioTrackList.append(emptyTrack);
      return;
    }
    audioTracks.forEach((track,index)=>{
      const row=document.createElement("div");
      row.className="editor-audio-track";
      const icon=document.createElement("span");
      icon.className="editor-audio-track-icon";
      icon.textContent=index===0?"♫":"♪";
      const info=document.createElement("span");
      info.className="editor-audio-track-info";
      const name=document.createElement("b");
      name.textContent=track.file.name;
      const detail=document.createElement("small");
      detail.textContent="TRACK "+(index+1)+" · "+formatBytes(track.file.size);
      info.append(name,detail);
      const volume=document.createElement("label");
      volume.className="editor-audio-track-volume";
      volume.textContent="Volume ";
      const value=document.createElement("output");
      value.textContent=Math.round(track.volume*100)+"%";
      const slider=document.createElement("input");
      slider.type="range";slider.min="0";slider.max="100";slider.value=String(Math.round(track.volume*100));
      slider.disabled=exporting;
      slider.addEventListener("input",()=>{
        track.volume=Number(slider.value)/100;
        value.textContent=slider.value+"%";
        if(!audioContext)track.audio.volume=track.volume;
        updateAudioGraphGains();
      });
      volume.append(value,slider);
      const remove=document.createElement("button");
      remove.type="button";remove.className="editor-audio-track-remove";
      remove.textContent="×";remove.title="Hapus "+track.file.name;remove.disabled=exporting;
      remove.addEventListener("click",()=>removeMusic(track.id));
      row.append(icon,info,volume,remove);
      audioTrackList.append(row);
    });
  }
  function setupAudioGraph() {
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return null;
    if(!audioContext)audioContext=new AudioContextClass();
    if(!audioDestination)audioDestination=audioContext.createMediaStreamDestination();
    if(!videoSourceNode){
      videoSourceNode=audioContext.createMediaElementSource(video);
      videoPreviewGain=audioContext.createGain();
      videoRecordGain=audioContext.createGain();
      videoSourceNode.connect(videoPreviewGain);
      videoPreviewGain.connect(audioContext.destination);
      videoSourceNode.connect(videoRecordGain);
      videoRecordGain.connect(audioDestination);
    }
    audioTracks.forEach(track=>{
      if(track.sourceNode)return;
      track.sourceNode=audioContext.createMediaElementSource(track.audio);
      track.previewGain=audioContext.createGain();
      track.recordGain=audioContext.createGain();
      track.sourceNode.connect(track.previewGain);
      track.previewGain.connect(audioContext.destination);
      track.sourceNode.connect(track.recordGain);
      track.recordGain.connect(audioDestination);
    });
    updateAudioGraphGains();
    return audioDestination;
  }
  function setAudioExportMode(active) {
    if(!audioContext)return;
    const muted=$("editorMute").checked;
    if(videoPreviewGain)videoPreviewGain.gain.setTargetAtTime(active?0:1,audioContext.currentTime,.02);
    if(videoRecordGain)videoRecordGain.gain.setTargetAtTime(active&&!muted?1:0,audioContext.currentTime,.02);
    audioTracks.forEach(track=>{
      if(track.previewGain)track.previewGain.gain.setTargetAtTime(active?0:track.volume,audioContext.currentTime,.02);
      if(track.recordGain)track.recordGain.gain.setTargetAtTime(active?track.volume:0,audioContext.currentTime,.02);
    });
  }
  function syncAudioPreview(force) {
    if(exporting)return;
    const clip=selectedClip();
    if(!clip||video.paused){
      audioTracks.forEach(track=>track.audio.pause());
      return;
    }
    const speed=Number($("editorSpeed").value)||1;
    const projectTime=timelineOffset(clip)+Math.max(0,video.currentTime-clip.start)/speed;
    const now=Date.now();
    if(!force&&now-lastAudioSync<800)return;
    lastAudioSync=now;
    audioTracks.forEach(track=>{
      const duration=Number(track.audio.duration);
      if(Number.isFinite(duration)&&duration>0){
        const target=projectTime%duration;
        if(Math.abs(track.audio.currentTime-target)>.45)track.audio.currentTime=target;
      }
      track.audio.volume=audioContext?1:track.volume;
      track.audio.play().catch(()=>{});
    });
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
          drawFrame(ctx,canvas,1,clip,done+(clip.end-clip.start)/speed);
          resolve();
          return;
        }
        if (video.readyState >= 2) {
          let alpha = 1;
          if (fadeDuration > 0) {
            alpha = Math.min(1,(video.currentTime-clip.start)/fadeDuration,(clip.end-video.currentTime)/fadeDuration);
            alpha = Math.max(0,alpha);
          }
          const projectTime=done+Math.max(0,video.currentTime-clip.start)/speed;
          drawFrame(ctx,canvas,alpha,clip,projectTime);
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
    audioTracks.forEach(track=>{track.audio.pause();try{track.audio.currentTime=0;}catch{}});
    if (recordingStream) recordingStream.getVideoTracks().forEach(track=>track.stop());
    transientAudioTracks.forEach(track=>{try{track.stop();}catch{}});
    transientAudioTracks = [];
    recordingStream = null;
    exportButton.disabled = false;
    updateEditorState();
    if (exportError) {
      message(exportError,"error");
      exportError = "";
      recorder = null;
      return;
    }
    if (!recorder || !window.MediaRecorder) {
      message("Browser tidak menghasilkan file ekspor.","error");
      recorder = null;
      return;
    }
    const mime = recorder && recorder.mimeType ? recorder.mimeType : "video/webm";
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
          transientAudioTracks = fallback.getAudioTracks();
          transientAudioTracks.forEach(track=>canvasStream.addTrack(track));
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
      canvasStream.getVideoTracks().forEach(track=>track.stop());
      transientAudioTracks.forEach(track=>{try{track.stop();}catch{}});
      transientAudioTracks = [];
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
      audioTracks.forEach(track=>{track.audio.loop=true;track.audio.currentTime=0;});
      if(audioGraph)await Promise.all(audioTracks.map(track=>track.audio.play().catch(()=>{})));
      else if(audioTracks.length)message("Browser tidak mendukung pencampuran beberapa audio track. Audio latar tidak disertakan pada ekspor ini.","error");
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
    $("editorTextAnimation").value = "none";
    $("editorChromaEnabled").checked = false;
    $("editorChromaColor").value = "#00ff00";
    $("editorChromaTolerance").value = "65";
    $("editorBackgroundColor").value = "#101827";
    const clip=selectedClip();if(clip){clip.motion=defaultMotion();setMotionControls(clip);}
    $("editorMute").checked = false;
    $("editorResolution").value = "720";
    $("editorQuality").value = "standard";
    updatePreview();
    output.hidden = true;
    progressBar.style.width = "0%";
    message("Pengaturan visual dikembalikan ke awal.","info");
  }
  function addMusic(fileCollection,savedTracks) {
    const incoming=Array.from(fileCollection||[]);
    if(!incoming.length)return;
    let added=0;
    for(const file of incoming){
      if(audioTracks.length>=3){message("Maksimal 3 audio track. Hapus salah satu track untuk menambahkan audio lain.","error");break;}
      if(!file.type.startsWith("audio/")||file.size>MAX_FILE){message("Lewati "+file.name+": pilih file audio maksimal 300 MB.","error");continue;}
      const saved=(savedTracks||[]).find(item=>item.name===file.name);
      const url=URL.createObjectURL(file);
      const audio=document.createElement("audio");
      audio.hidden=true;audio.preload="auto";audio.loop=true;audio.volume=1;audio.src=url;audio.load();
      document.body.appendChild(audio);
      const track={id:makeId(),file,url,audio,volume:saved&&Number.isFinite(Number(saved.volume))?Math.max(0,Math.min(1,Number(saved.volume))):.7,sourceNode:null,previewGain:null,recordGain:null};
      audioTracks.push(track);
      added++;
    }
    if(audioContext)setupAudioGraph();
    renderAudioTracks();
    updateEditorState();
    if(added)message(added+" audio track ditambahkan. Maksimal 3 track dapat dicampur saat ekspor.","ready");
  }
  function removeMusic(id) {
    const index=audioTracks.findIndex(track=>track.id===id);
    if(index<0||exporting)return;
    const [track]=audioTracks.splice(index,1);
    track.audio.pause();
    track.audio.removeAttribute("src");
    track.audio.load();
    if(track.sourceNode)try{track.sourceNode.disconnect();}catch{}
    if(track.previewGain)try{track.previewGain.disconnect();}catch{}
    if(track.recordGain)try{track.recordGain.disconnect();}catch{}
    URL.revokeObjectURL(track.url);
    track.audio.remove();
    renderAudioTracks();
    updateEditorState();
    message("Audio track dihapus.","info");
  }
  function clearSubtitles() {
    subtitles=[];subtitleFileName="";
    $("editorSubtitleStatus").textContent="Belum ada subtitle";
    $("editorSubtitleDetail").textContent="Import file SRT untuk menampilkan subtitle otomatis pada timeline.";
    updatePreview();updateEditorState();
    message("Subtitle dihapus dari proyek.","info");
  }
  async function importSubtitles(file) {
    if(!file)return;
    if(file.size>5*1024*1024){message("File subtitle maksimal 5 MB.","error");return;}
    try{
      const parsed=parseSrt(await file.text());
      if(!parsed.length)throw new Error("File SRT tidak memiliki cue subtitle yang valid.");
      subtitles=parsed;
      subtitleFileName=file.name;
      $("editorSubtitleStatus").textContent=parsed.length+" cue · "+file.name;
      $("editorSubtitleDetail").textContent=parsed.length+" subtitle siap ditampilkan sesuai timestamp SRT.";
      updatePreview();
      message(parsed.length+" subtitle berhasil dimuat dari "+file.name+".","ready");
    }catch(error){message(error.message||"Subtitle tidak dapat dibaca.","error");}
  }
    function saveProject() {
    if(!clips.length)return;
    const project={
      app:"ARYANZZ Creative Studio Pro",
      version:"65.0",
      savedAt:new Date().toISOString(),
      settings:getSettings(),
      clips:clips.map(clip=>({name:clip.file.name,start:clip.start,end:clip.end,duration:clip.duration,motion:clip.motion?{...clip.motion}:defaultMotion()})),
      audioTracks:audioTracks.map(track=>({name:track.file.name,volume:track.volume})),
      subtitles,
      subtitleName:subtitleFileName
    };
    const blob=new Blob([JSON.stringify(project,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="aryanzz-project-v65-"+Date.now()+".json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    message("Proyek V65 berhasil disimpan. Simpan juga semua file video, audio, dan subtitle sumber.","ready");
  }
    async function loadProjectFile(file,sourceFiles) {
    try{
      const project=JSON.parse(await file.text());
      if(project.app!=="ARYANZZ Creative Studio Pro"||!Array.isArray(project.clips)||project.clips.length>MAX_CLIPS)
        throw new Error("File proyek ARYANZZ tidak valid atau jumlah klip melebihi batas.");
      const videoFiles=sourceFiles.filter(item=>item.type.startsWith("video/"));
      const audioFiles=sourceFiles.filter(item=>item.type.startsWith("audio/"));
      if(!videoFiles.length)throw new Error("Pilih file proyek dan semua video sumber secara bersamaan.");
      audioTracks.slice().forEach(track=>removeMusic(track.id));
      subtitles=[];subtitleFileName="";
      await addVideoFiles(videoFiles,project);
      if(audioFiles.length)addMusic(audioFiles,project.audioTracks||[]);
      if(Array.isArray(project.subtitles)){subtitles=project.subtitles.filter(item=>Number.isFinite(item.start)&&Number.isFinite(item.end)&&item.end>item.start);subtitleFileName=project.subtitleName||"Subtitle proyek";}
      $("editorSubtitleStatus").textContent=subtitles.length?subtitles.length+" cue · "+subtitleFileName:"Belum ada subtitle";
      $("editorSubtitleDetail").textContent=subtitles.length?subtitles.length+" subtitle dipulihkan dari file proyek.":"Import file SRT untuk menampilkan subtitle otomatis pada timeline.";
      updatePreview();updateEditorState();
      if(project.audioTracks?.length&&!audioFiles.length)message("Video dan pengaturan proyek dimuat. Pilih ulang "+project.audioTracks.length+" file audio sumber.","info");
      else if(project.musicName&&!audioFiles.length)message("Video proyek dimuat. Pilih ulang file musik: "+project.musicName,"info");
      else message("Proyek V65 berhasil dibuka. Periksa kembali sumber media yang digunakan.","ready");
    }catch(error){message(error.message||"File proyek tidak dapat dibuka.","error");}
  }
      fileInput.addEventListener("change",async() => {
    const files = Array.from(fileInput.files||[]);
    if (!files.length) return;
    await addVideoFiles(files,null);
    fileInput.value = "";
  });
  musicInput.addEventListener("change",()=>{
    const files=Array.from(musicInput.files||[]);
    if(files.length)addMusic(files);
    musicInput.value="";
  });
  subtitleInput.addEventListener("change",()=>{
    const file=subtitleInput.files&&subtitleInput.files[0];
    if(file)importSubtitles(file);
    subtitleInput.value="";
  });
  $("editorClearSubtitles").addEventListener("click",clearSubtitles);
  video.addEventListener("loadedmetadata",() => {
    const clip = selectedClip();
    if (!clip || video.src!==clip.url) return;
    clip.duration = Number(video.duration)||clip.duration;
    startInput.max = String(clip.duration);
    endInput.max = String(clip.duration);
    startInput.value = String(clip.start);
    endInput.value = String(clip.end);
    setMotionControls(clip);
    empty.hidden = true;
    updatePreview();
  });
  video.addEventListener("timeupdate",()=>{
    updatePreview();
    syncAudioPreview(false);
    const clip=selectedClip();
    if(!exporting&&clip&&!video.paused&&video.currentTime>=clip.end){
      video.pause();
      playButton.textContent="▶";
    }
  });
  playButton.addEventListener("click",async()=>{
    const clip=selectedClip();
    if(!clip||exporting)return;
    if(video.paused){
      if(video.currentTime<clip.start||video.currentTime>=clip.end)await seekVideo(clip.start);
      video.playbackRate=Number($("editorSpeed").value)||1;
      try{
        if(audioTracks.length){setupAudioGraph();if(audioContext)await audioContext.resume();}
        await video.play();
        playButton.textContent="Ⅱ";
        syncAudioPreview(true);
      }catch{message("Preview tidak dapat diputar. Tekan tombol sekali lagi.","error");}
    }else{
      video.pause();
      audioTracks.forEach(track=>track.audio.pause());
      playButton.textContent="▶";
    }
  });
  video.addEventListener("pause",()=>{
    if(!exporting){playButton.textContent="▶";audioTracks.forEach(track=>track.audio.pause());}
  });
  $("editorJumpStart").addEventListener("click",()=>{const clip=selectedClip();if(clip){seekVideo(clip.start);updatePreview();syncAudioPreview(true);}});
  scrub.addEventListener("input",()=>{
    if(!exporting){video.currentTime=Number(scrub.value)||0;updatePreview();syncAudioPreview(true);}
  });
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
  ["editorZoomStart","editorZoomEnd","editorPanX","editorPanY","editorMotionEasing"].forEach(id=>{
    const el=$(id);armUndo(el);el.addEventListener("input",applyMotionControls);el.addEventListener("change",applyMotionControls);
  });
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
    const selected=Array.from($("editorProjectFile").files||[]);
    const projectFile=selected.find(file=>file.name.toLowerCase().endsWith(".json")||file.type==="application/json");
    const sourceFiles=selected.filter(file=>file!==projectFile);
    if(projectFile)loadProjectFile(projectFile,sourceFiles);
    else message("Pilih file proyek ARYANZZ berformat JSON.","error");
    $("editorProjectFile").value="";
  });

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
  window.addEventListener("pagehide",()=>{
    video.pause();
    audioTracks.forEach(track=>{
      track.audio.pause();
      try{URL.revokeObjectURL(track.url);}catch{}
    });
    archive.forEach(clip=>{try{URL.revokeObjectURL(clip.url);}catch{}});
    if(exportUrl)URL.revokeObjectURL(exportUrl);
    if(audioContext)audioContext.close().catch(()=>{});
  });

  [startInput,endInput].forEach(armUndo);
  updateEditorState();
  updatePreview();
  renderAudioTracks();
})();