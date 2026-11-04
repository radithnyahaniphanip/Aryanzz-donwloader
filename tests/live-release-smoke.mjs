import assert from "node:assert/strict";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/,"");
const request=(path,init={})=>fetch(base+path,{cache:"no-store",signal:AbortSignal.timeout(15000),...init});

let health,lastError;
for(let attempt=0;attempt<18;attempt++){
  try{
    const response=await request("/api/health");
    if(response.ok)health=await response.json();
    if(/^\d+\.\d+$/.test(String(health?.version||"")))break;
    lastError=new Error("Worker belum melaporkan versi build: "+String(health?.version||"kosong"));
  }catch(error){lastError=error;}
  await new Promise(resolve=>setTimeout(resolve,3000));
}
assert.match(String(health?.version||""),/^\d+\.\d+$/,"Live Worker tidak melaporkan versi build: "+String(lastError?.message||""));
assert.equal(health?.mode,"cloudflare-worker-zero-server-hybrid");
assert.equal(health?.securityActive,true);
const version=String(health.version);

const securityResponse=await request("/api/security/status");
assert.equal(securityResponse.status,200);
const security=await securityResponse.json();
assert.equal(security?.security?.active,true);

const rejectedBypass=await request("/api/link-bypass?url="+encodeURIComponent("https://example.com/"));
assert.equal(rejectedBypass.status,400,"Link Bypass harus menolak domain di luar allowlist SFL");
assert.equal((await rejectedBypass.json()).ok,false);

const ping=await request("/api/speedtest/ping?live-smoke=1");
assert.equal(ping.status,204,"Endpoint ping Speed Test harus menjawab 204");
const downloadBytes=65536;
const speedDownload=await request("/api/speedtest/download?bytes="+downloadBytes+"&live-smoke=1");
assert.equal(speedDownload.status,200,"Endpoint download Speed Test gagal");
assert.equal((await speedDownload.arrayBuffer()).byteLength,downloadBytes,"Ukuran payload download Speed Test tidak sesuai");
const uploadBytes=32768;
const speedUpload=await request("/api/speedtest/upload?live-smoke=1",{method:"POST",headers:{"content-type":"application/octet-stream"},body:new Uint8Array(uploadBytes)});
assert.equal(speedUpload.status,200,"Endpoint upload Speed Test gagal");
const uploadResult=await speedUpload.json();
assert.equal(uploadResult?.ok,true);
assert.equal(uploadResult?.received,uploadBytes);

const homeResponse=await request("/");
assert.equal(homeResponse.status,200);
const html=await homeResponse.text();
assert.ok(html.includes("V"+version+" · GRATIS"),"Label homepage tidak cocok dengan versi Worker");
for(const marker of [
  "/speed-test.js?v=94.6",
  'id="networkProfile"',
  'id="speedBtn"',
  'id="linkBypass"',
  'id="sflBypassForm"',
  "/link-bypass.js?v=94.0",
  "/link-bypass.css?v=94.0",
  "/v89.css?v=93.2",
  "/v25.js?v=94.0",
  'id="mediaStudio"',
  'id="queue"',
  'id="securityCenter"',
  'id="audioStudioStart"',
  'id="audioStudioEnd"',
  'id="audioStudioFormat"',
  'id="audioStudioTestEngine"',
  'id="audioStudioDiagnosticsResult"',
  'id="v89Welcome"'
])assert.ok(html.includes(marker),"Homepage kehilangan elemen/asset: "+marker);

const assetRefs=[...html.matchAll(/(?:src|href)="(\/(?:[^"]+\.(?:js|css))(?:\?[^"]*)?)"/g)].map(match=>match[1]);
assert.ok(assetRefs.length>=15,"Homepage tidak memuat kumpulan aset aplikasi yang diharapkan");
for(const path of [...new Set(assetRefs)]){
  const response=await request(path);
  assert.equal(response.status,200,"Aset live tidak ditemukan: "+path);
}
const swResponse=await request("/sw.js");
assert.equal(swResponse.status,200,"Service worker tidak tersedia");
const sw=await swResponse.text();
assert.ok(sw.includes("aryanzz-build-"+version),"Namespace cache PWA tidak mengikuti versi build");
assert.ok(sw.includes("/speed-test.js?v=94.6"),"Service worker belum mencache controller Speed Test");
console.log("✔ Cloudflare Worker health: "+version);
console.log("✔ Security middleware and Link Bypass validation are active");
console.log("✔ Speed Test ping, download and upload endpoints pass live HTTP checks");
console.log("✔ Homepage, Profile, media tools, adaptive network selector and PWA assets are live");
