import assert from "node:assert/strict";
import worker from "../src/index.js";

const base="https://aryanzz.example";
const videoPost="https://www.threads.com/@testuser/post/VideoExample";
const imagePost="https://www.threads.com/@testuser/post/ImageExample";
const sourceUrls={
  "_hmjQ-mLv":videoPost,
  "BBbOsV3Lue":imagePost
};
const mediaVideo="https://scontent.cdninstagram.com/media/clip.mp4";
const mediaImage="https://cdn.example/media/photo.jpg";
const seen=[];
const originalFetch=globalThis.fetch;

globalThis.fetch=async(input,init={})=>{
  const uri=new URL(typeof input==="string"?input:input?.url||String(input));
  const headers=new Headers(init.headers||{});
  seen.push({url:uri.href,ua:headers.get("user-agent")||""});
  if(uri.hostname==="btch-downloader-api-green.vercel.app"){
    // Explicitly simulate an empty/failed generic provider response.
    return new Response(JSON.stringify({success:false,error:"No media"}),{status:502,headers:{"content-type":"application/json"}});
  }
  if(uri.hostname==="www.threads.com"){
    if(uri.pathname.startsWith("/share/")){
      const destination=sourceUrls[uri.pathname.split("/")[2]];
      if(!destination)return new Response("Not found",{status:404});
      return new Response(null,{status:302,headers:{location:destination}});
    }
    if(uri.pathname.startsWith("/@testuser/post/")){
      const embed=uri.pathname.includes("/embed/");
      const html=embed
        ?uri.pathname.includes("VideoExample")
          ?'<html><head><title>Video post</title></head><body><script type="application/json">{"video_versions":[{"url":"'+mediaVideo+'","width":1280,"height":720}]}</script></body></html>'
          :'<html><head><title>Photo post</title><meta property="og:image" content="'+mediaImage+'"></head><body></body></html>'
        :'<html><head><title>Threads app shell</title><link rel="canonical" href="'+uri.href+'"></head><body>Client-side app</body></html>';
      return new Response(html,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
    }
  }
  throw Error("Unexpected upstream URL: "+uri.href);
};

const platformInfo=async url=>{
  const response=await worker.fetch(new Request(base+"/api/platform/info",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({url,expectedPlatform:"threads",fast:true})
  }),{});
  return {response,data:await response.json()};
};

try{
  // This endpoint must succeed without calling the free media provider at all.
  const directEndpoint=new URL(base+"/api/threads/direct");
  directEndpoint.searchParams.set("url","https://www.threads.com/share/_hmjQ-mLv");
  const directResponse=await worker.fetch(new Request(directEndpoint),{});
  const directData=await directResponse.json();
  assert.equal(directResponse.status,200,JSON.stringify(directData));
  assert.ok(directData.formats?.some(item=>item.mode==="video"&&item.downloadUrl),"Independent Threads route must provide MP4");
  assert.match(directData.providerName,/Threads direct public media/);
  assert.equal(directData.canonicalUrl,videoPost);
  const forbidden=new URL(base+"/api/threads/direct");
  forbidden.searchParams.set("url","https://www.threads.com.attacker.invalid/share/_hmjQ-mLv");
  const refused=await worker.fetch(new Request(forbidden),{});
  assert.equal(refused.status,400,"Direct endpoint must reject host lookalikes");
  const video=await platformInfo("https://www.threads.com/share/_hmjQ-mLv");
  assert.equal(video.response.status,200,JSON.stringify(video.data));
  assert.ok(video.data.formats?.some(item=>item.mode==="video"&&item.downloadUrl),JSON.stringify(video.data));
  assert.match(video.data.providerName,/Threads public embed fallback/);
  assert.equal(video.data.canonicalUrl,videoPost);
  assert.ok(seen.some(item=>item.url===videoPost+"/embed/"&&item.ua.includes("facebookexternalhit")),"Native crawler must inspect the exact embedded post");

  const imageApi=new URL(base+"/api/image/extract");
  imageApi.searchParams.set("url","https://www.threads.com/share/BBbOsV3Lue");
  const photoResponse=await worker.fetch(new Request(imageApi),{});
  const photo=await photoResponse.json();
  assert.equal(photoResponse.status,200,JSON.stringify(photo));
  assert.equal(photo.platform,"threads");
  assert.ok(photo.images?.some(item=>item.downloadUrl&&item.previewUrl),JSON.stringify(photo));
  assert.ok(seen.some(item=>item.url===imagePost+"/embed/"&&item.ua.includes("facebookexternalhit")),"Photo gallery must be read from public embed");

  const notThreads=await platformInfo("https://www.threads.com.attacker.invalid/share/_hmjQ-mLv");
  assert.equal(notThreads.response.status,400,"Lookalike domains must stay rejected");

  console.log("✔ Threads video/photo fallback reads public embeds with safe host validation");
}finally{
  globalThis.fetch=originalFetch;
}
