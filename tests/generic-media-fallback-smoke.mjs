import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../src/index.js",import.meta.url),"utf8");
const start=source.indexOf("function extractGenericPublicMediaCandidates");
const end=source.indexOf("\nasync function genericPublicPageMediaInfo",start);
assert.ok(start>=0&&end>start,"generic public media parser must exist as a standalone helper");
const parserSource=source.slice(start,end)+"\nglobalThis.extractGenericPublicMediaCandidates=extractGenericPublicMediaCandidates;";
const sandbox={
  URL,
  safePublicMediaUrl(raw){
    try{
      const url=new URL(raw);
      if(url.protocol!=="https:"||url.username||url.password||url.hostname==="localhost"||url.hostname==="127.0.0.1"||url.hostname==="169.254.169.254"||url.hostname.endsWith(".local"))return null;
      return url;
    }catch{return null}
  }
};
vm.runInNewContext(parserSource,sandbox);
const html=[
  '<meta property="og:video" content="https://cdn.example/video.mp4">',
  '<meta property="og:video:type" content="video/mp4">',
  '<meta property="og:audio" content="https://cdn.example/audio.mp3">',
  '<meta property="og:audio:type" content="audio/mpeg">',
  '<video><source src="https://cdn.example/clip.webm" type="video/webm"></video>',
  '<script type="application/ld+json">{"@context":"https://schema.org","@type":"VideoObject","contentUrl":"https://cdn.example/jsonld.mp4","encodingFormat":"video/mp4"}</script>',
  '<script>window.__DATA__={"video_url":"https://cdn.example/hydrated.mp4","audio_url":"https://cdn.example/hydrated.mp3"};</script>',
  '<meta property="og:video" content="https://cdn.example/playlist.m3u8">',
  '<video src="http://127.0.0.1/private.mp4"></video>'
].join("\n");
const results=sandbox.extractGenericPublicMediaCandidates(html,"https://social.example/post/123");
console.log("Generic media parser diagnostics:",JSON.stringify(results));
assert.ok(results.some(item=>item.url==="https://cdn.example/video.mp4"&&item.mode==="video"),"Open Graph MP4 should be detected");
assert.ok(results.some(item=>item.url==="https://cdn.example/audio.mp3"&&item.mode==="audio"),"Open Graph audio should be detected");
assert.ok(results.some(item=>item.url==="https://cdn.example/clip.webm"&&item.mode==="video"),"HTML video source should be detected");
assert.ok(results.some(item=>item.url==="https://cdn.example/jsonld.mp4"&&item.mode==="video"),"JSON-LD VideoObject contentUrl should be detected");
assert.ok(results.some(item=>item.url==="https://cdn.example/hydrated.mp4"&&item.mode==="video"),"Hydration video_url should be detected");
assert.ok(results.some(item=>item.url==="https://cdn.example/hydrated.mp3"&&item.mode==="audio"),"Hydration audio_url should be detected");
assert.ok(!results.some(item=>item.url.includes("playlist.m3u8")),"HLS playlists must not be presented as direct MP4 downloads");
assert.ok(!results.some(item=>item.url.includes("127.0.0.1")),"Private and loopback media URLs must be rejected");
assert.ok(results.every(item=>item.url.startsWith("https://")),"Only HTTPS public media URLs may be returned");
console.log("ARYANZZ V95 generic public-page video/audio fallback tests passed.");