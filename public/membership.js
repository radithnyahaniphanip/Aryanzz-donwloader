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
const LOCAL_PRESTIGE_KEY="aryanzz.prestige.local.v1";
const REDEEM_CODE_PREFIX="ARY-LEGEND-";
function activeAccountId(){
 const fromAuth=String(window.aryanzzAuthUser?.id||"").trim();
 const fromProfile=String(document.getElementById("profileRandomId")?.textContent||"").trim();
 const id=fromAuth||fromProfile;
 return /^ARY-[A-Z0-9]{6,24}$/i.test(id)?id.toUpperCase():"";
}
async function accountRedeemCode(accountId){
 const id=String(accountId||"").trim().toUpperCase();
 if(!/^ARY-[A-Z0-9]{6,24}$/.test(id))throw new Error("ID akun ARYANZZ tidak valid.");
 const input=new TextEncoder().encode("ARYANZZ-V1-LEGENDARY-ACCOUNT-REDEEM|"+id+"|2026");
 const digest=await crypto.subtle.digest("SHA-256",input);
 const hex=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();
 return REDEEM_CODE_PREFIX+hex.slice(0,16);
}
function readLocalPrestige(){try{return JSON.parse(localStorage.getItem(LOCAL_PRESTIGE_KEY)||"null")}catch{return null}}
function writeLocalPrestige(value){localStorage.setItem(LOCAL_PRESTIGE_KEY,JSON.stringify(value))}
function applyPrestigeReward(active){
 const avatar=document.getElementById("profileAvatar"),banner=document.getElementById("profileBannerPreview"),preview=document.getElementById("aryCosmeticPreviewAvatar"),profile=document.getElementById("profile");
 [avatar,preview].filter(Boolean).forEach(el=>el.classList.toggle("ary-legendary-frame",!!active));
 banner?.classList.toggle("ary-legendary-banner",!!active);
 document.body.classList.toggle("ary-legendary-background",!!active);
 profile?.classList.toggle("ary-legendary-background",!!active);
 if(banner&&active)banner.style.backgroundImage="radial-gradient(ellipse at 15% 85%,#a76cff88,transparent 50%),radial-gradient(ellipse at 80% 15%,#3ad9e888,transparent 45%),linear-gradient(135deg,#091326,#182c54)";
 else if(banner)banner.style.removeProperty("background-image");
}
async function loadPrestige(){
 const status=document.getElementById("aryRedeemStatus"),active=document.getElementById("aryPrestigeActive");
 if(!active)return;
 const accountId=activeAccountId(),record=readLocalPrestige();
 const owned=!!(accountId&&record&&record.accountId===accountId&&record.code===await accountRedeemCode(accountId));
 const redeemForm=document.querySelector("#aryRedeemProfile .ary-redeem-form");
 if(redeemForm)redeemForm.hidden=owned||!accountId;
 if(!accountId){if(status)status.textContent="ID pengunjung sedang dibuat otomatis. Tunggu sebentar untuk menggunakan kode redeem.";applyPrestigeReward(false);active.hidden=true;return}
 if(owned){
  if(status)status.textContent="Hadiah Legendary berhasil diklaim dan tersimpan di perangkat ini untuk ID akun "+accountId+".";
  applyPrestigeReward(true);active.hidden=false;active.innerHTML="<b>✦ LEGENDARY COLLECTION AKTIF</b><span>Border avatar + background khusus · terikat ke "+accountId+"</span>";
 }else{
  if(status)status.textContent="Masukkan kode yang dibuat khusus untuk ID akun "+accountId+". Kode lain tidak akan cocok.";
  applyPrestigeReward(false);active.hidden=true;
 }
}
document.getElementById("aryRedeemSubmit")?.addEventListener("click",async()=>{
 const input=document.getElementById("aryRedeemCode"),button=document.getElementById("aryRedeemSubmit"),status=document.getElementById("aryRedeemStatus");
 const code=String(input?.value||"").trim().toUpperCase(),accountId=activeAccountId();
 if(!accountId){status.textContent="ID pengunjung belum tersedia. Muat ulang halaman dan coba kembali.";return}
 if(!code){status.textContent="Masukkan kode redeem terlebih dahulu.";return}
 button.disabled=true;button.textContent="Memeriksa…";
 try{
  const expected=await accountRedeemCode(accountId);
  if(code!==expected)throw new Error("Kode tidak cocok dengan ID akun "+accountId+". Periksa kembali kode yang diberikan.");
  const previous=readLocalPrestige();
  if(previous?.accountId===accountId)throw new Error("Hadiah untuk ID akun ini sudah pernah diklaim di perangkat ini.");
  writeLocalPrestige({accountId,code,claimedAt:Date.now(),items:["legendary-avatar-frame","legendary-aurora-background"]});
  input.value="";await loadPrestige();
 }catch(error){status.textContent=error.message||"Kode redeem tidak berhasil."}
 finally{button.disabled=false;button.textContent="Klaim hadiah"}
});
loadPrestige();
window.addEventListener("aryanzz:auth-change",()=>{applyLocalCosmetics();loadPrestige()});
window.addEventListener("pageshow",()=>{applyLocalCosmetics();loadPrestige()});
const profileObserver=new MutationObserver(()=>{applyLocalCosmetics()});
const profileRoot=document.getElementById("profile");
if(profileRoot)profileObserver.observe(profileRoot,{childList:true,subtree:true});

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let plans=[];
const panel=document.createElement("section");panel.id="aryMembershipPanel";panel.className="panel ary-membership";panel.hidden=true;
panel.innerHTML='<div class="ary-mem-head"><div><span class="ary-mem-eyebrow">ARYANZZ V1 · MEMBER CENTER</span><h2>Membership Center</h2><p>Pilih paket Membership. Metode pembayaran akan muncul setelah kamu menekan Bayar sekarang.</p></div><div class="ary-mem-current" id="aryMemCurrent">Memeriksa akun…</div></div><div class="ary-mem-grid" id="aryMemPlans"></div><section class="ary-mem-payment" id="aryMemPayment" hidden><div><span class="ary-mem-eyebrow">CHECKOUT PEMBAYARAN</span><h3>Pilih metode pembayaran</h3><p id="aryMemPaymentNote">Pilih paket untuk melanjutkan ke pembayaran.</p><p class="ary-mem-checkout-note">Kamu tidak perlu membuat akun atau login. Pilih metode pembayaran pada jendela checkout resmi.</p><div class="ary-mem-methods" id="aryMemMethods"><span>Metode pembayaran dimuat saat checkout.</span></div></div><div class="ary-mem-secure-mark">🔒<b>Checkout aman</b><small>Pembayaran diproses melalui kanal pembayaran resmi. Jangan pernah membagikan PIN, OTP, atau password e-wallet.</small></div></section><div class="ary-mem-history"><div class="ary-mem-history-head"><h3>Riwayat pesanan</h3><button type="button" id="aryMemRefresh">Muat ulang</button></div><div id="aryMemOrders">Login untuk melihat riwayat.</div></div><p class="ary-mem-note" id="aryMemNote" role="status">Harga paket merupakan rancangan. Pembayaran hanya dapat dilakukan setelah QRIS merchant resmi dikonfigurasi.</p><section class="ary-mem-admin" id="aryMemAdmin" hidden><div class="ary-mem-admin-orders"><div class="ary-mem-history-head"><h3>Owner · Verifikasi pembayaran QRIS</h3><button type="button" id="aryMemAdminRefresh">Muat ulang pesanan</button></div><p class="ary-mem-note">Status pembayaran diperbarui otomatis setelah konfirmasi resmi diterima server. Tidak ada aktivasi manual dari browser.</p><div id="aryMemAdminOrders">Memuat pesanan…</div></div><h3>Owner · Kode redeem berdasarkan ID akun</h3><p class="ary-mem-note">Masukkan ID akun penerima. Kode akan dibuat langsung di browser tanpa database redeem.</p><label class="ary-redeem-owner-id">ID akun penerima<input id="aryRedeemTargetId" type="text" maxlength="40" placeholder="ARY-XXXXXXXXXX"></label><button type="button" id="aryGenerateRedeemCodes">Buat kode khusus akun</button><textarea id="aryGeneratedRedeemCodes" rows="3" readonly placeholder="Kode khusus akun akan muncul di sini."></textarea></section>'
root.append(panel);
const button=document.createElement("button");button.type="button";button.dataset.nav="membership";button.innerHTML='<span class="ary-mem-nav-logo" aria-hidden="true">✦</span><span class="ary-mem-nav-label">Membership</span>';button.className="ary-mem-nav";nav.insertBefore(button,nav.children[2]||null);
let paymentConfig={enabled:false,checkoutEnabled:false,automaticWebhookReady:false,missing:["Konfigurasi pembayaran belum terbaca"],provider:"Poketo",mode:"sandbox"};
let checkoutScriptPromise=null;
async function openPaymentCheckout(paymentUrl){
 if(!/^https:\/\/(?:pay\.)?poketo\.id\//i.test(String(paymentUrl||"")))throw new Error("Alamat pembayaran tidak valid.");
 if(!window.Poketo?.checkout?.open){
  if(!checkoutScriptPromise)checkoutScriptPromise=new Promise((resolve,reject)=>{
   const script=document.createElement("script");script.src="https://poketo.id/js/checkout.js";script.async=true;
   script.onload=resolve;script.onerror=()=>reject(new Error("Jendela pembayaran gagal dimuat. Periksa koneksi lalu coba lagi."));
   document.head.appendChild(script);
  });
  await checkoutScriptPromise;
 }
 if(!window.Poketo?.checkout?.open)throw new Error("Fitur checkout belum tersedia. Muat ulang halaman dan coba kembali.");
 window.Poketo.checkout.open(paymentUrl,{
  onPaid:()=>{const note=document.getElementById("aryMemNote");if(note)note.textContent="Pembayaran terdeteksi. Memperbarui status Membership…";load()},
  onStatus:event=>{const status=String(event?.status||"").toLowerCase(),note=document.getElementById("aryMemNote");if(note&&status&&status!=="paid")note.textContent="Status pembayaran: "+status+". Membership akan aktif setelah pembayaran terkonfirmasi."},
  onClose:()=>{const note=document.getElementById("aryMemNote");if(note)note.textContent="Jendela pembayaran ditutup. Kamu bisa melanjutkan pembayaran dari tombol Bayar sekarang."}
 });
}
async function loadCatalog(){
 const note=document.getElementById("aryMemNote"),paymentNote=document.getElementById("aryMemPaymentNote"),qris=document.getElementById("aryMemQris");
 try{
  const [catalogResponse,paymentResponse]=await Promise.all([fetch("/api/membership/catalog",{cache:"no-store"}),fetch("/api/membership/payment-config",{cache:"no-store"})]);
  const data=await catalogResponse.json(),payment=await paymentResponse.json();
  if(!catalogResponse.ok||!data.ok||!Array.isArray(data.plans))throw Error(data.error||"Katalog Membership belum tersedia.");
  paymentConfig={enabled:!!payment.apiKeyReady||!!payment.enabled,checkoutEnabled:!!payment.dbReady||!!payment.checkoutEnabled,automaticWebhookReady:!!payment.webhookReady||!!payment.automaticWebhookReady,missing:Array.isArray(payment.missing)?payment.missing:[],provider:"Poketo",mode:String(payment.mode||"sandbox")};
  plans=data.plans.map(p=>({...p,term:p.durationDays===null?"Permanen":p.durationDays+" hari",desc:p.summary||""}));
  if(paymentNote)paymentNote.textContent=paymentConfig.missing.length?"Pembayaran sedang disiapkan: "+paymentConfig.missing.join(" · "):"Pembayaran siap · mode "+paymentConfig.mode+". Pilih metode yang tersedia pada checkout resmi: QRIS, Virtual Account, dan kanal lain yang diaktifkan merchant.";
  if(qris)qris.innerHTML="";
  if(qris)qris.hidden=true;
  if(note)note.textContent="Pilih paket lalu tekan Bayar sekarang. Membership aktif otomatis setelah pembayaran terkonfirmasi oleh server.";
  renderPlans();
 }catch(error){if(note)note.textContent=error.message;if(paymentNote)paymentNote.textContent=error.message}
}
function renderPlans(){
 const host=document.getElementById("aryMemPlans");
 host.innerHTML=plans.map((p,i)=>'<article class="ary-mem-card '+(i===2?"ary-mem-featured":"")+'"><div class="ary-mem-card-top"><span>'+String(i+1).padStart(2,"0")+' / MEMBERSHIP</span><b>'+esc(p.name)+'</b></div><div class="ary-mem-price">'+money(p.price)+'</div><div class="ary-mem-term">'+p.term+'</div><p>'+esc(p.desc)+'</p><button type="button" data-buy="'+esc(p.id)+'">Bayar sekarang</button></article>').join("")
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
 try{if(window.aryanzzGuestReady)await window.aryanzzGuestReady;const r=await fetch("/api/membership/me",{credentials:"same-origin",cache:"no-store"});const d=await r.json();
 if(r.status===401){current.textContent="Free Member · ID belum tersinkron";orders.textContent="ID pengunjung belum terhubung ke server. Muat ulang halaman untuk mencoba kembali.";return}
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
  const promptText="Status pembayaran diperbarui otomatis setelah konfirmasi resmi diterima server.";
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
 try{if(window.aryanzzGuestReady)await window.aryanzzGuestReady;if(!paymentConfig.checkoutEnabled||!paymentConfig.enabled||!paymentConfig.automaticWebhookReady)throw Error("Pembayaran belum dapat diproses: "+(paymentConfig.missing.join(" · ")||"konfigurasi server belum lengkap")+".");if(!p)throw Error("Paket Membership tidak ditemukan.");const r=await fetch("/api/membership/orders",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({planId:p.id,paymentProvider:"poketo"})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||"Invoice gagal dibuat.");if(!d.payment?.paymentUrl)throw Error("Link checkout Poketo tidak tersedia.");note.textContent="Pesanan "+d.order.id+" berhasil dibuat. Membuka pilihan pembayaran…";const paymentPanel=document.getElementById("aryMemPayment");paymentPanel.hidden=false;paymentPanel.scrollIntoView({behavior:"smooth",block:"center"});await openPaymentCheckout(d.payment.paymentUrl);await load()}
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
 if(navItem.dataset.nav==="profile"){applyLocalCosmetics();loadPrestige()}
});

document.getElementById("aryGenerateRedeemCodes")?.addEventListener("click",async()=>{
 const button=document.getElementById("aryGenerateRedeemCodes"),output=document.getElementById("aryGeneratedRedeemCodes"),note=document.getElementById("aryMemNote"),target=document.getElementById("aryRedeemTargetId");
 button.disabled=true;button.textContent="Membuat kode…";
 try{
  const code=await accountRedeemCode(String(target?.value||""));
  output.value=code;
  if(note)note.textContent="Kode khusus berhasil dibuat. Kirim hanya kepada pemilik ID akun yang dimasukkan.";
 }catch(error){if(note)note.textContent=error.message||"Gagal membuat kode."}
 finally{button.disabled=false;button.textContent="Buat kode khusus akun"}
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
 const selected=readLocalCosmetics(),avatar=document.getElementById("profileAvatar"),banner=document.getElementById("profileBannerPreview"),preview=document.getElementById("aryCosmeticPreviewAvatar"),profile=document.getElementById("profile");
 const frame=LOCAL_COSMETIC_CATALOG.find(x=>x.cosmetic_id===selected.avatar),background=LOCAL_COSMETIC_CATALOG.find(x=>x.cosmetic_id===selected.background);
 const frameTargets=[avatar,preview].filter(Boolean);
 frameTargets.forEach(el=>{el.classList.remove("ary-local-frame-aurora","ary-local-frame-royal","ary-local-frame-nebula","ary-local-frame-obsidian");if(frame)el.classList.add("ary-local-frame-"+frame.cosmetic_id.replace("local-frame-",""));});
 const bgClasses=["aurora","crimson","nebula","midnight"];
 document.body.classList.remove(...bgClasses.map(x=>"ary-local-bg-"+x));
 profile?.classList.remove(...bgClasses.map(x=>"ary-local-profile-bg-"+x));
 if(background){const bg=background.cosmetic_id.replace("local-bg-","");document.body.classList.add("ary-local-bg-"+bg);profile?.classList.add("ary-local-profile-bg-"+bg);}
 if(banner){banner.classList.remove("ary-local-banner-aurora","ary-local-banner-crimson","ary-local-banner-nebula","ary-local-banner-midnight");if(background)banner.classList.add("ary-local-banner-"+background.cosmetic_id.replace("local-bg-",""));}
 const tier=document.getElementById("aryCosmeticPreviewTier");if(tier)tier.textContent=(frame?.name||"Tanpa frame")+" · "+(background?.name||"Tanpa background")+" · tersimpan di perangkat ini";
}
function cosmeticCard(item){
 const selected=readLocalCosmetics(),active=selected[item.kind]===item.cosmetic_id;
 return '<article class="ary-cosmetic-card '+(active?"is-equipped":"")+'"><div class="ary-cosmetic-art '+item.art+'"><span>✦</span></div><b>'+item.name+'</b><small>'+item.description+'</small><button type="button" data-local-equip="'+item.cosmetic_id+'" data-kind="'+item.kind+'">'+(active?"Sedang digunakan":"Terapkan di perangkat ini")+'</button></article>';
}
function loadCosmeticsStudio(){
 const status=document.getElementById("aryCosmeticsStatus"),avatarHost=document.getElementById("aryAvatarCosmetics"),backgroundHost=document.getElementById("aryBackgroundCosmetics");
 if(!status||!avatarHost||!backgroundHost)return;
 avatarHost.innerHTML=LOCAL_COSMETIC_CATALOG.filter(x=>x.kind==="avatar").map(cosmeticCard).join("");
 backgroundHost.innerHTML=LOCAL_COSMETIC_CATALOG.filter(x=>x.kind==="background").map(cosmeticCard).join("");
 applyLocalCosmetics();
 const selected=readLocalCosmetics();
 const frame=LOCAL_COSMETIC_CATALOG.find(x=>x.cosmetic_id===selected.avatar),background=LOCAL_COSMETIC_CATALOG.find(x=>x.cosmetic_id===selected.background);
 const tier=document.getElementById("aryCosmeticPreviewTier");
 if(tier)tier.textContent=(frame?.name||"Belum memilih frame")+" · "+(background?.name||"Belum memilih background")+" · aktif di profil perangkat ini";
 status.textContent="Mode lokal aktif: pilihan langsung diterapkan ke foto profil dan sampul profil. Tersimpan di browser perangkat ini tanpa database.";
}
document.addEventListener("click",event=>{if(event.target.closest('[data-panel="aryCosmeticsStudio"]'))loadCosmeticsStudio()});
document.addEventListener("click",event=>{
 const button=event.target.closest("#aryCosmeticsStudio [data-local-equip]");if(!button)return;
 const item=LOCAL_COSMETIC_CATALOG.find(x=>x.cosmetic_id===button.dataset.localEquip);if(!item)return;
 const selected=readLocalCosmetics();selected[item.kind]=item.cosmetic_id;
 try{localStorage.setItem(LOCAL_COSMETICS_KEY,JSON.stringify(selected));applyLocalCosmetics();loadCosmeticsStudio()}
 catch{const status=document.getElementById("aryCosmeticsStatus");if(status)status.textContent="Penyimpanan browser penuh atau dinonaktifkan. Kosmetik tidak dapat disimpan."}
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
