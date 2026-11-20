import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const wrangler=read("wrangler.toml");
const worker=read("src/index.js");

function quotedArray(source,marker,label){
  const markerAt=source.indexOf(marker);
  assert.notEqual(markerAt,-1,label+" declaration must exist.");
  const open=source.indexOf("[",markerAt);
  const close=source.indexOf("]",open+1);
  assert.ok(open>=0&&close>open,label+" array must be closed.");
  return [...source.slice(open+1,close).matchAll(/"([^"]+)"/g)].map(match=>match[1]);
}

const routes=quotedArray(wrangler,"run_worker_first","Cloudflare Static Assets Worker-first routing");
for(const route of ["/api/*","/","/index.html","/sw.js","/release.json","/release-manifest.json","/manifest.webmanifest","/robots.txt","/sitemap.xml","/panduan","/download-video","/download-mp3","/download-gambar"]){
  assert.ok(routes.includes(route),"Cloudflare must invoke the Worker before serving "+route);
}

const canonical=quotedArray(worker,"const canonicalHtmlPaths=new Set","Worker canonical HTML route list");
for(const route of ["/","/index.html","/panduan","/download-video","/download-mp3","/download-gambar"]){
  assert.ok(canonical.includes(route),"Worker must apply canonical HTML handling to "+route);
}
const noStore=quotedArray(worker,'if(request.method==="GET"&&',"Worker no-store route list");
for(const route of ["/","/index.html","/sw.js","/release.json","/release-manifest.json","/manifest.webmanifest","/robots.txt","/sitemap.xml"]){
  assert.ok(noStore.includes(route),"Worker must return no-store for "+route);
}
assert.ok(worker.includes('headers.set("cache-control","no-store, no-cache, must-revalidate, max-age=0")'),"Worker no-store cache policy must remain explicit.");
console.log("ARYANZZ Cloudflare cache-routing smoke test passed: all HTML, service-worker and release metadata paths execute Worker no-store middleware.");
