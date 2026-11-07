(()=>{"use strict";
const meta=document.querySelector('meta[name="aryanzz-build-id"]');
const localVersion=String(meta?.content||"").trim();
const dismissedKey="aryanzz:update-dismissed-build:v1";
let checking=false;
function readDismissedBuild(){
 try{return String(localStorage.getItem(dismissedKey)||"")}catch{}
 try{
  const match=document.cookie.match(/(?:^|;\s*)aryanzz_update_dismissed=([^;]*)/);
  return match?decodeURIComponent(match[1]):"";
 }catch{return ""}
}
function rememberDismissedBuild(version){
 let stored=false;
 try{localStorage.setItem(dismissedKey,version);stored=localStorage.getItem(dismissedKey)===version}catch{}
 if(!stored){
  try{document.cookie="aryanzz_update_dismissed="+encodeURIComponent(version)+"; Max-Age=63072000; Path=/; Secure; SameSite=Lax"}catch{}
 }
 return stored;
}
function showNotice(version){
 if(!version||readDismissedBuild()===version||document.getElementById("aryanzzUpdateNotice"))return;
 const bar=document.createElement("div");
 bar.id="aryanzzUpdateNotice";
 bar.setAttribute("role","status");
 bar.setAttribute("aria-live","polite");
 bar.style.cssText="position:fixed;z-index:99999;left:12px;right:12px;top:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #6f8dff;border-radius:14px;background:#101b32;color:#f4f7ff;box-shadow:0 12px 35px #0008;font:600 13px/1.4 system-ui,sans-serif";
 const message=document.createElement("span");
 message.textContent="Pembaruan ARYANZZ V1 sudah tersedia. Muat ulang untuk menggunakan perbaikan terbaru.";
 const button=document.createElement("button");
 button.type="button";
 button.textContent="Muat versi terbaru";
 button.style.cssText="border:0;border-radius:10px;padding:9px 12px;background:linear-gradient(110deg,#9160ff,#328dff);color:white;font-weight:800;white-space:nowrap";
 button.addEventListener("click",async()=>{
  button.disabled=true;
  button.textContent="Memuat…";
  rememberDismissedBuild(version);
  try{await unregisterServiceWorkers()}catch{}
  try{await clearOldCaches()}catch{}
  const next=new URL(location.href);
  next.searchParams.delete("aryanzz_update");
  next.searchParams.delete("aryanzz_attempt");
  next.searchParams.delete("aryanzz_refresh");
  next.searchParams.set("aryanzz_refresh",String(Date.now()));
  location.replace(next.href);
 });
 bar.append(message,button);
 document.body.append(bar);
}
async function clearOldCaches(){
 if(!("caches" in window))return;
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith("aryanzz-build-")).map(key=>caches.delete(key)));
}
async function unregisterServiceWorkers(){
 if(!("serviceWorker" in navigator))return;
 const registrations=await navigator.serviceWorker.getRegistrations();
 await Promise.all(registrations.map(registration=>registration.unregister()));
}
function cleanUpdateParameters(){
 const current=new URL(location.href);
 let changed=false;
 for(const key of ["aryanzz_update","aryanzz_attempt","aryanzz_refresh"]){
  if(current.searchParams.has(key)){current.searchParams.delete(key);changed=true}
 }
 if(changed)history.replaceState(null,"",current.pathname+current.search+current.hash);
}
async function checkVersion(){
 if(checking)return;
 checking=true;
 try{
  const response=await fetch("/api/health?version_check="+Date.now(),{
   cache:"no-store",
   credentials:"same-origin",
   headers:{"cache-control":"no-cache","pragma":"no-cache"}
  });
  if(!response.ok)return;
  const data=await response.json();
  const latest=String(data?.buildId||"").trim();
  if(!/^\d+\.\d+\.\d+$/.test(latest))return;
  if(latest===localVersion){
   cleanUpdateParameters();
   return;
  }
  if(readDismissedBuild()===latest){
   cleanUpdateParameters();
   return;
  }
  showNotice(latest);
 }catch{}finally{checking=false}
}
window.addEventListener("load",()=>checkVersion(),{once:true});
window.addEventListener("focus",()=>checkVersion());
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkVersion()});
window.setInterval(checkVersion,90000);
})();