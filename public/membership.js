(()=>{"use strict";
const $=id=>document.getElementById(id);
const root=$("aryMembershipPlans");
const status=$("aryMembershipStatus");
const current=$("aryMembershipCurrent");
const payment=$("aryMembershipPayment");
const history=$("aryMembershipHistory");
if(!root||!status||!payment)return;
let plans=[],period="monthly",config=null,account=null,activeOrder=null,pollTimer=null,pollUntil=0;
const money=value=>"Rp"+new Intl.NumberFormat("id-ID").format(Number(value)||0);
const request=async(url,options={})=>{
 const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok===false)throw new Error(data.error||("Permintaan gagal (HTTP "+response.status+")."));
 return data;
};
const node=(tag,className,text)=>{
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=String(text);
 return el;
};
function showStatus(message,error=false){status.textContent=message||"";status.style.color=error?"#ffb5ad":"#a9bbd2";}
function stopPolling(){if(pollTimer)clearTimeout(pollTimer);pollTimer=null;}
function renderCurrent(){
 current.replaceChildren();
 const member=account?.membership||{tier:"free",status:"free"};
 const active=member.status==="active";
 const left=node("div");
 left.append(node("b","",active?(member.planName||"Membership ARYANZZ"):"Free Member"));
 left.append(node("small","",active&&member.expiresAt?"Aktif sampai "+new Date(member.expiresAt).toLocaleString("id-ID"):"Gunakan fitur dasar ARYANZZ tanpa biaya."));
 current.append(left,node("span","ary-membership-current-status",active?"AKTIF":String(member.status||"FREE").toUpperCase()));
}
function renderPlans(){
 root.replaceChildren();
 const chosen=plans.filter(p=>p.period===period);
 chosen.forEach(plan=>{
  const card=node("article","ary-membership-card"+(plan.popular?" is-popular":""));
  card.append(node("span","ary-membership-card-badge",plan.badge+(plan.popular?" · POPULER":"")));
  card.append(node("h3","",plan.name));
  card.append(node("div","ary-membership-card-period",plan.periodLabel+" · "+plan.durationDays+" hari"));
  card.append(node("div","ary-membership-price",money(plan.price)));
  card.append(node("div","ary-membership-price-note",period==="yearly"?"Masa aktif 12 bulan":"Masa aktif 30 hari"));
  const list=node("ul","ary-membership-benefits");
  (plan.benefits||[]).forEach(item=>list.append(node("li","",item)));
  card.append(list);
  const buy=node("button","ary-membership-buy","Pilih "+plan.name+" "+plan.periodLabel);
  buy.type="button";buy.dataset.planId=plan.id;
  buy.addEventListener("click",()=>startCheckout(plan,buy));
  card.append(buy);root.append(card);
 });
}
function renderHistory(){
 history.replaceChildren();
 history.append(node("h2","","Riwayat Membership"));
 const orders=account?.orders||[];
 if(!orders.length){history.append(node("p","ary-membership-payment-copy","Belum ada transaksi Membership."));return;}
 orders.slice(0,8).forEach(order=>{
  const row=node("div","ary-membership-order");
  const left=node("div");
  const plan=plans.find(p=>p.id===order.plan_id);
  left.append(node("b","",(plan?.name||order.plan_id)+" · "+money(order.amount)));
  left.append(node("small","",new Date(Number(order.created_at)).toLocaleString("id-ID")+" · "+String(order.id)));
  row.append(left,node("span","ary-membership-order-status",String(order.status||"pending").toUpperCase()));
  if(order.status==="pending"&&order.provider_transaction_id){
   const resume=node("button","ary-membership-payment-actions secondary","Lanjutkan / periksa");resume.type="button";
   resume.addEventListener("click",()=>{
    const selected=plan||{};
    makePaymentPanel({id:order.id,planName:selected.name||order.plan_id,period:selected.period||"monthly",amount:order.amount},{payUrl:order.provider_payment_url||null,qrUrl:order.provider_qr_url||null,baseAmount:order.amount,feeAmount:order.provider_fee_amount===null?null:Number(order.provider_fee_amount),totalAmount:Number(order.provider_total_amount)||Number(order.amount),qrString:order.provider_qr_string||null});
    payment.scrollIntoView({behavior:"smooth",block:"start"});
   });row.append(resume);
  }
  history.append(row);
 });
}
function setPeriod(next){
 period=next;
 document.querySelectorAll("[data-membership-period]").forEach(button=>{
  const active=button.dataset.membershipPeriod===period;
  button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
 });
 renderPlans();
}
function makePaymentPanel(order,pay){
 stopPolling();activeOrder=order.id;pollUntil=Date.now()+15*60*1000;
 payment.hidden=false;payment.replaceChildren();
 payment.append(node("h2","","Selesaikan pembayaran Membership"));
 payment.append(node("p","ary-membership-payment-copy","Pindai QRIS melalui aplikasi e-wallet atau mobile banking yang mendukung QRIS. ARYANZZ akan memeriksa status pembayaran dari server; jangan tutup halaman ini sampai status berubah menjadi lunas."));
 const layout=node("div","ary-membership-payment-layout");
 if(pay.qrUrl){
  const img=node("img","ary-membership-qr");img.src=pay.qrUrl;img.alt="QRIS pembayaran ARYANZZ";img.loading="eager";layout.append(img);
 }else{
  layout.append(node("div","ary-membership-qr-placeholder","QRIS tidak tersedia sebagai gambar. Gunakan halaman checkout AirPay."));
 }
 const details=node("div","ary-membership-payment-details");
 const rows=[
  ["Pesanan",order.id],["Paket",order.planName+" · "+(order.period==="yearly"?"Tahunan":"Bulanan")],
  ["Harga membership",money(pay.baseAmount)],["Biaya gateway",pay.feeAmount===null?"Sesuai invoice":money(pay.feeAmount)],
  ["Total yang harus dibayar",money(pay.totalAmount)],["Status","MENUNGGU PEMBAYARAN"]
 ];
 rows.forEach(([label,value])=>{
  const row=node("div","ary-membership-payment-row");row.append(node("span","",label),node("b","",value));details.append(row);
 });
 const actions=node("div","ary-membership-payment-actions");
 if(pay.payUrl){const link=node("a","","Buka halaman pembayaran AirPay");link.href=pay.payUrl;link.target="_blank";link.rel="noopener noreferrer";actions.append(link);}
 const check=node("button","","Saya sudah bayar · Periksa");check.type="button";check.addEventListener("click",()=>pollPayment(order.id,true));actions.append(check);
 if(pay.qrString){
  const copy=node("button","secondary","Salin kode QRIS");copy.type="button";copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(pay.qrString);showStatus("Kode QRIS berhasil disalin.")}catch{showStatus("Browser tidak mengizinkan penyalinan otomatis.",true)}});actions.append(copy);
 }
 details.append(actions);
 const note=node("p","ary-membership-payment-copy","Nominal total harus dibayar persis seperti yang tertera pada invoice AirPay. Anda tidak perlu memasukkan nomor rekening atau nama pemilik rekening untuk pembayaran QRIS.");
 details.append(note);layout.append(details);payment.append(layout);
 const timer=node("p","ary-membership-status","Menunggu konfirmasi pembayaran…");timer.id="aryMembershipPaymentStatus";payment.append(timer);
 pollPayment(order.id,false);
}
async function pollPayment(orderId,manual){
 const label=$("aryMembershipPaymentStatus");
 if(label)label.textContent=manual?"Memeriksa status pembayaran…":"Menunggu konfirmasi AirPay…";
 try{
  const result=await request("/api/membership/orders/status?orderId="+encodeURIComponent(orderId));
  if(result.status==="paid"){
   stopPolling();
   if(label)label.textContent="Pembayaran lunas ✓ Membership berhasil diaktifkan.";
   showStatus("Pembayaran terverifikasi. Membership sudah aktif.");
   await refreshAccount();
   return;
  }
  if(result.status==="expired"||result.status==="failed"){
   stopPolling();if(label)label.textContent="Invoice kedaluwarsa atau gagal. Buat invoice baru untuk melanjutkan.";
   showStatus("Invoice tidak lagi menunggu pembayaran.",true);return;
  }
  if(label)label.textContent="Status masih menunggu pembayaran. Pemeriksaan otomatis berjalan setiap 5 detik.";
  if(Date.now()<pollUntil)pollTimer=setTimeout(()=>pollPayment(orderId,false),5000);
  else if(label)label.textContent="Pemeriksaan otomatis berhenti. Tekan tombol periksa setelah membayar.";
 }catch(error){
  if(label)label.textContent=error.message||"Status belum dapat diperiksa.";
  if(Date.now()<pollUntil)pollTimer=setTimeout(()=>pollPayment(orderId,false),7000);
 }
}
async function startCheckout(plan,button){
 if(!account?.user){showStatus("Silakan masuk ke akun ARYANZZ terlebih dahulu untuk membeli Membership.",true);const login=node("button","ary-membership-buy","Buka Profil / Login");login.type="button";login.addEventListener("click",()=>window.aryanzzShowPanel?.("profile"));status.append(" ",login);return;}
 if(!config?.checkoutEnabled){
  const missing=config?.missing?.join("; ")||"Konfigurasi pembayaran belum siap.";
  showStatus("Checkout belum dibuka: "+missing,true);return;
 }
 button.disabled=true;button.textContent="Membuat invoice…";showStatus("Menghubungkan ke AirPay dan membuat QRIS…");
 try{
  const result=await request("/api/membership/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId:plan.id})});
  makePaymentPanel(result.order,result.payment);showStatus("Invoice berhasil dibuat. Silakan selesaikan pembayaran QRIS.");
  payment.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(error){showStatus(error.message||"Gagal membuat invoice.",true);}
 finally{button.disabled=false;button.textContent="Pilih "+plan.name+" "+plan.periodLabel;}
}
async function refreshAccount(){
 try{account=await request("/api/membership/me");renderCurrent();renderHistory();}
 catch(error){account=null;renderCurrent();renderHistory();if(error.message.includes("login"))showStatus("Masuk ke akun ARYANZZ untuk membeli dan melihat Membership.",true);}
}
async function init(){
 try{
  const [catalog,paymentConfig]=await Promise.all([
   request("/api/membership/catalog"),request("/api/membership/payment-config")
  ]);
  plans=catalog.plans||[];config=paymentConfig;renderPlans();
  const tabs=$("aryMembershipPeriods");
  tabs?.querySelectorAll("[data-membership-period]").forEach(button=>button.addEventListener("click",()=>setPeriod(button.dataset.membershipPeriod)));
  await refreshAccount();
  if(!config.checkoutEnabled)showStatus("Paket sudah ditampilkan. Checkout akan aktif setelah "+(config.missing||[]).join(" dan ")+".",true);
  const pendingOrder=(account?.orders||[]).find(order=>order.status==="pending"&&order.provider_transaction_id);
  if(pendingOrder){
   const selected=plans.find(plan=>plan.id===pendingOrder.plan_id)||{};
   makePaymentPanel({id:pendingOrder.id,planName:selected.name||pendingOrder.plan_id,period:selected.period||"monthly",amount:pendingOrder.amount},{payUrl:pendingOrder.provider_payment_url||null,qrUrl:pendingOrder.provider_qr_url||null,baseAmount:pendingOrder.amount,feeAmount:pendingOrder.provider_fee_amount===null?null:Number(pendingOrder.provider_fee_amount),totalAmount:Number(pendingOrder.provider_total_amount)||Number(pendingOrder.amount),qrString:pendingOrder.provider_qr_string||null});
  }
  const params=new URLSearchParams(location.search),returnOrder=params.get("order");
  if(params.get("membership")==="return"&&returnOrder){
   activeOrder=returnOrder;payment.hidden=false;payment.replaceChildren(node("h2","","Memeriksa pembayaran…"),node("p","ary-membership-payment-copy","Redirect dari AirPay bukan bukti lunas. ARYANZZ sedang memeriksa status transaksi ke server AirPay."));
   pollUntil=Date.now()+15*60*1000;pollPayment(returnOrder,false);
   history.replaceState({},document.title,location.pathname+location.hash);
  }
 }catch(error){showStatus(error.message||"Gagal memuat Membership.",true);}
}
init();
window.addEventListener("pagehide",stopPolling);
})();