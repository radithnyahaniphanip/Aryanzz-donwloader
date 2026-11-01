import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

const file=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=file("../public/index.html");
const js=file("../public/v15.js");
const css=file("../public/v15.css");
const v25js=file("../public/v25.js");
const v25css=file("../public/v25.css");
const advanced=file("../public/advanced.js");
const manifest=JSON.parse(file("../public/manifest.webmanifest"));

const htmlChecks=[
  ["V25 title",html.includes("ARYANZZ V25 — All in One")],
  ["V25 badge",html.includes("V25 · PREMIUM")],
  ["premium style",html.includes("/v15.css?v=25.0")&&html.includes("/v25.css?v=25.0")],
  ["functional JS",html.includes("/v15.js?v=25.0")&&html.includes("/v25.js?v=25.0")],
  ["home",html.includes('id="home"')],
  ["tool hub",html.includes('id="allTools"')],
  ["downloader",html.includes('id="analyze"')],
  ["profile studio",html.includes('id="profile"')&&html.includes('id="profileBanner"')&&html.includes('id="profileBackground"')],
  ["no public technical roadmap",!html.includes('id="releaseRoadmap"')],
  ["no public backend warning",!html.includes('class="capability-note"')],
  ["membership tiers",html.includes("Rp36.000")&&html.includes("Rp88.000")&&html.includes("Rp479.000")],
  ["membership payment disclosure",html.includes("tidak menagih pembayaran")],
  ["footer branding cleaned",!html.includes("Built for mobile")],
  ["speed footnote removed",!html.includes("Tes mengikuti koneksi aktif HP")],
  ["profile image compression",advanced.includes("function profilePhotoData")],
  ["profile backup design",advanced.includes("design:JSON.parse")],
  ["background and banner controls",v25js.includes("profileBanner")&&v25js.includes("profileBackground")],
  ["local plan selection",v25js.includes("selectPlan")&&v25js.includes("membership.selection.v25")],
  ["motion effects",v25css.includes("@keyframes v25Shine")],
  ["reduced motion support",v25css.includes("prefers-reduced-motion")],
  ["all search setup",js.includes("setupToolSearch")],
  ["local image converter",js.includes("setupImageLab")],
  ["local library",js.includes("setupLibrary")],
  ["downloader controller",js.includes("AbortController")],
  ["Wi-Fi and mobile data UI",html.includes("Data Seluler")&&html.includes("wifiTile")],
  ["upload measurement",js.includes("speed.cloudflare.com/__up")],
  ["download measurement",js.includes("speed.cloudflare.com/__down")],
  ["mobile data usage modes",html.includes("Cepat · ±3 MB")&&html.includes("Lengkap · ±11 MB")],
  ["speed test cancel",html.includes('id="speedCancel"')],
  ["theme variants",css.includes('body[data-accent="purple"]')],
  ["responsive style",css.includes("@media(max-width:370px)")],
  ["manifest",manifest.name.includes("V25")]
];
for(const [name,ok] of htmlChecks){assert.ok(ok,name+" failed");console.log("✔ "+name)}

const healthResponse=await worker.fetch(new Request("https://aryanzz.example/api/health"),{});
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();
assert.equal(health.version,"25.0");
assert.equal(health.platformExtraction,false);
console.log("✔ Worker health status");

const bad=await worker.fetch(new Request("https://aryanzz.example/api/info",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"http://127.0.0.1/internal.mp4"})
}),{});
assert.equal(bad.status,400);
console.log("✔ Private network URLs rejected");

const blocked=await worker.fetch(new Request("https://aryanzz.example/api/info",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://youtube.com/watch?v=demo"})
}),{});
assert.equal(blocked.status,503);
console.log("✔ Missing extraction backend is disclosed");

const other=await worker.fetch(new Request("https://aryanzz.example/api/not-a-route"),{});
assert.equal(other.status,404);
console.log("✔ API unknown route");
console.log("\nARYANZZ V25 smoke tests passed.");
