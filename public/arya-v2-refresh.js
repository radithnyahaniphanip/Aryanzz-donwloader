/* ARYANZZ V2.1 — live release label and lightweight view reveals. */
(()=>{"use strict";
const body=document.body;
if(!body)return;
body.classList.add("arya-v2-enhanced");
body.dataset.aryaV2="on";
const badge=document.getElementById("homeReleaseVersion");
async function refreshReleaseBadge(){
 if(!badge)return;
 try{
  const response=await fetch("/release.json?ui="+Date.now(),{cache:"no-store",credentials:"same-origin",headers:{"cache-control":"no-cache","pragma":"no-cache"}});
  if(!response.ok)return;
  const release=await response.json();
  const build=String(release?.buildId||"").trim();
  if(!/^\d+\.\d+\.\d+$/.test(build))return;
  const shortBuild=build.split(".").pop();
  badge.textContent="BUILD "+shortBuild;
  badge.title="ARYANZZ "+String(release.publicVersion||"V2")+" GRATIS · Build "+build;
  badge.setAttribute("aria-label","Build aktif ARYANZZ "+build);
  badge.dataset.buildId=build;
 }catch{}
}
refreshReleaseBadge();
if("IntersectionObserver" in window){
 const selector="#home>.v89-welcome,#home>.v674-download,#home .home-shortcuts>.shortcut,#home .ary-seo-guides,#home .ary-android-home,#toolsArea #allTools .v674-tools-head,#toolsArea #allTools .tool,#profile .ary-profile2-card,#owner .ary-owner2-hero,#owner .ary-owner2-social-card";
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(!entry.isIntersecting)continue;
   entry.target.classList.add("arya-v2-in");
   entry.target.classList.remove("arya-v2-pending");
   observer.unobserve(entry.target);
  }
 },{root:null,rootMargin:"0px 0px -28px 0px",threshold:.035});
 const seen=new WeakSet();
 function observeNode(node){
  if(!(node instanceof Element)||seen.has(node)||!node.matches(selector))return;
  seen.add(node);
  node.classList.add("arya-v2-reveal","arya-v2-pending");
  observer.observe(node);
 }
 function scan(root){
  if(!(root instanceof Element||root===document))return;
  if(root instanceof Element)observeNode(root);
  root.querySelectorAll?.(selector).forEach(observeNode);
 }
 scan(document);
 let queued=false;
 const mutation=new MutationObserver(records=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{
   queued=false;
   for(const record of records)for(const node of record.addedNodes)scan(node);
  });
 });
 mutation.observe(document.body,{childList:true,subtree:true});
 document.addEventListener("click",event=>{
  if(!event.target.closest("[data-nav],[data-panel]"))return;
  requestAnimationFrame(()=>scan(document.getElementById("toolsArea")||document));
 });
}
const deviceCard=document.querySelector("#profile .ary-v1-device-studio");
if(deviceCard){
 const current=document.getElementById("deviceCurrent");
 if(current&&current.textContent.trim()!=="Membaca perangkat…")deviceCard.dataset.deviceDetection="ready";
 if(current&&"MutationObserver" in window){
  const deviceObserver=new MutationObserver(()=>{
   if(current.textContent.trim()&&current.textContent.trim()!=="Membaca perangkat…"){
    deviceCard.dataset.deviceDetection="ready";
    deviceObserver.disconnect();
   }
  });
  deviceObserver.observe(current,{childList:true,characterData:true,subtree:true});
 }
}
})();