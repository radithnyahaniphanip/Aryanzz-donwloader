import assert from "node:assert/strict";
import worker from "../src/index.js";

const originalFetch=globalThis.fetch;
const photoUrl="https://www.tiktok.com/@demo/photo/1234567890123456789";
const images=[
  "https://p16-common-sign.tiktokcdn-us.com/tos-alisg-i-photomode-sg/first~tplv-photomode-image.jpeg?dr=9616&x-expires=1795053600&x-signature=first",
  "https://p16-common-sign.tiktokcdn-us.com/tos-alisg-i-photomode-sg/second~tplv-photomode-image.jpeg?dr=9616&x-expires=1795053600&x-signature=second"
];
const markdown=[
  "Title: TikTok Photo Mode",
  "URL Source: https://www.tiktok.com/embed/v2/1234567890123456789",
  "Markdown Content:",
  "![Image 1: img]("+images[0]+")",
  "![Image 2: img]("+images[1]+")",
  "![Image 3: img](blob:http://localhost/placeholder)"
].join("\n");
let relayCalls=0;
let readerCalls=0;
let firstRelayTarget=null;
let firstReaderUrl=null;
let readerHeaders=null;
let failRelay=false;

try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    if(url.hostname==="api.allorigins.win"&&url.pathname==="/raw"){
      relayCalls++;
      firstRelayTarget=url.searchParams.get("url");
      if(failRelay)return new Response("relay unavailable",{status:502});
      return new Response(markdown,{status:200,headers:{"content-type":"text/plain; charset=utf-8"}});
    }
    if(url.hostname==="r.jina.ai"){
      readerCalls++;
      firstReaderUrl=url.href;
      readerHeaders=new Headers(init.headers||{});
      return new Response(markdown,{status:200,headers:{"content-type":"text/plain; charset=utf-8"}});
    }
    throw new Error("Unexpected mocked fetch: "+url.href);
  };

  const requestUrl=new URL("https://aryanzz.example/api/image/extract");
  requestUrl.searchParams.set("url",photoUrl);
  const response=await worker.fetch(new Request(requestUrl.href),{});
  assert.equal(response.status,200,"public TikTok Photo Mode should return its available gallery images through the AllOrigins/Jina relay");
  const data=await response.json();
  assert.equal(data.ok,true);
  assert.equal(data.platform,"tiktok");
  assert.equal(data.images.length,2,"real CDN images must be extracted while blob placeholders are ignored");
  assert.deepEqual(data.images.map(item=>item.url),images);
  assert.equal(relayCalls,1,"the independent AllOrigins relay should be attempted first");
  assert.equal(readerCalls,0,"direct Jina should not be called when the relay succeeds");
  assert.ok(firstRelayTarget.includes("https://r.jina.ai/https://www.tiktok.com/embed/v2/"),"the relay must fetch the verified Jina HTTPS Markdown endpoint");
  assert.ok(data.images.every(item=>item.previewUrl.includes("/api/social-image-file")));
  assert.ok(data.images.every(item=>item.downloadUrl.includes("/api/social-image-file")));

  failRelay=true;
  const fallbackUrl=new URL("https://aryanzz.example/api/image/extract");
  fallbackUrl.searchParams.set("url",photoUrl);
  const fallbackResponse=await worker.fetch(new Request(fallbackUrl.href),{});
  assert.equal(fallbackResponse.status,200,"direct Jina HTTPS must remain available when the independent relay is unavailable");
  const fallbackData=await fallbackResponse.json();
  assert.equal(fallbackData.images.length,2);
  assert.equal(readerCalls,1,"direct Jina should be used exactly once after relay failure");
  assert.ok(firstReaderUrl.includes("/https://www.tiktok.com/embed/v2/"),"the verified HTTPS reader route should be used before the HTTP variant");
  assert.equal(readerHeaders.get("x-return-format"),null,"Jina must not be forced into HTML mode, which hides the Markdown image URLs");
  assert.match(readerHeaders.get("accept")||"",/text\/markdown/i);
  console.log("ARYANZZ TikTok Photo Mode relay, direct-reader fallback, gallery extraction and image-proxy URL regression passed.");
}finally{
  globalThis.fetch=originalFetch;
}
