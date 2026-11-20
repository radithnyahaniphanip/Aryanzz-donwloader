const COOKIE="aryanzz_session";
const ADMIN_ID="ARY-ZFTLQPEX92";
const DAY=86400000;
const API_ORIGIN="https://airpaygateway.site";

const TIERS={
 basic:{
  name:"Basic",badge:"BASIC",
  benefits:["Badge Basic pada profil ARYANZZ","Pengalaman unduhan standar","Kualitas media mengikuti sumber yang tersedia","Dukungan standar"]
 },
 pro:{
  name:"Pro",badge:"PRO",
  benefits:["Semua fasilitas Basic","Prioritas antrean Pro","Batch hingga 10 tautan (fitur bertahap)","Kualitas hingga 4K jika sumber menyediakannya"]
 },
 ultra:{
  name:"Ultra",badge:"ULTRA",
  benefits:["Semua fasilitas Pro","Batch hingga 25 tautan (fitur bertahap)","Prioritas pemrosesan lebih tinggi","Akses penuh ke fitur Studio yang tersedia"]
 },
 max:{
  name:"Max",badge:"MAX",
  benefits:["Semua fasilitas Ultra","Batch hingga 50 tautan (fitur bertahap)","Akses awal fitur baru","Dukungan prioritas"]
 }
};

const PLANS=[
 {id:"basic-monthly",tier:"basic",name:"Basic",period:"monthly",periodLabel:"Bulanan",price:10000,durationDays:30},
 {id:"basic-yearly",tier:"basic",name:"Basic",period:"yearly",periodLabel:"Tahunan",price:40000,durationDays:365},
 {id:"pro-monthly",tier:"pro",name:"Pro",period:"monthly",periodLabel:"Bulanan",price:66000,durationDays:30,popular:true},
 {id:"pro-yearly",tier:"pro",name:"Pro",period:"yearly",periodLabel:"Tahunan",price:127000,durationDays:365},
 {id:"ultra-monthly",tier:"ultra",name:"Ultra",period:"monthly",periodLabel:"Bulanan",price:200000,durationDays:30},
 {id:"ultra-yearly",tier:"ultra",name:"Ultra",period:"yearly",periodLabel:"Tahunan",price:370000,durationDays:365},
 {id:"max-monthly",tier:"max",name:"Max",period:"monthly",periodLabel:"Bulanan",price:600000,durationDays:30},
 {id:"max-yearly",tier:"max",name:"Max",period:"yearly",periodLabel:"Tahunan",price:1600000,durationDays:365}
];

const json=(data,status=200)=>new Response(JSON.stringify(data),{
 status,
 headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
});
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
function airpayKey(env){return String(env.AIRPAY_API_KEY||"").trim()}
function airpayMode(env){return airpayKey(env).startsWith("ak_live_")?"live":airpayKey(env).startsWith("ak_test_")?"sandbox":"unconfigured"}
function airpayKeyReady(env){return /^ak_(?:live|test)_[A-Za-z0-9._-]{12,}$/.test(airpayKey(env))}
function cookieValue(request,name){const part=String(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));return part?part.slice(name.length+1):""}

async function currentUser(request,env){
 if(!env.AUTH_DB||typeof env.AUTH_DB.prepare!=="function"||!env.AUTH_SESSION_SECRET)return null;
 const token=cookieValue(request,COOKIE);
 if(!/^[a-f0-9]{64}$/i.test(token))return null;
 const row=await env.AUTH_DB.prepare("SELECT u.id,u.email,u.full_name,u.role FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1").bind(await sha(token),Date.now()).first();
 if(!row)return null;
 const ban=await env.AUTH_DB.prepare("SELECT user_id FROM auth_user_bans WHERE user_id=?1").bind(row.id).first().catch(()=>null);
 return ban?null:row;
}
async function adminUser(request,env){
 const user=await currentUser(request,env);
 return user&&(user.id===ADMIN_ID||["owner","admin","developer"].includes(String(user.role||"").toLowerCase()))?user:null;
}
async function membershipFor(userId,env){
 const row=await env.AUTH_DB.prepare("SELECT plan_id,status,started_at,expires_at FROM user_memberships WHERE user_id=?1").bind(userId).first();
 if(!row)return {tier:"free",status:"free",startedAt:null,expiresAt:null,planName:"Free"};
 if(row.status==="active"&&row.expires_at!==null&&Number(row.expires_at)<=Date.now()){
  await env.AUTH_DB.prepare("UPDATE user_memberships SET status='expired',updated_at=?1 WHERE user_id=?2").bind(Date.now(),userId).run();
  return {tier:"free",status:"expired",startedAt:Number(row.started_at),expiresAt:Number(row.expires_at),planName:"Free"};
 }
 if(row.status!=="active")return {tier:"free",status:row.status,startedAt:Number(row.started_at),expiresAt:row.expires_at===null?null:Number(row.expires_at),planName:"Free"};
 const plan=PLANS.find(p=>p.id===row.plan_id);
 const tier=plan?.tier||String(row.plan_id||"legacy").split("-")[0];
 return {
  tier,planId:row.plan_id,planName:plan?plan.name+" "+plan.periodLabel:(TIERS[tier]?.name||"Membership"),
  status:"active",startedAt:Number(row.started_at),expiresAt:row.expires_at===null?null:Number(row.expires_at),
  benefits:TIERS[tier]?.benefits||[]
 };
}
function planCatalog(){
 return PLANS.map(plan=>({...plan,badge:TIERS[plan.tier].badge,benefits:TIERS[plan.tier].benefits,summary:"Membership "+plan.name+" "+plan.periodLabel+" ARYANZZ."}));
}
function safeAirpayUrl(value){
 try{
  const u=new URL(String(value||""));
  if(u.protocol!=="https:"||u.username||u.password||!(u.hostname==="airpaygateway.site"||u.hostname.endsWith(".airpaygateway.site")))return "";
  return u.href;
 }catch{return ""}
}
async function airpayFetch(path,options,env){
 if(!airpayKeyReady(env))throw new Error("AIRPAY_API_KEY belum dikonfigurasi dengan benar pada Cloudflare Worker.");
 const headers=new Headers(options?.headers||{});
 headers.set("X-API-Key",airpayKey(env));
 if(options?.body)headers.set("Content-Type","application/json");
 const response=await fetch(API_ORIGIN+path,{...options,headers,signal:options?.signal||AbortSignal.timeout(12000)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body?.success===false)throw new Error(String(body?.message||body?.error||("AirPay merespons HTTP "+response.status)).slice(0,240));
 return body?.data&&typeof body.data==="object"?body.data:body;
}
function statusName(value){
 const v=String(value||"").trim().toLowerCase();
 if(["success","paid","settlement","settled","completed"].includes(v))return "paid";
 if(["expired","expire","timeout"].includes(v))return "expired";
 if(["failed","cancelled","canceled","rejected"].includes(v))return "failed";
 return "pending";
}
function numericIfPresent(value){
 if(value===null||value===undefined||value==="")return null;
 const n=Number(value);
 return Number.isFinite(n)?n:null;
}
async function fetchAirpayStatus(order,env){
 const tx=String(order.provider_transaction_id||order.id);
 const data=await airpayFetch("/api/qris/status?transaction_id="+encodeURIComponent(tx),{method:"GET"},env);
 const external=String(data.external_id||data.transaction_id||data.tid||"");
 if(external&&external!==String(order.id)&&external!==tx)throw new Error("Referensi transaksi AirPay tidak cocok dengan pesanan ARYANZZ.");
 const base=numericIfPresent(data.base_amount);
 const amount=numericIfPresent(data.amount);
 const total=numericIfPresent(data.total_amount);
 if(base!==null&&base!==Number(order.amount))throw new Error("Nominal dasar transaksi AirPay tidak cocok dengan pesanan.");
 if(base===null&&amount!==null&&amount!==Number(order.amount)&&amount!==Number(order.provider_total_amount))throw new Error("Nominal transaksi AirPay tidak cocok dengan pesanan.");
 if(total!==null&&order.provider_total_amount!==null&&order.provider_total_amount!==undefined&&total!==Number(order.provider_total_amount))throw new Error("Total pembayaran AirPay berubah dari invoice awal.");
 return {state:statusName(data.status),rawStatus:String(data.status||""),data};
}
async function activateMembership(order,providerTransactionId,env){
 const plan=PLANS.find(p=>p.id===order.plan_id);
 if(!plan)throw new Error("Paket pada pesanan tidak lagi tersedia.");
 if(order.status==="paid"&&order.provider_transaction_id===providerTransactionId)return {duplicate:true};
 if(!["pending","expired"].includes(String(order.status))||order.payment_provider!=="airpay")throw new Error("Pesanan tidak lagi menunggu pembayaran AirPay.");
 const now=Date.now();
 const existing=await membershipFor(order.user_id,env);
 const base=existing.status==="active"&&existing.expiresAt?Math.max(now,existing.expiresAt):now;
 const expires=base+plan.durationDays*DAY;
 const results=await env.AUTH_DB.batch([
  env.AUTH_DB.prepare("UPDATE membership_orders SET status='paid',paid_at=?1,expires_at=?2,note='Pembayaran AirPay terverifikasi' WHERE id=?3 AND payment_provider='airpay' AND provider_transaction_id=?4 AND status IN ('pending','expired') AND amount=?5").bind(now,expires,order.id,providerTransactionId,order.amount),
  env.AUTH_DB.prepare("INSERT INTO user_memberships (user_id,plan_id,status,started_at,expires_at,updated_at) SELECT ?1,?2,'active',?3,?4,?3 WHERE EXISTS (SELECT 1 FROM membership_orders WHERE id=?5 AND status='paid' AND provider_transaction_id=?6) ON CONFLICT(user_id) DO UPDATE SET plan_id=excluded.plan_id,status='active',started_at=excluded.started_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(order.user_id,plan.id,now,expires,order.id,providerTransactionId)
 ]);
 if(Number(results?.[0]?.meta?.changes||0)!==1){
  const fresh=await env.AUTH_DB.prepare("SELECT status,provider_transaction_id FROM membership_orders WHERE id=?1").bind(order.id).first();
  if(fresh?.status==="paid"&&fresh.provider_transaction_id===providerTransactionId)return {duplicate:true};
  throw new Error("Pesanan sudah diproses atau transaksi sudah pernah digunakan.");
 }
 return {duplicate:false,expiresAt:expires,plan};
}
async function verifyAirpaySignature(request,secret){
 const raw=new Uint8Array(await request.arrayBuffer());
 let signature=String(request.headers.get("X-AirPay-Signature")||"").trim().replace(/^sha256=/i,"").toLowerCase();
 if(!/^[a-f0-9]{64}$/.test(signature))return null;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,raw));
 const expected=Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
 if(diff!==0)return null;
 try{return JSON.parse(new TextDecoder().decode(raw))}catch{return null}
}
async function handleAirpayWebhook(request,env){
 if(request.method!=="POST")return json({ok:false,error:"Method tidak diizinkan."},405);
 if(!env.AUTH_DB||typeof env.AUTH_DB.prepare!=="function")return json({ok:false,error:"Database akun belum dikonfigurasi."},503);
 if(!airpayKeyReady(env))return json({ok:false,error:"Kunci AirPay server belum dikonfigurasi."},503);
 const event=await verifyAirpaySignature(request,airpayKey(env));
 if(!event)return json({ok:false,error:"Tanda tangan AirPay tidak valid."},401);
 const data=event.data&&typeof event.data==="object"?event.data:event;
 const eventType=String(request.headers.get("X-AirPay-Event")||event.event||event.type||"");
 if(eventType&&eventType!=="payment.success")return json({ok:true,ignored:true});
 if(statusName(data.status)!=="paid")return json({ok:true,ignored:true,status:String(data.status||"unknown")});
 const orderId=String(data.external_id||data.metadata?.orderId||"").slice(0,100);
 const tx=String(data.transaction_id||data.id||data.external_id||"").slice(0,180);
 if(!orderId||!tx)return json({ok:false,error:"Referensi transaksi AirPay tidak lengkap."},400);
 const order=await env.AUTH_DB.prepare("SELECT * FROM membership_orders WHERE id=?1 LIMIT 1").bind(orderId).first();
 if(!order)return json({ok:false,error:"Pesanan ARYANZZ tidak ditemukan."},404);
 if(order.payment_provider!=="airpay"||String(order.provider_transaction_id||"")!==tx)return json({ok:false,error:"ID transaksi AirPay tidak cocok dengan invoice ARYANZZ."},409);
 const base=numericIfPresent(data.base_amount);
 const amount=numericIfPresent(data.amount);
 const total=numericIfPresent(data.total_amount);
 if(base!==null&&base!==Number(order.amount))return json({ok:false,error:"Nominal dasar webhook AirPay tidak cocok."},409);
 if(base===null&&amount!==null&&amount!==Number(order.amount)&&amount!==Number(order.provider_total_amount))return json({ok:false,error:"Nominal webhook AirPay tidak cocok."},409);
 if(total!==null&&order.provider_total_amount!==null&&total!==Number(order.provider_total_amount))return json({ok:false,error:"Total webhook AirPay tidak cocok dengan invoice."},409);
 try{
  const result=await activateMembership(order,tx,env);
  const eventId=await sha(orderId+"|"+tx+"|payment.success");
  await env.AUTH_DB.prepare("INSERT OR IGNORE INTO airpay_webhook_events (event_id,event_type,order_id,received_at) VALUES (?1,'payment.success',?2,?3)").bind(eventId,orderId,Date.now()).run();
  return json({ok:true,duplicate:!!result.duplicate,orderId,message:result.duplicate?"Pembayaran sudah pernah diproses.":"Pembayaran terverifikasi. Membership aktif."});
 }catch(error){return json({ok:false,error:String(error?.message||"Aktivasi Membership gagal.").slice(0,220)},409)}
}
async function createAirpayOrder(request,env,user){
 let body;try{body=await request.json()}catch{return json({ok:false,error:"Data pesanan tidak valid."},400)}
 const plan=PLANS.find(p=>p.id===String(body?.planId||""));
 if(!plan)return json({ok:false,error:"Paket Membership tidak ditemukan."},400);
 await env.AUTH_DB.prepare("UPDATE membership_orders SET status='expired',note='Invoice AirPay melewati masa berlaku' WHERE user_id=?1 AND payment_provider='airpay' AND status='pending' AND provider_expires_at IS NOT NULL AND provider_expires_at<=?2").bind(user.id,Date.now()).run();
 const pending=await env.AUTH_DB.prepare("SELECT id FROM membership_orders WHERE user_id=?1 AND payment_provider='airpay' AND status='pending' AND (provider_expires_at IS NULL OR provider_expires_at>?2) LIMIT 1").bind(user.id,Date.now()).first();
 if(pending)return json({ok:false,error:"Masih ada invoice yang menunggu pembayaran. Selesaikan atau batalkan invoice tersebut terlebih dahulu.",orderId:pending.id},409);
 const now=Date.now(),id="ARYM-"+now.toString(36).toUpperCase()+"-"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();
 await env.AUTH_DB.prepare("INSERT INTO membership_orders (id,user_id,plan_id,amount,status,payment_provider,created_at) VALUES (?1,?2,?3,?4,'pending','airpay',?5)").bind(id,user.id,plan.id,plan.price,now).run();
 const origin=new URL(request.url).origin;
 const payload={
  amount:plan.price,
  external_id:id,
  description:"ARYANZZ Membership "+plan.name+" "+plan.periodLabel,
  callback_url:origin+"/api/membership/webhook",
  return_url:origin+"/?membership=return&order="+encodeURIComponent(id)
 };
 try{
  const response=await fetch(API_ORIGIN+"/api/qris/create",{
   method:"POST",
   headers:{"X-API-Key":airpayKey(env),"Content-Type":"application/json"},
   body:JSON.stringify(payload),
   signal:AbortSignal.timeout(15000)
  });
  const result=await response.json().catch(()=>({}));
  const data=result?.data&&typeof result.data==="object"?result.data:result;
  if(!response.ok||result?.success===false)throw new Error(String(result?.message||result?.error||("AirPay HTTP "+response.status)).slice(0,180));
  const external=String(data.external_id||id);
  const tx=String(data.transaction_id||external);
  const base=numericIfPresent(data.base_amount);
  if(external!==id||!tx||base!==null&&base!==plan.price)throw new Error("Respons AirPay tidak cocok dengan pesanan ARYANZZ.");
  const payUrl=safeAirpayUrl(data.pay_url);
  const qrUrl=safeAirpayUrl(data.qr_url);
  if(!payUrl&&!qrUrl&&!data.qr_string)throw new Error("AirPay tidak mengirim tautan checkout atau data QRIS.");
  const total=numericIfPresent(data.total_amount)??plan.price;
  const fee=numericIfPresent(data.fee_amount);
  const expiry=Date.parse(String(data.expiry_at||""))||now+15*60*1000;
  await env.AUTH_DB.prepare("UPDATE membership_orders SET provider_transaction_id=?1,provider_payment_url=?2,provider_qr_url=?3,provider_qr_string=?4,provider_total_amount=?5,provider_fee_amount=?6,provider_expires_at=?7,note='Invoice AirPay dibuat' WHERE id=?8 AND status='pending'").bind(tx,payUrl||null,qrUrl||null,String(data.qr_string||"").slice(0,4000)||null,total,fee,expiry,id).run();
  return json({
   ok:true,
   order:{id,planId:plan.id,planName:plan.name,period:plan.period,amount:plan.price,status:"pending"},
   payment:{provider:"AirPay",transactionId:tx,externalId:id,payUrl:payUrl||null,qrUrl:qrUrl||null,qrString:data.qr_string||null,baseAmount:numericIfPresent(data.base_amount)??plan.price,feeAmount:fee,totalAmount:total,expiresAt:expiry,status:String(data.status||"Pending")},
   message:"Invoice QRIS berhasil dibuat. Pembayaran akan diverifikasi otomatis oleh ARYANZZ."
  },201);
 }catch(error){
  await env.AUTH_DB.prepare("UPDATE membership_orders SET status='rejected',note=?1 WHERE id=?2 AND status='pending'").bind(("AirPay gagal membuat invoice: "+String(error?.message||error)).slice(0,280),id).run().catch(()=>{});
  return json({ok:false,error:"Invoice AirPay gagal dibuat. "+String(error?.message||"Silakan coba lagi.")},502);
 }
}
async function pollOrderStatus(request,env,user,url){
 const id=String(url.searchParams.get("orderId")||"").slice(0,100);
 if(!id)return json({ok:false,error:"orderId wajib diisi."},400);
 const order=await env.AUTH_DB.prepare("SELECT * FROM membership_orders WHERE id=?1 AND user_id=?2 LIMIT 1").bind(id,user.id).first();
 if(!order)return json({ok:false,error:"Pesanan tidak ditemukan."},404);
 if(order.status==="paid")return json({ok:true,status:"paid",membership:await membershipFor(user.id,env),orderId:id});
 if(order.payment_provider!=="airpay"||!order.provider_transaction_id)return json({ok:false,error:"Invoice AirPay belum tersedia."},409);
 try{
  const result=await fetchAirpayStatus(order,env);
  if(result.state==="paid"){
   const activated=await activateMembership(order,String(order.provider_transaction_id),env);
   return json({ok:true,status:"paid",duplicate:!!activated.duplicate,membership:await membershipFor(user.id,env),orderId:id});
  }
  if(result.state==="expired"||result.state==="failed"){
   await env.AUTH_DB.prepare("UPDATE membership_orders SET status='expired',note='Status invoice AirPay: "+result.state+"' WHERE id=?1 AND user_id=?2 AND status='pending'").bind(id,user.id).run();
  }
  return json({ok:true,status:result.state,providerStatus:result.rawStatus,orderId:id,expiresAt:order.provider_expires_at||null});
 }catch(error){
  return json({ok:false,status:"unknown",error:"Status pembayaran belum dapat diperiksa. "+String(error?.message||"").slice(0,150)},502);
 }
}
async function handleAirpayMembership(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==="/api/membership/webhook")return handleAirpayWebhook(request,env);
 if(path==="/api/membership/catalog"&&request.method==="GET")return json({ok:true,pricingStatus:"configured",paymentEnabled:!!env.AUTH_DB,provider:"AirPay",plans:planCatalog(),free:{id:"free",name:"Free",price:0,summary:"Fitur dasar ARYANZZ tetap dapat digunakan tanpa membership."}});
 if(path==="/api/membership/payment-config"&&request.method==="GET"){
  const dbReady=!!env.AUTH_DB&&typeof env.AUTH_DB.prepare==="function";
  const keyReady=airpayKeyReady(env);
  const missing=[];if(!dbReady)missing.push("AUTH_DB · database akun ARYANZZ");if(!keyReady)missing.push("AIRPAY_API_KEY · API key AirPay sandbox/live");
  return json({ok:true,enabled:dbReady&&keyReady,checkoutEnabled:dbReady&&keyReady,dbReady,apiKeyReady:keyReady,provider:"AirPay",mode:airpayMode(env),webhookSupported:true,pollingFallback:true,webhookUrl:new URL("/api/membership/webhook",url.origin).toString(),missing,message:missing.length?"Pembayaran belum siap: "+missing.join("; "):"Checkout AirPay siap. Pembayaran diproses melalui QRIS dan diverifikasi melalui webhook/status API."});
 }
 if(path==="/api/membership/webhook")return handleAirpayWebhook(request,env);
 if(!env.AUTH_DB||typeof env.AUTH_DB.prepare!=="function")return json({ok:false,error:"Database akun belum dikonfigurasi."},503);
 if(path==="/api/membership/me"&&request.method==="GET"){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Silakan login terlebih dahulu."},401);
  const membership=await membershipFor(user.id,env);
  const rows=await env.AUTH_DB.prepare("SELECT id,plan_id,amount,status,payment_provider,provider_transaction_id,provider_payment_url,provider_qr_url,provider_total_amount,provider_fee_amount,provider_expires_at,created_at,paid_at,expires_at,note FROM membership_orders WHERE user_id=?1 ORDER BY created_at DESC LIMIT 20").bind(user.id).all();
  return json({ok:true,user:{id:user.id,role:user.role},membership,orders:rows.results||[]});
 }
 if(path==="/api/membership/orders"&&request.method==="POST"){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Silakan login terlebih dahulu."},401);
  if(!airpayKeyReady(env))return json({ok:false,error:"AIRPAY_API_KEY belum dipasang pada Cloudflare Worker. Pembayaran belum dibuka."},503);
  return createAirpayOrder(request,env,user);
 }
 if(path==="/api/membership/orders/status"&&request.method==="GET"){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Silakan login terlebih dahulu."},401);
  return pollOrderStatus(request,env,user,url);
 }
 if(path==="/api/membership/admin/orders"&&request.method==="GET"){
  const admin=await adminUser(request,env);if(!admin)return json({ok:false,error:"Akses khusus pemilik."},403);
  const rows=await env.AUTH_DB.prepare("SELECT o.id,o.user_id,u.email,u.full_name,o.plan_id,o.amount,o.status,o.payment_provider,o.provider_transaction_id,o.created_at,o.paid_at,o.provider_expires_at,o.note FROM membership_orders o JOIN auth_users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 100").all();
  return json({ok:true,orders:rows.results||[]});
 }
 if(path==="/api/membership/admin/review"&&request.method==="POST")return json({ok:false,error:"Verifikasi manual dinonaktifkan. Membership hanya aktif setelah status AirPay terverifikasi."},403);
 return json({ok:false,error:"Endpoint Membership tidak ditemukan."},404);
}
export {handleAirpayMembership};
