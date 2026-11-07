(()=>{"use strict";
const root=document.getElementById("toolsArea");const nav=document.querySelector(".nav");if(!root||!nav)return;
const money=n=>"Rp"+Number(n).toLocaleString("id-ID");
const profile=document.getElementById("profile");
const accountCard=profile?.querySelector(".ary-profile2-account");
if(accountCard&&!document.getElementById("aryRedeemProfile")){
 const redeem=document.createElement("div");
 redeem.id="aryRedeemProfile";
 redeem.className="ary-redeem-profile";
 redeem.innerHTML='<div class="ary-redeem-heading"><b>REDEEM & PRESTIGE</b><small>Masukkan kode hadiah eksklusif</small></div><div class="ary-redeem-form"><input id="aryRedeemCode" type="text" maxlength="40" autocomplete="off" placeholder="ARY-LEGEND-XXXXXXXXXXXX" aria-label="Kode redeem"><button id="aryRedeemSubmit" type="button">Klaim hadiah</button></div><p id="aryRedeemStatus" role="status" aria-live="polite">Klaim hadiah hanya tersedia selama 3 hari pertama setelah akun dibuat.</p><div id="aryPrestigeActive" class="ary-prestige-active" hidden></div>';
 const note=accountCard.querySelector("#profileAccountNote");
 if(note)note.insertAdjacentElement("afterend",redeem);else accountCard.append(redeem);
}
let prestigeTimer=0,prestigeExpiry=0,redeemWindowTimer=0,redeemWindowExpiry=0;
const prestigeEsc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function updateRedeemWindow(){
 const form=document.querySelector("#aryRedeemProfile .ary-redeem-form"),status=document.getElementById("aryRedeemStatus");
 const left=Math.max(0,redeemWindowExpiry-Date.now());
 if(!left){if(form)form.hidden=true;if(status&&status.textContent.includes("Klaim satu kali"))status.textContent="Masa klaim 3 hari pertama sudah berakhir. Kolom redeem telah ditutup.";clearInterval(redeemWindowTimer);redeemWindowTimer=0;return}
 const days=Math.floor(left/86400000),hours=Math.floor(left%86400000/3600000),minutes=Math.floor(left%3600000/60000),seconds=Math.floor(left%60000/1000);
 if(status&&status.textContent.includes("Klaim satu kali"))status.textContent="Sisa waktu klaim: "+days+" hari "+hours+"j "+minutes+"m "+seconds+"d. Setelah habis, kolom redeem hilang otomatis.";
}
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
  const redeemForm=document.querySelector("#aryRedeemProfile .ary-redeem-form");
  if(redeemForm)redeemForm.hidden=!d.redeemAvailable;
  if(d.redeemed)status.textContent="Kode sudah digunakan. Border avatar dan background Legendary tersimpan permanen di koleksi akun ini.";
  else if(d.redeemAvailable)status.textContent="Klaim satu kali dalam 3 hari pertama setelah akun dibuat. Setelah batas waktu, kolom redeem akan hilang otomatis.";
  else status.textContent="Masa klaim 3 hari pertama sudah berakhir. Kolom redeem telah ditutup.";
  redeemWindowExpiry=Number(d.redeemWindowExpiresAt||0);
  clearInterval(redeemWindowTimer);updateRedeemWindow();if(d.redeemAvailable)redeemWindowTimer=setInterval(updateRedeemWindow,1000);
  const avatar=document.getElementById("profileAvatar"),banner=document.getElementById("profileBannerPreview");
  avatar?.classList.toggle("ary-legendary-frame",!!frame);
  banner?.classList.toggle("ary-legendary-banner",!!background);
  const previewAvatar=document.getElementById("aryCosmeticPreviewAvatar");previewAvatar?.classList.toggle("ary-legendary-frame",!!frame);
  if(banner){if(background)banner.style.backgroundImage="radial-gradient(ellipse at 15% 85%,#a76cff88,transparent 50%),radial-gradient(ellipse at 80% 15%,#3ad9e888,transparent 45%),linear-gradient(135deg,#091326,#182c54)";else banner.style.removeProperty("background-image")}
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
  const hasPermanentPrestige=!!(frame||background);
  prestigeExpiry=0;
  active.hidden=!hasPermanentPrestige;
  clearInterval(prestigeTimer);
  if(hasPermanentPrestige)active.innerHTML="<b>✦ LEGENDARY COLLECTION</b><span>Dimiliki permanen · khusus akun ini</span>";
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
panel.innerHTML='<div class="ary-mem-head"><div><span class="ary-mem-eyebrow">ARYANZZ V1 · MEMBER CENTER</span><h2>Membership Center</h2><p>Pilih paket Membership, lanjutkan ke checkout Poketo, lalu bayar dengan metode yang tersedia di akunmu.</p></div><div class="ary-mem-current" id="aryMemCurrent">Memeriksa akun…</div></div><div class="ary-mem-grid" id="aryMemPlans"></div><section class="ary-mem-payment" id="aryMemPayment"><div><span class="ary-mem-eyebrow">CHECKOUT PEMBAYARAN</span><h3>Poketo Payment</h3><p id="aryMemPaymentNote">Memeriksa koneksi Poketo…</p><div class="ary-mem-methods" id="aryMemMethods"><span>Metode pembayaran dimuat saat checkout.</span></div></div><div class="ary-mem-secure-mark">🔒<b>Checkout aman</b><small>Pembayaran diproses di halaman resmi Poketo. ARYANZZ tidak meminta PIN, OTP, atau password e-wallet.</small></div></section><div class="ary-mem-history"><div class="ary-mem-history-head"><h3>Riwayat pesanan</h3><button type="button" id="aryMemRefresh">Muat ulang</button></div><div id="aryMemOrders">Login untuk melihat riwayat.</div></div><p class="ary-mem-note" id="aryMemNote" role="status">Harga paket merupakan rancangan. Pembayaran hanya dapat dilakukan setelah QRIS merchant resmi dikonfigurasi.</p><section class="ary-mem-admin" id="aryMemAdmin" hidden><div class="ary-mem-admin-orders"><div class="ary-mem-history-head"><h3>Owner · Verifikasi pembayaran QRIS</h3><button type="button" id="aryMemAdminRefresh">Muat ulang pesanan</button></div><p class="ary-mem-note">Status pembayaran diperbarui otomatis dari webhook Poketo yang tanda tangannya diverifikasi server. Tidak ada aktivasi manual dari browser.</p><div id="aryMemAdminOrders">Memuat pesanan…</div></div><h3>Owner · Kode redeem Legendary</h3><div class="ary-mem-admin-row"><label>Jumlah kode<input id="aryRedeemQuantity" type="number" min="1" max="100" value="10"></label><label>Kuota per kode<input id="aryRedeemMax" type="number" min="1" max="10000" value="1"></label><label>Kedaluwarsa kode (hari)<input id="aryRedeemExpiry" type="number" min="0" max="365" value="30"></label></div><button type="button" id="aryGenerateRedeemCodes">Buat kode redeem</button><textarea id="aryGeneratedRedeemCodes" rows="5" readonly placeholder="Kode yang dibuat akan muncul di sini. Simpan sekarang; kode hanya ditampilkan satu kali."></textarea></section>'
root.append(panel);
const button=document.createElement("button");button.type="button";button.dataset.nav="membership";button.innerHTML='<span class="ary-mem-nav-logo" aria-hidden="true">✦</span><span class="ary-mem-nav-label">Membership</span>';button.className="ary-mem-nav";nav.insertBefore(button,nav.children[2]||null);
let paymentConfig={enabled:false,checkoutEnabled:false,provider:"Poketo",mode:"sandbox"};
async function loadCatalog(){
 const note=document.getElementById("aryMemNote"),paymentNote=document.getElementById("aryMemPaymentNote"),qris=document.getElementById("aryMemQris");
 try{
  const [catalogResponse,paymentResponse]=await Promise.all([fetch("/api/membership/catalog",{cache:"no-store"}),fetch("/api/membership/payment-config",{cache:"no-store"})]);
  const data=await catalogResponse.json(),payment=await paymentResponse.json();
  if(!catalogResponse.ok||!data.ok||!Array.isArray(data.plans))throw Error(data.error||"Katalog Membership belum tersedia.");
  paymentConfig={enabled:!!payment.enabled,checkoutEnabled:!!payment.checkoutEnabled,provider:String(payment.provider||"Poketo"),mode:String(payment.mode||"sandbox"),automaticWebhookReady:!!payment.automaticWebhookReady};
  plans=data.plans.map(p=>({...p,term:p.durationDays===null?"Permanen":p.durationDays+" hari",desc:p.summary||""}));
  const methodHost=document.getElementById("aryMemMethods");
  if(methodHost&&paymentConfig.enabled){
   try{
    const mr=await fetch("/api/membership/payment-methods?amount=80000",{cache:"no-store"}),md=await mr.json();
    const raw=md.methods,items=Array.isArray(raw)?raw:(Array.isArray(raw?.methods)?raw.methods:(Array.isArray(md.data)?md.data:[]));
    const available=items.filter(x=>x&&(x.available!==false)&&(x.enabled!==false));
    methodHost.innerHTML=available.length?available.map(x=>'<span class="ary-mem-method-chip">'+esc(x.name||x.label||x.code||x.id||"Pembayaran")+'</span>').join(""):'<span>Metode pembayaran akan ditampilkan pada checkout Poketo.</span>';
   }catch{methodHost.textContent="Pilihan metode pembayaran akan muncul di halaman checkout Poketo."}
  }
  if(paymentNote)paymentNote.textContent=!paymentConfig.checkoutEnabled?"Database akun ARYANZZ belum aktif.":(!paymentConfig.enabled?"API key Poketo belum dipasang.":(paymentConfig.automaticWebhookReady?"Terhubung ke Poketo · mode "+paymentConfig.mode+". Pilih metode pembayaran pada halaman checkout resmi.":"API key tersedia, tetapi webhook signing secret belum dikonfigurasi."));
  if(qris)qris.innerHTML="";
  if(qris)qris.hidden=true;
  if(note)note.textContent="Pembayaran dilakukan melalui checkout resmi Poketo. Membership hanya aktif setelah invoice berstatus paid dan webhook berhasil diverifikasi server.";
  renderPlans();
 }catch(error){if(note)note.textContent=error.message;if(paymentNote)paymentNote.textContent=error.message}
}
function renderPlans(){
 const host=document.getElementById("aryMemPlans");
 host.innerHTML=plans.map((p,i)=>'<article class="ary-mem-card '+(i===2?"ary-mem-featured":"")+'"><div class="ary-mem-card-top"><span>'+String(i+1).padStart(2,"0")+' / MEMBERSHIP</span><b>'+esc(p.name)+'</b></div><div class="ary-mem-price">'+money(p.price)+'</div><div class="ary-mem-term">'+p.term+'</div><p>'+esc(p.desc)+'</p><button type="button" data-buy="'+esc(p.id)+'" '+(paymentConfig.checkoutEnabled&&paymentConfig.enabled?"":"disabled")+'>'+(paymentConfig.checkoutEnabled&&paymentConfig.enabled?"Bayar sekarang":"Pembayaran belum tersedia")+'</button></article>').join("")
}
async function loadAdminOrders(){
 const host=document.getElementById("aryMemAdminOrders");if(!host)return;
 host.textContent="Memuat pesanan…";
 try{
  const r=await fetch("/api/membership/admin/orders",{credentials:"same-origin",cache:"no-store"}),d=await r.json();
  if(!r.ok||!d.ok)throw Error(d.error||"Gagal memuat pesanan.");
  const rows=d.orders||[];
  host.innerHTML=rows.length?rows.map(o=>'<article class="ary-mem-admin-order"><div class="ary-mem-admin-order-meta"><b>'+esc(o.id)+'</b><small>'+esc(o.full_name||o.email||o.user_id)+' · '+esc(o.plan_id)+' · '+money(o.amount)+'</small><small>'+new Date(o.created_at).toLocaleString("id-ID")+' · '+esc(o.payment_provider)+' · '+esc(o.status)+'</small>'+(o.note?'<small>'+esc(o.note)+'</small>':'')+'</div>'+(o.status==="pending"?'<div class="ary-mem-admin-order-actions"><button type="button" data-review-order="'+esc(o.id)+'" data-decision="approve">Verifikasi & aktifkan</button><button type="button" data-review-order="'+esc(o.id)+'" data-decision="reject">Tolak</button></div>':'')+'</article>').join(""):"Belum ada pesanan.";
 }catch(error){host.textContent=error.message||"Daftar pesanan belum tersedia."}
}
async function load(){
 const current=document.getElementById("aryMemCurrent"),orders=document.getElementById("aryMemOrders"),note=document.getElementById("aryMemNote");
 try{const r=await fetch("/api/membership/me",{credentials:"same-origin",cache:"no-store"});const d=await r.json();
 if(r.status===401){current.textContent="Free Member · Login diperlukan";orders.textContent="Masuk ke akun ARYANZZ untuk melihat Membership dan pesanan.";return}
 if(!r.ok||!d.ok)throw Error(d.error||"Gagal memuat Membership.");
 const m=d.membership;current.innerHTML='<b>'+esc(m.planName||"Free Member")+'</b><small>'+esc(m.status==="active"?"Aktif":m.status==="expired"?"Kedaluwarsa":"Free Member")+(m.expiresAt?" · berakhir "+new Date(m.expiresAt).toLocaleDateString("id-ID"):"")+'</small>';
 const role=String(d.user?.role||"").toLowerCase();
 const adminPanel=document.getElementById("aryMemAdmin");
 const isAdmin=d.user?.id==="ARY-ZFTLQPEX92"||["owner","admin","developer"].includes(role);
 if(adminPanel)adminPanel.hidden=!isAdmin;
 if(isAdmin)loadAdminOrders();
 orders.innerHTML=(d.orders||[]).length?(d.orders||[]).map(o=>'<div class="ary-mem-order"><div><b>'+esc(o.id)+'</b><small>'+esc(o.plan_id)+' · '+money(o.amount)+' · '+new Date(o.created_at).toLocaleString("id-ID")+'</small></div><span class="ary-mem-status">'+esc(o.status)+'</span></div>').join(""):"Belum ada pesanan.";syncMembershipPolling();
 }catch(e){current.textContent="Status belum tersedia";orders.textContent=e.message;note.textContent=e.message}
}
panel.addEventListener("click",async e=>{
 if(e.target.closest("#aryMemAdminRefresh")){loadAdminOrders();return}
 const review=e.target.closest("[data-review-order]");
 if(review){
  const orderId=review.dataset.reviewOrder,decision=review.dataset.decision;
  const promptText="Tindakan manual dinonaktifkan. Status pembayaran Membership diproses otomatis oleh webhook Poketo.";
  if(!window.confirm(promptText))return;return;
  review.disabled=true;
  try{
   const note=decision==="approve"?"Dana masuk telah dicocokkan pada GoPay Merchant.":(window.prompt("Alasan penolakan (opsional):")||"Pembayaran tidak ditemukan atau nominal tidak cocok.");
   const response=await fetch("/api/membership/admin/review",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({orderId,decision,paymentVerified:decision==="approve",note})});
   const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||"Verifikasi gagal.");
   document.getElementById("aryMemNote").textContent=result.message||"Status pesanan diperbarui.";
   await load();await loadAdminOrders();
  }catch(error){document.getElementById("aryMemNote").textContent=error.message||"Verifikasi gagal."}
  finally{review.disabled=false}
  return;
 }
 const buy=e.target.closest("[data-buy]");if(!buy)return;
 buy.disabled=true;const p=plans.find(x=>x.id===buy.dataset.buy);const note=document.getElementById("aryMemNote");
 try{if(!paymentConfig.checkoutEnabled||!paymentConfig.enabled)throw Error("Pembayaran Poketo belum dikonfigurasi atau database akun belum aktif.");const r=await fetch("/api/membership/orders",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({planId:p.id,paymentProvider:"poketo"})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||"Invoice gagal dibuat.");if(!d.payment?.paymentUrl)throw Error("Link checkout Poketo tidak tersedia.");note.textContent="Invoice "+d.order.id+" berhasil dibuat. Mengarahkan ke checkout Poketo…";await load();window.location.assign(d.payment.paymentUrl)}
 catch(err){note.textContent=err.message}finally{buy.disabled=false}
});
document.getElementById("aryMemRefresh").addEventListener("click",load);
let membershipPoll=null;
function syncMembershipPolling(){const hasPending=[...document.querySelectorAll("#aryMemOrders .ary-mem-status")].some(el=>el.textContent.trim()==="pending");if(hasPending&&!membershipPoll)membershipPoll=setInterval(()=>{if(!document.hidden&&!panel.hidden)load()},12000);if(!hasPending&&membershipPoll){clearInterval(membershipPoll);membershipPoll=null}}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!panel.hidden)load()});
document.getElementById("aryMemAdminRefresh")?.addEventListener("click",loadAdminOrders);
document.addEventListener("click",event=>{
 const navItem=event.target.closest("[data-nav]");
 if(!navItem)return;
 if(navItem.dataset.nav==="membership"){load();loadCatalog()}
 if(navItem.dataset.nav==="profile")loadPrestige();
});

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
const toolGrid=document.getElementById("toolGrid");
const cosmeticsPanel=document.createElement("section");
cosmeticsPanel.id="aryCosmeticsStudio";cosmeticsPanel.className="panel card ary-cosmetics-studio";cosmeticsPanel.hidden=true;
cosmeticsPanel.innerHTML='<div class="ary-mem-eyebrow">ARYANZZ CREATIVE LAB · PERSONALIZATION</div><h2>Avatar & Background Studio</h2><p class="ary-cosmetics-intro">Kelola koleksi avatar frame dan latar profil. Efek kosmetik hanya diterapkan pada akun yang memilikinya.</p><div class="ary-cosmetics-preview"><div class="ary-cosmetics-avatar" id="aryCosmeticPreviewAvatar">A</div><div><b id="aryCosmeticPreviewName">Profile Preview</b><small id="aryCosmeticPreviewTier">Pilih koleksi untuk melihat efek</small></div></div><div class="ary-cosmetics-section"><h3>Avatar Frame</h3><div class="ary-cosmetics-grid" id="aryAvatarCosmetics"></div></div><div class="ary-cosmetics-section"><h3>Profile Background</h3><div class="ary-cosmetics-grid" id="aryBackgroundCosmetics"></div></div><p class="ary-cosmetics-status" id="aryCosmeticsStatus" role="status">Memuat koleksi akun…</p></section>';
root.append(cosmeticsPanel);
if(toolGrid&&!toolGrid.querySelector('[data-panel="aryCosmeticsStudio"]')){
 const card=document.createElement("button");card.type="button";card.className="tool";card.dataset.panel="aryCosmeticsStudio";card.dataset.category="personal";card.innerHTML='<div class="ico">✧</div><b>Avatar & Background Studio</b><small>Pasang, ganti, dan kelola kosmetik profil eksklusif.</small><span class="v674-tool-category">PERSONALIZATION</span>';toolGrid.insertBefore(card,toolGrid.firstChild);
}
const LOCAL_COSMETICS_KEY="aryanzz.cosmetics.local.v1";
const LOCAL_COSMETIC_CATALOG=[
 {cosmetic_id:"local-frame-aurora",kind:"avatar",name:"Aurora Prism",description:"Bingkai prisma berlapis dengan kilau aurora.",art:"frame-art local-art-aurora"},
 {cosmetic_id:"local-frame-royal",kind:"avatar",name:"Royal Ember",description:"Tekstur mahkota dan bara merah keemasan.",art:"frame-art local-art-royal"},
 {cosmetic_id:"local-frame-nebula",kind:"avatar",name:"Nebula Core",description:"Efek kosmik ungu-biru dengan orbit bercahaya.",art:"frame-art local-art-nebula"},
 {cosmetic_id:"local-frame-obsidian",kind:"avatar",name:"Obsidian Luxe",description:"Lapisan obsidian gelap dengan aksen metalik.",art:"frame-art local-art-obsidian"},
 {cosmetic_id:"local-bg-aurora",kind:"background",name:"Aurora Sanctuary",description:"Latar aurora bergerak dengan gradasi cyan dan violet.",art:"background-art local-art-aurora"},
 {cosmetic_id:"local-bg-crimson",kind:"background",name:"Crimson Dynasty",description:"Latar merah gelap dengan semburat emas.",art:"background-art local-art-crimson"},
 {cosmetic_id:"local-bg-nebula",kind:"background",name:"Nebula Drift",description:"Latar galaksi dengan cahaya nebula berlapis.",art:"background-art local-art-nebula"},
 {cosmetic_id:"local-bg-midnight",kind:"background",name:"Midnight Sapphire",description:"Latar safir malam dengan partikel cahaya.",art:"background-art local-art-midnight"}
];
function readLocalCosmetics(){try{return JSON.parse(localStorage.getItem(LOCAL_COSMETICS_KEY)||"{}")||{}}catch{return {}}}
function applyLocalCosmetics(){
 const selected=readLocalCosmetics(),avatar=document.getElementById("profileAvatar"),banner=document.getElementById("profileBannerPreview"),preview=document.getElementById("aryCosmeticPreviewAvatar");
 const frame=LOCAL_COSMETIC_CATALOG.find(x=>x.cosmetic_id===selected.avatar),background=LOCAL_COSMETIC_CATALOG.find(x=>x.cosmetic_id===selected.background);
 const frameTargets=[avatar,preview].filter(Boolean);
 frameTargets.forEach(el=>{el.classList.remove("ary-local-frame-aurora","ary-local-frame-royal","ary-local-frame-nebula","ary-local-frame-obsidian");if(frame)el.classList.add("ary-local-frame-"+frame.cosmetic_id.replace("local-frame-",""));});
 document.body.classList.remove("ary-local-bg-aurora","ary-local-bg-crimson","ary-local-bg-nebula","ary-local-bg-midnight");
 if(background)document.body.classList.add("ary-local-bg-"+background.cosmetic_id.replace("local-bg-",""));
 if(banner){banner.classList.remove("ary-local-banner-aurora","ary-local-banner-crimson","ary-local-banner-nebula","ary-local-banner-midnight");if(background)banner.classList.add("ary-local-banner-"+background.cosmetic_id.replace("local-bg-",""));}
 const tier=document.getElementById("aryCosmeticPreviewTier");if(tier)tier.textContent=(frame?.name||"Tanpa frame")+" · "+(background?.name||"Tanpa background")+" · tersimpan di perangkat ini";
}
function cosmeticCard(item){
 const selected=readLocalCosmetics(),active=selected[item.kind]===item.cosmetic_id;
 return '<article class="ary-cosmetic-card '+(active?"is-equipped":"")+'"><div class="ary-cosmetic-art '+item.art+'"><span>✦</span></div><b>'+item.name+'</b><small>'+item.description+'</small><button type="button" data-local-equip="'+item.cosmetic_id+'" data-kind="'+item.kind+'">'+(active?"Sedang digunakan":"Terapkan di perangkat ini")+'</button></article>';
}
async function loadCosmeticsStudio(){
 const status=document.getElementById("aryCosmeticsStatus"),avatarHost=document.getElementById("aryAvatarCosmetics"),backgroundHost=document.getElementById("aryBackgroundCosmetics");
 if(!status||!avatarHost||!backgroundHost)return;
 const selected=readLocalCosmetics();
 avatarHost.innerHTML=LOCAL_COSMETIC_CATALOG.filter(x=>x.kind==="avatar").map(cosmeticCard).join("");
 backgroundHost.innerHTML=LOCAL_COSMETIC_CATALOG.filter(x=>x.kind==="background").map(cosmeticCard).join("");
 applyLocalCosmetics();
 status.textContent="Mode perangkat aktif: 4 avatar frame dan 4 background siap digunakan. Pilihan tersimpan di browser ini.";
 try{
  const r=await fetch("/api/cosmetics/me",{credentials:"same-origin",cache:"no-store"}),d=await r.json();
  if(r.ok&&d.ok){
   const owned=(d.items||[]);
   status.textContent+=" Sinkronisasi akun tersedia untuk "+owned.length+" item redeem.";
   const frame=owned.find(x=>x.cosmetic_id==="legendary-avatar-frame"&&x.equipped);
   const background=owned.find(x=>x.cosmetic_id==="legendary-aurora-background"&&x.equipped);
   if(frame||background)document.getElementById("aryCosmeticPreviewTier").textContent="Hadiah Legendary akun aktif";
  }else if(r.status===503){status.textContent+=" Database akun belum aktif; mode perangkat tetap bisa dipakai."}
 }catch{status.textContent+=" Mode perangkat tetap aktif tanpa koneksi database."}
}
document.addEventListener("click",event=>{if(event.target.closest('[data-panel="aryCosmeticsStudio"]'))loadCosmeticsStudio()});
cosmeticsPanel.addEventListener("click",event=>{
 const button=event.target.closest("[data-local-equip]");if(!button)return;
 const item=LOCAL_COSMETIC_CATALOG.find(x=>x.cosmetic_id===button.dataset.localEquip);if(!item)return;
 const selected=readLocalCosmetics();selected[item.kind]=item.cosmetic_id;
 try{localStorage.setItem(LOCAL_COSMETICS_KEY,JSON.stringify(selected));applyLocalCosmetics();loadCosmeticsStudio()}
 catch{document.getElementById("aryCosmeticsStatus").textContent="Penyimpanan browser penuh atau dinonaktifkan. Kosmetik tidak dapat disimpan."}
});
window.addEventListener("storage",event=>{if(event.key===LOCAL_COSMETICS_KEY)applyLocalCosmetics()});
applyLocalCosmetics();
loadCatalog();load();
if(new URLSearchParams(location.search).get("membership")==="return"){
 const returnedOrder=new URLSearchParams(location.search).get("order")||"";
 button.click();
 const note=document.getElementById("aryMemNote");
 if(note)note.textContent="Terima kasih. ARYANZZ sedang memeriksa status invoice Poketo"+(returnedOrder?" "+returnedOrder:"")+". Membership aktif hanya setelah webhook pembayaran terverifikasi diterima.";
}
})();
