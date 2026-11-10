import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../public/index.html");
const panel = read("../public/stage1-tools-panel.html");
const coreSource = read("../public/stage1-tools-core.js");
const video = read("../public/stage1-video-tools.js");
const image = read("../public/stage1-image-tools.js");
const files = read("../public/stage1-file-tools.js");
const developer = read("../public/stage1-dev-tools.js");
const css = read("../public/stage1-tools.css");
const sw = read("../public/sw.js");
const manifest = JSON.parse(read("../public/workspace-manifest.json"));

const tools = [
  ["video-metadata", "Video Metadata Inspector"],
  ["video-frame", "Video Frame Extractor"],
  ["video-sheet", "Video Contact Sheet"],
  ["image-exif", "EXIF Inspector"],
  ["image-palette", "Color Palette Extractor"],
  ["image-blur", "Privacy Blur"],
  ["image-sticker", "Sticker Maker"],
  ["file-zip", "ZIP Creator & Extractor"],
  ["file-rename", "Batch File Renamer"],
  ["file-duplicates", "Duplicate File Finder"],
  ["file-split", "File Splitter & Joiner"],
  ["file-csv", "CSV Viewer & Filter"],
  ["dev-jwt", "JWT Decoder"],
  ["dev-regex", "Regex Playground"]
];

assert.ok(html.includes('id="v1LightTools"'), "Stage 1 tools panel is mounted as a direct workspace panel");
assert.ok(html.includes('/stage1-tools.css?v=__ARYANZZ_VERSION__'), "Stage 1 stylesheet is linked");
for (const path of ["stage1-tools-core.js", "stage1-video-tools.js", "stage1-image-tools.js", "stage1-file-tools.js", "stage1-dev-tools.js"]) {
  assert.ok(html.includes('/' + path + '?v=__ARYANZZ_VERSION__'), "missing loaded module " + path);
  assert.ok(sw.includes('/' + path + '?v=__ARYANZZ_VERSION__'), "missing precached module " + path);
}
assert.ok(sw.includes('/stage1-tools-panel.html') && sw.includes('/stage1-tools.css?v=__ARYANZZ_VERSION__'), "panel fragment and CSS are precached");
for (const [id, label] of tools) {
  assert.ok(panel.includes('data-v1lt-open="' + id + '"'), "missing tool launcher " + id);
  assert.ok(panel.includes(label), "missing tool label " + label);
}
assert.equal(tools.length, 14, "Stage 1 must contain exactly 14 tools");
const gridStart = html.indexOf('<div class="all-tools-grid v674-tool-grid" id="toolGrid">');
const gridEnd = html.indexOf('</div>\n<p class="v674-no-tools"', gridStart);
assert.ok(gridStart >= 0 && gridEnd > gridStart, "main tools grid has a clear closing boundary");
const gridMarkup = html.slice(gridStart, gridEnd);
for (const [id] of tools) {
  assert.ok(gridMarkup.includes('data-v1lt-open="' + id + '"'), "Stage 1 launcher " + id + " belongs to the searchable/filterable tools grid");
}

assert.ok(video.includes('register("video-lightweight"') && video.includes("parseMp4") && video.includes("v1ltSheetGenerate"), "video module registers real media processing");
assert.ok(image.includes('register("image-lightweight"') && image.includes("readJpegExif") && image.includes("renderBlur"), "image module registers EXIF, palette, blur and sticker processing");
assert.ok(image.includes("function applyBlurDab") && image.includes("function addBlurSegment"), "Privacy Blur applies cached brush dabs along smooth pointer segments");
assert.ok(image.includes("requestAnimationFrame(flushBlurPoint)") && image.includes("setPointerCapture"), "Privacy Blur batches pointer movement and captures touch drags");
assert.ok(image.includes('addEventListener("lostpointercapture",finishBlur)'), "Privacy Blur finalizes safely when pointer capture is lost");
assert.ok(!image.includes('const low=document.createElement("canvas");low.width=8'), "Privacy Blur does not allocate a new pixel canvas for every brush point");
assert.ok(css.includes("overscroll-behavior:contain") && css.includes("-webkit-touch-callout:none"), "Privacy Blur prevents page gestures and text selection during brush use");
assert.ok(files.includes('register("file-lightweight"') && files.includes("createZip") && files.includes("subtle.digest") && files.includes("parseCsv"), "file module registers ZIP, hashing and CSV operations");
assert.ok(developer.includes('register("developer-lightweight"') && developer.includes("decodePart") && developer.includes("new Worker"), "developer module registers JWT and isolated regex processing");
assert.ok(css.includes("#v1LightTools") && css.includes("@media(max-width:760px)"), "styles are scoped and responsive");
assert.ok(manifest.featureModules.some(item => item.root === "#v1LightTools" && item.js?.includes("/stage1-tools-core.js")), "workspace manifest owns the Stage 1 panel");

const fakeRoot = { querySelector() { return null; }, querySelectorAll() { return []; }, innerHTML: "" };
const fakeDocument = { readyState: "loading", getElementById(id) { return id === "v1LightTools" ? fakeRoot : null; }, addEventListener() {} };
const sandbox = {
  window: {}, document: fakeDocument, globalThis: null,
  Blob, Response, CompressionStream, DecompressionStream, TextEncoder, TextDecoder,
  Uint8Array, DataView, Map, Set, Date, Math, Number, String, Array, Error,
  URL, setTimeout, clearTimeout, crypto: webcrypto, console,
  CSS: { escape: value => value }, matchMedia: () => ({ matches: true })
};
sandbox.globalThis = sandbox;
vm.runInNewContext(coreSource, sandbox, { filename: "stage1-tools-core.js" });
const core = sandbox.window.ARYANZZStage1Core;
assert.ok(core, "shared tools core initializes without touching other workspaces");

const archive = await core.createZip([
  { name: "hello.txt", data: new Blob(["ARYANZZ Stage 1"]) },
  { name: "folder/data.csv", data: new Blob(["id,name\n1,Aura"]) }
]);
assert.ok(archive.size > 40, "ZIP writer creates a non-empty archive");
const extracted = await core.extractZip(new FileShim(archive, "sample.zip"));
assert.equal(extracted.length, 2, "ZIP reader extracts all entries");
assert.equal(await extracted[0].data.text(), "ARYANZZ Stage 1", "ZIP round-trip preserves file contents");
assert.equal(await extracted[1].data.text(), "id,name\n1,Aura", "ZIP round-trip preserves UTF-8 text");

const zipSlip = await core.createZip([{ name: "safe.txt", data: new Blob(["safe"]) }]);
const zipSlipBytes = new Uint8Array(await zipSlip.arrayBuffer());
const zipSlipView = new DataView(zipSlipBytes.buffer, zipSlipBytes.byteOffset, zipSlipBytes.byteLength);
let centralOffset = -1;
for (let i = 0; i + 46 <= zipSlipBytes.length; i++) {
  if (zipSlipView.getUint32(i, true) === 0x02014b50) { centralOffset = i; break; }
}
assert.ok(centralOffset >= 0, "ZIP central directory exists");
zipSlipBytes.set(new TextEncoder().encode("../x.txt"), centralOffset + 46);
await assert.rejects(core.extractZip(new FileShim(new Blob([zipSlipBytes]), "unsafe.zip")), /jalur file yang tidak aman/, "ZIP extraction rejects path traversal");

const compressedZip = await core.createZip([{ name: "repeat.txt", data: new Blob(["A".repeat(100000)]) }]);
const compressedBytes = new Uint8Array(await compressedZip.arrayBuffer());
const compressedView = new DataView(compressedBytes.buffer, compressedBytes.byteOffset, compressedBytes.byteLength);
let compressedCentral = -1;
for (let i = 0; i + 46 <= compressedBytes.length; i++) {
  if (compressedView.getUint32(i, true) === 0x02014b50) { compressedCentral = i; break; }
}
assert.ok(compressedCentral >= 0, "compressed ZIP central directory exists");
if (compressedView.getUint16(compressedCentral + 10, true) === 8) {
  compressedView.setUint32(compressedCentral + 24, 64, true);
  await assert.rejects(core.extractZip(new FileShim(new Blob([compressedBytes]), "oversized.zip")), /melewati batas aman/, "ZIP extraction bounds DEFLATE output to the declared size");
}

const parsed = core.parseCsv('id,name,note\r\n1,"Aura, A.","said ""hello"""\r\n2,B,"two"');
assert.deepEqual(Array.from(parsed.headers), ["id", "name", "note"]);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0][1], "Aura, A.");
assert.equal(parsed.rows[0][2], 'said "hello"');
const safeCsv = core.csvString(["value"], [["=1+1"]]);
assert.ok(safeCsv.includes("'=1+1"), "CSV export neutralizes spreadsheet formula injection");

function FileShim(blob, name) {
  this.name = name;
  this.size = blob.size;
  this.arrayBuffer = () => blob.arrayBuffer();
}
console.log("ARYANZZ Stage 1 smoke test passed: 14 tools, modular wiring, ZIP round-trip, CSV parsing and export safety.");
