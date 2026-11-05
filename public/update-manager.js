(()=>{"use strict";
const meta=document.querySelector('meta[name="aryanzz-version"]');
const localVersion=String(meta?.content||"").trim();
const updateKey="aryanzz:auto-update-target";
const maxAutoRefreshAttempts=3;
let checking=false;
function readUpdateState(){
 try{const value=JSON.parse(sessionStorage.getItem(updateKey)||"null");if(value&&typeof value==="object")return value;}catch{}
 return {version:"",attempts:0};
}
function writeUpdateState(value){try{sessionStorage.setItem(updateKey,JSON.stringify(value));return true;}catch{return false;}}
function clearUpdateState(){try{sessionStorage.removeItem(updateKey)}catch{}}
function hasStaleLocalAssetReferences(){
 if(!localVersion)return false;
 const assets=[...document.querySelectorAll("script[src],link[rel~='stylesheet'][href]")];
 return assets.some(node=>{
  const raw=node.getAttribute("src")||node.getAttribute("href")||"";
  try{
   const url=new URL(raw,location.href);
   if(url.origin!==location.origin||!/\.(?:js|css)$/i.test(url.pathname))return false;
   return url.searchParams.get("v")!==localVersion;
  }catch{return true}
 });
}
function hasLegacyProfileLayout(){
 const profile=document.getElementById("profile");
 const title=document.getElementById("ownerDeveloperBadge");
 const titleStack=title?.parentElement?.classList.contains("owner-identity-titles");
 const creator=title?.parentElement?.querySelector(".owner-creator-title");
 return !title||!!(profile&&profile.querySelector(".ary-theme-studio,[data-theme-studio],.v25-backup-card,#exportData,#importData,#restoreAutoBackup,#ownerLinkEditor,#securityCenter,#profileDeveloperBadge,[data-panel=colorStudio],[data-panel=mediaStudio]"))||!!(title&&!titleStack)||!!(title&&!creator);
}
function showNotice(version){
 if(document.getElementById("aryanzzUpdateNotice"))return;
 const bar=document.createElement("div");bar.id="aryanzzUpdateNotice";bar.setAttribute("role","status");bar.setAttribute("aria-live","polite");
 bar.style.cssText="position:fixed;z-index:99999;left:12px;right:12px;top:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #6f8dff;border-radius:14px;background:#101b32;color:#f4f7ff;box-shadow:0 12px 35px #0008;font:600 13px/1.4 system-ui,sans-serif";
 const message=document.createElement("span");message.textContent="Versi terbaru V"+version+" sudah tersedia, tetapi browser masih membuka build lama.";
 const button=document.createElement("button");button.type="button";button.textContent="Muat versi terbaru";
 button.style.cssText="border:0;border-radius:10px;padding:9px 12px;background:linear-gradient(110deg,#9160ff,#328dff);color:white;font-weight:800;white-space:nowrap";
 button.addEventListener("click",()=>{
  const retry=new URL(location.href);
  retry.searchParams.set("aryanzz_update",version);
  retry.searchParams.set("aryanzz_attempt","0");
  retry.searchParams.set("aryanzz_refresh",String(Date.now()));
  location.replace(retry.href);
 });
 bar.append(message,button);document.body.append(bar);
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
async function applyUpdate(version){
 const previous=readUpdateState();
 const state=previous.version===version?previous:{version,attempts:0};
 const currentUrl=new URL(location.href);
 const urlVersion=currentUrl.searchParams.get("aryanzz_update")||"";
 const urlAttempts=urlVersion===version?Number(currentUrl.searchParams.get("aryanzz_attempt")||0):0;
 const attemptsSoFar=Math.max(Number(state.attempts||0),Number.isSafeInteger(urlAttempts)&&urlAttempts>0?urlAttempts:0);
 if(attemptsSoFar>=maxAutoRefreshAttempts){showNotice(version);return}
 const attempts=attemptsSoFar+1;
 writeUpdateState({version,attempts});
 try{await unregisterServiceWorkers()}catch{}
 try{await clearOldCaches()}catch{}
 const next=new URL(location.href);
 next.searchParams.set("aryanzz_update",version);
 next.searchParams.set("aryanzz_attempt",String(attempts));
 next.searchParams.set("aryanzz_refresh",String(Date.now()));
 location.replace(next.href);
}
async function checkVersion(){
 if(checking)return;
 checking=true;
 try{
  const response=await fetch("/api/health?version_check="+Date.now(),{cache:"no-store",credentials:"same-origin",headers:{"cache-control":"no-cache","pragma":"no-cache"}});
  if(!response.ok)return;
  const data=await response.json();
  const latest=String(data?.version||"").trim();
  if(!/^\d+\.\d+\.\d+$/.test(latest))return;
  if(latest===localVersion){
   if(hasStaleLocalAssetReferences()||hasLegacyProfileLayout()){
    await applyUpdate(latest);
    return;
   }
   const state=readUpdateState();
   if(state.version===latest)clearUpdateState();
   const current=new URL(location.href);
   if(current.searchParams.has("aryanzz_update")||current.searchParams.has("aryanzz_refresh")||current.searchParams.has("aryanzz_attempt")){
    current.searchParams.delete("aryanzz_update");current.searchParams.delete("aryanzz_refresh");current.searchParams.delete("aryanzz_attempt");
    history.replaceState(null,"",current.pathname+current.search+current.hash);
   }
   return;
  }
  await applyUpdate(latest);
 }catch{}finally{checking=false}
}
window.addEventListener("load",()=>checkVersion(),{once:true});
window.addEventListener("focus",()=>checkVersion());
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkVersion()});
window.setInterval(checkVersion,90000);
})();