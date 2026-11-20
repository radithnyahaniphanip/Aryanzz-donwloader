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
let tikwmCalls=0;
let firstRelayTarget=null;
let firstReaderUrl=null;
let readerHeaders=null;
let failRelay=false;
let failReader=false;
let tikwmMode="empty";

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
      if(failReader)return new Response("rate limited",{status:429});
      return new Response(markdown,{status:200,headers:{"content-type":"text/plain; charset=utf-8"}});
    }
    if(url.hostname==="www.tikwm.com"&&url.pathname==="/api/"){
      tikwmCalls++;
      const data=tikwmMode==="gallery"
        ?{code:0,data:{title:"TikWM Photo Gallery",images}}
        :{code:0,data:{title:"TikWM no gallery",images:[]}};
      return new Response(JSON.stringify(data),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="www.tiktok.com"&&(url.pathname==="/api/item/detail/"||url.pathname==="/api/post/item_list/")){
      return new Response(JSON.stringify({statusCode:10216}),{status:403,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="api16-normal-c-useast1a.tiktokv.com"||url.hostname==="api16-normal-c-alisg.tiktokv.com"){
      return new Response(JSON.stringify({status_code:10216}),{status:403,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="api.codetabs.com")return new Response("proxy unavailable",{status:504});
    if(url.hostname==="corsproxy.io")return new Response(JSON.stringify({error:"proxy unavailable"}),{status:401,headers:{"content-type":"application/json"}});
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
  assert.equal(tikwmCalls,1,"TikWM image fallback should be checked in parallel without entering the video-provider cascade");
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

  failReader=true;
  tikwmMode="gallery";
  const tikwmUrl=new URL("https://aryanzz.example/api/image/extract");
  tikwmUrl.searchParams.set("url",photoUrl);
  const tikwmResponse=await worker.fetch(new Request(tikwmUrl.href),{});
  assert.equal(tikwmResponse.status,200,"TikWM image-only metadata must rescue a public Photo Mode gallery when Jina is rate-limited");
  const tikwmData=await tikwmResponse.json();
  assert.equal(tikwmData.title,"TikWM Photo Gallery");
  assert.equal(tikwmData.images.length,2);
  assert.deepEqual(tikwmData.images.map(item=>item.url),images);
  assert.ok(tikwmData.images.every(item=>item.previewUrl.includes("/api/social-image-file")));
  assert.ok(tikwmData.images.every(item=>item.downloadUrl.includes("/api/social-image-file")));
  assert.equal(tikwmCalls,3,"TikWM should be queried once per Photo Mode extraction attempt");
  console.log("ARYANZZ TikTok Photo Mode relay, direct-reader fallback, TikWM image-only rescue, gallery extraction and image-proxy URL regression passed.");
}finally{
  globalThis.fetch=originalFetch;
}
