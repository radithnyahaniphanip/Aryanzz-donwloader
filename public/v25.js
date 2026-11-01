/* ARYANZZ V16–V25 — profile studio, membership selector, personalization and motion */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const DESIGN_KEY="aryanzz.profile.design.v25";
  const PLAN_KEY="aryanzz.membership.selection.v25";
  const SURFACE_KEY="aryanzz.surface.v25";
  const HISTORY_KEYS=["aryanzz.history.v2","aryanzz-download-history-v1"];
  const FAV_KEYS=["aryanzz.favorites.v2","aryanzz.favorites.v2"];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  const plans={
    basic:{name:"ARYANZZ Basic",price:"Rp36.000",benefit:"Pengalaman praktis untuk aktivitas harian.",features:["Tools utama","Downloader media langsung","Speed test & web utilities","Riwayat dan favorit","Profil dan backup lokal"]},
    pro:{name:"ARYANZZ Pro",price:"Rp88.000",benefit:"Personalisasi lebih luas dan akses awal pengembangan.",features:["Semua benefit Basic","Preset tema dan efek visual","Personalisasi banner & background","Akses awal tools baru","Prioritas usulan fitur"]},
    elite:{name:"ARYANZZ Elite",price:"Rp479.000",benefit:"Pengalaman paling personal dan kesempatan mencoba fitur lebih awal.",features:["Semua benefit Pro","Badge Elite","Preset visual eksklusif","Akses beta fitur pilihan","Personalisasi tingkat lanjut"]}
  };
  let toastTimer;
  function toast(message){
    let el=$("v25Toast");if(!el){el=document.createElement("div");el.id="v25Toast";el.className="v25-toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.append(el);}
    el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
  }
  function readDesign(){return read(DESIGN_KEY,{banner:"",background:""});}
  function applyDesign(){
    const d=readDesign(),banner=$("profileBannerPreview");
    if(banner&&d.banner)banner.style.backgroundImage='linear-gradient(120deg,#08152555,#08152588),url("'+d.banner+'")';
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
    $("clearProfileBackground")?.addEventListener("click",()=>{const d=readDesign();d.background="";write(DESIGN_KEY,d);applyDesign();toast("Background pribadi dihapus.");});
  }
  function profileCounts(){
    const count=keys=>{for(const key of keys){const value=read(key,[]);if(Array.isArray(value)&&value.length)return value.length;}return 0;};
    const history=count(HISTORY_KEYS),favorites=count(FAV_KEYS);
    if($("profileHistoryCount"))$("profileHistoryCount").textContent=history;
    if($("profileFavoriteCount"))$("profileFavoriteCount").textContent=favorites;
    let since=localStorage.getItem("aryanzz.member.since.v25");if(!since){since=new Date().toISOString();localStorage.setItem("aryanzz.member.since.v25",since);}
    if($("profileSince"))$("profileSince").textContent=new Date(since).toLocaleDateString("id-ID",{month:"short",year:"2-digit"});
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
  async function copyText(value){
    try{await navigator.clipboard.writeText(value);toast("Ringkasan paket disalin.");}
    catch{const area=document.createElement("textarea");area.value=value;document.body.append(area);area.select();try{document.execCommand("copy");toast("Ringkasan paket disalin.");}catch{toast("Tidak dapat menyalin otomatis.");}area.remove();}
  }
  function selectPlan(id){
    const p=plans[id];if(!p)return;
    localStorage.setItem(PLAN_KEY,id);
    document.querySelectorAll("[data-plan-card]").forEach(card=>card.classList.toggle("is-selected",card.dataset.planCard===id));
    const status=$("planSelectionStatus");if(status){
      status.innerHTML="";
      const title=document.createElement("b");title.textContent=p.name+" · "+p.price;
      const detail=document.createElement("p");detail.textContent="Paket ini tersimpan sebagai pilihanmu di perangkat. Ini belum mengaktifkan langganan atau melakukan pembayaran.";
      const copy=document.createElement("button");copy.type="button";copy.className="tag";copy.textContent="Salin ringkasan paket";
      copy.addEventListener("click",()=>copyText("Saya tertarik dengan "+p.name+" ("+p.price+").\nBenefit: "+p.features.join(", ")+".\nMohon informasi resmi mengenai periode dan metode pembayaran ARYANZZ."));
      status.append(title,detail,copy);
    }
    const badge=document.querySelector(".v25-member-badge");if(badge)badge.textContent="✦ "+p.name.toUpperCase()+" · DIPILIH";
    toast(p.name+" dipilih. Belum ada pembayaran yang dilakukan.");
  }
  function setupPlans(){
    document.querySelectorAll("[data-select-plan]").forEach(b=>b.addEventListener("click",()=>selectPlan(b.dataset.selectPlan)));
    const saved=localStorage.getItem(PLAN_KEY);if(saved&&plans[saved])selectPlan(saved);
  }
  function setupReveal(){
    const targets=document.querySelectorAll(".v25-profile-card,.v25-plan-card,.v25-plan-compare,.v25-profile-stats>div");
    if(!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches){targets.forEach(el=>el.classList.add("v25-visible"));return;}
    targets.forEach(el=>el.classList.add("v25-reveal"));
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("v25-visible");observer.unobserve(entry.target);}}),{threshold:.08});
    targets.forEach(el=>observer.observe(el));
  }
  function setupPremiumEffects(){
    if(window.matchMedia("(pointer:fine)").matches&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      document.querySelectorAll(".v25-plan-card,.v25-profile-card").forEach(card=>{
        card.addEventListener("pointermove",e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform="perspective(900px) rotateX("+(-y*2.4)+"deg) rotateY("+(x*2.4)+"deg) translateY(-2px)";});
        card.addEventListener("pointerleave",()=>{card.style.transform="";});
      });
    }
  }
  function init(){
    if(!$("profile"))return;
    applyDesign();storeImage("profileBanner","banner",1500,520,.78,"Banner");storeImage("profileBackground","background",1600,1000,.72,"Background");
    setupSurface();setupProfilePreview();profileCounts();setupPlans();setupReveal();setupPremiumEffects();
    window.addEventListener("storage",profileCounts);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
