(()=>{"use strict";
const root=document.getElementById("toolsArea");const nav=document.querySelector(".nav");if(!root||!nav)return;
const money=n=>"Rp"+Number(n).toLocaleString("id-ID");
const profile=document.getElementById("profile");
const accountCard=profile?.querySelector(".ary-profile2-account");
if(accountCard&&!document.getElementById("aryRedeemProfile")){
 const redeem=document.createElement("div");
 redeem.id="aryRedeemProfile";
 redeem.className="ary-redeem-profile";
 redeem.innerHTML='<div class="ary-redeem-heading"><b>REDEEM & PRESTIGE</b><small>Masukkan kode hadiah eksklusif</small></div><div class="ary-redeem-form"><input id="aryRedeemCode" type="text" maxlength="40" autocomplete="off" placeholder="ARY-LEGEND-XXXXXXXXXXXX" aria-label="Kode redeem"><button id="aryRedeemSubmit" type="button">Klaim hadiah</button></div><p id="aryRedeemStatus" role="status" aria-live="polite">Hadiah Legendary tersedia selama 3 hari setelah kode berhasil digunakan.</p><div id="aryPrestigeActive" class="ary-prestige-active" hidden></div>';
 const note=accountCard.querySelector("#profileAccountNote");
 if(note)note.insertAdjacentElement("afterend",redeem);else accountCard.append(redeem);
}
let prestigeTimer=0,prestigeExpiry=0;
const prestigeEsc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function prestigeClock(){
 const el=document.getElementById("aryPrestigeActive");if(!el)return;
 const left=Math.max(0,prestigeExpiry-Date.now());
 if(!left){el.hidden=true;document.getElementById("profileAvatar")?.classList.remove("ary-legendary-frame");document.getElementById("profileBannerPreview")?.classList.remove("ary-legendary-banner");document.body.classList.remove("ary-legendary-background");clearInterval(prestigeTimer);prestigeTimer=0;return}
 const hours=Math.floor(left/3600000),minutes=Math.floor(left%3600000/60000),seconds=Math.floor(left%60000/1000);
 el.innerHTML='<b>✦ LEGENDARY DROP AKTIF</b><span>Berakhir dalam '+hours+'j '+minutes+'m '+seconds+'d</span>';
}
async function loadPrestige(){
 const status=document.getElementById("aryRedeemStatus"),active=document.getElementById("aryPrestigeActive");
 if(!active)return;
 try{
  const r=await fetch("/api/cosmetics/me",{credentials:"same-origin",cache:"no-store"}),d=await r.json();
  if(!r.ok||!d.ok){if(r.status===401)status.textContent="Login ke akun ARYANZZ untuk menggunakan kode redeem.";return}
  const frame=(d.items||[]).find(x=>x.cosmetic_id==="legendary-avatar-frame"&&x.equipped);
  const background=(d.items||[]).find(x=>x.cosmetic_id==="legendary-aurora-background"&&x.equipped);
  const avatar=document.getElementById("profileAvatar"),banner=document.getElementById("profileBannerPreview");
  avatar?.classList.toggle("ary-legendary-frame",!!frame);
  banner?.classList.toggle("ary-legendary-banner",!!background);
  document.body.classList.toggle("ary-legendary-background",!!background);
  const seedOf=value=>{let n=2166136261;for(const ch of String(value||"ARYANZZ")){n^=ch.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
  if(frame&&avatar){
   const seed=seedOf(frame.id),hue=seed%360,texture=seed%10,speed=(5+(seed%70)/10).toFixed(1)+"s";
   avatar.style.setProperty("--ary-legendary-hue",String(hue));
   avatar.style.setProperty("--ary-legendary-speed",speed);
   avatar.style.borderRadius=(20+seed%13)+"px";
   avatar.dataset.legendaryTexture=String(texture);
  }else if(avatar){avatar.style.removeProperty("--ary-legendary-hue");avatar.style.removeProperty("--ary-legendary-speed");delete avatar.dataset.legendaryTexture;avatar.style.removeProperty("border-radius")}
  if(background){
   const seed=seedOf(background.id);
   document.body.style.setProperty("--ary-legendary-hue",String(seed%360));
   document.body.dataset.legendaryTexture=String(seed%10);
  }else{document.body.style.removeProperty("--ary-legendary-hue");delete document.body.dataset.legendaryTexture}
  const expiries=[frame?.expires_at,background?.expires_at].filter(Boolean).map(Number);
  prestigeExpiry=expiries.length?Math.min(...expiries):0;
  active.hidden=!prestigeExpiry;
  clearInterval(prestigeTimer);prestigeClock();if(prestigeExpiry)prestigeTimer=setInterval(prestigeClock,1000);
 }catch{status.textContent="Status hadiah belum dapat dimuat. Coba muat ulang profil."}
}
document.getElementById("aryRedeemSubmit")?.addEventListener("click",async()=>{
 const input=document.getElementById("aryRedeemCode"),button=document.getElementById("aryRedeemSubmit"),status=document.getElementById("aryRedeemStatus");
 const code=String(input?.value||"").trim().toUpperCase();
 if(!code){status.textContent="Masukkan kode redeem terlebih dahulu.";return}
 button.disabled=true;button.textContent="Memeriksa…";
 try{
  const r=await fetch("/api/redeem/claim",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({code})});
  const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||"Kode redeem gagal digunakan.");
  status.textContent=d.message||"Hadiah berhasil diaktifkan.";
  input.value="";await loadPrestige();
 }catch(e){status.textContent=e.message||"Kode redeem tidak berhasil."}
 finally{button.disabled=false;button.textContent="Klaim hadiah"}
});
loadPrestige();

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let plans=[];
const panel=document.createElement("section");panel.id="aryMembershipPanel";panel.className="panel ary-membership";panel.hidden=true;
panel.innerHTML='<div class="ary-mem-head"><div><span class="ary-mem-eyebrow">ARYANZZ V1 · MEMBER CENTER</span><h2>Membership Center</h2><p>Pilih paket untuk mendukung pengembangan ARYANZZ. Free Member tetap tersedia.</p></div><div class="ary-mem-current" id="aryMemCurrent">Memeriksa akun…</div></div><div class="ary-mem-grid" id="aryMemPlans"></div><div class="ary-mem-history"><div class="ary-mem-history-head"><h3>Riwayat pesanan</h3><button type="button" id="aryMemRefresh">Muat ulang</button></div><div id="aryMemOrders">Login untuk melihat riwayat.</div></div><p class="ary-mem-note" id="aryMemNote" role="status">Pembayaran belum diaktifkan. Pesanan hanya dibuat sebagai draft sampai metode pembayaran dan penerima dana dikonfigurasi.</p><section class="ary-mem-admin" id="aryMemAdmin" hidden><h3>Owner · Kode redeem Legendary</h3><div class="ary-mem-admin-row"><label>Jumlah kode<input id="aryRedeemQuantity" type="number" min="1" max="100" value="10"></label><label>Kuota per kode<input id="aryRedeemMax" type="number" min="1" max="10000" value="1"></label><label>Kedaluwarsa kode (hari)<input id="aryRedeemExpiry" type="number" min="0" max="365" value="30"></label></div><button type="button" id="aryGenerateRedeemCodes">Buat kode redeem</button><textarea id="aryGeneratedRedeemCodes" rows="5" readonly placeholder="Kode yang dibuat akan muncul di sini. Simpan sekarang; kode hanya ditampilkan satu kali."></textarea></section>';
root.append(panel);
const button=document.createElement("button");button.type="button";button.dataset.panel=panel.id;button.textContent="Membership";button.className="ary-mem-nav";nav.append(button);
async function loadCatalog(){
 const note=document.getElementById("aryMemNote");
 try{
  const response=await fetch("/api/membership/catalog",{cache:"no-store",headers:{accept:"application/json"}});
  const data=await response.json();
  if(!response.ok||!data.ok||!Array.isArray(data.plans))throw Error(data.error||"Katalog Membership belum tersedia.");
  plans=data.plans.map(p=>({...p,term:p.durationDays===null?"Lifetime":p.durationDays+" hari",desc:p.summary||""}));
  if(note)note.textContent="Harga pada tujuh paket masih berupa rancangan dan belum final. Pembayaran belum dibuka; jangan melakukan transfer. Free Member tetap gratis.";
  renderPlans();
 }catch(error){if(note)note.textContent=error.message}
}
function renderPlans(){document.getElementById("aryMemPlans").innerHTML=plans.map((p,i)=>'<article class="ary-mem-card '+(i===2?"ary-mem-featured":"")+'"><div class="ary-mem-card-top"><span>'+String(i+1).padStart(2,"0")+' / MEMBERSHIP</span><b>'+esc(p.name)+'</b></div><div class="ary-mem-price">'+money(p.price)+'</div><div class="ary-mem-term">'+p.term+'</div><p>'+esc(p.desc)+'</p><button type="button" data-buy="'+p.id+'">Buat draft pesanan</button></article>').join("")}
async function load(){
 const current=document.getElementById("aryMemCurrent"),orders=document.getElementById("aryMemOrders"),note=document.getElementById("aryMemNote");
 try{const r=await fetch("/api/membership/me",{credentials:"same-origin",cache:"no-store"});const d=await r.json();
 if(r.status===401){current.textContent="Free Member · Login diperlukan";orders.textContent="Masuk ke akun ARYANZZ untuk melihat Membership dan pesanan.";return}
 if(!r.ok||!d.ok)throw Error(d.error||"Gagal memuat Membership.");
 const m=d.membership;current.innerHTML='<b>'+esc(m.planName||"Free Member")+'</b><small>'+esc(m.status==="active"?"Aktif":m.status==="expired"?"Kedaluwarsa":"Free Member")+(m.expiresAt?" · berakhir "+new Date(m.expiresAt).toLocaleDateString("id-ID"):"")+'</small>';
 const role=String(d.user?.role||"").toLowerCase();
 const adminPanel=document.getElementById("aryMemAdmin");
 if(adminPanel)adminPanel.hidden=!(d.user?.id==="ARY-ZFTLQPEX92"||["owner","admin","developer"].includes(role));
 orders.innerHTML=(d.orders||[]).length?(d.orders||[]).map(o=>'<div class="ary-mem-order"><div><b>'+esc(o.id)+'</b><small>'+esc(o.plan_id)+' · '+money(o.amount)+' · '+new Date(o.created_at).toLocaleString("id-ID")+'</small></div><span class="ary-mem-status">'+esc(o.status)+'</span></div>').join(""):"Belum ada pesanan.";
 }catch(e){current.textContent="Status belum tersedia";orders.textContent=e.message;note.textContent=e.message}
}
panel.addEventListener("click",async e=>{
 const buy=e.target.closest("[data-buy]");if(!buy)return;
 buy.disabled=true;const p=plans.find(x=>x.id===buy.dataset.buy);const note=document.getElementById("aryMemNote");
 try{const r=await fetch("/api/membership/orders",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({planId:p.id})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||"Pesanan gagal dibuat.");note.textContent="Pesanan "+d.order.id+" berhasil dibuat sebagai draft. Pembayaran belum tersedia; jangan transfer sebelum instruksi pembayaran resmi muncul.";await load()}
 catch(err){note.textContent=err.message}finally{buy.disabled=false}
});
document.getElementById("aryMemRefresh").addEventListener("click",load);
document.getElementById("aryGenerateRedeemCodes")?.addEventListener("click",async()=>{
 const button=document.getElementById("aryGenerateRedeemCodes"),output=document.getElementById("aryGeneratedRedeemCodes"),note=document.getElementById("aryMemNote");
 button.disabled=true;button.textContent="Membuat kode…";
 try{
  const payload={quantity:Number(document.getElementById("aryRedeemQuantity").value),maxRedemptions:Number(document.getElementById("aryRedeemMax").value),expiresInDays:Number(document.getElementById("aryRedeemExpiry").value),note:"Legendary avatar frame + animated background · 3 days after claim"};
  const r=await fetch("/api/membership/admin/redeem-codes",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||"Gagal membuat kode.");
  output.value=(d.codes||[]).join("\n");note.textContent="Berhasil membuat "+d.quantity+" kode. Salin dan simpan sekarang; kode lengkap hanya ditampilkan satu kali.";
 }catch(e){note.textContent=e.message||"Gagal membuat kode."}
 finally{button.disabled=false;button.textContent="Buat kode redeem"}
});
loadCatalog();load();
})();
