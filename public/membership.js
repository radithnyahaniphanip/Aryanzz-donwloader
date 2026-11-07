(()=>{"use strict";
const root=document.getElementById("toolsArea");const nav=document.querySelector(".nav");if(!root||!nav)return;
const money=n=>"Rp"+Number(n).toLocaleString("id-ID");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const plans=[
{id:"starter",name:"Starter",price:80000,term:"30 hari",desc:"Paket pengenalan Membership ARYANZZ."},
{id:"plus",name:"Plus",price:140000,term:"60 hari",desc:"Akses Membership untuk dua bulan."},
{id:"pro",name:"Pro",price:189000,term:"90 hari",desc:"Paket Membership tiga bulan."},
{id:"elite",name:"Elite",price:328000,term:"180 hari",desc:"Akses Membership enam bulan."},
{id:"ultimate",name:"Ultimate",price:500000,term:"365 hari",desc:"Akses Membership satu tahun."},
{id:"lifetime",name:"Lifetime",price:1800000,term:"Lifetime",desc:"Membership tanpa tanggal kedaluwarsa."},
{id:"founder",name:"Founder Signature",price:5900000,term:"Lifetime",desc:"Paket pendukung pendiri dengan identitas khusus."}
];
const panel=document.createElement("section");panel.id="aryMembershipPanel";panel.className="panel ary-membership";panel.hidden=true;
panel.innerHTML='<div class="ary-mem-head"><div><span class="ary-mem-eyebrow">ARYANZZ V1 · MEMBER CENTER</span><h2>Membership Center</h2><p>Pilih paket untuk mendukung pengembangan ARYANZZ. Free Member tetap tersedia.</p></div><div class="ary-mem-current" id="aryMemCurrent">Memeriksa akun…</div></div><div class="ary-mem-grid" id="aryMemPlans"></div><div class="ary-mem-history"><div class="ary-mem-history-head"><h3>Riwayat pesanan</h3><button type="button" id="aryMemRefresh">Muat ulang</button></div><div id="aryMemOrders">Login untuk melihat riwayat.</div></div><p class="ary-mem-note" id="aryMemNote" role="status">Pembayaran belum diaktifkan. Pesanan hanya dibuat sebagai draft sampai metode pembayaran dan penerima dana dikonfigurasi.</p>';
root.append(panel);
const button=document.createElement("button");button.type="button";button.dataset.panel=panel.id;button.textContent="Membership";button.className="ary-mem-nav";nav.append(button);
function renderPlans(){document.getElementById("aryMemPlans").innerHTML=plans.map((p,i)=>'<article class="ary-mem-card '+(i===2?"ary-mem-featured":"")+'"><div class="ary-mem-card-top"><span>'+String(i+1).padStart(2,"0")+' / MEMBERSHIP</span><b>'+esc(p.name)+'</b></div><div class="ary-mem-price">'+money(p.price)+'</div><div class="ary-mem-term">'+p.term+'</div><p>'+esc(p.desc)+'</p><button type="button" data-buy="'+p.id+'">Buat pesanan</button></article>').join("")}
async function load(){
 const current=document.getElementById("aryMemCurrent"),orders=document.getElementById("aryMemOrders"),note=document.getElementById("aryMemNote");
 try{const r=await fetch("/api/membership/me",{credentials:"same-origin",cache:"no-store"});const d=await r.json();
 if(r.status===401){current.textContent="Free Member · Login diperlukan";orders.textContent="Masuk ke akun ARYANZZ untuk melihat Membership dan pesanan.";return}
 if(!r.ok||!d.ok)throw Error(d.error||"Gagal memuat Membership.");
 const m=d.membership;current.innerHTML='<b>'+esc(m.planName||"Free Member")+'</b><small>'+esc(m.status==="active"?"Aktif":m.status==="expired"?"Kedaluwarsa":"Free Member")+(m.expiresAt?" · berakhir "+new Date(m.expiresAt).toLocaleDateString("id-ID"):"")+'</small>';
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
renderPlans();load();
})();
