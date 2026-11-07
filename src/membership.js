const COOKIE="aryanzz_session";
const ADMIN_ID="ARY-ZFTLQPEX92";
function poketoMode(env){const explicit=String(env.POKETO_MODE||"").toLowerCase();if(explicit==="live"||explicit==="sandbox")return explicit;return String(env.POKETO_SECRET_KEY||"").startsWith("sk_live_")?"live":"sandbox";}
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
const DEFAULT_MERCHANT_QRIS_DATA_URI="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAcgAAAHIAQAAAADi2kdHAAADiUlEQVR42u1cvY4eQQizo7z/KzsF4EFXRalYxVd9O7c0RvwZz1L4x79fiGUsYxnLWMbyf7X8DQCs36L6QYQoEBBF/69/Awq2l/0JlVcFLv9RoiCofMz9ZrA97U8Q5bbV7VLgnIkEytFsnwbb+5YSOA6UCJEQWGcCFGw/Ep+OyaqhFYesKBU6NhVsv+JPTYrt4li1FN0RlUPL0wq29y1J8lVHB+QUzelrud4Mtict+ZPvIybl1oTy4yDYfsCSVSprUOloJEESoASRM7Jw3g62X4jPmliqjj5GYYetT4Lt5fhkx2eHIu1dVXktosjlNdje7ockdrmUoMUFqcbR4otcUYPt6Xy7KNtOrVVIgSH71MNLNbwKtrfrZ3F7Jm/xeHfat8ulwfasJSS5JAqQ+ldnXpnp24yfJAXbw/m22aCqlp1w+xA7B/OdBdvL8wrd+0zyneeplzSHy+w/z1tOY8vZmU165fgQkDpK0w99oL91RNJ9kAP15dt+CLbH+1s6kxZ1IDzXOhXPa8H2rOVvzyd8Ofa1PeIbXmYcVeLzuCW7XtaESdqFozgRpZYveGoJtnfr53B4gOvjOtgVFAgf/4l+yL3sZozeeAprxmYbGmzvWlqUObFJLzv7dI0tfRZs71qalpW4OFrVwYhwNe8E29v9bWsyuzKaeHdfa2k8F6MUbO/OK0PcLuGX7Dk9T9eb2X8e92f5ipL7V77tmJVD8j4088rxfNtXV/r20Sqg3d/SQfx01cH28vz5RhS82OyOVr5nNixg5s/T/sSSBi3/Yj2Mw5vcDbZHLVufoBEnzKOwpHx6P0e6EH3C7f7WI+aLSk6b1Po+Ty7B9ro/5bWYmQOr+ezHIRuYffYXLGVXcnWxmpqqoYyU+Dwfn9PqOBhbFda37jtuufSbwfbyvGJJwtP00YJqS8Z21xtsD1t2QM6FXdKkfK2w63aLOFdcgu11SxKSBX3V8JLzHQy1MKxUCk3yBtuz9fN93WTIgvctk+Fw5yDYfoAfmofV4a7vJ7yvSa3xM9iejs8uo8XHq+fP2oZ6oOEmHILtYUtpqiekJy/RUEfeqwhVZ4Pt8fnTCpPuhJbmT09z/SRGwfa0P9/fU1B7faa5GNqak8TnRyypmkmaiPfkib3Wjr7vA/H5lEJDAq2vgfWS25cdsv88Pq/wpVr8vN+7GlxgfXIz2N6fP4NQLGMZy1jGMpZ/9fcHtN8zewvu/VIAAAAASUVORK5CYII=";
function safeQrisImage(env){
 const raw=String(env.MEMBERSHIP_QRIS_IMAGE_URL||"").trim();
 if(!raw)return DEFAULT_MERCHANT_QRIS_DATA_URI;
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

async function verifyPoketoWebhook(request,env){
 const secret=String(env.POKETO_WEBHOOK_SECRET||"");
 if(!secret.startsWith("whsec_")||secret.length<20)return null;
 const raw=new Uint8Array(await request.arrayBuffer());
 const header=String(request.headers.get("Poketo-Signature")||"");
 const parts=Object.fromEntries(header.split(",").map(x=>{const i=x.indexOf("=");return i<0?[x,""]:[x.slice(0,i).trim(),x.slice(i+1).trim()]}));
 const timestamp=String(parts.t||""),signature=String(parts.v1||"");
 if(!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||!/^[a-f0-9]{64}$/i.test(signature))return null;
 const bodyText=new TextDecoder().decode(raw);
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=new TextEncoder().encode(timestamp+"."+bodyText);
 const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,signed));
 const expected=Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.toLowerCase().charCodeAt(i);
 if(diff!==0)return null;
 try{return JSON.parse(bodyText)}catch{return null}
}
async function membershipWebhook(request,env){
 if(request.method!=="POST")return json({ok:false,error:"Method tidak diizinkan."},405);
 if(!env.AUTH_DB||typeof env.AUTH_DB.prepare!=="function")return json({ok:false,error:"Database akun belum dikonfigurasi."},503);
 const event=await verifyPoketoWebhook(request,env);
 if(!event)return json({ok:false,error:"Tanda tangan Poketo tidak valid atau sudah kedaluwarsa."},400);
 const eventId=String(request.headers.get("Poketo-Event-Id")||event.id||"").slice(0,120);
 const type=String(event.type||request.headers.get("Poketo-Event")||"");
 if(!eventId)return json({ok:false,error:"ID event Poketo tidak tersedia."},400);
 const existing=await env.AUTH_DB.prepare("SELECT event_id FROM poketo_webhook_events WHERE event_id=?1 LIMIT 1").bind(eventId).first().catch(()=>null);
 if(existing)return json({ok:true,duplicate:true});
 if(type==="ping"){
  await env.AUTH_DB.prepare("INSERT OR IGNORE INTO poketo_webhook_events (event_id,event_type,received_at) VALUES (?1,?2,?3)").bind(eventId,type,Date.now()).run();
  return json({ok:true});
 }
 const invoice=event.data||{};
 const orderId=String(invoice.referenceId||invoice.metadata?.orderId||"").slice(0,80);
 if(!orderId)return json({ok:false,error:"Referensi pesanan tidak ditemukan."},400);
 const order=await env.AUTH_DB.prepare("SELECT * FROM membership_orders WHERE id=?1 LIMIT 1").bind(orderId).first();
 if(!order)return json({ok:false,error:"Pesanan ARYANZZ tidak ditemukan."},404);
 if(String(event.environment||"")!==String(poketoMode(env)))return json({ok:false,error:"Environment Poketo tidak cocok dengan mode ARYANZZ."},409);
 const invoiceId=String(invoice.id||"").slice(0,160);
 if(type==="invoice.paid"){
  const amount=Number(invoice.amount);
  if(invoice.status!=="paid"||!invoiceId||amount!==Number(order.amount))return json({ok:false,error:"Status, ID invoice, atau nominal Poketo tidak cocok."},409);
  if(order.status==="paid"&&order.provider_transaction_id===invoiceId){
   await env.AUTH_DB.prepare("INSERT OR IGNORE INTO poketo_webhook_events (event_id,event_type,received_at) VALUES (?1,?2,?3)").bind(eventId,type,Date.now()).run();
   return json({ok:true,duplicate:true});
  }
  if(order.status!=="pending"||order.payment_provider!=="poketo")return json({ok:false,error:"Pesanan bukan invoice Poketo yang menunggu pembayaran."},409);
  const plan=PLANS.find(p=>p.id===order.plan_id);if(!plan)return json({ok:false,error:"Paket pesanan tidak valid."},400);
  const now=Date.now(),existingMembership=await membershipFor(order.user_id,env);
  const base=existingMembership.status==="active"&&existingMembership.expiresAt?Math.max(now,existingMembership.expiresAt):now;
  const expires=plan.durationDays===null?null:base+plan.durationDays*86400000;
  const results=await env.AUTH_DB.batch([
   env.AUTH_DB.prepare("UPDATE membership_orders SET status='paid',paid_at=?1,expires_at=?2,provider_transaction_id=?3,note='Pembayaran Poketo terverifikasi melalui webhook' WHERE id=?4 AND status='pending' AND amount=?5 AND payment_provider='poketo'").bind(now,expires,invoiceId,orderId,amount),
   env.AUTH_DB.prepare("INSERT INTO user_memberships (user_id,plan_id,status,started_at,expires_at,updated_at) SELECT ?1,?2,'active',?3,?4,?3 WHERE EXISTS (SELECT 1 FROM membership_orders WHERE id=?5 AND status='paid' AND provider_transaction_id=?6) ON CONFLICT(user_id) DO UPDATE SET plan_id=excluded.plan_id,status='active',started_at=excluded.started_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(order.user_id,plan.id,now,expires,orderId,invoiceId),
   env.AUTH_DB.prepare("INSERT OR IGNORE INTO poketo_webhook_events (event_id,event_type,received_at) VALUES (?1,?2,?3)").bind(eventId,type,now)
  ]);
  if(Number(results?.[0]?.meta?.changes||0)!==1)return json({ok:false,error:"Pesanan sudah diproses atau transaksi sudah pernah digunakan."},409);
  return json({ok:true,message:"Pembayaran Poketo terverifikasi. Membership aktif.",orderId});
 }
 if(["invoice.expired","invoice.cancelled","invoice.refunded"].includes(type)){
  const next=type==="invoice.expired"?"expired":"rejected";
  await env.AUTH_DB.batch([
   env.AUTH_DB.prepare("UPDATE membership_orders SET status=?1,note=?2 WHERE id=?3 AND status IN ('pending','paid')").bind(next,"Status diperbarui oleh webhook Poketo: "+type,orderId),
   ...(type==="invoice.refunded"&&order.status==="paid"?[env.AUTH_DB.prepare("UPDATE user_memberships SET status='revoked',updated_at=?1 WHERE user_id=?2 AND plan_id=?3 AND started_at=?4 AND status='active'").bind(Date.now(),order.user_id,order.plan_id,Number(order.paid_at||0))]:[]),
   env.AUTH_DB.prepare("INSERT OR IGNORE INTO poketo_webhook_events (event_id,event_type,received_at) VALUES (?1,?2,?3)").bind(eventId,type,Date.now())
  ]);
  return json({ok:true,message:"Status invoice diperbarui."});
 }
 await env.AUTH_DB.prepare("INSERT OR IGNORE INTO poketo_webhook_events (event_id,event_type,received_at) VALUES (?1,?2,?3)").bind(eventId,type,Date.now()).run();
 return json({ok:true,ignored:true});
}
async function handleMembership(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==="/api/membership/webhook")return membershipWebhook(request,env);
 if(path==="/api/cosmetics/me"||path==="/api/cosmetics/equip"||path==="/api/redeem/claim"||path==="/api/membership/admin/redeem-codes")return handleCosmetics(request,env);
 if(path==="/api/membership/catalog"&&request.method==="GET")return json({ok:true,pricingStatus:"proposed",paymentEnabled:!!env.AUTH_DB,qrAvailable:!!safeQrisImage(env),plans:PLANS,free:{id:"free",name:"Free Member",price:0,summary:"Tetap tersedia tanpa pembayaran."}});
 if(path==="/api/membership/payment-config"&&request.method==="GET"){
  const dbReady=!!env.AUTH_DB&&typeof env.AUTH_DB.prepare==="function";
  const apiKeyReady=/^sk_(test|live)_/.test(String(env.POKETO_SECRET_KEY||""));
  const webhookReady=/^whsec_/.test(String(env.POKETO_WEBHOOK_SECRET||""));
  const missing=[];if(!dbReady)missing.push("AUTH_DB · database D1 ARYANZZ");if(!apiKeyReady)missing.push("POKETO_SECRET_KEY · API key sandbox/live");if(!webhookReady)missing.push("POKETO_WEBHOOK_SECRET · signing secret webhook");
  return json({ok:true,enabled:apiKeyReady,checkoutEnabled:dbReady,dbReady,apiKeyReady,automaticWebhookReady:webhookReady,webhookReady,provider:"Poketo",mode:env.POKETO_MODE==="live"?"live":"sandbox",webhookUrl:new URL("/api/membership/webhook",url.origin).toString(),missing,message:missing.length?"Pembayaran belum siap: "+missing.join("; "):"Checkout Poketo dan aktivasi otomatis siap. Metode pembayaran ditampilkan pada checkout resmi."});
 }
 if(!env.AUTH_DB||typeof env.AUTH_DB.prepare!=="function")return json({ok:false,error:"Database akun belum dikonfigurasi."},503);
 if(path==="/api/membership/me"&&request.method==="GET"){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Silakan login terlebih dahulu."},401);
  const membership=await membershipFor(user.id,env);
  const orders=await env.AUTH_DB.prepare("SELECT id,plan_id,amount,status,created_at,paid_at,expires_at,note FROM membership_orders WHERE user_id=?1 ORDER BY created_at DESC LIMIT 20").bind(user.id).all();
  return json({ok:true,user:{id:user.id,role:user.role},membership,orders:orders.results||[]});
 }
 if(path==="/api/membership/orders"&&request.method==="POST"){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Silakan login terlebih dahulu."},401);
  if(!/^sk_(test|live)_/.test(String(env.POKETO_SECRET_KEY||"")))return json({ok:false,error:"POKETO_SECRET_KEY belum terpasang pada Worker ARYANZZ."},503);
  if(!/^whsec_/.test(String(env.POKETO_WEBHOOK_SECRET||"")))return json({ok:false,error:"POKETO_WEBHOOK_SECRET belum terpasang. Pembayaran ditahan agar tidak ada transaksi tanpa aktivasi Membership otomatis."},503);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"Data pesanan tidak valid."},400)}
  const plan=PLANS.find(p=>p.id===String(body?.planId||""));if(!plan)return json({ok:false,error:"Paket Membership tidak ditemukan."},400);
  await env.AUTH_DB.prepare("UPDATE membership_orders SET status='expired',note='Invoice melewati batas pembayaran' WHERE user_id=?1 AND status='pending' AND created_at<=?2").bind(user.id,Date.now()-24*60*60*1000).run();
  const pending=await env.AUTH_DB.prepare("SELECT id FROM membership_orders WHERE user_id=?1 AND status='pending' AND created_at>?2 LIMIT 1").bind(user.id,Date.now()-24*60*60*1000).first();
  if(pending)return json({ok:false,error:"Masih ada invoice yang menunggu pembayaran.",orderId:pending.id},409);
  const now=Date.now(),id="ARYM-"+now.toString(36).toUpperCase()+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
  await env.AUTH_DB.prepare("INSERT INTO membership_orders (id,user_id,plan_id,amount,status,payment_provider,created_at) VALUES (?1,?2,?3,?4,'pending','poketo',?5)").bind(id,user.id,plan.id,plan.price,now).run();
  const site=new URL(request.url).origin;
  const payload={referenceId:id,amount:plan.price,title:"ARYANZZ Membership · "+plan.name,description:"Membership "+plan.name+" selama "+(plan.durationDays===null?"permanen":plan.durationDays+" hari"),customer:{name:String(user.full_name||user.email||"Pengguna ARYANZZ").slice(0,100),email:user.email},expiresInMinutes:1440,redirectUrl:site+"/?membership=return&order="+encodeURIComponent(id),metadata:{orderId:id,userId:user.id,planId:plan.id}};
  let response,data;
  try{
   response=await fetch("https://poketo.id/api/v1/invoices",{method:"POST",headers:{"authorization":"Bearer "+env.POKETO_SECRET_KEY,"content-type":"application/json","idempotency-key":id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   data=await response.json();
   if(!response.ok||data?.error)throw new Error(data?.error?.message||data?.error?.code||"Poketo gagal membuat invoice.");
   const invoice=data?.data||data;
   if(!invoice?.id||!invoice?.paymentUrl)throw new Error("Respons Poketo tidak memuat invoice ID dan paymentUrl.");
   await env.AUTH_DB.prepare("UPDATE membership_orders SET note=?1 WHERE id=?2 AND status='pending'").bind("Poketo invoice "+String(invoice.id).slice(0,150),id).run();
   return json({ok:true,order:{id,planId:plan.id,planName:plan.name,amount:plan.price,status:"pending",paymentProvider:"poketo"},payment:{provider:"Poketo",invoiceId:invoice.id,paymentUrl:invoice.paymentUrl,expiresAt:invoice.expiresAt||null},message:"Invoice berhasil dibuat. Lanjutkan pembayaran melalui checkout Poketo."},201);
  }catch(error){
   await env.AUTH_DB.prepare("UPDATE membership_orders SET status='rejected',note=?1 WHERE id=?2 AND status='pending'").bind(("Gagal membuat invoice Poketo: "+String(error?.message||error)).slice(0,300),id).run().catch(()=>{});
   return json({ok:false,error:"Invoice Poketo gagal dibuat. "+String(error?.message||"Silakan coba lagi.")},502);
  }
 }
 if(path==="/api/membership/payment-methods"&&request.method==="GET"){
  const amount=Math.max(10000,Math.min(10000000,Math.floor(Number(url.searchParams.get("amount"))||80000)));
  if(!String(env.POKETO_SECRET_KEY||"").startsWith("sk_"))return json({ok:false,error:"Poketo belum dikonfigurasi."},503);
  try{
   const r=await fetch("https://poketo.id/api/v1/payment-methods?amount="+amount,{headers:{authorization:"Bearer "+env.POKETO_SECRET_KEY},signal:AbortSignal.timeout(10000)});
   const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Gagal mengambil metode pembayaran.");
   return json({ok:true,methods:d.data||d.methods||d});
  }catch(error){return json({ok:false,error:String(error?.message||"Metode pembayaran belum tersedia.")},502)}
 }
 if(path==="/api/membership/admin/orders"&&request.method==="GET"){
  const admin=await adminUser(request,env);if(!admin)return json({ok:false,error:"Akses khusus pemilik."},403);
  const rows=await env.AUTH_DB.prepare("SELECT o.id,o.user_id,u.email,u.full_name,o.plan_id,o.amount,o.status,o.created_at,o.paid_at,o.expires_at,o.note FROM membership_orders o JOIN auth_users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 100").all();
  return json({ok:true,orders:rows.results||[]});
 }
 if(path==="/api/membership/admin/review"&&request.method==="POST"){
  const admin=await adminUser(request,env);if(!admin)return json({ok:false,error:"Akses khusus pemilik."},403);
  return json({ok:false,error:"Verifikasi manual dinonaktifkan. Membership hanya aktif dari invoice Poketo berstatus paid dengan webhook yang valid."},403);
 }
 return json({ok:false,error:"Endpoint Membership tidak ditemukan."},404);
}
export {handleMembership};
