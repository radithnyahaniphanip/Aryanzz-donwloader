import assert from "node:assert/strict";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/,"");
const request=(path,init={})=>fetch(base+path,{cache:"no-store",signal:AbortSignal.timeout(15000),...init});

const expectedVersion=String(process.env.EXPECTED_BUILD_VERSION||"");
assert.ok(expectedVersion,"Deployment must provide EXPECTED_BUILD_VERSION for live verification");
let health,lastError;
for(let attempt=0;attempt<24;attempt++){
  try{
    const response=await request("/api/health?release-check="+encodeURIComponent(expectedVersion+"-"+attempt));
    if(response.ok)health=await response.json();
    if(String(health?.version||"")===expectedVersion)break;
    lastError=new Error("Worker masih melayani build "+String(health?.version||"kosong")+"; menunggu "+expectedVersion);
  }catch(error){lastError=error;}
  await new Promise(resolve=>setTimeout(resolve,3000));
}
assert.match(String(health?.version||""),/^\d+\.\d+\.\d+$/,"Live Worker tidak melaporkan versi build: "+String(lastError?.message||""));
assert.equal(health?.mode,"cloudflare-worker-zero-server-hybrid");
assert.equal(health?.securityActive,true);
const version=String(health.version);
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
  'id="v89Welcome"',
  'ary-profile-v2',
  'ary-profile2-header',
  'ary-profile2-device',
  'ary-owner-v2',
  'ary-owner2-hero',
  'ary-owner2-social-grid',
  'id="ownerDeveloperBadge"',
  'id="profileRandomId"',
  'id="profileCopyId"',
  'id="deviceHistoryList"',
  'id="allTools"',
  'id="toolSearch"',
  'id="toolFilters"',
  'id="aryLibraryHistoryTab"',
  'id="aryLibraryFavoriteTab"',
  'id="aryLibraryHistoryCount"',
  'id="aryLibraryFavoriteCount"'
])assert.ok(html.includes(marker),"Homepage kehilangan elemen/asset: "+marker);

const assetRefs=[...html.matchAll(/(?:src|href)="(\/(?:[^"]+\.(?:js|css))(?:\?[^"]*)?)"/g)].map(match=>match[1]);
assert.ok(assetRefs.length>=15,"Homepage tidak memuat kumpulan aset aplikasi yang diharapkan");
let downloaderAsset="",platformPickerAsset="",downloaderCss="",v15Asset="";
for(const path of [...new Set(assetRefs)]){
  const assetUrl=new URL(path,base);
  assert.equal(assetUrl.searchParams.get("v"),version,"Aset tidak memakai versi build yang sama: "+path);
  const response=await request(path);
  assert.equal(response.status,200,"Aset live tidak ditemukan: "+path);
  const pathname=assetUrl.pathname;
  if(["/downloader.js","/v15.js","/v674.js","/downloader.css","/update-manager.js"].includes(pathname)){
    const body=await response.text();
    if(pathname==="/downloader.js")downloaderAsset=body;
    if(pathname==="/v15.js")v15Asset=body;
    if(pathname==="/v674.js")platformPickerAsset=body;
    if(pathname==="/downloader.css")downloaderCss=body;
  }
}
assert.ok(downloaderAsset.includes("createPhotoSlideshow"),"Aset downloader.js live belum memuat pembuat video slideshow dari foto.");
assert.ok(v15Asset.includes("controller=window.aryanzzShowPanel"),"Navigation legacy belum mendelegasikan ke controller utama.");
assert.ok(!v15Asset.includes("window.aryanzzShowPanel=goto"),"Navigation legacy masih menimpa controller utama.");
assert.ok(!v15Asset.includes("Tema & pengalaman")&&!v15Asset.includes("setupProfile()"),"Kontrol tema lama masih disuntikkan ke Profil.");
assert.ok(v15Asset.includes('parent.querySelector("#toolSearch")||parent.querySelector("#toolFilters")'),"Pusat Alat belum mencegah search/filter ganda.");
assert.ok(v15Asset.includes("aryLibraryHistoryTab")&&v15Asset.includes("clearHistoryV2"),"Kontrol Pustaka belum terhubung.");
assert.ok(html.includes("welcome.hidden=!isHome")&&html.includes("toolsArea.hidden=isHome"),"Tampilan navigasi belum menyembunyikan bagian yang tidak aktif.");
assert.ok(downloaderAsset.includes("isTikTokPhotoPost")&&downloaderAsset.includes("slice(0,35)"),"Aset downloader.js live belum memuat deteksi TikTok Photo Mode dan galeri foto.");
assert.ok(platformPickerAsset.includes("PLATFORM_GUIDES")&&platformPickerAsset.includes("modeLabels.join"),"Aset v674.js live belum memuat panduan dan label media per platform.");
assert.ok(platformPickerAsset.includes("Tempel tautan TikTok: video atau Photo Mode"),"Placeholder TikTok belum diperbarui pada aset live.");
assert.ok(downloaderCss.includes(".v736-platform-pager")&&downloaderCss.includes("margin:16px 0 26px"),"Aset downloader.css live belum memuat jarak pager mobile yang baru.");

const platformMatrixResponse=await request("/api/platform/status");
assert.equal(platformMatrixResponse.status,200,"Platform status endpoint gagal");
const platformMatrix=await platformMatrixResponse.json();
assert.equal(platformMatrix.platformCount,200,"Status platform harus melaporkan seluruh 200 pilihan");
const expectedPlatforms=["youtube","tiktok","instagram","snackvideo","capcut","pinterest","facebook","x","reddit","vimeo","threads","soundcloud","tiktoklite","facebooklite","snapchat","idnapp","instagramlite","linkedin","wechat","kakaotalk"];
for(const id of expectedPlatforms)assert.ok(platformMatrix.platforms.some(item=>item.id===id),"Platform tidak terdaftar: "+id);
for(const id of ["tiktok","tiktoklite"]){
  const entry=platformMatrix.platforms.find(item=>item.id===id);
  assert.ok(entry?.mediaModes?.includes("video"),id+" harus tetap mendukung video.");
  assert.ok(entry?.mediaModes?.includes("image"),id+" belum mengiklankan dukungan Photo Mode/gambar.");
}
console.log("✔ TikTok and TikTok Lite advertise both video and image media modes.");
console.log("✔ Platform status endpoint exposes all 200 platform choices and preserves the original first page.");

async function waitForVersionedJson(path,label){
  let last="belum tersedia";
  for(let attempt=0;attempt<20;attempt++){
    try{
      const target=new URL(path,base);
      target.searchParams.set("release-check",String(attempt));
      const response=await request(target.pathname+target.search);
      if(response.ok){
        const data=await response.json();
        if(String(data?.version||"")===version)return data;
        last="versi "+String(data?.version||"kosong");
      }else last="HTTP "+response.status;
    }catch(error){last=String(error.message||error);}
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  throw new Error(label+" belum mengikuti versi Worker "+version+" setelah menunggu propagasi; respons terakhir: "+last);
}
const release=await waitForVersionedJson("/release.json","Metadata release.json");
const manifest=await waitForVersionedJson("/manifest.webmanifest?v="+version,"PWA manifest");
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
