import assert from "node:assert/strict";
import worker from "../src/index.js";

const originalFetch=globalThis.fetch;
const photoUrl="https://www.tiktok.com/@demo/photo/1234567890123456789";
const images=[
  "https://p16-common-sign.tiktokcdn-us.com/tos-alisg-i-photomode-sg/first~tplv-photomode-image.jpeg?dr=9616&x-expires=1795053600&x-signature=first",
  "https://p16-common-sign.tiktokcdn-us.com/tos-alisg-i-photomode-sg/second~tplv-photomode-image.jpeg?dr=9616&x-expires=1795053600&x-signature=second"
];
let readerCalls=0;
let readerHeaders=null;

try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    if(url.hostname==="r.jina.ai"){
      readerCalls++;
      readerHeaders=new Headers(init.headers||{});
      const markdown=[
        "Title: TikTok Photo Mode",
        "URL Source: https://www.tiktok.com/embed/v2/1234567890123456789",
        "Markdown Content:",
        "![Image 1: img]("+images[0]+")",
        "![Image 2: img]("+images[1]+")",
        "![Image 3: img](blob:http://localhost/placeholder)"
      ].join("\n");
      return new Response(markdown,{status:200,headers:{"content-type":"text/plain; charset=utf-8"}});
    }
    throw new Error("Unexpected mocked fetch: "+url.href);
  };

  const requestUrl=new URL("https://aryanzz.example/api/image/extract");
  requestUrl.searchParams.set("url",photoUrl);
  const response=await worker.fetch(new Request(requestUrl.href),{});
  assert.equal(response.status,200,"public TikTok Photo Mode should return its available gallery images");
  const data=await response.json();
  assert.equal(data.ok,true);
  assert.equal(data.platform,"tiktok");
  assert.equal(data.images.length,2,"real CDN images must be extracted while blob placeholders are ignored");
  assert.deepEqual(data.images.map(item=>item.url),images);
  assert.equal(readerCalls,1,"the Markdown reader should be used without unnecessary retries");
  assert.equal(readerHeaders.get("x-return-format"),null,"Jina must not be forced into HTML mode, which hides the Markdown image URLs");
  assert.match(readerHeaders.get("accept")||"",/text\/markdown/i);
  assert.ok(data.images.every(item=>item.previewUrl.includes("/api/social-image-file")));
  assert.ok(data.images.every(item=>item.downloadUrl.includes("/api/social-image-file")));
  console.log("ARYANZZ TikTok Photo Mode Markdown gallery extraction regression passed.");
}finally{
  globalThis.fetch=originalFetch;
}
