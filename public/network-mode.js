/* ARYANZZ V1 · online/offline network recovery and local media cache */
(()=>{"use strict";
const DB_NAME="aryanzz-offline-v1",DB_VERSION=1,MODE_KEY="aryanzz-network-mode",MAX_OFFLINE_BYTES=100*1024*1024,API_TTL=30*24*60*60*1000;
const nativeFetch=window.fetch.bind(window);
let dbPromise=null,selectedMode="online";
try{selectedMode=localStorage.getItem(MODE_KEY)==="offline"?"offline":"online"}catch{}
window.ARYANZZ_NETWORK_MODE=selectedMode;
function openDb(){
  if(!("indexedDB" in window))return Promise.reject(new Error("Penyimpanan offline tidak didukung browser ini."));
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of ["api","library","media","settings"])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name==="library"?"sourceUrl":"key"});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Database offline tidak dapat dibuka."));
    request.onblocked=()=>reject(new Error("Database offline sedang dipakai tab lain. Muat ulang halaman."));
  });
  return dbPromise;
}
async function dbGet(store,key){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const request=db.transaction(store,"readonly").objectStore(store).get(key);
    request.onsuccess=()=>resolve(request.result||null);
    request.onerror=()=>reject(request.error||new Error("Gagal membaca cache offline."));
  });
}
async function dbPut(store,value){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>reject(tx.error||new Error("Gagal menyimpan cache offline."));
    tx.onabort=()=>reject(tx.error||new Error("Penyimpanan offline dibatalkan."));
  });
}
async function dbAll(store){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const request=db.transaction(store,"readonly").objectStore(store).getAll();
    request.onsuccess=()=>resolve(request.result||[]);
    request.onerror=()=>reject(request.error||new Error("Gagal membaca pustaka offline."));
  });
}
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object"){
    const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;
  }
  return value;
}
function requestDetails(input,init){
  let url;try{url=new URL(typeof input==="string"?input:input.url,location.href)}catch{return null}
  const method=String(init?.method||(typeof Request!=="undefined"&&input instanceof Request?input.method:"GET")).toUpperCase();
  return {url,method};
}
function managedRequest(path,method){
  return (method==="POST"&&["/api/platform/info","/api/social/search","/api/search","/api/image/search"].includes(path))
    ||(method==="GET"&&path==="/api/youtube/hybrid/info");
}
async function requestBody(input,init){
  let raw=init?.body;
  if(raw==null&&typeof Request!=="undefined"&&input instanceof Request){
    try{raw=await input.clone().text()}catch{}
  }
  if(typeof raw==="string"){try{return JSON.parse(raw)}catch{return null}}
  return raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:null;
}
function apiCacheKey(url,method,body){
  return method==="GET"?"GET|"+url.pathname+"|"+url.search:"POST|"+url.pathname+"|"+JSON.stringify(stable(body||{}));
}
function jsonResponse(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-aryanzz-cache":"local"}});
}
async function readApiCache(key){
  try{
    const record=await dbGet("api",key);
    return record&&Date.now()-Number(record.savedAt||0)<=API_TTL?record:null;
  }catch{return null}
}
async function storeApiCache(key,data,status){
  try{await dbPut("api",{key,data,status,savedAt:Date.now()})}catch{}
}
async function storeLibrary(body,data){
  const sourceUrl=String(body?.url||"").trim();
  if(!sourceUrl||data?.ok===false||!Array.isArray(data?.formats)||!data.formats.length)return;
  try{
    await dbPut("library",{
      sourceUrl,platform:String(data.platform||body.expectedPlatform||"").toLowerCase(),
      title:String(data.title||data.filename||sourceUrl).slice(0,300),
      thumbnail:String(data.thumbnail||""),
      duration:Number(data.duration)||0,
      mediaMode:data.type==="audio"?"audio":"video",
      info:data,savedAt:Date.now()
    });
  }catch{}
}
function cachedResponse(record){
  return jsonResponse({...record.data,_aryanzzCached:true,_aryanzzCachedAt:record.savedAt},200);
}
async function localSearch(body){
  const query=String(body?.query||"").trim().toLowerCase();
  const selected=String(body?.platform||"all").toLowerCase();
  const kind=String(body?.mediaType||"video").toLowerCase();
  if(kind==="image")return {ok:false,error:"Pencarian gambar offline hanya menampilkan kueri yang sebelumnya sudah tersimpan. Hubungkan internet untuk pencarian baru."};
  try{
    const rows=await dbAll("library");
    const aliases={facebooklite:"facebook",instagramlite:"instagram",tiktoklite:"tiktok",twitter:"x"};
    const wanted=aliases[selected]||selected;
    const results=rows.filter(row=>{
      if(!query)return false;
      const matches=(row.title+" "+row.sourceUrl).toLowerCase().includes(query);
      const platformOk=selected==="all"||wanted==="all"||row.platform===wanted;
      return matches&&platformOk;
    }).sort((a,b)=>Number(b.savedAt||0)-Number(a.savedAt||0)).slice(0,50).map(row=>({
      title:row.title,url:row.sourceUrl,sourceUrl:row.sourceUrl,platform:row.platform,
      thumbnail:row.thumbnail||undefined,duration:row.duration||null,mediaMode:row.mediaMode||"video",
      verified:true,searchOnly:false,snippet:"Ditemukan di cache perangkat · hasil pemeriksaan sebelumnya."
    }));
    return results.length?{ok:true,results,unavailableCount:0,offline:true,source:"Pustaka lokal"}:{ok:false,error:"Tidak ada hasil tersimpan yang cocok dengan kata kunci ini. Pencarian konten baru memerlukan internet."};
  }catch{return {ok:false,error:"Pustaka offline belum tersedia. Periksa koneksi dan coba lagi."}}
}
async function offlineApiFallback(key,body,url){
  const cached=await readApiCache(key);
  if(cached)return cachedResponse(cached);
  if(url.pathname==="/api/platform/info"&&body?.url){
    try{
      const row=await dbGet("library",String(body.url));
      if(row?.info)return jsonResponse({...row.info,_aryanzzCached:true,_aryanzzCachedAt:row.savedAt},200);
    }catch{}
  }
  if(["/api/social/search","/api/search","/api/image/search"].includes(url.pathname)){
    const local=await localSearch(body);
    return jsonResponse(local,local.ok?200:503);
  }
  return jsonResponse({ok:false,error:"Belum ada data tersimpan untuk permintaan ini. Hubungkan internet, periksa tautan sekali, lalu simpan media jika ingin dipakai offline."},503);
}
async function setMode(mode){
  selectedMode=mode==="offline"?"offline":"online";
  window.ARYANZZ_NETWORK_MODE=selectedMode;
  try{localStorage.setItem(MODE_KEY,selectedMode)}catch{}
  try{await dbPut("settings",{key:"mode",value:selectedMode,savedAt:Date.now()})}catch{}
  window.dispatchEvent(new CustomEvent("aryanzz:network-mode-change",{detail:{mode:selectedMode}}));
  paintPanel();
}
function paintPanel(){
  const panel=document.getElementById("aryanzzNetworkMode");
  if(!panel)return;
  const onlineButton=panel.querySelector('[data-network-mode="online"]');
  const offlineButton=panel.querySelector('[data-network-mode="offline"]');
  const status=panel.querySelector("[data-network-status]");
  onlineButton?.setAttribute("aria-pressed",String(selectedMode==="online"));
  offlineButton?.setAttribute("aria-pressed",String(selectedMode==="offline"));
  panel.dataset.mode=selectedMode;
  if(!navigator.onLine){
    status.textContent="Internet terputus · cache lokal aktif. Link baru dan pencarian baru menunggu koneksi.";
  }else if(selectedMode==="offline"){
    status.textContent="Mode Offline aktif · periksa link dan cari judul dari data tersimpan; video harus disimpan offline terlebih dahulu.";
  }else{
    status.textContent="Mode Online aktif · link dan pencarian baru tersedia. Hasil pemeriksaan otomatis dicadangkan di perangkat.";
  }
}
function installPanel(){
  const anchor=document.getElementById("linkModePanel");
  if(!anchor||document.getElementById("aryanzzNetworkMode"))return;
  const style=document.createElement("style");
  style.textContent=".ary-network-mode{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 14px;padding:12px 14px;border:1px solid rgba(126,158,210,.2);border-radius:14px;background:rgba(18,29,49,.72)}.ary-network-mode-copy{min-width:180px;flex:1}.ary-network-mode-copy strong{display:block;font-size:13px;color:#eef4ff}.ary-network-mode-copy small{display:block;margin-top:4px;font-size:11px;line-height:1.5;color:#aab9d2}.ary-network-mode-actions{display:flex;gap:7px}.ary-network-mode button{border:1px solid rgba(142,165,204,.28);border-radius:10px;padding:8px 12px;background:rgba(255,255,255,.04);color:#d8e4f7;font:inherit;font-size:12px;font-weight:600;cursor:pointer}.ary-network-mode button[aria-pressed=true]{background:linear-gradient(135deg,rgba(46,190,178,.2),rgba(76,132,230,.2));border-color:rgba(92,180,222,.65);color:#fff}.ary-network-mode-status{flex-basis:100%;font-size:11px;line-height:1.45;color:#aab9d2}";
  document.head.append(style);
  const panel=document.createElement("section");
  panel.id="aryanzzNetworkMode";panel.className="ary-network-mode";
  panel.innerHTML='<div class="ary-network-mode-copy"><strong>Mode jaringan ARYANZZ</strong><small>Pilih Online untuk konten baru atau Offline untuk data dan file yang sudah disimpan.</small></div><div class="ary-network-mode-actions"><button type="button" data-network-mode="online">Online</button><button type="button" data-network-mode="offline">Offline</button></div><small class="ary-network-mode-status" data-network-status role="status" aria-live="polite"></small>';
  anchor.after(panel);
  panel.querySelectorAll("[data-network-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.networkMode)));
  window.addEventListener("online",paintPanel);
  window.addEventListener("offline",paintPanel);
  window.addEventListener("aryanzz:network-mode-change",paintPanel);
  paintPanel();
}
function mediaCacheKey(rawUrl){
  try{
    const url=new URL(rawUrl,location.href);
    if(url.origin!==location.origin)return "";
    if(url.pathname==="/api/social-file")return [url.searchParams.get("source")||"",url.searchParams.get("url")||"",url.searchParams.get("mode")||"video",url.searchParams.get("ext")||"mp4"].join("|");
    if(url.pathname==="/api/youtube/hybrid/browser-file")return ["youtube",url.searchParams.get("url")||"",url.searchParams.get("instance")||"","video",url.searchParams.get("ext")||"mp4"].join("|");
    return "";
  }catch{return ""}
}
async function saveMedia(rawUrl,meta={}){
  const url=new URL(rawUrl,location.href),key=mediaCacheKey(url.href);
  if(!key)throw new Error("Hanya stream media ARYANZZ yang dapat disimpan untuk offline.");
  if(!navigator.onLine||selectedMode==="offline")throw new Error("Aktifkan Mode Online dan koneksi internet untuk menyimpan file baru.");
  const existing=await dbGet("media",key).catch(()=>null);
  if(existing)return {saved:true,size:existing.size||existing.blob?.size||0,alreadySaved:true};
  const probe=await nativeFetch(url.href,{headers:{Range:"bytes=0-0"},cache:"no-store",credentials:"same-origin"});
  if(!probe.ok&&probe.status!==206)throw new Error("Pemeriksaan ukuran file gagal (HTTP "+probe.status+").");
  const range=String(probe.headers.get("content-range")||"").match(/\/(\d+)$/);
  const estimated=Number(range?.[1]||probe.headers.get("content-length")||0);
  await probe.body?.cancel().catch(()=>{});
  if(estimated>MAX_OFFLINE_BYTES)throw new Error("File terlalu besar untuk cache offline HP (maksimal 100 MB). Unduh file secara online seperti biasa.");
  const response=await nativeFetch(url.href,{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw new Error("File tidak dapat diambil untuk cache offline (HTTP "+response.status+").");
  const mime=String(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
  if(!mime.startsWith("video/")&&!mime.startsWith("audio/"))throw new Error("Sumber tidak mengirim file video/audio yang valid.");
  const reader=response.body?.getReader(),chunks=[];let size=0;
  if(reader){
    try{
      while(true){
        const part=await reader.read();if(part.done)break;
        size+=part.value.byteLength;
        if(size>MAX_OFFLINE_BYTES){await reader.cancel().catch(()=>{});throw new Error("File melewati batas cache offline 100 MB.");}
        chunks.push(part.value);
      }
    }finally{reader.releaseLock?.()}
  }else{
    const buffer=await response.arrayBuffer();size=buffer.byteLength;
    if(size>MAX_OFFLINE_BYTES)throw new Error("File melewati batas cache offline 100 MB.");
    chunks.push(buffer);
  }
  const blob=new Blob(chunks,{type:mime});
  if(!blob.size)throw new Error("File kosong; tidak disimpan.");
  try{
    const estimate=await navigator.storage?.estimate?.();
    if(estimate?.quota&&estimate?.usage&&estimate.usage+blob.size>estimate.quota*.9)throw new Error("Penyimpanan perangkat hampir penuh. Hapus cache offline lain terlebih dahulu.");
  }catch(error){if(error?.message?.includes("hampir penuh"))throw error;}
  await dbPut("media",{key,blob,mimeType:mime,size:blob.size,title:String(meta.title||"Media tersimpan").slice(0,300),sourceUrl:String(meta.sourceUrl||url.searchParams.get("source")||""),savedAt:Date.now()});
  return {saved:true,size:blob.size,alreadySaved:false};
}
window.ARYANZZOfflineMedia={saveMedia,mediaCacheKey,setMode,getMode:()=>selectedMode};
const originalWindowFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const details=requestDetails(input,init);
  if(!details||!managedRequest(details.url.pathname,details.method))return originalWindowFetch(input,init);
  const body=details.method==="POST"?await requestBody(input,init):null;
  const key=apiCacheKey(details.url,details.method,body);
  const offline=selectedMode==="offline"||!navigator.onLine;
  if(offline)return offlineApiFallback(key,body,details.url);
  try{
    const response=await originalWindowFetch(input,init);
    if(response.ok){
      const data=await response.clone().json().catch(()=>null);
      if(data&&data.ok!==false){
        await storeApiCache(key,data,response.status);
        if(details.url.pathname==="/api/platform/info")await storeLibrary(body,data);
      }
    }else if(response.status>=500||response.status===429){
      const cached=await readApiCache(key);
      if(cached)return cachedResponse(cached);
    }
    return response;
  }catch(error){
    const cached=await readApiCache(key);
    if(cached)return cachedResponse(cached);
    if(details.url.pathname==="/api/social/search"||details.url.pathname==="/api/search"||details.url.pathname==="/api/image/search"){
      const local=await localSearch(body);
      if(local.ok)return jsonResponse(local,200);
    }
    throw error;
  }
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installPanel,{once:true});else installPanel();
})();