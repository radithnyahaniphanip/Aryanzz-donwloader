import assert from "node:assert/strict";
import worker from "../src/index.js";

const originalFetch=globalThis.fetch;
const imageSearchHtml='<a class="iusc" m=\'{"purl":"https://bsky.app/profile/demo/post/123","murl":"https://cdn.example/cat.jpg","desc":"cat photo","w":640,"h":480}\'></a>';
const videoSearchHtml='<a class="result__a" href="https://bsky.app/profile/demo/post/123">Cat video</a><div class="result__snippet">Cat video from a public post</div>';
const publicPostHtml='<html><head><title>Cat video post</title><meta property="og:title" content="Cat video post"><meta property="og:image" content="https://cdn.example/cat.jpg"><meta property="og:video" content="https://cdn.example/clip.mp4"><meta property="og:video:type" content="video/mp4"></head><body></body></html>';
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
  if(url.hostname==="bsky.app")
    return new Response(url.pathname.endsWith("/456")?publicImagePostHtml:publicPostHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  throw new Error("Unexpected mocked search fetch: "+url.href);
};

try{
  const imageAll=await worker.fetch(new Request("https://aryanzz.example/api/image/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.31"},
    body:JSON.stringify({query:"cat",platform:"all"})
  }),{});
  assert.equal(imageAll.status,200,"All-platform image search should return a valid response");
  const allData=await imageAll.json();
  assert.ok(allData.results.some(group=>group.platform==="bluesky"),"All-platform image search must retain AIO platform IDs such as Bluesky");
  assert.ok(allData.results.some(group=>group.images?.some(image=>image.previewUrl?.includes("/api/social-image-file"))),"Image search must return ARYANZZ preview/download proxy URLs");
  console.log("✔ All-platform image search keeps experimental catalogue platforms in their real result groups");

  const imageSelected=await worker.fetch(new Request("https://aryanzz.example/api/image/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.32"},
    body:JSON.stringify({query:"cat",platform:"bluesky"})
  }),{});
  assert.equal(imageSelected.status,200,"Selected Bluesky image search should work");
  const selectedImages=await imageSelected.json();
  assert.ok(selectedImages.results.length>0&&selectedImages.results.every(group=>group.platform==="bluesky"),"Selected AIO image search must use the canonical platform bucket");
  console.log("✔ Selected-platform image search uses the canonical catalogue bucket");

  const videoSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.33"},
    body:JSON.stringify({query:"cat",platform:"bluesky",mediaType:"video"})
  }),{});
  assert.equal(videoSearch.status,200,"Selected Bluesky title/video search should return a valid response");
  const videoData=await videoSearch.json();
  assert.ok(videoData.results.some(item=>item.platform==="bluesky"&&item.searchOnly===true),"Video title search must preserve AIO results as clearly unverified candidates, not drop them");
  console.log("✔ Selected-platform video title search returns generic-provider candidates without mislabeling them as verified");

  const expansionSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.36"},
    body:JSON.stringify({query:"green screen meme kucing",platform:"bluesky",mediaType:"video"})
  }),{});
  assert.equal(expansionSearch.status,200,"Keyword expansion search should return a valid response");
  const expansionData=await expansionSearch.json();
  assert.ok(expansionData.searchVariants.includes("green screen meme template"),"Green-screen meme searches must expand to useful related title variants");
  console.log("✔ Title-search keyword expansion recognizes green screen, meme and Indonesian cat terms");

  const videoInfo=await worker.fetch(new Request("https://aryanzz.example/api/platform/info",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.34"},
    body:JSON.stringify({url:"https://bsky.app/profile/demo/post/123",expectedPlatform:"bluesky"})
  }),{});
  const videoInfoData=await videoInfo.json();
  assert.equal(videoInfo.status,200,"Generic public-page video metadata should be extracted for an AIO platform: "+JSON.stringify(videoInfoData));
  assert.ok(videoInfoData.formats?.some(item=>item.mode==="video"&&item.ext==="mp4"),"Generic public-page fallback should preserve an actual MP4 source");
  console.log("✔ Generic platform video links reach the public-page media metadata fallback");

  const imageInfo=await worker.fetch(new Request("https://aryanzz.example/api/image/extract?url="+encodeURIComponent("https://bsky.app/profile/demo/post/456"),{
    headers:{"cf-connecting-ip":"198.51.100.35"}
  }),{});
  assert.equal(imageInfo.status,200,"Generic public-page image extraction should work for an AIO platform");
  const imageInfoData=await imageInfo.json();
  assert.equal(imageInfoData.platform,"bluesky");
  assert.ok(imageInfoData.images?.some(item=>item.previewUrl?.includes("/api/social-image-file")),"Generic platform image links should return a verified ARYANZZ image proxy");
  console.log("✔ Generic platform image links reach the public-page image extraction fallback");
}finally{
  globalThis.fetch=originalFetch;
}
