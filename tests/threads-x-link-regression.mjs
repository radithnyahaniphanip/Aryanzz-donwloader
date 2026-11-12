import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { PLATFORM_CATALOG, platformForHost } from "../src/platform-catalog.js";

assert.equal(PLATFORM_CATALOG.length,200,"V1 must preserve all 200 catalogue entries");
for(const domain of ["threads.com","www.threads.com","threads.net","www.threads.net"]){
  assert.equal(platformForHost(domain)?.id,"threads","Threads domain was not recognized: "+domain);
}
assert.equal(platformForHost("x.com")?.id,"x");
assert.equal(platformForHost("twitter.com")?.id,"x");
assert.equal(platformForHost("fake-threads.com"),null,"Lookalike domains must not be accepted");
const client=readFileSync(new URL("../public/downloader.js",import.meta.url),"utf8");
assert.ok(client.includes('["threads.com","Threads"]'),"Client must recognize Threads .com");
assert.ok(client.includes('slowSocialSource?(fast?28000:41000)'),"Social download timeout must cover backend fallback");
assert.ok(client.includes('imageCheckTimeout=slowSocialSource?'),"Photo timeout must cover share-link resolution");

const originalFetch=globalThis.fetch;
const shares={
  "_hmjQ-mLv":"https://www.threads.com/@sample/post/VideoExample",
  "BBbOsV3Lue":"https://www.threads.com/@sample/post/ImageExample"
};
const xUrls=[
  "https://x.com/InFiniteH0riZ0n/status/2120550563897372815",
  "https://x.com/Truthmind2/status/2120672053959577763",
  "https://x.com/whale1mm/status/2120725848814940306"
];
const requests=[];
const videoUrl="https://cdn.example/test-video.mp4";
const imageUrl="https://cdn.example/test-image.jpg";
globalThis.fetch=async(input)=>{
  const u=new URL(typeof input==="string"?input:input?.url||input?.href||String(input));
  requests.push(u.href);
  if(u.hostname==="www.threads.com"&&u.pathname.startsWith("/share/")){
    const dest=shares[u.pathname.split("/")[2]];
    if(!dest)return new Response("Not found",{status:404});
    return new Response(null,{status:302,headers:{location:dest}});
  }
  if(u.hostname==="www.threads.com"&&u.pathname.startsWith("/@sample/post/")){
    const isImage=u.pathname.includes("ImageExample");
    const html='<html><head><title>Threads test post</title><link rel="canonical" href="'+u.href+'">'+(isImage?'<meta property="og:image" content="'+imageUrl+'">':'<meta property="og:video" content="'+videoUrl+'">')+'</head><body></body></html>';
    return new Response(html,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  }
  if(u.hostname==="btch-downloader-api-green.vercel.app"){
    const url=u.searchParams.get("url")||"";
    const isImage=url.includes("ImageExample");
    const isTwitter=u.pathname.endsWith("/twitter");
    return new Response(JSON.stringify({success:true,normalized:{title:isTwitter?"X video test":"Threads test post",media:isImage?[]:[{type:"video",kind:"video",label:"Video MP4",url:videoUrl,ext:"mp4",mimeType:"video/mp4",height:720}],images:isImage?[imageUrl]:[]}}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(u.hostname==="x.com")return new Response('<html><title>X video</title></html>',{status:200,headers:{"content-type":"text/html"}});
  throw Error("Unexpected external fetch: "+u.href);
};
const post=async(url,expectedPlatform)=>worker.fetch(new Request("https://aryanzz.example/api/platform/info",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({url,expectedPlatform,fast:true})
}),{});
try{
  const threadsVideo=await post("https://www.threads.com/share/_hmjQ-mLv","threads");
  const video=await threadsVideo.json();
  assert.equal(threadsVideo.status,200,"Threads share video should reach valid provider: "+JSON.stringify(video));
  assert.ok(video.formats?.some(item=>item.mode==="video"),"Threads resolved video lacks a format");
  assert.ok(requests.some(value=>value.includes("threads.com%2F%40sample%2Fpost%2FVideoExample")),"Threads must resolve share before provider lookup");

  const imageRequest=new URL("https://aryanzz.example/api/image/extract");
  imageRequest.searchParams.set("url","https://www.threads.com/share/BBbOsV3Lue");
  const photoResponse=await worker.fetch(new Request(imageRequest),{});
  const photo=await photoResponse.json();
  assert.equal(photoResponse.status,200,"Threads image share extraction failed: "+JSON.stringify(photo));
  assert.ok(photo.images?.some(item=>item.downloadUrl),"Threads image post should have image download URLs");
  assert.equal(photo.platform,"threads");
  for(const source of xUrls){
    const xResponse=await post(source,"x");
    const data=await xResponse.json();
    assert.equal(xResponse.status,200,"X provider rejected an ordinary status URL: "+JSON.stringify(data));
    assert.ok(data.formats?.some(item=>item.mode==="video"),"X test provider response lacks video");
  }
  const spoof=await post("https://www.threads.com.attacker.example/share/_hmjQ-mLv","threads");
  assert.equal(spoof.status,400,"Spoofed Threads host must be rejected");
  console.log("✔ Threads .com/.net, share URL video/photo routing, X status URLs, and hostname safety passed");
} finally{
  globalThis.fetch=originalFetch;
}
