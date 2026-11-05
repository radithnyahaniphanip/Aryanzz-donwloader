import assert from "node:assert/strict";
import worker from "../src/index.js";

const originalFetch=globalThis.fetch;
const photoUrl="https://www.tiktok.com/@aryanzz-test/photo/1234567890123456789";
const imageUrl="https://p16-common-sign.tiktokcdn-us.com/tos-alisg-i-photomode-sg/aryanzz-test~tplv-photomode-image.jpeg?x=1";
const imageBytes=Uint8Array.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01]);
const state={imagePostInfo:{displayImages:[{height:1200,width:900,urlList:[imageUrl]}]}};
const jinaHtml='<html><script id="__FRONTITY_CONNECT_STATE__" type="application/json">'+JSON.stringify(state)+'</script></html>';
const calls=[];
try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    calls.push({host:url.hostname,path:url.pathname,headers:init.headers||{}});
    if(url.hostname==="www.tiktok.com"&&url.pathname==="/embed/v2/1234567890123456789")
      return new Response("ratelimit triggered",{status:429,headers:{"content-type":"text/plain"}});
    if(url.hostname==="www.tiktok.com"&&url.pathname==="/api/item/detail/")
      return new Response(JSON.stringify({statusCode:10216}),{status:403,headers:{"content-type":"application/json"}});
    if(url.hostname.endsWith("tiktokv.com")&&url.pathname.includes("/aweme/v1/aweme/detail/"))
      return new Response(JSON.stringify({status_code:10216}),{status:403,headers:{"content-type":"application/json"}});
    if(url.hostname==="r.jina.ai"&&url.pathname.startsWith("/http://www.tiktok.com/embed/v2/"))
      return new Response("rate limited",{status:429,headers:{"content-type":"text/plain"}});
    if(url.hostname==="r.jina.ai"&&url.pathname.startsWith("/https://www.tiktok.com/embed/v2/"))
      return new Response(jinaHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
    if(url.hostname==="api.allorigins.win"||url.hostname==="api.codetabs.com"||url.hostname==="corsproxy.io")
      return new Response("provider unavailable",{status:503,headers:{"content-type":"text/plain"}});
    if(url.hostname==="p16-common-sign.tiktokcdn-us.com")
      return new Response(imageBytes,{status:200,headers:{"content-type":"image/jpeg","content-length":String(imageBytes.length)}});
    return new Response("provider unavailable",{status:503,headers:{"content-type":"text/plain"}});
  };
  const response=await worker.fetch(new Request("https://aryanzz.example/api/image/extract?url="+encodeURIComponent(photoUrl),{
    headers:{"cf-connecting-ip":"192.0.2.240"}
  }),{});
  assert.equal(response.status,200,"TikTok Photo Mode should recover from a rate-limited HTTP Jina reader");
  const result=await response.json();
  assert.equal(result.ok,true);
  assert.equal(result.platform,"tiktok");
  assert.equal(result.images.length,1,"the public reader gallery should produce one verified image candidate");
  assert.match(result.images[0].url,/photomode-image\.jpeg/);
  const previewUrl=new URL(result.images[0].previewUrl);
  assert.equal(previewUrl.pathname,"/api/social-image-file");
  const preview=await worker.fetch(new Request(previewUrl.href,{headers:{"cf-connecting-ip":"192.0.2.240"}}),{});
  assert.equal(preview.status,200,"the recovered gallery image must pass through the ARYANZZ preview proxy");
  assert.equal(preview.headers.get("content-type"),"image/jpeg");
  const downloadUrl=new URL(result.images[0].downloadUrl);
  assert.equal(downloadUrl.pathname,"/api/social-image-file");
  const download=await worker.fetch(new Request(downloadUrl.href,{headers:{"cf-connecting-ip":"192.0.2.240"}}),{});
  assert.equal(download.status,200,"the recovered gallery image must be downloadable");
  assert.match(download.headers.get("content-disposition")||"",/^attachment/i);
  assert.ok(calls.some(call=>call.host==="r.jina.ai"&&call.path.startsWith("/https://www.tiktok.com/embed/v2/")),"the HTTPS Jina fallback should be attempted after the HTTP reader is rate-limited");
  console.log("ARYANZZ V95 TikTok Photo Mode HTTPS reader fallback, preview proxy and image download tests passed.");
}finally{
  globalThis.fetch=originalFetch;
}
