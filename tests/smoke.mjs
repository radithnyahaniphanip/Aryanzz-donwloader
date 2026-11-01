import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

const file=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=file("../public/index.html");
const js=file("../public/v15.js");
const css=file("../public/v15.css");
const manifest=JSON.parse(file("../public/manifest.webmanifest"));

const htmlChecks=[
  ["V15 title",html.includes("ARYANZZ V15 — All in One")],
  ["V15 badge",html.includes("V15 · PREMIUM")],
  ["premium style",html.includes("/v15.css?v=15.1")],
  ["functional JS",html.includes("/v15.js?v=15.1")],
  ["home",html.includes('id="home"')],
  ["tool hub",html.includes('id="allTools"')],
  ["downloader",html.includes('id="analyze"')],
  ["profile",html.includes('id="profile"')],
  ["no public technical roadmap",!html.includes('id="releaseRoadmap"')],
  ["no public backend warning",!html.includes('class="capability-note"')],
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
  ["manifest",manifest.name.includes("V15")]
];
for(const [name,ok] of htmlChecks){assert.ok(ok,name+" failed");console.log("✔ "+name)}

const healthResponse=await worker.fetch(new Request("https://aryanzz.example/api/health"),{});
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();
assert.equal(health.version,"15.0");
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
console.log("\nARYANZZ V15 smoke tests passed.");
