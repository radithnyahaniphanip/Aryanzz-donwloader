import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../public/index.html");
const worker = read("../src/index.js");
const sw = read("../public/sw.js");
const searchJs = read("../public/v674.js");
const unifiedCss = read("../public/v89.css");
const converterJs = read("../public/audio-studio.js");
const mediaStudioJs = read("../public/media-studio.js");
const mediaStudioCss = read("../public/media-studio.css");
const queueJs = read("../public/download-queue.js");
const queueCss = read("../public/download-queue.css");
const titleSearchStart = html.indexOf('<select id="titleSearchType"');
const titleSearchEnd = html.indexOf("</select>", titleSearchStart);
const titleSearchMarkup = titleSearchStart >= 0 && titleSearchEnd >= 0 ? html.slice(titleSearchStart, titleSearchEnd) : "";
const bootstrap = read("../public/ffmpeg-worker-bootstrap.js");
const htmlAssetRefs = [...html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map(match => match[1]).filter(ref => ref.startsWith("/"));
const downloaderJs = read("../public/downloader.js");
const profileJs = read("../public/v25.js");
const ownerJs = read("../public/owner.js");

const checks = [
  ["ALL platform option is removed", !html.includes('data-platform="all"') && !searchJs.includes('all:{name:"Semua platform"')],
  ["Audio search option is removed", !titleSearchMarkup.includes('<option value="audio">')],
  ["Video and image search remain available", html.includes('<option value="video">Video</option>') && html.includes('<option value="image">Gambar</option>')],
  ["MP4 to MP3 converter remains in tools", html.includes("MP4 ke MP3 Converter") && html.includes('id="audioStudio"')],
  ["Converter disclaimer block is removed", !html.includes('class="audio-studio-disclaimer"')],
  ["Converter has bounded initialization and fetch timeouts", converterJs.includes("LOAD_TIMEOUT_MS") && converterJs.includes("FETCH_TIMEOUT_MS")],
  ["FFmpeg worker waits for module registration", bootstrap.includes("await import(") && bootstrap.includes("self.onmessage")],
  ["V92.1 converter uses the shared FFmpeg class worker with a versioned same-origin bootstrap", converterJs.includes('ffmpeg-worker-bootstrap.js?v=92.1') && html.includes('/audio-studio.js?v=92.1')],
  ["V92.1 converter retries jsDelivr and unpkg core assets independently", converterJs.includes('for(let index=0;index<CORE_BASES.length;index++)') && converterJs.includes('coreURL:base+"/ffmpeg-core.js"') && converterJs.includes('wasmURL:base+"/ffmpeg-core.wasm"')],
  ["V92.1 converter reports stalled CDN transfers and resets timeout after each chunk", converterJs.includes('const armIdleTimeout=()=>') && converterJs.includes('armIdleTimeout();') && converterJs.includes('Koneksi CDN tidak mengirim data selama 45 detik')],
  ["V92.3 platform-link YouTube MP4 mux uses the refreshed FFmpeg bootstrap", downloaderJs.includes('ffmpeg-worker-bootstrap.js?v=92.2')],
  ["V92.3 platform-link FFmpeg loader retries both module CDNs", downloaderJs.includes('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js') && downloaderJs.includes('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js')],
  ["V92.3 platform-link FFmpeg loader retries both core CDNs with a fresh instance", downloaderJs.includes('for(let index=0;index<coreBases.length;index++)') && downloaderJs.includes('coreURL,wasmURL,classWorkerURL:workerUrl') && downloaderJs.includes('ffmpeg?.terminate()')],
  ["V92.3 platform-link FFmpeg component timeout resets while chunks arrive", downloaderJs.includes("const resetIdle=()=>") && downloaderJs.includes("resetIdle();") && downloaderJs.includes("controller.abort(),45000")],
  ["V92.3 downloader asset and PWA cache are refreshed", html.includes('/downloader.js?v=92.2') && sw.includes('/downloader.js?v=92.2') && sw.includes('/ffmpeg-worker-bootstrap.js?v=92.2') && sw.includes('aryanzz-v92-5')],
  ["Profile Studio and Owner page share the same V25 profile and design stores", ownerJs.includes('aryanzz.profile.info.v25') && ownerJs.includes('aryanzz.profile.design.v25') && profileJs.includes('const PROFILE_KEY="aryanzz.profile.info.v25"')],
  ["Owner profile displays the Profile Studio avatar and banner assets", ownerJs.includes('validImage(design.avatar)') && ownerJs.includes('validImage(design.banner)') && ownerJs.includes('$("ownerAvatar")')],
  ["Owner profile updates once when profile assets change", (ownerJs.match(/aryanzz:profile-assets-updated/g)||[]).length===1],
  ["Profile membership date parser accepts local YYYY-MM-DD values", profileJs.includes('const parts=/^\\d{4}-\\d{2}-\\d{2}$/.test(since)') && !profileJs.includes('const parts=/^\\\\d{4}')],
  ["Profile Studio protects startup from blocked localStorage access", profileJs.includes('const safeGet=') && profileJs.includes('const safeSet=') && profileJs.includes('setSurface(safeGet(SURFACE_KEY,"aurora"))')],

  ["Worker bootstrap reports import errors with the original message ID", bootstrap.includes("id: data?.id") && bootstrap.includes("type: \"ERROR\"")],
  ["MP4 duration fallback parser is present", converterJs.includes("parseMp4Duration") && converterJs.includes("recoverDuration")],
  ["Preview has unsupported-codec guidance", html.includes("audioStudioPreviewNote") && converterJs.includes("Codec video tidak didukung")],
  ["Preview can transcode unsupported video to H.264", html.includes("audioStudioPreviewConvert") && converterJs.includes("makeCompatiblePreview") && converterJs.includes("libx264")],
  ["Converter uses a same-origin local FFmpeg worker", converterJs.includes("ffmpeg-worker-bootstrap.js?v=92.1")],
  ["Local worker loads primary and fallback single-thread cores", converterJs.includes("for(let index=0;index<CORE_BASES.length;index++)") && converterJs.includes("instance.terminate()") && converterJs.includes("coreURL:base+\"/ffmpeg-core.js\"")],
  ["Worker CSP permits blob fetch for local WASM resources", worker.includes("connect-src") && worker.includes("wss: blob:;")],
  ["Homepage release label is V92.3", html.includes("V92.3 · GRATIS")],
  ["Worker health reports V92.3", worker.includes('version:"92.3"')],
  ["Homepage loads the shared V89 shell stylesheet", html.includes("/v89.css?v=90.0")],
  ["Every homepage JS and CSS asset is included in the active PWA shell cache", htmlAssetRefs.length>0 && htmlAssetRefs.every(ref=>sw.includes('"'+ref+'"'))],
  ["PWA cache namespace is V92.3", sw.includes('const CACHE="aryanzz-v92-5"')],
  ["PWA cache includes homepage, converter and Media Studio", sw.includes("/?v=92.3") && sw.includes("/audio-studio.js?v=92.1") && sw.includes("/audio-studio.css?v=92.0") && sw.includes("/media-studio.js?v=92.0") && sw.includes("/media-studio.css?v=92.0")],

  ["Converter Pro includes optional audio trim controls", html.includes('id="audioStudioStart"') && html.includes('id="audioStudioEnd"') && converterJs.includes('ffmpegArgs.push("-t"')],
  ["Converter Pro supports MP3 WAV AAC and FLAC output", ["mp3","wav","aac","flac"].every(format => html.includes('value="'+format+'"')) && converterJs.includes("libmp3lame") && converterJs.includes("pcm_s16le") && converterJs.includes('format==="aac"') && converterJs.includes('format==="flac"')],
  ["Converter Pro supports local volume adjustment", html.includes('id="audioStudioVolume"') && converterJs.includes('"-af","volume="')],
  ["Media Studio is integrated into the existing tools grid", html.includes('data-panel="mediaStudio"') && html.includes('id="mediaStudio"')],
  ["Media library persists media blobs with IndexedDB", mediaStudioJs.includes("indexedDB.open(DB_NAME") && mediaStudioJs.includes("store.put(item)")],
  ["Media library supports search, filters, favorites and deletion", mediaStudioJs.includes("msSearch") && mediaStudioJs.includes("msFilter") && mediaStudioJs.includes("toggleFavorite") && mediaStudioJs.includes("deleteItem")],
  ["Video Player Pro includes playback speed, PiP, fullscreen and frame capture", mediaStudioJs.includes("playbackRate") && mediaStudioJs.includes("requestPictureInPicture") && mediaStudioJs.includes("requestFullscreen") && mediaStudioJs.includes("drawImage(video")],
  ["Download Manager links to the existing Smart Queue", html.includes('id="queue"') && mediaStudioJs.includes('data-panel="queue"')],
  ["Smart Queue UI is integrated into the shared tools panel", html.includes('id="queue"') && html.includes('id="queueUrls"') && html.includes('id="queueCounts"')],
  ["Smart Queue validates and deduplicates URL entries", queueJs.includes("new URL(raw)") && queueJs.includes("duplicates++") && queueJs.includes("MAX_ITEMS=100")],
  ["Smart Queue persists queue items locally", queueJs.includes("localStorage.setItem(KEY") && queueJs.includes("localStorage.getItem(KEY")],
  ["Smart Queue hands active links to the existing downloader", queueJs.includes('$("url")') && queueJs.includes('$("analyze")') && queueJs.includes("analyze.click()")],
  ["Smart Queue supports completion, failure, skip, retry and pause", queueJs.includes('mark(item.id,"done")') && queueJs.includes('mark(item.id,"failed")') && queueJs.includes('mark(item.id,"skipped")') && queueJs.includes("queuePause")],
  ["Smart Queue receives actual downloader completion and failure events", queueJs.includes("aryanzz:download-complete") && queueJs.includes("aryanzz:download-failed") && html.includes("aryanzz:download-complete") && html.includes("aryanzz:download-failed")],
  ["Smart Queue automatically advances after a confirmed local download", queueJs.includes("function advanceQueue") && queueJs.includes("if(running&&next){") && queueJs.includes("findActive(detail)")],
  ["External provider links are not falsely reported as completed", html.includes("aryanzz:download-link-opened") && queueJs.includes("externalStarted=true") && queueJs.includes("konfirmasi setelah file benar-benar tersimpan")],
  ["Converter applies adaptive Android memory limits", converterJs.includes("navigator.deviceMemory") && converterJs.includes("MOBILE_DEVICE") && converterJs.includes("MAX_FILE_BYTES = MOBILE_DEVICE")],
  ["Converter dynamically displays device-specific file size limits", converterJs.includes("formatSize(MAX_FILE_BYTES)") && converterJs.includes("fileLimitLabel")],
  ["Converter releases the temporary input byte buffer after WASM write", converterJs.includes("bytes.fill(0)")],
  ["Converter output download label follows the selected format", converterJs.includes('filename.split(".").pop().toUpperCase()')],
  ["Converter Pro has an on-device encoder diagnostic control", html.includes('id="audioStudioTestEngine"') && html.includes('id="audioStudioDiagnosticsResult"')],
  ["Converter Pro detects real FFmpeg encoder support before conversion", converterJs.includes("async function detectEncoders") && converterJs.includes('engine.exec(["-hide_banner","-encoders"]') && converterJs.includes("requiredEncoder")],
  ["Converter diagnostics reports MP3 WAV AAC and FLAC availability", ["libmp3lame","pcm_s16le","aac","flac"].every(encoder => converterJs.includes(encoder))],
  ["Converter diagnostics is styled for small screens", read("../public/audio-studio.css").includes(".audio-diagnostics-result") && read("../public/audio-studio.css").includes("@media(max-width:420px)")],
  ["Smart Queue mobile stylesheet is wired and cached", html.includes("/download-queue.css?v=92.0") && queueCss.includes("@media(max-width:420px)") && sw.includes("/download-queue.css?v=92.0")],
  ["Smart Queue script is wired and cached", html.includes("/download-queue.js?v=92.0") && sw.includes("/download-queue.js?v=92.0")],
  ["Storage and performance dashboard uses Storage API", mediaStudioJs.includes("navigator.storage?.estimate") && mediaStudioJs.includes("navigator.storage?.persist")],
  ["Media Studio responsive stylesheet is wired", html.includes("/media-studio.css?v=92.0") && mediaStudioCss.includes("@media(max-width:480px)")],
  ["PWA cache includes current search bundle", sw.includes("/v674.js?v=89.2")],
  ["Worker CSP permits FFmpeg WebAssembly and blob core loading", worker.includes("wasm-unsafe-eval") && worker.includes("https: blob:")],
  ["Homepage loads the current converter runtime", html.includes("/audio-studio.js?v=92.1")],
  ["Unified navigation hides home when another view opens", html.includes('id="appViewHeader"') && html.includes("home.hidden=!!id") && html.includes("p.id===id")],
  ["Unified responsive app shell is loaded", html.includes("/v89.css?v=90.0") && unifiedCss.includes("V89.0 — ONE UNIFIED ECOSYSTEM")],
  ["Shared header and persistent welcome remain", html.includes('class="top v674-top"') && html.includes('id="v89Welcome"')],
  ["Tool panels share one responsive shell", unifiedCss.includes("#toolsArea>.panel{display:none;width:100%") && unifiedCss.includes("#toolsArea>.panel.active{display:block!important")],
  ["Mobile navigation stays fixed inside viewport", unifiedCss.includes(".nav{position:fixed!important")],
  ["Security status endpoint remains available", worker.includes('url.pathname==="/api/security/status"')],
  ["Security middleware wraps Worker requests", worker.includes("export default {fetch:securityFetch};")],
  ["Security Center remains in homepage", html.includes('id="securityCenter"') && searchJs.includes("initSecurityCenter")]
];

for (const [name, ok] of checks) {
  assert.ok(ok, name + " failed");
  console.log("✔ " + name);
}
console.log("\nARYANZZ V92.3 platform downloader release smoke tests passed.");
