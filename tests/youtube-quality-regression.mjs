import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync("src/index.js", "utf8");
const downloader = readFileSync("public/downloader.js", "utf8");

function functionSource(source, name, indent = "") {
  const pattern = new RegExp("(^|\\n)" + indent + "function " + name + "\\([^\\n]*\\)\\s*\\{[\\s\\S]*?\\n" + indent + "\\}", "m");
  const match = source.match(pattern);
  assert.ok(match, "Expected function " + name + " to exist");
  return match[0].trim();
}

const workerLiveState = new Function("return (" + functionSource(worker, "hybridYouTubeLiveState") + ");")();
const activeLive = workerLiveState({ isLiveContent: true, lengthSeconds: 0 }, { isLiveNow: true }, { hlsManifestUrl: "https://manifest.googlevideo.com/live.m3u8" }, "OK");
assert.equal(activeLive.isLive, true, "An active YouTube Live must be detected from the live broadcast state");
const liveFromManifest = workerLiveState({ isLiveContent: true, lengthSeconds: 0 }, {}, { hlsManifestUrl: "https://manifest.googlevideo.com/live.m3u8" }, "OK");
assert.equal(liveFromManifest.isLive, true, "A live-content video with an active HLS manifest must still be detected when isLiveNow is omitted");
const scheduledLive = workerLiveState({ isLiveContent: true, lengthSeconds: 0 }, { isUpcoming: true }, {}, "LIVE_STREAM_OFFLINE");
assert.equal(scheduledLive.isUpcoming, true, "Scheduled YouTube premieres/streams must remain upcoming rather than unsupported");
const archivedLive = workerLiveState({ isLiveContent: true, lengthSeconds: 3600 }, {}, {}, "OK");
assert.equal(archivedLive.isLiveArchive, true, "A completed YouTube Live archive must be distinguished from a normal video");
const pendingArchive = workerLiveState({ isLiveContent: true, lengthSeconds: 0 }, { endTimestamp: "2026-11-17T04:00:00Z" }, {}, "LIVE_STREAM_OFFLINE");
assert.equal(pendingArchive.isLiveArchive, true, "A finished Live without a published duration must remain in archive-pending state");
const parseYouTubeId = new Function("return (" + functionSource(worker, "youtubeVideoId") + ");")();
assert.equal(parseYouTubeId("https://www.youtube.com/live/abcdefghijk?feature=share"), "abcdefghijk", "The /live/ URL form must be recognized");
assert.equal(parseYouTubeId("https://youtu.be/abcdefghijk"), "abcdefghijk", "The short youtu.be URL form must remain recognized");
assert.equal(parseYouTubeId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk", "The Shorts URL form must remain recognized");

const workerHeight = new Function("return (" + functionSource(worker, "hybridVideoHeight") + ");")();
const browserHeight = new Function("return (" + functionSource(downloader, "browserVideoHeight", "  ") + ");")();
assert.equal(workerHeight({ itag: 402 }, null), 4320, "YouTube AV1 8K itag must resolve to 4320p");
assert.equal(workerHeight({ itag: 571 }, null), 4320, "YouTube VP9 8K itag must resolve to 4320p");
assert.equal(browserHeight({ itag: 402 }, null), 4320, "Browser fallback must recognize 8K AV1");
assert.equal(browserHeight({ itag: 571 }, null), 4320, "Browser fallback must recognize 8K VP9");

assert.match(worker, /!\[144,240,360,480,720,1080,1440,2160,4320\]\.includes\(height\)/, "Worker format parser must accept 4320p");
assert.match(downloader, /!\[144,240,360,480,720,1080,1440,2160,4320\]\.includes\(height\)/, "Browser format parser must accept 4320p");
assert.match(downloader, /\[4320,"4320p · 8K"\]/, "Quality menu must expose 8K only when available");
assert.match(worker, /const innerTubePromise=hybridInnerTubeGroup\(id\)/, "Official YouTube player detection must start before slow public-instance probes finish");
assert.match(worker, /hybridProbeGroup\(piped\.slice\(0,10\)/, "Piped failover must use a bounded, responsive provider set");
assert.match(worker, /hybridProbeGroup\(inv\.slice\(0,6\)/, "Invidious failover must use a bounded, responsive provider set");
assert.match(worker, /attempt\?3000:5000/, "Public provider retries must have bounded timeouts so Live detection does not time out in the browser");

const qualityOrder = new Function("return (" + functionSource(downloader, "youtubeCandidateQualityOrder", "  ") + ");")();
const estimateSource = functionSource(downloader, "youtubeQualityEstimate", "  ");
const estimateQuality = new Function("estimateFormatBytes", "youtubeCandidateQualityOrder", "return (" + estimateSource + ");")((item, duration) => ({
  bytes: Number(item.sizeBytes) || Math.round((Number(item.bitrate) || 0) * (Number(duration) || 0) / 8),
  exact: Number(item.sizeBytes) > 0
}), qualityOrder);
const progressive1080 = { mode: "video", ext: "mp4", height: 1080, bitrate: 5_000_000, videoOnly: false, instance: "https://piped.example" };
const adaptive1440 = { mode: "video", ext: "mp4", height: 1440, bitrate: 8_000_000, videoOnly: true, instance: "https://youtube.example" };
const audio = { mode: "audio", ext: "m4a", bitrate: 128_000, instance: "https://youtube.example" };
const selected2k = estimateQuality({ formats: [progressive1080, adaptive1440, audio], duration: 60 }, 1440);
assert.equal(selected2k.actualHeight, 1440, "Selecting 2K must not silently fall back to a lower progressive 1080p file");
assert.equal(selected2k.kind, "adaptive", "Exact 2K adaptive stream must be selected before lower progressive fallback");
const progressive1440 = { ...progressive1080, height: 1440, bitrate: 10_000_000, instance: "https://piped.example" };
const selectedDirect2k = estimateQuality({ formats: [adaptive1440, audio, progressive1440], duration: 60 }, 1440);
assert.equal(selectedDirect2k.actualHeight, 1440);
assert.equal(selectedDirect2k.kind, "direct", "A higher-bitrate progressive stream is preferred when it has the same resolution");
const adaptiveHigherBitrate = estimateQuality({ formats: [progressive1440, { ...adaptive1440, bitrate: 18_000_000 }, audio], duration: 60 }, 1440);
assert.equal(adaptiveHigherBitrate.kind, "adaptive", "A materially higher-bitrate adaptive stream must not lose to a softer progressive file");
const fallbackOrder = qualityOrder([
  { ...progressive1080, height: 1080, bitrate: 4_000_000 },
  { ...adaptive1440, height: 2160, bitrate: 9_000_000 }
], 1440);
assert.equal(fallbackOrder[0].height, 2160, "When the requested resolution is unavailable, prefer an available higher source resolution over silently downgrading");
const adaptive8k = { ...adaptive1440, height: 4320, bitrate: 40_000_000 };
const selected8k = estimateQuality({ formats: [progressive1080, adaptive8k, audio], duration: 60 }, 4320);
assert.equal(selected8k.actualHeight, 4320, "Selecting 8K must retain the actual 4320p stream");

assert.ok(downloader.includes("candidates=selectProviderCandidates(youtubeCandidateQualityOrder(videoFormats,wanted),2,8)"), "The actual download path must use the same exact-resolution, bitrate-aware quality ranking as the preview");
assert.match(downloader, /function providerAudioForVideo\(/, "Social platforms must identify compatible separate audio streams");
assert.match(downloader, /async function muxSocialVideo\(/, "Social adaptive video/audio streams must be muxed into one output file");
assert.match(downloader, /!item\.videoOnly\|\|hasCompatibleProviderAudio\(item\)/, "Quality options must include adaptive video only when a compatible audio track exists");
assert.match(downloader, /Resolusi video sumber tetap/, "Muxing must preserve and report the source video resolution");

assert.match(worker, /const HYBRID_PROVIDER_HEALTH=new Map\(\)/, "Provider health must be cached per Worker isolate");
assert.match(worker, /status===429\?120000/, "Rate-limited providers must receive a cooldown");
assert.match(worker, /attempt===0&&\[500,502,503,504\]\.includes\(status\)/, "Transient provider 5xx responses must be retried once");
assert.match(worker, /liveManifestUrl:liveManifest\?\.href\|\|null/, "YouTube Live HLS manifest metadata must be preserved when safely available");
assert.match(worker, /liveManifestUrl,liveManifestAvailable:/, "Merged YouTube provider results must retain Live manifest metadata");
assert.match(downloader, /File MP4 lengkap baru dapat dipilih setelah YouTube menerbitkan arsip siaran/, "An active Live stream must not be falsely presented as a completed downloadable MP4");
assert.match(downloader, /info\.isLiveArchive&&!hasVideoFormat/, "A finished Live whose archive is still processing must remain recognized instead of becoming an unknown-link error");
assert.match(downloader, /ARSIP SEDANG DIPROSES/, "The UI must distinguish an archive-pending Live from an unsupported link");

assert.match(downloader, /image\.naturalWidth\+" × "\+image\.naturalHeight\+" px · gambar asli/, "Image results must show the actual source dimensions");
assert.match(downloader, /resolusi asli dipertahankan tanpa menaikkan angka kualitas secara palsu/, "Image downloads must be described as original-quality downloads, not fake upscales");


assert.match(downloader, /activeYouTubeLiveMonitor=null/, "The downloader must track and cancel a running Live archive monitor");
assert.match(downloader, /Pantau hingga arsip siap/, "An active YouTube Live link must offer archive monitoring");
assert.match(downloader, /setTimeout\(poll,60000\)/, "Live archive checks must be rate-limited to one check per minute");
assert.match(downloader, /checkLink\(url,button,\{deep:true\}\)/, "When the archive is ready, the downloader must reopen the normal quality selector");
assert.match(downloader, /6\*60\*60\*1000/, "Automatic Live monitoring must stop after a bounded six-hour window");
assert.match(downloader, /Biarkan halaman ini tetap terbuka/, "The UI must explain that monitoring runs in the open page");
assert.match(downloader, /if\(latest\.isLive\)/, "Live monitoring must keep the active stream state separate from archive-ready state");

console.log("YouTube Live URL/state detection, bounded provider failover, exact-resolution bitrate ranking, 8K, adaptive mux and archive monitoring regression tests passed.");
