/* ARYANZZ V74.0 — local autosave, IndexedDB backup and global motion controls */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const PROFILE_KEY = "aryanzz.profile.v2";
  const DESIGN_KEY = "aryanzz.profile.design.v25";
  const MOTION_KEY = "aryanzz.motion.v74";
  const DB_NAME = "aryanzz-auto-backup-v74";
  const DB_STORE = "snapshots";
  const SNAPSHOT_KEYS = [
    PROFILE_KEY,DESIGN_KEY,"aryanzz.surface.v25","aryanzz.theme.v674",
    "aryanzz.history.v2","aryanzz-download-history-v1","aryanzz.favorites.v2",
    "aryanzz.color-favorites.v674","aryanzz.audio.studio.v74","aryanzz.audio.history.v74",
    "aryanzz.owner.links.v28","aryanzz.member.since.v25"
  ];
  let dbPromise = null;
  let backupTimer = null;
  let observer = null;
  const readJson = (key,fallback) => {
    try { return JSON.parse(localStorage.getItem(key)||"null") ?? fallback; }
    catch { return fallback; }
  };
  function backupStatus(message,state="ok") {
    const node=$("autoBackupStatus");
    if(!node)return;
    node.dataset.state=state;
    node.textContent=message;
  }
  function openBackupDb() {
    if(!("indexedDB" in window))return Promise.resolve(null);
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{
      try {
        const request=indexedDB.open(DB_NAME,1);
        request.onupgradeneeded=()=>{
          const db=request.result;
          if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:"id"});
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>resolve(null);
        request.onblocked=()=>resolve(null);
      } catch { resolve(null); }
    });
    return dbPromise;
  }
  async function readSnapshot() {
    const db=await openBackupDb();
    if(!db)return null;
    return new Promise(resolve=>{
      try {
        const request=db.transaction(DB_STORE,"readonly").objectStore(DB_STORE).get("latest");
        request.onsuccess=()=>resolve(request.result||null);
        request.onerror=()=>resolve(null);
      } catch { resolve(null); }
    });
  }
  async function writeSnapshot() {
    const db=await openBackupDb();
    if(!db) {
      backupStatus("Auto-save aktif melalui browser. Cadangan IndexedDB tidak tersedia di perangkat ini.","warn");
      return false;
    }
    const data={};
    SNAPSHOT_KEYS.forEach(key=>{
      const value=localStorage.getItem(key);
      if(value!==null)data[key]=value;
    });
    return new Promise(resolve=>{
      try {
        const tx=db.transaction(DB_STORE,"readwrite");
        tx.objectStore(DB_STORE).put({id:"latest",savedAt:Date.now(),data});
        tx.oncomplete=()=>{
          backupStatus("Cadangan otomatis tersimpan di perangkat ini · "+new Date().toLocaleTimeString("id-ID"));
          resolve(true);
        };
        tx.onerror=()=>{backupStatus("Cadangan otomatis gagal. Periksa ruang penyimpanan browser.","warn");resolve(false);};
        tx.onabort=()=>{backupStatus("Cadangan otomatis dibatalkan oleh browser.","warn");resolve(false);};
      } catch {
        backupStatus("Browser tidak dapat menulis cadangan otomatis.","warn");
        resolve(false);
      }
    });
  }
  async function restoreMissingSnapshot() {
    const snapshot=await readSnapshot();
    if(!snapshot||!snapshot.data)return false;
    let restored=false;
    for(const [key,value] of Object.entries(snapshot.data)) {
      if(localStorage.getItem(key)===null) {
        try { localStorage.setItem(key,value); restored=true; } catch {}
      }
    }
    if(restored) {
      const profile=readJson(PROFILE_KEY,{name:"Pengguna ARYANZZ",bio:"",photo:""});
      if($("profileName"))$("profileName").value=profile.name||"Pengguna ARYANZZ";
      if($("profileBio"))$("profileBio").value=profile.bio||"";
      $("profileName")?.dispatchEvent(new Event("input",{bubbles:true}));
      $("profileBio")?.dispatchEvent(new Event("input",{bubbles:true}));
      window.dispatchEvent(new Event("aryanzz:profile-assets-updated"));
      backupStatus("Data yang belum ada berhasil dipulihkan dari cadangan lokal · "+new Date(snapshot.savedAt).toLocaleString("id-ID"));
    }
    return restored;
  }
  function scheduleBackup() {
    clearTimeout(backupTimer);
    backupTimer=setTimeout(()=>{writeSnapshot();},850);
  }
  function saveProfileFields() {
    const name=$("profileName"),bio=$("profileBio");
    if(!name||!bio)return;
    const current=readJson(PROFILE_KEY,{name:"Pengguna ARYANZZ",bio:"",photo:""});
    const next={...current,name:name.value.trim()||"Pengguna ARYANZZ",bio:bio.value.trim()};
    try {
      localStorage.setItem(PROFILE_KEY,JSON.stringify(next));
      window.aryanzzProfile=next;
      if($("profileSummary"))$("profileSummary").textContent=next.name;
      if($("profileBioPreview"))$("profileBioPreview").textContent=next.bio||"Selamat datang di ruang personal ARYANZZ.";
      if($("profileCharCount"))$("profileCharCount").textContent=bio.value.length+"/160 karakter";
      if($("profileAvatar")&&!next.photo)$("profileAvatar").textContent=(next.name.charAt(0)||"A").toUpperCase();
      if($("ownerName"))$("ownerName").textContent=next.name;
      if($("ownerBio"))$("ownerBio").textContent=next.bio||"Pengelola dan pengembang ARYANZZ.";
      scheduleBackup();
    } catch {
      backupStatus("Profil belum dapat disimpan. Penyimpanan browser mungkin penuh.","warn");
    }
  }
  function updateAssetButtons() {
    const design=readJson(DESIGN_KEY,{});
    const profile=readJson(PROFILE_KEY,{});
    const banner=$("clearProfileBanner"),photo=$("clearProfilePhoto");
    if(banner)banner.hidden=!design.banner;
    if(photo)photo.hidden=!profile.photo;
  }
  function revealTargets() {
    if(observer){observer.disconnect();observer=null;}
    const targets=[...document.querySelectorAll("#allTools .tool,.v25-profile-card,.v25-profile-stats>div,.v74-audio-card")];
    targets.forEach((node,index)=>{
      node.style.setProperty("--v74-order",String(index));
      node.classList.remove("v74-reveal","v74-visible");
    });
    const enabled=document.body.dataset.motion==="on";
    if(!enabled||!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach(node=>node.classList.add("v74-visible"));
      return;
    }
    observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add("v74-visible");
          observer?.unobserve(entry.target);
        }
      });
    },{threshold:.06});
    targets.forEach(node=>{
      node.classList.add("v74-reveal");
      observer.observe(node);
    });
  }
  function applyMotion(value) {
    const enabled=!!value;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.dataset.motion=enabled&&!reduced?"on":"off";
    const toggle=$("profileMotionToggle");
    if(toggle)toggle.checked=enabled;
    try { localStorage.setItem(MOTION_KEY,enabled?"on":"off"); } catch {}
    revealTargets();
    scheduleBackup();
  }
  function initMotion() {
    const saved=localStorage.getItem(MOTION_KEY);
    const initial=saved===null?!window.matchMedia("(prefers-reduced-motion: reduce)").matches:saved==="on";
    applyMotion(initial);
    $("profileMotionToggle")?.addEventListener("change",event=>{
      applyMotion(event.target.checked);
      backupStatus(event.target.checked?"Animasi antarmuka diaktifkan.":"Animasi antarmuka dimatikan.");
    });
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change",()=>{
      applyMotion(localStorage.getItem(MOTION_KEY)!=="off");
    });
  }
  function init() {
    if(!$("profile"))return;
    updateAssetButtons();
    initMotion();
    const save=()=>saveProfileFields();
    $("profileName")?.addEventListener("input",save);
    $("profileBio")?.addEventListener("input",save);
    $("profileName")?.addEventListener("blur",save);
    $("profileBio")?.addEventListener("blur",save);
    $("profileReset")?.addEventListener("click",()=>setTimeout(()=>{saveProfileFields();},80));
    $("profilePhoto")?.addEventListener("change",()=>setTimeout(()=>{updateAssetButtons();scheduleBackup();},450));
    $("profileBanner")?.addEventListener("change",()=>setTimeout(()=>{updateAssetButtons();scheduleBackup();},650));
    $("profileBackground")?.addEventListener("change",()=>setTimeout(scheduleBackup,650));
    $("clearProfileBanner")?.addEventListener("click",()=>setTimeout(()=>{updateAssetButtons();scheduleBackup();},100));
    $("clearProfilePhoto")?.addEventListener("click",()=>setTimeout(()=>{updateAssetButtons();scheduleBackup();},100));
    $("ownerLinksSave")?.addEventListener("click",()=>setTimeout(scheduleBackup,100));
    window.addEventListener("aryanzz:profile-assets-updated",()=>{updateAssetButtons();scheduleBackup();});
    window.addEventListener("aryanzz:backup-change",scheduleBackup);
    window.addEventListener("storage",scheduleBackup);
    document.addEventListener("change",event=>{
      if(event.target?.matches("input,select,textarea"))scheduleBackup();
    });
    restoreMissingSnapshot().then(()=>{
      updateAssetButtons();
      window.dispatchEvent(new Event("aryanzz:profile-assets-updated"));
      scheduleBackup();
    });
    setInterval(scheduleBackup,45000);
    window.addEventListener("pagehide",()=>{writeSnapshot();});
    scheduleBackup();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();