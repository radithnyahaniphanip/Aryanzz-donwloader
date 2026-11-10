import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const worker = read("../src/index.js");
const page = read("../public/index.html");
const downloader = read("../public/downloader.js");
const network = read("../public/network-mode.js");
const serviceWorker = read("../public/sw.js");

assert.match(worker, /function canonicalFacebookPostUrl/);
assert.match(worker, /function facebookMobilePageUrl/);
assert.match(worker, /function extractFacebookEmbeddedMediaCandidates/);
assert.match(worker, /playable_url_quality_hd/);
assert.match(worker, /pageRequestUrl=key==="facebook"\?facebookMobilePageUrl/);
assert.match(worker, /u\.pathname===["']\/story\.php["']/);
assert.match(worker, /story_fbid/);
assert.match(worker, /groups.*permalink.*posts/);
assert.match(worker, /async function facebookPublicReaderMediaInfo/);
assert.match(worker, /if\(key==="facebook"\)\s*\{\s*try\s*\{\s*const response=await facebookPublicReaderMediaInfo/);
assert.match(worker, /errorType:login\?"login_required":accessLimited\?"public_access_limited":"public_reader_unavailable"/);
assert.match(worker, /public_access_limited/);
assert.match(worker, /Facebook sedang membatasi pembacaan otomatis dari server ARYANZZ/);

assert.match(page, /<script src="\/network-mode\.js\?v=__ARYANZZ_VERSION__" defer><\/script>/);
assert.match(network, /indexedDB\.open\(DB_NAME,DB_VERSION\)/);
assert.match(network, /aryanzzNetworkMode/);
assert.match(network, /data-network-mode="offline"/);
assert.match(network, /data-network-mode="online"/);
assert.match(network, /\/api\/platform\/info/);
assert.match(network, /async function saveMedia/);
assert.match(network, /check\.valid!==true/);
assert.match(network, /MAX_OFFLINE_BYTES=100\*1024\*1024/);
assert.match(downloader, /Simpan offline/);
assert.match(downloader, /ARYANZZOfflineMedia\.saveMedia/);

assert.match(serviceWorker, /async function offlineAwareFile/);
assert.match(serviceWorker, /url\.searchParams\.get\("probe"\)==="1"/);
assert.match(serviceWorker, /x-aryanzz-media-validation/);
assert.match(serviceWorker, /content-range/);
assert.match(serviceWorker, /u\.pathname==="\/api\/social-file"/);
assert.match(serviceWorker, /\/network-mode\.js\?v=__ARYANZZ_VERSION__/);

console.log("Facebook public-link fallback, online/offline mode, persistent metadata cache, verified media save, and offline Range/probe support passed.");
