(()=>{"use strict";
const meta=document.querySelector('meta[name="aryanzz-version"]');
const localVersion=String(meta?.content||"").trim();
const updateKey="aryanzz:auto-update-target";
let checking=false;
function showNotice(version){
 if(document.getElementById("aryanzzUpdateNotice"))return;
 const bar=document.createElement("div");bar.id="aryanzzUpdateNotice";bar.setAttribute("role","status");
 bar.style.cssText="position:fixed;z-index:99999;left:12px;right:12px;top:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #6f8dff;border-radius:14px;background:#101b32;color:#f4f7ff;box-shadow:0 12px 35px #0008;font:600 13px/1.4 system-ui,sans-serif";
 const message=document.createElement("span");message.textContent="ARYANZZ versi "+version+" sudah tersedia.";
 const button=document.createElement("button");button.type="button";button.textContent="Muat ulang";
 button.style.cssText="border:0;border-radius:10px;padding:9px 12px;background:linear-gradient(110deg,#9160ff,#328dff);color:white;font-weight:800;white-space:nowrap";
 button.addEventListener("click",()=>location.reload());bar.append(message,button);document.body.append(bar);
}
async function clearOldCaches(){
 if(!("caches" in window))return;
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith("aryanzz-build-")).map(key=>caches.delete(key)));
}
async function applyUpdate(version){
 let previous="";try{previous=sessionStorage.getItem(updateKey)||""}catch{}
 if(previous===version){showNotice(version);return}
 try{sessionStorage.setItem(updateKey,version)}catch{}
 try{if("serviceWorker" in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(reg=>reg.unregister()))}}catch{}
 try{await clearOldCaches()}catch{}
 const next=new URL(location.href);next.searchParams.set("aryanzz_update",version);location.replace(next.href);
}
async function checkVersion(){
 if(checking||!localVersion)return;checking=true;
 try{
  const response=await fetch("/api/health?version_check="+Date.now(),{cache:"no-store",credentials:"same-origin",headers:{"cache-control":"no-cache","pragma":"no-cache"}});
  if(!response.ok)return;const data=await response.json();const latest=String(data?.version||"").trim();if(!latest)return;
  let previous="";try{previous=sessionStorage.getItem(updateKey)||""}catch{}
  if(latest===localVersion){if(previous===latest){try{sessionStorage.removeItem(updateKey)}catch{}}return}
  await applyUpdate(latest);
 }catch{}finally{checking=false}
}
window.addEventListener("load",()=>checkVersion(),{once:true});
window.addEventListener("focus",()=>checkVersion());
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkVersion()});
window.setInterval(checkVersion,90000);
})();