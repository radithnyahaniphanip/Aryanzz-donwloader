/* ARYANZZ V26 — free profile studio, personalization and motion */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const DESIGN_KEY="aryanzz.profile.design.v25";
  const SURFACE_KEY="aryanzz.surface.v25";
  const PROFILE_KEY="aryanzz.profile.info.v25";
  const MOTION_KEY="aryanzz.motion.v75";
  const AUTOSAVE_DB="aryanzz-auto-save-v74";
  const HISTORY_KEYS=["aryanzz.history.v2","aryanzz-download-history-v1"];
  const FAV_KEYS=["aryanzz.favorites.v2","aryanzz.favorites.v1"];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  let toastTimer;
  function toast(message){
    let el=$("v25Toast");if(!el){el=document.createElement("div");el.id="v25Toast";el.className="v25-toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.append(el);}
    el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
  }
  function readDesign(){return read(DESIGN_KEY,{banner:"",background:"",avatar:""});}
  function applyDesign(){
    const d=readDesign(),banner=$("profileBannerPreview"),avatar=$("profileAvatar"),profile=read(PROFILE_KEY,{});
    if(banner){if(d.banner)banner.style.backgroundImage='linear-gradient(120deg,#08152555,#08152588),url("'+d.banner+'")';else banner.style.removeProperty("background-image");}
    if(avatar){if(d.avatar){avatar.style.backgroundImage='url("'+d.avatar+'")';avatar.textContent="";}else{avatar.style.removeProperty("background-image");avatar.textContent=(String(profile.name||"A").trim().charAt(0)||"A").toUpperCase();}}
    const removeBanner=$("clearProfileBanner"),removeAvatar=$("clearProfilePhoto");
    if(removeBanner)removeBanner.hidden=!d.banner;
    if(removeAvatar)removeAvatar.hidden=!d.avatar;
    if(d.background){document.body.style.setProperty("--v25-bg-image",'url("'+d.background+'")');document.body.dataset.customBackground="true";}
    else{document.body.style.removeProperty("--v25-bg-image");document.body.dataset.customBackground="false";}
  }
  async function compressImage(file,maxWidth,maxHeight,quality){
    if(!file||!file.type.startsWith("image/"))throw new Error("Pilih file gambar yang valid.");
    let source,width,height,cleanup=()=>{};
    if("createImageBitmap" in window){source=await createImageBitmap(file);width=source.width;height=source.height;cleanup=()=>source.close?.();}
    else{source=await new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Gambar tidak dapat dibaca."))};image.src=url});width=source.naturalWidth;height=source.naturalHeight;}
    const scale=Math.min(1,maxWidth/width,maxHeight/height),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext("2d");ctx.drawImage(source,0,0,canvas.width,canvas.height);cleanup();
    return canvas.toDataURL("image/jpeg",quality);
  }
  async function storeImage(inputId,key,maxW,maxH,quality,label){
    const input=$(inputId);input?.addEventListener("change",async()=>{
      const file=input.files?.[0];if(!file)return;
      if(file.size>15*1024*1024){toast("Ukuran gambar maksimal 15 MB sebelum dikompres.");input.value="";return;}
      try{
        const data=await compressImage(file,maxW,maxH,quality),d=readDesign();d[key]=data;
        if(!write(DESIGN_KEY,d))throw new Error("Penyimpanan perangkat tidak cukup. Hapus gambar lama atau gunakan file lebih kecil.");
        applyDesign();toast(label+" berhasil diperbarui.");input.value="";
      }catch(e){toast(e.message||"Gambar gagal diproses.");input.value="";}
    });
  }
  function setSurface(name){
    const allowed=["aurora","ocean","nebula","midnight"],surface=allowed.includes(name)?name:"aurora";
    document.body.dataset.surface=surface;localStorage.setItem(SURFACE_KEY,surface);
    document.querySelectorAll("[data-surface]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.surface===surface)));
  }
  function setupSurface(){
    document.querySelectorAll("[data-surface]").forEach(b=>b.addEventListener("click",()=>{setSurface(b.dataset.surface);toast("Background "+b.dataset.surface+" diterapkan.");}));
    setSurface(localStorage.getItem(SURFACE_KEY)||"aurora");
    $("clearProfileBackground")?.addEventListener("click",()=>{const d=readDesign();d.background="";if(!write(DESIGN_KEY,d)){toast("Background belum terhapus karena penyimpanan browser penuh.");return;}applyDesign();setSurface("aurora");toast("Background pribadi dihapus.");});
    $("clearProfileBanner")?.addEventListener("click",()=>{const d=readDesign();d.banner="";if(!write(DESIGN_KEY,d)){toast("Banner belum terhapus karena penyimpanan browser penuh.");return;}applyDesign();window.dispatchEvent(new Event("aryanzz:profile-assets-updated"));toast("Banner berhasil dihapus.");});
    $("clearProfilePhoto")?.addEventListener("click",()=>{const d=readDesign();d.avatar="";if(!write(DESIGN_KEY,d)){toast("Foto profil belum terhapus karena penyimpanan browser penuh.");return;}applyDesign();window.dispatchEvent(new Event("aryanzz:profile-assets-updated"));toast("Foto profil berhasil dihapus.");});
  }
  function profileCounts(){
    const count=keys=>{for(const key of keys){const value=read(key,[]);if(Array.isArray(value)&&value.length)return value.length;}return 0;};
    const history=count(HISTORY_KEYS),favorites=count(FAV_KEYS);
    if($("profileHistoryCount"))$("profileHistoryCount").textContent=history;
    if($("profileFavoriteCount"))$("profileFavoriteCount").textContent=favorites;
    let since=localStorage.getItem("aryanzz.member.since.v25");if(!since){const now=new Date();since=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");localStorage.setItem("aryanzz.member.since.v25",since);}
    const parts=/^\\d{4}-\\d{2}-\\d{2}$/.test(since)?since.split("-").map(Number):null;
    const joined=parts?new Date(parts[0],parts[1]-1,parts[2]):new Date(since);
    if($("profileSince"))$("profileSince").textContent=(Number.isNaN(joined.getTime())?new Date():joined).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});
  }
  function setupProfilePreview(){
    const name=$("profileName"),bio=$("profileBio"),saved=read(PROFILE_KEY,{});
    if(name)name.value=String(saved.name||"");
    if(bio)bio.value=String(saved.bio||"");
    const update=()=>{
      const profile={name:String(name?.value||"").trim().slice(0,40),bio:String(bio?.value||"").trim().slice(0,160),updatedAt:Date.now()};
      if($("profileSummary"))$("profileSummary").textContent=profile.name||"Pengguna ARYANZZ";
      if($("profileBioPreview"))$("profileBioPreview").textContent=profile.bio||"Selamat datang di ruang personal ARYANZZ.";
      if($("profileCharCount")&&bio)$("profileCharCount").textContent=bio.value.length+"/160 karakter";
      if(!write(PROFILE_KEY,profile)){setAutoSaveStatus("Penyimpanan perangkat penuh.",true);return;}
      const design=readDesign();if(!design.avatar&&$("profileAvatar"))$("profileAvatar").textContent=(profile.name.charAt(0)||"A").toUpperCase();
      setAutoSaveStatus("Perubahan tersimpan otomatis di perangkat ini.");
      queueAutoSnapshot();
    };
    name?.addEventListener("input",update);bio?.addEventListener("input",update);update();
    $("profileSave")?.addEventListener("click",()=>{update();toast("Profil tersimpan otomatis.");});
    $("profileReset")?.addEventListener("click",()=>{if(name)name.value="";if(bio)bio.value="";update();toast("Informasi profil direset.");});
  }
  function setupMotionToggle(){
    const input=$("profileMotionToggle"),statusEl=$("profileMotionStatus");
    const reduceMotion=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saved=localStorage.getItem(MOTION_KEY);
    const enabled=!reduceMotion&&saved!=="off";
    document.body.dataset.motion=enabled?"on":"off";
    if(input){
      input.checked=enabled;
      input.disabled=reduceMotion;
      input.addEventListener("change",()=>{
        const next=input.checked&&!reduceMotion;
        document.body.dataset.motion=next?"on":"off";
        try{localStorage.setItem(MOTION_KEY,next?"on":"off");}catch{}
        if(statusEl)statusEl.textContent=reduceMotion?"Animasi dibatasi oleh pengaturan aksesibilitas perangkat.":next?"Animasi aktif di beranda, profil, dan halaman alat.":"Animasi dinonaktifkan.";
        window.dispatchEvent(new Event("aryanzz:motion-changed"));
        queueAutoSnapshot();
      });
    }
    if(statusEl)statusEl.textContent=reduceMotion?"Animasi dibatasi oleh pengaturan aksesibilitas perangkat.":enabled?"Animasi aktif di beranda, profil, dan halaman alat.":"Animasi dinonaktifkan.";
  }

  function setupReveal(){
    const targets=document.querySelectorAll(".v25-profile-card,.v25-profile-stats>div");
    if(document.body.dataset.motion==="off"){targets.forEach(el=>el.classList.add("v25-visible"));return;}
    if(!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches){targets.forEach(el=>el.classList.add("v25-visible"));return;}
    targets.forEach(el=>el.classList.add("v25-reveal"));
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("v25-visible");observer.unobserve(entry.target);}}),{threshold:.08});
    targets.forEach(el=>observer.observe(el));
  }
  function setupPremiumEffects(){
    if(document.body.dataset.motion==="off")return;
    if(window.matchMedia("(pointer:fine)").matches&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      document.querySelectorAll(".v25-profile-card").forEach(card=>{
        card.addEventListener("pointermove",e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform="perspective(900px) rotateX("+(-y*2.4)+"deg) rotateY("+(x*2.4)+"deg) translateY(-2px)";});
        card.addEventListener("pointerleave",()=>{card.style.transform="";});
      });
    }
  }

  const DEVICE_KEY="aryanzz.device.sessions.v26", DEVICE_ID_KEY="aryanzz.device.id.v26";
  function deviceLabel(){
    const ua=navigator.userAgent||"";
    const os=/Android/i.test(ua)?"Android":/iPhone|iPad|iPod/i.test(ua)?"iOS":/Windows/i.test(ua)?"Windows":/Mac OS|Macintosh/i.test(ua)?"macOS":/Linux/i.test(ua)?"Linux":"Perangkat";
    const match=ua.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build|\))/i);
    const model=match?match[1].trim():"";
    const browser=/Edg\//.test(ua)?"Edge":/Firefox\//.test(ua)?"Firefox":/SamsungBrowser\//.test(ua)?"Samsung Internet":/Chrome\//.test(ua)?"Chrome":/Safari\//.test(ua)?"Safari":"Browser";
    return [model,os,browser].filter(Boolean).join(" · ");
  }
  function localDate(value=Date.now()){return new Date(value).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
  let currentDeviceId="";
  function renderDeviceHistory(){
    const box=$("deviceHistoryList");if(!box)return;
    const sessions=read(DEVICE_KEY,[]);box.replaceChildren();
    if(!Array.isArray(sessions)||!sessions.length){box.textContent="Belum ada riwayat perangkat.";return;}
    sessions.slice(0,8).forEach(item=>{
      const row=document.createElement("div");row.className="v25-device-row";
      const title=document.createElement("b");title.textContent=item.label||"Perangkat";
      const meta=document.createElement("small");meta.textContent=(item.id===currentDeviceId?"Perangkat ini · ":"")+localDate(item.at);
      row.append(title,meta);box.append(row);
    });
  }
  function initDeviceHistory(){
    const label=deviceLabel();
    currentDeviceId=localStorage.getItem(DEVICE_ID_KEY)||("dev-"+(crypto.randomUUID?.()||Math.random().toString(36).slice(2)));
    localStorage.setItem(DEVICE_ID_KEY,currentDeviceId);
    const old=read(DEVICE_KEY,[]);
    write(DEVICE_KEY,[{id:currentDeviceId,label,at:Date.now()},...(Array.isArray(old)?old.filter(x=>x.id!==currentDeviceId):[])].slice(0,15));
    if($("deviceCurrent"))$("deviceCurrent").textContent=label;
    renderDeviceHistory();
    const status=$("deviceLocationStatus"),saved=read("aryanzz.device.location.v26",null);
    if(status)status.textContent=saved?"Lokasi terakhir: "+saved.latitude.toFixed(5)+", "+saved.longitude.toFixed(5)+" · "+localDate(saved.at):"Lokasi belum dibagikan.";
    $("deviceGetLocation")?.addEventListener("click",()=>{
      if(!navigator.geolocation){if(status)status.textContent="Browser tidak mendukung lokasi.";return;}
      if(status)status.textContent="Meminta izin lokasi dari HP…";
      navigator.geolocation.getCurrentPosition(pos=>{
        const item={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:Math.round(pos.coords.accuracy),at:Date.now()};
        write("aryanzz.device.location.v26",item);
        if(status)status.textContent="Lokasi tersimpan lokal: "+item.latitude.toFixed(5)+", "+item.longitude.toFixed(5)+" (akurasi ±"+item.accuracy+" m).";
        const link=$("deviceMapLink");if(link){link.href="https://www.google.com/maps?q="+item.latitude+","+item.longitude;link.hidden=false;}
        toast("Lokasi berhasil disimpan di browser ini.");
      },err=>{if(status)status.textContent=err.code===1?"Izin lokasi ditolak. Aktifkan izin lokasi Chrome.":"Lokasi tidak tersedia. Periksa GPS dan jaringan.";},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
    });
    if(saved){const link=$("deviceMapLink");if(link){link.href="https://www.google.com/maps?q="+saved.latitude+","+saved.longitude;link.hidden=false;}}
    $("deviceClearHistory")?.addEventListener("click",()=>{write(DEVICE_KEY,[]);renderDeviceHistory();toast("Riwayat perangkat dihapus.");});
  }


  let autoSaveDbPromise=null,autoSaveTimer=0,autoSaveObserverInstalled=false;
  function setAutoSaveStatus(message,error=false){const node=$("profileAutoSaveStatus");if(node){node.textContent=message;node.dataset.state=error?"error":"saved";}}
  function openAutoSaveDb(){
    if(!("indexedDB" in window))return Promise.resolve(null);
    if(autoSaveDbPromise)return autoSaveDbPromise;
    autoSaveDbPromise=new Promise(resolve=>{
      try{
        const request=indexedDB.open(AUTOSAVE_DB,1);
        request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("snapshots"))db.createObjectStore("snapshots",{keyPath:"id"});};
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);
      }catch{resolve(null);}
    });
    return autoSaveDbPromise;
  }
  function collectAppStorage(){
    const data={};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&((key.startsWith("aryanzz.")&&!key.startsWith("aryanzz.autosave.")))){const value=localStorage.getItem(key);if(value!==null)data[key]=value;}}
    return data;
  }
  async function writeAutoSnapshot(){
    const db=await openAutoSaveDb();if(!db)return false;
    const snapshot={id:"latest",savedAt:Date.now(),data:collectAppStorage()};
    return new Promise(resolve=>{try{const tx=db.transaction("snapshots","readwrite");tx.objectStore("snapshots").put(snapshot);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false);}catch{resolve(false);}});
  }
  function queueAutoSnapshot(){
    if(autoSaveTimer)clearTimeout(autoSaveTimer);
    autoSaveTimer=setTimeout(async()=>{const ok=await writeAutoSnapshot();setAutoSaveStatus(ok?"Tersimpan otomatis · cadangan lokal diperbarui.":"Auto-save profil aktif; cadangan otomatis tidak tersedia di browser ini.",!ok);},450);
  }
  function readAutoSnapshot(){
    return openAutoSaveDb().then(db=>new Promise(resolve=>{if(!db){resolve(null);return;}try{const request=db.transaction("snapshots","readonly").objectStore("snapshots").get("latest");request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>resolve(null);}catch{resolve(null);}}));
  }
  function installAutoSaveObserver(){
    if(autoSaveObserverInstalled)return;autoSaveObserverInstalled=true;
    try{
      const proto=Storage.prototype,originalSet=proto.setItem,originalRemove=proto.removeItem,originalClear=proto.clear;
      proto.setItem=function(key,value){const result=originalSet.call(this,key,value);if(this===localStorage&&((String(key).startsWith("aryanzz.")&&!String(key).startsWith("aryanzz.autosave."))))queueAutoSnapshot();return result;};
      proto.removeItem=function(key){const result=originalRemove.call(this,key);if(this===localStorage&&(String(key).startsWith("aryanzz.")))queueAutoSnapshot();return result;};
      proto.clear=function(){const result=originalClear.call(this);if(this===localStorage)queueAutoSnapshot();return result;};
    }catch{setAutoSaveStatus("Auto-save otomatis tidak dapat diaktifkan di browser ini.",true);}
  }
  function setupBackupActions(){
    $("exportData")?.addEventListener("click",()=>{
      const payload={app:"ARYANZZ",version:75,exportedAt:new Date().toISOString(),storage:collectAppStorage()};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
      const date=new Date().toISOString().slice(0,10);anchor.href=url;anchor.download="aryanzz-backup-"+date+".json";document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast("File backup berhasil dibuat.");
    });
    $("importData")?.addEventListener("change",async event=>{
      const input=event.currentTarget,file=input.files?.[0];if(!file)return;
      try{
        const payload=JSON.parse(await file.text()),storage=payload?.storage||payload?.data;
        if(payload?.app!=="ARYANZZ"||!storage||typeof storage!=="object"||Array.isArray(storage))throw new Error("File ini bukan backup ARYANZZ yang valid.");
        if(!window.confirm("Pulihkan backup ini? Data ARYANZZ yang ada di browser akan diganti."))return;
        const allowed=Object.entries(storage).filter(([key,value])=>(key.startsWith("aryanzz."))&&typeof value==="string");
        for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if((key?.startsWith("aryanzz."))&&!allowed.some(([savedKey])=>savedKey===key))localStorage.removeItem(key);}
        allowed.forEach(([key,value])=>localStorage.setItem(key,value));
        toast("Backup dipulihkan. Memuat ulang tampilan…");setTimeout(()=>location.reload(),650);
      }catch(error){toast(error.message||"Backup tidak dapat dipulihkan.");}finally{input.value="";}
    });
    $("restoreAutoBackup")?.addEventListener("click",async()=>{
      const snapshot=await readAutoSnapshot();
      if(!snapshot?.data){toast("Belum ada cadangan otomatis yang tersimpan.");return;}
      if(!window.confirm("Pulihkan cadangan otomatis terakhir dari browser ini? Data ARYANZZ saat ini akan diganti."))return;
      const allowed=Object.entries(snapshot.data).filter(([key,value])=>(key.startsWith("aryanzz."))&&typeof value==="string");
      for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if((key?.startsWith("aryanzz."))&&!allowed.some(([savedKey])=>savedKey===key))localStorage.removeItem(key);}
      allowed.forEach(([key,value])=>localStorage.setItem(key,value));
      toast("Cadangan otomatis dipulihkan. Memuat ulang…");setTimeout(()=>location.reload(),650);
    });
  }

  function init(){
    if(!$("profile"))return;
    installAutoSaveObserver();applyDesign();initDeviceHistory();
    storeImage("profileBanner","banner",1500,520,.78,"Banner");
    storeImage("profileBackground","background",1600,1000,.72,"Background");
    storeImage("profilePhoto","avatar",520,520,.8,"Foto profil");
    setupSurface();setupProfilePreview();setupBackupActions();setupMotionToggle();profileCounts();setupReveal();setupPremiumEffects();
    window.addEventListener("storage",()=>{profileCounts();applyDesign();});
    window.addEventListener("aryanzz:profile-assets-updated",applyDesign);
    queueAutoSnapshot();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
