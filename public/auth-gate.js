(()=>{"use strict";
const $=id=>document.getElementById(id);
const gate=$("aryAuthGate");
const message=$("aryAuthMessage");
const say=(text,error=false)=>{if(message){message.textContent=text;message.classList.toggle("is-error",error)}};
async function api(path,body){
 const response=await fetch(path,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",headers:body?{"content-type":"application/json","accept":"application/json"}:{"accept":"application/json"},body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok===false)throw new Error(data.error||"Permintaan gagal. Coba lagi.");
 return data;
}
function mode(value){
 const register=value==="register";
 $("aryRegisterForm").hidden=!register;$("aryLoginForm").hidden=register;
 document.querySelectorAll("[data-auth-mode]").forEach(b=>b.classList.toggle("active",b.dataset.authMode===value));
 $("aryAuthTitle").textContent=register?"Buat akun ARYANZZ.":"Selamat datang kembali.";
 say("");
}
function togglePassword(inputId,buttonId){
 const input=$(inputId),button=$(buttonId);if(!input||!button)return;
 button.addEventListener("click",()=>{const visible=input.type==="password";input.type=visible?"text":"password";button.textContent=visible?"◌":"◉";button.setAttribute("aria-label",visible?"Sembunyikan password":"Lihat password");});
}
function strength(password){
 let score=0;
 if(password.length>=12)score++;
 if(password.length>=16)score++;
 if(/[a-z]/.test(password)&&/[A-Z]/.test(password))score++;
 if(/[0-9]/.test(password))score++;
 if(/[^A-Za-z0-9]/.test(password))score++;
 if(/(.)\1{3,}/.test(password)||/1234|abcd|qwerty|password/i.test(password))score=Math.max(0,score-2);
 return Math.min(4,score);
}
function initStrength(){
 const input=$("aryRegPassword"),bar=$("aryStrengthBar"),label=$("aryStrengthLabel");
 const names=["Lemah","Menengah","Kuat","Lebih kuat"],widths=["18%","42%","72%","100%"];
 input?.addEventListener("input",()=>{
  const s=strength(input.value),index=Math.max(0,s-1);
  if(bar){bar.style.width=input.value?widths[index]:"0%";bar.dataset.level=String(index+1)}
  if(label)label.textContent=input.value?"Kekuatan password: "+names[index]:"Kekuatan password: belum diisi";
 });
}
function setUser(user){
 window.aryanzzAuthUser=user||null;
 const node=$("profileRandomId"),copy=$("profileCopyId"),logout=$("accountLogout");
 if(user){
  if(node)node.textContent=user.id;
  if(copy){copy.onclick=async()=>{try{await navigator.clipboard.writeText(user.id);say("ID akun berhasil disalin.");}catch{say("Tidak dapat menyalin ID pada browser ini.",true)}}}
  if(logout)logout.hidden=false;
 }else{if(logout)logout.hidden=true;}
 if(gate)gate.hidden=!!user;
 document.body.classList.toggle("ary-authenticated",!!user);
}
async function submitForm(form,button,body,path){
 button.disabled=true;const old=button.textContent;button.textContent="Memproses…";
 try{const data=await api(path,body);setUser(data.user);say("Berhasil. Selamat menggunakan ARYANZZ.");}
 catch(error){say(error.message||"Terjadi kesalahan.",true);}
 finally{button.disabled=false;button.textContent=old;}
}
async function init(){
 if(!gate)return;
 togglePassword("aryRegPassword","aryRegEye");togglePassword("aryLoginPassword","aryLoginEye");initStrength();
 document.querySelectorAll("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>mode(b.dataset.authMode)));
 $("aryRegisterForm")?.addEventListener("submit",e=>{
  e.preventDefault();
  const fullName=$("aryRegName").value.trim(),email=$("aryRegEmail").value.trim(),password=$("aryRegPassword").value,redeemCode=$("aryRegRedeem").value.trim();
  if(password.length<12||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password)){say("Gunakan minimal 12 karakter yang memuat huruf besar, huruf kecil, angka, dan simbol.",true);return;}
  submitForm(e.currentTarget,$("aryRegisterSubmit"),{fullName,email,password,redeemCode},"/api/auth/register");
 });
 $("aryLoginForm")?.addEventListener("submit",e=>{e.preventDefault();submitForm(e.currentTarget,$("aryLoginSubmit"),{email:$("aryLoginEmail").value.trim(),password:$("aryLoginPassword").value},"/api/auth/login")});
 $("accountLogout")?.addEventListener("click",async()=>{try{await api("/api/auth/logout",{});setUser(null);mode("login");$("aryAuthGate").hidden=false;say("Kamu sudah keluar dari akun.");}catch(e){say(e.message,true)}});
 try{
  const config=await api("/api/auth/config");
  if(!config.enabled)return;
  const current=await api("/api/auth/me");
  if(current.user)setUser(current.user);
  else{mode("register");gate.hidden=false;}
 }catch(error){
  gate.hidden=false;mode("login");say("Layanan akun belum siap. Pastikan database D1 dan migrasi akun sudah aktif. "+error.message,true);
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();