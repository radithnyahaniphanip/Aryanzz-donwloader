(()=>{"use strict";
const home=document.getElementById("home");
if(!home)return;
home.dataset.workspace="home";
const header=document.getElementById("homeBrandHeader");
const welcome=document.getElementById("v89Welcome");
const download=home.querySelector(".v674-download");
if(header&&header.parentElement!==home)home.insertBefore(header,home.firstChild);
if(welcome&&welcome.parentElement!==home)home.insertBefore(welcome,download||null);
const publicVersion=document.querySelector('meta[name="aryanzz-public-version"]')?.content||"V1";
const badge=document.getElementById("homeReleaseVersion");
if(badge)badge.textContent=publicVersion+" GRATIS";
async function initSecurityIndicator(){
 const el=document.getElementById("securityStatusIndicator");
 if(!el)return;
 const label=el.querySelector("span");
 const check=async()=>{
  try{
   const response=await fetch("/api/security/status",{headers:{accept:"application/json"},cache:"no-store"});
   const data=await response.json();
   const active=response.ok&&data?.security?.active===true;
   el.classList.toggle("is-active",active);
   el.classList.toggle("is-warning",!active);
   el.title=active?"Perlindungan edge aktif · pemeriksaan status berhasil":"Status perlindungan belum dapat diverifikasi";
   if(label)label.textContent=active?"Proteksi aktif":"Cek keamanan";
  }catch{
   el.classList.remove("is-active");
   el.classList.add("is-warning");
   el.title="Status perlindungan belum dapat diverifikasi";
   if(label)label.textContent="Cek keamanan";
  }
 };
 check();
 setInterval(check,60000);
}

function initHomeEntrance(){
 const word=home.querySelector(".v674-brand>span:last-child");
 if(word&&!word.querySelector(".ary-v1-brand-letters")){
  const textNode=Array.from(word.childNodes).find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());
  if(textNode){
   const letters=document.createElement("span");letters.className="ary-v1-brand-letters";
   letters.setAttribute("aria-label",textNode.textContent.trim());
   Array.from(textNode.textContent.trim()).forEach((letter,index)=>{
    const span=document.createElement("span");span.className="ary-v1-brand-letter";
    span.textContent=letter;span.setAttribute("aria-hidden","true");span.style.setProperty("--ary-letter-index",String(index));letters.append(span);
   });
   word.replaceChild(letters,textNode);
  }
 }
 const applyMotion=()=>{
  let saved="";try{saved=localStorage.getItem("aryanzz.motion.v75")||""}catch{}
  const prefersReduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
  document.documentElement.dataset.aryHomeMotion=saved==="off"||(!saved&&prefersReduced)?"off":"on";
 };
 applyMotion();
 window.addEventListener("aryanzz:motion-changed",applyMotion);
}
initHomeEntrance();

initSecurityIndicator();
})();