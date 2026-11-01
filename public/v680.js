/* ARYANZZ V68.0 — local Gradient Studio and SHA file fingerprint */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const safeText=(id,value)=>{const el=$(id);if(el)el.textContent=value};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function gradientCss(){
 const type=$("gradientType")?.value||"linear";
 const angle=clamp(Number($("gradientAngle")?.value||135),0,360);
 const colors=[1,2,3].map(i=>$("gradientColor"+i)?.value||["#7557FF","#E96BB8","#FFC66E"][i-1]);
 return type==="radial"?`radial-gradient(circle at 50% 45%, ${colors.join(", ")})`:`linear-gradient(${angle}deg, ${colors.join(", ")})`;
}
function renderGradient(){
 const css=gradientCss(),preview=$("gradientPreview"),output=$("gradientCss"),angle=$("gradientAngle");
 if(preview)preview.style.background=css;
 if(output)output.value="background: "+css+";";
 safeText("gradientAngleText",(angle?.value||135)+"°");
}
async function copyText(value){
 try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);return true}}catch{}
 const area=document.createElement("textarea");area.value=value;area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();let ok=false;try{ok=document.execCommand("copy")}catch{}area.remove();return ok;
}
function gradientCanvas(ctx,width,height){
 const type=$("gradientType")?.value||"linear";
 const colors=[1,2,3].map(i=>$("gradientColor"+i)?.value||["#7557FF","#E96BB8","#FFC66E"][i-1]);
 let g;
 if(type==="radial"){g=ctx.createRadialGradient(width*.5,height*.45,0,width*.5,height*.45,Math.max(width,height)*.72)}
 else{const a=(Number($("gradientAngle")?.value||135)-90)*Math.PI/180,cx=width/2,cy=height/2,dx=Math.cos(a)*width/2,dy=Math.sin(a)*height/2;g=ctx.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy)}
 g.addColorStop(0,colors[0]);g.addColorStop(.5,colors[1]);g.addColorStop(1,colors[2]);return g;
}
function initGradient(){
 const ids=["gradientType","gradientAngle","gradientColor1","gradientColor2","gradientColor3"];
 ids.forEach(id=>$(id)?.addEventListener("input",renderGradient));
 $("gradientRandom")?.addEventListener("click",()=>{
  const sets=[["#7057FF","#E76CB8","#FFCA75"],["#0D9488","#4F46E5","#C084FC"],["#132A4A","#38BDF8","#D8F4FF"],["#5B2333","#C08457","#F2D6A2"],["#242038","#A78BFA","#F0ABFC"],["#064E3B","#84CC16","#FDE68A"]];
  const colors=sets[Math.floor(Math.random()*sets.length)];
  colors.forEach((color,i)=>{const input=$("gradientColor"+(i+1));if(input)input.value=color});renderGradient();safeText("gradientMessage","Palet baru berhasil dibuat.");
 });
 $("gradientCopy")?.addEventListener("click",async()=>safeText("gradientMessage",await copyText("background: "+gradientCss()+";")?"CSS berhasil disalin.":"Gagal menyalin CSS. Pilih teks lalu salin."));
 $("gradientPng")?.addEventListener("click",()=>{
  try{const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=900;const ctx=canvas.getContext("2d");ctx.fillStyle=gradientCanvas(ctx,canvas.width,canvas.height);ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(255,255,255,.9)";ctx.font="700 34px system-ui";ctx.textAlign="center";ctx.fillText("ARYANZZ GRADIENT",800,840);canvas.toBlob(blob=>{if(!blob){safeText("gradientMessage","Browser gagal membuat PNG.");return}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="aryanzz-gradient.png";a.click();URL.revokeObjectURL(url);safeText("gradientMessage","PNG berhasil diekspor · 1600 × 900.")},"image/png")}catch{safeText("gradientMessage","Ekspor PNG tidak didukung browser ini.")}
 });
 renderGradient();
}
function initHash(){
 const fileInput=$("hashFile"),compute=$("hashCompute"),copy=$("hashCopy"),output=$("hashOutput");
 if(!fileInput||!compute||!output)return;
 let selected=null;
 fileInput.addEventListener("change",()=>{
  selected=fileInput.files?.[0]||null;output.value="";if(copy)copy.disabled=true;
  safeText("hashFileDetails",selected?selected.name+" · "+(selected.size/1048576).toFixed(2)+" MB":"Belum ada file · maksimum 50 MB");
  compute.disabled=!selected||selected.size>50*1024*1024;
  safeText("hashStatus",!selected?"Pilih file untuk mulai.":selected.size>50*1024*1024?"File melebihi batas 50 MB.":"File siap dihitung secara lokal.");
 });
 compute.addEventListener("click",async()=>{
  if(!selected)return;
  if(!crypto?.subtle){safeText("hashStatus","Web Crypto tidak tersedia. Buka website melalui HTTPS.");return}
  compute.disabled=true;safeText("hashStatus","Menghitung fingerprint…");
  try{
   const algorithm=$("hashAlgorithm")?.value||"SHA-256";
   const digest=await crypto.subtle.digest(algorithm,await selected.arrayBuffer());
   output.value=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
   if(copy)copy.disabled=false;safeText("hashStatus",algorithm+" berhasil dihitung. File tidak diunggah.");
  }catch{safeText("hashStatus","Gagal menghitung hash. Coba file lain atau periksa dukungan browser.")}
  finally{compute.disabled=!selected||selected.size>50*1024*1024}
 });
 copy?.addEventListener("click",async()=>safeText("hashStatus",await copyText(output.value)?"Hash berhasil disalin.":"Gagal menyalin hash."));
}
function init(){initGradient();initHash()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
