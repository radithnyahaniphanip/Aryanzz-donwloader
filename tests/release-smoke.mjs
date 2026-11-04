import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../public/index.html");
const worker = read("../src/index.js");
const platformCatalog = read("../src/platform-catalog.js");
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

const checks = [
  ["Speed test controller and same-origin Worker endpoints are present", read("../public/speed-test.js").includes('"/api/speedtest/download?bytes="') && read("../src/index.js").includes('url.pathname==="/api/speedtest/download"') && read("../src/index.js").includes('url.pathname==="/api/speedtest/upload"')],
  ["Adaptive network profiles cover automatic Wi-Fi/cellular mode and five manual levels", read("../public/index.html").includes('id="networkProfile"') && read("../public/downloader.js").includes("window.ARYANZZ_NETWORK_PROFILE") && ["Otomatis","Hemat","Stabil","Normal","Cepat","Maksimal"].every(x => read("../public/downloader.js").includes(x))],
  ["Incomplete video transfers offer Chrome-managed download fallback", downloaderJs.includes("addReadyDownloadLink(container,downloadUrl.href,filename") && downloaderJs.includes("Chrome siap mengunduh") && downloaderJs.includes("Lanjutkan lewat Chrome")],

  ["Automatic release version generator is wired to the Cloudflare build step", read("../package.json").includes('"build:version": "node scripts/build-version.mjs"') && read("../scripts/build-version.mjs").includes("GITHUB_RUN_NUMBER") && read("../scripts/build-version.mjs").includes("const version = major + \".\" + minor + \".\" + buildNumber") && read("../scripts/build-version.mjs").includes("serviceWorker\\.register") && read("../scripts/build-version.mjs").includes("same release query") && read("../src/index.js").includes("version:BUILD_VERSION")],
  ["Every deployment gets a three-part monotonic build version and refreshes all local JS/CSS caches", read("../scripts/build-version.mjs").includes("GITHUB_RUN_NUMBER") && read("../scripts/build-version.mjs").includes("serviceWorker\\.register") && read("../scripts/build-version.mjs").includes("same release query")],
  ["Release metadata is generated and versioned alongside the app", read("../scripts/build-version.mjs").includes("public/release.json") && read("../public/manifest.webmanifest").includes("\"version\": \"__ARYANZZ_VERSION__\"")],
  ["Live deployment verification checks the exact expected version and every JS/CSS asset cache key", read("../tests/live-release-smoke.mjs").includes("EXPECTED_BUILD_VERSION") && read("../tests/live-release-smoke.mjs").includes("assetUrl.searchParams.get(\"v\"),version") && read("../tests/live-release-smoke.mjs").includes("release?.version,version") && read("../tests/live-release-smoke.mjs").includes("manifest?.version,version")],
  ["Version placeholders cover app UI, PWA manifest and service-worker cache", read("../public/index.html").includes("__ARYANZZ_VERSION__") && read("../public/manifest.webmanifest").includes("__ARYANZZ_VERSION__") && read("../public/sw.js").includes("__ARYANZZ_VERSION__")],
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
  ["Title search exposes all-platform AI mode while link mode defaults to YouTube", html.includes('data-platform="all"') && html.includes("Semua 200") && read("../public/v674.js").includes('let selected="youtube"') && read("../public/v674.js").includes('const name=selected==="all"?"semua 200 platform"') && read("../public/v674.js").includes('if(link&&selected==="all")setPlatform("youtube")')],
  ["Title search supports voice input and 10/50/100/500 result pagination", html.includes('id="titleSearchMic"') && read("../public/v674.js").includes("SpeechRecognition") && read("../public/v674.js").includes("[10,50,100,500]") && read("../public/v674.js").includes("Berikutnya")],
  ["Smart Search renders platform-specific results in the shared result container without obsolete per-platform grouping", searchJs.includes("results.append(card);") && !searchJs.includes("mediaGroups")],
  ["Selecting all 200 platforms does not read a missing platform name", searchJs.includes('next==="all"?"Semua 200 Platform"') && searchJs.includes('selected==="all"?"semua 200 platform"')],
  ["Smart Search mobile controls use a compact responsive grid with separated help and results", read("../public/search-session-fix.css").includes("#titleModePanel .inputrow.v674-input-row{display:grid") && read("../public/search-session-fix.css").includes("#titleSearchHelp{margin:0;padding:10px 12px")],
  ["Smart Search video results render in one unified three-column grid without per-platform vertical groups", searchJs.includes("results.append(card);") && !searchJs.includes("mediaGroups") && read("../public/search-session-fix.css").includes("grid-template-columns:repeat(3,minmax(0,1fr))") && read("../public/search-session-fix.css").includes("#titleSearchResults .v674-search-result.v737-media-result{display:flex;flex-direction:column")],
  ["Initial platform state is YouTube and only YouTube is visually active", html.includes('data-platform="all" aria-pressed="false"') && html.includes('data-platform="youtube" aria-pressed="true"') && searchJs.includes('let selected="youtube",searchController=null')],
  ["Mobile social platform picker uses a readable four-column layout", read("../public/v674.css").includes("grid-template-columns:repeat(4,minmax(0,1fr))") && read("../public/v674.css").includes("@media(max-width:520px)")],
  ["Paste-link mode starts with one platform selected and hides All 200 until AI title search is opened", searchJs.includes("setMode(\"link\");") && searchJs.includes("if(allButton)allButton.hidden=link")],
  ["Universal platform extraction receives the selected platform, not the detected source as its expected platform", html.includes("showUniversalPlatformDownloader(u,normalizedChosen)") && html.includes("expectedPlatform:platform")],
  ["Paste-link mode hides cross-platform All 200 option; cross-platform search remains separate", searchJs.includes('const allButton=picker?.querySelector(\'[data-platform="all"]\')') && searchJs.includes("if(allButton)allButton.hidden=link") && searchJs.includes('window.aryanzzSelectedPlatform=()=>selected')],
  ["Paste-link mode hard-rejects mismatched and unrecognized platform URLs", html.includes('if(isLinkMode&&(!detected||normalizedChosen!==detected))') && html.includes("GAGAL — PLATFORM TIDAK SESUAI") && html.includes("Tautan ditolak.")],
  ["Worker independently enforces the requested platform and rejects all-platform downloader requests", worker.includes('const expected=String(body?.expectedPlatform||"").toLowerCase()') && worker.includes('if(!expected||expected==="all")') && worker.includes("if(normalizedExpected!==key)")],
  ["Every title-search result opens inside the ARYANZZ platform-specific preview/download flow, including unverified search candidates", searchJs.includes('pick.textContent=searchType?.value==="audio"?"Periksa & buat MP3":"Lihat & unduh"') && searchJs.includes('if(platforms[source])setPlatform(source);setMode("link");input.value=item.url') && !searchJs.includes('if(item.searchOnly){window.open(item.url')],
  ["Selected-platform video and audio search filters every returned result by its real source URL", searchJs.includes("function searchResultBelongsTo(item,platform)") && searchJs.includes(".filter(item=>searchResultBelongsTo(item,selected))")],
  ["All non-YouTube video formats render the shared in-page video preview regardless of provider name", downloaderJs.includes('if(!isYouTube){\n        const previewFormat=') && downloaderJs.includes('mediaMetaLine.textContent=[info.extractor||platformName(url),mm+":"+String(ss).padStart(2,"0")')],
  ["SnackVideo duration is extracted from public metadata and falls back to browser video metadata", worker.includes("durationSeconds|duration_seconds|videoDuration|video_duration|durationMs|duration_ms") && downloaderJs.includes('preview.addEventListener("loadedmetadata"')],
  ["Selected-platform title search has a Google video/web fallback with strict domain filtering", worker.includes("function parseGoogleSocialVideoResults") && worker.includes("googlePages") && worker.includes("googleCandidateCount")],
  ["Live platform matrix selects all 20 dedicated provider choices from the catalogue", read("../tests/live-platform-matrix.mjs").includes('PLATFORM_CATALOG.filter(platform=>platform.providerKey!=="aio").map(platform=>platform.id)')],
  ["Platform picker visibly labels the 200 platform catalogue", html.includes("<span>200 PLATFORM</span>")],
  ["Social providers without source resolution metadata show original quality instead of invented 360p–2160p choices", downloaderJs.includes("isYouTube||hasProviderDownloadFormats?[]:[360,480,720,1080,1440,2160]") && downloaderJs.includes("Kualitas asli · ukuran diperiksa sebelum unduh")],
  ["Social downloads use adaptive Wi-Fi/cellular network detection and 1–5 parallel lanes", downloaderJs.includes("function socialNetworkPlan(selected=0)") && downloaderJs.includes('connection?.type') && downloaderJs.includes("Math.min(lanes,count)") && downloaderJs.includes('Otomatis · Wi-Fi / data seluler')],
  ["Social parallel downloads validate every HTTP byte range and total size before saving", downloaderJs.includes('headers:{Range:"bytes="+start+"-"+end}') && downloaderJs.includes('Number(range[1])!==start') && downloaderJs.includes('Number(range[3])!==size') && downloaderJs.includes("Potongan tidak lengkap")],
  ["Social downloads fall back to Chrome native download when the provider does not support byte ranges", downloaderJs.includes("if(size>180*1024*1024||!check.rangeSupported)") && downloaderJs.includes("Mode paralel tidak didukung · Chrome siap mengunduh")],
  ["Social parallel downloads report live throughput, ETA, and received bytes", downloaderJs.includes('formatDownloadSize(speed)+"/detik"') && downloaderJs.includes('formatDownloadEta(eta)') && downloaderJs.includes('formatDownloadSize(received)')],
  ["All social media providers with a validated downloadUrl use the safe media-file pipeline, including SnackVideo Tioo/native fallbacks", downloaderJs.includes("const hasSocialDownloadFormats=Array.isArray(info.formats)&&info.formats.some(item=>item?.downloadUrl)") && downloaderJs.includes("if(hasSocialDownloadFormats){")],
  ["Social platform page URLs can never fall through to the generic direct-file downloader", downloaderJs.includes('if(sourcePlatform!=="Direct Media URL")throw new Error("Provider "+sourcePlatform+" belum memberikan tautan file media yang valid.')],
  ["Resolution options show exact or estimated source file sizes", downloaderJs.includes("const estimate=best?estimateFormatBytes(best,info.duration)") && downloaderJs.includes('value+"p · tersedia"+size')],
  ["Image download buttons verify image MIME and file signature before saving", downloaderJs.includes('if(!mime.startsWith("image/")||mime==="image/svg+xml")') && downloaderJs.includes("const valid=(head[0]===0xff&&head[1]===0xd8&&head[2]===0xff)")],
  ["Platform picker paginates 20 entries at a time across 10 pages", html.includes('id="platformPager"') && html.includes('id="platformPrev"') && html.includes('id="platformNext"') && searchJs.includes("const platformPageSize=20") && searchJs.includes("renderPlatformPage(platformPage+1)") && searchJs.includes("renderPlatformPage(platformPage-1)")],
  ["TikTok Lite and Instagram Lite reuse the original parent-brand SVG logos", searchJs.includes('platformTemplates.get(platform.aliasOf)?.querySelector(".v736-logo")') && searchJs.includes('oldLogo.replaceWith(source.cloneNode(true))')],
  ["Experimental platform entries are labeled as trials instead of being presented as verified extractors", searchJs.includes("Auto · ") && worker.includes('extractorStatus:platform.extractorStatus') && platformCatalog.includes('row.providerKey === "aio" ? "experimental" : "dedicated"')],
  ["Experimental platform links remain searchable but skip unconfigured extraction providers", worker.includes('if(!key||key==="aio")return searchOnly()') && worker.includes('if(key==="aio")return json({ok:false,error:platformEntry.name')],
  ["Dynamic platform detection is shared by the homepage and downloader", html.includes("window.aryanzzPlatformForUrl?.(raw)") && read("../public/downloader.js").includes("window.aryanzzPlatformForUrl?.(url.href)") && searchJs.includes("window.aryanzzPlatformForUrl=raw=>")],
  ["Platform status serves the 200-entry catalogue and keeps the original 20 first-page choices", worker.includes("platformCount:PLATFORM_CATALOG.length") && platformCatalog.match(/"id":/g)?.length===200 && ["youtube","tiktok","instagram","snackvideo","capcut","pinterest","facebook","x","reddit","vimeo","threads","soundcloud","tiktoklite","facebooklite","snapchat","idnapp","instagramlite","linkedin","wechat","kakaotalk"].every(id=>platformCatalog.includes('"id":"'+id+'"'))],
  ["SnackVideo fallback cascade tries Tioo and then the public SnackVideo page directly", worker.includes("async function snackVideoNativePageFallback") && worker.includes("https://backend1.tioo.eu.org/api/downloader/snackvideo") && worker.includes("SnackVideo native page fallback") && worker.includes("return await snackVideoNativePageFallback(rawUrl,requestUrl)")],
  ["SnackVideo fallback normalizes its MP4 stream through the existing verified media pipeline", worker.includes("freeProviderMediaInfo({normalized:{title,thumbnail,duration,media}}") && worker.includes("fallbackUsed=true") && worker.includes("fallbackTried:true") && worker.includes("canonicalUrl")],
  ["SnackVideo primary provider has a shorter timeout before fallback is attempted", worker.includes('signal:AbortSignal.timeout(key==="snackvideo"?12000:28000)')],
  ["Selected-platform backend search removes cross-platform candidates before relevance scoring", worker.includes('const platformScopedCandidates=platform==="all"') && worker.includes('canonicalPlatformId(platformIdForUrl(item.url)||"")===canonicalPlatform')],
  ["All-platform title search retains only supported platform domains", searchJs.includes('if(key==="all")return Object.values(SEARCH_PLATFORM_DOMAINS).flat()') && worker.includes("?candidates.filter(item=>!!freePlatformKey(item.url))")],
  ["Capture-phase downloader rejects a mismatched platform before calling any extractor", downloaderJs.includes("const selectedRaw=String(window.aryanzzSelectedPlatform?.()") && downloaderJs.includes("GAGAL — PLATFORM TIDAK SESUAI") && downloaderJs.includes("if(!expectedName||detectedKey!==selectedPlatform)") && downloaderJs.includes('postJson("/api/platform/info",{url:url.href,expectedPlatform:selectedPlatform})')],
  ["Capture-phase platform matching normalizes the IDN App display label", downloaderJs.includes('const detectedAliases={"idn app":"idnapp"}')],
  ["Capture-phase downloader routes YouTube only to the YouTube-specific provider", downloaderJs.includes("info=isYouTube") && downloaderJs.includes("await browserHybridYoutubeInfo(url.href)") && downloaderJs.includes('await postJson("/api/platform/info"')],
  ["Pasted social links are matched to the selected platform before extraction", html.includes("function aryPlatformForUrl(raw)") && html.includes("const detected=aryPlatformForUrl(u.href),chosen=arySelectedPlatform()") && html.includes("if(isLinkMode&&(!detected||normalizedChosen!==detected))")],
  ["Supported platform links use the universal free extractor endpoint", html.includes("showUniversalPlatformDownloader(u,normalizedChosen)") && worker.includes('url.pathname==="/api/platform/info"&&request.method==="POST"') && worker.includes("return freePublicMediaInfo(parsed.href,request.url)")],
  ["Wrong-platform pasted links show a hard failure and identify the selected and detected platforms", html.includes("GAGAL — PLATFORM TIDAK SESUAI") && html.includes('berasal dari "+aryPlatformLabel(detected)') && html.includes("Tautan ditolak.")],
  ["Platform URL detection includes YouTube TikTok Instagram Facebook and the other supported social sites", ["youtube\\.com","tiktok\\.com","instagram\\.com","facebook\\.com","pinterest\\.com","soundcloud\\.com","linkedin\\.com","kakao\\.com"].every(pattern => html.includes(pattern))],
  ["Social search can return up to 500 available public results without fabricating unavailable results", read("../src/index.js").includes("candidates.length<500") && read("../src/index.js").includes(".slice(0,500)")],
  ["All-platform Smart Search queries YouTube independently from the 200-platform web search", worker.includes('if(platform==="all"||platform==="youtube")') && worker.includes("const youtubeTerms=[query,query+\" lagu\",query+\" song\",query+\" official audio\",query+\" DJ remix\"")],
  ["All-platform Smart Search has a free YouTube fallback when Piped and Invidious instances are unavailable", worker.includes("async function freeYouTubeSearchItems") && worker.includes("const directYoutube=await freeYouTubeSearchItems(query,youtubeTerms)")],
  ["YouTube title matching accepts close matches without requiring every generic query token", worker.includes('item.platform==="youtube"&&score>=0.16')],
["Tool tutorial videos and the explanatory text below them are removed from all tools", !html.includes("learning-center.js") && !html.includes("learning-center.css") && !read("../public/sw.js").includes("learning-center.js") && !read("../public/sw.js").includes("learning-center.css")],
  ["V93.0 keeps every workspace panel inside the shared tools container", html.indexOf('<section id="toolsArea">') < html.indexOf('id="speed"') && html.indexOf('id="help"') < html.indexOf('id="owner"') && !html.includes('← Kembali ke Home</button></div><div class="panel card editor-panel"')],

  ["V93.0 HTML contains no duplicate element IDs", duplicateIds.length === 0],
  ["Downloader analysis has one controller; legacy Tools does not attach a competing click handler", !advancedJs.includes("analyze.onclick") && !advancedJs.includes("function inspect(url)") && !advancedJs.includes("/api/info") && downloaderJs.includes('button.addEventListener("click"')],
  ["Smart Queue has one controller; legacy Tools does not bind queue actions", !advancedJs.includes("queueAdd") && !advancedJs.includes("queueRun") && !advancedJs.includes("queueClear") && queueJs.includes("queueAdd")],
  ["Library rendering and clear actions are owned by the current V15 library module", !advancedJs.includes("historyList") && !advancedJs.includes("favoriteList") && !advancedJs.includes("clearHistoryV2") && v15Js.includes("setupLibrary()")],
  ["Profile Studio is the single owner of profile photo, banner, background and bio handlers", !advancedJs.includes("profilePhoto") && !advancedJs.includes("profileBanner") && !advancedJs.includes("profileSave") && profileJs.includes('storeImage("profileBanner"') && profileJs.includes('storeImage("profilePhoto"') && profileJs.includes("setupProfilePreview()")],
  ["Profile backup actions are not duplicated by legacy Tools code", !advancedJs.includes("exportData") && !advancedJs.includes("importData") && profileJs.includes("setupBackupActions()")],
  ["ALL platform option is available for AI search but hidden in paste-link mode", html.includes('data-platform="all"') && html.includes("Semua 200") && searchJs.includes('const allButton=picker?.querySelector(\'[data-platform="all"]\')') && searchJs.includes("if(allButton)allButton.hidden=link")],
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
  ["Downloader asset and PWA cache use matching release URLs and a build-scoped cache name", html.includes('/downloader.js?v=94.25.0') && sw.includes('/downloader.js?v=94.25.0') && sw.includes('/ffmpeg-worker-bootstrap.js?v=92.2') && sw.includes('aryanzz-build-__ARYANZZ_VERSION__')],
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
  ["PWA cache includes current search bundle", sw.includes("/v674.js?v=94.25.0") && html.includes("/v674.js?v=94.25.0")],
  ["Worker CSP permits FFmpeg WebAssembly and blob core loading", worker.includes("wasm-unsafe-eval") && worker.includes("https: blob:")],
  ["Homepage loads the current converter runtime", html.includes("/audio-studio.js?v=92.5")],
  ["Unified navigation hides home when another view opens", html.includes('id="appViewHeader"') && html.includes("home.hidden=!!id") && html.includes("p.id===id")],
  ["Unified responsive app shell is loaded", html.includes("/v89.css?v=93.2") && unifiedCss.includes("V89.0 — ONE UNIFIED ECOSYSTEM")],
  ["Shared header and persistent welcome remain", html.includes('class="top v674-top"') && html.includes('id="v89Welcome"')],
  ["Tool panels share one responsive shell", unifiedCss.includes("#toolsArea>.panel{display:none;width:100%") && unifiedCss.includes("#toolsArea>.panel.active{display:block!important")],
  ["Mobile navigation stays fixed inside viewport", unifiedCss.includes(".nav{position:fixed!important")],
  ["Security status endpoint remains available", worker.includes('url.pathname==="/api/security/status"')],
  ["Security middleware wraps Worker requests", worker.includes("export default {fetch:securityFetch};")],
  ["V94.26 release line is selected", read("../package.json").includes('"version": "94.26.0"')],
  ["Security Center remains in homepage", html.includes('id="securityCenter"') && searchJs.includes("initSecurityCenter")],
  ["TikTok Photo Mode routes bypass the video-only metadata filter and inspect hydration JSON", worker.includes("isTikTokPhotoRoute") && worker.includes("__UNIVERSAL_DATA_FOR_REHYDRATION__") && worker.includes("urlList") && worker.includes("images.length>=35")],
  ["Downloader checks photo galleries for image-capable and auto-detect platforms", downloaderJs.includes("shouldTryImageExtraction") && downloaderJs.includes("imageGallery") && downloaderJs.includes("isTikTokPhotoPost")],
  ["Photo extraction has bounded timeouts and skips ordinary dedicated video routes", downloaderJs.includes("isPhotoRoute") && downloaderJs.includes("isExplicitVideoRoute") && downloaderJs.includes("imageCheckTimeout=(isTikTokPhotoPost||isYouTubePhotoPost||isPhotoRoute)?22000:6500") && downloaderJs.includes("AbortSignal.timeout(imageCheckTimeout)")],
  ["Photo Mode can show image downloads without requiring an MP4 stream", downloaderJs.includes("TikTok Photo Mode belum bisa dibaca") && downloaderJs.includes('("Foto dari "+detectedPlatform)') && downloaderJs.includes("slice(0,35)")],
  ["Public image extraction uses the actual platform ID and keeps experimental platforms on safe page-metadata fallback", worker.includes("const providerKey=freePlatformKey(rawUrl)") && worker.includes("const key=platformIdForUrl(rawUrl)||providerKey") && worker.includes('providerKey!=="aio"')],
  ["Instagram post links receive the full image-extraction timeout", downloaderJs.includes("isSocialImagePostRoute") && downloaderJs.includes("isSocialImagePostRoute)?22000:6500")],
  ["Photo-only posts can generate a local slideshow video without claiming original audio", downloaderJs.includes("createPhotoSlideshow") && downloaderJs.includes("canvas.captureStream(24)") && downloaderJs.includes("Buat video slideshow (tanpa audio sumber)") && downloaderJs.includes("Audio asli postingan tidak disertakan.")],
  ["Platform cards show media-mode labels instead of the generic Uji coba badge", searchJs.includes("modeLabels.join") && !searchJs.includes('tier.textContent="Uji coba"')],
  ["Platform pager is separated from link/search forms on mobile", read("../public/downloader.css").includes("grid-template-columns:repeat(2,minmax(0,1fr))!important") && read("../public/downloader.css").includes("margin:16px 0 26px!important") && read("../public/downloader.css").includes("#linkModePanel,#titleModePanel{margin-top:8px")]
];

for (const [name, ok] of checks) {
  assert.ok(ok, name + " failed");
  console.log("✔ " + name);
}
console.log("\nARYANZZ V93.0 full workspace audit release smoke tests passed.");
