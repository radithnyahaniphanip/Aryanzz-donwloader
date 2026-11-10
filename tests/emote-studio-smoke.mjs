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
assert.ok(feature.purpose.includes("No external AI API"), "manifest documents that no AI API key is required");

assert.ok(panel.includes('data-emote-tab="editor"') && panel.includes('data-emote-view="editor"'), "manual editor is the default Emote Studio view");
assert.ok(!panel.includes('data-emote-view="create"') && !panel.includes("emoteGenerateBtn"), "AI creator tab and controls are removed");
assert.ok(!panel.includes("OPENAI_API_KEY") && !panel.includes("AI Creator") && !panel.includes("API berbayar"), "no API key setup or paid AI copy remains in the panel");

for (const id of ["emoteEditorFile","emoteCanvas","emoteAddText","emoteAddEmoji","emoteExportPng","emoteExportWebp","emoteExportGif","emoteVideoFile","emoteExportMp4","emoteLibraryGrid"]) {
  assert.ok(panel.includes('id="' + id + '"'), "missing Emote Studio control: " + id);
}
for (const capability of ["function renderCanvas","function drawStrokeLayer","function saveSticker","function exportGif","function exportVideoMp4","async function exportVideoViaFfmpeg","async function loadFfmpeg","indexedDB.open"]) {
  assert.ok(js.includes(capability), "missing functional Emote Studio capability: " + capability);
}
assert.ok(js.includes("aryanzz-emote-studio-v1"), "sticker library persists in IndexedDB");
assert.ok(js.includes("image/webp") && js.includes("image/png"), "PNG and WebP exports are supported");
assert.ok(js.includes("video/mp4") && js.includes("aryanzz-emote-video.mp4"), "MP4 video export path is present");
assert.ok(!/OPENAI_API_KEY|\/api\/emote|emoteGenerateBtn|checkAiStatus/.test(js), "browser controller contains no OpenAI API integration");
assert.ok(!/emote-create-grid|emote-cost-note|emote-ai-preview|emote-result-actions/.test(css), "AI-only styles are removed");
assert.ok(css.includes("#emoteStudio") && css.includes("@media(max-width:760px)"), "styles are scoped and responsive");

assert.ok(!/OPENAI_API_KEY|emoteModelForEnv|emoteGenerate|\/api\/emote/.test(worker), "Worker has no Emote Studio OpenAI endpoints or key dependency");
console.log("ARYANZZ Emote Studio local-only smoke test passed: manual editor, IndexedDB library, PNG/WebP, GIF/MP4, mobile FFmpeg fallback, PWA cache and no OpenAI dependency.");
