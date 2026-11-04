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
const advancedJs = read("../public/advanced.js");
const v15Js = read("../public/v15.js");
const profileJs = read("../public/v25.js");
const linkBypassJs = read("../public/link-bypass.js");
const linkBypassCss = read("../public/link-bypass.css");
const titleSearchStart = html.indexOf('<select id="titleSearchType"');
const titleSearchEnd = html.indexOf("</select>", titleSearchStart);
const titleSearchMarkup = titleSearchStart >= 0 && titleSearchEnd >= 0 ? html.slice(titleSearchStart, titleSearchEnd) : "";
const bootstrap = read("../public/ffmpeg-worker-bootstrap.js");
const htmlAssetRefs = [...html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map(match => match[1]).filter(ref => ref.startsWith("/"));
const downloaderJs = read("../public/downloader.js");
const ownerJs = read("../public/owner.js");

const idCounts = new Map();
for (const match of html.matchAll(/\bid=["']([^"']+)["']/g)) idCounts.set(match[1], (idCounts.get(match[1]) || 0) + 1);
const duplicateIds = [...idCounts].filter(([, count]) => count > 1).map(([id]) => id);

const learningCenter = read("../public/learning-center.js");
const learningCss = read("../public/learning-center.css");
const checks = [
  ["Speed test controller and same-origin Worker endpoints are present", read("../public/speed-test.js").includes('"/api/speedtest/download?bytes="') && read("../src/index.js").includes('url.pathname==="/api/speedtest/download"') && read("../src/index.js").includes('url.pathname==="/api/speedtest/upload"')],
  ["Adaptive network profiles cover five levels and auto mode", read("../public/index.html").includes('id="networkProfile"') && read("../public/downloader.js").includes("window.ARYANZZ_NETWORK_PROFILE") && ["Terendah","Rendah","Normal","Tinggi","Tertinggi"].every(x => read("../public/downloader.js").includes(x))],
  ["Incomplete video transfers offer browser-managed download fallback", read("../public/downloader.js").includes("unduhan langsung tersedia") && read("../public/downloader.js").includes("Lanjutkan unduhan video lewat Chrome")],

  ["Automatic release version generator is wired to the Cloudflare build step", read("../package.json").includes('"build:version": "node scripts/build-version.mjs"') && read("../scripts/build-version.mjs").includes('git", ["rev-list", "--count", "HEAD"]') && read("../src/index.js").includes("version:BUILD_VERSION")],
  ["Version placeholders cover app UI, PWA manifest and service-worker cache", read("../public/index.html").includes("__ARYANZZ_VERSION__") && read("../public/manifest.webmanifest").includes("__ARYANZZ_VERSION__") && read("../public/sw.js").includes("__ARYANZZ_VERSION__")],
  ["V94 tutorial player is mounted inside each supported tool panel and hub navigation scrolls to the guide", learningCenter.includes('el.className="lc-guide lc-cinema"') && learningCenter.includes('root.prepend(el)') && learningCenter.includes('$(id)?.scrollIntoView') && learningCenter.includes('data-open=')],
  ["V94.3 inline tutorial launcher has responsive accessible styling", learningCss.includes(".lc-inline-launch") && learningCss.includes("@media(max-width:480px)")],
  ["V94 tutorials cover requested tools and members/visitors", ["linkBypass","mediaStudio","queue","editor","musicFinder","audioStudio","imageTools","pdfTools","qrTools","securityTools","gradientStudio","fileHash","colorStudio","speed","checker","members","heart","install","history"].every(id => learningCenter.includes(id+":"))],
  ["Tutorials support vertical/horizontal preview, measured duration, and non-Google local narration", learningCenter.includes('data-r="9:16"') && learningCenter.includes('data-r="16:9"') && learningCenter.includes("SpeechSynthesisUtterance") && learningCenter.includes("localService===true") && learningCenter.includes("actualSceneDurations") && !learningCenter.includes("musicStart()")],
  ["V93 Link Bypass panel, form, controller, and Worker resolver are wired",html.includes('id="linkBypass"')&&html.includes('id="sflBypassForm"')&&html.includes('/link-bypass.js?v=94.0')&&worker.includes('url.pathname==="/api/link-bypass"')&&linkBypassJs.includes('Periksa tujuan')],
  ["V93 Link Bypass panel stylesheet is wired",html.includes('/link-bypass.css?v=94.0')&&linkBypassCss.includes(".v93-bypass-hero")&&linkBypassCss.includes("@media(max-width:680px)")],
  ["V93.0 restores original home layout while keeping Link Bypass mobile responsive",!html.includes('class="v93-popular-grid"')&&linkBypassCss.includes("@media(max-width:680px)")&&linkBypassCss.includes(".v93-bypass-panel")],
  ["V93.0 restores original Profile Studio layout",!profileJs.includes("consolidateProfileSettings")&&!html.includes('class="v93-profile-links"')],
  ["V94 owner social links can be cleared or replaced without restoring defaults", read("../public/owner.js").includes("hasOwnProperty.call(stored,key) ? validLink(stored[key]) : DEFAULTS[key]")],
  ["V94 profile and owner assets use refreshed cache versions", html.includes("owner.js?v=94.0") && html.includes("v25.js?v=94.0") && read("../public/sw.js").includes("owner.js?v=94.0")],
  ["V94 local account system uses Web Crypto PBKDF2 and local-only storage", read("../public/auth-gate.js").includes("aryanzz.local.accounts.v94") && read("../public/auth-gate.js").includes("PBKDF2") && read("../public/auth-gate.js").includes("localStorage.setItem") && !read("../public/auth-gate.js").includes("/api/auth/")],
  ["V94 local account gate stores users and sessions locally without remote database calls", read("../public/auth-gate.js").includes("const readUsers=") && read("../public/auth-gate.js").includes("function getSession()") && read("../public/auth-gate.js").includes("localStorage") && !read("../public/auth-gate.js").includes("fetch(")],
  ["V94 registration UI includes requested fields and password visibility", html.includes('id="aryRegName"') && html.includes('id="aryRegEmail"') && html.includes('id="aryRegId"') && html.includes('id="aryRegRedeem"') && html.includes('id="aryRegEye"')],
  ["V94 auth assets are loaded and cached", html.includes("auth-gate.js?v=94.4") && html.includes("auth-gate.css?v=94.2") && read("../public/sw.js").includes("auth-gate.js?v=94.4")],
  ["V94 Color Studio replaces legacy palette with site-wide theme controls", html.includes('id="aryThemeAccent"') && html.includes('id="aryThemeApply"') && !html.includes("16.777.216 kombinasi warna") && !html.includes("Palet baru siap")],
  ["V94 removes legacy personalization and theme labels from the profile UI", !html.toLowerCase().includes("personalisasi") && !html.includes("MOTION & EXPERIENCE") && !html.includes("16.777.216 kombinasi warna")],
  ["V94 profile removes Personalization and Motion & Experience sections", !html.includes("PERSONALIZATION</span>") && !html.includes("MOTION & EXPERIENCE") && html.includes('id="profileRandomId"') && html.includes('id="profileName"')],
  ["V94 Developer Website title and editable social links are visible", html.includes("DEVELOPER WEBSITE") && html.includes('<details open>') && html.includes('id="ownerLinksSave"')],
  ["V94 theme studio assets are loaded and cached", html.includes("theme-studio.js?v=94.1") && html.includes("theme-studio.css?v=94.1") && read("../public/sw.js").includes("theme-studio.js?v=94.1")],
  ["Learning Center renders six teaching scenes covering definition, purpose, workflow, steps, and tips", learningCenter.includes('title:"Apa itu "+d.title+"?"') && learningCenter.includes('title:"Apa tujuan alat ini?"') && learningCenter.includes('title:"Bagaimana cara kerjanya?"') && learningCenter.includes("firstSteps.map") && learningCenter.includes("lastSteps.map") && learningCenter.includes("Hasil dan tips penting") && learningCenter.includes("sc.demoLines")],
  ["Learning Center adds searchable help hub and saved completion progress", read("../public/learning-center.js").includes("buildHub") && read("../public/learning-center.js").includes("aryanzz_learning_progress_v940") && read("../public/learning-center.css").includes(".lc-hub-grid")],
  ["V93.7 Learning Center assets are loaded", html.includes("/learning-center.js?v=94.8") && html.includes("/learning-center.css?v=94.8") && ["linkBypass","mediaStudio","queue","heart","install","members","editor","musicFinder","audioStudio","history","imageTools","pdfTools","qrTools","securityTools","gradientStudio","fileHash","colorStudio","speed","checker"].every(id => read("../public/learning-center.js").includes(id))],
  ["V93.0 keeps every workspace panel inside the shared tools container", html.indexOf('<section id="toolsArea">') < html.indexOf('id="speed"') && html.indexOf('id="help"') < html.indexOf('id="owner"') && !html.includes('← Kembali ke Home</button></div><div class="panel card editor-panel"')],

  ["V93.0 HTML contains no duplicate element IDs", duplicateIds.length === 0],
  ["Downloader analysis has one controller; legacy Tools does not attach a competing click handler", !advancedJs.includes("analyze.onclick") && !advancedJs.includes("function inspect(url)") && !advancedJs.includes("/api/info") && downloaderJs.includes('button.addEventListener("click"')],
  ["Smart Queue has one controller; legacy Tools does not bind queue actions", !advancedJs.includes("queueAdd") && !advancedJs.includes("queueRun") && !advancedJs.includes("queueClear") && queueJs.includes("queueAdd")],
  ["Library rendering and clear actions are owned by the current V15 library module", !advancedJs.includes("historyList") && !advancedJs.includes("favoriteList") && !advancedJs.includes("clearHistoryV2") && v15Js.includes("setupLibrary()")],
  ["Profile Studio is the single owner of profile photo, banner, background and bio handlers", !advancedJs.includes("profilePhoto") && !advancedJs.includes("profileBanner") && !advancedJs.includes("profileSave") && profileJs.includes('storeImage("profileBanner"') && profileJs.includes('storeImage("profilePhoto"') && profileJs.includes("setupProfilePreview()")],
  ["Profile backup actions are not duplicated by legacy Tools code", !advancedJs.includes("exportData") && !advancedJs.includes("importData") && profileJs.includes("setupBackupActions()")],
  ["ALL platform option is removed", !html.includes('data-platform="all"') && !searchJs.includes('all:{name:"Semua platform"')],
  ["Audio search option is removed", !titleSearchMarkup.includes('<option value="audio">')],
  ["Video and image search remain available", html.includes('<option value="video">Video</option>') && html.includes('<option value="image">Gambar</option>')],
  ["MP4 to MP3 converter remains in tools", html.includes("MP4 ke MP3 Converter") && html.includes('id="audioStudio"')],
  ["Converter disclaimer block is removed", !html.includes('class="audio-studio-disclaimer"')],
  ["Converter has bounded initialization and fetch timeouts", converterJs.includes("LOAD_TIMEOUT_MS") && converterJs.includes("FETCH_TIMEOUT_MS")],
  ["FFmpeg worker waits for module registration", bootstrap.includes("await import(") && bootstrap.includes("self.onmessage")],
  ["V93.0 converter uses the shared FFmpeg class worker with a versioned same-origin bootstrap", converterJs.includes('ffmpeg-worker-bootstrap.js?v=92.2') && html.includes('/audio-studio.js?v=92.5')],
  ["V93.0 converter retries jsDelivr and unpkg core assets independently", converterJs.includes('for(let index=0;index<CORE_BASES.length;index++)') && converterJs.includes('coreURL:base+"/ffmpeg-core.js"') && converterJs.includes('wasmURL:base+"/ffmpeg-core.wasm"')],
  ["V93.0 converter reports stalled CDN transfers and resets timeout after each chunk", converterJs.includes('const armIdleTimeout=()=>') && converterJs.includes('armIdleTimeout();') && converterJs.includes('Koneksi CDN tidak mengirim data selama 45 detik')],
  ["V92.4 platform-link YouTube MP4 mux uses the refreshed FFmpeg bootstrap", downloaderJs.includes('ffmpeg-worker-bootstrap.js?v=92.2')],
  ["V92.4 platform-link FFmpeg loader retries both module CDNs", downloaderJs.includes('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js') && downloaderJs.includes('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js')],
  ["V92.4 platform-link FFmpeg loader retries both core CDNs with a fresh instance", downloaderJs.includes('for(let index=0;index<coreBases.length;index++)') && downloaderJs.includes('coreURL,wasmURL,classWorkerURL:workerUrl') && downloaderJs.includes('ffmpeg?.terminate()')],
  ["V92.4 platform-link FFmpeg component timeout resets while chunks arrive", downloaderJs.includes("const resetIdle=()=>") && downloaderJs.includes("resetIdle();") && downloaderJs.includes("controller.abort(),45000")],
  ["Downloader asset and PWA cache are refreshed with build-scoped cache name", html.includes('/downloader.js?v=92.2') && sw.includes('/downloader.js?v=92.2') && sw.includes('/ffmpeg-worker-bootstrap.js?v=92.2') && sw.includes('aryanzz-build-__ARYANZZ_VERSION__')],
  ["Profile Studio and Owner page share the same V25 profile and design stores", ownerJs.includes('aryanzz.profile.info.v25') && ownerJs.includes('aryanzz.profile.design.v25') && profileJs.includes('const PROFILE_KEY="aryanzz.profile.info.v25"')],
  ["Owner profile displays the Profile Studio avatar and banner assets", ownerJs.includes('validImage(design.avatar)') && ownerJs.includes('validImage(design.banner)') && ownerJs.includes('$("ownerAvatar")')],
  ["Owner profile updates once when profile assets change", (ownerJs.match(/aryanzz:profile-assets-updated/g)||[]).length===1],
  ["Profile membership date parser accepts local YYYY-MM-DD values", profileJs.includes('const parts=/^\\d{4}-\\d{2}-\\d{2}$/.test(since)') && !profileJs.includes('const parts=/^\\\\d{4}')],
  ["Profile Studio protects startup from blocked localStorage access", profileJs.includes('const safeGet=') && profileJs.includes('const safeSet=') && profileJs.includes('setSurface(safeGet(SURFACE_KEY,"aurora"))')],

  ["Worker bootstrap reports import errors with the original message ID", bootstrap.includes("id: data?.id") && bootstrap.includes("type: \"ERROR\"")],
  ["MP4 duration fallback parser is present", converterJs.includes("parseMp4Duration") && converterJs.includes("recoverDuration")],
  ["Preview has unsupported-codec guidance", html.includes("audioStudioPreviewNote") && converterJs.includes("Codec video tidak didukung")],
  ["Preview can transcode unsupported video to H.264", html.includes("audioStudioPreviewConvert") && converterJs.includes("makeCompatiblePreview") && converterJs.includes("libx264")],
  ["Converter uses a same-origin local FFmpeg worker", converterJs.includes("ffmpeg-worker-bootstrap.js?v=92.2")],
  ["Local worker loads primary and fallback single-thread cores", converterJs.includes("for(let index=0;index<CORE_BASES.length;index++)") && converterJs.includes("instance.terminate()") && converterJs.includes("coreURL:base+\"/ffmpeg-core.js\"")],
  ["Worker CSP permits blob fetch for local WASM resources", worker.includes("connect-src") && worker.includes("wss: blob:;")],
  ["Homepage release label is generated from the build version placeholder", html.includes("__ARYANZZ_VERSION__")],
  ["Worker health reports the generated build version", worker.includes("version:BUILD_VERSION")],
  ["Homepage loads the shared V89 shell stylesheet", html.includes("/v89.css?v=93.2")],
  ["Every homepage JS and CSS asset is included in the active PWA shell cache", htmlAssetRefs.length>0 && htmlAssetRefs.every(ref=>sw.includes('"'+ref+'"'))],
  ["PWA cache namespace is build-scoped and refreshed on each deployment", sw.includes('const CACHE="aryanzz-build-__ARYANZZ_VERSION__"')],
  ["PWA cache includes homepage, converter and Media Studio", sw.includes("/?v=__ARYANZZ_VERSION__") && sw.includes("/audio-studio.js?v=92.5") && sw.includes("/audio-studio.css?v=92.0") && sw.includes("/media-studio.js?v=92.0") && sw.includes("/media-studio.css?v=92.0")],

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
  ["Homepage loads the current converter runtime", html.includes("/audio-studio.js?v=92.5")],
  ["Unified navigation hides home when another view opens", html.includes('id="appViewHeader"') && html.includes("home.hidden=!!id") && html.includes("p.id===id")],
  ["Unified responsive app shell is loaded", html.includes("/v89.css?v=93.2") && unifiedCss.includes("V89.0 — ONE UNIFIED ECOSYSTEM")],
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
console.log("\nARYANZZ V93.0 full workspace audit release smoke tests passed.");
