/* ARYANZZ V26 — free profile studio, personalization and motion */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const DESIGN_KEY="aryanzz.profile.design.v25";
  const SURFACE_KEY="aryanzz.surface.v25";
  const HISTORY_KEYS=["aryanzz.history.v2","aryanzz-download-history-v1"];
  const FAV_KEYS=["aryanzz.favorites.v2","aryanzz.favorites.v2"];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  let toastTimer;
  function toast(message){
    let el=$("v25Toast");if(!el){el=document.createElement("div");el.id="v25Toast";el.className="v25-toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.append(el);}
    el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
  }
  function readDesign(){return read(DESIGN_KEY,{banner:"",background:""});}
  function applyDesign(){
    const d=readDesign(),banner=$("profileBannerPreview");
    if(banner){if(d.banner)banner.style.backgroundImage='linear-gradient(120deg,#08152555,#08152588),url("'+d.banner+'")';else banner.style.removeProperty("background-image");}
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
    const name=$("profileName"),bio=$("profileBio");
    const update=()=>{
      if($("profileSummary")&&name)$("profileSummary").textContent=name.value.trim()||"Pengguna ARYANZZ";
      if($("profileBioPreview")&&bio)$("profileBioPreview").textContent=bio.value.trim()||"Selamat datang di ruang personal ARYANZZ.";
      if($("profileCharCount")&&bio)$("profileCharCount").textContent=bio.value.length+"/160 karakter";
    };
    name?.addEventListener("input",update);bio?.addEventListener("input",update);update();
    $("profileSave")?.addEventListener("click",()=>{setTimeout(()=>{update();toast("Profil ARYANZZ tersimpan.");},60);});
    $("profileReset")?.addEventListener("click",()=>setTimeout(()=>{update();toast("Informasi profil direset.");},60));
    $("profilePhoto")?.addEventListener("change",()=>setTimeout(()=>toast("Foto profil diperbarui."),350));
  }
  function setupReveal(){
    const targets=document.querySelectorAll(".v25-profile-card,.v25-profile-stats>div");
    if(!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches){targets.forEach(el=>el.classList.add("v25-visible"));return;}
    targets.forEach(el=>el.classList.add("v25-reveal"));
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("v25-visible");observer.unobserve(entry.target);}}),{threshold:.08});
    targets.forEach(el=>observer.observe(el));
  }
  function setupPremiumEffects(){
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

  function init(){
    if(!$("profile"))return;
    applyDesign();initDeviceHistory();storeImage("profileBanner","banner",1500,520,.78,"Banner");storeImage("profileBackground","background",1600,1000,.72,"Background");
    setupSurface();setupProfilePreview();profileCounts();setupReveal();setupPremiumEffects();
    window.addEventListener("storage",()=>{profileCounts();applyDesign();});
    window.addEventListener("aryanzz:profile-assets-updated",applyDesign);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
