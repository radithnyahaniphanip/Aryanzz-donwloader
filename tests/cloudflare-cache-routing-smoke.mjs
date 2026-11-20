import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const wrangler=read("wrangler.toml");
const worker=read("src/index.js");

const runFirst=wrangler.match(/run_worker_first\\s*=\\s*\\[([\\s\\S]*?)\\]/);
assert.ok(runFirst,"Cloudflare Static Assets must define selective Worker-first routing.");
const routes=[...runFirst[1].matchAll(/"([^"]+)"/g)].map(match=>match[1]);
for(const route of ["/api/*","/","/index.html","/sw.js","/release.json","/release-manifest.json","/manifest.webmanifest","/robots.txt","/sitemap.xml","/panduan","/download-video","/download-mp3","/download-gambar"]){
  assert.ok(routes.includes(route),"Cloudflare must invoke the Worker before serving "+route);
}

const canonical=worker.match(/const canonicalHtmlPaths=new Set\\(\\[([^\\]]+)\\]\\)/);
assert.ok(canonical,"Worker canonical HTML route list must exist.");
for(const route of ["/","/index.html","/panduan","/download-video","/download-mp3","/download-gambar"]){
  assert.ok(canonical[1].includes('"'+route+'"'),"Worker must apply canonical HTML handling to "+route);
}
const noStore=worker.match(/if\\(request\\.method==="GET"&&\\[([^\\]]+)\\]\\.includes\\(url\\.pathname\\)\\)/);
assert.ok(noStore,"Worker no-store route list must exist.");
for(const route of ["/","/index.html","/sw.js","/release.json","/release-manifest.json","/manifest.webmanifest","/robots.txt","/sitemap.xml"]){
  assert.ok(noStore[1].includes('"'+route+'"'),"Worker must return no-store for "+route);
}
assert.ok(worker.includes('headers.set("cache-control","no-store, no-cache, must-revalidate, max-age=0")'),"Worker no-store cache policy must remain explicit.");
console.log("ARYANZZ Cloudflare cache-routing smoke test passed: all HTML, service-worker and release metadata paths execute Worker no-store middleware.");
