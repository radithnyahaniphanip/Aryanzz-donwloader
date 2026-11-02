/* ARYANZZ V67.6 — UI controls */
(()=>{"use strict";
const $=id=>document.getElementById(id),THEME="aryanzz.theme.v674",FAV="aryanzz.color-favorites.v674";
const read=(k)=>{try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return []}};
function toast(s){let n=$("v674Toast");if(!n){n=document.createElement("div");n.id="v674Toast";n.className="v674-toast";document.body.append(n)}n.textContent=s;n.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.classList.remove("show"),2200)}
async function copy(s){try{await navigator.clipboard.writeText(s);return true}catch{try{const t=document.createElement("textarea");t.value=s;document.body.append(t);t.select();const ok=document.execCommand("copy");t.remove();return ok}catch{return false}}}
function initTheme(){document.body.dataset.theme=localStorage.getItem(THEME)||"dark";const b=$("themeToggle");if(!b)return;const draw=()=>{b.textContent=document.body.dataset.theme==="light"?"☾":"☼"};draw();b.onclick=()=>{const v=document.body.dataset.theme==="light"?"dark":"light";document.body.dataset.theme=v;localStorage.setItem(THEME,v);draw();toast("Tema "+v+" diaktifkan")}}
function initSearch(){
const a=$("downloadLinkMode"),b=$("downloadTitleMode"),x=$("linkModePanel"),y=$("titleModePanel"),picker=$("platformPicker");
const results=$("titleSearchResults"),help=$("titleSearchHelp"),searchInput=$("titleSearch");
const platforms={
 youtube:{name:"YouTube",url:q=>"https://www.youtube.com/results?search_query="+encodeURIComponent(q)},
 tiktok:{name:"TikTok",url:q=>"https://www.tiktok.com/search?q="+encodeURIComponent(q)},
 instagram:{name:"Instagram",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:instagram.com "+q)},
 snackvideo:{name:"SnackVideo",url:q=>"https://www.google.com/search?q="+encodeURIComponent("site:snackvideo.com "+q)},
 pinterest:{name:"Pinterest",url:q=>"https://www.pinterest.com/search/pins/?q="+encodeURIComponent(q)},
 facebook:{name:"Facebook",url:q=>"https://www.facebook.com/search/videos/?q="+encodeURIComponent(q)},
 x:{name:"X",url:q=>"https://x.com/search?q="+encodeURIComponent(q)},
 reddit:{name:"Reddit",url:q=>"https://www.reddit.com/search/?q="+encodeURIComponent(q)},
 vimeo:{name:"Vimeo",url:q=>"https://vimeo.com/search?q="+encodeURIComponent(q)}
};
let selected="youtube";
const setMode=v=>{const link=v==="link";if(x)x.hidden=!link;if(y)y.hidden=link;if(a){a.classList.toggle("active",link);a.setAttribute("aria-selected",String(link))}if(b){b.classList.toggle("active",!link);b.setAttribute("aria-selected",String(!link))}};
a?.addEventListener("click",()=>setMode("link"));b?.addEventListener("click",()=>setMode("title"));
const setPlatform=id=>{selected=platforms[id]?id:"youtube";picker?.querySelectorAll("[data-platform]").forEach(btn=>{const active=btn.dataset.platform===selected;btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active))});const name=platforms[selected].name;const label=y?.querySelector("label");if(label)label.textContent="CARI JUDUL DI "+name.toUpperCase();if(searchInput)searchInput.placeholder=selected==="youtube"?"Contoh: DJ tabola bale":"Ketik judul yang ingin dicari…";if(help)help.textContent="Pencarian akan dibuka melalui "+name+".";setMode("title")};
picker?.addEventListener("click",e=>{const btn=e.target.closest("[data-platform]");if(btn)setPlatform(btn.dataset.platform)});
const duration=v=>{if(!Number.isFinite(Number(v)))return "Durasi tidak tersedia";const n=Math.max(0,Math.floor(Number(v)));return Math.floor(n/60)+":"+String(n%60).padStart(2,"0")};
const go=async()=>{
const q=(searchInput?.value||"").trim();if(!q){if(help)help.textContent="Masukkan judul yang ingin dicari.";return}if(q.length<2){if(help)help.textContent="Masukkan minimal 2 karakter.";return}
results.hidden=false;results.replaceChildren();
const target=platforms[selected],link=target.url(q);
if(selected==="youtube"){
const loading=document.createElement("div");loading.className="v674-search-loading";loading.textContent="Mencari di YouTube…";results.append(loading);
const btn=$("titleSearchBtn");if(btn){btn.disabled=true;btn.textContent="Mencari…"}
try{
const response=await fetch("/api/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:q}),cache:"no-store",signal:AbortSignal.timeout(8000)});
const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||"Pencarian internal belum aktif.");
const items=Array.isArray(data.results)?data.results:[];
if(items.length){results.replaceChildren();items.forEach(item=>{const card=document.createElement("article");card.className="v674-search-result";if(item.thumbnail){try{const u=new URL(item.thumbnail);if(u.protocol==="https:"){const img=document.createElement("img");img.src=u.href;img.alt="Thumbnail";img.loading="lazy";card.append(img)}}catch{}}const info=document.createElement("div"),title=document.createElement("h3"),meta=document.createElement("p"),pick=document.createElement("button");title.textContent=item.title||"Video tanpa judul";meta.textContent=[item.channel,duration(item.duration)].filter(Boolean).join(" · ");pick.type="button";pick.textContent="Pilih video";pick.onclick=()=>{const input=$("url");input.value=item.url;setMode("link");$("analyze")?.click()};info.append(title,meta,pick);card.append(info);results.append(card)});if(help)help.textContent=items.length+" hasil ditemukan.";return}
}catch{}
finally{if(btn){btn.disabled=false;btn.textContent="Cari ⌕"}}
}
results.replaceChildren();
const card=document.createElement("article");card.className="v674-search-result v736-search-handoff";
const title=document.createElement("h3");title.textContent="Hasil pencarian "+target.name;
const note=document.createElement("p");note.textContent="Buka hasil di "+target.name+", pilih video, lalu salin tautannya ke ARYANZZ.";
const open=document.createElement("a");open.className="primary";open.href=link;open.target="_blank";open.rel="noopener noreferrer";open.textContent="Buka hasil "+target.name+" ↗";
card.append(title,note,open);results.append(card);
if(help)help.textContent="Hasil dibuka di "+target.name+". Tempel tautan publik di tab Tempel tautan untuk memeriksa dukungan unduhan.";
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
initTheme();initSearch();initTools();initColors();
})();