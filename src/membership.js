const COOKIE="aryanzz_session";
const ADMIN_ID="ARY-ZFTLQPEX92";
const PLANS=[
{id:"starter",name:"Starter",price:80000,durationDays:30,badge:"Starter",summary:"Paket pengenalan Membership ARYANZZ."},
{id:"plus",name:"Plus",price:140000,durationDays:60,badge:"Plus",summary:"Akses Membership untuk dua bulan."},
{id:"pro",name:"Pro",price:189000,durationDays:90,badge:"Pro",summary:"Paket Membership tiga bulan."},
{id:"elite",name:"Elite",price:328000,durationDays:180,badge:"Elite",summary:"Akses Membership enam bulan."},
{id:"ultimate",name:"Ultimate",price:500000,durationDays:365,badge:"Ultimate",summary:"Akses Membership satu tahun."},
{id:"lifetime",name:"Lifetime",price:1800000,durationDays:null,badge:"Lifetime",summary:"Membership tanpa tanggal kedaluwarsa."},
{id:"founder",name:"Founder Signature",price:5900000,durationDays:null,badge:"Founder",summary:"Paket pendukung pendiri dengan identitas khusus."}
];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
function safeQrisImage(env){
 const raw=String(env.MEMBERSHIP_QRIS_IMAGE_URL||"").trim();
 if(!raw)return "";
 try{const u=new URL(raw);if(u.protocol!=="https:"||u.username||u.password||u.hostname==="localhost"||u.hostname.endsWith(".local"))return "";return u.href}catch{return ""}
}
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
function sessionToken(request){const c=request.headers.get("cookie")||"";const p=c.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));return p?p.slice(COOKIE.length+1):"";}
async function currentUser(request,env){
 if(!env.AUTH_DB||!env.AUTH_SESSION_SECRET)return null;
 const token=sessionToken(request);if(!/^[a-f0-9]{64}$/i.test(token))return null;
 const row=await env.AUTH_DB.prepare("SELECT u.id,u.email,u.full_name,u.role FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1").bind(await sha(token),Date.now()).first();
 if(!row)return null;
 const ban=await env.AUTH_DB.prepare("SELECT user_id FROM auth_user_bans WHERE user_id=?1").bind(row.id).first().catch(()=>null);
 return ban?null:row;
}
async function adminUser(request,env){const u=await currentUser(request,env);if(!u)return null;return u.id===ADMIN_ID||["owner","admin","developer"].includes(String(u.role||"").toLowerCase())?u:null;}
async function membershipFor(userId,env){
 const row=await env.AUTH_DB.prepare("SELECT plan_id,status,started_at,expires_at FROM user_memberships WHERE user_id=?1").bind(userId).first();
 if(!row)return {tier:"free",status:"free",startedAt:null,expiresAt:null};
 if(row.status==="active"&&row.expires_at!==null&&Number(row.expires_at)<=Date.now()){
  await env.AUTH_DB.prepare("UPDATE user_memberships SET status='expired',updated_at=?1 WHERE user_id=?2").bind(Date.now(),userId).run();
  return {tier:"free",status:"expired",startedAt:Number(row.started_at),expiresAt:Number(row.expires_at)};
 }
 if(row.status!=="active")return {tier:"free",status:row.status,startedAt:Number(row.started_at),expiresAt:row.expires_at===null?null:Number(row.expires_at)};
 const plan=PLANS.find(p=>p.id===row.plan_id);
 return {tier:row.plan_id,planName:plan?.name||row.plan_id,status:"active",startedAt:Number(row.started_at),expiresAt:row.expires_at===null?null:Number(row.expires_at)};
}
async function handleCosmetics(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!env.AUTH_DB||typeof env.AUTH_DB.prepare!=="function")return json({ok:false,error:"Database akun belum dikonfigurasi."},503);
 const user=await currentUser(request,env);
 if(!user)return json({ok:false,error:"Silakan login terlebih dahulu."},401);
 const now=Date.now();
 if(path==="/api/cosmetics/equip"&&request.method==="POST"){
  let body;try{body=await request.json()}catch{return json({ok:false,error:"Pilihan kosmetik tidak valid."},400)}
  const cosmeticId=String(body?.cosmeticId||"");
  const kind=cosmeticId==="legendary-avatar-frame"?"avatar":cosmeticId==="legendary-aurora-background"?"background":"";
  if(!kind)return json({ok:false,error:"Kosmetik tidak dikenal."},400);
  const owned=await env.AUTH_DB.prepare("SELECT id FROM user_cosmetics WHERE user_id=?1 AND cosmetic_id=?2 AND (expires_at IS NULL OR expires_at>?3) LIMIT 1").bind(user.id,cosmeticId,now).first();
  if(!owned)return json({ok:false,error:"Kosmetik ini belum menjadi koleksi akunmu."},404);
  await env.AUTH_DB.prepare("UPDATE user_cosmetics SET equipped=0 WHERE user_id=?1 AND cosmetic_id=?2").bind(user.id,cosmeticId).run();
  await env.AUTH_DB.prepare("UPDATE user_cosmetics SET equipped=1 WHERE user_id=?1 AND cosmetic_id=?2 AND (expires_at IS NULL OR expires_at>?3)").bind(user.id,cosmeticId,now).run();
  return json({ok:true,message:"Tampilan berhasil diterapkan.",cosmeticId});
 }
 if(path==="/api/cosmetics/me"&&request.method==="GET"){
  const rows=await env.AUTH_DB.prepare("SELECT id,cosmetic_id,source,acquired_at,expires_at,equipped FROM user_cosmetics WHERE user_id=?1 AND (expires_at IS NULL OR expires_at>?2) ORDER BY acquired_at DESC").bind(user.id,now).all();
  const items=(rows.results||[]).map(x=>({...x,remainingMs:x.expires_at===null?null:Math.max(0,Number(x.expires_at)-now)}));
  const account=await env.AUTH_DB.prepare("SELECT created_at FROM auth_users WHERE id=?1 LIMIT 1").bind(user.id).first();
  const redeemWindowExpiresAt=Number(account?.created_at||now)+3*24*60*60*1000;
  const redemption=await env.AUTH_DB.prepare("SELECT id,redeemed_at FROM redeem_redemptions WHERE user_id=?1 ORDER BY redeemed_at DESC LIMIT 1").bind(user.id).first();
  const active=items.filter(x=>x.equipped);
  return json({ok:true,items,equipped:active.map(x=>x.cosmetic_id),redeemed:!!redemption,redeemedAt:redemption?Number(redemption.redeemed_at):null,redeemWindowExpiresAt,redeemAvailable:!redemption&&now<redeemWindowExpiresAt});
 }
 if(path==="/api/redeem/claim"&&request.method==="POST"){
  let body;try{body=await request.json()}catch{return json({ok:false,error:"Kode redeem tidak valid."},400)}
  const code=String(body?.code||"").trim().toUpperCase().replace(/\s+/g,"");
  if(!/^[A-Z0-9-]{8,40}$/.test(code))return json({ok:false,error:"Format kode redeem tidak valid."},400);
  const account=await env.AUTH_DB.prepare("SELECT created_at FROM auth_users WHERE id=?1 LIMIT 1").bind(user.id).first();
  const redeemWindowExpiresAt=Number(account?.created_at||now)+3*24*60*60*1000;
  if(now>=redeemWindowExpiresAt)return json({ok:false,code:"REDEEM_WINDOW_EXPIRED",error:"Masa klaim hadiah sudah berakhir. Kode redeem hanya tersedia selama 3 hari pertama setelah akun dibuat."},410);
  const alreadyRedeemed=await env.AUTH_DB.prepare("SELECT id FROM redeem_redemptions WHERE user_id=?1 LIMIT 1").bind(user.id).first();
  if(alreadyRedeemed)return json({ok:false,error:"Akun ini sudah pernah mengklaim hadiah Legendary."},409);
  const codeHash=await sha("aryanzz-redeem-v1|"+code);
  const row=await env.AUTH_DB.prepare("SELECT code_hash,reward_id,max_redemptions,redeemed_count,expires_at,active FROM redeem_codes WHERE code_hash=?1 LIMIT 1").bind(codeHash).first();
  if(!row||Number(row.active)!==1||(row.expires_at!==null&&Number(row.expires_at)<=now))return json({ok:false,error:"Kode redeem tidak ditemukan, sudah kedaluwarsa, atau dinonaktifkan."},404);
  const reward=String(row.reward_id||"");
  const cosmetics=reward==="legendary_launch"?["legendary-avatar-frame","legendary-aurora-background"]:null;
  if(!cosmetics)return json({ok:false,error:"Hadiah kode ini belum didukung."},400);
  const updated=await env.AUTH_DB.prepare("UPDATE redeem_codes SET redeemed_count=redeemed_count+1 WHERE code_hash=?1 AND active=1 AND redeemed_count<max_redemptions AND (expires_at IS NULL OR expires_at>?2)").bind(codeHash,now).run();
  if(Number(updated?.meta?.changes||0)!==1)return json({ok:false,error:"Kuota kode redeem sudah habis atau kode kedaluwarsa."},409);
  const expires=null;
  const redemptionId="ARYR-"+crypto.randomUUID().replace(/-/g,"").slice(0,16).toUpperCase();
  try{
   await env.AUTH_DB.prepare("INSERT INTO redeem_redemptions (id,code_hash,user_id,redeemed_at,reward_expires_at) VALUES (?1,?2,?3,?4,?5)").bind(redemptionId,codeHash,user.id,now,expires).run();
   for(const cosmeticId of cosmetics){
    await env.AUTH_DB.prepare("INSERT INTO user_cosmetics (id,user_id,cosmetic_id,source,acquired_at,expires_at,equipped) VALUES (?1,?2,?3,'redeem',?4,?5,1)").bind("ARYC-"+crypto.randomUUID().replace(/-/g,"").slice(0,16).toUpperCase(),user.id,cosmeticId,now,expires).run();
   }
  }catch(error){
   await env.AUTH_DB.prepare("UPDATE redeem_codes SET redeemed_count=MAX(0,redeemed_count-1) WHERE code_hash=?1").bind(codeHash).run().catch(()=>{});
   await env.AUTH_DB.prepare("DELETE FROM redeem_redemptions WHERE code_hash=?1 AND user_id=?2").bind(codeHash,user.id).run().catch(()=>{});
   return json({ok:false,error:"Hadiah belum berhasil disimpan. Coba sekali lagi."},500);
  }
  return json({ok:true,message:"Redeem berhasil! Border avatar Legendary dan background Legendary menjadi koleksi permanen.",expiresAt:null,cosmetics});
 }
 if(path==="/api/membership/admin/redeem-codes"&&request.method==="POST"){
  const admin=await adminUser(request,env);if(!admin)return json({ok:false,error:"Akses khusus pemilik."},403);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"Konfigurasi kode tidak valid."},400)}
  const quantity=Math.max(1,Math.min(100,Math.floor(Number(body?.quantity)||1)));
  const maxRedemptions=Math.max(1,Math.min(10000,Math.floor(Number(body?.maxRedemptions)||1)));
  const expiresInDays=Math.max(0,Math.min(365,Math.floor(Number(body?.expiresInDays)||0)));
  const note=String(body?.note||"").trim().slice(0,160);
  const codes=[];
  for(let i=0;i<quantity;i++){
   const raw="ARY-LEGEND-"+Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
   const hash=await sha("aryanzz-redeem-v1|"+raw);
   await env.AUTH_DB.prepare("INSERT INTO redeem_codes (code_hash,reward_id,max_redemptions,redeemed_count,expires_at,created_at,created_by,active,note) VALUES (?1,'legendary_launch',?2,0,?3,?4,?5,1,?6)").bind(hash,maxRedemptions,expiresInDays?now+expiresInDays*86400000:null,now,admin.id,note).run();
   codes.push(raw);
  }
  return json({ok:true,codes,quantity,maxRedemptions,expiresInDays,reward:"legendary_launch",message:"Simpan kode sekarang. Kode lengkap hanya ditampilkan satu kali."},201);
 }
 return json({ok:false,error:"Endpoint kosmetik tidak ditemukan."},404);
}

async function handleMembership(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==="/api/cosmetics/me"||path==="/api/cosmetics/equip"||path==="/api/redeem/claim"||path==="/api/membership/admin/redeem-codes")return handleCosmetics(request,env);
 if(path==="/api/membership/catalog"&&request.method==="GET")return json({ok:true,pricingStatus:"proposed",paymentEnabled:!!safeQrisImage(env),plans:PLANS,free:{id:"free",name:"Free Member",price:0,summary:"Tetap tersedia tanpa pembayaran."}});
 if(path==="/api/membership/payment-config"&&request.method==="GET")return json({ok:true,enabled:!!safeQrisImage(env),provider:"QRIS",qrisImageUrl:safeQrisImage(env),verification:"manual",message:safeQrisImage(env)?"QRIS tersedia. Pembayaran diverifikasi oleh pemilik setelah dana diterima.":"QRIS belum dikonfigurasi oleh pemilik ARYANZZ."});
 if(!env.AUTH_DB||typeof env.AUTH_DB.prepare!=="function")return json({ok:false,error:"Database akun belum dikonfigurasi."},503);
 if(path==="/api/membership/me"&&request.method==="GET"){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Silakan login terlebih dahulu."},401);
  const membership=await membershipFor(user.id,env);
  const orders=await env.AUTH_DB.prepare("SELECT id,plan_id,amount,status,created_at,paid_at,expires_at,note FROM membership_orders WHERE user_id=?1 ORDER BY created_at DESC LIMIT 20").bind(user.id).all();
  return json({ok:true,user:{id:user.id,role:user.role},membership,orders:orders.results||[]});
 }
 if(path==="/api/membership/orders"&&request.method==="POST"){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Silakan login terlebih dahulu."},401);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"Data pesanan tidak valid."},400)}
  const plan=PLANS.find(p=>p.id===String(body?.planId||""));if(!plan)return json({ok:false,error:"Paket Membership tidak ditemukan."},400);
  const qrisImageUrl=safeQrisImage(env);
  if(!qrisImageUrl||String(body?.paymentProvider||"")!=="qris")return json({ok:false,error:"Pembayaran QRIS belum dikonfigurasi. Pesanan belum dibuat."},503);
  const pending=await env.AUTH_DB.prepare("SELECT id FROM membership_orders WHERE user_id=?1 AND status='pending' AND created_at>?2 LIMIT 1").bind(user.id,Date.now()-24*60*60*1000).first();
  if(pending)return json({ok:false,error:"Kamu masih memiliki pesanan yang menunggu verifikasi.",orderId:pending.id},409);
  const id="ARYM-"+Date.now().toString(36).toUpperCase()+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
  await env.AUTH_DB.prepare("INSERT INTO membership_orders (id,user_id,plan_id,amount,status,payment_provider,created_at) VALUES (?1,?2,?3,?4,'pending','qris',?5)").bind(id,user.id,plan.id,plan.price,Date.now()).run();
  return json({ok:true,order:{id,planId:plan.id,planName:plan.name,amount:plan.price,status:"pending",paymentProvider:"qris"},payment:{provider:"QRIS",qrisImageUrl},message:"Pesanan dibuat. Scan QRIS dan tunggu verifikasi pembayaran oleh pemilik ARYANZZ."},201);
 }
 if(path==="/api/membership/admin/orders"&&request.method==="GET"){
  const admin=await adminUser(request,env);if(!admin)return json({ok:false,error:"Akses khusus pemilik."},403);
  const rows=await env.AUTH_DB.prepare("SELECT o.id,o.user_id,u.email,u.full_name,o.plan_id,o.amount,o.status,o.created_at,o.paid_at,o.expires_at,o.note FROM membership_orders o JOIN auth_users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 100").all();
  return json({ok:true,orders:rows.results||[]});
 }
 if(path==="/api/membership/admin/review"&&request.method==="POST"){
  const admin=await adminUser(request,env);if(!admin)return json({ok:false,error:"Akses khusus pemilik."},403);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"Data tidak valid."},400)}
  const orderId=String(body?.orderId||"").slice(0,80),decision=String(body?.decision||"");
  if(!orderId||!["approve","reject"].includes(decision))return json({ok:false,error:"Keputusan atau pesanan tidak valid."},400);
  const order=await env.AUTH_DB.prepare("SELECT * FROM membership_orders WHERE id=?1 AND status='pending'").bind(orderId).first();
  if(!order)return json({ok:false,error:"Pesanan tidak ditemukan atau sudah diproses."},404);
  if(decision==="reject"){
   await env.AUTH_DB.prepare("UPDATE membership_orders SET status='rejected',reviewed_by=?1,note=?2 WHERE id=?3 AND status='pending'").bind(admin.id,String(body?.note||"Ditolak oleh admin").slice(0,300),orderId).run();
   return json({ok:true,message:"Pesanan ditolak."});
  }
  // Manual approval is deliberately disabled until an actual incoming payment has been independently verified.
  if(body?.paymentVerified!==true)return json({ok:false,error:"Centang konfirmasi bahwa dana sudah diterima dan cocok pada rekening penerima sebelum menyetujui."},400);
  const plan=PLANS.find(p=>p.id===order.plan_id);if(!plan)return json({ok:false,error:"Paket pesanan tidak valid."},400);
  const now=Date.now(),existing=await membershipFor(order.user_id,env);
  const base=existing.status==="active"&&existing.expiresAt?Math.max(now,existing.expiresAt):now;
  const expires=plan.durationDays===null?null:base+plan.durationDays*86400000;
  const finalized=await env.AUTH_DB.prepare("UPDATE membership_orders SET status='paid',paid_at=?1,expires_at=?2,reviewed_by=?3,note=?4 WHERE id=?5 AND status='pending'").bind(now,expires,admin.id,String(body?.note||"Pembayaran diverifikasi manual").slice(0,300),orderId).run();
  if(Number(finalized?.meta?.changes||0)!==1)return json({ok:false,error:"Pesanan sudah diproses oleh admin lain. Muat ulang daftar pesanan."},409);
  await env.AUTH_DB.prepare("INSERT INTO user_memberships (user_id,plan_id,status,started_at,expires_at,updated_at) VALUES (?1,?2,'active',?3,?4,?3) ON CONFLICT(user_id) DO UPDATE SET plan_id=excluded.plan_id,status='active',started_at=excluded.started_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(order.user_id,plan.id,now,expires).run();
  return json({ok:true,message:"Pembayaran diverifikasi dan Membership diaktifkan."});
 }
 return json({ok:false,error:"Endpoint Membership tidak ditemukan."},404);
}
export {handleMembership};
