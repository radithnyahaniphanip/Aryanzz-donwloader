import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../public/index.html");
const panel = read("../public/emote-studio.html");
const js = read("../public/emote-studio.js");
const css = read("../public/emote-studio.css");
const sw = read("../public/sw.js");
const worker = read("../src/index.js");
const manifest = JSON.parse(read("../public/workspace-manifest.json"));

assert.ok(html.includes('data-panel="emoteStudio"'), "Emote Studio launcher is registered in Tools");
assert.ok(html.includes('id="emoteStudio"'), "Emote Studio is a direct workspace panel");
assert.ok(html.includes('/emote-studio.css?v=__ARYANZZ_VERSION__'), "Emote Studio CSS is loaded");
assert.ok(html.includes('/emote-studio.js?v=__ARYANZZ_VERSION__'), "Emote Studio controller is loaded");
assert.ok(sw.includes('/emote-studio.css?v=__ARYANZZ_VERSION__'), "Emote Studio CSS is cached by the PWA");
assert.ok(sw.includes('/emote-studio.html') && sw.includes('/emote-studio.js?v=__ARYANZZ_VERSION__'), "Emote Studio panel and controller are cached by the PWA");

const feature = manifest.featureModules.find(item => item.root === "#emoteStudio");
assert.ok(feature && feature.css.includes("/emote-studio.css") && feature.js.includes("/emote-studio.js"), "workspace manifest owns the isolated Emote Studio module");

for (const id of ["emotePrompt","emoteReferenceFile","emoteCanvas","emoteAddText","emoteAddEmoji","emoteExportPng","emoteExportWebp","emoteExportGif","emoteVideoFile","emoteExportMp4","emoteLibraryGrid"]) {
  assert.ok(panel.includes('id="' + id + '"'), "missing Emote Studio control: " + id);
}
assert.ok(panel.includes("AI dari deskripsi") && panel.includes("AI dari foto / referensi"), "both AI creation modes are available");
assert.ok(panel.includes("Edit manual tetap diproses di perangkat"), "AI photo-upload privacy is disclosed");
assert.ok(panel.includes("API berbayar"), "AI billing is disclosed before use");

for (const capability of ["function renderCanvas","function drawStrokeLayer","function saveSticker","function exportGif","function exportVideoMp4","function loadFfmpeg","indexedDB.open"]) {
  assert.ok(js.includes(capability), "missing functional Emote Studio capability: " + capability);
}
assert.ok(js.includes("aryanzz-emote-studio-v1"), "sticker library persists in IndexedDB");
assert.ok(js.includes("image/webp") && js.includes("image/png"), "PNG and WebP exports are supported");
assert.ok(js.includes("video/mp4") && js.includes("aryanzz-emote-video.mp4"), "MP4 video export path is present");
assert.ok(css.includes("#emoteStudio") && css.includes("@media(max-width:760px)"), "styles are scoped and responsive");

assert.ok(worker.includes('url.pathname==="/api/emote/status"'), "AI configuration status endpoint is registered");
assert.ok(worker.includes('url.pathname==="/api/emote/generate"'), "AI image generation endpoint is registered");
assert.ok(worker.includes("OPENAI_API_KEY"), "AI key is read only from Worker secret");
assert.ok(worker.includes("gpt-image-2.5-sunburst"), "a current GPT Image model is configured by default");
assert.ok(worker.includes('upstream.append("image[]"'), "photo-to-sticker uses the image edit endpoint");
assert.ok(worker.includes('background:"transparent"'), "AI image output requests transparent backgrounds");
assert.ok(worker.includes("api/emote/generate") && worker.includes("limit:4"), "AI image generation is rate-limited");

console.log("ARYANZZ Emote Studio smoke test passed: modular workspace, AI/photo integration, local editor, IndexedDB library, GIF/MP4 workflows, PWA cache and responsive styles.");
