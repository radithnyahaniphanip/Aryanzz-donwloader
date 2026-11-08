const PLANS=[
 {id:"starter",name:"Starter",price:80000,durationDays:30},
 {id:"plus",name:"Plus",price:140000,durationDays:60},
 {id:"pro",name:"Pro",price:189000,durationDays:90},
 {id:"elite",name:"Elite",price:328000,durationDays:180},
 {id:"ultimate",name:"Ultimate",price:500000,durationDays:365},
 {id:"lifetime",name:"Lifetime",price:1800000,durationDays:null},
 {id:"founder",name:"Founder Signature",price:5900000,durationDays:null}
];
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
const COOKIE="aryanzz_member";
const readCookie=(request)=>String(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||"";
const makeId=()=>crypto.randomUUID().replace(/-/g,"").toUpperCase();
const moneyDate=()=>Date.now();
async function verifySignature(request,secret){
 const raw=new Uint8Array(await request.arrayBuffer());
 const header=String(request.headers.get("Poketo-Signature")||"");
 const parts=Object.fromEntries(header.split(",").map(x=>{const i=x.indexOf("=");return i<0?[x,""]:[x.slice(0,i).trim(),x.slice(i+1).trim()]}));
 const t=String(parts.t||""),sig=String(parts.v1||"");
 if(!/^\d{10}$/.test(t)||Math.abs(Date.now()/1000-Number(t))>300||!/^[a-f0-9]{64}$/i.test(sig))return null;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(t+"."+new TextDecoder().decode(raw))));
 const expected=Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^sig.toLowerCase().charCodeAt(i);
 if(diff!==0)return null;
 try{return JSON.parse(new TextDecoder().decode(raw))}catch{return null}
}
export class MembershipStore{
 constructor(ctx,env){this.ctx=ctx;this.env=env}
 async session(request,create=false){
  let id=readCookie(request);
  if(id&&/^[A-F0-9]{32}$/.test(id)&&await this.ctx.storage.get("session:"+id))return {id,cookie:null};
  if(!create)return null;
  id=makeId();
  await this.ctx.storage.put("session:"+id,{createdAt:Date.now()});
  return {id,cookie:COOKIE+"="+id+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000"};
 }
 async fetch(request){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==="/api/membership/webhook")return this.webhook(request);
  if(path==="/api/membership/catalog"&&method==="GET")return json({ok:true,pricingStatus:"proposed",paymentEnabled:true,qrAvailable:false,plans:PLANS.map(p=>({...p,badge:p.name,summary:"Paket Membership ARYANZZ."})),free:{id:"free",name:"Free Member",price:0,summary:"Tetap tersedia tanpa pembayaran."}});
  if(path==="/api/membership/payment-config"&&method==="GET"){
   const apiKeyReady=/^sk_(test|live)_/.test(String(this.env.POKETO_SECRET_KEY||""));
   const webhookReady=/^whsec_/.test(String(this.env.POKETO_WEBHOOK_SECRET||""));
   const missing=[];if(!apiKeyReady)missing.push("API key Poketo belum dipasang di Cloudflare Worker");if(!webhookReady)missing.push("Rahasia webhook Poketo belum dipasang di Cloudflare Worker");
   const mode=String(this.env.POKETO_MODE|| (String(this.env.POKETO_SECRET_KEY||"").startsWith("sk_live_")?"live":"sandbox")).toLowerCase();
   return json({ok:true,enabled:apiKeyReady&&webhookReady,checkoutEnabled:apiKeyReady&&webhookReady,storageReady:true,dbReady:false,apiKeyReady,automaticWebhookReady:webhookReady,webhookReady,provider:"Poketo",mode,missing,webhookUrl:new URL("/api/membership/webhook",url.origin).toString()});
  }
  if(path==="/api/membership/me"&&method==="GET"){
   const session=await this.session(request,true);
   let membership=await this.ctx.storage.get("membership:"+session.id)||{tier:"free",status:"free",startedAt:null,expiresAt:null};
   if(membership.status==="active"&&membership.expiresAt&&Number(membership.expiresAt)<=Date.now()){
    membership={...membership,status:"expired",expiredAt:Date.now()};
    await this.ctx.storage.put("membership:"+session.id,membership);
   }
   const orders=await this.ctx.storage.get("orders:"+session.id)||[];
   return json({ok:true,user:{id:"GUEST-"+session.id.slice(0,12),role:"guest"},membership,orders:orders.slice(0,20).map(o=>({id:o.id,plan_id:o.planId,amount:o.amount,status:o.status,created_at:o.createdAt,paid_at:o.paidAt||null,expires_at:o.expiresAt||null,note:o.note||""}))},200,session.cookie?{"set-cookie":session.cookie}:{});
  }
  if(path==="/api/membership/orders"&&method==="POST"){
   const session=await this.session(request,false);
   if(!session)return json({ok:false,error:"Sesi pengunjung belum tersedia. Muat ulang halaman Membership."},401);
   if(!/^sk_(test|live)_/.test(String(this.env.POKETO_SECRET_KEY||"")))return json({ok:false,error:"API key pembayaran belum dikonfigurasi di server."},503);
   if(!/^whsec_/.test(String(this.env.POKETO_WEBHOOK_SECRET||"")))return json({ok:false,error:"Webhook pembayaran belum dikonfigurasi. Pembayaran ditahan agar Membership tidak gagal aktif."},503);
   let body;try{body=await request.json()}catch{return json({ok:false,error:"Data pesanan tidak valid."},400)}
   const plan=PLANS.find(p=>p.id===String(body?.planId||""));if(!plan)return json({ok:false,error:"Paket Membership tidak ditemukan."},400);
   const name=String(body.customerName||"").trim().replace(/\s+/g," ").slice(0,100);
   const email=String(body.customerEmail||"").trim().toLowerCase();
   if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({ok:false,error:"Format email tidak valid."},400);
   const old=await this.ctx.storage.get("orders:"+session.id)||[];
   const pending=old.find(x=>x.status==="pending"&&Date.now()-x.createdAt<86400000);
   if(pending)return json({ok:false,error:"Masih ada pembayaran yang menunggu. Selesaikan atau tunggu kedaluwarsa.",orderId:pending.id},409);
   const now=Date.now(),id="ARYM-"+now.toString(36).toUpperCase()+"-"+makeId().slice(0,8);
   const order={id,userId:session.id,planId:plan.id,planName:plan.name,amount:plan.price,status:"pending",paymentProvider:"poketo",createdAt:now,customerName:name,customerEmail:email};
   await this.ctx.storage.put("order:"+id,order);
   await this.ctx.storage.put("orders:"+session.id,[order,...old].slice(0,50));
   const site=url.origin;
   const payload={referenceId:id,amount:plan.price,title:"ARYANZZ Membership · "+plan.name,description:"Membership "+plan.name,...(name||email?{customer:{...(name?{name}:{}),...(email?{email}:{})}}:{}),expiresInMinutes:1440,redirectUrl:site+"/?membership=return&order="+encodeURIComponent(id),metadata:{orderId:id,sessionId:session.id,planId:plan.id}};
   try{
    const response=await fetch("https://poketo.id/api/v1/invoices",{method:"POST",headers:{authorization:"Bearer "+this.env.POKETO_SECRET_KEY,"content-type":"application/json","idempotency-key":id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(!response.ok||data?.error)throw new Error(data?.error?.message||data?.error?.code||"Gateway menolak pembuatan invoice.");
    const invoice=data.data||data;if(!invoice.id||!invoice.paymentUrl)throw new Error("Gateway tidak mengembalikan link pembayaran.");
    order.invoiceId=invoice.id;order.paymentUrl=invoice.paymentUrl;order.expiresAt=invoice.expiresAt||null;
    await this.ctx.storage.put("order:"+id,order);
    await this.ctx.storage.put("orders:"+session.id,[order,...old].slice(0,50));
    return json({ok:true,order:{id,planId:plan.id,planName:plan.name,amount:plan.price,status:"pending"},payment:{provider:"Poketo",invoiceId:invoice.id,paymentUrl:invoice.paymentUrl,expiresAt:invoice.expiresAt||null}},201);
   }catch(error){
    order.status="rejected";order.note=String(error?.message||error).slice(0,250);
    await this.ctx.storage.put("order:"+id,order);
    await this.ctx.storage.put("orders:"+session.id,[order,...old].slice(0,50));
    return json({ok:false,error:"Invoice gagal dibuat: "+order.note},502);
   }
  }
  if(path==="/api/membership/payment-methods"&&method==="GET"){
   const amount=Math.max(10000,Math.min(10000000,Math.floor(Number(url.searchParams.get("amount"))||80000)));
   if(!/^sk_/.test(String(this.env.POKETO_SECRET_KEY||"")))return json({ok:false,error:"API key pembayaran belum dipasang."},503);
   try{const r=await fetch("https://poketo.id/api/v1/payment-methods?amount="+amount,{headers:{authorization:"Bearer "+this.env.POKETO_SECRET_KEY},signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Metode pembayaran belum tersedia.");return json({ok:true,methods:d.data||d.methods||d})}catch(e){return json({ok:false,error:String(e.message||e)},502)}
  }
  if(path==="/api/membership/admin/orders"&&method==="GET")return json({ok:false,error:"Riwayat semua pelanggan hanya tersedia untuk pemilik terverifikasi."},403);
  return json({ok:false,error:"Endpoint Membership tidak ditemukan."},404);
 }
 async webhook(request){
  if(request.method!=="POST")return json({ok:false,error:"Method tidak diizinkan."},405);
  const secret=String(this.env.POKETO_WEBHOOK_SECRET||"");if(!secret.startsWith("whsec_"))return json({ok:false,error:"Webhook belum dikonfigurasi."},503);
  const event=await verifySignature(request,secret);if(!event)return json({ok:false,error:"Tanda tangan webhook tidak valid."},400);
  const eventId=String(event.id||"").slice(0,120);if(!eventId)return json({ok:false,error:"ID event tidak tersedia."},400);
  if(await this.ctx.storage.get("event:"+eventId))return json({ok:true,duplicate:true});
  if(event.type==="ping"){await this.ctx.storage.put("event:"+eventId,{receivedAt:Date.now()});return json({ok:true})}
  const invoice=event.data||{},orderId=String(invoice.referenceId||invoice.metadata?.orderId||"");
  const order=await this.ctx.storage.get("order:"+orderId);
  if(!order)return json({ok:false,error:"Pesanan tidak ditemukan."},404);
  const mode=String(this.env.POKETO_MODE|| (String(this.env.POKETO_SECRET_KEY||"").startsWith("sk_live_")?"live":"sandbox")).toLowerCase();
  if(String(event.environment||"")!==mode)return json({ok:false,error:"Mode pembayaran tidak cocok."},409);
  if(event.type==="invoice.paid"){
   if(invoice.status!=="paid"||!invoice.id||Number(invoice.amount)!==order.amount)return json({ok:false,error:"Status atau nominal pembayaran tidak cocok."},409);
   if(order.status==="paid"&&order.invoiceId===invoice.id){await this.ctx.storage.put("event:"+eventId,{receivedAt:Date.now()});return json({ok:true,duplicate:true})}
   if(order.status!=="pending"||order.invoiceId&&order.invoiceId!==invoice.id)return json({ok:false,error:"Pesanan tidak lagi menunggu pembayaran."},409);
   const plan=PLANS.find(p=>p.id===order.planId);if(!plan)return json({ok:false,error:"Paket tidak valid."},400);
   const now=Date.now(),previous=await this.ctx.storage.get("membership:"+order.userId);
   const lifetimeAlreadyActive=previous?.status==="active"&&previous.expiresAt===null&&previous.tier&&previous.tier!=="free";
   const base=previous?.status==="active"&&previous.expiresAt?Math.max(now,previous.expiresAt):now;
   const expires=lifetimeAlreadyActive?null:(plan.durationDays===null?null:base+plan.durationDays*86400000);
   order.status="paid";order.paidAt=now;order.invoiceId=invoice.id;
   await this.ctx.storage.put("order:"+orderId,order);
   const orders=await this.ctx.storage.get("orders:"+order.userId)||[];
   await this.ctx.storage.put("orders:"+order.userId,orders.map(x=>x.id===orderId?order:x));
   await this.ctx.storage.put("membership:"+order.userId,{tier:lifetimeAlreadyActive?"lifetime":plan.id,planName:lifetimeAlreadyActive?"Lifetime":plan.name,status:"active",startedAt:now,expiresAt:expires,sourceOrderId:orderId});
   await this.ctx.storage.put("event:"+eventId,{receivedAt:now});
   return json({ok:true,message:"Pembayaran terverifikasi. Membership aktif.",orderId});
  }
  if(event.type==="invoice.expired"||event.type==="invoice.cancelled"||event.type==="invoice.refunded"){
   order.status=event.type==="invoice.expired"?"expired":event.type==="invoice.refunded"?"refunded":"cancelled";order.note=event.type;
   await this.ctx.storage.put("order:"+orderId,order);
   const orders=await this.ctx.storage.get("orders:"+order.userId)||[];
   await this.ctx.storage.put("orders:"+order.userId,orders.map(x=>x.id===orderId?order:x));
   if(event.type==="invoice.refunded"){const membership=await this.ctx.storage.get("membership:"+order.userId);if(membership?.sourceOrderId===orderId){membership.status="revoked";membership.revokedAt=Date.now();await this.ctx.storage.put("membership:"+order.userId,membership)}}
  }
  await this.ctx.storage.put("event:"+eventId,{receivedAt:Date.now()});
  return json({ok:true});
 }
}
