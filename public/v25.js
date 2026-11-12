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
  const safeGet=(key,fallback="")=>{try{const value=localStorage.getItem(key);return value===null?fallback:value}catch{return fallback}};
  const safeSet=(key,value)=>{try{localStorage.setItem(key,String(value));return true}catch{return false}};
  const read=(key,fallback)=>{try{return JSON.parse(safeGet(key,JSON.stringify(fallback)))}catch{return fallback}};
  const write=(key,value)=>{try{return safeSet(key,JSON.stringify(value))}catch{return false}};
  const MOTION_AVATAR_DB="aryanzz-profile-motion-v1";
  let motionAvatarDbPromise=null,motionAvatarObjectUrl="",motionAvatarLoadToken=0;
  let toastTimer;
  function openMotionAvatarDb(){
    if(!("indexedDB" in window))return Promise.resolve(null);
    if(motionAvatarDbPromise)return motionAvatarDbPromise;
    motionAvatarDbPromise=new Promise(resolve=>{
      try{
        const request=indexedDB.open(MOTION_AVATAR_DB,1);
        request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("assets"))db.createObjectStore("assets");};
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>resolve(null);
        request.onblocked=()=>resolve(null);
      }catch{resolve(null);}
    });
    return motionAvatarDbPromise;
  }
  async function saveMotionAvatar(file){
    const db=await openMotionAvatarDb();
    if(!db)throw new Error("Penyimpanan GIF tidak tersedia di browser ini.");
    return new Promise((resolve,reject)=>{
      try{
        const tx=db.transaction("assets","readwrite");
        tx.objectStore("assets").put(file,"avatar");
        tx.oncomplete=()=>resolve(true);
        tx.onerror=()=>reject(new Error("GIF gagal disimpan di perangkat."));
        tx.onabort=()=>reject(new Error("Penyimpanan GIF dibatalkan."));
      }catch{reject(new Error("Penyimpanan GIF tidak dapat dibuka."));}
    });
  }
  async function readMotionAvatar(){
    const db=await openMotionAvatarDb();if(!db)return null;
    return new Promise(resolve=>{
      try{const request=db.transaction("assets","readonly").objectStore("assets").get("avatar");request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>resolve(null);}
      catch{resolve(null);}
    });
  }
  async function removeMotionAvatar(){
    const db=await openMotionAvatarDb();if(!db)return false;
    return new Promise(resolve=>{
      try{const tx=db.transaction("assets","readwrite");tx.objectStore("assets").delete("avatar");tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false);}
      catch{resolve(false);}
    });
  }
  function revokeMotionAvatarUrl(){
    if(motionAvatarObjectUrl){try{URL.revokeObjectURL(motionAvatarObjectUrl);}catch{}motionAvatarObjectUrl="";}
    $("profileAvatar")?.classList.remove("ary-profile2-avatar-animated");
  }
  async function applyMotionAvatar(){
    const token=++motionAvatarLoadToken,avatar=$("profileAvatar"),design=readDesign();
    if(!design.avatarAnimated){revokeMotionAvatarUrl();return;}
    const blob=await readMotionAvatar();
    if(token!==motionAvatarLoadToken||!avatar||!readDesign().avatarAnimated)return;
    if(!blob||typeof blob.size!=="number"){revokeMotionAvatarUrl();return;}
    revokeMotionAvatarUrl();
    motionAvatarObjectUrl=URL.createObjectURL(blob);
    avatar.style.backgroundImage='url("'+motionAvatarObjectUrl+'")';
    avatar.style.backgroundSize="cover";
    avatar.style.backgroundPosition="center";
    avatar.textContent="";
    avatar.classList.add("ary-profile2-avatar-animated");
    const removeAvatar=$("clearProfilePhoto");if(removeAvatar)removeAvatar.hidden=false;
  }
  function moveCoverActions(){
    const profile=$("profile"),header=profile?.querySelector(".ary-profile2-header"),actions=profile?.querySelector(".ary-profile2-cover-actions");
    if(header&&actions&&actions.parentElement!==header)header.appendChild(actions);
  }
  function toast(message){
    let el=$("v25Toast");if(!el){el=document.createElement("div");el.id="v25Toast";el.className="v25-toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.append(el);}
    el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
  }
  function readDesign(){return read(DESIGN_KEY,{banner:"",background:"",avatar:""});}
  function applyDesign(){
    const d=readDesign(),banner=$("profileBannerPreview"),avatar=$("profileAvatar"),profile=read(PROFILE_KEY,{});
    if(banner){if(d.banner)banner.style.backgroundImage='linear-gradient(120deg,#08152555,#08152588),url("'+d.banner+'")';else banner.style.removeProperty("background-image");}
    if(avatar){if(d.avatar){avatar.style.backgroundImage='url("'+d.avatar+'")';avatar.textContent="";}else{avatar.style.removeProperty("background-image");avatar.textContent=(String(profile.name||"A").trim().charAt(0)||"A").toUpperCase();}avatar.classList.remove("ary-profile2-avatar-animated");}
    const removeBanner=$("clearProfileBanner"),removeAvatar=$("clearProfilePhoto");
    if(removeBanner)removeBanner.hidden=!d.banner;
    if(removeAvatar)removeAvatar.hidden=!d.avatar;
    document.body.style.removeProperty("--v25-bg-image");document.body.dataset.customBackground="false";
    applyMotionAvatar();
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
      if(file.size>15*1024*1024){toast("Ukuran gambar maksimal 15 MB sebelum diproses.");input.value="";return;}
      try{
        const d=readDesign();
        if(key==="avatar"&&String(file.type||"").toLowerCase()==="image/gif"){
          const previous=await readMotionAvatar();
          await saveMotionAvatar(file);
          d.avatar="";d.avatarAnimated=true;
          if(!write(DESIGN_KEY,d)){
            if(previous)await saveMotionAvatar(previous);else await removeMotionAvatar();
            throw new Error("Penyimpanan perangkat tidak cukup untuk GIF.");
          }
          applyDesign();
          window.dispatchEvent(new Event("aryanzz:profile-assets-updated"));
          toast("Foto profil GIF bergerak berhasil diperbarui.");
          input.value="";
          return;
        }
        const data=await compressImage(file,maxW,maxH,quality);
        d[key]=data;
        if(key==="avatar")d.avatarAnimated=false;
        if(!write(DESIGN_KEY,d))throw new Error("Penyimpanan perangkat tidak cukup. Hapus gambar lama atau gunakan file lebih kecil.");
        if(key==="avatar")await removeMotionAvatar();
        applyDesign();
        if(key==="avatar")window.dispatchEvent(new Event("aryanzz:profile-assets-updated"));
        toast(label+" berhasil diperbarui.");input.value="";
      }catch(e){toast(e.message||"Gambar gagal diproses.");input.value="";}
    });
  }
  function setSurface(name){
    const allowed=["aurora","ocean","nebula","midnight"],surface=allowed.includes(name)?name:"aurora";
    document.body.dataset.surface=surface;safeSet(SURFACE_KEY,surface);
    document.querySelectorAll("[data-surface]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.surface===surface)));
  }
  function setupSurface(){
    $("clearProfileBackground")?.addEventListener("click",()=>{const d=readDesign();d.background="";if(!write(DESIGN_KEY,d)){toast("Background belum terhapus karena penyimpanan browser penuh.");return;}applyDesign();toast("Background pribadi dihapus.");});
    $("clearProfileBanner")?.addEventListener("click",()=>{const d=readDesign();d.banner="";if(!write(DESIGN_KEY,d)){toast("Banner belum terhapus karena penyimpanan browser penuh.");return;}applyDesign();window.dispatchEvent(new Event("aryanzz:profile-assets-updated"));toast("Banner berhasil dihapus.");});
    $("clearProfilePhoto")?.addEventListener("click",()=>{const d=readDesign();d.avatar="";d.avatarAnimated=false;if(!write(DESIGN_KEY,d)){toast("Foto profil belum terhapus karena penyimpanan browser penuh.");return;}removeMotionAvatar();applyDesign();window.dispatchEvent(new Event("aryanzz:profile-assets-updated"));toast("Foto profil berhasil dihapus.");});
  }
  function profileCounts(){
    const count=keys=>{for(const key of keys){const value=read(key,[]);if(Array.isArray(value)&&value.length)return value.length;}return 0;};
    const history=count(HISTORY_KEYS),favorites=count(FAV_KEYS);
    if($("profileHistoryCount"))$("profileHistoryCount").textContent=history;
    if($("profileFavoriteCount"))$("profileFavoriteCount").textContent=favorites;
    let since=safeGet("aryanzz.member.since.v25","");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(since)){
      const now=new Date();since=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
      safeSet("aryanzz.member.since.v25",since);
    }
    const parts=/^\d{4}-\d{2}-\d{2}$/.test(since)?since.split("-").map(Number):null;
    const joined=parts?new Date(parts[0],parts[1]-1,parts[2]):new Date(since);
    if($("profileSince"))$("profileSince").textContent=(Number.isNaN(joined.getTime())?new Date():joined).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});
  }
  function setupProfilePreview(){
    const name=$("profileName"),bio=$("profileBio"),saved=read(PROFILE_KEY,{});
    const accountName=String(window.aryanzzAuthUser?.fullName||"Anggota ARYANZZ").trim().slice(0,40);
    const savedName=String(saved.name||"").trim();
    const initialName=savedName&&!["Pengguna ARYANZZ","Anggota ARYANZZ"].includes(savedName)?savedName:accountName;
    if(name)name.value=initialName;
    if(bio)bio.value=String(saved.bio||"");
    const update=()=>{
      const profile={name:String(name?.value||"").trim().slice(0,40),bio:String(bio?.value||"").trim().slice(0,160),updatedAt:Date.now()};
      if($("profileSummary"))$("profileSummary").textContent=profile.name||accountName;
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
    const saved=safeGet(MOTION_KEY,"");
    const enabled=saved==="on"||(!reduceMotion&&saved!=="off");
    document.body.dataset.motion=enabled?"on":"off";
    if(input){
      input.checked=enabled;
      input.disabled=false;
      input.addEventListener("change",()=>{
        const next=input.checked;
        document.body.dataset.motion=next?"on":"off";
        safeSet(MOTION_KEY,next?"on":"off");
        if(statusEl)statusEl.textContent=next?"Animasi aktif sesuai pilihanmu.":"Animasi dinonaktifkan.";
        window.dispatchEvent(new Event("aryanzz:motion-changed"));
        if(next){setupReveal();setupPremiumEffects();document.body.classList.remove("v25-motion-pulse");void document.body.offsetWidth;document.body.classList.add("v25-motion-pulse");}else{document.querySelectorAll(".v25-profile-card,.v25-profile-stats>div").forEach(el=>{el.classList.remove("v25-reveal","v25-visible");el.style.transform="";});}
        queueAutoSnapshot();
      });
    }
    if(statusEl)statusEl.textContent=enabled?"Animasi aktif sesuai pilihanmu.":"Animasi dinonaktifkan.";
  }

  function setupReveal(){
    const targets=document.querySelectorAll(".v25-profile-card,.v25-profile-stats>div");
    targets.forEach(el=>{
      el.classList.remove("v25-reveal");
      el.classList.add("v25-visible");
      el.style.opacity="1";
      el.style.transform="none";
    });
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
  const LOCATION_KEY="aryanzz.device.location.v26";
  let currentDeviceId="";
  const deviceDate=value=>{
    const ms=Number(value);
    if(!Number.isFinite(ms)||ms<=0)return "Waktu tidak tersedia";
    return new Date(ms).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  };
  function browserDeviceInfo(){
    const ua=String(navigator.userAgent||"");
    const android=ua.match(/Android\s*([\d.]+)/i),ios=ua.match(/(?:iPhone OS|CPU OS)\s*([\d_]+)/i);
    const os=android?"Android "+android[1]:ios?"iOS "+ios[1].replace(/_/g,"."):
      /Windows NT/i.test(ua)?"Windows":/Mac OS X/i.test(ua)?"macOS":/Linux/i.test(ua)?"Linux":"Sistem tidak tersedia";
    const browserMatch=ua.match(/(?:Edg|Firefox|SamsungBrowser|Chrome|Version)\/([\d.]+)/);
    const browser=/Edg\//.test(ua)?"Microsoft Edge":/Firefox\//.test(ua)?"Mozilla Firefox":
      /SamsungBrowser\//.test(ua)?"Samsung Internet":/Chrome\//.test(ua)?"Google Chrome":
      /Safari\//.test(ua)?"Safari":"Browser tidak teridentifikasi";
    const fullBrowser=browserMatch?browser+" "+browserMatch[1].split(".")[0]:browser;
    const rawModel=ua.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/|\))/i)?.[1]?.trim()||"";
    const model=rawModel.length>=3&&!/^(?:Linux|Android|Mobile|wv)$/i.test(rawModel)?rawModel:"Tidak dibagikan browser";
    const kind=/iPad|Tablet/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))?"Tablet":/Android|iPhone|iPod/i.test(ua)?"Ponsel":"Komputer";
    return {os,browser:fullBrowser,model,kind,label:[model!=="Tidak dibagikan browser"?model:kind,os.split(" ")[0],browser].join(" / ")};
  }
  function deviceLabel(){return browserDeviceInfo().label;}
  function writeDeviceSpec(key,value){
    const node=document.querySelector('#deviceSpecGrid [data-device-spec="'+key+'"]');
    if(node)node.textContent=String(value??"Tidak tersedia");
  }
  function renderDeviceSpecifications(info){
    const width=Number(window.screen?.width)||0,height=Number(window.screen?.height)||0;
    const dpr=Number(window.devicePixelRatio)||1;
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const threads=Number(navigator.hardwareConcurrency)||0;
    const ram=Number(navigator.deviceMemory)||0;
    const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"Tidak diketahui";
    writeDeviceSpec("os",info.os);
    writeDeviceSpec("model",info.model);
    writeDeviceSpec("browser",info.browser);
    writeDeviceSpec("kind",info.kind);
    writeDeviceSpec("screen",width&&height?width+" × "+height+" CSS px":"Tidak tersedia");
    writeDeviceSpec("scale",Number.isFinite(dpr)?dpr.toFixed(2)+"×":"Tidak tersedia");
    writeDeviceSpec("cpu",threads?threads+" thread logis (perkiraan)":"Tidak dibagikan browser");
    writeDeviceSpec("ram",ram?ram+" GB (perkiraan)":"Tidak dibagikan browser");
    writeDeviceSpec("network",connection?.effectiveType?String(connection.effectiveType).toUpperCase()+" (estimasi)":"Tidak dibagikan browser");
    writeDeviceSpec("locale",(navigator.language||"Tidak diketahui")+" / "+timezone);
    writeDeviceSpec("battery","Tidak dibagikan browser");
    if(typeof navigator.getBattery==="function"){
      navigator.getBattery().then(battery=>{
        if(!battery)return;
        const node=document.querySelector('#deviceSpecGrid [data-device-spec="battery"]');
        if(node)node.textContent=Math.round(Number(battery.level)*100)+"%"+(battery.charging?" (mengisi daya)":"");
      }).catch(()=>{});
    }
    if(navigator.userAgentData?.getHighEntropyValues){
      navigator.userAgentData.getHighEntropyValues(["model"]).then(data=>{
        const model=String(data?.model||"").trim();
        if(model.length>=3&&!/^(?:Linux|Android|Mobile)$/i.test(model))writeDeviceSpec("model",model);
      }).catch(()=>{});
    }
  }
  function renderDeviceHistory(){
    const box=$("deviceHistoryList");if(!box)return;
    const sessions=read(DEVICE_KEY,[]);
    box.replaceChildren();
    if(!Array.isArray(sessions)||!sessions.length){
      const empty=document.createElement("p");empty.className="ary-v1-device-empty";empty.textContent="Belum ada sesi yang tersimpan di browser ini.";box.append(empty);return;
    }
    sessions.slice(0,10).forEach(item=>{
      const row=document.createElement("article");row.className="ary-v1-device-history-row";
      const icon=document.createElement("span");icon.className="ary-v1-device-history-icon";icon.setAttribute("aria-hidden","true");
      const copy=document.createElement("div");copy.className="ary-v1-device-history-copy";
      const title=document.createElement("b");title.textContent=String(item?.label||"Perangkat").slice(0,100);
      const meta=document.createElement("small");meta.textContent=deviceDate(item?.at);
      copy.append(title,meta);
      row.append(icon,copy);
      if(item?.id===currentDeviceId){
        const active=document.createElement("span");active.className="ary-v1-device-history-badge";active.textContent="Browser ini";row.append(active);
      }
      box.append(row);
    });
  }
  function validSavedDeviceLocation(item){
    return !!item&&Number.isFinite(Number(item.latitude))&&Number.isFinite(Number(item.longitude))
      &&Number(item.latitude)>=-90&&Number(item.latitude)<=90&&Number(item.longitude)>=-180&&Number(item.longitude)<=180;
  }
  function renderLocationMap(item){
    if(!validSavedDeviceLocation(item))return;
    const latitude=Number(item.latitude),longitude=Number(item.longitude);
    const latDelta=.009,lonDelta=.014;
    const west=Math.max(-180,longitude-lonDelta),east=Math.min(180,longitude+lonDelta);
    const south=Math.max(-90,latitude-latDelta),north=Math.min(90,latitude+latDelta);
    const mapUrl=new URL("https://www.openstreetmap.org/export/embed.html");
    mapUrl.searchParams.set("bbox",[west,south,east,north].join(","));
    mapUrl.searchParams.set("layer","mapnik");
    mapUrl.searchParams.set("marker",latitude+","+longitude);
    const frame=$("deviceMapFrame"),panel=$("deviceMapPanel");
    if(frame)frame.src=mapUrl.href;
    if(panel)panel.hidden=false;
    const details={
      coordinates:latitude.toFixed(5)+", "+longitude.toFixed(5),
      accuracy:Number.isFinite(Number(item.accuracy))?"±"+Math.round(Math.max(0,Number(item.accuracy)))+" m":"Tidak tersedia",
      time:deviceDate(item.at)
    };
    for(const [key,value] of Object.entries(details)){
      const node=panel?.querySelector('[data-map-detail="'+key+'"]');
      if(node)node.textContent=value;
    }
  }
  function hideLocationMap(){
    const frame=$("deviceMapFrame"),panel=$("deviceMapPanel");
    if(frame)frame.removeAttribute("src");
    if(panel)panel.hidden=true;
  }
  function initDeviceHistory(){
    const info=browserDeviceInfo();
    currentDeviceId=safeGet(DEVICE_ID_KEY,"")||("dev-"+(window.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)));
    safeSet(DEVICE_ID_KEY,currentDeviceId);
    const old=read(DEVICE_KEY,[]);
    write(DEVICE_KEY,[{id:currentDeviceId,label:info.label,os:info.os,browser:info.browser,at:Date.now()},
      ...(Array.isArray(old)?old.filter(item=>item?.id!==currentDeviceId):[])].slice(0,15));
    if($("deviceCurrent"))$("deviceCurrent").textContent=info.label;
    renderDeviceSpecifications(info);
    renderDeviceHistory();

    const status=$("deviceLocationStatus"),locate=$("deviceGetLocation"),
      showSaved=$("deviceShowSavedLocation"),remove=$("deviceRemoveLocation");
    const readLocation=()=>read(LOCATION_KEY,null);
    function refreshLocationStatus(){
      const saved=readLocation();
      const valid=validSavedDeviceLocation(saved);
      if(showSaved)showSaved.hidden=!valid;
      if(remove)remove.hidden=!valid;
      if(status)status.textContent=valid?"Lokasi lokal terakhir: "+deviceDate(saved.at)+". Tekan Tampilkan lokasi tersimpan untuk memuat peta.":"Lokasi belum dipindai.";
    }
    refreshLocationStatus();
    showSaved?.addEventListener("click",()=>{
      const saved=readLocation();
      if(!validSavedDeviceLocation(saved)){refreshLocationStatus();return;}
      renderLocationMap(saved);
      if(status)status.textContent="Peta lokasi terakhir ditampilkan dari penyimpanan browser.";
    });
    let locationBusy=false;
    locate?.addEventListener("click",()=>{
      if(locationBusy)return;
      if(!navigator.geolocation){if(status)status.textContent="Browser tidak mendukung geolokasi.";return;}
      locationBusy=true;
      if(locate){locate.disabled=true;locate.textContent="Mencari lokasi…";}
      if(status)status.textContent="Meminta izin lokasi dan menyiapkan peta…";
      const finish=()=>{locationBusy=false;if(locate){locate.disabled=false;locate.textContent="Pindai lokasi";}};
      const accept=pos=>{
        const item={latitude:Number(pos.coords.latitude),longitude:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy),at:Date.now()};
        if(!validSavedDeviceLocation(item)){finish();if(status)status.textContent="Koordinat tidak valid.";return;}
        const stored=safeSet(LOCATION_KEY,JSON.stringify(item));
        renderLocationMap(item);
        if(status)status.textContent="Peta berhasil ditampilkan. Akurasi sekitar ±"+Math.round(Math.max(0,item.accuracy||0))+" meter.";
        if(showSaved)showSaved.hidden=!stored;
        if(remove)remove.hidden=!stored;
        finish();
      };
      const fail=err=>{
        finish();
        if(status)status.textContent=err.code===1?"Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di Chrome.":err.code===3?"GPS belum merespons. Pastikan layanan lokasi HP aktif, lalu coba lagi.":"Lokasi belum tersedia. Periksa pengaturan lokasi perangkat.";
      };
      // Fast cached/coarse fix first; high accuracy only if the initial GPS request times out.
      navigator.geolocation.getCurrentPosition(accept,err=>{
        if(err.code===3){
          if(status)status.textContent="GPS membutuhkan waktu lebih lama. Mencoba akurasi tinggi…";
          navigator.geolocation.getCurrentPosition(accept,fail,{enableHighAccuracy:true,timeout:22000,maximumAge:60000});
        }else fail(err);
      },{enableHighAccuracy:false,timeout:12000,maximumAge:120000});
    });
    remove?.addEventListener("click",()=>{
      try{localStorage.removeItem(LOCATION_KEY);}catch{}
      hideLocationMap();
      refreshLocationStatus();
      toast("Lokasi dihapus dari browser ini.");
    });
    $("deviceClearHistory")?.addEventListener("click",()=>{
      if(!write(DEVICE_KEY,[])){toast("Riwayat tidak dapat dihapus karena penyimpanan browser tidak tersedia.");return;}
      renderDeviceHistory();
      toast("Riwayat perangkat dihapus.");
    });
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
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(key&&((key.startsWith("aryanzz.")&&!key.startsWith("aryanzz.autosave."))||key==="aryanzz-download-history-v1")){
          const value=localStorage.getItem(key);if(value!==null)data[key]=value;
        }
      }
    }catch{}
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
      proto.setItem=function(key,value){const result=originalSet.call(this,key,value);if(this===localStorage&&((String(key).startsWith("aryanzz.")&&!String(key).startsWith("aryanzz.autosave."))||String(key)==="aryanzz-download-history-v1"))queueAutoSnapshot();return result;};
      proto.removeItem=function(key){const result=originalRemove.call(this,key);if(this===localStorage&&(String(key).startsWith("aryanzz.")||String(key)==="aryanzz-download-history-v1"))queueAutoSnapshot();return result;};
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
        const allowed=Object.entries(storage).filter(([key,value])=>(key.startsWith("aryanzz.")||key==="aryanzz-download-history-v1")&&typeof value==="string");
        for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if((key?.startsWith("aryanzz.")||key==="aryanzz-download-history-v1")&&!allowed.some(([savedKey])=>savedKey===key))localStorage.removeItem(key);}
        allowed.forEach(([key,value])=>localStorage.setItem(key,value));
        toast("Backup dipulihkan. Memuat ulang tampilan…");setTimeout(()=>location.reload(),650);
      }catch(error){toast(error.message||"Backup tidak dapat dipulihkan.");}finally{input.value="";}
    });
    $("restoreAutoBackup")?.addEventListener("click",async()=>{
      const snapshot=await readAutoSnapshot();
      if(!snapshot?.data){toast("Belum ada cadangan otomatis yang tersimpan.");return;}
      if(!window.confirm("Pulihkan cadangan otomatis terakhir dari browser ini? Data ARYANZZ saat ini akan diganti."))return;
      try{
        const allowed=Object.entries(snapshot.data).filter(([key,value])=>(key.startsWith("aryanzz.")||key==="aryanzz-download-history-v1")&&typeof value==="string");
        for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if((key?.startsWith("aryanzz.")||key==="aryanzz-download-history-v1")&&!allowed.some(([savedKey])=>savedKey===key))localStorage.removeItem(key);}
        allowed.forEach(([key,value])=>localStorage.setItem(key,value));
        toast("Cadangan otomatis dipulihkan. Memuat ulang…");setTimeout(()=>location.reload(),650);
      }catch{toast("Cadangan ditemukan, tetapi penyimpanan browser menolak pemulihan. Kosongkan ruang lalu coba lagi.");}
    });
  }

  function initRandomProfileId(){
    const node=$("profileRandomId");if(!node)return;
    const key="aryanzz.profile.local-id.v94";let id=safeGet(key,"");
    if(!/^ARY-[A-Z0-9]{8}$/.test(id)){const bytes=new Uint8Array(5);crypto.getRandomValues(bytes);id="ARY-"+Array.from(bytes,b=>b.toString(36).padStart(2,"0")).join("").slice(0,8).toUpperCase();safeSet(key,id);}
    const accountId=String(window.aryanzzAuthUser?.id||"").trim();
    node.textContent=/^ARY-[A-Z0-9]{8,}$/.test(accountId)?accountId:id;
    const copy=$("profileCopyId");
    if(copy&&!copy.dataset.profileCopyBound){
      copy.dataset.profileCopyBound="true";
      copy.addEventListener("click",async()=>{
        const current=String(node.textContent||"").trim();
        try{await navigator.clipboard.writeText(current);toast("ID akun berhasil disalin.");}
        catch{toast("Tidak dapat menyalin ID pada browser ini.");}
      });
    }
  }
  function init(){
    if(!$("profile"))return;
    moveCoverActions();installAutoSaveObserver();setSurface(safeGet(SURFACE_KEY,"aurora"));applyDesign();initDeviceHistory();
    storeImage("profileBanner","banner",1500,520,.78,"Banner");
    storeImage("profilePhoto","avatar",520,520,.8,"Foto profil");
    setupSurface();setupProfilePreview();setupBackupActions();profileCounts();setupReveal();setupPremiumEffects();initRandomProfileId();
    window.addEventListener("storage",()=>{profileCounts();applyDesign();});
    window.addEventListener("aryanzz:profile-assets-updated",applyDesign);
    window.addEventListener("aryanzz:history-updated",profileCounts);
    queueAutoSnapshot();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
