/* ARYANZZ V91.0 — Smart Media Studio */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const root = $("mediaStudio");
  if (!root || !("indexedDB" in window)) return;
  const DB_NAME = "aryanzz-media-studio";
  const DB_VERSION = 1;
  const STORE = "media";
  let db = null, currentUrl = "", currentRecord = null, records = [];
  const fmt = bytes => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B","KB","MB","GB"]; const i = Math.min(3,Math.floor(Math.log(bytes)/Math.log(1024)));
    return (bytes/Math.pow(1024,i)).toFixed(i===0?0:1)+" "+units[i];
  };
  const setStatus = (id, message) => { const el=$(id); if(el)el.textContent=message; };
  const openDB = () => new Promise((resolve,reject) => {
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const database=req.result;if(!database.objectStoreNames.contains(STORE)){const store=database.createObjectStore(STORE,{keyPath:"id"});store.createIndex("createdAt","createdAt");store.createIndex("type","type");}};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("Database lokal tidak dapat dibuka."));
  });
  const tx = (mode, action) => new Promise((resolve,reject) => {
    const transaction=db.transaction(STORE,mode),store=transaction.objectStore(STORE);
    let request;
    try{request=action(store);}catch(error){reject(error);return;}
    transaction.oncomplete=()=>resolve(request?.result);
    transaction.onerror=()=>reject(transaction.error||request?.error||new Error("Penyimpanan gagal."));
    transaction.onabort=()=>reject(transaction.error||new Error("Transaksi penyimpanan dibatalkan."));
  });
  const getAll = () => tx("readonly",store=>store.getAll());
  const put = item => tx("readwrite",store=>store.put(item));
  const remove = id => tx("readwrite",store=>store.delete(id));
  const clear = () => tx("readwrite",store=>store.clear());
  const get = id => tx("readonly",store=>store.get(id));
  function typeOf(file){if(file.type.startsWith("video/"))return "video";if(file.type.startsWith("audio/"))return "audio";if(file.type.startsWith("image/"))return "image";return "";}
  function makeId(){return crypto.randomUUID?crypto.randomUUID():"ms-"+Date.now()+"-"+Math.random().toString(36).slice(2);}
  function updateStats(){
    $("msCount").textContent=records.length;
    $("msFavorites").textContent=records.filter(item=>item.favorite).length;
    $("msSize").textContent=fmt(records.reduce((sum,item)=>sum+(item.size||0),0));
  }
  function createButton(label,cls,handler){const button=document.createElement("button");button.type="button";button.className=cls;button.textContent=label;button.addEventListener("click",handler);return button;}
  function renderList(){
    const box=$("msLibraryList"),query=$("msSearch").value.trim().toLowerCase(),filter=$("msFilter").value;
    box.replaceChildren();
    const filtered=records.filter(item=>(filter==="all"||item.type===filter||(filter==="favorite"&&item.favorite))&&(!query||item.name.toLowerCase().includes(query)));
    if(!filtered.length){const empty=document.createElement("div");empty.className="ms-empty";empty.textContent=records.length?"Tidak ada file yang cocok dengan pencarian.":"Pustaka masih kosong. Tambahkan media dari perangkat untuk memulai.";box.append(empty);return;}
    for(const item of filtered){
      const row=document.createElement("article");row.className="ms-file-row";
      const icon=document.createElement("span");icon.className="ms-file-icon";icon.textContent=item.type==="video"?"▶":item.type==="audio"?"♫":"▧";
      const details=document.createElement("div");details.className="ms-file-details";
      const name=document.createElement("b");name.textContent=item.name;
      const meta=document.createElement("small");meta.textContent=item.type.toUpperCase()+" · "+fmt(item.size)+" · "+new Date(item.createdAt).toLocaleDateString();
      details.append(name,meta);
      const actions=document.createElement("div");actions.className="ms-file-actions";
      if(item.type!=="image")actions.append(createButton("▶ Putar","tag",()=>play(item.id)));
      else actions.append(createButton("Lihat","tag",()=>play(item.id)));
      actions.append(createButton(item.favorite?"★":"☆","tag",()=>toggleFavorite(item)));
      actions.append(createButton("↓","tag",()=>download(item)));
      actions.append(createButton("×","tag ms-danger",()=>deleteItem(item)));
      row.append(icon,details,actions);box.append(row);
    }
  }
  async function refresh(){
    records=(await getAll()).sort((a,b)=>b.createdAt-a.createdAt);
    updateStats();renderList();refreshStorage();
  }
  async function addFiles(files){
    const chosen=Array.from(files||[]);
    if(!chosen.length)return;
    let added=0,skipped=0;
    for(const file of chosen){
      const type=typeOf(file);
      if(!type||!file.size){skipped++;continue;}
      if(file.size>200*1024*1024){skipped++;continue;}
      try{await put({id:makeId(),name:file.name,type,mime:file.type||"application/octet-stream",size:file.size,createdAt:Date.now(),favorite:false,blob:file});added++;}
      catch(error){setStatus("msLibraryStatus","Penyimpanan penuh atau tidak tersedia: "+String(error.message||error));skipped++;break;}
    }
    $("msFileInput").value="";
    await refresh();
    setStatus("msLibraryStatus",added+" file berhasil disimpan di pustaka lokal."+(skipped?" "+skipped+" file dilewati (format/ukuran/kuota).":"")+" File tidak diunggah ke server.");
  }
  async function toggleFavorite(item){await put({...item,favorite:!item.favorite});await refresh();}
  async function deleteItem(item){
    if(!confirm("Hapus "+item.name+" dari pustaka lokal?"))return;
    if(currentRecord?.id===item.id)stopPlayer();
    await remove(item.id);await refresh();
  }
  async function download(item){
    const fresh=await get(item.id);if(!fresh?.blob)return;
    const url=URL.createObjectURL(fresh.blob),a=document.createElement("a");
    a.href=url;a.download=fresh.name;a.style.display="none";document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function stopPlayer(){
    for(const id of ["msVideo","msAudio"]){const el=$(id);el.pause();el.removeAttribute("src");el.load();el.hidden=true;}
    $("msImage").removeAttribute("src");$("msImage").hidden=true;
    $("msPlayerEmpty").hidden=false;
    if(currentUrl)URL.revokeObjectURL(currentUrl);
    currentUrl="";currentRecord=null;
    ["msPip","msFullscreen","msCapture"].forEach(id=>$(id).disabled=true);
  }
  async function play(id){
    const item=await get(id);if(!item?.blob)return;
    stopPlayer();currentRecord=item;currentUrl=URL.createObjectURL(item.blob);
    $("msPlayerEmpty").hidden=true;
    if(item.type==="video"){
      const video=$("msVideo");video.src=currentUrl;video.hidden=false;video.playbackRate=Number($("msSpeed").value)||1;video.load();
      $("msPip").disabled=!("pictureInPictureEnabled" in document&&document.pictureInPictureEnabled);
      $("msFullscreen").disabled=false;$("msCapture").disabled=false;
      video.play().catch(()=>setStatus("msPlayerStatus","Tekan tombol Play pada pemutar untuk mulai. Browser mungkin memerlukan interaksi langsung."));
    }else if(item.type==="audio"){
      const audio=$("msAudio");audio.src=currentUrl;audio.hidden=false;audio.playbackRate=Number($("msSpeed").value)||1;audio.load();
      $("msPlayerStatus").textContent="Audio siap diputar. Kontrol volume tersedia pada pemutar.";
      audio.play().catch(()=>setStatus("msPlayerStatus","Tekan tombol Play pada pemutar untuk mulai."));
    }else{
      const image=$("msImage");image.src=currentUrl;image.hidden=false;
      setStatus("msPlayerStatus",item.name+" · "+fmt(item.size));
    }
    if(item.type==="video")setStatus("msPlayerStatus",item.name+" · pemutar video aktif.");
  }
  async function refreshStorage(){
    try{
      const estimate=await navigator.storage?.estimate?.();
      if(!estimate){$("msUsage").textContent="Tidak didukung";$("msQuota").textContent="Browser tidak menyediakan Storage API.";return;}
      $("msUsage").textContent=fmt(estimate.usage||0);$("msQuota").textContent="Kuota origin: "+fmt(estimate.quota||0);
      const pct=estimate.quota?Math.min(100,(estimate.usage||0)/estimate.quota*100):0;
      $("msUsageBar").style.width=pct.toFixed(1)+"%";
      const persisted=await navigator.storage?.persisted?.();
      $("msPersist").textContent=persisted?"Aktif":"Belum aktif";
      $("msPersistBtn").disabled=!!persisted||!navigator.storage?.persist;
      if(persisted)setStatus("msStorageStatus","Penyimpanan persisten aktif pada origin ini.");
    }catch(error){setStatus("msStorageStatus","Informasi penyimpanan tidak tersedia: "+String(error.message||error));}
  }
  $("msFileInput").addEventListener("change",event=>addFiles(event.target.files));
  $("msSearch").addEventListener("input",renderList);
  $("msFilter").addEventListener("change",renderList);
  $("msSpeed").addEventListener("change",event=>{const speed=Number(event.target.value)||1;$("msVideo").playbackRate=speed;$("msAudio").playbackRate=speed;});
  $("msPip").addEventListener("click",async()=>{try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await $("msVideo").requestPictureInPicture();}catch(error){setStatus("msPlayerStatus","Picture-in-Picture gagal: "+String(error.message||error));}});
  $("msFullscreen").addEventListener("click",async()=>{try{const video=$("msVideo");if(document.fullscreenElement)await document.exitFullscreen();else await (video.requestFullscreen?video.requestFullscreen():$("msPlayerStage").requestFullscreen());}catch(error){setStatus("msPlayerStatus","Layar penuh tidak didukung: "+String(error.message||error));}});
  $("msCapture").addEventListener("click",()=>{
    const video=$("msVideo");if(!video.videoWidth||!video.videoHeight){setStatus("msPlayerStatus","Tunggu sampai video siap diputar, lalu coba screenshot lagi.");return;}
    try{const canvas=document.createElement("canvas");canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext("2d").drawImage(video,0,0);canvas.toBlob(blob=>{if(!blob){setStatus("msPlayerStatus","Browser gagal membuat screenshot.");return;}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="aryanzz-frame-"+Date.now()+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setStatus("msPlayerStatus","Screenshot frame berhasil dibuat.");},"image/png");}catch(error){setStatus("msPlayerStatus","Screenshot gagal: "+String(error.message||error));}
  });
  $("msOpenQueue").addEventListener("click",()=>{const button=document.querySelector('[data-panel="queue"]');if(button)button.click();});
  $("msRefreshStorage").addEventListener("click",refreshStorage);
  $("msPersistBtn").addEventListener("click",async()=>{try{const ok=await navigator.storage?.persist?.();$("msPersist").textContent=ok?"Aktif":"Belum diberikan";setStatus("msStorageStatus",ok?"Browser memberikan penyimpanan persisten.":"Browser belum memberikan penyimpanan persisten; pengelolaan tetap berjalan normal.");$("msPersistBtn").disabled=!!ok;}catch(error){setStatus("msStorageStatus","Permintaan gagal: "+String(error.message||error));}});
  $("msClearLibrary").addEventListener("click",async()=>{if(!confirm("Hapus semua file dari Pustaka Media lokal? Tindakan ini tidak dapat dibatalkan."))return;stopPlayer();await clear();await refresh();setStatus("msLibraryStatus","Semua file lokal dihapus dari pustaka.");});
  window.addEventListener("pagehide",()=>{if(currentUrl)URL.revokeObjectURL(currentUrl);});
  openDB().then(async database=>{db=database;await refresh();}).catch(error=>{setStatus("msLibraryStatus","Pustaka lokal tidak dapat dibuka: "+String(error.message||error));$("msFileInput").disabled=true;});
})();