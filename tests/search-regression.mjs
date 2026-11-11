import assert from "node:assert/strict";
import worker from "../src/index.js";
import { readFileSync } from "node:fs";

const searchUi=readFileSync(new URL("../public/v674.js",import.meta.url),"utf8");
assert.ok(searchUi.includes("function searchDomainsForPlatform")&&searchUi.includes("platformCatalog.flatMap"),"Link/search filtering must retain the full live platform catalogue");
assert.ok(searchUi.includes("platform.searchModes")&&searchUi.includes("catalogForMode"),"Title-search picker must filter platforms by verified media modes");
assert.ok(searchUi.includes("[10,20,50,100]"),"Search result pagination must offer 10, 20, 50 and 100 results per page");

const originalFetch=globalThis.fetch;
const imageSearchHtml='<a class="iusc" m=\'{"purl":"https://www.instagram.com/p/123/","murl":"https://cdn.example/cat.jpg","desc":"cat photo","w":640,"h":480}\'></a>';
const videoSearchHtml='<a class="result__a" href="https://bsky.app/profile/demo/post/123">Cat video</a><div class="result__snippet">Cat video from a public post</div>';
const publicPostHtml='<html><head><title>Cat video post</title><meta property="og:title" content="Cat video post"><meta property="og:image" content="https://cdn.example/cat.jpg"><meta property="og:video" content="https://cdn.example/clip.mp4"><meta property="og:video:type" content="video/mp4"><meta property="og:video:width" content="1920"><meta property="og:video:height" content="1080"></head><body></body></html>';
const publicImagePostHtml='<html><head><title>Cat image post</title><meta property="og:title" content="Cat image post"><meta property="og:image" content="https://cdn.example/cat.jpg"></head><body></body></html>';

globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
  if(url.hostname==="www.bing.com"&&url.pathname==="/images/search")
    return new Response(imageSearchHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="html.duckduckgo.com")
    return new Response(videoSearchHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="www.bing.com"&&url.pathname==="/search")
    return new Response(videoSearchHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="www.google.com")
    return new Response("",{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="cdn.example"&&url.pathname==="/not-image.jpg")
    return new Response("<html>not an image</html>",{status:200,headers:{"content-type":"image/jpeg","content-length":"25"}});
  if(url.hostname==="cdn.example")
    return new Response(new Uint8Array([0xff,0xd8,0xff,0xd9]),{status:200,headers:{"content-type":"image/jpeg","content-length":"4"}});
  if(url.hostname==="www.instagram.com")
    return new Response(publicImagePostHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="bsky.app"){
    const imageOnly=url.pathname.endsWith("/456");
    return new Response(imageOnly?publicImagePostHtml:publicPostHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  }
  return new Response("",{status:404,headers:{"content-type":"text/html; charset=utf-8"}});
};

try{
  const status=await worker.fetch(new Request("https://aryanzz.example/api/platform/status"),{});
  const statusData=await status.json();
  const bluesky=statusData.platforms.find(item=>item.id==="bluesky");
  const instagram=statusData.platforms.find(item=>item.id==="instagram");
  assert.deepEqual(bluesky.searchModes,[],"AIO-only platforms must not be advertised for title video/image search");
  assert.ok(instagram.searchModes.includes("video")&&instagram.searchModes.includes("image"),"Dedicated Instagram provider must advertise its supported search modes");
  assert.ok(statusData.searchablePlatformCounts.video>0&&statusData.searchablePlatformCounts.image>0,"Status must expose real searchable provider counts");
  console.log("✔ Platform status separates the 200 link catalogue from provider-backed title-search capabilities");

  const imageAll=await worker.fetch(new Request("https://aryanzz.example/api/image/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.31"},
    body:JSON.stringify({query:"cat",platform:"all"})
  }),{});
  assert.equal(imageAll.status,200,"All-platform image search should return a valid response");
  const allData=await imageAll.json();
  assert.ok(allData.results.length>0,"All-platform image search should keep a supported provider result");
  assert.ok(allData.results.every(group=>group.platform==="instagram"),"AIO-only image platforms must be excluded from all-platform image search");
  assert.ok(allData.results.every(group=>group.images?.every(image=>image.mediaVerified===true&&image.previewUrl?.includes("/api/social-image-file"))),"Every displayed image must pass the live image MIME check and use ARYANZZ proxy URLs");
  assert.ok(allData.failedImageChecks>=0&&allData.searchablePlatformCount>0,"Image search must report verification and supported-platform diagnostics");
  console.log("✔ All-platform image search filters unsupported providers and validates every displayed image file");

  const invalidImageProbe=await worker.fetch(new Request("https://aryanzz.example/api/social-image-file?url="+encodeURIComponent("https://cdn.example/not-image.jpg")+"&probe=1",{
    headers:{"cf-connecting-ip":"198.51.100.38"}
  }),{});
  assert.equal(invalidImageProbe.status,415,"MIME-spoofed non-image content must fail the image signature probe");
  const invalidImageData=await invalidImageProbe.json();
  assert.equal(invalidImageData.valid,false);
  console.log("✔ Image MIME spoofing is rejected by byte-signature validation");

  const imageSelected=await worker.fetch(new Request("https://aryanzz.example/api/image/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.32"},
    body:JSON.stringify({query:"cat",platform:"bluesky"})
  }),{});
  assert.equal(imageSelected.status,400,"Selected AIO image search must be rejected instead of showing non-downloadable results");
  const selectedImages=await imageSelected.json();
  assert.equal(selectedImages.ok,false);
  assert.match(selectedImages.error,/provider gambar terverifikasi/i);
  console.log("✔ Selected AIO image search is blocked with a clear capability message");

  const videoSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.33"},
    body:JSON.stringify({query:"cat",platform:"bluesky",mediaType:"video"})
  }),{});
  assert.equal(videoSearch.status,400,"Selected AIO title/video search must be rejected");
  const videoData=await videoSearch.json();
  assert.equal(videoData.ok,false);
  assert.match(videoData.error,/provider video terverifikasi/i);
  console.log("✔ Selected AIO video title search is blocked before searching");

  const allVideoSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.37"},
    body:JSON.stringify({query:"cat",platform:"all",mediaType:"video"})
  }),{});
  assert.equal(allVideoSearch.status,200,"All-platform title search should return a valid response");
  const allVideoData=await allVideoSearch.json();
  assert.ok(allVideoData.results.every(item=>item.verified===true&&item.downloadable===true&&item.searchOnly!==true),"All visible video results must be verified downloadable media; no unverified search-only cards may leak through");
  assert.equal(allVideoData.searchOnlyCount,0,"Unverified search-only candidates must never be returned as result cards");
  assert.ok(allVideoData.unsupportedCandidateCount>0,"AIO-only results must be counted as excluded rather than shown");
  console.log("✔ All-platform video search drops unsupported AIO results and returns verified media only");

  const expansionSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.36"},
    body:JSON.stringify({query:"green screen meme kucing",platform:"instagram",mediaType:"video"})
  }),{});
  assert.equal(expansionSearch.status,200,"Keyword expansion search should return a valid response");
  const expansionData=await expansionSearch.json();
  assert.ok(expansionData.searchVariants.includes("green screen meme template"),"Green-screen meme searches must expand to useful related title variants");
  console.log("✔ Title-search keyword expansion remains active for supported providers");

  const videoInfo=await worker.fetch(new Request("https://aryanzz.example/api/platform/info",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.34"},
    body:JSON.stringify({url:"https://bsky.app/profile/demo/post/123",expectedPlatform:"bluesky"})
  }),{});
  const videoInfoData=await videoInfo.json();
  assert.equal(videoInfo.status,200,"Generic public-page video metadata should remain available for manual link analysis: "+JSON.stringify(videoInfoData));
  assert.ok(videoInfoData.formats?.some(item=>item.mode==="video"&&item.ext==="mp4"),"Generic public-page fallback should preserve an actual MP4 source");
  assert.equal(videoInfoData.width,1920,"Generic video metadata should preserve source width");
  assert.equal(videoInfoData.height,1080,"Generic video metadata should preserve source height");
  assert.equal(videoInfoData.aspectRatio,1920/1080,"Generic video metadata should preserve the source aspect ratio");
  console.log("✔ Experimental platforms remain available for manual pasted-link extraction");

  const imageInfo=await worker.fetch(new Request("https://aryanzz.example/api/image/extract?url="+encodeURIComponent("https://bsky.app/profile/demo/post/456"),{
    headers:{"cf-connecting-ip":"198.51.100.35"}
  }),{});
  const imageInfoData=await imageInfo.json();
  assert.equal(imageInfo.status,200,"Generic public-page image extraction should remain available for manual links: "+JSON.stringify(imageInfoData));
  assert.equal(imageInfoData.platform,"bluesky");
  assert.ok(imageInfoData.images?.some(item=>item.previewUrl?.includes("/api/social-image-file")),"Generic platform image links should return ARYANZZ image proxy URLs");
  console.log("✔ Experimental platform image links still reach safe public-page extraction in link mode");
}finally{
  globalThis.fetch=originalFetch;
}
