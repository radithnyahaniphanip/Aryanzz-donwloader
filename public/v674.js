/* ARYANZZ V67.6 — UI controls */
(()=>{"use strict";

function initSearch(){
const a=$("downloadLinkMode"),b=$("downloadTitleMode"),x=$("linkModePanel"),y=$("titleModePanel"),picker=$("platformPicker");
const results=$("titleSearchResults"),help=$("titleSearchHelp"),searchInput=$("titleSearch"),searchType=$("titleSearchType"),platformSearch=$("platformSearch");
const linkInput=$("url"),linkLabel=$("linkModePanel")?.querySelector("label");
// Hanya sediakan pencarian Video dan Gambar; konversi MP4 ke MP3 berada di Pusat Alat.
// All-platform mode searches the complete supported platform list.
searchType?.querySelectorAll('option[value="audio"]').forEach(node=>node.remove());
const platforms={
 youtube:{name:"YouTube",url:q=>"https://www.youtube.com/results?search_query="+encodeURIComponent(q)},
 tiktok:{name:"TikTok",url:q=>"https://www.tiktok.com/search?q="+encodeURIComponent(q)},
 instagram:{name:"Instagram",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:instagram.com "+q)},
 snackvideo:{name:"SnackVideo",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:snackvideo.com "+q)},
 pinterest:{name:"Pinterest",url:q=>"https://www.pinterest.com/search/pins/?q="+encodeURIComponent(q)},
 facebook:{name:"Facebook",url:q=>"https://www.facebook.com/search/videos/?q="+encodeURIComponent(q)},
 x:{name:"X",url:q=>"https://x.com/search?q="+encodeURIComponent(q)},
 reddit:{name:"Reddit",url:q=>"https://www.reddit.com/search/?q="+encodeURIComponent(q)},
 vimeo:{name:"Vimeo",url:q=>"https://vimeo.com/search?q="+encodeURIComponent(q)},
 threads:{name:"Threads",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:threads.net "+q)},
 soundcloud:{name:"SoundCloud",url:q=>"https://soundcloud.com/search?q="+encodeURIComponent(q)},
 capcut:{name:"CapCut",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:capcut.com "+q)},
 tiktoklite:{name:"TikTok Lite",url:q=>"https://www.tiktok.com/search?q="+encodeURIComponent(q)},
 facebooklite:{name:"Facebook Lite",url:q=>"https://www.facebook.com/search/videos/?q="+encodeURIComponent(q)},
 snapchat:{name:"Snapchat",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:snapchat.com "+q)},
 idnapp:{name:"IDN App",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:idntimes.com "+q)},
 instagramlite:{name:"Instagram Lite",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:instagram.com "+q)},
 linkedin:{name:"LinkedIn",url:q=>"https://www.linkedin.com/search/results/content/?keywords="+encodeURIComponent(q)},
 wechat:{name:"WeChat",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:wechat.com OR site:weixin.qq.com "+q)},
 kakaotalk:{name:"KakaoTalk",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:kakao.com "+q)}
};
let selected="all",activeMode="link",searchController=null,pageSize=10,currentPage=1;
let platformCatalog=[],platformPage=1;
const PLATFORM_GUIDES={
 youtube:{link:"Tempel tautan video, Shorts, atau audio YouTube…",search:"Cari judul video YouTube…",videoHelp:"YouTube: periksa video atau Shorts publik, lalu pilih format dan kualitas yang tersedia.",imageHelp:"YouTube: cari gambar atau thumbnail publik. Hasil gambar dipisahkan dari hasil video."},
 tiktok:{link:"Tempel tautan TikTok: video atau Photo Mode…",search:"Cari judul video atau foto TikTok…",videoHelp:"TikTok: tautan video diperiksa sebagai MP4; Photo Mode menampilkan foto asli dan bisa dibuat menjadi video slideshow lokal tanpa audio sumber.",imageHelp:"TikTok Photo Mode: cari postingan foto, tampilkan seluruh gambar yang berhasil ditemukan, lalu unduh satu per satu."},
 instagram:{link:"Tempel tautan Reels, postingan foto, atau carousel Instagram…",search:"Cari Reels atau postingan foto Instagram…",videoHelp:"Instagram: periksa Reels/video publik. Postingan carousel akan diperiksa terpisah untuk foto asli.",imageHelp:"Instagram: cari postingan foto atau carousel publik dan unduh foto yang dapat diakses."},
 snackvideo:{link:"Tempel tautan berbagi video SnackVideo…",search:"Cari judul atau caption video SnackVideo…",videoHelp:"SnackVideo: gunakan tautan berbagi postingan publik. Stream akan divalidasi sebelum unduhan.",imageHelp:"SnackVideo: pemeriksaan foto hanya berhasil jika sumber publik mengekspos file gambar asli."},
 pinterest:{link:"Tempel tautan Pin Pinterest (foto atau video)…",search:"Cari Pin foto atau video Pinterest…",videoHelp:"Pinterest: periksa Pin video dan MP4 yang disediakan sumber.",imageHelp:"Pinterest: periksa Pin foto, tampilkan gambar asli, dan unduh gambar yang tersedia."},
 facebook:{link:"Tempel tautan postingan, Reels, foto, atau album Facebook…",search:"Cari video atau foto Facebook…",videoHelp:"Facebook: periksa video/Reels publik dan validasi stream sebelum unduhan.",imageHelp:"Facebook: periksa foto atau album publik; hasil gambar ditampilkan sebagai galeri."},
 x:{link:"Tempel tautan postingan X (video atau gambar)…",search:"Cari postingan video atau gambar di X…",videoHelp:"X: periksa video yang dilampirkan pada postingan publik.",imageHelp:"X: periksa gambar yang dilampirkan pada postingan publik."},
 reddit:{link:"Tempel tautan postingan Reddit (video atau gambar)…",search:"Cari postingan video atau gambar Reddit…",videoHelp:"Reddit: periksa video publik; beberapa sumber mengirim audio terpisah.",imageHelp:"Reddit: periksa galeri gambar pada postingan publik."},
 threads:{link:"Tempel tautan postingan Threads (foto atau video)…",search:"Cari postingan Threads…",videoHelp:"Threads: periksa video publik yang benar-benar memiliki stream media.",imageHelp:"Threads: periksa foto dan galeri pada postingan publik."},
 capcut:{link:"Tempel tautan hasil video publik CapCut…",search:"Cari template atau video CapCut…",videoHelp:"CapCut: gunakan tautan hasil ekspor yang dapat diputar publik; draft privat tidak dapat diambil.",imageHelp:"CapCut: foto sampul atau media gambar hanya tersedia jika tautan publik mengekspos file aslinya."},
 vimeo:{link:"Tempel tautan video Vimeo…",search:"Cari judul video Vimeo…",videoHelp:"Vimeo: periksa video publik yang tidak dilindungi kata sandi.",imageHelp:"Vimeo: gambar hanya tersedia jika halaman publik mengekspos media gambar asli."},
 soundcloud:{link:"Tempel tautan lagu atau audio SoundCloud…",search:"Cari judul lagu SoundCloud…",videoHelp:"SoundCloud adalah platform audio; hasilnya tidak akan dipaksakan menjadi MP4.",imageHelp:"SoundCloud: pencarian gambar tidak tersedia untuk konten audio."}
};
const setMode=v=>{const link=v==="link";const entry=platformCatalog.find(platform=>platform.id===selected);const modes=entry?.inputModes||["link","search"];const canLink=modes.includes("link"),canSearch=modes.includes("search");if(!canLink&&canSearch)v="title";if(!canSearch&&canLink)v="link";activeMode=v;const useLink=v==="link";if(x)x.hidden=!useLink;if(y)y.hidden=useLink;const workCard=document.querySelector("#home .v674-download");if(workCard)workCard.dataset.mode=useLink?"link":"title";const workspaceHeading=document.getElementById("aryWorkspaceHeadline");if(workspaceHeading)workspaceHeading.textContent=useLink?"Tempel tautan, mulai berkarya":"Cari media dari judul";const allButton=picker?.querySelector('[data-platform="all"]');if(allButton)allButton.hidden=false;if(a){a.hidden=!canLink;a.disabled=!canLink;a.classList.toggle("active",useLink);a.setAttribute("aria-selected",String(useLink))}if(b){b.hidden=!canSearch;b.disabled=!canSearch;b.classList.toggle("active",!useLink);b.setAttribute("aria-selected",String(!useLink))}};
a?.addEventListener("click",()=>{setMode("link");renderPlatformPage(1)});
b?.addEventListener("click",()=>{
 setMode("title");
 const mode=searchType?.value==="image"?"image":"video";
 const entry=platformCatalog.find(platform=>platform.id===selected);
 if(selected!=="all"&&!(entry?.searchModes||[]).includes(mode))setPlatform("all",{preserveLink:true,preserveOutput:true,silent:true});
 renderPlatformPage(1);
});
const setPlatform=(id,options={})=>{
 const next=(id==="all"||platforms[id])?id:"youtube";
 const preserveLink=options.preserveLink===true,preserveOutput=options.preserveOutput===true,silent=options.silent===true;
 window.aryanzzSelectedPlatform=()=>selected;
 if(next!==selected){
  if(!silent)searchController?.abort();
  if(linkInput&&!preserveLink)linkInput.value="";
  const downloadResult=$("downloadResult");
  if(downloadResult&&!preserveOutput){downloadResult.replaceChildren();downloadResult.hidden=true;}
  if(results&&!preserveOutput){results.replaceChildren();results.hidden=true;}
  if(help)help.textContent=(silent?"Platform terdeteksi otomatis: ":"Platform berubah ke ")+(next==="all"?"Semua platform yang mendukung mode pencarian":(platforms[next]?.name||"platform pilihan"))+". Panduan tempel tautan dan pencarian ikut menyesuaikan.";
  if(searchInput&&!preserveOutput)searchInput.value="";
  if(!silent)document.dispatchEvent(new Event("aryanzz:platform-change"));
 }
 selected=next;
 const entry=platformCatalog.find(platform=>platform.id===selected);
 if(searchType&&selected!=="all"){
  const supportedModes=entry?.searchModes||[];
  if(selected==="pinterest"&&supportedModes.includes("image"))searchType.value="image";
  else if(!supportedModes.includes(searchType.value))searchType.value=supportedModes.includes("video")?"video":supportedModes.includes("image")?"image":"video";
 }
 picker?.querySelectorAll("[data-platform]").forEach(btn=>{
  const active=btn.dataset.platform===selected;
  btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active));
 });
 const modes=entry?.mediaModes||[];
 const searchMode=searchType?.value==="image"?"image":"video";
 const supportedCount=platformCatalog.filter(platform=>(platform.searchModes||[]).includes(searchMode)&&!platform.aliasOf).length;
 const name=selected==="all"?"Semua "+supportedCount+" platform "+(searchMode==="image"?"gambar":"video"):(platforms[selected]?.name||entry?.name||selected);
 const guide=PLATFORM_GUIDES[selected]||{};
 if(linkLabel)linkLabel.textContent=selected==="all"?"TEMPEL TAUTAN MEDIA":"TEMPEL TAUTAN "+name.toUpperCase();
 if(linkInput){
  const types=[modes.includes("video")?"video":"",modes.includes("image")?"foto":"",modes.includes("audio")?"audio":""].filter(Boolean).join(" atau ");
  linkInput.placeholder=selected==="all"?"Tempel tautan video, gambar, atau audio dari platform yang didukung…":(guide.link||(types?"Tempel tautan "+name+" ("+types+")…":"Tempel tautan publik "+name+"…"));
 }
 const searchLabel=y?.querySelector("label");
 if(searchLabel)searchLabel.textContent="CARI JUDUL · "+name.toUpperCase();
 if(searchInput)searchInput.placeholder=guide.search||"Cari judul atau kata kunci di "+name+"…";
 picker?.setAttribute("data-selected-platform",selected);
 updateSearchHelp();setMode(activeMode);renderPlatformPage(1);
};
picker?.addEventListener("click",e=>{const btn=e.target.closest("[data-platform]");if(btn)setPlatform(btn.dataset.platform)});
window.aryanzzSelectedPlatform=()=>selected;window.aryanzzAutoSelectPlatform=id=>setPlatform(id,{preserveLink:true,preserveOutput:true,silent:true});picker?.setAttribute("data-selected-platform",selected);
setMode("link");
const updateSearchHelp=()=>{
 if(!help)return;
 const mode=searchType?.value==="image"?"image":"video";
 const count=platformCatalog.filter(platform=>(platform.searchModes||[]).includes(mode)&&!platform.aliasOf).length;
 const name=selected==="all"?"semua "+count+" platform "+(mode==="image"?"gambar":"video"):(platforms[selected]?.name||selected);
 const guide=PLATFORM_GUIDES[selected]||{};
 if(selected==="all")help.textContent=mode==="image"?"Pencarian judul memeriksa "+count+" provider gambar. Hanya file gambar yang lolos verifikasi yang ditampilkan.":"Pencarian judul memeriksa provider video yang tersedia dan turut mencari YouTube sebagai sumber cadangan. Hanya stream yang lolos verifikasi yang ditampilkan.";
 else if(mode==="image")help.textContent=guide.imageHelp||"Foto dan gambar publik dari "+name+". Hanya file gambar yang berhasil diverifikasi yang akan ditampilkan.";
 else help.textContent=guide.videoHelp||"Cari video publik di "+name+". Hanya stream video yang berhasil diverifikasi yang akan ditampilkan.";
};
searchType?.addEventListener("change",()=>{
 const mode=searchType.value==="image"?"image":"video";
 const entry=platformCatalog.find(platform=>platform.id===selected);
 if(selected!=="all"&&!(entry?.searchModes||[]).includes(mode))setPlatform("all",{preserveLink:true,preserveOutput:true,silent:true});
 updateSearchHelp();renderPlatformPage(1);
});
const duration=v=>{if(!Number.isFinite(Number(v)))return "";const n=Math.max(0,Math.floor(Number(v)));return Math.floor(n/60)+":"+String(n%60).padStart(2,"0")};
const SEARCH_PLATFORM_ALIASES={tiktoklite:"tiktok",instagramlite:"instagram",facebooklite:"facebook",twitter:"x"};
let SEARCH_PLATFORM_DOMAINS={
youtube:["youtube.com","youtu.be"],tiktok:["tiktok.com"],instagram:["instagram.com","instagr.am"],snackvideo:["snackvideo.com"],
capcut:["capcut.com"],pinterest:["pinterest.com","pin.it"],facebook:["facebook.com","fb.watch"],x:["x.com","twitter.com"],
reddit:["reddit.com","redd.it"],vimeo:["vimeo.com"],threads:["threads.net"],soundcloud:["soundcloud.com"],
snapchat:["snapchat.com"],idnapp:["idntimes.com"],linkedin:["linkedin.com"],wechat:["wechat.com","weixin.qq.com"],kakaotalk:["kakao.com"]
};
const platformTemplates=new Map();
picker?.querySelectorAll("[data-platform]").forEach(button=>{if(button.dataset.platform!=="all")platformTemplates.set(button.dataset.platform,button.cloneNode(true))});
const allPlatformButton=picker?.querySelector('[data-platform="all"]')||null;
const platformPager=$("platformPager"),platformPrev=$("platformPrev"),platformNext=$("platformNext"),platformPageLabel=$("platformPageLabel");
const platformPageSize=20;
function renderPlatformPage(nextPage){
 if(!picker||!platformCatalog.length)return;
 const query=String(platformSearch?.value||"").normalize("NFKC").trim().toLocaleLowerCase("id-ID");
 const mode=searchType?.value==="image"?"image":"video";
 const catalogForMode=activeMode==="link"?platformCatalog:platformCatalog.filter(platform=>Array.isArray(platform.searchModes)&&platform.searchModes.includes(mode));
 let matches=catalogForMode;
 if(query){
  matches=catalogForMode.filter(platform=>String(platform.name||"").normalize("NFKC").toLocaleLowerCase("id-ID").includes(query));
  const exact=matches.filter(platform=>String(platform.name||"").normalize("NFKC").trim().toLocaleLowerCase("id-ID")===query);
  if(exact.length)matches=exact;
 }
 platformPage=1;
 picker.replaceChildren();
 if(allPlatformButton){
  const supportedCount=platformCatalog.filter(platform=>(platform.searchModes||[]).includes(mode)&&!platform.aliasOf).length;
  const allLabel=allPlatformButton.querySelector("span:last-child");
  if(allLabel)allLabel.textContent=activeMode==="link"?"Semua 200":"Semua "+(mode==="image"?"gambar":"video")+" · "+supportedCount;
  allPlatformButton.title=activeMode==="link"?"Tempel tautan dari 200 platform. Sistem mendeteksi sumber berdasarkan URL.":"Cari di "+supportedCount+" platform dengan provider "+(mode==="image"?"gambar":"video")+" terverifikasi";
  allPlatformButton.hidden=!!query||(activeMode!=="link"&&supportedCount===0);
  if(!query)picker.append(allPlatformButton);
 }
 if(!matches.length){
  const empty=document.createElement("p");empty.className="v736-platform-empty";empty.setAttribute("role","status");
  empty.textContent="Platform tidak ditemukan. Coba nama lain.";
  picker.append(empty);
 }
 let platformIndex=0;
 for(const platform of matches){
  let button=platformTemplates.get(platform.id)?.cloneNode(true);
  if(!button){
   button=document.createElement("button");button.type="button";button.className="v736-platform";
   const logo=document.createElement("span");logo.className="v736-logo v736-favicon-logo";
   const image=document.createElement("img");image.alt="";image.loading="lazy";image.decoding="async";
   const domain=platform.domains?.[0]||"";
   image.src="https://www.google.com/s2/favicons?domain="+encodeURIComponent(domain)+"&sz=64";
   image.addEventListener("error",()=>{logo.textContent=String(platform.name||"?").slice(0,2).toUpperCase();image.remove()},{once:true});
   logo.append(image);
   const label=document.createElement("span");label.textContent=platform.name;
   button.append(logo,label);
  }
  button.dataset.platform=platform.id;button.style.setProperty("--platform-index",String(platformIndex++));button.setAttribute("aria-label",platform.name);button.title=platform.extractorStatus==="experimental"?platform.name+" · jalur auto-detect eksperimental, belum terverifikasi":"Jalur provider khusus";
  const label=button.querySelector("span:last-child");if(label)label.textContent=platform.name;
  if(platform.aliasOf){
   const source=platformTemplates.get(platform.aliasOf)?.querySelector(".v736-logo");
   const oldLogo=button.querySelector(".v736-logo");
   if(source&&oldLogo)oldLogo.replaceWith(source.cloneNode(true));
  }
  const oldTier=button.querySelector(".v736-platform-tier");
  const modeLabels=(activeMode==="link"?(platform.mediaModes||[]):(platform.searchModes||[])).map(mode=>({video:"Video",image:"Foto",audio:"Audio"}[mode]||"")).filter(Boolean);
  const tier=oldTier||document.createElement("small");
  tier.className="v736-platform-tier";
  tier.dataset.status=platform.extractorStatus||"experimental";
  tier.textContent=(platform.extractorStatus==="experimental"?"Auto · ":"")+(modeLabels.join(" + ")||"Tautan");
  tier.title=platform.extractorStatus==="experimental"
    ?"Provider komunitas dan deteksi otomatis; keberhasilan bergantung pada akses publik serta format yang disediakan platform."
    :"Jalur provider khusus; jenis media mengikuti format yang benar-benar tersedia dari sumber.";
  if(!oldTier)button.append(tier);
  button.classList.toggle("active",button.dataset.platform===selected);
  button.setAttribute("aria-pressed",String(button.dataset.platform===selected));
  picker.append(button);
 }
 if(platformPager)platformPager.hidden=true;
 if(platformPageLabel)platformPageLabel.textContent=query
  ?(matches.length?matches.length+" platform cocok untuk “"+String(platformSearch.value).trim()+"”":"Tidak ada platform yang cocok")
  :matches.length?matches.length+" platform siap":"Tidak ada platform yang tersedia";
 if(platformPrev)platformPrev.disabled=true;
 if(platformNext)platformNext.disabled=true;
 if(platformPager)platformPager.setAttribute("aria-busy","false");
 picker.classList.remove("v736-platforms-ready");
 requestAnimationFrame(()=>picker.classList.add("v736-platforms-ready"));
}
async function loadPlatformCatalog(){
 const local=window.ARYANZZ_PLATFORM_CATALOG_FALLBACK;
 const localReady=Array.isArray(local)&&local.length===200;
 const applyCatalog=(catalog,source)=>{
  if(!Array.isArray(catalog)||catalog.length!==200)return false;
  platformCatalog=catalog;
  for(const platform of platformCatalog){
   if(!platforms[platform.id]){
    const domains=platform.domains||[];
    platforms[platform.id]={name:platform.name,url:q=>"https://www.google.com/search?q="+encodeURIComponent((domains.length?domains.map(domain=>"site:"+domain).join(" OR "):platform.name)+" "+q)};
   }else platforms[platform.id].name=platform.name;
  }
  SEARCH_PLATFORM_DOMAINS=Object.fromEntries(platformCatalog.map(platform=>[platform.id,platform.domains||[]]));
  window.ARYANZZ_PLATFORM_CATALOG=platformCatalog;
  window.aryanzzPlatformForUrl=raw=>{
   try{
    const host=new URL(String(raw||"").trim()).hostname.toLowerCase().replace(/^www\./,"");
    const found=platformCatalog.find(platform=>(platform.domains||[]).some(domain=>{
     const root=String(domain||"").toLowerCase().replace(/^www\./,"");
     return host===root||host.endsWith("."+root);
    }));
    return found?.aliasOf||found?.id||null;
   }catch{return null}
  };
  window.aryanzzPlatformNameForId=id=>platforms[id]?.name||platformCatalog.find(platform=>platform.id===id)?.name||id;
  if(platformPager)platformPager.dataset.catalogSource=source;
  try{setPlatform(selected)}catch(error){console.warn("ARYYANZZ platform catalogue render:",error);}
  try{renderPlatformPage(1)}catch(error){console.warn("ARYYANZZ platform catalogue page render:",error);}
  return true;
 };
 // Render the bundled 200-platform catalogue immediately. The network API is an
 // enhancement, never a dependency for the UI to appear.
 if(localReady){
  applyCatalog(local,"local");
  if(platformPageLabel)platformPageLabel.textContent="200 platform siap";
 }else if(platformPageLabel){
  platformPageLabel.textContent="Menyiapkan katalog platform…";
 }
 // Refresh from the Worker in the background. A transient API timeout must never
 // replace a usable catalogue with an error state or a retry button.
 try{
  const response=await fetch("/api/platform/status",{cache:"no-store",credentials:"same-origin",headers:{accept:"application/json"},signal:AbortSignal.timeout(7000)});
  const data=await response.json();
  if(response.ok&&Array.isArray(data.platforms)&&data.platforms.length===200){
   applyCatalog(data.platforms,"api");
   if(platformPageLabel)platformPageLabel.textContent="200 platform siap";
  }else if(!localReady&&platformPageLabel){
   platformPageLabel.textContent="Katalog platform siap digunakan";
  }
 }catch(error){
  console.warn("ARYANZZ platform API refresh skipped:",error?.message||error);
  if(!localReady&&platformPageLabel)platformPageLabel.textContent="Katalog platform tidak tersedia sementara";
 }
}
platformSearch?.addEventListener("input",()=>renderPlatformPage(1));
loadPlatformCatalog();
