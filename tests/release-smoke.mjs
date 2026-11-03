import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../public/index.html");
const worker = read("../src/index.js");
const sw = read("../public/sw.js");
const searchJs = read("../public/v674.js");
const searchCss = read("../public/v674.css");

const checks = [
  ["homepage label is V88.14.1", html.includes("V88.14.1 · GRATIS")],
  ["Worker health reports V88.14.1", worker.includes('version:"88.14.1"')],
  ["homepage references the V88.14.1 search bundle", html.includes("/v674.js?v=88.14.1")],
  ["service worker uses a V88.14.1 cache namespace", sw.includes('const CACHE="aryanzz-v88-14-1"')],
  ["service worker precaches the V88.14.1 app shell", sw.includes("/?v=88.14.1") && sw.includes("/v674.js?v=88.14.1")],
  ["unified navigation hides home when another view opens", html.includes('id="appViewHeader"') && html.includes("home.hidden=!!id") && html.includes("p.id===id")],
  ["unified app shell styles are included", html.includes("v8814-unified-app-shell")],
  ["old hero slogan is removed from the home screen", !html.includes("Semua berawal") && !html.includes("dari satu tautan")],
  ["mobile header is not sticky over the page content", html.includes(".v674-top{position:relative;top:auto;")],
  ["home content and wrapper use the full responsive width", html.includes(".wrap{width:100%;max-width:1080px;") && searchCss.includes(".v674-home{width:100%;min-width:0;")],
  ["mobile platform cards use compact dimensions", searchCss.includes("#platformPicker .v736-platform{min-width:0;min-height:76px;")],
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
console.log("\nARYANZZ V88.14.1 release smoke tests passed.");
