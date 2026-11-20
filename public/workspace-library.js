(()=>{"use strict";
const $=id=>document.getElementById(id);
const HISTORY_KEY="aryanzz.history.v2";
const LEGACY_HISTORY_KEY="aryanzz-download-history-v1";
const FAVORITES_KEY="aryanzz.favorites.v2";
const LEGACY_FAVORITES_KEY="aryanzz-library-favorites-v1";
let activeTab="history";
function readArray(key){
 try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value:[]}catch{return []}
}
function writeArray(key,items){
 try{localStorage.setItem(key,JSON.stringify(items));return true}catch{return false}
}
function safeMediaUrl(raw){
 try{const url=new URL(String(raw||""));return ["http:","https:"].includes(url.protocol)&&!url.username&&!url.password?url.href:""}catch{return ""}
}
function mergeCollections(keys,limit){
 const merged=new Map();
 for(const key of keys)for(const item of readArray(key)){
  const url=safeMediaUrl(item?.url);if(!url)continue;
  const at=Number(item.at||item.savedAt)||0,current=merged.get(url);
  if(!current||(Number(current.at||current.savedAt)||0)<=at)merged.set(url,{...current,...item,url});
 }
 return [...merged.values()].sort((a,b)=>(Number(b.at||b.savedAt)||0)-(Number(a.at||a.savedAt)||0)).slice(0,limit);
}
function readHistory(){return mergeCollections([HISTORY_KEY,LEGACY_HISTORY_KEY],80)}
function readFavorites(){return mergeCollections([FAVORITES_KEY,LEGACY_FAVORITES_KEY],120)}
function writeFavorites(items){
 const next=items.slice(0,120);
 writeArray(FAVORITES_KEY,next);
 renderLibrary();
 window.dispatchEvent(new Event("aryanzz:history-updated"));
}
function saveHistory(item){
 const url=safeMediaUrl(item?.url);if(!url)return false;
 const next=[{...item,url,at:Number(item.at)||Date.now()},...readHistory().filter(value=>value.url!==url)].slice(0,80);
 if(!writeArray(HISTORY_KEY,next))return false;
 renderHistory();renderLibrary();
 window.dispatchEvent(new Event("aryanzz:history-updated"));
 return true;
}
function make(tag,className,text){
 const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;
}
function mediaKind(item){
 const mode=String(item?.mode||item?.type||"").toLowerCase();
 const ext=String(item?.extension||item?.ext||item?.name||item?.url||"").toLowerCase();
 if(mode==="audio"||/\.(?:mp3|m4a|aac|wav|ogg|flac|opus)(?:[?#]|$)/.test(ext))return "audio";
 if(mode==="image"||/\.(?:jpe?g|png|webp|gif|avif|bmp)(?:[?#]|$)/.test(ext))return "image";
 return "video";
}
function displaySource(item){
 if(item?.platform)return String(item.platform);
 try{return new URL(item.url).hostname.replace(/^www\./,"")}catch{return "Media"}
}
function dateLabel(item){
 const value=Number(item?.at||item?.savedAt)||0;
 return value?new Date(value).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}):"Disimpan di perangkat ini";
}
function renderHistory(){
 const box=$("historyBox"),items=readHistory();if(!box)return;
 if(!items.length){box.hidden=true;return}
 box.hidden=false;box.replaceChildren();
 box.append(make("b","ary-history-mini-title","Riwayat unduhan di perangkat ini"));
 const list=make("div","ary-history-mini-list");
 items.slice(0,6).forEach(item=>{
  const row=make("div","ary-history-mini-item");
  const link=make("a","",item.name||item.title||item.url);link.href=safeMediaUrl(item.url)||"#";link.target="_blank";link.rel="noopener noreferrer";
  const small=make("small","",dateLabel(item));row.append(link,small);list.append(row);
 });
 const clear=make("button","tag","Hapus riwayat");clear.type="button";clear.addEventListener("click",()=>clearHistory());
 box.append(list,clear);
}
function toggleFavorite(item){
 const current=readFavorites(),exists=current.some(value=>value.url===item.url);
 writeFavorites(exists?current.filter(value=>value.url!==item.url):[{...item,savedAt:Date.now()},...current]);
}
function renderLibrary(){
 const history=readHistory(),favorites=readFavorites();
 const historyCount=$("aryLibraryHistoryCount"),favoriteCount=$("aryLibraryFavoriteCount");
 if(historyCount)historyCount.textContent=String(history.length);
 if(favoriteCount)favoriteCount.textContent=String(favorites.length);
 const historyBadge=$("aryLibraryHistoryBadge"),favoriteBadge=$("aryLibraryFavoriteBadge");
 if(historyBadge)historyBadge.textContent=String(history.length);
 if(favoriteBadge)favoriteBadge.textContent=String(favorites.length);
 const query=String($("aryLibrarySearch")?.value||"").trim().toLocaleLowerCase("id-ID");
 const sort=$("aryLibrarySort")?.value||"newest";
 const draw=(id,items,kind)=>{
  const box=$(id);if(!box)return;box.replaceChildren();
  const filtered=items.filter(item=>[item.name,item.title,item.platform,item.mode,item.type,item.url].join(" ").toLocaleLowerCase("id-ID").includes(query));
  filtered.sort((a,b)=>{
   const first=Number(a.at||a.savedAt)||0,second=Number(b.at||b.savedAt)||0;
   return sort==="oldest"?first-second:second-first;
  });
  if(!filtered.length){
   const empty=make("div","ary-library-empty-state");
   empty.append(make("span","ary-library-empty-icon",kind==="history"?"◷":"♡"));
   empty.append(make("b","",query?"Tidak ada hasil yang cocok":kind==="history"?"Belum ada riwayat unduhan":"Belum ada media favorit"));
   empty.append(make("small","",query?"Coba kata kunci lain.":kind==="history"?"Hasil unduhan yang berhasil akan tersimpan di sini.":"Simpan media dari riwayat agar mudah ditemukan kembali."));
   box.append(empty);return;
  }
  filtered.forEach(item=>{
   const row=make("article","ary-library-item ary-library-item-"+kind);
   const kindValue=mediaKind(item),icon=make("span","ary-library-item-icon ary-library-kind-"+kindValue,kindValue==="audio"?"♫":kindValue==="image"?"▧":"▶");
   const main=make("div","ary-library-item-main");
   const title=make("b","ary-library-item-title",item.name||item.title||"Media tanpa judul");
   const meta=make("small","ary-library-item-meta",[displaySource(item),kindValue==="audio"?"Audio":kindValue==="image"?"Gambar":"Video",item.quality||""].filter(Boolean).join(" · "));
   const date=make("small","ary-library-item-date",dateLabel(item));
   main.append(title,meta,date);
   const actions=make("div","ary-library-item-actions");
   const url=safeMediaUrl(item.url);
   if(url){const open=make("a","ary-library-item-open","Buka ↗");open.href=url;open.target="_blank";open.rel="noopener noreferrer";actions.append(open);}
   const action=make("button","ary-library-item-action",kind==="history"?(favorites.some(value=>value.url===item.url)?"★":"☆"):"×");
   action.type="button";action.setAttribute("aria-label",kind==="history"?"Simpan atau hapus favorit":"Hapus dari favorit");
   action.addEventListener("click",()=>{
    if(kind==="history")toggleFavorite(item);
    else writeFavorites(readFavorites().filter(value=>value.url!==item.url));
   });
   actions.append(action);row.append(icon,main,actions);box.append(row);
  });
 };
 draw("historyList",history,"history");draw("favoriteList",favorites,"favorite");
}
function setLibraryTab(tab){
 activeTab=tab==="favorite"?"favorite":"history";
 const history=activeTab==="history";
 const historyTab=$("aryLibraryHistoryTab"),favoriteTab=$("aryLibraryFavoriteTab");
 const historyView=$("aryLibraryHistoryView"),favoriteView=$("aryLibraryFavoriteView");
 if(historyTab){historyTab.classList.toggle("active",history);historyTab.setAttribute("aria-selected",String(history));}
 if(favoriteTab){favoriteTab.classList.toggle("active",!history);favoriteTab.setAttribute("aria-selected",String(!history));}
 if(historyView){historyView.classList.toggle("active",history);historyView.hidden=!history;}
 if(favoriteView){favoriteView.classList.toggle("active",!history);favoriteView.hidden=history;}
 renderLibrary();
}
function clearHistory(){
 if(!confirm("Hapus semua riwayat unduhan pada perangkat ini?"))return;
 for(const key of [HISTORY_KEY,LEGACY_HISTORY_KEY])try{localStorage.removeItem(key)}catch{}
 renderHistory();renderLibrary();
 window.dispatchEvent(new Event("aryanzz:history-updated"));
}
function clearFavorites(){
 if(!confirm("Hapus semua media favorit pada perangkat ini?"))return;
 for(const key of [FAVORITES_KEY,LEGACY_FAVORITES_KEY])try{localStorage.removeItem(key)}catch{}
 renderLibrary();
 window.dispatchEvent(new Event("aryanzz:history-updated"));
}
$("aryLibraryHistoryTab")?.addEventListener("click",()=>setLibraryTab("history"));
$("aryLibraryFavoriteTab")?.addEventListener("click",()=>setLibraryTab("favorite"));
$("aryLibrarySearch")?.addEventListener("input",renderLibrary);
$("aryLibrarySort")?.addEventListener("change",renderLibrary);
$("clearHistoryV2")?.addEventListener("click",clearHistory);
$("clearFavoritesV2")?.addEventListener("click",clearFavorites);
window.addEventListener("aryanzz:history-updated",()=>{renderHistory();renderLibrary()});
window.addEventListener("storage",event=>{if([HISTORY_KEY,LEGACY_HISTORY_KEY,FAVORITES_KEY,LEGACY_FAVORITES_KEY].includes(event.key)){renderHistory();renderLibrary()}});
window.ARYANZZLibrary=Object.freeze({saveHistory,renderHistory,renderLibrary,readHistory,readFavorites});
renderHistory();renderLibrary();
})();