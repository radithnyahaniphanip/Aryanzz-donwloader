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
const platforms={
 all:{name:"Semua platform",url:q=>"https://www.google.com/search?q="+encodeURIComponent(q)},
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
let selected="youtube",searchController=null;
const setMode=v=>{const link=v==="link";if(x)x.hidden=!link;if(y)y.hidden=link;if(a){a.classList.toggle("active",link);a.setAttribute("aria-selected",String(link))}if(b){b.classList.toggle("active",!link);b.setAttribute("aria-selected",String(!link))}};
a?.addEventListener("click",()=>setMode("link"));b?.addEventListener("click",()=>setMode("title"));
const setPlatform=id=>{const next=platforms[id]?id:"youtube";if(next!==selected){searchController?.abort();const urlInput=$("url"),downloadResult=$("downloadResult");if(urlInput)urlInput.value="";if(downloadResult){downloadResult.replaceChildren();downloadResult.hidden=true;}if(results){results.replaceChildren();results.hidden=true;}if(help)help.textContent="Platform berubah ke "+platforms[next].name+". Tempel tautan atau mulai pencarian baru.";if(searchInput)searchInput.value="";document.dispatchEvent(new Event("aryanzz:platform-change"));}selected=next;picker?.querySelectorAll("[data-platform]").forEach(btn=>{const active=btn.dataset.platform===selected;btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active))});const name=platforms[selected].name;const label=y?.querySelector("label");if(label)label.textContent="CARI VIDEO / AUDIO / GAMBAR · "+name.toUpperCase();if(searchInput)searchInput.placeholder=selected==="youtube"?"Contoh: DJ tabola bale atau meme kucing":"Cari video, meme, musik, atau foto…";if(searchType)searchType.value=selected==="pinterest"?"image":"video";updateSearchHelp();};
picker?.addEventListener("click",e=>{const btn=e.target.closest("[data-platform]");if(btn)setPlatform(btn.dataset.platform)});
const updateSearchHelp=()=>{if(!help)return;const mode=searchType?.value||"video";const scope=selected==="all"?"lintas seluruh platform yang didukung":"khusus "+platforms[selected].name;if(mode==="audio")help.textContent="Audio: cari lagu, backsound, remix, soundtrack, atau musik. Hasil audio diverifikasi dari "+scope+"; putar pratinjau lalu buka untuk unduh jika tersedia.";else if(mode==="image")help.textContent="Gambar: hasil foto, meme, wallpaper, dan PNG dari "+scope+". Hasil gambar tidak dicampur dengan video.";else help.textContent="Video: cari klip, Green Screen, meme, tutorial, dan topik lainnya dari "+scope+". Hasil dikelompokkan menurut sumber.";};
searchType?.addEventListener("change",updateSearchHelp);
const duration=v=>{if(!Number.isFinite(Number(v)))return "";const n=Math.max(0,Math.floor(Number(v)));return Math.floor(n/60)+":"+String(n%60).padStart(2,"0")};
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
const mediaGroups=new Map();
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
meta.textContent=[item.channel,item.platform||target.name,item.mediaMode==="audio"?"Audio":"Video",duration(item.duration),item.width&&item.height?item.width+" × "+item.height+" px":"",item.searchOnly?"Buka sumber asli":item.verified?"✓ Tautan terverifikasi":""].filter(Boolean).join(" · ");
snippet.textContent=item.snippet||"Pilih hasil ini untuk memeriksa pratinjau dan format unduhan.";
if(searchType?.value==="audio"&&item.mediaMode==="audio"&&item.verified&&item.previewUrl){
try{const audioUrl=new URL(item.previewUrl,location.origin);if(audioUrl.origin===location.origin&&audioUrl.pathname==="/api/social-file"){const player=document.createElement("audio");player.controls=true;player.preload="none";player.src=audioUrl.href;player.setAttribute("aria-label","Pratinjau audio "+(item.title||"hasil pencarian"));player.style.cssText="display:block;width:100%;margin:10px 0";card.append(player);}}catch{}
}
pick.type="button";pick.className="primary";pick.textContent=item.searchOnly?"Buka di "+(platforms[item.platform]?.name||target.name) :searchType?.value==="audio"?"Buka unduhan audio":"Lihat & unduh";
pick.addEventListener("click",()=>{if(item.searchOnly){window.open(item.url,"_blank","noopener,noreferrer");return}const input=$("url");if(!input)return;input.value=item.url;setMode("link");$("analyze")?.click();$("downloadResult")?.scrollIntoView({behavior:"smooth",block:"nearest"})});
info.append(title,meta,snippet,pick);card.append(info);
if(selected==="all"){
const key=String(item.platform||"other").toLowerCase();
let group=mediaGroups.get(key);
if(!group){group=document.createElement("section");group.className="v674-platform-result-group";const groupTitle=document.createElement("h3");groupTitle.textContent=platforms[key]?.name||key.toUpperCase();group.append(groupTitle);const list=document.createElement("div");list.className="v674-platform-result-list";group.append(list);mediaGroups.set(key,{group,list});}
group.list.append(card);
}else results.append(card);
});
if(selected==="all")mediaGroups.forEach(value=>results.append(value.group));
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
const target=platforms[selected],kind=["image","audio"].includes(searchType?.value)?searchType.value:"video";
const loading=document.createElement("div");loading.className="v674-search-loading";loading.textContent=kind==="image"?"Mencari gambar dari "+target.name+"…":kind==="audio"?"Mencari musik dan video sumber untuk dibuat MP3 dari "+target.name+"…":"Mencari video dari "+target.name+"…";results.append(loading);
const btn=$("titleSearchBtn");if(btn){btn.disabled=true;btn.textContent="Mencari…"}
if(help)help.textContent=selected==="all"?"Pencarian lintas platform aktif. Hasil video akan dikelompokkan menurut sumber.":kind==="image"?"Mode gambar: sumber "+target.name+".":kind==="audio"?"Mode audio: hanya file audio yang diverifikasi dari "+target.name+".":"Mode video: sumber "+target.name+".";
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
mediaItems=Array.isArray(data.results)?data.results:[];
if(!mediaItems.length)throw new Error("Belum ada sumber musik atau video yang cocok dari "+target.name+". Coba variasi kata kunci lain.");
}
render(mediaItems,target,q,unavailable,imageItems);
}catch(error){
if(error?.name==="AbortError")return;
results.replaceChildren();
const note=document.createElement("p");note.className="v674-title-help";note.textContent=String(error?.message||"Pencarian belum tersedia.").slice(0,220);results.append(note);
if(help)help.textContent=selected==="all"?"Pencarian lintas platform aktif. Hasil video akan dikelompokkan menurut sumber.":kind==="image"?"Pencarian gambar hanya menampilkan sumber "+target.name+".":kind==="audio"?"Pencarian audio hanya menampilkan file audio terverifikasi dari "+target.name+".":"Pencarian video hanya menampilkan sumber "+target.name+".";
}finally{if(btn){btn.disabled=false;btn.textContent="Cari ⌕"}}
};
$("titleSearchBtn")?.addEventListener("click",go);searchInput?.addEventListener("keydown",e=>{if(e.key==="Enter")go()});
}
function initTools(){const input=$("toolSearch"),grid=$("toolGrid"),filters=$("toolFilters"),empty=$("toolEmpty");if(!input||!grid||!filters)return;let category="all";const cards=[...grid.querySelectorAll(".tool")];const apply=()=>{let n=0;const q=input.value.toLowerCase().trim();cards.forEach(c=>{const show=(category==="all"||c.dataset.category===category)&&c.textContent.toLowerCase().includes(q);c.hidden=!show;if(show)n++});empty.hidden=n>0};filters.onclick=e=>{const b=e.target.closest("[data-tool-filter]");if(!b)return;category=b.dataset.toolFilter;filters.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));apply()};input.oninput=apply}
const rand=(a,b)=>Math.random()*(b-a)+a;
function toHex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return "#"+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,"0")).join("").toUpperCase()}
const modes={all:()=>[rand(0,360),rand(58,96),rand(38,68)],primary:()=>[[0,85,54],[220,85,54],[120,65,42]][Math.floor(Math.random()*3)],secondary:()=>[[60,80,52],[180,70,42],[300,65,52]][Math.floor(Math.random()*3)],tertiary:()=>[[30,82,56],[90,65,48],[150,65,42],[210,78,52],[270,65,58],[330,75,56]][Math.floor(Math.random()*6)],pastel:()=>[rand(0,360),rand(34,58),rand(76,91)],neon:()=>[rand(0,360),rand(92,100),rand(48,63)],metallic:()=>[rand(0,360),rand(14,42),rand(36,70)],rare:()=>[rand(0,360),rand(75,100),rand(28,66)],nature:()=>[[105,55,36],[145,48,38],[75,58,45],[35,65,48],[185,55,42],[15,55,46]][Math.floor(Math.random()*6)],cyber:()=>[[185,95,50],[220,95,58],[270,82,62],[300,92,58],[165,90,42],[245,75,55]][Math.floor(Math.random()*6)],sunset:()=>[[8,88,62],[18,92,58],[32,90,62],[335,82,62],[285,55,56],[355,80,72]][Math.floor(Math.random()*6)],monochrome:()=>[rand(0,360),0,rand(12,90)]};
function favs(){return read(FAV).filter(x=>typeof x==="string"&&/^#[0-9a-f]{6}$/i.test(x))}
function renderFavs(){const box=$("colorFavorites"),list=favs();$("colorFavoriteCount").textContent=list.length+" tersimpan";box.replaceChildren();if(!list.length){const p=document.createElement("p");p.className="muted";p.textContent="Belum ada warna favorit. Tekan ikon ♡ pada warna pilihanmu.";box.append(p);return}list.forEach(c=>{const b=document.createElement("button");b.className="v674-favorite-chip";b.type="button";b.dataset.copyColor=c;const dot=document.createElement("i");dot.style.background=c;const t=document.createElement("span");t.textContent=c;b.append(dot,t);box.append(b)})}
function preview(v){const m=/^#?([0-9a-f]{6})$/i.exec(v.trim());if(!m)return false;const c="#"+m[1].toUpperCase();$("colorHex").value=c;$("colorPreview").style.background=c;return true}
function generate(){const box=$("colorPalette"),make=modes[$("colorCategory").value]||modes.all;box.replaceChildren();const list=Array.from({length:12},()=>{const [h,s,l]=make();return toHex(h,s,l)});$("colorPaletteCount").textContent=list.length+" warna dibuat";list.forEach((c,i)=>{const card=document.createElement("article");card.className="v674-swatch-card";const main=document.createElement("button");main.type="button";main.className="v674-swatch-main";main.dataset.copyColor=c;const sw=document.createElement("span");sw.className="v674-swatch-color";sw.style.background=c;const info=document.createElement("span");info.className="v674-swatch-info";const label=document.createElement("b");label.textContent=c;const n=document.createElement("small");n.textContent=String(i+1).padStart(2,"0");info.append(label,n);main.append(sw,info);const actions=document.createElement("div");actions.className="v674-swatch-actions";const save=document.createElement("button");save.type="button";save.className="v674-swatch-save";save.dataset.saveColor=c;save.textContent=favs().includes(c)?"♥":"♡";save.classList.toggle("saved",favs().includes(c));actions.append(save);card.append(main,actions);box.append(card)});$("colorMessage").textContent="Palet siap. Ketuk kode HEX untuk menyalin atau ♡ untuk menyimpan."}
function initColors(){if(!$("colorPalette"))return;$("colorGenerate").onclick=generate;$("colorHex").oninput=e=>{if(/^#?[0-9a-f]{6}$/i.test(e.target.value))preview(e.target.value)};$("colorApply").onclick=()=>{$("colorMessage").textContent=preview($("colorHex").value)?"Pratinjau diperbarui.":"Masukkan HEX yang benar, contoh #8B5CF6."};$("colorCopy").onclick=async()=>{if(!preview($("colorHex").value))return;$("colorMessage").textContent=await copy($("colorHex").value)?"HEX berhasil disalin.":"Gagal menyalin HEX."};$("colorPalette").onclick=async e=>{const cp=e.target.closest("[data-copy-color]"),sv=e.target.closest("[data-save-color]");if(cp){const c=cp.dataset.copyColor;preview(c);$("colorMessage").textContent=await copy(c)?c+" disalin.":"Warna dipilih: "+c;return}if(sv){const c=sv.dataset.saveColor,list=favs(),exists=list.includes(c);localStorage.setItem(FAV,JSON.stringify(exists?list.filter(x=>x!==c):[c,...list]));renderFavs();generate();$("colorMessage").textContent=exists?"Warna dihapus.":c+" disimpan."}};generate();renderFavs();preview($("colorHex").value)}
async function initSecurityIndicator(){const el=$("securityStatusIndicator");if(!el)return;const label=el.querySelector("span");const check=async()=>{try{const response=await fetch("/api/security/status",{headers:{accept:"application/json"},cache:"no-store"});const data=await response.json();const active=response.ok&&data?.security?.active===true;el.classList.toggle("is-active",active);el.classList.toggle("is-warning",!active);el.title=active?"Perlindungan edge aktif · pemeriksaan status berhasil":"Status perlindungan belum dapat diverifikasi";if(label)label.textContent=active?"Proteksi aktif":"Cek keamanan";}catch{el.classList.remove("is-active");el.classList.add("is-warning");el.title="Status perlindungan belum dapat diverifikasi";if(label)label.textContent="Cek keamanan";}};check();setInterval(check,60000);}
initTheme();initSearch();initTools();initColors();initSecurityIndicator();
})();