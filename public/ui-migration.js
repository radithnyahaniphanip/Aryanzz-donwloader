/* ARYANZZ UI migration 2305 — remove stale PWA/service-worker assets once, without clearing user data. */
(()=>{"use strict";
const TARGET="2305",KEY="aryanzz-ui-migration";
async function purgeStaleRuntime(){
  try{
    if("serviceWorker" in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg=>reg.unregister().catch(()=>false)));
    }
  }catch{}
  try{
    if("caches" in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith("aryanzz-build-")||key.startsWith("aryanzz-ui-")).map(key=>caches.delete(key).catch(()=>false)));
    }
  }catch{}
}
async function run(){
  let done=false;
  try{done=localStorage.getItem(KEY)===TARGET}catch{}
  if(done)return;
  try{localStorage.setItem(KEY,TARGET)}catch{}
  await purgeStaleRuntime();
  try{sessionStorage.setItem("aryanzz-ui-migration-reloaded",TARGET)}catch{}
  const url=new URL(location.href);
  url.searchParams.set("ui",TARGET);
  url.searchParams.set("_fresh",Date.now().toString());
  location.replace(url.href);
}
run();
})();