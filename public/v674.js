/* ARYANZZ V67.6 — UI controls */
(()=>{"use strict";
const $=id=>document.getElementById(id),THEME="aryanzz.theme.v674",FAV="aryanzz.color-favorites.v674";
const read=(k)=>{try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return []}};
function toast(s){let n=$("v674Toast");if(!n){n=document.createElement("div");n.id="v674Toast";n.className="v674-toast";document.body.append(n)}n.textContent=s;n.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.classList.remove("show"),2200)}
async function copy(s){try{await navigator.clipboard.writeText(s);return true}catch{try{const t=document.createElement("textarea");t.value=s;document.body.append(t);t.select();const ok=document.execCommand("copy");t.remove();return ok}catch{return false}}}
function initTheme(){document.body.dataset.theme=localStorage.getItem(THEME)||"dark";const b=$("themeToggle");if(!b)return;const draw=()=>{b.textContent=document.body.dataset.theme==="light"?"☾":"☼"};draw();b.onclick=()=>{const v=document.body.dataset.theme==="light"?"dark":"light";document.body.dataset.theme=v;localStorage.setItem(THEME,v);draw();toast("Tema "+v+" diaktifkan")}}
function initSearch(){
const a=$("downloadLinkMode"),b=$("downloadTitleMode"),x=$("linkModePanel"),y=$("titleModePanel"),picker=$("platformPicker");
const results=$("titleSearchResults"),help=$("titleSearchHelp"),searchInput=$("titleSearch"),searchType=$("titleSearchType");
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
let selected="youtube",activeMode="link",searchController=null,pageSize=10,currentPage=1;
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
const setMode=v=>{const link=v==="link";if(link&&selected==="all")setPlatform("youtube");const entry=platformCatalog.find(platform=>platform.id===selected);const modes=entry?.inputModes||["link","search"];const canLink=modes.includes("link"),canSearch=modes.includes("search");if(!canLink&&canSearch)v="title";if(!canSearch&&canLink)v="link";activeMode=v;const useLink=v==="link";if(x)x.hidden=!useLink;if(y)y.hidden=useLink;const allButton=picker?.querySelector('[data-platform="all"]');if(allButton)allButton.hidden=useLink;if(a){a.hidden=!canLink;a.disabled=!canLink;a.classList.toggle("active",useLink);a.setAttribute("aria-selected",String(useLink))}if(b){b.hidden=!canSearch;b.disabled=!canSearch;b.classList.toggle("active",!useLink);b.setAttribute("aria-selected",String(!useLink))}};
a?.addEventListener("click",()=>setMode("link"));b?.addEventListener("click",()=>setMode("title"));
const setPlatform=id=>{
 const next=(id==="all"||platforms[id])?id:"youtube";
 window.aryanzzSelectedPlatform=()=>selected;
 if(next!==selected){
  searchController?.abort();
  if(linkInput)linkInput.value="";
  const downloadResult=$("downloadResult");
  if(downloadResult){downloadResult.replaceChildren();downloadResult.hidden=true;}
  if(results){results.replaceChildren();results.hidden=true;}
  if(help)help.textContent="Platform berubah ke "+(next==="all"?"Semua 200 Platform":(platforms[next]?.name||"platform pilihan"))+". Panduan tempel tautan dan pencarian ikut menyesuaikan.";
  if(searchInput)searchInput.value="";
  document.dispatchEvent(new Event("aryanzz:platform-change"));
 }
 selected=next;
 picker?.querySelectorAll("[data-platform]").forEach(btn=>{
  const active=btn.dataset.platform===selected;
  btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active));
 });
 const entry=platformCatalog.find(platform=>platform.id===selected);
 const name=selected==="all"?"Semua 200 platform":(platforms[selected]?.name||entry?.name||selected);
 const modes=entry?.mediaModes||[];
 const guide=PLATFORM_GUIDES[selected]||{};
 if(linkLabel)linkLabel.textContent=selected==="all"?"TEMPEL TAUTAN MEDIA":"TEMPEL TAUTAN "+name.toUpperCase();
 if(linkInput){
  const types=[modes.includes("video")?"video":"",modes.includes("image")?"foto":"",modes.includes("audio")?"audio":""].filter(Boolean).join(" atau ");
  linkInput.placeholder=guide.link||(types?"Tempel tautan "+name+" ("+types+")…":"Tempel tautan publik "+name+"…");
 }
 const searchLabel=y?.querySelector("label");
 if(searchLabel)searchLabel.textContent="CARI JUDUL · "+name.toUpperCase();
 if(searchInput)searchInput.placeholder=guide.search||"Cari judul atau kata kunci di "+name+"…";
 if(searchType)searchType.value=selected==="pinterest"||(!modes.includes("video")&&modes.includes("image"))?"image":"video";
 picker?.setAttribute("data-selected-platform",selected);
 updateSearchHelp();setMode(activeMode);
};
picker?.addEventListener("click",e=>{const btn=e.target.closest("[data-platform]");if(btn)setPlatform(btn.dataset.platform)});
window.aryanzzSelectedPlatform=()=>selected;picker?.setAttribute("data-selected-platform",selected);
setMode("link");
const updateSearchHelp=()=>{
 if(!help)return;
 const mode=searchType?.value||"video";
 const name=selected==="all"?"semua 200 platform":(platforms[selected]?.name||selected);
 const guide=PLATFORM_GUIDES[selected]||{};
 if(mode==="image")help.textContent=guide.imageHelp||"Foto dan gambar publik dari "+name+". ARYANZZ menampilkan gambar yang benar-benar dapat dibaca dari sumber; hasil kosong tidak akan dibuat-buat.";
 else help.textContent=guide.videoHelp||"Cari video publik di "+name+". Tautan diperiksa sesuai format media yang benar-benar disediakan sumber.";
};
searchType?.addEventListener("change",updateSearchHelp);
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
let platformCatalog=[],platformPage=1;
const platformPageSize=20;
function renderPlatformPage(nextPage){
 if(!picker||!platformCatalog.length)return;
 const totalPages=Math.max(1,Math.ceil(platformCatalog.length/platformPageSize));
 platformPage=Math.max(1,Math.min(totalPages,Number(nextPage)||1));
 const start=(platformPage-1)*platformPageSize;
 const visible=platformCatalog.slice(start,start+platformPageSize);
 picker.replaceChildren();
 if(allPlatformButton){allPlatformButton.querySelector("span:last-child").textContent="Semua 200";picker.append(allPlatformButton)}
 for(const platform of visible){
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
  button.dataset.platform=platform.id;button.setAttribute("aria-label",platform.name);button.title=platform.extractorStatus==="experimental"?platform.name+" · jalur auto-detect eksperimental, belum terverifikasi":"Jalur provider khusus";
  const label=button.querySelector("span:last-child");if(label)label.textContent=platform.name;
  if(platform.aliasOf){
   const source=platformTemplates.get(platform.aliasOf)?.querySelector(".v736-logo");
   const oldLogo=button.querySelector(".v736-logo");
   if(source&&oldLogo)oldLogo.replaceWith(source.cloneNode(true));
  }
  const oldTier=button.querySelector(".v736-platform-tier");
  const modeLabels=(platform.mediaModes||[]).map(mode=>({video:"Video",image:"Foto",audio:"Audio"}[mode]||"")).filter(Boolean);
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
 if(platformPager)platformPager.hidden=false;
 if(platformPageLabel)platformPageLabel.textContent="Halaman "+platformPage+" / "+totalPages+" · "+(start+1)+"–"+(start+visible.length)+" dari 200";
 if(platformPrev)platformPrev.disabled=platformPage<=1;
 if(platformNext)platformNext.disabled=platformPage>=totalPages;
}
async function loadPlatformCatalog(){
 try{
  const response=await fetch("/api/platform/status",{cache:"no-store",headers:{accept:"application/json"}});
  const data=await response.json();
  if(!response.ok||!Array.isArray(data.platforms)||data.platforms.length!==200)throw new Error("Katalog platform belum lengkap.");
  platformCatalog=data.platforms;
  for(const platform of platformCatalog){
   if(!platforms[platform.id]){
    const domains=platform.domains||[];
    platforms[platform.id]={name:platform.name,url:q=>"https://www.google.com/search?q="+encodeURIComponent((domains.length?domains.map(domain=>"site:"+domain).join(" OR "):platform.name)+" "+q)};
   }else platforms[platform.id].name=platform.name;
  }
  SEARCH_PLATFORM_DOMAINS=Object.fromEntries(platformCatalog.map(platform=>[platform.id,platform.domains||[]]));
  window.ARYANZZ_PLATFORM_CATALOG=platformCatalog;
  window.aryanzzPlatformForUrl=raw=>{
   try{const host=new URL(raw).hostname.toLowerCase().replace(/^www\./,"");const found=platformCatalog.find(platform=>(platform.domains||[]).some(domain=>host===domain||host.endsWith("."+domain)));return found?.aliasOf||found?.id||null}catch{return null}
  };
  window.aryanzzPlatformNameForId=id=>platforms[id]?.name||platformCatalog.find(platform=>platform.id===id)?.name||id;
  renderPlatformPage(1);setPlatform(selected);
 }catch(error){if(platformPager)platformPager.hidden=true;console.warn("ARYANZZ platform catalogue:",error)}
}
platformPrev?.addEventListener("click",()=>renderPlatformPage(platformPage-1));
platformNext?.addEventListener("click",()=>renderPlatformPage(platformPage+1));
loadPlatformCatalog();
function searchResultBelongsTo(item,platform){
 let host="";try{host=new URL(item?.url||item?.sourceUrl||"").hostname.toLowerCase().replace(/^www\./,"")}catch{return false}
 const key=SEARCH_PLATFORM_ALIASES[platform]||platform;
 if(key==="all")return Object.values(SEARCH_PLATFORM_DOMAINS).flat().some(domain=>host===domain||host.endsWith("."+domain));
 return (SEARCH_PLATFORM_DOMAINS[key]||[]).some(domain=>host===domain||host.endsWith("."+domain));
}
function showFallback(target,q){
const card=document.createElement("article");card.className="v674-search-result v736-search-handoff";
const title=document.createElement("h3");title.textContent="Pencarian "+target.name+" belum tersedia";
const note=document.createElement("p");note.textContent="Provider pencarian video/audio gratis belum mengirim hasil. Kamu tetap bisa membuka pencarian "+target.name+" dari sini.";
const open=document.createElement("a");open.className="primary";open.href=target.url(q);open.target="_blank";open.rel="noopener noreferrer";open.textContent="Buka pencarian "+target.name+" ↗";
card.append(title,note,open);results.append(card);
}
function safeImageProxy(raw){
try{const url=new URL(raw,location.origin);return url.origin===location.origin&&["/api/social-image-file","/api/image/file"].includes(url.pathname)?url.href:""}catch{return ""}
}
function render(items,target,q,unavailableCount=0,imageItems=[]){
results.replaceChildren();
const mediaCount=Array.isArray(items)?items.length:0,images=Array.isArray(imageItems)?imageItems:[];
if(!mediaCount&&!images.length)showFallback(target,q);
(items||[]).forEach(item=>{
if(searchType?.value==="audio"){
const card=document.createElement("article");card.className="v674-audio-inline-result";
const main=document.createElement("div");main.className="v674-audio-inline-main";
const title=document.createElement("b");title.textContent=item.title||"Audio tanpa judul";
const meta=document.createElement("small");meta.textContent=[platforms[item.platform]?.name||item.platform||target.name,duration(item.duration),item.verified?"Audio terverifikasi":"Sumber video"].filter(Boolean).join(" · ");
main.append(title,meta);
const action=document.createElement("button");action.type="button";action.className="v674-audio-inline-action";action.textContent=item.verified&&String(item.extension||"").toLowerCase()==="mp3"?"↓ Unduh MP3":"♫ Buat MP3";
action.addEventListener("click",()=>{
if(item.verified&&String(item.extension||"").toLowerCase()==="mp3"&&item.downloadUrl){
const link=document.createElement("a");link.href=item.downloadUrl;link.download=(item.title||"aryanzz-audio").replace(/[^a-z0-9 _-]/gi,"").trim().slice(0,70)+".mp3";document.body.append(link);link.click();link.remove();return;
}
const input=$("url");if(!input)return;input.value=item.url;setMode("link");$("analyze")?.click();$("downloadResult")?.scrollIntoView({behavior:"smooth",block:"nearest"});
});
card.append(main,action);results.append(card);return;
}
const card=document.createElement("article");card.className="v674-search-result v737-media-result";
if(item.thumbnail){try{const u=new URL(item.thumbnail);if(u.protocol==="https:"){const img=document.createElement("img");img.src=u.href;img.alt="Pratinjau "+(item.title||"media");img.loading="lazy";card.append(img)}}catch{}}
const info=document.createElement("div"),title=document.createElement("h3"),meta=document.createElement("p"),snippet=document.createElement("p"),pick=document.createElement("button");
title.textContent=item.title||"Media tanpa judul";
meta.textContent=[item.channel,item.platform||target.name,item.mediaMode==="audio"?"Audio":"Video",duration(item.duration),item.width&&item.height?item.width+" × "+item.height+" px":"",item.searchOnly?"Belum diverifikasi · periksa saat dipilih":item.verified?"✓ Tautan terverifikasi":""].filter(Boolean).join(" · ");
snippet.textContent=item.snippet||"Pilih hasil ini untuk memeriksa pratinjau dan format unduhan.";
if(searchType?.value==="audio"&&item.mediaMode==="audio"&&item.verified&&item.previewUrl){
try{const audioUrl=new URL(item.previewUrl,location.origin);if(audioUrl.origin===location.origin&&audioUrl.pathname==="/api/social-file"){const player=document.createElement("audio");player.controls=true;player.preload="none";player.src=audioUrl.href;player.setAttribute("aria-label","Pratinjau audio "+(item.title||"hasil pencarian"));player.style.cssText="display:block;width:100%;margin:10px 0";card.append(player);}}catch{}
}
pick.type="button";pick.className="primary";pick.textContent=searchType?.value==="audio"?"Periksa & buat MP3":"Lihat & unduh";
pick.addEventListener("click",()=>{const input=$("url");if(!input||!item.url)return;const source=SEARCH_PLATFORM_ALIASES[item.platform]||item.platform;if(platforms[source])setPlatform(source);setMode("link");input.value=item.url;$("analyze")?.click();$("downloadResult")?.scrollIntoView({behavior:"smooth",block:"nearest"})});
info.append(title,meta,snippet,pick);card.append(info);
// Keep every platform result in one shared grid; platform identity stays on each card.
results.append(card);
});
if(images.length){
const section=document.createElement("section");section.className="v674-image-results";
const head=document.createElement("div");head.className="v674-image-results-head";
const heading=document.createElement("h3");heading.textContent="Gambar dari media sosial & web publik";
const note=document.createElement("p");note.textContent="Setiap gambar punya tautan sumber asli dan tombol unduh.";
head.append(heading,note);
const grid=document.createElement("div");grid.className="aryanzz-inline-image-grid";
images.slice(0,50).forEach((item,index)=>{
const preview=safeImageProxy(item.previewUrl||item.downloadUrl),download=safeImageProxy(item.downloadUrl||item.previewUrl);
if(!preview||!download)return;
const card=document.createElement("article");card.className="aryanzz-inline-image-card";
const open=document.createElement("a");open.className="aryanzz-inline-image-open";open.href=preview;open.target="_blank";open.rel="noopener noreferrer";open.setAttribute("aria-label","Lihat gambar "+(index+1));
const img=document.createElement("img");img.loading="lazy";img.decoding="async";img.src=preview;img.alt=item.title||"Gambar "+(index+1);img.onerror=()=>{card.remove();if(!grid.childElementCount){section.remove();if(help)help.textContent="Gambar dari "+target.name+" tidak dapat dimuat. Hasil kosong tidak akan ditampilkan."}};open.append(img);
const caption=document.createElement("div");caption.className="aryanzz-inline-image-caption";
const title=document.createElement("b");title.textContent=item.title||"Gambar "+(index+1);
const meta=document.createElement("small");meta.textContent=(item.platform||"Media sosial").toUpperCase()+(item.width&&item.height?" · "+item.width+" × "+item.height+" px":"");
caption.append(title,meta);
const actions=document.createElement("div");actions.className="aryanzz-inline-image-actions";
const dl=document.createElement("a");dl.className="primary";dl.href=download;dl.download=item.filename||"aryanzz-image.jpg";dl.textContent="↓ Unduh gambar";
actions.append(dl);
if(item.sourceUrl){try{const source=new URL(item.sourceUrl);if(source.protocol==="https:"){const link=document.createElement("a");link.className="tag";link.href=source.href;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Buka sumber asli ↗";actions.append(link)}}catch{}}
card.append(open,caption,actions);grid.append(card);
});
if(grid.childElementCount){section.append(head,grid);results.append(section)}
}
const parts=[];if(mediaCount)parts.push(mediaCount+" video/audio dari "+target.name);if(images.length)parts.push(images.length+" gambar dari "+target.name);
if(help)help.textContent=searchType?.value==="audio"?(mediaCount+" pilihan audio dari "+target.name+" · pilih Buat MP3 untuk memeriksa sumber dan format yang tersedia.") : parts.length?parts.join(" · ")+(Number(unavailableCount)>0?" · "+Number(unavailableCount)+" tautan media dilewati":"")+" · pilih hasil untuk melihat atau mengunduh.":"Tidak ada hasil publik yang cocok. Coba kata kunci lain.";
}
const go=async()=>{
const q=(searchInput?.value||"").trim();if(!q){if(help)help.textContent="Masukkan judul atau kata kunci gambar.";return}if(q.length<2){if(help)help.textContent="Masukkan minimal 2 karakter.";return}
searchController?.abort();searchController=new AbortController();
results.hidden=false;results.replaceChildren();
const target=selected==="all"?{name:"Semua 200 platform"}:platforms[selected],kind=["image","audio"].includes(searchType?.value)?searchType.value:"video";
const loading=document.createElement("div");loading.className="v674-search-loading";loading.textContent=kind==="image"?"Mencari gambar dari "+target.name+"…":kind==="audio"?"Mencari musik dan video sumber untuk dibuat MP3 dari "+target.name+"…":"Mencari video dari "+target.name+"…";results.append(loading);
const btn=$("titleSearchBtn");if(btn){btn.disabled=true;btn.textContent="Mencari…"}
if(help)help.textContent=selected==="all"?"Smart Search aktif: mencari lintas 200 platform dan mengelompokkan hasil menurut sumber.":kind==="image"?"Mode gambar: sumber "+target.name+".":kind==="audio"?"Mode audio: hanya file audio yang diverifikasi dari "+target.name+".":"Mode video: sumber "+target.name+".";
try{
const endpoint=kind==="image"?"/api/image/search":(selected==="youtube"&&kind==="video"?"/api/search":"/api/social/search");
const options={method:"POST",headers:{"content-type":"application/json"},cache:"no-store"};
const signal=AbortSignal.any([searchController.signal,AbortSignal.timeout(45000)]);
const response=await fetch(endpoint,{...options,body:JSON.stringify({query:q,platform:selected,mediaType:kind}),signal});
const data=await response.json().catch(()=>({}));
if(!response.ok||data.ok===false)throw new Error(data.error||"Pencarian "+target.name+" belum tersedia.");
let mediaItems=[],imageItems=[],unavailable=Number(data.unavailableCount)||0;
if(kind==="image"){
const aliases={tiktoklite:"tiktok",instagramlite:"instagram",facebooklite:"facebook"};
const expected=aliases[selected]||selected;
const domains={
pinterest:["pinterest.com","pin.it"],tiktok:["tiktok.com","vm.tiktok.com","vt.tiktok.com"],
instagram:["instagram.com","instagr.am"],facebook:["facebook.com","fb.watch"],x:["x.com","twitter.com"],
reddit:["reddit.com","redd.it"],threads:["threads.net"],snackvideo:["snackvideo.com"],capcut:["capcut.com"],
youtube:["youtube.com","youtu.be"],vimeo:["vimeo.com"],soundcloud:["soundcloud.com"],snapchat:["snapchat.com"],
idnapp:["idntimes.com"],linkedin:["linkedin.com"],wechat:["wechat.com","weixin.qq.com"],kakaotalk:["kakao.com"]
};
imageItems=(data.results||[]).flatMap(item=>item.images||[]).filter(item=>{
const host=(()=>{try{return new URL(item.sourceUrl).hostname.toLowerCase()}catch{return ""}})();
const sourceKey=aliases[String(item.platform||"").toLowerCase()]||String(item.platform||"").toLowerCase();
const allowedDomains=expected==="all"?Object.values(domains).flat():domains[expected]||[];
    return (expected==="all"?!!domains[sourceKey]:sourceKey===expected)&&allowedDomains.some(domain=>host===domain||host.endsWith("."+domain));
});
if(!imageItems.length)throw new Error("Belum ada gambar yang cocok dari "+target.name+". Tidak ada hasil dari platform lain yang akan ditampilkan.");
}else{
mediaItems=(Array.isArray(data.results)?data.results:[]).filter(item=>searchResultBelongsTo(item,selected));
if(!mediaItems.length)throw new Error("Belum ada hasil publik yang cocok khusus dari "+target.name+". Hasil platform lain sengaja disaring agar tidak tercampur.");
}
render(mediaItems,target,q,unavailable,imageItems);
const resultCards=[...results.querySelectorAll(".v674-search-result,.v674-audio-inline-result,.aryanzz-inline-image-card")];
const pager=document.createElement("div");pager.className="v674-pagination";
const size=document.createElement("select");size.className="field";size.setAttribute("aria-label","Jumlah hasil per halaman");
[10,50,100,500].forEach(n=>{const o=document.createElement("option");o.value=String(n);o.textContent=n+" hasil/halaman";o.selected=n===pageSize;size.append(o)});
const status=document.createElement("span");status.className="v674-title-help";
const prev=document.createElement("button");prev.type="button";prev.className="tag";prev.textContent="‹ Sebelumnya";
const next=document.createElement("button");next.type="button";next.className="primary";next.textContent="Berikutnya ›";
const updatePage=()=>{const pages=Math.max(1,Math.ceil(resultCards.length/pageSize));currentPage=Math.min(currentPage,pages);resultCards.forEach((card,i)=>{card.hidden=i<(currentPage-1)*pageSize||i>=currentPage*pageSize});status.textContent="Halaman "+currentPage+" dari "+pages+" · "+resultCards.length+" hasil ditemukan";prev.disabled=currentPage<=1;next.disabled=currentPage>=pages};
size.onchange=()=>{pageSize=Number(size.value);currentPage=1;updatePage()};prev.onclick=()=>{currentPage--;updatePage()};next.onclick=()=>{currentPage++;updatePage()};
pager.append(prev,status,size,next);results.append(pager);updatePage();
}catch(error){
if(error?.name==="AbortError")return;
results.replaceChildren();
const note=document.createElement("p");note.className="v674-title-help";note.textContent=String(error?.message||"Pencarian belum tersedia.").slice(0,220);results.append(note);
if(help)help.textContent=selected==="all"?"Pencarian lintas platform aktif. Hasil video akan dikelompokkan menurut sumber.":kind==="image"?"Pencarian gambar hanya menampilkan sumber "+target.name+".":kind==="audio"?"Pencarian audio hanya menampilkan file audio terverifikasi dari "+target.name+".":"Pencarian video hanya menampilkan sumber "+target.name+".";
}finally{if(btn){btn.disabled=false;btn.textContent="Cari ⌕"}}
};
$("titleSearchBtn")?.addEventListener("click",go);searchInput?.addEventListener("keydown",e=>{if(e.key==="Enter")go()});
}

const titleMic=$("titleSearchMic");
titleMic?.addEventListener("click",()=>{
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){if(help)help.textContent="Pencarian suara belum didukung browser ini. Silakan ketik kata kunci.";return;}
 const recognition=new Speech();recognition.lang="id-ID";recognition.interimResults=false;recognition.maxAlternatives=3;
 titleMic.disabled=true;if(help)help.textContent="Mendengarkan… ucapkan judul yang ingin dicari.";
 recognition.onresult=e=>{const transcript=e.results?.[0]?.[0]?.transcript||"";if(searchInput)searchInput.value=transcript;if(help)help.textContent="Kata yang dikenali: "+transcript+" · mulai mencari…";$("titleSearchBtn")?.click();};
 recognition.onerror=()=>{if(help)help.textContent="Suara tidak berhasil dikenali. Coba lagi atau ketik judul.";};
 recognition.onend=()=>{titleMic.disabled=false;};try{recognition.start()}catch{titleMic.disabled=false;}
});
function initTools(){const input=$("toolSearch"),grid=$("toolGrid"),filters=$("toolFilters"),empty=$("toolEmpty");if(!input||!grid||!filters)return;let category="all";const cards=[...grid.querySelectorAll(".tool")];const apply=()=>{let n=0;const q=input.value.toLowerCase().trim();cards.forEach(c=>{const show=(category==="all"||c.dataset.category===category)&&c.textContent.toLowerCase().includes(q);c.hidden=!show;if(show)n++});empty.hidden=n>0};filters.onclick=e=>{const b=e.target.closest("[data-tool-filter]");if(!b)return;category=b.dataset.toolFilter;filters.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));apply()};input.oninput=apply}
const rand=(a,b)=>Math.random()*(b-a)+a;
function toHex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return "#"+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,"0")).join("").toUpperCase()}
const modes={all:()=>[rand(0,360),rand(58,96),rand(38,68)],primary:()=>[[0,85,54],[220,85,54],[120,65,42]][Math.floor(Math.random()*3)],secondary:()=>[[60,80,52],[180,70,42],[300,65,52]][Math.floor(Math.random()*3)],tertiary:()=>[[30,82,56],[90,65,48],[150,65,42],[210,78,52],[270,65,58],[330,75,56]][Math.floor(Math.random()*6)],pastel:()=>[rand(0,360),rand(34,58),rand(76,91)],neon:()=>[rand(0,360),rand(92,100),rand(48,63)],metallic:()=>[rand(0,360),rand(14,42),rand(36,70)],rare:()=>[rand(0,360),rand(75,100),rand(28,66)],nature:()=>[[105,55,36],[145,48,38],[75,58,45],[35,65,48],[185,55,42],[15,55,46]][Math.floor(Math.random()*6)],cyber:()=>[[185,95,50],[220,95,58],[270,82,62],[300,92,58],[165,90,42],[245,75,55]][Math.floor(Math.random()*6)],sunset:()=>[[8,88,62],[18,92,58],[32,90,62],[335,82,62],[285,55,56],[355,80,72]][Math.floor(Math.random()*6)],monochrome:()=>[rand(0,360),0,rand(12,90)]};
function favs(){return read(FAV).filter(x=>typeof x==="string"&&/^#[0-9a-f]{6}$/i.test(x))}
function renderFavs(){const box=$("colorFavorites"),list=favs();$("colorFavoriteCount").textContent=list.length+" tersimpan";box.replaceChildren();if(!list.length){const p=document.createElement("p");p.className="muted";p.textContent="Belum ada warna favorit. Tekan ikon ♡ pada warna pilihanmu.";box.append(p);return}list.forEach(c=>{const b=document.createElement("button");b.className="v674-favorite-chip";b.type="button";b.dataset.copyColor=c;const dot=document.createElement("i");dot.style.background=c;const t=document.createElement("span");t.textContent=c;b.append(dot,t);box.append(b)})}
function preview(v){const m=/^#?([0-9a-f]{6})$/i.exec(v.trim());if(!m)return false;const c="#"+m[1].toUpperCase();$("colorHex").value=c;$("colorPreview").style.background=c;return true}
function generate(){const box=$("colorPalette"),make=modes[$("colorCategory").value]||modes.all;box.replaceChildren();const list=Array.from({length:12},()=>{const [h,s,l]=make();return toHex(h,s,l)});$("colorPaletteCount").textContent=list.length+" warna dibuat";list.forEach((c,i)=>{const card=document.createElement("article");card.className="v674-swatch-card";const main=document.createElement("button");main.type="button";main.className="v674-swatch-main";main.dataset.copyColor=c;const sw=document.createElement("span");sw.className="v674-swatch-color";sw.style.background=c;const info=document.createElement("span");info.className="v674-swatch-info";const label=document.createElement("b");label.textContent=c;const n=document.createElement("small");n.textContent=String(i+1).padStart(2,"0");info.append(label,n);main.append(sw,info);const actions=document.createElement("div");actions.className="v674-swatch-actions";const save=document.createElement("button");save.type="button";save.className="v674-swatch-save";save.dataset.saveColor=c;save.textContent=favs().includes(c)?"♥":"♡";save.classList.toggle("saved",favs().includes(c));actions.append(save);card.append(main,actions);box.append(card)});$("colorMessage").textContent="Palet siap. Ketuk kode HEX untuk menyalin atau ♡ untuk menyimpan."}
function initColors(){if(!$("colorPalette"))return;$("colorGenerate").onclick=generate;$("colorHex").oninput=e=>{if(/^#?[0-9a-f]{6}$/i.test(e.target.value))preview(e.target.value)};$("colorApply").onclick=()=>{$("colorMessage").textContent=preview($("colorHex").value)?"Pratinjau diperbarui.":"Masukkan HEX yang benar, contoh #8B5CF6."};$("colorCopy").onclick=async()=>{if(!preview($("colorHex").value))return;$("colorMessage").textContent=await copy($("colorHex").value)?"HEX berhasil disalin.":"Gagal menyalin HEX."};$("colorPalette").onclick=async e=>{const cp=e.target.closest("[data-copy-color]"),sv=e.target.closest("[data-save-color]");if(cp){const c=cp.dataset.copyColor;preview(c);$("colorMessage").textContent=await copy(c)?c+" disalin.":"Warna dipilih: "+c;return}if(sv){const c=sv.dataset.saveColor,list=favs(),exists=list.includes(c);localStorage.setItem(FAV,JSON.stringify(exists?list.filter(x=>x!==c):[c,...list]));renderFavs();generate();$("colorMessage").textContent=exists?"Warna dihapus.":c+" disimpan."}};generate();renderFavs();preview($("colorHex").value)}
async function initSecurityCenter(){const root=$("securityCenter");if(!root)return;const state=$("securityCenterState");const refresh=$("securityCenterRefresh");const draw=async()=>{if(refresh)refresh.disabled=true;try{const response=await fetch("/api/security/status",{cache:"no-store",headers:{accept:"application/json"}});const data=await response.json();if(!response.ok||data?.security?.active!==true)throw new Error("Status belum dapat diverifikasi");const events=data.security.events||{};const set=(id,value)=>{const node=$(id);if(node)node.textContent=String(Number(value)||0)};set("securityBlockedOrigin",events.blockedOrigin);set("securityRateLimited",events.rateLimited);set("securityOversized",events.oversizedRequest);set("securityMethods",events.blockedMethod);if(state){state.textContent="● Perlindungan Worker aktif";state.classList.add("is-active");state.classList.remove("is-warning");}}catch{if(state){state.textContent="Status keamanan belum dapat diverifikasi";state.classList.add("is-warning");state.classList.remove("is-active");}}finally{if(refresh)refresh.disabled=false;}};refresh?.addEventListener("click",draw);draw();}
async function initSecurityIndicator(){const el=$("securityStatusIndicator");if(!el)return;const label=el.querySelector("span");const check=async()=>{try{const response=await fetch("/api/security/status",{headers:{accept:"application/json"},cache:"no-store"});const data=await response.json();const active=response.ok&&data?.security?.active===true;el.classList.toggle("is-active",active);el.classList.toggle("is-warning",!active);el.title=active?"Perlindungan edge aktif · pemeriksaan status berhasil":"Status perlindungan belum dapat diverifikasi";if(label)label.textContent=active?"Proteksi aktif":"Cek keamanan";}catch{el.classList.remove("is-active");el.classList.add("is-warning");el.title="Status perlindungan belum dapat diverifikasi";if(label)label.textContent="Cek keamanan";}};check();setInterval(check,60000);}
initTheme();initSearch();initTools();initColors();initSecurityIndicator();initSecurityCenter();
})();