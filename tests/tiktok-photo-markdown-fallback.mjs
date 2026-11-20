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
let corsDevCalls=0;
let corsToolsCalls=0;
let relayCalls=0;
let readerCalls=0;
let tikwmCalls=0;
let corsToolsTarget=null;
let firstRelayTarget=null;
let firstReaderUrl=null;
let readerHeaders=null;
let failCorsDev=false;
let failCorsTools=false;
let failRelay=false;
let failReader=false;
let tikwmMode="empty";

try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    if(url.hostname==="proxy.cors.dev"){
      corsDevCalls++;
      if(failCorsDev)return new Response("cors.dev unavailable",{status:502});
      return new Response(markdown,{status:200,headers:{"content-type":"text/plain; charset=utf-8"}});
    }
    if(url.hostname==="cors.tools"&&url.pathname==="/read"){
      corsToolsCalls++;
      corsToolsTarget=url.searchParams.get("url");
      assert.equal(corsToolsTarget,"https://www.tiktok.com/embed/v2/1234567890123456789");
      assert.equal(url.searchParams.get("render"),"true");
      assert.equal(url.searchParams.get("format"),"markdown");
      if(failCorsTools)return new Response("reader unavailable",{status:502});
      return new Response(markdown,{status:200,headers:{"content-type":"text/plain; charset=utf-8"}});
    }
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

  async function extract(){
    const requestUrl=new URL("https://aryanzz.example/api/image/extract");
    requestUrl.searchParams.set("url",photoUrl);
    return worker.fetch(new Request(requestUrl.href),{});
  }
  function assertGallery(data){
    assert.equal(data.ok,true);
    assert.equal(data.platform,"tiktok");
    assert.equal(data.images.length,2);
    assert.deepEqual(data.images.map(item=>item.url),images);
    assert.ok(data.images.every(item=>item.previewUrl.includes("/api/social-image-file")));
    assert.ok(data.images.every(item=>item.downloadUrl.includes("/api/social-image-file")));
  }

  const corsDevResponse=await extract();
  assert.equal(corsDevResponse.status,200,"public TikTok Photo Mode should use the keyless cors.dev relay first");
  assertGallery(await corsDevResponse.json());
  assert.equal(corsDevCalls,1);
  assert.equal(corsToolsCalls,0);
  assert.equal(relayCalls,0);
  assert.equal(readerCalls,0);
  assert.equal(tikwmCalls,1);

  failCorsDev=true;
  const corsToolsResponse=await extract();
  assert.equal(corsToolsResponse.status,200,"rendered cors.tools should remain available when cors.dev is unavailable");
  assertGallery(await corsToolsResponse.json());
  assert.equal(corsToolsCalls,1);
  assert.equal(corsToolsTarget,"https://www.tiktok.com/embed/v2/1234567890123456789");

  failCorsTools=true;
  const relayResponse=await extract();
  assert.equal(relayResponse.status,200,"AllOrigins/Jina relay should remain available when rendered reader relays are unavailable");
  assertGallery(await relayResponse.json());
  assert.ok(firstRelayTarget.includes("https://r.jina.ai/https://www.tiktok.com/embed/v2/"));

  failRelay=true;
  const directResponse=await extract();
  assert.equal(directResponse.status,200,"direct Jina HTTPS must remain available when independent relays are unavailable");
  assertGallery(await directResponse.json());
  assert.equal(readerCalls,1);
  assert.ok(firstReaderUrl.includes("/https://www.tiktok.com/embed/v2/"));
  assert.equal(readerHeaders.get("x-return-format"),null);
  assert.match(readerHeaders.get("accept")||"",/text\/markdown/i);

  failReader=true;
  tikwmMode="gallery";
  const tikwmResponse=await extract();
  assert.equal(tikwmResponse.status,200,"TikWM image-only metadata must rescue a public Photo Mode gallery when reader services are rate-limited");
  const tikwmData=await tikwmResponse.json();
  assert.equal(tikwmData.title,"TikWM Photo Gallery");
  assertGallery(tikwmData);
  assert.equal(tikwmCalls,5);

  tikwmMode="empty";
  const unavailableResponse=await extract();
  assert.equal(unavailableResponse.status,503,"temporary provider limits must not be mislabeled as a missing public gallery (404)");
  const unavailable=await unavailableResponse.json();
  assert.equal(unavailable.code,"PROVIDER_TEMPORARILY_UNAVAILABLE");
  assert.equal(unavailable.retryable,true);
  assert.ok(unavailable.error.includes("membatasi permintaan"));
  assert.equal(unavailable.sourceUrl,photoUrl);
  assert.equal(tikwmCalls,6);
  console.log("ARYANZZ TikTok Photo Mode layered relays, TikWM fallback and honest retryable provider-outage response regression passed.");
}finally{
  globalThis.fetch=originalFetch;
}
