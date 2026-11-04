import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../public/index.html");
const worker = read("../src/index.js");
const sw = read("../public/sw.js");
const searchJs = read("../public/v674.js");
const searchCss = read("../public/v674.css");
const unifiedCss = read("../public/v89.css");
const converterJs = read("../public/audio-studio.js");
const bootstrap = read("../public/ffmpeg-worker-bootstrap.js");

const checks = [
  ["ALL platform option is removed", !html.includes('data-platform="all"') && !searchJs.includes('all:{name:"Semua platform"')],
  ["Audio search option is removed", !html.includes('<option value="audio">Audio</option>')],
  ["Video and image search remain available", html.includes('<option value="video">Video</option>') && html.includes('<option value="image">Gambar</option>')],
  ["MP4 to MP3 converter remains available in tools", html.includes("MP4 ke MP3 Converter") && html.includes('id="audioStudio"')],
  ["Converter footer disclaimer is removed", !html.includes('class="audio-studio-disclaimer"')],
  ["Converter JS has timeout and current worker bootstrap", converterJs.includes("LOAD_TIMEOUT_MS") && converterJs.includes("ffmpeg-worker-bootstrap.js?v=89.2")],
  ["FFmpeg worker bootstrap imports the pinned FFmpeg worker", bootstrap.includes("@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js")],
  ["Homepage release label is V90.0", html.includes("V90.0 · GRATIS")],
  ["Worker health reports V90.0", worker.includes('version:"90.0"')],
  ["Homepage references versioned V90.0 app CSS", html.includes("/v89.css?v=90.0")],
  ["Service worker cache namespace is V90.0", sw.includes('const CACHE="aryanzz-v90-0"')],
  ["Service worker precaches the current homepage and converter", sw.includes("/?v=90.0") && sw.includes("/audio-studio.js?v=90.0") && sw.includes("/audio-studio.css?v=90.0")],
  ["Unified navigation hides home when another view opens", html.includes('id="appViewHeader"') && html.includes("home.hidden=!!id") && html.includes("p.id===id")],
  ["Unified app shell styles are included", unifiedCss.includes("V89.0 — ONE UNIFIED ECOSYSTEM") && html.includes("/v89.css?v=90.0")],
  ["One shared header and persistent welcome remain", html.includes('class="top v674-top"') && html.includes('id="v89Welcome"')],
  ["Tool panels share the responsive shell", unifiedCss.includes("#toolsArea>.panel{display:none;width:100%") && unifiedCss.includes("#toolsArea>.panel.active{display:block!important")],
  ["Mobile navigation remains fixed inside viewport", unifiedCss.includes(".nav{position:fixed!important")],
  ["Security status endpoint remains available", worker.includes('url.pathname==="/api/security/status"')],
  ["Security middleware wraps Worker requests", worker.includes("export default {fetch:securityFetch};")],
  ["Security Center remains on homepage", html.includes('id="securityCenter"') && searchJs.includes("initSecurityCenter")]
];

for (const [name, ok] of checks) {
  assert.ok(ok, name + " failed");
  console.log("✔ " + name);
}
console.log("\nARYANZZ V90.0 release smoke tests passed.");
