import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../public/index.html");
const worker = read("../src/index.js");
const sw = read("../public/sw.js");
const searchJs = read("../public/v674.js");
const searchCss = read("../public/v674.css");
const unifiedCss = read("../public/v89.css");

const checks = [
  ["ALL platform option is removed", !html.includes('data-platform="all"')],
  ["audio search type is removed", !html.includes('<option value="audio">Audio</option>')],
  ["video and image search types remain", html.includes('<option value="video">Video</option>') && html.includes('<option value="image">Gambar</option>')],
  ["MP4 to MP3 converter is listed in tools", html.includes("MP4 ke MP3 Converter")],
  ["homepage label is V89.1", html.includes("V89.1 · GRATIS")],
  ["Worker health reports V89.1", worker.includes('version:"89.1"')],
  ["homepage references the V89.1 search bundle", html.includes("/v674.js?v=88.14.1")],
  ["service worker uses a V89.1 cache namespace", sw.includes('const CACHE="aryanzz-v89-1"')],
  ["service worker precaches the V89.1 app shell", sw.includes("/?v=89.1") && sw.includes("/v89.css?v=89.1") && sw.includes("/v674.js?v=88.14.1")],
  ["unified navigation hides home when another view opens", html.includes('id="appViewHeader"') && html.includes("home.hidden=!!id") && html.includes("p.id===id")],
  ["unified app shell styles are included", html.includes("/v89.css?v=89.1") && unifiedCss.includes("V89.1 — ONE UNIFIED ECOSYSTEM")],
  ["V89 welcome headline is preserved in the unified app shell", html.includes("id=\"v89Welcome\"") && html.includes("Semua berawal") && html.includes("dari satu tautan")],
  ["one shared header and persistent brand welcome are present", html.includes("class=\"top v674-top\"") && html.includes("id=\"v89Welcome\"")],
  ["every tool panel shares one unified responsive shell", unifiedCss.includes("#toolsArea>.panel{display:none;width:100%") && unifiedCss.includes("#toolsArea>.panel.active{display:block!important")],
  ["shared bottom navigation stays within mobile viewport", unifiedCss.includes(".nav{position:fixed!important")],
  ["mobile layout uses consistent grid and full-width content", unifiedCss.includes(".v736-platforms{grid-template-columns:repeat(5,minmax(0,1fr))") && unifiedCss.includes("@media(max-width:680px)")],
  ["home content and wrapper use the full responsive width", unifiedCss.includes(".wrap{width:min(100% - 36px,1160px)!important;") && unifiedCss.includes("#home{width:100%;min-width:0;")],
  ["mobile platform cards use compact dimensions", unifiedCss.includes(".v736-platform{width:100%;min-width:0!important;")],
  ["audio search has a 50-result cap", worker.includes('desiredMode==="audio"?50:80')],
  ["audio results provide an MP3 action", searchJs.includes("♫ Buat MP3") && searchJs.includes("v674-audio-inline-result")],
  ["audio result cards use compact responsive layout", searchCss.includes(".v674-audio-inline-result") && searchCss.includes("grid-template-columns:repeat(2,minmax(0,1fr))")],
  ["security status endpoint exists", worker.includes('url.pathname==="/api/security/status"')],
  ["security middleware wraps Worker requests", worker.includes("export default {fetch:securityFetch};")],
  ["Security Center is present in the homepage", html.includes('id="securityCenter"') && searchJs.includes("initSecurityCenter")],
  ["security status polling uses the same-origin endpoint", searchJs.includes('fetch("/api/security/status"')],
];

for (const [name, ok] of checks) {
  assert.ok(ok, name + " failed");
  console.log("✔ " + name);
}
console.log("\nARYANZZ V89.1 release smoke tests passed.");
