(()=>{"use strict";
const home=document.getElementById("home");
if(!home)return;
home.dataset.workspace="home";
const header=document.getElementById("homeBrandHeader");
const welcome=document.getElementById("v89Welcome");
const download=home.querySelector(".v674-download");
if(header&&header.parentElement!==home)home.insertBefore(header,home.firstChild);
if(welcome&&welcome.parentElement!==home)home.insertBefore(welcome,download||null);
const version=document.querySelector('meta[name="aryanzz-version"]')?.content||"";
const badge=document.getElementById("homeReleaseVersion");
if(badge&&version)badge.textContent="V"+version+" · GRATIS";
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

initSecurityIndicator();
})();