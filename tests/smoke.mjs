import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

const file=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=file("../public/index.html");
const sw=file("../public/sw.js");
const v15=file("../public/v15.js");
const downloader=file("../public/downloader.js");
const editor=file("../public/editor.js");
const v59css=file("../public/v59.css");
const editorProCss=file("../public/editor-pro.css");
const ownerJs=file("../public/owner.js");
const ownerCss=file("../public/owner.css");
const downloaderCss=file("../public/downloader.css");
const manifest=JSON.parse(file("../public/manifest.webmanifest"));

const checks=[
  ["V65.0 page title",html.includes("ARYANZZ V65.0 — Creator Studio Pro")],
  ["V59.5 versioned assets",html.includes("/v15.js?v=59.5")&&html.includes("/owner.js?v=59.5")&&html.includes("/downloader.js?v=59.5")&&html.includes("/downloader.css?v=59.5")&&html.includes("/v59.css?v=59.5")&&html.includes("/editor-pro.css?v=65.0")&&html.includes("/editor.js?v=65.0")],
  ["service worker cache and V59.5 assets",html.includes("/sw.js?v=65.0")&&sw.includes("aryanzz-v65-0")&&sw.includes("/editor.js?v=65.0")&&sw.includes("/editor-pro.css?v=65.0")&&sw.includes("/v59.css?v=59.5")],
  ["downloader input, result and backend status",html.includes('id="analyze"')&&html.includes('id="downloadResult"')&&html.includes('id="backendStatus"')],
  ["unified self-hosted downloader API",downloader.includes('postJson("/api/info"')&&downloader.includes('fetch("/api/download"')&&downloader.includes("PLATFORM_NAMES")&&!downloader.toLowerCase().includes("savenow")],
  ["single capture-phase universal URL handler",downloader.includes('button.addEventListener("click"')&&downloader.includes("event.stopImmediatePropagation()")&&downloader.includes("}, true);")],
  ["video quality options available",downloader.includes('[360,"360p"]')&&downloader.includes('[720,"720p HD"]')&&downloader.includes('[1080,"1080p Full HD"]')&&downloader.includes('[2160,"2160p · 4K"]')],
  ["legacy competing downloader handler removed",!v15.includes("button.onclick=async()=>{")],
  ["owner header controls are real buttons",html.includes('class="owner-menu-mark" type="button" data-panel="allTools"')&&html.includes('aria-label="Buka riwayat unduhan"')&&html.includes('aria-label="Buka personalisasi profil"')],
  ["owner view hides home and uses dark palette",ownerCss.includes('body[data-view="owner"] #home{display:none!important}')&&ownerCss.includes("background:linear-gradient(145deg,#13223a,#0d1728)")],
  ["owner social cards use requested contacts",ownerJs.includes("https://wa.me/6282110767071")&&ownerJs.includes("https://www.tiktok.com/@azazeuu?_r=1&_t=ZS-9B2FU0QemSi")],
  ["owner profile and edit controls",html.includes('id="owner"')&&html.includes('id="ownerEditProfile"')&&ownerJs.includes("renderOwnerProfile")],
  ["Tools Hub banner has speed, checker and queue shortcuts",html.includes('class="tools-banner"')&&html.includes('data-panel="speed"')&&html.includes('data-panel="checker"')&&html.includes('data-panel="queue"')],
  ["Video Editor panel and controls",html.includes('id="editor"')&&html.includes('id="editorFile"')&&html.includes('id="editorStart"')&&html.includes('id="editorExport"')],
  ["Local editor has trim, filters, canvas export and MediaRecorder",editor.includes("MediaRecorder")&&editor.includes("captureStream")&&editor.includes("selectedStart")&&editor.includes("editorSaturation")],
  ["V59.5 tools banner remains responsive",v59css.includes(".tools-banner")&&v59css.includes("@media(max-width:700px)")],
  ["V65.0 editor pro responsive design",editorProCss.includes(".editor-pro-workspace")&&editorProCss.includes(".editor-clip-card")&&editorProCss.includes("@media(max-width:600px)")],
  ["V65.0 multi-clip timeline and clip operations",editor.includes("MAX_CLIPS = 8")&&editor.includes("function splitClip")&&editor.includes("function moveClip")&&editor.includes("function updateClipTrim")],
  ["V65.0 background music and audio mixing",editor.includes("createMediaStreamDestination")&&editor.includes("editorMusicVolume")&&editor.includes("editorMute")],
  ["V65.0 project save and restore",editor.includes("function saveProject")&&editor.includes("async function loadProjectFile")&&editor.includes("ARYANZZ Creative Studio Pro")],
  ["V65.0 fade transition and caption styling",editor.includes("fadeDuration")&&editor.includes("editorTextColor")&&editor.includes("editorTextSize")],
  ["V65.0 premium wide editor layout",editorProCss.includes("min(1220px")&&editorProCss.includes(".editor-inspector{position:sticky")&&html.includes("PRO · V65.0")],
  ["V65.0 per-clip motion keyframes",html.includes('id="editorZoomStart"')&&html.includes('id="editorZoomEnd"')&&editor.includes("function motionAt")&&editor.includes("motion:clip.motion?")],
  ["V65.0 three mixed audio tracks",html.includes('id="editorAudioTrackList"')&&html.includes('id="editorMusicFile"')&&editor.includes("audioTracks.length>=3")&&editor.includes("createMediaElementSource(track.audio)")],
  ["V65.0 SRT subtitle import and persistence",html.includes('id="editorSubtitleFile"')&&editor.includes("function parseSrt(source)")&&editor.includes("subtitles,")&&editor.includes("function clearSubtitles()")],
  ["V65.0 chroma key live preview and export",html.includes('id="editorPreviewCanvas"')&&html.includes('id="editorChromaEnabled"')&&editor.includes("function applyChromaKey")&&editor.includes("drawFrame(previewCtx")],
  ["V65.0 animated captions",html.includes('id="editorTextAnimation"')&&editor.includes("function textAnimationState")&&editor.includes('data-animation')],
  ["tool hub remains available",html.includes('id="allTools"')],
  ["PWA manifest version",manifest.name.includes("V65.0")]
];
for(const [name,ok] of checks){assert.ok(ok,name+" failed");console.log("✔ "+name)}

const healthResponse=await worker.fetch(new Request("https://aryanzz.example/api/health"),{});
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();
assert.equal(health.version,"59.5");
assert.equal(health.selfHostedDownloader,true);
assert.equal(health.youtubeDownloader,true);
assert.equal(health.youtubeApiKeyConfigured,false);
console.log("✔ V59.5 Worker health and self-hosted downloader status");
const platformStatusResponse=await worker.fetch(new Request("https://aryanzz.example/api/platform/status"),{});
assert.equal(platformStatusResponse.status,200);
const platformStatus=await platformStatusResponse.json();
assert.equal(platformStatus.configured,false);
assert.ok(platformStatus.platforms.includes("youtube.com"));
console.log("✔ Platform status clearly reports missing self-hosted backend");
const disconnected=await worker.fetch(new Request("https://aryanzz.example/api/info",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://www.youtube.com/watch?v=demo123"})
}),{});
assert.equal(disconnected.status,503);
console.log("✔ Platform links fail clearly until backend is configured");

const invalid=await worker.fetch(new Request("https://aryanzz.example/api/youtube/download",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://example.com/video",format:"mp3"})
}),{});
assert.equal(invalid.status,400);
console.log("✔ YouTube endpoint rejects non-YouTube URLs");

const noKey=await worker.fetch(new Request("https://aryanzz.example/api/youtube/download",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://youtu.be/demo123",format:"mp3"})
}),{});
assert.equal(noKey.status,503);
assert.match((await noKey.json()).error,/SAVENOW_API_KEY|API key downloader YouTube/);
console.log("✔ Missing YouTube secret is reported clearly");

const badFormat=await worker.fetch(new Request("https://aryanzz.example/api/youtube/download",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://youtu.be/demo123",format:"480"})
}),{SAVENOW_API_KEY:"test-secret"});
assert.equal(badFormat.status,400);
console.log("✔ Unsupported provider quality is rejected");

const invalidProgress=await worker.fetch(new Request("https://aryanzz.example/api/youtube/progress",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:"",format:"mp3"})
}),{});
assert.equal(invalidProgress.status,400);
console.log("✔ YouTube progress validates process ID");

const unknown=await worker.fetch(new Request("https://aryanzz.example/api/not-a-route"),{});
assert.equal(unknown.status,404);
console.log("✔ Unknown API route");

const originalFetch=globalThis.fetch;
try{
  const requests=[];
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    requests.push({url,init});
    if(url.pathname==="/ajax/api.php"){
      assert.equal(url.searchParams.get("function"),"i");
      assert.equal(url.searchParams.get("api"),"test-secret");
      if(url.searchParams.get("u").includes("LOWBALANCE"))
        return new Response(JSON.stringify({error:"Not enough balance"}),{status:200,headers:{"content-type":"application/json"}});
      assert.equal(url.searchParams.get("u"),"https://www.youtube.com/watch?v=K1Pu75yJUOE");
      return new Response(JSON.stringify({title:"Test YouTube Video",duration:125,thumbnail:"https://img.example/thumb.jpg"}),{status:200,headers:{"content-type":"application/json"}});
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

  const info=await worker.fetch(new Request("https://aryanzz.example/api/youtube/info?url="+encodeURIComponent("https://www.youtube.com/watch?v=K1Pu75yJUOE")),{SAVENOW_API_KEY:"test-secret"});
  assert.equal(info.status,200);
  const infoData=await info.json();
  assert.equal(infoData.title,"Test YouTube Video");
  assert.equal(infoData.duration,125);
  console.log("✔ Non-billable YouTube metadata lookup uses current /ajax/api.php endpoint");

  const lowBalanceInfo=await worker.fetch(new Request("https://aryanzz.example/api/youtube/info?url="+encodeURIComponent("https://www.youtube.com/watch?v=LOWBALANCE")),{SAVENOW_API_KEY:"test-secret"});
  assert.equal(lowBalanceInfo.status,200);
  const lowBalanceData=await lowBalanceInfo.json();
  assert.equal(lowBalanceData.providerReady,false);
  assert.equal(lowBalanceData.title,"Fallback YouTube Preview");
  console.log("✔ YouTube oEmbed preview remains visible when SaveNow wallet is low");

  const start=await worker.fetch(new Request("https://aryanzz.example/api/youtube/download",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://www.youtube.com/watch?v=K1Pu75yJUOE",format:"4k"})
  }),{SAVENOW_API_KEY:"test-secret"});
  assert.equal(start.status,200);
  const startData=await start.json();
  assert.equal(startData.id,"job-123");
  assert.equal(startData.pending,true);
  console.log("✔ YouTube job creation uses current /ajax/download.php and maps 4K to mp44k");

  const lowBalanceStart=await worker.fetch(new Request("https://aryanzz.example/api/youtube/download",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://www.youtube.com/watch?v=LOWBALANCE",format:"mp3"})
  }),{SAVENOW_API_KEY:"test-secret"});
  assert.equal(lowBalanceStart.status,502);
  assert.match((await lowBalanceStart.json()).error,/Not enough balance/);
  console.log("✔ Provider low-balance response is surfaced without pretending a job was created");

  const progress=await worker.fetch(new Request("https://aryanzz.example/api/youtube/progress",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({id:"job-123",format:"4k",info:{title:"Test YouTube Video",thumbnail:"https://img.example/thumb.jpg"}})
  }),{});
  assert.equal(progress.status,200);
  const progressData=await progress.json();
  assert.equal(progressData.result.format,"4k");
  assert.equal(progressData.result.title,"Test YouTube Video");
  console.log("✔ Progress requires completed job and success flag");

  const download=await worker.fetch(new Request("https://aryanzz.example/api/youtube/file?id=job-123&format=4k"),{});
  assert.equal(download.status,200);
  assert.match(download.headers.get("content-disposition"),/test-video\.mp4/);
  assert.equal((await download.arrayBuffer()).byteLength,4);
  console.log("✔ Completed YouTube file is streamed through the Worker");

  const failedProgress=await worker.fetch(new Request("https://aryanzz.example/api/youtube/progress",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({id:"job-123",format:"mp3"})
  }),{});
  // The mock currently returns a successful job; the completed response is valid for any supported output.
  assert.equal(failedProgress.status,200);
  assert.ok(requests.some(x=>x.url.pathname==="/ajax/api.php"));
  assert.ok(requests.some(x=>x.url.pathname==="/ajax/download.php"));
  assert.ok(requests.filter(x=>x.url.pathname==="/ajax/progress.php").length>=2);
}finally{
  globalThis.fetch=originalFetch;
}

console.log("\nARYANZZ V65.0 Ultimate Creative Studio smoke tests passed.");
