(()=>{"use strict";
const $=id=>document.getElementById(id);
const historyKey='aryanzz-download-history-v1';
function readHistory(){try{return JSON.parse(localStorage.getItem(historyKey)||'[]')}catch{return []}}
function saveHistory(item){const h=[item,...readHistory().filter(x=>x.url!==item.url)].slice(0,12);localStorage.setItem(historyKey,JSON.stringify(h));renderHistory()}
function renderHistory(){const box=$('historyBox'),h=readHistory();if(!h.length){box.hidden=true;return}box.hidden=false;box.innerHTML='<b>Riwayat unduhan di perangkat ini</b><div id="historyItems"></div><button id="clearHistory" class="tag" style="margin-top:9px">Hapus riwayat</button>';const list=$('historyItems');h.forEach(item=>{const row=document.createElement('div');row.style.cssText='padding:8px 0;border-bottom:1px solid #263852;overflow-wrap:anywhere';const a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener';a.style.color='#8ec5ff';a.textContent=item.name||item.url;const small=document.createElement('div');small.className='muted';small.textContent=new Date(item.at).toLocaleString();row.append(a,small);list.append(row)});$('clearHistory').onclick=()=>{localStorage.removeItem(historyKey);renderHistory()}}
const favoritesKey='aryanzz-library-favorites-v1';
function readFavorites(){try{return JSON.parse(localStorage.getItem(favoritesKey)||'[]')}catch{return []}}
function writeFavorites(items){localStorage.setItem(favoritesKey,JSON.stringify(items.slice(0,80)));renderLibrary()}
function escapeLibraryText(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderLibrary(){
 const hist=readHistory(),favs=readFavorites();
 $('aryLibraryHistoryCount').textContent=hist.length;$('aryLibraryFavoriteCount').textContent=favs.length;
 $('aryLibraryHistoryBadge').textContent=hist.length;$('aryLibraryFavoriteBadge').textContent=favs.length;
 const draw=(id,items,kind)=>{
  const box=$(id);box.innerHTML='';
  if(!items.length){const empty=document.createElement('div');empty.className='ary-library-empty-state';empty.innerHTML=kind==='history'?'<span style="font-size:25px">◷</span><b>Belum ada riwayat</b><small>Aktivitas unduhanmu akan muncul di sini.</small>':'<span style="font-size:25px">♡</span><b>Belum ada favorit</b><small>Tekan ikon bintang pada riwayat untuk menyimpan item.</small>';box.append(empty);return}
  items.forEach((item,index)=>{
   const row=document.createElement('div');row.className='ary-library-item';
   const icon=document.createElement('span');icon.className='ary-library-item-icon';icon.textContent=(item.name||'').match(/\.mp3|\.m4a|\.wav/i)?'♫':'▶';
   const main=document.createElement('div');main.className='ary-library-item-main';
   const a=document.createElement('a');a.textContent=item.name||item.url||'Media';a.href=item.url||'#';a.target='_blank';a.rel='noopener noreferrer';a.title=item.name||item.url||'';
   const small=document.createElement('small');small.textContent=item.at?new Date(item.at).toLocaleString():'Disimpan di perangkat ini';main.append(a,small);
   const action=document.createElement('button');action.type='button';action.className='ary-library-item-action';action.textContent=kind==='history'?(favs.some(x=>x.url===item.url)?'★':'☆'):'×';action.setAttribute('aria-label',kind==='history'?'Simpan ke favorit':'Hapus dari favorit');
   action.addEventListener('click',()=>{
    if(kind==='history'){const next=readFavorites();if(next.some(x=>x.url===item.url)){writeFavorites(next.filter(x=>x.url!==item.url))}else{writeFavorites([{...item,savedAt:Date.now()},...next])}}
    else writeFavorites(readFavorites().filter(x=>x.url!==item.url));
   });
   row.append(icon,main,action);box.append(row);
  });
 };
 draw('historyList',hist,'history');draw('favoriteList',favs,'favorite');
}
function setLibraryTab(tab){
 const history=tab==='history';
 $('aryLibraryHistoryTab').classList.toggle('active',history);$('aryLibraryFavoriteTab').classList.toggle('active',!history);
 $('aryLibraryHistoryTab').setAttribute('aria-selected',String(history));$('aryLibraryFavoriteTab').setAttribute('aria-selected',String(!history));
 $('aryLibraryHistoryView').classList.toggle('active',history);$('aryLibraryFavoriteView').classList.toggle('active',!history);
 $('aryLibraryHistoryView').hidden=!history;$('aryLibraryFavoriteView').hidden=history;
}
$('aryLibraryHistoryTab').onclick=()=>setLibraryTab('history');$('aryLibraryFavoriteTab').onclick=()=>setLibraryTab('favorite');
$('clearHistoryV2').onclick=()=>{if(confirm('Hapus semua riwayat pada perangkat ini?')){localStorage.removeItem(historyKey);renderHistory();renderLibrary()}};
$('clearFavoritesV2').onclick=()=>{if(confirm('Hapus semua favorit pada perangkat ini?')){localStorage.removeItem(favoritesKey);renderLibrary()}};


window.ARYANZZLibrary=Object.freeze({saveHistory,renderHistory,renderLibrary,readHistory,readFavorites});
renderHistory();
renderLibrary();
})();