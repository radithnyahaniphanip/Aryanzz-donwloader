import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

const file=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=file("../public/index.html");
const sw=file("../public/sw.js");
const manifest=JSON.parse(file("../public/manifest.webmanifest"));

const checks=[
  ["V27.1 page title",html.includes("ARYANZZ V27.1 — Free All in One")],
  ["V27.1 asset cache bust",html.includes("/v15.js?v=27.1")&&html.includes("/v25.js?v=27.1")],
  ["fresh service worker URL",html.includes("/sw.js?v=27.1")&&sw.includes("aryanzz-v27-1")],
  ["downloader form",html.includes('id="analyze"')&&html.includes('id="downloadResult"')],
  ["YouTube-specific downloader UI",html.includes("function showYouTubeDownloader")&&html.includes("youtubeFormat")],
  ["YouTube start endpoint",html.includes("/api/youtube/download")],
  ["YouTube progress endpoint",html.includes("/api/youtube/progress")],
  ["MP3 and video quality options",html.includes("mp3")&&html.includes("1080p Full HD")&&html.includes("4K")],
  ["profile page",html.includes('id="profile"')],
  ["tool hub",html.includes('id="allTools"')],
  ["mobile data speed-test UI",html.includes("Data Seluler")&&html.includes("wifiTile")],
  ["no old mobile footer text",!html.includes("Built for mobile")],
  ["PWA manifest version",manifest.name.includes("V27.1")]
];
for(const [name,ok] of checks){assert.ok(ok,name+" failed");console.log("✔ "+name)}

const healthResponse=await worker.fetch(new Request("https://aryanzz.example/api/health"),{});
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();
assert.equal(health.version,"27.1");
assert.equal(health.youtubeDownloader,true);
assert.equal(health.youtubeApiKeyConfigured,false);
assert.equal(health.platformExtraction,false);
console.log("✔ Worker health and safe YouTube secret status");

const invalid=await worker.fetch(new Request("https://aryanzz.example/api/youtube/download",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://example.com/video",format:"mp3"})
}),{});
assert.equal(invalid.status,400);
console.log("✔ YouTube endpoint rejects non-YouTube URLs");

const noKey=await worker.fetch(new Request("https://aryanzz.example/api/youtube/download",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://youtu.be/demo123",format:"mp3"})
}),{});
assert.equal(noKey.status,503);
assert.match((await noKey.json()).error,/SAVENOW_API_KEY|API key downloader YouTube/);
console.log("✔ Missing YouTube secret is reported clearly");

const invalidProgress=await worker.fetch(new Request("https://aryanzz.example/api/youtube/progress",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:"",format:"mp3"})
}),{});
assert.equal(invalidProgress.status,400);
console.log("✔ YouTube progress validates process ID");

const unknown=await worker.fetch(new Request("https://aryanzz.example/api/not-a-route"),{});
assert.equal(unknown.status,404);
console.log("✔ Unknown API route");

console.log("\nARYANZZ V27.1 smoke tests passed.");
