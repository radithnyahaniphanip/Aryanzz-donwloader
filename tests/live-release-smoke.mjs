import assert from "node:assert/strict";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/,"");
const request=(path,init={})=>fetch(base+path,{cache:"no-store",signal:AbortSignal.timeout(15000),...init});

let health,lastError;
for(let attempt=0;attempt<18;attempt++){
  try{
    const response=await request("/api/health");
    if(response.ok)health=await response.json();
    if(/^\d+\.\d+\.\d+$/.test(String(health?.version||"")))break;
    lastError=new Error("Worker belum melaporkan versi build: "+String(health?.version||"kosong"));
  }catch(error){lastError=error;}
  await new Promise(resolve=>setTimeout(resolve,3000));
}
assert.match(String(health?.version||""),/^\d+\.\d+\.\d+$/,"Live Worker tidak melaporkan versi build: "+String(lastError?.message||""));
assert.equal(health?.mode,"cloudflare-worker-zero-server-hybrid");
assert.equal(health?.securityActive,true);
const version=String(health.version);
const expectedVersion=String(process.env.EXPECTED_BUILD_VERSION||"");
assert.ok(expectedVersion,"Deployment must provide EXPECTED_BUILD_VERSION for live verification");
assert.equal(version,expectedVersion,"Live Worker version does not match the build that was just deployed");

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

let html="",homepageReady=false,lastHomepageStatus=0;
for(let attempt=0;attempt<15;attempt++){
  const homeResponse=await request("/");
  lastHomepageStatus=homeResponse.status;
  if(homeResponse.ok)html=await homeResponse.text();
  if(homeResponse.ok&&html.includes("V"+version+" · GRATIS")){homepageReady=true;break;}
  await new Promise(resolve=>setTimeout(resolve,2000));
}
assert.ok(homepageReady,"Homepage belum menyajikan versi "+version+" setelah menunggu propagasi aset; status HTTP "+lastHomepageStatus);
for(const marker of [
  "/speed-test.js?v="+version,
  'id="networkProfile"',
  'id="speedBtn"',
  'id="linkBypass"',
  'id="sflBypassForm"',
  "/link-bypass.js?v="+version,
  "/link-bypass.css?v="+version,
  "/v89.css?v="+version,
  "/v25.js?v="+version,
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
  const assetUrl=new URL(path,base);
  assert.equal(assetUrl.searchParams.get("v"),version,"Aset tidak memakai versi build yang sama: "+path);
  const response=await request(path);
  assert.equal(response.status,200,"Aset live tidak ditemukan: "+path);
}

const platformMatrixResponse=await request("/api/platform/status");
assert.equal(platformMatrixResponse.status,200,"Platform status endpoint gagal");
const platformMatrix=await platformMatrixResponse.json();
assert.equal(platformMatrix.platformCount,19,"Status platform harus melaporkan 19 pilihan");
const expectedPlatforms=["youtube","tiktok","instagram","snackvideo","capcut","pinterest","facebook","x","reddit","vimeo","threads","soundcloud","tiktoklite","facebooklite","snapchat","idnapp","instagramlite","linkedin","wechat","kakaotalk"];
for(const id of expectedPlatforms)assert.ok(platformMatrix.platforms.some(item=>item.id===id),"Platform tidak terdaftar: "+id);
console.log("✔ Platform status endpoint exposes all 19 platform choices.");

const releaseResponse=await request("/release.json");
assert.equal(releaseResponse.status,200,"Metadata release.json tidak tersedia");
const release=await releaseResponse.json();
assert.equal(release?.version,version,"Metadata release.json tidak cocok dengan Worker");
const manifestResponse=await request("/manifest.webmanifest?v="+version);
assert.equal(manifestResponse.status,200,"PWA manifest tidak tersedia");
const manifest=await manifestResponse.json();
assert.equal(manifest?.version,version,"PWA manifest belum mengikuti versi Worker");
const swResponse=await request("/sw.js");
assert.equal(swResponse.status,200,"Service worker tidak tersedia");
const sw=await swResponse.text();
assert.ok(sw.includes("aryanzz-build-"+version),"Namespace cache PWA tidak mengikuti versi build");
assert.ok(sw.includes("/speed-test.js?v="+version),"Service worker belum mencache controller Speed Test dengan versi terbaru");
assert.ok(sw.includes("/link-bypass.js?v="+version),"Service worker belum mencache Link Bypass dengan versi terbaru");
console.log("✔ Cloudflare Worker health matches expected build: "+version);
console.log("✔ release.json, PWA manifest, homepage, JS/CSS assets and service-worker cache all match "+version);
console.log("✔ Security middleware and Link Bypass validation are active");
console.log("✔ Speed Test ping, download and upload endpoints pass live HTTP checks");
console.log("✔ Homepage, Profile, media tools, adaptive network selector and PWA assets are live");
