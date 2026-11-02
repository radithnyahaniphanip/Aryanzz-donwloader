import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

const file=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=file("../public/index.html");
const workerSource=file("../src/index.js");
const sw=file("../public/sw.js");
const v15=file("../public/v15.js");
const downloader=file("../public/downloader.js");
const v677css=file("../public/v677.css");
const v677js=file("../public/v677.js");
const editor=file("../public/editor.js");
const v59css=file("../public/v59.css");
const editorProCss=file("../public/editor-pro.css");
const musicJs=file("../public/music-recognition.js");
const musicCss=file("../public/music-recognition.css");
const serverSource=file("../server/index.js");
const ownerJs=file("../public/owner.js");
const ownerCss=file("../public/owner.css");
const downloaderCss=file("../public/downloader.css");
const manifest=JSON.parse(file("../public/manifest.webmanifest"));

const checks=[
  ["V71.0 page title",html.includes("ARYANZZ V71.0 — All-in-One Creative Space")],
  ["V59.5 versioned assets",html.includes("/v15.js?v=59.5")&&html.includes("/owner.js?v=59.5")&&html.includes("/downloader.js?v=71.0")&&html.includes("/downloader.css?v=71.0")&&html.includes("/v59.css?v=59.5")&&html.includes("/editor-pro.css?v=65.0")&&html.includes("/editor.js?v=65.0")],
  ["service worker cache and V59.5 assets",html.includes("/sw.js?v=71.0")&&sw.includes("aryanzz-v71-0")&&sw.includes("/editor.js?v=65.0")&&sw.includes("/editor-pro.css?v=65.0")&&sw.includes("/v59.css?v=59.5")],
  ["downloader input, result and backend status",html.includes('id="analyze"')&&html.includes('id="downloadResult"')&&html.includes('id="backendStatus"')],
  ["unified self-hosted downloader API",downloader.includes('postJson("/api/info"')&&downloader.includes('"/api/direct-file?url="')&&downloader.includes("PLATFORM_NAMES")&&!downloader.toLowerCase().includes("savenow")],
  ["single capture-phase universal URL handler",downloader.includes('button.addEventListener("click"')&&downloader.includes("event.stopImmediatePropagation()")&&downloader.includes("}, true);")],
  ["video quality options available",downloader.includes('[360,"360p"]')&&downloader.includes('[720,"720p HD"]')&&downloader.includes('[1080,"1080p Full HD"]')&&downloader.includes('[2160,"2160p · 4K"]')],
  ["Hybrid provider endpoints are implemented without Cobalt or SaveNow",workerSource.includes("PIPED_INSTANCES")&&workerSource.includes("INVIDIOUS_INSTANCES")&&workerSource.includes("youtubeStream")&&!workerSource.includes("cobaltConfig")&&!workerSource.includes("SAVENOW_BASE")&&!downloader.includes("Cobalt")],
  ["Piped and Invidious only expose actual progressive formats",workerSource.includes("videoOnly!==true")&&workerSource.includes("formatStreams")&&workerSource.includes("adaptiveFormats")&&workerSource.includes("providerReady")],
  ["Chrome downloads use a validated same-origin stream endpoint",downloader.includes("window.location.assign(selected.downloadUrl)")&&workerSource.includes("/api/youtube/stream")&&workerSource.includes("streamHostAllowed")],
  ["Hybrid provider list uses official public instance domains",workerSource.includes("pipedapi.kavin.rocks")&&workerSource.includes("pipedapi.adminforge.de")&&workerSource.includes("invidious.tiekoetter.com")],
  ["TikTok is intentionally disabled while YouTube is prioritized",downloader.includes("TikTok sementara dinonaktifkan")],
  ["legacy competing downloader handler removed",!v15.includes("button.onclick=async()=>{")],
  ["owner header controls are real buttons",html.includes('class="owner-menu-mark" type="button" data-panel="allTools"')&&html.includes('aria-label="Buka riwayat unduhan"')&&html.includes('aria-label="Buka personalisasi profil"')],
  ["owner view hides home and uses dark palette",ownerCss.includes('body[data-view="owner"] #home{display:none!important}')&&ownerCss.includes("background:linear-gradient(145deg,#13223a,#0d1728)")],
  ["owner social cards use requested contacts",ownerJs.includes("https://wa.me/6282110767071")&&ownerJs.includes("https://www.tiktok.com/@azazeuu?_r=1&_t=ZS-9B2FU0QemSi")],
  ["owner profile and edit controls",html.includes('id="owner"')&&html.includes('id="ownerEditProfile"')&&ownerJs.includes("renderOwnerProfile")],
  ["V67.7 Tools Center includes speed test, website checker and Smart Queue",html.includes('id="allTools"')&&html.includes('id="toolGrid"')&&html.includes('data-panel="speed"')&&html.includes('data-panel="checker"')&&html.includes('data-panel="queue"')],
  ["Video Editor panel and controls",html.includes('id="editor"')&&html.includes('id="editorFile"')&&html.includes('id="editorStart"')&&html.includes('id="editorExport"')],
  ["Local editor has trim, filters, canvas export and MediaRecorder",editor.includes("MediaRecorder")&&editor.includes("captureStream")&&editor.includes("selectedStart")&&editor.includes("editorSaturation")],
  ["V59.5 tools banner remains responsive",v59css.includes(".tools-banner")&&v59css.includes("@media(max-width:700px)")],
  ["V65.0 editor pro responsive design",editorProCss.includes(".editor-pro-workspace")&&editorProCss.includes(".editor-clip-card")&&editorProCss.includes("@media(max-width:600px)")],
  ["V65.0 multi-clip timeline and clip operations",editor.includes("MAX_CLIPS = 8")&&editor.includes("function splitClip")&&editor.includes("function moveClip")&&editor.includes("function updateClipTrim")],
  ["V65.0 background music and audio mixing",editor.includes("createMediaStreamDestination")&&editor.includes("audioTracks.length>=3")&&editor.includes("editorMute")],
  ["V65.0 project save and restore",editor.includes("function saveProject")&&editor.includes("async function loadProjectFile")&&editor.includes("ARYANZZ Creative Studio Pro")],
  ["V65.0 fade transition and caption styling",editor.includes("fadeDuration")&&editor.includes("editorTextColor")&&editor.includes("editorTextSize")],
  ["V65.0 premium wide editor layout",editorProCss.includes("min(1220px")&&editorProCss.includes(".editor-inspector{position:sticky")&&html.includes("PRO · V65.0")],
  ["V65.0 per-clip motion keyframes",html.includes('id="editorZoomStart"')&&html.includes('id="editorZoomEnd"')&&editor.includes("function motionAt")&&editor.includes("motion:clip.motion?")],
  ["V65.0 three mixed audio tracks",html.includes('id="editorAudioTrackList"')&&html.includes('id="editorMusicFile"')&&editor.includes("audioTracks.length>=3")&&editor.includes("createMediaElementSource(track.audio)")],
  ["V65.0 SRT subtitle import and persistence",html.includes('id="editorSubtitleFile"')&&editor.includes("function parseSrt(source)")&&editor.includes("subtitles,")&&editor.includes("function clearSubtitles()")],
  ["V65.0 chroma key live preview and export",html.includes('id="editorPreviewCanvas"')&&html.includes('id="editorChromaEnabled"')&&editor.includes("function applyChromaKey")&&editor.includes("drawFrame(previewCtx")],
  ["V65.0 animated captions",html.includes('id="editorTextAnimation"')&&editor.includes("function textAnimationState")&&editor.includes("overlay.dataset.animation")],
  ["Music Finder panel and tool card",html.includes('id="musicFinder"')&&html.includes('data-panel="musicFinder"')],
  ["Music Finder assets and PWA cache",html.includes("/music-recognition.js?v=71.0")&&html.includes("/music-recognition.css?v=71.0")&&sw.includes("/music-recognition.js?v=71.0")&&sw.includes("/music-recognition.css?v=71.0")],
  ["DJ mix scan uses AudD Enterprise endpoint",html.includes('id="musicFileScanButton"')&&html.includes('id="musicScanSkip"')&&musicJs.includes('/api/music/scan-video')&&workerSource.includes("enterprise.audd.io")],
  ["Music Finder supports file, video URL and microphone",musicJs.includes("captureMediaSample")&&musicJs.includes("getUserMedia")&&musicJs.includes("/api/music/recognize")&&musicJs.includes("musicVideoUrl")],
  ["AudD errors expose provider code and actionable quota guidance",workerSource.includes("function auddFailure")&&workerSource.includes("providerErrorCode")&&workerSource.includes("kode 901")&&workerSource.includes("kode 902")],
  ["V71.0 runs without a self-hosted extractor",workerSource.includes('version:"71.0"')&&workerSource.includes('mode:"cloudflare-worker-zero-server"')&&workerSource.includes('platformBackend:"public-api-hybrid"')&&!workerSource.includes("DOWNLOADER_CONTAINER")],
  ["Shazam fallback covers standard AudD auth/quota failures",workerSource.includes("shazamRecognize(audioBlob,env)")&&workerSource.includes("providerErrorCode")&&serverSource.includes("/api/music/recognize")&&serverSource.includes("shazam_recognize.py")],
  ["DJ mix scans fall back to Shazam when AudD Enterprise errors",workerSource.includes("shazamScan(fallbackSource")&&serverSource.includes("/api/music/scan")&&serverSource.includes("scanShazamMedia")],
  ["Docker backend includes yt-dlp, FFmpeg and ShazamIO",file("../Dockerfile").includes("yt-dlp")&&file("../Dockerfile").includes("shazamio==0.9.0")&&serverSource.includes("ffprobe")],
  ["Music Finder responsive styling",musicCss.includes(".music-grid")&&musicCss.includes("@media(max-width:620px)")],
  ["Video URL DJ scanning goes directly through AudD Enterprise",workerSource.includes('fetch("https://enterprise.audd.io/"')&&!musicJs.includes("identifyVideoUrl(url,startSeconds)")],
  ["tool hub remains available",html.includes('id="allTools"')],
  ["PWA manifest version",manifest.name.includes("V71.0")],
  ["V67.7 visual assets are loaded",html.includes("/v677.css?v=67.7")&&html.includes("/v677.js?v=67.7")&&sw.includes("/v677.css?v=67.7")&&sw.includes("/v677.js?v=67.7")],
  ["V67.7 home remains focused on the downloader",html.includes('id="home"')&&html.includes('id="downloadLinkMode"')&&!html.slice(html.indexOf('id="home"'),html.indexOf('id="toolsArea"')).includes('id="toolGrid"')],
  ["V67.7 feature identity map covers all tools",file("../public/v677.js").includes("const ICONS=")&&["speed","checker","queue","editor","musicFinder","history","imageTools","pdfTools","qrTools","securityTools","colorStudio","profile","owner","about","help"].every(id=>file("../public/v677.js").includes(id))],
  ["V67.7 expanded Color Studio palettes",file("../public/v677.js").includes("990M+ kombinasi palet")&&file("../public/v677.js").includes("Tyrian Purple")&&file("../public/v677.js").includes("holographic")],
  ["V67.7 reduced-motion support",file("../public/v677.css").includes("prefers-reduced-motion")],
  ["V67.9 remaining tools have branded backgrounds",v677css.includes('data-feature="gradientStudio"')&&v677css.includes('data-feature="fileHash"')&&v677css.includes("#editor .editor-pro-head")&&v677css.includes("#profile .v25-profile-cover")],
  ["V67.9 Color Studio favorites and clipboard work after redesign",v677js.includes("palette.onclick=async event")&&v677js.includes("favorites.onclick=async event")&&v677js.includes('localStorage.setItem("aryanzz.color-favorites.v674"')&&v677js.includes("copyExpandedColor")],

  ["V71.0 service worker cache and creative assets",sw.includes("aryanzz-v71-0")&&sw.includes("/v680.css?v=71.0")&&sw.includes("/v680.js?v=71.0")&&html.includes("/v680.js?v=71.0")],
  ["V67.9 downloader preserves direct-source details",downloader.includes("function responseFilename")&&downloader.includes("const directMedia=!!info.extension&&!info.extractor")&&downloader.includes("/api/platform/status")],
  ["V71.0 title search has no-server YouTube handoff",file("../public/v674.js").includes("Buka hasil YouTube")&&file("../public/v674.js").includes("salin tautan video")],
  ["V67.9 direct media whitelist includes common formats",workerSource.includes('"mkv"')&&workerSource.includes('"avi"')&&workerSource.includes('"aiff"')&&workerSource.includes('"opus"')],
  ["V71.0 Gradient Studio controls are wired",html.includes('id="gradientStudio"')&&html.includes('id="gradientRandom"')&&html.includes('id="gradientPng"')&&file("../public/v680.js").includes("function renderGradient")],
  ["V71.0 File Hash Checker uses local Web Crypto",html.includes('id="fileHash"')&&html.includes('id="hashCompute"')&&file("../public/v680.js").includes("crypto.subtle.digest")],
];
for(const [name,ok] of checks){assert.ok(ok,name+" failed");console.log("✔ "+name)}

const healthResponse=await worker.fetch(new Request("https://aryanzz.example/api/health"),{});
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();
assert.equal(health.version,"71.0");
assert.equal(health.selfHostedDownloader,false);
assert.equal(health.youtubeDownloader,false);
assert.equal(health.mode,"cloudflare-worker-zero-server");
assert.equal(health.platformBackend,"community-handoff");
assert.equal(health.directMediaDownload,true);
assert.equal(health.musicRecognitionConfigured,false);
assert.equal(health.youtubeApiKeyConfigured,false);
console.log("✔ V71.0 Worker health and zero-server status");
const platformStatusResponse=await worker.fetch(new Request("https://aryanzz.example/api/platform/status"),{});
assert.equal(platformStatusResponse.status,200);
const platformStatus=await platformStatusResponse.json();
assert.equal(platformStatus.configured,false);
assert.equal(platformStatus.backend,"community-handoff");
assert.ok(platformStatus.platforms.includes("youtube.com"));
console.log("✔ Platform status clearly reports missing self-hosted backend");
const disconnected=await worker.fetch(new Request("https://aryanzz.example/api/info",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://www.youtube.com/watch?v=demo123"})
}),{});
assert.equal(disconnected.status,503);
console.log("✔ Platform links fail clearly until backend is configured");

const musicStatusResponse=await worker.fetch(new Request("https://aryanzz.example/api/music/status"),{});
assert.equal(musicStatusResponse.status,200);
const musicStatus=await musicStatusResponse.json();
assert.equal(musicStatus.configured,false);
assert.equal(musicStatus.videoUrlReady,false);
assert.equal(musicStatus.videoScanProvider,"Unavailable");
assert.equal(musicStatus.shazamFallbackReady,false);
console.log("✔ Music Finder status reports missing AudD and video-extractor secrets");
const noTokenForm=new FormData();noTokenForm.append("file",new Blob(["sample"],{type:"audio/webm"}),"sample.webm");
const musicNoToken=await worker.fetch(new Request("https://aryanzz.example/api/music/recognize",{method:"POST",body:noTokenForm}),{});
assert.equal(musicNoToken.status,503);
assert.match((await musicNoToken.json()).error,/Shazam fallback|AudD/);
console.log("✔ Music recognition stays disabled until the AudD secret is configured");
const musicConfigured=await worker.fetch(new Request("https://aryanzz.example/api/music/status"),{AUDD_API_TOKEN:"test-audd-token"});
const configuredStatus=await musicConfigured.json();
assert.equal(configuredStatus.configured,true);
assert.equal(configuredStatus.videoUrlReady,true);
console.log("✔ Music Finder status detects the configured AudD secret");
const originalMusicFetch=globalThis.fetch;
try{
  let calls=0;
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    assert.equal(url.href,"https://api.audd.io/");
    assert.equal(init.method,"POST");
    assert.ok(init.body instanceof FormData);
    assert.equal(init.body.get("api_token"),"test-audd-token");
    assert.equal(init.body.get("return"),"apple_music,spotify");
    calls++;
    const result=calls===1?{
      title:"Test Track",artist:"Test Artist",album:"Test Album",release_date:"2025-01-01",
      timecode:"00:12",song_link:"https://lis.tn/test",
      apple_music:{url:"https://music.apple.com/id/album/test"},
      spotify:{external_urls:{spotify:"https://open.spotify.com/track/test"}}
    }:null;
    return new Response(JSON.stringify({status:"success",result}),{status:200,headers:{"content-type":"application/json"}});
  };
  const audioForm=new FormData();
  audioForm.append("file",new Blob(["sample audio bytes"],{type:"audio/webm"}),"sample.webm");
  const recognized=await worker.fetch(new Request("https://aryanzz.example/api/music/recognize",{method:"POST",body:audioForm}),{AUDD_API_TOKEN:"test-audd-token"});
  assert.equal(recognized.status,200);
  const recognizedData=await recognized.json();
  assert.equal(recognizedData.match,true);
  assert.equal(recognizedData.result.title,"Test Track");
  assert.equal(recognizedData.result.artist,"Test Artist");
  assert.equal(recognizedData.result.song_link,"https://lis.tn/test");
  console.log("✔ Music recognition forwards audio securely and maps AudD track metadata");
  const noMatchForm=new FormData();
  noMatchForm.append("file",new Blob(["another sample"],{type:"audio/webm"}),"sample.webm");
  const noMatch=await worker.fetch(new Request("https://aryanzz.example/api/music/recognize",{method:"POST",body:noMatchForm}),{AUDD_API_TOKEN:"test-audd-token"});
  assert.equal(noMatch.status,200);
  assert.equal((await noMatch.json()).match,false);
  console.log("✔ Music recognition handles an audio sample with no catalogue match");
}finally{globalThis.fetch=originalMusicFetch;}

const providerErrorFetch=globalThis.fetch;
try{
  globalThis.fetch=async()=>new Response(JSON.stringify({status:"error",error:{error_code:901,error_message:"authorization failed: the limit was reached."}}),{status:200,headers:{"content-type":"application/json"}});
  const deniedForm=new FormData();deniedForm.append("file",new Blob(["sample"],{type:"audio/webm"}),"sample.webm");
  const denied=await worker.fetch(new Request("https://aryanzz.example/api/music/recognize",{method:"POST",body:deniedForm}),{AUDD_API_TOKEN:"test-audd-token"});
  assert.equal(denied.status,502);
  const deniedData=await denied.json();
  assert.equal(deniedData.providerErrorCode,901);
  assert.equal(deniedData.retryable,false);
  assert.match(deniedData.error,/API token tidak diterima/);
  globalThis.fetch=async()=>new Response(JSON.stringify({status:"error",error:{error_code:902,error_message:"quota exceeded"}}),{status:200,headers:{"content-type":"application/json"}});
  const quotaForm=new FormData();quotaForm.append("file",new Blob(["sample"],{type:"audio/webm"}),"sample.webm");
  const quota=await worker.fetch(new Request("https://aryanzz.example/api/music/recognize",{method:"POST",body:quotaForm}),{AUDD_API_TOKEN:"test-audd-token"});
  assert.equal(quota.status,502);
  const quotaData=await quota.json();
  assert.equal(quotaData.providerErrorCode,902);
  assert.match(quotaData.error,/Kuota akun AudD sudah habis/);
  console.log("✔ AudD authentication and quota failures are identified without exposing the token");
}finally{globalThis.fetch=providerErrorFetch;}


const originalSearchFetch=globalThis.fetch;
try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    assert.equal(url.href,"https://extractor.example/api/search");
    assert.equal(init.method,"POST");
    assert.equal(init.headers.authorization,"Bearer test-platform-token");
    assert.equal(JSON.parse(init.body).query,"lofi beats");
    return new Response(JSON.stringify({ok:true,results:[
      {id:"EXT123",title:"External Search Result",url:"https://www.youtube.com/watch?v=EXT123"},
      {id:"BAD123",title:"Unsafe result",url:"https://attacker.example/video"}
    ]}),{status:200,headers:{"content-type":"application/json"}});
  };
  const externalSearch=await worker.fetch(new Request("https://aryanzz.example/api/search",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:"lofi beats"})
  }),{PLATFORM_API_ORIGIN:"https://extractor.example",PLATFORM_API_TOKEN:"test-platform-token"});
  assert.equal(externalSearch.status,200);
  const externalData=await externalSearch.json();
  assert.equal(externalData.results.length,1);
  assert.equal(externalData.results[0].id,"EXT123");
  console.log("✔ Legacy title-search endpoint remains backward compatible");
}finally{globalThis.fetch=originalSearchFetch;}

const insecureSearch=await worker.fetch(new Request("https://aryanzz.example/api/search",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:"lofi beats"})
}),{PLATFORM_API_ORIGIN:"http://extractor.example",PLATFORM_API_TOKEN:"test-platform-token"});
assert.equal(insecureSearch.status,500);
console.log("✔ V67.9 title search rejects insecure HTTP backend origins");

const originalDirectFetch=globalThis.fetch;
try{
  globalThis.fetch=async(input,init={})=>{
    assert.equal(init.method,"HEAD");
    return new Response(null,{status:200,headers:{"content-length":"2048","content-type":"video/x-matroska"}});
  };
  const directInfo=await worker.fetch(new Request("https://aryanzz.example/api/info",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://cdn.example/video.mkv"})
  }),{});
  assert.equal(directInfo.status,200);
  const directData=await directInfo.json();
  assert.equal(directData.extension,"mkv");
  assert.equal(directData.type,"video");
  const audioInfo=await worker.fetch(new Request("https://aryanzz.example/api/info",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://cdn.example/voice-note.wma"})
  }),{});
  assert.equal(audioInfo.status,200);
  assert.equal((await audioInfo.json()).type,"audio");
  console.log("✔ V67.9 direct MKV and WMA links retain their correct media types");
  const unsupported=await worker.fetch(new Request("https://aryanzz.example/api/info",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://cdn.example/file.exe"})
  }),{});
  assert.equal(unsupported.status,400);
  const localBlocked=await worker.fetch(new Request("https://aryanzz.example/api/info",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"http://127.0.0.1/video.mp4"})
  }),{});
  assert.equal(localBlocked.status,400);
  console.log("✔ Direct media validation rejects unsupported extensions and local network targets");
}finally{globalThis.fetch=originalDirectFetch;}

const originalFallbackFetch=globalThis.fetch;
try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    if(url.href==="https://api.audd.io/"||url.href==="https://enterprise.audd.io/")
      return new Response(JSON.stringify({status:"error",error:{error_code:902,error_message:"quota exceeded"}}),{status:200,headers:{"content-type":"application/json"}});
    if(url.href==="https://extractor.example/api/music/recognize"){
      assert.equal(init.headers.authorization,"Bearer test-platform-token");
      return new Response(JSON.stringify({ok:true,match:true,provider:"Shazam",result:{title:"Fallback Track",artist:"Fallback Artist",song_link:"https://www.shazam.com/track/123"}}),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.href==="https://extractor.example/api/music/scan"){
      assert.equal(init.headers.authorization,"Bearer test-platform-token");
      return new Response(JSON.stringify({ok:true,match:true,provider:"Shazam",scannedChunks:2,tracks:[{title:"DJ Fallback Track",artist:"DJ Fallback Artist",offset:"00:00",offsets:["00:00","01:00"]}]}),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.href==="https://extractor.example/api/health")
      return new Response(JSON.stringify({ok:true,engine:"yt-dlp + FFmpeg + ShazamIO",version:"68.1"}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error("Unexpected fetch: "+url.href);
  };
  const backendEnv={AUDD_API_TOKEN:"test-audd-token",PLATFORM_API_ORIGIN:"https://extractor.example",PLATFORM_API_TOKEN:"test-platform-token"};
  const fallbackForm=new FormData();fallbackForm.append("file",new Blob(["sample audio"],{type:"audio/webm"}),"sample.webm");
  const fallbackResponse=await worker.fetch(new Request("https://aryanzz.example/api/music/recognize",{method:"POST",body:fallbackForm}),backendEnv);
  assert.equal(fallbackResponse.status,200);
  const fallbackData=await fallbackResponse.json();
  assert.equal(fallbackData.provider,"Shazam");
  assert.equal(fallbackData.result.title,"Fallback Track");
  console.log("✔ AudD quota exhaustion falls back to ShazamIO through the external backend");

  const djResponse=await worker.fetch(new Request("https://aryanzz.example/api/music/scan-video",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://www.youtube.com/watch?v=demo123",skip:4,every:1,limit:10})
  }),backendEnv);
  assert.equal(djResponse.status,200);
  const djData=await djResponse.json();
  assert.equal(djData.provider,"Shazam fallback");
  assert.equal(djData.tracks[0].title,"DJ Fallback Track");
  console.log("✔ AudD Enterprise quota exhaustion falls back to external Shazam multi-segment scanning");

  const externalStatus=await worker.fetch(new Request("https://aryanzz.example/api/platform/status"),backendEnv);
  assert.equal(externalStatus.status,200);
  assert.equal((await externalStatus.json()).ok,true);
  const health=await worker.fetch(new Request("https://aryanzz.example/api/health"),backendEnv);
  const healthData=await health.json();
  assert.equal(healthData.platformBackend,"community-handoff");
  assert.equal(healthData.platformExtraction,false);
  console.log("✔ V71.0 health keeps the no-server mode active");
}finally{globalThis.fetch=originalFallbackFetch;}

const originalEnterpriseFetch=globalThis.fetch;
try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    assert.equal(url.href,"https://enterprise.audd.io/");
    assert.equal(init.method,"POST");
    assert.ok(init.body instanceof FormData);
    assert.equal(init.body.get("api_token"),"test-audd-token");
    assert.equal(init.body.get("url"),"https://www.youtube.com/watch?v=DJMIX123456");
    assert.equal(init.body.get("accurate_offsets"),"true");
    assert.equal(init.body.get("skip"),"4");
    assert.equal(init.body.get("every"),"1");
    assert.equal(init.body.get("limit"),"60");
    return new Response(JSON.stringify({status:"success",result:[
      {offset:"00:00",songs:[
        {title:"DJ Track One",artist:"DJ Artist",album:"Mix One",timecode:"00:34",score:100,song_link:"https://lis.tn/one"},
        {title:"DJ Track Two",artist:"DJ Artist Two",offset:"00:00",timecode:"01:12",score:96}
      ]},
      {offset:"01:00",songs:[{title:"DJ Track Three",artist:"DJ Artist Three",timecode:"00:21",score:99}]}
    ]}),{status:200,headers:{"content-type":"application/json"}});
  };
  const scanned=await worker.fetch(new Request("https://aryanzz.example/api/music/scan-video",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://www.youtube.com/watch?v=DJMIX123456",skip:4,every:1,limit:60})
  }),{AUDD_API_TOKEN:"test-audd-token"});
  assert.equal(scanned.status,200);
  const scanData=await scanned.json();
  assert.equal(scanData.provider,"AudD Enterprise");
  assert.equal(scanData.match,true);
  assert.equal(scanData.scannedChunks,2);
  assert.equal(scanData.tracks.length,3);
  assert.equal(scanData.tracks[0].offset,"00:00");
  assert.equal(scanData.tracks[2].title,"DJ Track Three");
  console.log("✔ DJ mix URL scan uses AudD Enterprise and returns track timestamps");
  const invalidScan=await worker.fetch(new Request("https://aryanzz.example/api/music/scan-video",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://example.com/not-supported.mp4"})
  }),{AUDD_API_TOKEN:"test-audd-token"});
  assert.equal(invalidScan.status,400);
  console.log("✔ DJ mix scan rejects unsupported or untrusted video domains");
}finally{globalThis.fetch=originalEnterpriseFetch;}

const unknown=await worker.fetch(new Request("https://aryanzz.example/api/not-a-route"),{});
assert.equal(unknown.status,404);
console.log("✔ Unknown API route");

const originalFetch=globalThis.fetch;
try{
  const requests=[];
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    requests.push({url,init});
    if(url.hostname==="cdn.instagram.com"&&url.pathname==="/sample.mp4"){
      return new Response(init.method==="HEAD"?null:new Uint8Array([1,2,3,4]),{status:200,headers:{"content-type":"video/mp4","content-length":"4"}});
    }
    if(url.hostname==="pipedapi.kavin.rocks"&&url.pathname==="/streams/4dpnHLPMQGs"){
      return new Response(JSON.stringify({title:"Hybrid Test Video",thumbnailUrl:"https://img.example/hybrid.jpg",uploader:"Test Channel",duration:125,
        videoStreams:[
          {height:720,quality:"720p",mimeType:"video/mp4",videoOnly:false,url:"https://pipedproxy-bom.kavin.rocks/videoplayback?itag=22&sig=test"},
          {height:360,quality:"360p",mimeType:"video/mp4",videoOnly:false,url:"https://pipedproxy-bom.kavin.rocks/videoplayback?itag=18&sig=test"},
          {height:1080,quality:"1080p",mimeType:"video/mp4",videoOnly:true,url:"https://pipedproxy-bom.kavin.rocks/videoplayback?itag=137&sig=video-only"}
        ],
        audioStreams:[{format:"M4A",quality:"128 kbps",mimeType:"audio/mp4",url:"https://pipedproxy-bom.kavin.rocks/videoplayback?itag=140&sig=audio"}]
      }),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="pipedapi.kavin.rocks"&&url.pathname==="/streams/Fallback123")return new Response("unavailable",{status:503});
    if(url.hostname==="pipedapi.adminforge.de"||url.hostname==="pipedapi.leptons.xyz")return new Response("unavailable",{status:503});
    if(url.hostname==="invidious.tiekoetter.com"&&url.pathname==="/api/v1/videos/Fallback123"){
      return new Response(JSON.stringify({title:"Invidious Fallback Video",videoId:"Fallback123",author:"Fallback Channel",lengthSeconds:88,
        videoThumbnails:[{quality:"maxres",url:"https://img.example/fallback.jpg"}],
        formatStreams:[{container:"mp4",qualityLabel:"1080p",resolution:"1920x1080",url:"https://redirector.googlevideo.com/videoplayback?expire=999999"}],
        adaptiveFormats:[{type:"audio/mp4",audioQuality:"AUDIO_QUALITY_MEDIUM",url:"https://redirector.googlevideo.com/videoplayback?itag=140"}]
      }),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="invidious.tiekoetter.com"||url.hostname==="invidious.nerdvpn.de"||url.hostname==="yt.chocolatemoo53.com"||url.hostname==="inv.nadeko.net")return new Response("unavailable",{status:503});
    if(url.hostname==="pipedproxy-bom.kavin.rocks"&&url.pathname==="/videoplayback"){
      const range=init.headers?.get?.("range");
      if(range==="bytes=0-2")return new Response(new Uint8Array([1,2,3]),{status:206,headers:{"content-type":"video/mp4","content-length":"3","content-range":"bytes 0-2/4","accept-ranges":"bytes"}});
      return new Response(new Uint8Array([1,2,3,4]),{status:200,headers:{"content-type":"video/mp4","content-length":"4","accept-ranges":"bytes"}});
    }
    if(url.hostname==="redirector.googlevideo.com"&&url.pathname==="/videoplayback"){
      return new Response(new Uint8Array([1,2,3,4]),{status:200,headers:{"content-type":"video/mp4","content-length":"4"}});
    }
    if(url.hostname==="www.youtube.com"&&url.pathname==="/oembed"){
      return new Response(JSON.stringify({title:"Fallback YouTube Preview",thumbnail_url:"https://img.example/fallback.jpg",author_name:"Test Channel"}),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.pathname==="/ajax/download.php"){
      assert.equal(url.searchParams.get("apikey"),"test-secret");
      assert.equal(url.searchParams.get("allow_extended_duration"),"0");
      if(url.searchParams.get("url").includes("LOWBALANCE"))
        return new Response(JSON.stringify({success:false,error:"Not enough balance"}),{status:200,headers:{"content-type":"application/json"}});
      assert.equal(url.searchParams.get("format"),"mp44k");
      return new Response(JSON.stringify({success:true,id:"job-123",progress:0,info:{title:"Test YouTube Video",image:"https://img.example/thumb.jpg"}}),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.pathname==="/ajax/progress.php"){
      return new Response(JSON.stringify({progress:1000,success:1,download_url:"https://cdn.example/test.mp4",filename:"test-video.mp4"}),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="cdn.example"){
      return new Response(new Uint8Array([1,2,3,4]),{status:200,headers:{"content-type":"video/mp4","content-length":"4"}});
    }
    throw new Error("Unexpected mocked fetch: "+url.href);
  };

  const directSocialFileInfo=await worker.fetch(new Request("https://aryanzz.example/api/info",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://cdn.instagram.com/sample.mp4"})
  }),{});
  assert.equal(directSocialFileInfo.status,200);
  assert.equal((await directSocialFileInfo.json()).extension,"mp4");
  const directSocialFile=await worker.fetch(new Request("https://aryanzz.example/api/direct-file?url="+encodeURIComponent("https://cdn.instagram.com/sample.mp4")),{});
  assert.equal(directSocialFile.status,200);
  assert.match(directSocialFile.headers.get("content-disposition"),/sample\.mp4/);
  assert.equal((await directSocialFile.arrayBuffer()).byteLength,4);
  console.log("✔ Direct MP4 GET endpoint streams attachment directly for Chrome download manager");

  const pipedInfo=await worker.fetch(new Request("https://aryanzz.example/api/youtube/info?url="+encodeURIComponent("https://youtu.be/4dpnHLPMQGs")), {});
  assert.equal(pipedInfo.status,200);
  const pipedData=await pipedInfo.json();
  assert.equal(pipedData.providerReady,true);
  assert.equal(pipedData.providerName,"Piped");
  assert.equal(pipedData.title,"Hybrid Test Video");
  assert.deepEqual(pipedData.formats.map(x=>x.height),[720,360]);
  assert.equal(pipedData.audioFormats[0].format,"m4a");
  assert.match(pipedData.formats[0].downloadUrl,/\/api\/youtube\/stream\?/);
  console.log("✔ Piped primary returns only available progressive MP4 and audio stream formats");

  const pipedStreamUrl="https://pipedproxy-bom.kavin.rocks/videoplayback?itag=22&sig=test";
  const pipedDownload=await worker.fetch(new Request("https://aryanzz.example/api/youtube/stream?provider=piped&instance=kavin&url="+encodeURIComponent(pipedStreamUrl)+"&filename=hybrid-test.mp4&mime=video%2Fmp4",{headers:{range:"bytes=0-2"}}),{});
  assert.equal(pipedDownload.status,206);
  assert.match(pipedDownload.headers.get("content-disposition"),/hybrid-test\.mp4/);
  assert.equal(pipedDownload.headers.get("content-range"),"bytes 0-2/4");
  assert.equal((await pipedDownload.arrayBuffer()).byteLength,3);
  assert.ok(requests.some(x=>x.url.hostname==="pipedproxy-bom.kavin.rocks"&&x.init.headers.get("range")==="bytes=0-2"));
  console.log("✔ Piped stream is proxied as a Chrome attachment with byte-range support");

  const blockedStream=await worker.fetch(new Request("https://aryanzz.example/api/youtube/stream?provider=piped&instance=kavin&url="+encodeURIComponent("https://evil.example/videoplayback?x=1")+"&filename=bad.mp4&mime=video%2Fmp4"),{});
  assert.equal(blockedStream.status,400);
  console.log("✔ Stream proxy rejects arbitrary external URLs (SSRF protection)");

  const fallbackInfo=await worker.fetch(new Request("https://aryanzz.example/api/youtube/info?url="+encodeURIComponent("https://youtu.be/Fallback123")), {});
  assert.equal(fallbackInfo.status,200);
  const fallbackData=await fallbackInfo.json();
  assert.equal(fallbackData.providerName,"Invidious");
  assert.equal(fallbackData.providerReady,true);
  assert.equal(fallbackData.formats[0].height,1080);
  console.log("✔ Invidious fallback activates when Piped instances are unavailable");

  const invidiousUrl="https://redirector.googlevideo.com/videoplayback?expire=999999";
  const invidiousDownload=await worker.fetch(new Request("https://aryanzz.example/api/youtube/stream?provider=invidious&instance=tiekoetter&url="+encodeURIComponent(invidiousUrl)+"&filename=invidious-test.mp4&mime=video%2Fmp4"),{});
  assert.equal(invidiousDownload.status,200);
  assert.match(invidiousDownload.headers.get("content-disposition"),/invidious-test\.mp4/);
  assert.equal((await invidiousDownload.arrayBuffer()).byteLength,4);
  console.log("✔ Invidious Google Video stream is delivered through the attachment proxy");

  const unavailableInfo=await worker.fetch(new Request("https://aryanzz.example/api/youtube/info?url="+encodeURIComponent("https://youtu.be/NoProvs1234")), {});
  assert.equal(unavailableInfo.status,200);
  const unavailableData=await unavailableInfo.json();
  assert.equal(unavailableData.providerReady,false);
  assert.equal(unavailableData.title,"Fallback YouTube Preview");
  assert.ok(unavailableData.providerFailures.length>0);
  console.log("✔ Clear no-provider state is returned when all community APIs fail");

  const statusResponse=await worker.fetch(new Request("https://aryanzz.example/api/youtube/status"),{});
  const statusData=await statusResponse.json();
  assert.equal(statusData.requiresApiKey,false);
  assert.equal(statusData.requiresPrivateServer,false);
  assert.ok(statusData.providers.piped.includes("kavin"));
  assert.ok(statusData.providers.invidious.includes("tiekoetter"));
  console.log("✔ Hybrid status confirms zero API keys and no private server requirement");

  assert.equal(requests.some(x=>x.url.hostname==="p.savenow.to"||x.url.hostname==="cobalt.example"),false);
  assert.ok(requests.some(x=>x.url.hostname==="pipedapi.kavin.rocks"));
  assert.ok(requests.some(x=>x.url.hostname==="invidious.tiekoetter.com"));

}finally{
  globalThis.fetch=originalFetch;
}

console.log("\nARYANZZ V71.0 YouTube flow, TikTok community handoff, zero-server downloader, Gradient Studio, file hashing and music recognition smoke tests passed.");
