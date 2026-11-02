import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

const file=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=file("../public/index.html");
const workerSource=file("../src/index.js");
const sw=file("../public/sw.js");
const v15=file("../public/v15.js");
const downloader=file("../public/downloader.js");
const v674=file("../public/v674.js");
const downloaderCss=file("../public/downloader.css");
const v674Css=file("../public/v674.css");
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
const audioStudioJs=file("../public/audio-studio.js");
const audioStudioCss=file("../public/audio-studio.css");
const imageStudioJs=file("../public/image-studio.js");
const imageStudioCss=file("../public/image-studio.css");
const profileJs=file("../public/v25.js");
const manifest=JSON.parse(file("../public/manifest.webmanifest"));
const deployWorkflow=file("../.github/workflows/deploy-cloudflare.yml");

const checks=[

  ["V73.7 presents a visible tap-to-download link for completed browser files",downloader.includes("function addReadyDownloadLink")&&downloader.includes("youtube-ready-link")&&downloader.includes("Unduh MP4 sekarang")&&!downloader.includes("document.body.append(anchor);anchor.click();anchor.remove();")],
  ["V73.7 adaptive MP4 shows three clear stages and only reaches 100% after the file is ready",downloader.includes("Tahap 1/3 · Video")&&downloader.includes("Tahap 2/3 · Audio")&&downloader.includes("Tahap 3/3 · Menyatukan MP4")&&downloader.includes('bar.style.width="100%"')],
  ["V73.7 downloader can cancel in-progress transfers and FFmpeg assembly",downloader.includes("youtube-cancel")&&downloader.includes("activeDownloadController.abort()")&&downloader.includes("activeDownloadFfmpeg.terminate()")],
  ["V73.7 platform picker covers major social services",html.includes('data-platform="youtube"')&&html.includes('data-platform="tiktok"')&&html.includes('data-platform="instagram"')&&html.includes('data-platform="snackvideo"')&&html.includes('data-platform="pinterest"')&&html.includes('data-platform="facebook"')&&html.includes('data-platform="x"')&&html.includes('data-platform="reddit"')&&html.includes('data-platform="threads"')&&html.includes('data-platform="soundcloud"')&&html.includes('data-platform="capcut"')],
  ["V73.7 downloader headings and primary labels are Indonesian",html.includes("Semua berawal")&&html.includes("Mau unduh apa?")&&html.includes("Tempel tautan")&&html.includes("Cari judul")],
  ["V73.7 refreshes provider metadata once after HTTP 403/429/5xx and skips already attempted streams",downloader.includes("async function refreshYoutubeProviderInfo")&&downloader.includes("retryState={refreshed:false,attempted:[]}")&&downloader.includes("if(!retryState.refreshed&&retryable)")&&downloader.includes("attempted.has(candidateKey(item))")],
  ["V73.7 bounds provider retries while retaining multiple same-quality instances",downloader.includes("selectProviderCandidates(progressive")&&downloader.includes("selectProviderCandidates(adaptive")&&downloader.includes("selectProviderCandidates(all.filter(item=>item.ext===audioFormat),2,8)")],
  ["V73.7 explains automatic provider switching and refreshes expiring stream URLs",downloader.includes("otomatis beralih ke provider lain")&&downloader.includes("memperbarui daftar sumber")],

  ["V73.7 quality menu displays estimated or provider-reported sizes",downloader.includes("function youtubeQualityEstimate")&&downloader.includes("estimate.exact?\"\":\"±\"")&&downloader.includes("formatDownloadSize(estimate.bytes)")],
  ["V73.7 format metadata retains byte sizes and bitrate estimates",downloader.includes("sizeBytes:browserFormatSizeBytes(item)")&&workerSource.includes("sizeBytes:hybridFormatSizeBytes(item)")&&downloader.includes("function estimateFormatBytes")],
  ["V73.7 direct progressive MP4 shows actual size before Chrome handoff",downloader.includes("actualBytes=Number(check.totalBytes)||0")&&downloader.includes("actualSizeExact?\"Ukuran file: \":\"Perkiraan ukuran: ±\"")&&downloader.includes("siap ✓")&&downloader.includes("youtube-ready-link")],
  ["V73.7 adaptive assembly reports video and audio byte totals before FFmpeg",downloader.includes("const measuredSizeNote=")&&downloader.includes("loadBrowserFfmpeg(progressText,progressMeta,bar,measuredSizeNote)")],
  ["V73.7 browser preflight fails over after 12 seconds and waits for Service Worker control",downloader.includes("downloadTimeoutSignal(12000)")&&downloader.includes("waitForServiceWorkerController")],
  ["V73.7 quality hint explains direct MP4 versus local assembly",downloader.includes("MP4 langsung · ")&&downloader.includes("Gabung video + audio otomatis")&&downloader.includes('qualityHint.hidden=mode.value==="audio"||(!isYouTube&&!(info.providerName==="Public API"&&heights.length))')],

  ["V73.7 Service Worker streams approved media from the browser and preserves download headers",sw.includes('u.pathname==="/api/youtube/hybrid/browser-file"')&&sw.includes("fetch(validation.url")&&sw.includes('"content-disposition"')&&sw.includes("headers.range=range")&&sw.includes('mode:"cors"')],
  ["V73.7 Worker validates browser-side media URLs against trusted provider instances",workerSource.includes("async function hybridYoutubeValidate")&&workerSource.includes("hybridMediaUrl(rawStream,trustedInstance)")&&workerSource.includes("/api/youtube/hybrid/validate")],
  ["V73.7 progressive downloads fall back to browser-side streaming after Worker rejection",downloader.includes("/api/youtube/hybrid/browser-file?")&&downloader.includes("navigator.serviceWorker?.controller")&&downloader.includes("Mencoba koneksi provider dari jaringan HP")],

  ["V73.7 deployment checks all available MP4 candidates and treats public-provider 403 as a warning",deployWorkflow.includes("mp4Formats.slice(0, 20)")&&deployWorkflow.includes("Live public providers returned metadata but blocked or failed stream preflight")&&!deployWorkflow.includes("Metadata exists, but every live MP4 stream preflight failed")],
  ["V73.7 adaptive MP4 prepares FFmpeg in parallel with the video component download",downloader.includes("const [downloadedVideo,readyFfmpeg]=await Promise.all([")&&downloader.includes("loadBrowserFfmpeg(progressText,progressMeta,bar,measuredSizeNote)")&&downloader.includes("fetchYoutubeTrack(videoItem,info,maxTrack,bar,progressText,progressMeta,\"Tahap 1/3 · Video\"")&&downloader.includes("await ffmpeg.writeFile(inputVideo,videoBytes);videoBytes=null;")&&downloader.includes("await ffmpeg.writeFile(inputAudio,audioBytes);audioBytes=null;")],
  ["V73.7 direct media proxy forwards byte ranges and preserves resume headers",workerSource.includes('getUpstream(parsed,"GET",range)')&&workerSource.includes('request.headers.get("range")')&&workerSource.includes('"content-range"')&&workerSource.includes('status:upstream.status')],
  ["V73.7 adaptive progress updates while each 1 MiB chunk is streamed",downloader.includes("reader=response.body?.getReader()")&&downloader.includes("received:received+inFlight")&&downloader.includes("Potongan 1 MB disimpan lokal")],
  ["V77.0 adds Threads, SoundCloud and CapCut to the unified platform picker",html.includes('data-platform="threads"')&&html.includes('data-platform="soundcloud"')&&html.includes('data-platform="capcut"')&&workerSource.includes('soundcloud:["soundcloud.com"],capcut:["capcut.com"]')],
  ["V77.0 TikTok quality selector is populated from real provider resolutions",workerSource.includes("const rawQuality=item?.height??item?.quality??item?.resolution??item?.qualityLabel??label;")&&downloader.includes("available.map(value=>[value,value+\"p · tersedia\"])")&&downloader.includes("n>=100&&n<=4320")],
  ["V77.0 title search routes YouTube through hybrid public search and displays in-page result cards",workerSource.includes("async function hybridYouTubeSearch(query)")&&workerSource.includes('if(url.pathname==="/api/search"&&request.method==="POST")return searchYouTube(request,env)')&&file("../public/v674.js").includes('selected==="youtube"?"/api/search":"/api/social/search"')&&file("../public/v674.js").includes('pick.textContent="Lihat & unduh"')],
  ["V77.0 social downloads use a same-origin Worker proxy and validate MP4/WebM signatures",workerSource.includes('url.pathname==="/api/social-file"')&&workerSource.includes("detectSocialMediaSignature")&&downloader.includes('probeUrl.searchParams.set("probe","1")')&&downloader.includes('ready.pathname!=="/api/social-file"')],
  ["V77.0 social stream header timeout does not abort the media body after headers arrive",workerSource.includes("async function fetchSocialHeaders")&&workerSource.includes("finally{clearTimeout(timer);}")&&workerSource.includes("fetchSocialHeaders(current.href")],
  ["V77.0 social downloads reject image assets, HTML error pages and partial streams",workerSource.includes("if(image)return null")&&workerSource.includes("File ditolak: isi file tidak cocok")&&workerSource.includes("upstream.status===206")&&workerSource.includes("File media terpotong")],
  ["V77.0 social videos marked video-only are not offered as complete video files",workerSource.includes("videoOnly,hasAudio")&&downloader.includes('item.videoOnly||!["mp4","m4v"].includes(String(item.ext||"").toLowerCase())')],
  ["V77.0 verified social files use the detected extension with inline preview and attachment download headers",downloader.includes('else link.removeAttribute("download")')&&workerSource.includes('(preview?"inline":"attachment")+"; filename*=UTF-8')],
  ["V77.0 social media files are saved only after source-size preflight and full browser transfer",downloader.includes("Memeriksa ukuran dan isi media")&&downloader.includes("probeUrl.searchParams.set(\"probe\",\"1\")")&&downloader.includes("await saveBrowserBlob(blob")&&downloader.includes("response.headers.get(\"x-aryanzz-media-validation\")")],
  ["V77.0 custom output filename is honored by the public social provider",downloader.includes("info.outputName||info.title")&&downloader.includes("info.outputName||info.filename")],
  ["V80.0 page title",html.includes("ARYANZZ V80.0 — Ruang Kreatif")],
  ["V59.5 versioned assets",html.includes("/v15.js?v=59.5")&&html.includes("/owner.js?v=59.5")&&html.includes("/downloader.js?v=80.0")&&html.includes("/downloader.css?v=80.0")&&html.includes("/v59.css?v=59.5")&&html.includes("/editor-pro.css?v=65.0")&&html.includes("/editor.js?v=65.0")],
  ["service worker cache and V59.5 assets",html.includes("navigator.serviceWorker.register")&&sw.includes("aryanzz-v80-1")&&sw.includes("/editor.js?v=65.0")],
  ["downloader input, result and backend status",html.includes('id="analyze"')&&html.includes('id="downloadResult"')&&html.includes('id="backendStatus"')],
  ["unified self-hosted downloader API",downloader.includes('postJson("/api/info"')&&downloader.includes('"/api/direct-file?url="')&&downloader.includes("PLATFORM_NAMES")&&!downloader.toLowerCase().includes("savenow")],
  ["single capture-phase universal URL handler",downloader.includes('button.addEventListener("click"')&&downloader.includes("event.stopImmediatePropagation()")&&downloader.includes("}, true);")],
  ["video quality options available",downloader.includes('[360,"360p"]')&&downloader.includes('[720,"720p HD"]')&&downloader.includes('[1080,"1080p Full HD"]')&&downloader.includes('[2160,"2160p · 4K"]')],
  ["Piped audio-only responses do not preempt Invidious progressive MP4 discovery",downloader.includes("Instance Piped tidak menyediakan stream MP4 dan audio yang kompatibel")&&downloader.includes("Tidak menemukan pasangan stream MP4 dan audio")&&downloader.includes("currentInvidiousInstances")&&workerSource.includes('formats.some(item=>item.mode==="video"&&')],
  ["Hybrid YouTube API uses Piped and Invidious public instance failover",workerSource.includes("/streams/")&&workerSource.includes("/api/v1/videos/")&&workerSource.includes("PIPED_PUBLIC_INSTANCES")&&workerSource.includes("INVIDIOUS_PUBLIC_INSTANCES")],
  ["V72 format deduplication keeps muxed and video-only variants separate",workerSource.includes('(f.videoOnly?"video-only":"muxed")')&&downloader.includes('(f.videoOnly?"video-only":"muxed")')],
  ["V72 Piped parser retains adaptive video-only MP4 with audio",workerSource.includes("videoOnly=adaptiveSource")&&workerSource.includes('formats.some(audio=>audio.mode===\"audio\"&&audio.ext===\"m4a\")')],
  ["V73.7 worker aggregates multiple healthy provider instances and attaches each origin to its formats",workerSource.includes("const available=[...pipedProbe.results,...invProbe.results]")&&workerSource.includes("instance:result.instance,provider:result.provider")&&workerSource.includes("const settled=await Promise.all(instances.map")&&workerSource.includes("diagnostics:diagnostics.slice(0,20)")],
  ["V73.7 browser probes only first provider batch for faster result display",downloader.includes("const inv=invidiousInstances.slice(0,10),piped=pipedInstances.slice(0,20)")&&downloader.includes("diagnostics.push({provider,instance,error:")&&!downloader.includes("const batches=Math.max(Math.ceil(invidiousInstances.length/5)")],
  ["V73.7 prioritizes health-ranked dynamic Invidious instances before stale fallbacks",downloader.includes("new Set([...discovered,...fallback])")&&workerSource.includes("new Set([...discovered,...fallback])")],
  ["V73.7 probes a wider but bounded set of community providers",downloader.includes("invidiousInstances.slice(0,10),piped=pipedInstances.slice(0,20)")&&workerSource.includes("piped.slice(0,20)")&&workerSource.includes("inv.slice(0,10)")],
  ["V73.7 defaults to the highest available progressive quality up to 480p",downloader.includes("quickPool.filter(height=>height<=480).sort((a,b)=>b-a)[0]")&&downloader.includes("MP4 langsung")],
  ["V73.7 prefers exact progressive/adaptive quality then falls back through smaller MP4 options",downloader.includes("const exactProgressive=progressive.filter")&&downloader.includes("const exactAdaptive=adaptive.filter")&&downloader.includes("candidates=[...exactProgressive,...exactAdaptive,...progressiveFallback,...adaptiveFallback]")],
  ["V73.7 merges adaptive video and audio tracks internally as one MP4",downloader.includes("Tahap 1/3 · Video")&&downloader.includes("Tahap 2/3 · Audio")&&downloader.includes("Sumber memisahkan video dan suara")],
  ["V73.7 shows transfer speed, remaining-time estimate and indeterminate progress",downloader.includes("function updateDownloadProgress")&&downloader.includes("sisa ±")&&downloader.includes("is-indeterminate")&&downloader.includes('indexedDB.open("aryanzz-download-resume"')],
  ["V73.7 mobile adaptive downloads use 1 MiB streaming checkpoints and resumable IndexedDB chunks",downloader.includes("fetchYoutubeTrackRanges")&&downloader.includes("const chunkSize=1024*1024")&&downloader.includes("inFlight+=result.value.byteLength")&&downloader.includes("readDownloadChunk")&&downloader.includes("writeDownloadChunk")&&downloader.includes("downloadResumePrefix")],
  ["V73.7 Speed, Max Speed and Mega Speed controls are visible for YouTube video and wired to adaptive downloads",downloader.includes("Normal · 1 jalur")&&downloader.includes("Cepat · 3 jalur")&&downloader.includes("Maksimal · 5 jalur")&&downloader.includes("speedLabel.hidden=!isYouTube")&&downloader.includes("Number(speedSelect.value)||3")],
  ["V73.7 adaptive memory budget scales with device memory and retries lower MP4 quality",downloader.includes("function youtubeMuxMemoryBudget")&&downloader.includes("navigator.deviceMemory")&&downloader.includes("maxTrack:280*1024*1024")&&downloader.includes("maxCombined:440*1024*1024")&&downloader.includes("probeYoutubeTrack")&&downloader.includes("progressiveFallback")&&downloader.includes("kualitas lebih rendah")],
  ["V73.7 YouTube thumbnail download sits below the title without an overlay preview",downloader.includes("details.append(thumbAction)")&&downloader.includes("youtube-thumb-download")&&downloader.includes("/api/youtube/hybrid/thumbnail")&&!downloader.includes('make("img","youtube-thumbnail")')&&!downloaderCss.includes("position:absolute")&&workerSource.includes("function hybridYoutubeThumbnail")],
  ["V73.7 Worker probe returns total bytes and range metadata for resumable chunks",workerSource.includes("totalBytes:totalBytes||null")&&workerSource.includes("contentRange:contentRange||null")&&workerSource.includes("headers.range=range")],
  ["V73.7 hides audio format and bitrate controls outside audio mode",downloaderCss.includes(".youtube-result [hidden]{display:none!important}")&&downloader.includes("audioLabel.hidden=audioFormat.hidden")],
  ["V73.7 keeps FFmpeg warm after first use",downloader.includes("let aryanzzFfmpegPromise=null")&&downloader.includes("if(aryanzzFfmpegPromise)")&&downloader.includes("activeDownloadFfmpeg.terminate()")],
  ["V73.7 browser retains provider errors without waiting for further batches",downloader.includes("Provider errors are retained")&&!downloader.includes("if(available.length)break")],
  ["V73.7 browser aggregates provider instances and retries same-quality streams",downloader.includes("const available=[]")&&downloader.includes("for(const selected of candidates)")&&downloader.includes("selected.instance||info.instance")],
  ["V73.7 Invidious requests its local proxy URLs in both Worker and browser paths",workerSource.includes("?local=true")&&downloader.includes("?local=true")],
  ["V73.7 progressive MP4 is preflighted then streamed directly to Chrome",workerSource.includes('u.searchParams.get("probe")==="1"')&&downloader.includes("probe=1")&&downloader.includes("youtube-ready-link")&&downloader.includes("Tekan tombol unduh di bawah")],
  ["V73.7 Worker validates dynamic Invidious origins against the public registry",workerSource.includes("currentHybridInvidiousInstances()")&&workerSource.includes("if(known)trustedInstance=instanceOrigin")],
  ["V72 FFmpeg merge uses stream copy into MP4",downloader.includes("muxYoutubeMp4")&&downloader.includes('"copy"')&&downloader.includes('"+faststart"')],
  ["V72 local FFmpeg worker bootstrap is included",file("../public/ffmpeg-worker-bootstrap.js").includes("@ffmpeg/ffmpeg@0.12.10")&&file("../public/sw.js").includes("/ffmpeg-worker-bootstrap.js?v=80.0")],
  ["V72 parses adaptive video-only MP4 plus matching M4A audio",workerSource.includes("adaptiveSource=false")&&workerSource.includes("hybridVideoFormat(item,instance,true,true)")&&workerSource.includes("videoOnly")&&downloader.includes('adaptive.map(item=>String(item?.type||item?.mimeType||')],
  ["V72 browser remuxes separate tracks locally with FFmpeg WASM",downloader.includes("loadBrowserFfmpeg")&&downloader.includes("classWorkerURL")&&downloader.includes("ffmpeg.exec")&&downloader.includes('"copy"')&&downloader.includes("muxYoutubeMp4")],
  ["V72 FFmpeg worker bootstrap is same-origin and cached",file("../public/ffmpeg-worker-bootstrap.js").includes("@ffmpeg/ffmpeg@0.12.10")&&sw.includes("/ffmpeg-worker-bootstrap.js?v=80.0")],
  ["Hybrid stream download is restricted to approved media hosts",workerSource.includes("function hybridMediaUrl")&&workerSource.includes("googlevideo.com")&&workerSource.includes("HYBRID_MEDIA_ROOTS")],
  ["Hybrid download uses attachment streaming and range requests",workerSource.includes("function hybridYoutubeFile")&&workerSource.includes("trustedInstance")&&workerSource.includes("content-disposition")&&workerSource.includes("headers.range=range")],
  ["No Cobalt or paid SaveNow downloader remains",!workerSource.includes("cobaltConfig")&&!workerSource.includes("SAVENOW_BASE")&&!workerSource.includes("SAVENOW_API_KEY")],
  ["Social links are resolved by the free public provider and expose real MP4/MP3 download links",workerSource.includes("FREE_MEDIA_API")&&workerSource.includes("freeProviderMediaInfo")&&downloader.includes('info.providerName==="Public API"')&&downloader.includes("selected.downloadUrl")],
  ["YouTube retries the public free extractor after community stream 403/429 failures",downloader.includes("Provider komunitas menolak stream")&&downloader.includes('postJson("/api/info",{url})')&&downloader.includes('return await downloadFile(url,mode,quality,bar,progressText,publicInfo,audioFormat)')],
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

  ["Progressive MP4 uses a one-byte Worker preflight and direct Chrome attachment streaming",downloader.includes("probe=1")&&downloader.includes("link.download=filename")&&downloader.includes("youtube-ready-link")&&downloader.includes("Tekan tombol unduh di bawah")&&workerSource.includes("content-disposition")],
  ["Adaptive MP4 remux fallback uses device-aware memory budgets",downloader.includes("function youtubeMuxMemoryBudget")&&downloader.includes("maxTrack:280*1024*1024")&&downloader.includes("maxCombined:440*1024*1024")&&downloader.includes("melewati batas aman memori perangkat")&&downloader.includes("progressiveFallback")],
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
  ["V74.0 runs without a self-hosted or paid extractor",workerSource.includes('version:"80.0"')&&workerSource.includes('mode:"cloudflare-worker-zero-server-hybrid"')&&workerSource.includes('platformBackend:"public-free-community-api"')&&!workerSource.includes("DOWNLOADER_CONTAINER")],
  ["Shazam fallback covers standard AudD auth/quota failures",workerSource.includes("shazamRecognize(audioBlob,env)")&&workerSource.includes("providerErrorCode")&&serverSource.includes("/api/music/recognize")&&serverSource.includes("shazam_recognize.py")],
  ["DJ mix scans fall back to Shazam when AudD Enterprise errors",workerSource.includes("shazamScan(fallbackSource")&&serverSource.includes("/api/music/scan")&&serverSource.includes("scanShazamMedia")],
  ["Docker backend includes yt-dlp, FFmpeg and ShazamIO",file("../Dockerfile").includes("yt-dlp")&&file("../Dockerfile").includes("shazamio==0.9.0")&&serverSource.includes("ffprobe")],
  ["Music Finder responsive styling",musicCss.includes(".music-grid")&&musicCss.includes("@media(max-width:620px)")],
  ["Video URL DJ scanning goes directly through AudD Enterprise",workerSource.includes('fetch("https://enterprise.audd.io/"')&&!musicJs.includes("identifyVideoUrl(url,startSeconds)")],
  ["tool hub remains available",html.includes('id="allTools"')],
  ["PWA manifest version",manifest.name.includes("V80.0")],
  ["V67.7 visual assets are loaded",html.includes("/v677.css?v=67.7")&&html.includes("/v677.js?v=67.7")&&sw.includes("/v677.css?v=67.7")&&sw.includes("/v677.js?v=67.7")],
  ["V67.7 home remains focused on the downloader",html.includes('id="home"')&&html.includes('id="downloadLinkMode"')&&!html.slice(html.indexOf('id="home"'),html.indexOf('id="toolsArea"')).includes('id="toolGrid"')],
  ["V67.7 feature identity map covers all tools",file("../public/v677.js").includes("const ICONS=")&&["speed","checker","queue","editor","musicFinder","history","imageTools","pdfTools","qrTools","securityTools","colorStudio","profile","owner","about","help"].every(id=>file("../public/v677.js").includes(id))],
  ["V67.7 expanded Color Studio palettes",file("../public/v677.js").includes("990M+ kombinasi palet")&&file("../public/v677.js").includes("Tyrian Purple")&&file("../public/v677.js").includes("holographic")],
  ["V67.7 reduced-motion support",file("../public/v677.css").includes("prefers-reduced-motion")],
  ["V67.9 remaining tools have branded backgrounds",v677css.includes('data-feature="gradientStudio"')&&v677css.includes('data-feature="fileHash"')&&v677css.includes("#editor .editor-pro-head")&&v677css.includes("#profile .v25-profile-cover")],
  ["V67.9 Color Studio favorites and clipboard work after redesign",v677js.includes("palette.onclick=async event")&&v677js.includes("favorites.onclick=async event")&&v677js.includes('localStorage.setItem("aryanzz.color-favorites.v674"')&&v677js.includes("copyExpandedColor")],

  ["V74.0 service worker cache and creative assets",sw.includes("aryanzz-v80-0")&&sw.includes("/v680.css?v=71.0")&&sw.includes("/v680.js?v=71.0")&&html.includes("/v680.js?v=71.0")],
  ["V67.9 downloader preserves direct-source details",downloader.includes("function responseFilename")&&downloader.includes("const directMedia=!!info.extension&&!info.extractor")&&downloader.includes("/api/platform/status")],
  ["V73.7 unified title search renders social results in-page",file("../public/v674.js").includes('youtube:{name:"YouTube"')&&file("../public/v674.js").includes("/api/social/search")&&file("../public/v674.js").includes("Lihat & unduh")&&html.includes('data-platform="snackvideo"')],
  ["V67.9 direct media whitelist includes common formats",workerSource.includes('"mkv"')&&workerSource.includes('"avi"')&&workerSource.includes('"aiff"')&&workerSource.includes('"opus"')],
  ["V73.7 Gradient Studio controls are wired",html.includes('id="gradientStudio"')&&html.includes('id="gradientRandom"')&&html.includes('id="gradientPng"')&&file("../public/v680.js").includes("function renderGradient")],
  ["V73.7 File Hash Checker uses local Web Crypto",html.includes('id="fileHash"')&&html.includes('id="hashCompute"')&&file("../public/v680.js").includes("crypto.subtle.digest")],
  ["V74.0 Audio Studio is reachable from the tools grid",html.includes('id="audioStudio"')&&html.includes('data-panel="audioStudio"')&&html.includes('/audio-studio.js?v=80.0')&&html.includes('/audio-studio.css?v=80.0')],
  ["V74.0 local MP4/audio to MP3 conversion supports pitch, volume, and 10-band EQ",audioStudioJs.includes("libmp3lame")&&audioStudioJs.includes("asetrate=44100*")&&audioStudioJs.includes("equalizer=f=")&&audioStudioJs.includes("alimiter=limit=0.95")&&html.includes('id="audioStudioEq"')],
  ["V74.0 audio conversion has cancellation, progress, safe filename, and size guard",audioStudioJs.includes("audioStudioCancel")&&audioStudioJs.includes('setProgress(100, "done")')&&audioStudioJs.includes("MAX_FILE_BYTES")&&audioStudioJs.includes('safeName($("audioStudioName").value)')&&audioStudioCss.includes(".audio-progress-track")],
  ["V74.0 profile banner/photo remove controls are conditional and non-overlapping",profileJs.includes("if(removeBanner)removeBanner.hidden=!d.banner")&&profileJs.includes("if(removeAvatar)removeAvatar.hidden=!d.avatar")&&file("../public/v25.css").includes(".v25-cover-actions")],
  ["V74.0 profile name and bio save automatically with local IndexedDB snapshots",profileJs.includes("PROFILE_KEY")&&profileJs.includes("queueAutoSnapshot()")&&profileJs.includes("indexedDB.open(AUTOSAVE_DB,1)")],
  ["V74.0 profile backup supports export, import, and automatic restore",profileJs.includes("setupBackupActions")&&profileJs.includes("restoreAutoBackup")&&profileJs.includes("aryanzz-backup-")],
  ["V74.0 motion toggle controls profile and panel reveal animations",profileJs.includes('document.body.dataset.motion==="off"')&&file("../public/v677.js").includes('document.body.dataset.motion==="off"')&&file("../public/v25.css").includes('body[data-motion="off"] .v677-reveal')],
  ["V74.0 YouTube title search has free Piped/Invidious fallback",workerSource.includes("async function hybridYouTubeSearch(query)")&&workerSource.includes("const hybrid=await hybridYouTubeSearch(query)")],
  ["V74.0 YouTube MP4 assembly shows preparation state and has a bounded FFmpeg load timeout",downloader.includes("Mesin MP4 belum siap setelah 90 detik")&&downloader.includes("Menunggu mesin MP4 siap sebelum mengambil audio")],
  ["V80.0 all 12 social platforms render in a fixed five-column grid without horizontal scrolling",html.includes('data-platform="youtube"')&&html.includes('data-platform="tiktok"')&&html.includes('data-platform="instagram"')&&html.includes('data-platform="snackvideo"')&&html.includes('data-platform="capcut"')&&html.includes('data-platform="pinterest"')&&html.includes('data-platform="facebook"')&&html.includes('data-platform="x"')&&html.includes('data-platform="reddit"')&&html.includes('data-platform="vimeo"')&&html.includes('data-platform="threads"')&&html.includes('data-platform="soundcloud"')&&downloaderCss.includes("grid-template-columns:repeat(5,minmax(0,1fr))")&&downloaderCss.includes("overflow:visible;align-items:stretch")],
  ["V80.0 SoundCloud title search supports audio-only verified results",workerSource.includes('key==="soundcloud"')&&workerSource.includes("mediaMode:playable.mode")&&v674.includes('item.mediaMode==="audio"?"Audio":"Video"')],
  ["V80.0 Pinterest short pin.it URLs are accepted by the paste normalizer",downloader.includes("pin\\.it")&&workerSource.includes('"pin.it":"pinterest"')],
  ["V80.0 paste handler normalizes share text, schemeless links and common social domains",downloader.includes("function normalizeMediaInput")&&downloader.includes("const url = normalizeMediaInput(raw)")&&downloader.includes("instagr.am")&&downloader.includes("capcut.com")],
  ["V80.0 CapCut and Instagram short domains are identified in the frontend and Worker",downloader.includes('["capcut.com","CapCut"]')&&downloader.includes('["instagr.am","Instagram"]')&&workerSource.includes('"instagr.am":"instagram"')],
  ["V80.0 social video download and quality controls expose only genuine MP4/M4V files",downloader.includes('!["mp4","m4v"].includes(String(item.ext||"").toLowerCase())')&&downloader.includes("const qualityFormats=")&&downloader.includes("tidak akan mengganti ekstensi")],
  ["V80.0 provider status exposes separate TikTok, Instagram, SnackVideo and CapCut capabilities",workerSource.includes('id:"tiktok"')&&workerSource.includes('id:"instagram"')&&workerSource.includes('id:"snackvideo"')&&workerSource.includes('id:"capcut"')&&workerSource.includes("liveAvailability")],
  ["V80.0 social search parser accepts HTML result anchors with href and class in either order",workerSource.includes("const anchors=")&&workerSource.includes("attrs.match")],
  ["V80.0 provider parser accepts alternate video_url and audio_url response shapes",workerSource.includes("normalized?.video_url")&&workerSource.includes("rawResult.video?.url")&&workerSource.includes("normalized?.audio_url")],
  ["V77.0 social video previews use a same-origin range-enabled inline proxy",workerSource.includes("async function fetchSocialUpstream(mediaUrl,sourceUrl,rangeHeader)")&&workerSource.includes('headers.range=rangeHeader')&&downloader.includes("preview.src=previewSource.href")&&downloader.includes("previewFormat.previewUrl")],
  ["V77.0 social preview and Chrome resume preserve Content-Range and Accept-Ranges",workerSource.includes('headers.set("content-range",rangeHeader)')&&workerSource.includes('headers.set("accept-ranges","bytes")')&&workerSource.includes("socialMimeForExtension(requestedExt,mode)")],
  ["V77.0 social media probes report total size and stop stalled streams",workerSource.includes("const totalBytes=rangeTotal")&&workerSource.includes("async function readSocialChunk")&&workerSource.includes("60 detik. Unduhan dihentikan")],
  ["V77.0 social downloads show real transfer progress and save only after complete Blob",downloader.includes("async function readBrowserChunk")&&downloader.includes("new Blob(chunks")&&downloader.includes("transfer baru dimulai, belum selesai.")&&downloader.includes('bar.style.width="100%"')],
  ["V77.0 downloaded MP4 must contain ftyp, moov and mdat and match the source duration before saving",downloader.includes("async function inspectMp4Blob")&&downloader.includes("File MP4 belum utuh")&&downloader.includes("berbeda jauh dari durasi sumber")&&downloader.indexOf('const blob=new Blob(chunks,{type:check.mimeType')<downloader.indexOf("await inspectMp4Blob(blob")&&downloader.indexOf("await inspectMp4Blob(blob")<downloader.lastIndexOf("await saveBrowserBlob(blob")],

  ["V77.0 social title search verifies metadata and actual CDN media bytes before filtering dead links",workerSource.includes("async function verifySocialSearchResult")&&workerSource.includes("socialMediaFile(new Request(probeUrl.href))")&&workerSource.includes("const results=checked.filter(Boolean)")&&file("../public/v674.js").includes("Tautan terverifikasi")&&file("../public/v674.js").includes("tautan mati/tidak menyediakan media dilewati")],


  ["V80.0 platform picker renders all 12 requested services including Vimeo in the markup",["youtube","tiktok","instagram","snackvideo","capcut","pinterest","facebook","x","reddit","vimeo","threads","soundcloud"].every(id=>html.includes('data-platform="'+id+'"'))],
  ["V80.0 platform picker uses a five-column CSS grid with no horizontal scroll",downloaderCss.includes("grid-template-columns:repeat(5,minmax(0,1fr))!important")&&downloaderCss.includes("overflow:visible!important")&&downloaderCss.includes("min-width:0!important")],
  ["V80.0 narrow-screen overrides no longer force 74px platform cards or nowrap labels",v674Css.includes(".v736-platform{min-width:0}")&&v674Css.includes(".v736-platform span:last-child{white-space:normal}")&&!v674Css.includes("min-width:74px")&&!v674Css.includes("white-space:nowrap")],
  ["V80.0 platform logos have consistent branded icon tiles and responsive labels",downloaderCss.includes(".v736-logo{")&&downloaderCss.includes(".v736-instagram{background:linear-gradient")&&downloaderCss.includes("overflow-wrap:anywhere")&&html.includes("12 PLATFORM")],
  ["V80.0 Reddit short video host v.redd.it routes through the Reddit provider",workerSource.includes('"v.redd.it":"reddit"')&&workerSource.includes('id:"reddit",domains:["reddit.com","redd.it","v.redd.it"]')],


  ["V80.1 Image Studio editor controls and client-side export are present",html.includes('id="imageStudioFile"')&&html.includes('id="imageEditorCanvas"')&&html.includes('id="imageExport"')&&imageStudioJs.includes("createImageBitmap")&&imageStudioJs.includes("canvas.toBlob")],
  ["V80.1 Image Studio supports all requested aspect ratios and custom pixel dimensions",html.includes('value="1:1"')&&html.includes('value="4:3"')&&html.includes('value="3:2"')&&html.includes('value="16:9"')&&html.includes('value="9:16"')&&html.includes('value="6:8"')&&html.includes('data-image-ratio="9:16"')&&html.includes('class="image-ratio-gallery"')&&imageStudioJs.includes('syncRatioGallery')&&imageStudioJs.includes('imageCustomWidth')&&imageStudioJs.includes('imageCustomHeight')],
  ["V80.1 Image Downloader has platform search and public-post extraction controls",html.includes('id="imageSearchPlatform"')&&html.includes('id="imageSearchQuery"')&&html.includes('id="imageExtractButton"')&&workerSource.includes('async function searchSocialImages')&&workerSource.includes('async function imagePostMetadata')],
  ["V80.1 image downloads use a validated same-origin image proxy and reject non-image content",workerSource.includes('url.pathname==="/api/image/file"')&&workerSource.includes('safePublicMediaUrl(raw)')&&workerSource.includes('image/jpeg')&&workerSource.includes('Sumber tidak mengirim file gambar yang didukung')],
  ["V80.1 Image Studio CSS and JavaScript are loaded and cached by the service worker",html.includes('/image-studio.css?v=80.1')&&html.includes('/image-studio.js?v=80.1')&&sw.includes('/image-studio.css?v=80.1')&&sw.includes('/image-studio.js?v=80.1')&&imageStudioCss.includes('.image-download-results')],
  ["V80.1 CapCut and Pinterest marks use updated reference-style SVG paths",html.includes('viewBox="0 0 32 32"')&&html.includes('class="v736-logo v736-pinterest"')&&html.includes('fill="#fff"')]

 ];
 for(const [name,ok] of checks){assert.ok(ok,name+" failed");console.log("✔ "+name)}


const invalidImageSearch=await worker.fetch(new Request("https://aryanzz.example/api/image/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({platform:"pinterest",query:"x"})}),{});
assert.equal(invalidImageSearch.status,400);
const blockedImageProxy=await worker.fetch(new Request("https://aryanzz.example/api/image/file?url="+encodeURIComponent("https://localhost/private.jpg")),{});
assert.equal(blockedImageProxy.status,400);
console.log("✔ Image search validates short queries and image proxy blocks localhost targets");


const healthResponse=await worker.fetch(new Request("https://aryanzz.example/api/health"),{});
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();
assert.equal(health.version,"80.0");
assert.equal(health.selfHostedDownloader,false);
assert.equal(health.youtubeDownloader,true);
assert.equal(health.mode,"cloudflare-worker-zero-server-hybrid");
assert.equal(health.platformBackend,"public-free-community-api");
assert.equal(health.directMediaDownload,true);
assert.equal(health.musicRecognitionConfigured,false);
assert.equal(health.youtubeApiKeyConfigured,false);
console.log("✔ V74.0 Worker health and zero-server status");
const platformStatusResponse=await worker.fetch(new Request("https://aryanzz.example/api/platform/status"),{});
assert.equal(platformStatusResponse.status,200);
const platformStatus=await platformStatusResponse.json();
assert.equal(platformStatus.configured,false);
assert.equal(platformStatus.backend,"public-community-api");
assert.deepEqual(platformStatus.platforms.map(item=>item.id),["youtube","tiktok","instagram","snackvideo","capcut","pinterest","facebook","x","reddit","vimeo","threads","soundcloud"]);
assert.ok(platformStatus.platforms.find(item=>item.id==="instagram").domains.includes("instagr.am"));
assert.ok(platformStatus.platforms.find(item=>item.id==="pinterest").domains.includes("pin.it"));
assert.ok(platformStatus.platforms.find(item=>item.id==="reddit").domains.includes("v.redd.it"));
assert.ok(platformStatus.platforms.find(item=>item.id==="soundcloud").mediaModes.includes("audio"));
assert.ok(platformStatus.platforms.every(item=>item.pasteLink&&item.titleSearch&&item.preview));
console.log("✔ Platform status reports free public provider with no private extractor");
const originalSocialFetch=globalThis.fetch;
try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    assert.equal(url.hostname,"btch-downloader-api-green.vercel.app");
    assert.equal(url.pathname,"/api/download/tiktok");
    assert.equal(url.searchParams.get("url"),"https://www.tiktok.com/@demo/video/1234567890");
    return new Response(JSON.stringify({success:true,normalized:{kind:"media",title:"Test TikTok",thumbnail:"https://cdn.example/thumb.jpg",duration:14,media:[
      {label:"Video 720p",type:"video",url:"https://cdn.example/video-720.mp4",height:720},
      {label:"Video Full HD",type:"video",url:"https://cdn.example/video-1080.mp4",quality:"1080p"},
      {label:"Audio MP3",type:"audio",url:"https://cdn.example/audio.mp3"},
      {label:"Cover image",type:"image",url:"https://cdn.example/cover.jpg"}
    ]}}),{status:200,headers:{"content-type":"application/json"}});
  };
  const socialInfo=await worker.fetch(new Request("https://aryanzz.example/api/info",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url:"https://www.tiktok.com/@demo/video/1234567890"})
  }),{});
  assert.equal(socialInfo.status,200);
  const socialData=await socialInfo.json();
  assert.equal(socialData.providerName,"Public API");
  assert.equal(socialData.title,"Test TikTok");
  assert.equal(socialData.formats.length,3);
  assert.equal(socialData.formats[0].mode,"video");
  assert.equal(socialData.formats[0].height,1080,"1080p text labels must normalize into a selectable resolution");
  assert.equal(socialData.formats[1].height,720);
  assert.equal(socialData.formats[2].mode,"audio");
  assert.match(socialData.formats[0].downloadUrl,/api\/social-file/);
  assert.match(socialData.formats[0].previewUrl,/preview=1/);
  assert.equal(new URL(socialData.formats[0].downloadUrl).origin,"https://aryanzz.example");
  const mp4Bytes=Uint8Array.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,2,0,105,115,111,109,105,115,111,50]);
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    assert.equal(url.hostname,"cdn.example");
    assert.equal(url.pathname,"/video-1080.mp4");
    const headers=new Headers(init.headers);
    assert.equal(headers.get("referer"),"https://www.tiktok.com/");
    const range=headers.get("range");
    if(range){
      const match=range.match(/^bytes=(\d+)-(\d*)$/);assert.ok(match,"range request must be valid");
      const first=Number(match[1]),last=Math.min(mp4Bytes.length-1,match[2]?Number(match[2]):mp4Bytes.length-1);
      if(first>=mp4Bytes.length)return new Response(null,{status:416,headers:{"content-range":"bytes */"+mp4Bytes.length}});
      const body=mp4Bytes.slice(first,last+1);
      return new Response(body,{status:206,headers:{"content-type":"video/mp4","content-length":String(body.length),"content-range":"bytes "+first+"-"+last+"/"+mp4Bytes.length,"accept-ranges":"bytes"}});
    }
    return new Response(mp4Bytes,{status:200,headers:{"content-type":"video/mp4","content-length":String(mp4Bytes.length),"accept-ranges":"bytes"}});
  };
  const socialProbeUrl=new URL(socialData.formats[0].downloadUrl);socialProbeUrl.searchParams.set("probe","1");
  const socialProbe=await worker.fetch(new Request(socialProbeUrl.href),{});
  assert.equal(socialProbe.status,200);
  const socialProbeData=await socialProbe.json();
  assert.equal(socialProbeData.valid,true);
  assert.equal(socialProbeData.mimeType,"video/mp4");
  assert.equal(socialProbeData.extension,"mp4");
  assert.equal(socialProbeData.bytes,mp4Bytes.length,"range preflight must report the complete source size, not only the first chunk");
  const socialFile=await worker.fetch(new Request(socialData.formats[0].downloadUrl),{});
  assert.equal(socialFile.status,200);
  assert.equal(socialFile.headers.get("content-type"),"video/mp4");
  assert.equal(socialFile.headers.get("content-length"),String(mp4Bytes.length));
  assert.match(socialFile.headers.get("content-disposition"),/Test_TikTok\.mp4/);
  assert.deepEqual(new Uint8Array(await socialFile.arrayBuffer()),mp4Bytes);
  const previewUrl=new URL(socialData.formats[0].previewUrl);
  const previewFirst=await worker.fetch(new Request(previewUrl.href,{headers:{range:"bytes=0-15"}}),{});
  assert.equal(previewFirst.status,206);
  assert.equal(previewFirst.headers.get("content-range"),"bytes 0-15/24");
  assert.match(previewFirst.headers.get("content-disposition"),/^inline;/);
  assert.equal((await previewFirst.arrayBuffer()).byteLength,16);
  const previewSeek=await worker.fetch(new Request(previewUrl.href,{headers:{range:"bytes=16-23"}}),{});
  assert.equal(previewSeek.status,206);
  assert.equal(previewSeek.headers.get("content-range"),"bytes 16-23/24");
  assert.equal((await previewSeek.arrayBuffer()).byteLength,8);
  console.log("✔ Social video preview supports same-origin HTTP ranges, seeking and inline playback");
  console.log("✔ Social video downloads are proxied, signature-checked and stream intact");
  globalThis.fetch=async()=>new Response("<html>blocked</html>",{status:200,headers:{"content-type":"text/html"}});
  const htmlError=await worker.fetch(new Request(socialProbeUrl.href),{});
  assert.equal(htmlError.status,502,"HTML error pages must never be saved as MP4");
  globalThis.fetch=async()=>new Response(mp4Bytes.slice(0,20),{status:200,headers:{"content-type":"video/mp4","content-length":"24"}});
  const truncated=await worker.fetch(new Request(socialProbeUrl.href),{});
  assert.equal(truncated.status,502,"truncated media must fail preflight");
  globalThis.fetch=async()=>new Response(mp4Bytes,{status:206,headers:{"content-type":"video/mp4","content-length":"24","content-range":"bytes 0-23/100"}});
  const partialProbe=await worker.fetch(new Request(socialProbeUrl.href),{});
  assert.equal(partialProbe.status,200,"a valid range preflight should be accepted");
  assert.equal((await partialProbe.json()).bytes,100,"Content-Range must expose the full file size");
  const unsolicitedPartial=await worker.fetch(new Request(socialData.formats[0].downloadUrl),{});
  assert.equal(unsolicitedPartial.status,502,"an unsolicited partial response must not be presented as a complete download");
  console.log("✔ Social media preflight rejects HTML and truncated media, and reports full size from Content-Range");
 }finally{globalThis.fetch=originalSocialFetch;}
const originalPlatformMatrixFetch=globalThis.fetch;
try{
  const cases=[
    {id:"tiktok",url:"https://vm.tiktok.com/ZTestTikTok/",key:"tiktok"},
    {id:"instagram",url:"https://instagr.am/p/TestInstagram/",key:"instagram"},
    {id:"snackvideo",url:"https://s.snackvideo.com/p/TestSnackVideo",key:"snackvideo"},
    {id:"capcut",url:"https://www.capcut.com/t/TestCapCut",key:"capcut"}
  ];
  globalThis.fetch=async(input)=>{
    const url=new URL(typeof input==="string"?input:input.url);
    assert.equal(url.hostname,"btch-downloader-api-green.vercel.app");
    const key=cases.find(item=>url.pathname==="/api/download/"+item.key);
    assert.ok(key,"provider endpoint must match one platform in the matrix");
    assert.equal(url.searchParams.get("url"),key.url);
    const normalized={kind:"media",title:"Verified "+key.id,thumbnail:"https://cdn.example/"+key.id+".jpg",duration:28,media:[{label:"Video MP4 720p",type:"video",mimeType:"video/mp4",url:"https://cdn.example/"+key.id+".mp4",height:720}]};
    const payload=key.id==="capcut"?{success:true,result:{title:"Verified capcut",video_url:"https://cdn.example/capcut.mp4",duration:28}}:{success:true,normalized};
    return new Response(JSON.stringify(payload),{status:200,headers:{"content-type":"application/json"}});
  };
  for(const item of cases){
    const response=await worker.fetch(new Request("https://aryanzz.example/api/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:item.url})}),{});
    assert.equal(response.status,200,item.id+" share URL must be accepted");
    const data=await response.json();
    assert.equal(data.platform,item.id);
    assert.equal(data.capabilities.linkAccepted,true);
    assert.equal(data.capabilities.preview,true);
    assert.equal(data.capabilities.mp4,true);
    assert.equal(data.formats[0].ext,"mp4");
    assert.match(data.formats[0].previewUrl,/preview=1/);
  }
  console.log("✔ TikTok, Instagram short links, SnackVideo short links and CapCut share links pass separate provider extraction checks");
}finally{globalThis.fetch=originalPlatformMatrixFetch;}
const originalExpandedPlatformFetch=globalThis.fetch;
try{
  const cases=[
    {id:"pinterest",url:"https://pin.it/TestPin123",key:"pinterest",mode:"video"},
    {id:"facebook",url:"https://fb.watch/TestFacebook123/",key:"facebook",mode:"video"},
    {id:"x",url:"https://x.com/demo/status/123456789",key:"twitter",mode:"video"},
    {id:"reddit",url:"https://v.redd.it/TestReddit123",key:"reddit",mode:"video"},
    {id:"vimeo",url:"https://vimeo.com/123456789",key:"vimeo",mode:"video"},
    {id:"threads",url:"https://www.threads.net/@demo/post/TestThreads123",key:"threads",mode:"video"},
    {id:"soundcloud",url:"https://soundcloud.com/demo/test-track",key:"soundcloud",mode:"audio"}
  ];
  globalThis.fetch=async(input)=>{
    const url=new URL(typeof input==="string"?input:input.url);
    assert.equal(url.hostname,"btch-downloader-api-green.vercel.app");
    const item=cases.find(entry=>url.pathname==="/api/download/"+entry.key);assert.ok(item,"provider route should match "+url.pathname);
    assert.equal(url.searchParams.get("url"),item.url);
    const media=item.mode==="audio"
      ?[{label:"Audio MP3",type:"audio",mimeType:"audio/mpeg",url:"https://cdn.example/"+item.id+".mp3"}]
      :[{label:"Video MP4 720p",type:"video",mimeType:"video/mp4",url:"https://cdn.example/"+item.id+".mp4",height:720}];
    return new Response(JSON.stringify({success:true,normalized:{kind:"media",title:"Verified "+item.id,thumbnail:"https://cdn.example/"+item.id+".jpg",duration:28,media}}),{status:200,headers:{"content-type":"application/json"}});
  };
  for(const item of cases){
    const response=await worker.fetch(new Request("https://aryanzz.example/api/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:item.url})}),{});
    assert.equal(response.status,200,item.id+" share URL must be accepted");
    const data=await response.json();
    assert.equal(data.platform,item.id==="x"?"twitter":item.id);
    assert.equal(data.capabilities.linkAccepted,true);
    assert.equal(data.capabilities.preview,true);
    assert.equal(data.capabilities.mp4,item.mode==="video");
    assert.equal(data.formats[0].mode,item.mode);
    assert.match(data.formats[0].previewUrl,/preview=1/);
  }
  console.log("✔ Pinterest, Facebook, X, Reddit, Vimeo, Threads and SoundCloud links pass provider routing and media-format checks");
}finally{globalThis.fetch=originalExpandedPlatformFetch;}
const originalAdditionalSearchFetch=globalThis.fetch;
try{
  const cases=[
    {id:"instagram",key:"instagram",url:"https://www.instagram.com/reel/TestInstagram123/",anchor:'<a href="https://www.instagram.com/reel/TestInstagram123/" class="result__a">Instagram Reels result</a>',mode:"video"},
    {id:"snackvideo",key:"snackvideo",url:"https://www.snackvideo.com/@demo/video/TestSnack123",anchor:'<a class="result__a" href="https://www.snackvideo.com/@demo/video/TestSnack123">SnackVideo result</a>',mode:"video"},
    {id:"capcut",key:"capcut",url:"https://www.capcut.com/t/TestCapCut123",anchor:'<a class="result__a" href="https://duckduckgo.com/l/?uddg='+encodeURIComponent("https://www.capcut.com/t/TestCapCut123")+'">CapCut shared video result</a>',mode:"video"},
    {id:"pinterest",key:"pinterest",url:"https://www.pinterest.com/pin/TestPin123/",anchor:'<a class="result__a" href="https://www.pinterest.com/pin/TestPin123/">Pinterest video pin result</a>',mode:"video"},
    {id:"facebook",key:"facebook",url:"https://www.facebook.com/watch/?v=123456789",anchor:'<a class="result__a" href="https://www.facebook.com/watch/?v=123456789">Facebook video result</a>',mode:"video"},
    {id:"x",key:"twitter",url:"https://x.com/demo/status/123456789",anchor:'<a class="result__a" href="https://x.com/demo/status/123456789">X video post result</a>',mode:"video"},
    {id:"reddit",key:"reddit",url:"https://www.reddit.com/r/videos/comments/TestReddit123/demo/",anchor:'<a class="result__a" href="https://www.reddit.com/r/videos/comments/TestReddit123/demo/">Reddit video result</a>',mode:"video"},
    {id:"vimeo",key:"vimeo",url:"https://vimeo.com/123456789",anchor:'<a class="result__a" href="https://vimeo.com/123456789">Vimeo video result</a>',mode:"video"},
    {id:"threads",key:"threads",url:"https://www.threads.net/@demo/post/TestThreads123",anchor:'<a class="result__a" href="https://www.threads.net/@demo/post/TestThreads123">Threads video result</a>',mode:"video"},
    {id:"soundcloud",key:"soundcloud",url:"https://soundcloud.com/demo/test-track",anchor:'<a class="result__a" href="https://soundcloud.com/demo/test-track">SoundCloud audio track result</a>',mode:"audio"}
  ];
  const videoBytes=Uint8Array.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,2,0,105,115,111,109,105,115,111,50]);
  const audioBytes=Uint8Array.from([73,68,51,4,0,0,0,0,0,10,84,73,84,50,0,0,0,4,0,0,84,101,115,116]);
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    if(url.hostname==="html.duckduckgo.com")return new Response(cases.map(item=>item.anchor).join(""),{status:200,headers:{"content-type":"text/html"}});
    if(url.hostname==="btch-downloader-api-green.vercel.app"){
      const item=cases.find(entry=>url.pathname==="/api/download/"+entry.key);assert.ok(item,"search provider route "+url.pathname);
      assert.equal(url.searchParams.get("url"),item.url);
      const media=item.mode==="audio"
        ?[{label:"Audio MP3",type:"audio",mimeType:"audio/mpeg",url:"https://cdn.example/"+item.id+".mp3"}]
        :[{label:"Video MP4",type:"video",mimeType:"video/mp4",url:"https://cdn.example/"+item.id+"-search.mp4",height:720}];
      return new Response(JSON.stringify({success:true,normalized:{kind:"media",title:"Verified "+item.id+" result",duration:28,media}}),{status:200,headers:{"content-type":"application/json"}});
    }
    assert.equal(url.hostname,"cdn.example");
    const range=new Headers(init.headers).get("range");assert.equal(range,"bytes=0-65535");
    const item=cases.find(entry=>url.pathname==="/"+entry.id+(entry.mode==="audio"?".mp3":"-search.mp4"));assert.ok(item,"media probe route "+url.pathname);
    const bytes=item.mode==="audio"?audioBytes:videoBytes,mime=item.mode==="audio"?"audio/mpeg":"video/mp4";
    return new Response(bytes,{status:206,headers:{"content-type":mime,"content-length":String(bytes.length),"content-range":"bytes 0-"+(bytes.length-1)+"/"+bytes.length,"accept-ranges":"bytes"}});
  };
  for(const [index,item] of cases.entries()){
    const response=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{method:"POST",headers:{"content-type":"application/json","cf-connecting-ip":"192.0.2."+String(index+1)},body:JSON.stringify({platform:item.id,query:"Tabola Bale"})}),{});
    assert.equal(response.status,200,item.id+" title search should complete");
    const data=await response.json();
    assert.equal(data.results.length,1,item.id+" search should show a provider-verified playable result");
    assert.equal(data.results[0].verified,true);
    assert.equal(data.results[0].duration,28);
    assert.equal(data.results[0].mediaMode,item.mode);
    assert.equal(data.unavailableCount,0);
  }
  console.log("✔ All 10 non-YouTube platform title searches verify video results; SoundCloud verifies playable audio");
}finally{globalThis.fetch=originalAdditionalSearchFetch;}
const originalSocialSearch=globalThis.fetch;
try{
  const searchMp4Bytes=Uint8Array.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,2,0,105,115,111,109,105,115,111,50]);
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    if(url.hostname==="cdn.example"){
      assert.equal(url.pathname,"/video-1080.mp4");
      assert.equal(new Headers(init.headers).get("range"),"bytes=0-65535");
      return new Response(searchMp4Bytes,{status:206,headers:{"content-type":"video/mp4","content-length":String(searchMp4Bytes.length),"content-range":"bytes 0-23/24","accept-ranges":"bytes"}});
    }
    if(url.hostname==="html.duckduckgo.com"){
      assert.match(url.searchParams.get("q"),/site:tiktok\.com/);
      return new Response(
        '<a class="result__a" href="https://www.tiktok.com/@demo/video/1234567890">DJ Tabola Bale - TikTok</a><div class="result__snippet">Public video result</div>'+
        '<a class="result__a" href="https://www.tiktok.com/@dead/video/9999999999">Dead TikTok result</a><div class="result__snippet">Unavailable video</div>',
        {status:200,headers:{"content-type":"text/html"}}
      );
    }
    assert.equal(url.hostname,"btch-downloader-api-green.vercel.app");
    assert.equal(url.pathname,"/api/download/tiktok");
    const target=url.searchParams.get("url");
    if(target==="https://www.tiktok.com/@dead/video/9999999999")
      return new Response(JSON.stringify({success:false,error:"Video not found"}),{status:404,headers:{"content-type":"application/json"}});
    assert.equal(target,"https://www.tiktok.com/@demo/video/1234567890");
    return new Response(JSON.stringify({success:true,normalized:{kind:"media",title:"Verified DJ Tabola Bale",thumbnail:"https://cdn.example/thumb.jpg",duration:28,media:[
      {label:"Video MP4",type:"video",url:"https://cdn.example/video-1080.mp4",height:1080}
    ]}}),{status:200,headers:{"content-type":"application/json"}});
  };
  const socialSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({platform:"tiktok",query:"DJ tabola bale"})
  }),{});
  assert.equal(socialSearch.status,200);
  const socialSearchData=await socialSearch.json();
  assert.equal(socialSearchData.results.length,1,"unreachable social links must be filtered before display");
  assert.match(socialSearchData.results[0].title,/Verified DJ Tabola Bale/);
  assert.equal(socialSearchData.results[0].duration,28);
  assert.equal(socialSearchData.results[0].verified,true);
  assert.equal(socialSearchData.unavailableCount,1);
  console.log("✔ Social title search shows only provider-verified videos and skips dead links");
}finally{globalThis.fetch=originalSocialSearch;}
const originalYoutubeSearch=globalThis.fetch;
try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url);
    assert.equal(url.hostname,"btch-downloader-api-green.vercel.app");
    assert.equal(url.pathname,"/api/download/youtube-search");
    assert.equal(url.searchParams.get("query"),"DJ tabola bale");
    return new Response(JSON.stringify({success:true,normalized:{kind:"list",items:[
      {title:"DJ Tabola Bale",url:"https://www.youtube.com/watch?v=ABC12345678",thumbnail:"https://cdn.example/yt.jpg",duration:180,author:"DJ Channel"}
    ]}}),{status:200,headers:{"content-type":"application/json"}});
  };
  const youtubeSearch=await worker.fetch(new Request("https://aryanzz.example/api/search",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:"DJ tabola bale"})
  }),{});
  assert.equal(youtubeSearch.status,200);
  const youtubeSearchData=await youtubeSearch.json();
  assert.equal(youtubeSearchData.results.length,1);
  assert.equal(youtubeSearchData.results[0].title,"DJ Tabola Bale");
  console.log("✔ YouTube title search falls back to the zero-cost public provider");
}finally{globalThis.fetch=originalYoutubeSearch;}

const originalRangeFetch=globalThis.fetch;
try{
  globalThis.fetch=async(input,init={})=>{
    const target=new URL(typeof input==="string"?input:input.url);
    assert.equal(target.hostname,"cdn.example");
    assert.equal(init.method,"GET");
    assert.equal(new Headers(init.headers).get("range"),"bytes=100-199");
    return new Response(new Uint8Array(100).fill(7),{status:206,headers:{
      "content-type":"video/mp4","content-length":"100","content-range":"bytes 100-199/1000","accept-ranges":"bytes","etag":"\"range-test\""
    }});
  };
  const rangeResponse=await worker.fetch(new Request("https://aryanzz.example/api/direct-file?url="+encodeURIComponent("https://cdn.example/video.mp4"),{headers:{range:"bytes=100-199"}}),{});
  assert.equal(rangeResponse.status,206);
  assert.equal(rangeResponse.headers.get("content-range"),"bytes 100-199/1000");
  assert.equal(rangeResponse.headers.get("accept-ranges"),"bytes");
  assert.equal(rangeResponse.headers.get("etag"),"\"range-test\"");
  assert.match(rangeResponse.headers.get("content-disposition"),/video\.mp4/);
  assert.equal((await rangeResponse.arrayBuffer()).byteLength,100);
  console.log("✔ V73.7 direct-media Worker preserves HTTP Range for Chrome resume");
}finally{globalThis.fetch=originalRangeFetch;}

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
console.log("✔ Legacy paid downloader/progress endpoints are removed in V73.7");

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
  assert.equal(healthData.platformBackend,"public-free-community-api");
  assert.equal(healthData.platformExtraction,true);
  console.log("✔ V73.7 health confirms free public extraction without a self-hosted server");
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
    if(url.hostname==="i.ytimg.com"&&url.pathname==="/vi/4dpnHLPMQGs/hqdefault.jpg"){
      return new Response(new Uint8Array([255,216,255]),{status:200,headers:{"content-type":"image/jpeg","content-length":"3"}});
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
  const dynamicProxy=new URL(dynamicData.instance).hostname.endsWith("kavin.rocks")?"https://pipedproxy-bom.kavin.rocks":"https://pipedproxy.example.org";
  const dynamicFileUrl="https://aryanzz.example/api/youtube/hybrid/file?url="+encodeURIComponent(dynamicProxy+"/videoplayback?itag=18&sig=test")+"&ext=mp4&title=Dynamic%20Piped&instance="+encodeURIComponent(dynamicData.instance);
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
  const invidiousProbeData=await invidiousProxyProbe.json();
  assert.equal(invidiousProbeData.ok,true);
  assert.equal(invidiousProbeData.totalBytes,4);
  assert.equal(invidiousProbeData.contentRange,"bytes 0-0/4");
  console.log("✔ MP4 preflight returns the real total byte count for resumable range downloads");
  const invidiousProxyFile=await worker.fetch(new Request(invidiousProxyFileUrl),{});
  assert.equal(invidiousProxyFile.status,200);
  assert.match(invidiousProxyFile.headers.get("content-disposition"),/Invidious%20Proxy%20Test\.mp4/);
  assert.equal((await invidiousProxyFile.arrayBuffer()).byteLength,4);
  console.log("✔ Invidious local proxy stream passes one-byte preflight and streams directly as an attachment");
  const thumbnailUrl="https://aryanzz.example/api/youtube/hybrid/thumbnail?url="+encodeURIComponent("https://i.ytimg.com/vi/4dpnHLPMQGs/hqdefault.jpg")+"&title="+encodeURIComponent("Test YouTube Thumbnail");
  const thumbnailResponse=await worker.fetch(new Request(thumbnailUrl),{});
  assert.equal(thumbnailResponse.status,200);
  assert.equal(thumbnailResponse.headers.get("content-type"),"image/jpeg");
  assert.match(thumbnailResponse.headers.get("content-disposition"),/Test%20YouTube%20Thumbnail\.jpg/);
  assert.equal((await thumbnailResponse.arrayBuffer()).byteLength,3);
  const blockedThumbnail=await worker.fetch(new Request("https://aryanzz.example/api/youtube/hybrid/thumbnail?url="+encodeURIComponent("https://evil.example/thumb.jpg")),{}); 
  assert.equal(blockedThumbnail.status,400);
  console.log("✔ Thumbnail proxy streams allowed YouTube images as attachments and blocks untrusted hosts");
  const browserValidationUrl="https://aryanzz.example/api/youtube/hybrid/validate?url="+encodeURIComponent("https://inv.nadeko.net/videoplayback?itag=18")+"&ext=mp4&title=Browser%20Stream&instance="+encodeURIComponent("https://inv.nadeko.net");
  const browserValidation=await worker.fetch(new Request(browserValidationUrl),{});
  assert.equal(browserValidation.status,200);
  const browserValidationData=await browserValidation.json();
  assert.equal(browserValidationData.ok,true);
  assert.equal(browserValidationData.ext,"mp4");
  assert.equal(browserValidationData.instance,"https://inv.nadeko.net");
  const unsafeBrowserValidation=await worker.fetch(new Request(browserValidationUrl.replace(encodeURIComponent("https://inv.nadeko.net/videoplayback?itag=18"),encodeURIComponent("https://evil.example/video.mp4"))),{});
  assert.equal(unsafeBrowserValidation.status,400);
  console.log("✔ V73.7 browser download validation permits trusted streams and blocks untrusted hosts");
  const retryFetch=globalThis.fetch;
  try{
    let retryCalls=0;
    globalThis.fetch=async(input,init={})=>{
      const url=new URL(typeof input==="string"?input:input.url);
      assert.equal(url.hostname,"rr1---sn.googlevideo.com");
      retryCalls++;
      if(retryCalls===1)return new Response("forbidden",{status:403});
      assert.equal(init.headers?.referer,"https://inv.nadeko.net/");
      assert.equal(init.headers?.origin,"https://inv.nadeko.net");
      assert.equal(init.headers?.range,"bytes=0-0");
      return new Response(new Uint8Array([1]),{status:206,headers:{"content-type":"video/mp4","content-length":"1","content-range":"bytes 0-0/4","accept-ranges":"bytes"}});
    };
    const retryUrl="https://aryanzz.example/api/youtube/hybrid/file?url="+encodeURIComponent("https://rr1---sn.googlevideo.com/videoplayback?itag=18")+"&ext=mp4&instance="+encodeURIComponent("https://inv.nadeko.net")+"&probe=1";
    const retried=await worker.fetch(new Request(retryUrl),{});
    assert.equal(retried.status,200);
    assert.equal((await retried.json()).ok,true);
    assert.equal(retryCalls,2);
    console.log("✔ V73.7 retries a temporary GoogleVideo 403 with the provider-instance request profile");
  }finally{globalThis.fetch=retryFetch;}
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
  assert.equal(healthData.version,"80.0");
  assert.equal(healthData.cobalt,false);
  assert.equal(healthData.paidYoutubeProvider,false);
  console.log("✔ Worker health reports V73.7 with no Cobalt or paid YouTube provider");

}finally{
  globalThis.fetch=originalFetch;
}

console.log("\nARYANZZ V73.7 mobile-resumable YouTube flow, thumbnail proxy, speed modes, TikTok community handoff, zero-server downloader, Gradient Studio, file hashing and music recognition smoke tests passed.");
