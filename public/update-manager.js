(()=>{
"use strict";
const meta=document.querySelector('meta[name="aryanzz-build-id"]');
const localVersion=String(meta?.content||"").trim();
const dismissedKey="aryanzz:update-dismissed-build:v1";
let checking=false,updating=false,currentNotice=null,lastProgress=null;
function readDismissedBuild(){
 try{return String(localStorage.getItem(dismissedKey)||"")}catch{}
 try{const match=document.cookie.match(/(?:^|;\s*)aryanzz_update_dismissed=([^;]*)/);return match?decodeURIComponent(match[1]):""}catch{return ""}
}
function rememberDismissedBuild(version){
 let stored=false;
 try{localStorage.setItem(dismissedKey,version);stored=localStorage.getItem(dismissedKey)===version}catch{}
 if(!stored){try{document.cookie="aryanzz_update_dismissed="+encodeURIComponent(version)+"; Max-Age=63072000; Path=/; Secure; SameSite=Lax"}catch{}}
 return stored;
}
function formatMB(bytes){return (Math.max(0,Number(bytes)||0)/1048576).toFixed(2)}
function setProgress(data){
 if(!currentNotice)return;
 const ui=currentNotice;
 const total=Math.max(0,Number(data.totalBytes)||0);
 const downloaded=Math.max(0,Number(data.downloadedBytes)||0);
 const percent=data.phase==="ready"?100:total?Math.max(0,Math.min(99,Math.round(downloaded/total*100))):0;
 ui.fill.style.width=percent+"%";
 ui.track.setAttribute("aria-valuenow",String(percent));
 ui.percent.textContent=percent+"%";
 ui.size.textContent=formatMB(downloaded)+" MB / "+formatMB(total)+" MB";
 const index=Math.max(0,Number(data.fileIndex)||0),count=Math.max(0,Number(data.totalFiles)||0);
 ui.files.textContent=count?"File "+index+" dari "+count:"Menyiapkan daftar file";
 if(data.currentFile)ui.file.textContent="File: "+String(data.currentFile).split("/").pop();
 if(data.phase==="start")ui.status.textContent="Menyiapkan file pembaruan…";
 else if(data.phase==="download")ui.status.textContent="Mengunduh file website…";
 else if(data.phase==="ready"){ui.status.textContent="Semua file berhasil diunduh. Memuat versi terbaru…";ui.button.textContent="Memperbarui halaman…"}
 else if(data.phase==="error")ui.status.textContent="Pembaruan gagal: "+String(data.error||"Silakan coba lagi.");
}
function cleanUpdateParameters(){
 const current=new URL(location.href);
 let changed=false;
 for(const key of ["aryanzz_update","aryanzz_attempt","aryanzz_refresh"]){if(current.searchParams.has(key)){current.searchParams.delete(key);changed=true}}
 if(changed)history.replaceState(null,"",current.pathname+current.search+current.hash);
}
function refreshToVersion(version){
 rememberDismissedBuild(version);
 const next=new URL(location.href);
 for(const key of ["aryanzz_update","aryanzz_attempt","aryanzz_refresh"])next.searchParams.delete(key);
 next.searchParams.set("aryanzz_refresh",String(Date.now()));
 location.replace(next.href);
}
function showNotice(version){
 if(!version||readDismissedBuild()===version||document.getElementById("aryanzzUpdateNotice"))return;
 const bar=document.createElement("section");
 bar.id="aryanzzUpdateNotice";
 bar.setAttribute("role","status");
 bar.setAttribute("aria-live","polite");
 bar.style.cssText="position:fixed;z-index:99999;left:12px;right:12px;top:12px;display:flex;flex-direction:column;gap:11px;padding:15px;border:1px solid #547cff;border-radius:17px;background:linear-gradient(145deg,#111d35,#0b1425);color:#f4f7ff;box-shadow:0 16px 45px #000b;font:600 13px/1.45 system-ui,sans-serif";
 const heading=document.createElement("div");
 heading.style.cssText="font-size:14px;font-weight:850";
 heading.textContent="Pembaruan ARYANZZ tersedia";
 const message=document.createElement("div");
 message.style.cssText="color:#c5d3e9;font-weight:500";
 message.textContent="Versi terbaru "+version+" sudah siap. Unduh file pembaruan terlebih dahulu agar website berpindah dengan aman ke versi baru.";
 const button=document.createElement("button");
 button.type="button";
 button.textContent="Memperbarui versi website";
 button.style.cssText="width:100%;border:0;border-radius:12px;padding:12px 14px;background:linear-gradient(110deg,#9160ff,#328dff);color:white;font-weight:850;letter-spacing:.1px";
 const progress=document.createElement("div");
 progress.hidden=true;
 progress.style.cssText="display:grid;gap:7px";
 const status=document.createElement("div");
 status.style.cssText="color:#d8e4f7;font-size:12px;font-weight:700";
 status.textContent="Menunggu konfirmasi pembaruan.";
 const track=document.createElement("div");
 track.setAttribute("role","progressbar");
 track.setAttribute("aria-label","Progress unduhan pembaruan website");
 track.setAttribute("aria-valuemin","0");
 track.setAttribute("aria-valuemax","100");
 track.setAttribute("aria-valuenow","0");
 track.style.cssText="height:10px;overflow:hidden;border-radius:20px;background:#263650";
 const fill=document.createElement("div");
 fill.style.cssText="height:100%;width:0;border-radius:20px;background:linear-gradient(90deg,#8c62ff,#32d9e8);transition:width .16s ease";
 track.append(fill);
 const metaRow=document.createElement("div");
 metaRow.style.cssText="display:flex;justify-content:space-between;gap:10px;color:#b6c6df;font-size:11px;font-variant-numeric:tabular-nums";
 const size=document.createElement("span");size.textContent="0.00 MB / menghitung ukuran";
 const percent=document.createElement("strong");percent.textContent="0%";
 metaRow.append(size,percent);
 const files=document.createElement("div");
 files.style.cssText="color:#9fb2d0;font-size:11px";
 files.textContent="Menunggu daftar file";
 const file=document.createElement("div");
 file.style.cssText="color:#8298b9;font-size:10px;overflow-wrap:anywhere";
 progress.append(status,track,metaRow,files,file);
 bar.append(heading,message,button,progress);
 document.body.append(bar);
 currentNotice={version,bar,button,progress,status,track,fill,size,percent,files,file,message};
 button.addEventListener("click",()=>startUpdate(currentNotice.version));
 if(lastProgress?.buildId===version)setProgress(lastProgress);
}
async function readWorkerVersion(worker){
 if(!worker||typeof MessageChannel==="undefined")return "";
 return new Promise(resolve=>{
  const channel=new MessageChannel();
  const timeout=window.setTimeout(()=>{try{channel.port1.close()}catch{}resolve("")},1800);
  channel.port1.onmessage=event=>{window.clearTimeout(timeout);try{channel.port1.close()}catch{}resolve(String(event.data?.buildId||""))};
  try{worker.postMessage({type:"ARYANZZ_GET_VERSION"},[channel.port2])}catch{window.clearTimeout(timeout);resolve("")}
 });
}
function handleWorkerMessage(event){
 const data=event.data||{};
 if(data.type!=="ARYANZZ_UPDATE_PROGRESS")return;
 if(data.buildId&&currentNotice&&data.buildId!==currentNotice.version)return;
 lastProgress=data;
 setProgress(data);
}
if("serviceWorker" in navigator)navigator.serviceWorker.addEventListener("message",handleWorkerMessage);
async function downloadWithProgress(version){
 const manifestResponse=await fetch("/release-manifest.json?update="+encodeURIComponent(version),{cache:"no-store",credentials:"same-origin"});
 if(!manifestResponse.ok)throw new Error("Daftar file pembaruan tidak dapat dibaca (HTTP "+manifestResponse.status+").");
 const manifest=await manifestResponse.json();
 if(String(manifest.buildId||"")!==version||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error("Daftar file pembaruan tidak cocok dengan versi terbaru.");
 const totalBytes=Number(manifest.totalBytes)||manifest.files.reduce((sum,item)=>sum+(Number(item.bytes)||0),0);
 let downloadedBytes=0;
 setProgress({phase:"start",totalBytes,downloadedBytes:0,totalFiles:manifest.files.length,fileIndex:0});
 for(let i=0;i<manifest.files.length;i++){
  const item=manifest.files[i];
  const response=await fetch(item.url,{cache:"reload",credentials:"same-origin"});
  if(!response.ok)throw new Error("Gagal mengunduh "+String(item.name||item.url)+" (HTTP "+response.status+").");
  let fileBytes=0;
  if(response.body&&response.body.getReader){
   const reader=response.body.getReader();
   while(true){
    const part=await reader.read();
    if(part.done)break;
    fileBytes+=part.value.byteLength;
    setProgress({phase:"download",totalBytes,downloadedBytes:downloadedBytes+fileBytes,totalFiles:manifest.files.length,fileIndex:i+1,currentFile:item.name||item.url});
   }
  }else{
   fileBytes=(await response.arrayBuffer()).byteLength;
   setProgress({phase:"download",totalBytes,downloadedBytes:downloadedBytes+fileBytes,totalFiles:manifest.files.length,fileIndex:i+1,currentFile:item.name||item.url});
  }
  downloadedBytes+=fileBytes;
 }
 setProgress({phase:"ready",totalBytes:Math.max(totalBytes,downloadedBytes),downloadedBytes,totalFiles:manifest.files.length,fileIndex:manifest.files.length});
}
async function showReadyAndRefresh(version){
 let totalBytes=Number(lastProgress?.totalBytes)||0,totalFiles=Number(lastProgress?.totalFiles)||0;
 try{
  const response=await fetch("/release-manifest.json?update="+encodeURIComponent(version),{cache:"no-store",credentials:"same-origin"});
  if(response.ok){
   const manifest=await response.json();
   if(String(manifest.buildId||"")===version){
    totalBytes=Number(manifest.totalBytes)||totalBytes;
    totalFiles=Array.isArray(manifest.files)?manifest.files.length:totalFiles;
   }
  }
 }catch{}
 setProgress({phase:"ready",totalBytes,downloadedBytes:totalBytes,totalFiles,fileIndex:totalFiles});
 window.setTimeout(()=>refreshToVersion(version),650);
}
async function startUpdate(version){
 if(updating||!currentNotice)return;
 updating=true;
 const ui=currentNotice;
 ui.button.disabled=true;
 ui.button.textContent="Mengunduh pembaruan…";
 ui.button.style.opacity=".7";
 ui.progress.hidden=false;
 ui.status.textContent="Menghubungi server pembaruan…";
 try{
  if("serviceWorker" in navigator){
   let controllerReadyResolve;
   const controllerReady=new Promise(resolve=>{controllerReadyResolve=resolve});
   const onControllerChange=async()=>{
    const activeVersion=await readWorkerVersion(navigator.serviceWorker.controller);
    if(activeVersion===version){navigator.serviceWorker.removeEventListener("controllerchange",onControllerChange);controllerReadyResolve(true)}
   };
   navigator.serviceWorker.addEventListener("controllerchange",onControllerChange);
   try{
    const registration=await navigator.serviceWorker.register("/sw.js?v="+encodeURIComponent(version),{updateViaCache:"none"});
    const existingVersion=await readWorkerVersion(navigator.serviceWorker.controller||registration.active);
    if(existingVersion===version){
     await showReadyAndRefresh(version);
     return;
    }
    await registration.update();
    if(registration.waiting)registration.waiting.postMessage({type:"ARYANZZ_SKIP_WAITING"});
    const installingWorker=registration.installing;
    if(installingWorker)installingWorker.addEventListener("statechange",()=>{
     if(installingWorker.state==="redundant")controllerReadyResolve(false);
    });
    let timeoutId=0;
    const timeoutPromise=new Promise(resolve=>{timeoutId=window.setTimeout(()=>resolve(false),90000)});
    const ready=await Promise.race([controllerReady,timeoutPromise]);
    window.clearTimeout(timeoutId);
    if(ready){
     await showReadyAndRefresh(version);
     return;
    }
    navigator.serviceWorker.removeEventListener("controllerchange",onControllerChange);
    throw new Error("Pemasangan service worker belum selesai. Coba ulangi saat koneksi stabil.");
   }catch(error){
    navigator.serviceWorker.removeEventListener("controllerchange",onControllerChange);
    throw error;
   }
  }
  await downloadWithProgress(version);
  window.setTimeout(()=>refreshToVersion(version),650);
 }catch(error){
  updating=false;
  ui.button.disabled=false;
  ui.button.textContent="Coba lagi";
  ui.button.style.opacity="1";
  ui.status.textContent=String(error?.message||"Pembaruan gagal. Periksa koneksi lalu coba lagi.");
 }
}
const autoAttemptKey="aryanzz:auto-update-attempted-build:v1";
function hasAutoAttempted(version){
 try{return sessionStorage.getItem(autoAttemptKey)===version}catch{return false}
}
function markAutoAttempted(version){
 try{sessionStorage.setItem(autoAttemptKey,version)}catch{}
}
async function checkVersion(autoUpdate=false){
 if(checking||updating)return;
 checking=true;
 try{
  const response=await fetch("/api/health?version_check="+Date.now(),{cache:"no-store",credentials:"same-origin",headers:{"cache-control":"no-cache","pragma":"no-cache"}});
  if(!response.ok)return;
  const data=await response.json();
  const latest=String(data?.buildId||"").trim();
  if(!/^\d+\.\d+\.\d+$/.test(latest))return;
  if(latest===localVersion){cleanUpdateParameters();return}
  if(readDismissedBuild()===latest){cleanUpdateParameters();return}
  if(currentNotice)currentNotice.version=latest;
  showNotice(latest);
  // A visitor arriving on an old cached page should not have to find and press
  // a hidden update button. Install the current release automatically once per
  // tab/build on initial load; later background checks only show the retry UI.
  if(autoUpdate&&!hasAutoAttempted(latest)&&currentNotice&&document.visibilityState!=="hidden"){
   markAutoAttempted(latest);
   messageUpdateStatus(latest);
   await startUpdate(latest);
  }
 }catch{}finally{checking=false}
}
function messageUpdateStatus(version){
 if(!currentNotice||currentNotice.version!==version)return;
 currentNotice.message.textContent="Versi lama terdeteksi. ARYANZZ sedang memperbarui file website ke build "+version+" secara otomatis.";
}
window.addEventListener("load",()=>checkVersion(true),{once:true});
window.addEventListener("focus",()=>checkVersion(false));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkVersion(false)});
window.setInterval(()=>checkVersion(false),90000);
})();