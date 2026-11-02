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
  ["V72.8 page title",html.includes("ARYANZZ V72.8 — All-in-One Creative Space")],
  ["V59.5 versioned assets",html.includes("/v15.js?v=59.5")&&html.includes("/owner.js?v=59.5")&&html.includes("/downloader.js?v=72.8")&&html.includes("/downloader.css?v=72.4")&&html.includes("/v59.css?v=59.5")&&html.includes("/editor-pro.css?v=65.0")&&html.includes("/editor.js?v=65.0")],
  ["service worker cache and V59.5 assets",html.includes("navigator.serviceWorker.register")&&sw.includes("aryanzz-v72-8")&&sw.includes("/editor.js?v=65.0")],
  ["downloader input, result and backend status",html.includes('id="analyze"')&&html.includes('id="downloadResult"')&&html.includes('id="backendStatus"')],
  ["unified self-hosted downloader API",downloader.includes('postJson("/api/info"')&&downloader.includes('"/api/direct-file?url="')&&downloader.includes("PLATFORM_NAMES")&&!downloader.toLowerCase().includes("savenow")],
  ["single capture-phase universal URL handler",downloader.includes('button.addEventListener("click"')&&downloader.includes("event.stopImmediatePropagation()")&&downloader.includes("}, true);")],
  ["video quality options available",downloader.includes('[360,"360p"]')&&downloader.includes('[720,"720p HD"]')&&downloader.includes('[1080,"1080p Full HD"]')&&downloader.includes('[2160,"2160p · 4K"]')],
  ["Piped audio-only responses do not preempt Invidious progressive MP4 discovery",downloader.includes("Instance Piped tidak menyediakan stream MP4 dan audio yang kompatibel")&&downloader.includes("Tidak menemukan pasangan stream MP4 dan audio")&&downloader.includes("currentInvidiousInstances")&&workerSource.includes('formats.some(item=>item.mode==="video"&&')],
  ["Hybrid YouTube API uses Piped and Invidious public instance failover",workerSource.includes("/streams/")&&workerSource.includes("/api/v1/videos/")&&workerSource.includes("PIPED_PUBLIC_INSTANCES")&&workerSource.includes("INVIDIOUS_PUBLIC_INSTANCES")],
  ["V72 format deduplication keeps muxed and video-only variants separate",workerSource.includes('(f.videoOnly?"video-only":"muxed")')&&downloader.includes('(f.videoOnly?"video-only":"muxed")')],
  ["V72 Piped parser retains adaptive video-only MP4 with audio",workerSource.includes("videoOnly=adaptiveSource")&&workerSource.includes('formats.some(audio=>audio.mode===\"audio\"&&audio.ext===\"m4a\")')],
  ["V72.8 worker aggregates multiple healthy provider instances and attaches each origin to its formats",workerSource.includes("const available=[...pipedProbe.results,...invProbe.results]")&&workerSource.includes("instance:result.instance,provider:result.provider")&&workerSource.includes("const settled=await Promise.all(instances.map")&&workerSource.includes("diagnostics:diagnostics.slice(0,20)")],
  ["V72.8 browser probes only first provider batch for faster result display",downloader.includes("const inv=invidiousInstances.slice(0,10),piped=pipedInstances.slice(0,20)")&&downloader.includes("diagnostics.push({provider,instance,error:")&&!downloader.includes("const batches=Math.max(Math.ceil(invidiousInstances.length/5)")],
  ["V72.8 prioritizes health-ranked dynamic Invidious instances before stale fallbacks",downloader.includes("new Set([...discovered,...fallback])")&&workerSource.includes("new Set([...discovered,...fallback])")],
  ["V72.8 probes a wider but bounded set of community providers",downloader.includes("invidiousInstances.slice(0,10),piped=pipedInstances.slice(0,20)")&&workerSource.includes("piped.slice(0,20)")&&workerSource.includes("inv.slice(0,10)")],
  ["V72.8 defaults to the highest available progressive quality up to 480p",downloader.includes("quickPool.filter(height=>height<=480).sort((a,b)=>b-a)[0]")&&downloader.includes("MP4 langsung")],
  ["V72.8 prefers one complete progressive MP4 and honors an explicitly selected adaptive quality",downloader.includes("const exactProgressive=progressive.filter")&&downloader.includes("const exactAdaptive=adaptive.filter")&&downloader.includes("if(exactProgressive.length)")],
  ["V72.8 merges adaptive tracks internally as one MP4 without exposing a separate audio file",downloader.includes("Komponen MP4 1/2")&&downloader.includes("Komponen MP4 2/2")&&downloader.includes("tidak ada file audio terpisah yang disimpan")],
  ["V72.8 shows transfer speed, remaining-time estimate and indeterminate progress",downloader.includes("function updateDownloadProgress")&&downloader.includes("sisa tahap")&&downloader.includes("is-indeterminate")],
  ["V72.8 hides audio format and bitrate controls outside audio mode",downloaderCss.includes(".youtube-result [hidden]{display:none!important}")&&downloader.includes("audioLabel.hidden=audioFormat.hidden")],
  ["V72.8 keeps FFmpeg warm after first use",downloader.includes("Keep the FFmpeg engine warm")&&!downloader.includes("ffmpeg.terminate();aryanzzFfmpegPromise=null")],
  ["V72.8 browser retains provider errors without waiting for further batches",downloader.includes("Provider errors are retained")&&!downloader.includes("if(available.length)break")],
  ["V72.8 browser aggregates provider instances and retries same-quality streams",downloader.includes("const available=[]")&&downloader.includes("for(const selected of candidates)")&&downloader.includes("selected.instance||info.instance")],
  ["V72.8 Invidious requests its local proxy URLs in both Worker and browser paths",workerSource.includes("?local=true")&&downloader.includes("?local=true")],
  ["V72.8 progressive MP4 is preflighted then streamed directly to Chrome",workerSource.includes('u.searchParams.get("probe")==="1"')&&downloader.includes("probe=1")&&downloader.includes("Chrome menampilkan progres dan sisa waktu sebenarnya")],
  ["V72.8 Worker validates dynamic Invidious origins against the public registry",workerSource.includes("currentHybridInvidiousInstances()")&&workerSource.includes("if(known)trustedInstance=instanceOrigin")],
  ["V72 FFmpeg merge uses stream copy into MP4",downloader.includes("muxYoutubeMp4")&&downloader.includes('"copy"')&&downloader.includes('"+faststart"')],
  ["V72 local FFmpeg worker bootstrap is included",file("../public/ffmpeg-worker-bootstrap.js").includes("@ffmpeg/ffmpeg@0.12.10")&&file("../public/sw.js").includes("/ffmpeg-worker-bootstrap.js?v=72.8")],
  ["V72 parses adaptive video-only MP4 plus matching M4A audio",workerSource.includes("adaptiveSource=false")&&workerSource.includes("hybridVideoFormat(item,instance,true,true)")&&workerSource.includes("videoOnly")&&downloader.includes('adaptive.map(item=>String(item?.type||item?.mimeType||')],
  ["V72 browser remuxes separate tracks locally with FFmpeg WASM",downloader.includes("loadBrowserFfmpeg")&&downloader.includes("classWorkerURL")&&downloader.includes("ffmpeg.exec")&&downloader.includes('"copy"')&&downloader.includes("muxYoutubeMp4")],
  ["V72 FFmpeg worker bootstrap is same-origin and cached",file("../public/ffmpeg-worker-bootstrap.js").includes("@ffmpeg/ffmpeg@0.12.10")&&sw.includes("/ffmpeg-worker-bootstrap.js?v=72.8")],
  ["Hybrid stream download is restricted to approved media hosts",workerSource.includes("function hybridMediaUrl")&&workerSource.includes("googlevideo.com")&&workerSource.includes("HYBRID_MEDIA_ROOTS")],
  ["Hybrid download uses attachment streaming and range requests",workerSource.includes("function hybridYoutubeFile")&&workerSource.includes("trustedInstance")&&workerSource.includes("content-disposition")&&workerSource.includes("headers.range=range")],
  ["No Cobalt or paid SaveNow downloader remains",!workerSource.includes("cobaltConfig")&&!workerSource.includes("SAVENOW_BASE")&&!workerSource.includes("SAVENOW_API_KEY")],
  ["TikTok is intentionally disabled while YouTube is prioritized",downloader.includes("TikTok sementara dinonaktifkan")],
  ["YouTube UI uses hybrid API and actual returned formats",downloader.includes("/api/youtube/hybrid/info")&&downloader.includes("/api/youtube/hybrid/file")&&downloader.includes("info.formats")&&downloader.includes("providerName!==\"Hybrid\"")],
  ["Browser-first hybrid lookup tries public Piped and Invidious instances",downloader.includes("browserHybridYoutubeInfo")&&downloader.includes("BROWSER_PIPED_INSTANCES")&&downloader.includes("BROWSER_INVIDIOUS_INSTANCES")],
  ["Piped instance list refreshes from the official directory with a snapshot fallback",downloader.includes("raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md")&&downloader.includes("currentPipedInstances")],
  ["Browser stream URLs are restricted to approved HTTPS media hosts",downloader.includes("function browserHybridMediaUrl")&&downloader.includes("googlevideo.com")&&downloader.includes("BROWSER_MEDIA_ROOTS")],
  ["Invidious API is requested without field projection and parser infers progressive MP4 from itag",workerSource.includes('"/api/v1/videos/"+encodeURIComponent(id)')&&!workerSource.includes('?fields=title,videoId,author,lengthSeconds,videoThumbnails,formatStreams,adaptiveFormats')&&workerSource.includes('progressiveSource&&[18,22,37,59,78,82,83,84,85].includes(itag)')],
  ["Browser races Invidious and Piped batches and discovers official CORS-enabled instances",downloader.includes("Promise.all([currentInvidiousInstances(),currentPipedInstances()])")&&downloader.includes("Promise.all(groups.map(group=>group.promise)")&&downloader.includes("api.invidious.io/instances.json")],
  ["Browser MP4 parser resolves the stream URL before reading its itag",(() => { const block=downloader.slice(downloader.indexOf("function browserVideoFormat"),downloader.indexOf("function browserAudioFormat")); return block.indexOf("const url=browserHybridMediaUrl")>=0 && block.indexOf("const height=browserVideoHeight")>block.indexOf("const url=browserHybridMediaUrl"); })()],
    ["Invidious formatStreams are parsed as progressive MP4 and retain their provider origin",downloader.includes("browserVideoFormat(item,providerInstance,progressiveSource=false,adaptiveSource=false)")&&downloader.includes("browserVideoFormat(item,instance,true)")&&downloader.includes("browserVideoHeight(item,url)")&&downloader.includes("itag")&&downloader.includes("const trusted=new URL(trustedOrigin)")&&downloader.includes("browserProviderRoot(trusted.hostname)")],
  ["Invidious media URLs are resolved against the active instance and allowed for download",downloader.includes("new URL(raw,trustedOrigin||undefined)")&&downloader.includes("browserHybridMediaUrl(selected.url,instance)")],
  ["MP4 quality options are derived from actual available video streams",downloader.includes("const hasVideo=")&&downloader.includes("if(videoOption)videoOption.disabled=!hasVideo")],

  ["Progressive MP4 uses a one-byte Worker preflight and direct Chrome attachment streaming",downloader.includes("probe=1")&&downloader.includes("anchor.download=filename")&&downloader.includes("Chrome menampilkan progres dan sisa waktu sebenarnya")&&workerSource.includes("content-disposition")],
  ["Adaptive MP4 remux fallback remains bounded for mobile memory",downloader.includes("maxTrack=110*1024*1024")&&downloader.includes("maxCombined=180*1024*1024")&&downloader.includes("melebihi batas memori HP")],
  ["Browser CORS failure on adaptive tracks is reported instead of claiming success",downloader.includes("browserError=error")&&downloader.includes("detail.error||browserError.message")],
  ["legacy competing downloader handler removed",!v15.includes("button.onclick=async()=>{")],
  ["owner header controls are real buttons",html.includes('class="owner-menu-mark" type="button" data-panel="allTools"')&&html.includes('aria-label="Buka riwayat unduhan"')&&html.includes('aria-label="Buka personalisasi profil"')],
  ["owner view hides home and uses dark palette",ownerCss.includes('body[data-view="owner"] #home{display:none!important}')&&ownerCss.includes("background:linear-gradient(145deg,#13223a,#0d1728)")],
  ["owner social cards use requested contacts",ownerJs.includes("https://wa.me/6282110767071")&&ownerJs.includes("https://www.tiktok.com/@azazeuu?_r=1&_t=ZS-9B2FU0QemSi")],
  ["profile background removal clears stored and applied background",file("../public/v25.js").includes('d.background="";if(!write(DESIGN_KEY,d))')&&file("../public/v25.js").includes('applyDesign();setSurface("aurora")')],
  ["profile banner can be removed from storage and all previews",html.includes('id="clearProfileBanner"')&&file("../public/v25.js").includes('d.banner="";if(!write(DESIGN_KEY,d))')&&file("../public/owner.js").includes('design.banner ?')],
  ["profile photo can be removed and owner view refreshes",html.includes('id="clearProfilePhoto"')&&file("../public/advanced.js").includes('photo:""')&&file("../public/owner.js").includes('aryanzz:profile-assets-updated')],
  ["member date is stored as local calendar date",file("../public/v25.js").includes('now.getFullYear()')&&file("../public/v25.js").includes('new Date(parts[0],parts[1]-1,parts[2])')],
  ["device history and explicit geolocation are local",file("../public/v25.js").includes("initDeviceHistory")&&file("../public/v25.js").includes("navigator.geolocation.getCurrentPosition")&&html.includes('id="deviceHistoryList"')],
  ["YouTube failure message is concise and explains provider outage",downloader.includes("MP4 belum tersedia dari provider gratis saat ini")&&downloader.includes("Detail: ")],
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
  ["V72.8 runs without a self-hosted extractor",workerSource.includes('version:"72.8"')&&workerSource.includes('mode:"cloudflare-worker-zero-server-hybrid"')&&workerSource.includes('platformBackend:"community-handoff"')&&!workerSource.includes("DOWNLOADER_CONTAINER")],
  ["Shazam fallback covers standard AudD auth/quota failures",workerSource.includes("shazamRecognize(audioBlob,env)")&&workerSource.includes("providerErrorCode")&&serverSource.includes("/api/music/recognize")&&serverSource.includes("shazam_recognize.py")],
  ["DJ mix scans fall back to Shazam when AudD Enterprise errors",workerSource.includes("shazamScan(fallbackSource")&&serverSource.includes("/api/music/scan")&&serverSource.includes("scanShazamMedia")],
  ["Docker backend includes yt-dlp, FFmpeg and ShazamIO",file("../Dockerfile").includes("yt-dlp")&&file("../Dockerfile").includes("shazamio==0.9.0")&&serverSource.includes("ffprobe")],
  ["Music Finder responsive styling",musicCss.includes(".music-grid")&&musicCss.includes("@media(max-width:620px)")],
  ["Video URL DJ scanning goes directly through AudD Enterprise",workerSource.includes('fetch("https://enterprise.audd.io/"')&&!musicJs.includes("identifyVideoUrl(url,startSeconds)")],
  ["tool hub remains available",html.includes('id="allTools"')],
  ["PWA manifest version",manifest.name.includes("V72.8")],
  ["V67.7 visual assets are loaded",html.includes("/v677.css?v=67.7")&&html.includes("/v677.js?v=67.7")&&sw.includes("/v677.css?v=67.7")&&sw.includes("/v677.js?v=67.7")],
  ["V67.7 home remains focused on the downloader",html.includes('id="home"')&&html.includes('id="downloadLinkMode"')&&!html.slice(html.indexOf('id="home"'),html.indexOf('id="toolsArea"')).includes('id="toolGrid"')],
  ["V67.7 feature identity map covers all tools",file("../public/v677.js").includes("const ICONS=")&&["speed","checker","queue","editor","musicFinder","history","imageTools","pdfTools","qrTools","securityTools","colorStudio","profile","owner","about","help"].every(id=>file("../public/v677.js").includes(id))],
  ["V67.7 expanded Color Studio palettes",file("../public/v677.js").includes("990M+ kombinasi palet")&&file("../public/v677.js").includes("Tyrian Purple")&&file("../public/v677.js").includes("holographic")],
  ["V67.7 reduced-motion support",file("../public/v677.css").includes("prefers-reduced-motion")],
  ["V67.9 remaining tools have branded backgrounds",v677css.includes('data-feature="gradientStudio"')&&v677css.includes('data-feature="fileHash"')&&v677css.includes("#editor .editor-pro-head")&&v677css.includes("#profile .v25-profile-cover")],
  ["V67.9 Color Studio favorites and clipboard work after redesign",v677js.includes("palette.onclick=async event")&&v677js.includes("favorites.onclick=async event")&&v677js.includes('localStorage.setItem("aryanzz.color-favorites.v674"')&&v677js.includes("copyExpandedColor")],

  ["V72.8 service worker cache and creative assets",sw.includes("aryanzz-v72-8")&&sw.includes("/v680.css?v=71.0")&&sw.includes("/v680.js?v=71.0")&&html.includes("/v680.js?v=71.0")],
  ["V67.9 downloader preserves direct-source details",downloader.includes("function responseFilename")&&downloader.includes("const directMedia=!!info.extension&&!info.extractor")&&downloader.includes("/api/platform/status")],
  ["V72.8 title search has no-server YouTube handoff",file("../public/v674.js").includes("Buka hasil YouTube")&&file("../public/v674.js").includes("salin tautan video")],
  ["V67.9 direct media whitelist includes common formats",workerSource.includes('"mkv"')&&workerSource.includes('"avi"')&&workerSource.includes('"aiff"')&&workerSource.includes('"opus"')],
  ["V72.8 Gradient Studio controls are wired",html.includes('id="gradientStudio"')&&html.includes('id="gradientRandom"')&&html.includes('id="gradientPng"')&&file("../public/v680.js").includes("function renderGradient")],
  ["V72.8 File Hash Checker uses local Web Crypto",html.includes('id="fileHash"')&&html.includes('id="hashCompute"')&&file("../public/v680.js").includes("crypto.subtle.digest")],
];
for(const [name,ok] of checks){assert.ok(ok,name+" failed");console.log("✔ "+name)}

const healthResponse=await worker.fetch(new Request("https://aryanzz.example/api/health"),{});
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();
assert.equal(health.version,"72.8");
assert.equal(health.selfHostedDownloader,false);
assert.equal(health.youtubeDownloader,true);
assert.equal(health.mode,"cloudflare-worker-zero-server-hybrid");
assert.equal(health.platformBackend,"community-handoff");
assert.equal(health.directMediaDownload,true);
assert.equal(health.musicRecognitionConfigured,false);
assert.equal(health.youtubeApiKeyConfigured,false);
console.log("✔ V72.8 Worker health and zero-server status");
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

const invalidHybrid=await worker.fetch(new Request("https://aryanzz.example/api/youtube/hybrid/info?url="+encodeURIComponent("https://example.com/video")),{}); 
assert.equal(invalidHybrid.status,400);
console.log("✔ Hybrid YouTube endpoint rejects non-YouTube URLs");

const legacyPaidEndpoint=await worker.fetch(new Request("https://aryanzz.example/api/youtube/download",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://youtu.be/demo123",format:"mp3"})
}),{});
assert.equal(legacyPaidEndpoint.status,404);
const legacyProgressEndpoint=await worker.fetch(new Request("https://aryanzz.example/api/youtube/progress",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:"job-123",format:"mp3"})
}),{});
assert.equal(legacyProgressEndpoint.status,404);
console.log("✔ Legacy paid downloader/progress endpoints are removed in V72.8");

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
  console.log("✔ V72.8 health keeps the no-server mode active");
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
    if(url.hostname==="raw.githubusercontent.com"&&url.pathname==="/TeamPiped/documentation/main/content/docs/public-instances/index.md"){
      return new Response("Instance API URL\\nhttps://pipedapi.example.org\\nhttps://pipedapi.kavin.rocks",{status:200,headers:{"content-type":"text/plain"}});
    }
    if(url.hostname==="api.invidious.io"){
      return new Response(JSON.stringify([["https://inv.nadeko.net",{api:true,cors:true}],["https://inv.dynamic.example",{api:true,cors:true}]]),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.pathname==="/ajax/api.php"){
      assert.equal(url.searchParams.get("function"),"i");
      assert.equal(url.searchParams.get("api"),"test-secret");
      if(url.searchParams.get("u").includes("LOWBALANCE"))
        return new Response(JSON.stringify({error:"Not enough balance"}),{status:200,headers:{"content-type":"application/json"}});
      assert.equal(url.searchParams.get("u"),"https://www.youtube.com/watch?v=K1Pu75yJUOE");
      return new Response(JSON.stringify({title:"Test YouTube Video",duration:125,thumbnail:"https://img.example/thumb.jpg"}),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.pathname.startsWith("/streams/")&&url.hostname.startsWith("pipedapi.")){
      const id=url.pathname.split("/").pop();
      if(id==="INVFAIL"||id==="NORESULT")return new Response("temporarily unavailable",{status:503});
      return new Response(JSON.stringify({
        title:"Hybrid Piped Test Video",duration:125,uploader:"Test Channel",
        thumbnailUrl:"https://img.example/piped-thumb.jpg",
        videoStreams:[
          {mimeType:"video/mp4",format:"MPEG_4",height:360,quality:"360p",videoOnly:false,url:id==="DYNAMIC1"?"https://pipedproxy.example.org/videoplayback?itag=18&sig=test":"https://pipedproxy-bom.kavin.rocks/videoplayback?itag=18&sig=test",bitrate:500000},
          {mimeType:"video/mp4",format:"MPEG_4",height:720,quality:"720p",videoOnly:false,url:"https://pipedproxy-bom.kavin.rocks/videoplayback?itag=22&sig=test",bitrate:1500000},
          {mimeType:"video/mp4",format:"MPEG_4",height:1080,quality:"1080p",videoOnly:true,url:"https://pipedproxy-bom.kavin.rocks/videoplayback?itag=137&sig=test",bitrate:3000000}
        ],
        audioStreams:[{mimeType:"audio/mp4",format:"M4A",quality:"128 kbps",bitrate:128000,url:id==="DYNAMIC1"?"https://pipedproxy.example.org/videoplayback?itag=140&sig=test":"https://pipedproxy-bom.kavin.rocks/videoplayback?itag=140&sig=test"}]
      }),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="inv.nadeko.net"&&url.pathname==="/videoplayback"){
      if(url.searchParams.get("itag")==="403")return new Response("forbidden",{status:403});
      const bytes=new Uint8Array([1,2,3,4]);
      if(init.headers?.range==="bytes=0-0")return new Response(bytes.slice(0,1),{status:206,headers:{"content-type":"video/mp4","content-length":"1","content-range":"bytes 0-0/4","accept-ranges":"bytes"}});
      if(init.headers?.range==="bytes=0-1")return new Response(bytes.slice(0,2),{status:206,headers:{"content-type":"video/mp4","content-length":"2","content-range":"bytes 0-1/4","accept-ranges":"bytes"}});
      return new Response(bytes,{status:200,headers:{"content-type":"video/mp4","content-length":"4","accept-ranges":"bytes"}});
    }
    if(url.hostname==="inv.dynamic.example"&&url.pathname==="/videoplayback"){
      const bytes=new Uint8Array([1,2,3,4]);
      if(init.headers?.range==="bytes=0-0")return new Response(bytes.slice(0,1),{status:206,headers:{"content-type":"video/mp4","content-length":"1","content-range":"bytes 0-0/4","accept-ranges":"bytes"}});
      return new Response(bytes,{status:200,headers:{"content-type":"video/mp4","content-length":"4","accept-ranges":"bytes"}});
    }
    if(url.pathname.startsWith("/api/v1/videos/")&&url.hostname==="inv.nadeko.net"){
      assert.equal(url.searchParams.has("fields"),false);
      assert.equal(url.searchParams.get("local"),"true");
      const id=url.pathname.split("/").pop();
      if(id==="NORESULT")return new Response("unavailable",{status:503});
      return new Response(JSON.stringify({
        title:"Hybrid Invidious Fallback",videoId:id,author:"Fallback Channel",lengthSeconds:90,
        videoThumbnails:[{quality:"maxresdefault",url:"https://img.example/invidious.jpg"}],
        formatStreams:[
          {url:"https://inv.nadeko.net/videoplayback?itag=18",type:"video/mp4; codecs=avc1",container:"mp4",qualityLabel:"360p",resolution:"640x360"},
          {url:"https://inv.nadeko.net/videoplayback?itag=22",container:"mp4",itag:"22"}
        ],
        adaptiveFormats:[{url:"https://inv.nadeko.net/videoplayback?itag=137",type:"video/mp4; codecs=avc1",qualityLabel:"1080p",itag:"137"},{url:"https://inv.nadeko.net/videoplayback?itag=140",type:"audio/mp4; codecs=mp4a.40.2",audioQuality:"AUDIO_QUALITY_MEDIUM"}]
      }),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="pipedproxy-bom.kavin.rocks"||url.hostname==="pipedproxy.example.org"||url.hostname==="rr1---sn.googlevideo.com"){
      const bytes=new Uint8Array([1,2,3,4]);
      if(init.headers?.range==="bytes=0-1")return new Response(bytes.slice(0,2),{status:206,headers:{"content-type":"video/mp4","content-length":"2","content-range":"bytes 0-1/4","accept-ranges":"bytes"}});
      return new Response(bytes,{status:200,headers:{"content-type":"video/mp4","content-length":"4","accept-ranges":"bytes"}});
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

  const hybridInfo=await worker.fetch(new Request("https://aryanzz.example/api/youtube/hybrid/info?url="+encodeURIComponent("https://youtu.be/4dpnHLPMQGs")),{}); 
  assert.equal(hybridInfo.status,200);
  const hybridData=await hybridInfo.json();
  assert.equal(hybridData.providerReady,true);
  assert.equal(hybridData.provider,"Piped");
  assert.equal(hybridData.title,"Hybrid Piped Test Video");
  assert.deepEqual([...new Set(hybridData.formats.filter(x=>x.mode==="video").map(x=>x.height))].sort((a,b)=>a-b),[360,720,1080]);
  assert.ok(hybridData.providers.length>=2,"All healthy providers should be returned for download failover");
  assert.ok(hybridData.formats.some(x=>x.instance&&x.provider),"Each stream should retain its provider origin");
  assert.ok(hybridData.formats.some(x=>x.mode==="video"&&x.videoOnly===true&&x.height===1080),"Piped adaptive 1080p stream should be kept for browser muxing");
  assert.equal(hybridData.formats.find(x=>x.mode==="audio").ext,"m4a");
  console.log("✔ Hybrid primary Piped API returns progressive and adaptive MP4 plus audio formats");
  const dynamicInfo=await worker.fetch(new Request("https://aryanzz.example/api/youtube/hybrid/info?url="+encodeURIComponent("https://www.youtube.com/watch?v=DYNAMIC1")),{}); 
  assert.equal(dynamicInfo.status,200);
  const dynamicData=await dynamicInfo.json();
  assert.equal(dynamicData.providerReady,true);
  assert.equal(dynamicData.instance,"https://pipedapi.example.org");
  assert.ok(dynamicData.formats.some(x=>x.mode==="audio"&&x.ext==="m4a"&&x.url.includes("pipedproxy.example.org")),"audio on discovered sibling proxy must be retained");
  const dynamicFileUrl="https://aryanzz.example/api/youtube/hybrid/file?url="+encodeURIComponent("https://pipedproxy.example.org/videoplayback?itag=18&sig=test")+"&ext=mp4&title=Dynamic%20Piped&instance="+encodeURIComponent("https://pipedapi.example.org");
  const dynamicFile=await worker.fetch(new Request(dynamicFileUrl),{});
  assert.equal(dynamicFile.status,200);
  assert.equal((await dynamicFile.arrayBuffer()).byteLength,4);
  console.log("✔ Dynamic Piped instance, sibling media proxy and M4A audio are supported");


  const hybridFileUrl="https://aryanzz.example/api/youtube/hybrid/file?url="+encodeURIComponent("https://pipedproxy-bom.kavin.rocks/videoplayback?itag=22&sig=test")+"&ext=mp4&title="+encodeURIComponent("Hybrid Piped Test Video");
  const hybridFile=await worker.fetch(new Request(hybridFileUrl),{});
  assert.equal(hybridFile.status,200);
  assert.match(hybridFile.headers.get("content-disposition"),/Hybrid%20Piped%20Test%20Video\.mp4/);
  assert.equal((await hybridFile.arrayBuffer()).byteLength,4);
  console.log("✔ Hybrid file route streams an attachment for Chrome download manager");

  const hybridRange=await worker.fetch(new Request(hybridFileUrl,{headers:{range:"bytes=0-1"}}),{});
  assert.equal(hybridRange.status,206);
  assert.equal(hybridRange.headers.get("content-range"),"bytes 0-1/4");
  assert.equal((await hybridRange.arrayBuffer()).byteLength,2);
  console.log("✔ Hybrid file route preserves HTTP range requests for resumable downloads");

  const blockedHybridHost=await worker.fetch(new Request("https://aryanzz.example/api/youtube/hybrid/file?url="+encodeURIComponent("https://evil.example/file.mp4")+"&ext=mp4"),{});
  assert.equal(blockedHybridHost.status,400);
  console.log("✔ Hybrid file route rejects untrusted stream hosts");

  const invidiousFallback=await worker.fetch(new Request("https://aryanzz.example/api/youtube/hybrid/info?url="+encodeURIComponent("https://www.youtube.com/watch?v=INVFAIL")),{}); 
  assert.equal(invidiousFallback.status,200);
  const invidiousData=await invidiousFallback.json();
  assert.equal(invidiousData.providerReady,true);
  assert.equal(invidiousData.provider,"Invidious");
  assert.ok(invidiousData.formats.some(x=>x.mode==="video"&&x.height===360));
  assert.ok(invidiousData.formats.some(x=>x.mode==="video"&&x.height===720),"itag-only progressive MP4 should infer 720p");
  assert.ok(invidiousData.formats.some(x=>x.mode==="audio"&&x.ext==="m4a"));
  assert.ok(invidiousData.formats.some(x=>x.mode==="video"&&x.videoOnly===true&&x.height===1080),"adaptive video-only MP4 should be retained for browser-side muxing");
  assert.ok(invidiousData.formats.some(x=>x.mode==="video"&&x.url.startsWith("https://inv.nadeko.net/videoplayback")),"Invidious local=true must return instance-proxied stream URLs");
  const invidiousProxyFileUrl="https://aryanzz.example/api/youtube/hybrid/file?url="+encodeURIComponent("https://inv.nadeko.net/videoplayback?itag=18&sig=proxy")+"&ext=mp4&title="+encodeURIComponent("Invidious Proxy Test")+"&instance="+encodeURIComponent("https://inv.nadeko.net");
  const invidiousProxyProbe=await worker.fetch(new Request(invidiousProxyFileUrl+"&probe=1"),{});
  assert.equal(invidiousProxyProbe.status,200);
  assert.equal((await invidiousProxyProbe.json()).ok,true);
  const invidiousProxyFile=await worker.fetch(new Request(invidiousProxyFileUrl),{});
  assert.equal(invidiousProxyFile.status,200);
  assert.match(invidiousProxyFile.headers.get("content-disposition"),/Invidious%20Proxy%20Test\.mp4/);
  assert.equal((await invidiousProxyFile.arrayBuffer()).byteLength,4);
  console.log("✔ Invidious local proxy stream passes one-byte preflight and streams directly as an attachment");
  const dynamicInvidiousFileUrl="https://aryanzz.example/api/youtube/hybrid/file?url="+encodeURIComponent("https://inv.dynamic.example/videoplayback?itag=18")+"&ext=mp4&title=Dynamic%20Invidious&instance="+encodeURIComponent("https://inv.dynamic.example");
  const dynamicInvidiousFile=await worker.fetch(new Request(dynamicInvidiousFileUrl),{});
  assert.equal(dynamicInvidiousFile.status,200);
  assert.equal((await dynamicInvidiousFile.arrayBuffer()).byteLength,4);
  console.log("✔ Dynamically discovered Invidious origins are validated before proxy streaming");
  const blockedInvidiousProbe=await worker.fetch(new Request(invidiousProxyFileUrl.replace("%3D18","%3D403")+"&probe=1"),{});
  assert.equal(blockedInvidiousProbe.status,502);
  console.log("✔ A 403 media response fails preflight and is not reported as a successful download");
  console.log("✔ Invidious fallback is used when Piped instances are unavailable");

  const noInstance=await worker.fetch(new Request("https://aryanzz.example/api/youtube/hybrid/info?url="+encodeURIComponent("https://www.youtube.com/watch?v=NORESULT")),{}); 
  assert.equal(noInstance.status,200);
  const noInstanceData=await noInstance.json();
  assert.equal(noInstanceData.providerReady,false);
  assert.equal(noInstanceData.formats.length,0);
  assert.match(noInstanceData.providerMessage,/instance komunitas/i);
  console.log("✔ Hybrid mode fails gracefully without paid API fallback when all instances fail");

  const hybridStatus=await worker.fetch(new Request("https://aryanzz.example/api/youtube/status"),{});
  assert.equal(hybridStatus.status,200);
  const hybridStatusData=await hybridStatus.json();
  assert.equal(hybridStatusData.provider,"Dynamic Piped + Invidious hybrid");
  assert.equal(hybridStatusData.paidProvider,false);
  assert.equal(hybridStatusData.cobalt,false);
  console.log("✔ YouTube status confirms zero-paid hybrid mode without Cobalt");

  const health=await worker.fetch(new Request("https://aryanzz.example/api/health"),{});
  const healthData=await health.json();
  assert.equal(healthData.version,"72.8");
  assert.equal(healthData.cobalt,false);
  assert.equal(healthData.paidYoutubeProvider,false);
  console.log("✔ Worker health reports V72.8 with no Cobalt or paid YouTube provider");

}finally{
  globalThis.fetch=originalFetch;
}

console.log("\nARYANZZ V72.8 YouTube flow, TikTok community handoff, zero-server downloader, Gradient Studio, file hashing and music recognition smoke tests passed.");
