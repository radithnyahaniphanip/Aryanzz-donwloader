import assert from "node:assert/strict";
import worker from "../src/index.js";

const originalFetch=globalThis.fetch;
const source="https://www.tiktok.com/video/1234567890123456789";
const media="https://cdn.example/clip.mp4";
const mp4=Uint8Array.from([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0,0]);
const mp4Response=(status=200,headers={})=>new Response(mp4,{status,headers:{"content-type":"video/mp4","content-length":String(mp4.byteLength),...headers}});
const buildUrl=probe=>{
  const url=new URL("https://aryanzz.example/api/social-file");
  url.searchParams.set("url",media);
  url.searchParams.set("source",source);
  url.searchParams.set("mode","video");
  url.searchParams.set("ext","mp4");
  url.searchParams.set("filename","probe-regression");
  url.searchParams.set("probe",probe);
  return url.href;
};
const run=async(probe,mock)=>{
  globalThis.fetch=mock;
  try{
    const response=await worker.fetch(new Request(buildUrl(probe)),{});
    const data=await response.json().catch(()=>null);
    return {response,data};
  }finally{globalThis.fetch=originalFetch;}
};

try{
  let fullRange=null;
  const full=await run("full",async(_url,init)=>{
    fullRange=new Headers(init?.headers||{}).get("range");
    return mp4Response();
  });
  assert.equal(full.response.status,200,"probe=full must return a JSON preflight response");
  assert.equal(full.data?.valid,true,"probe=full must validate a complete MP4 response");
  assert.equal(fullRange,null,"probe=full must not send a byte-range header");
  assert.equal(full.data?.rangeSupported,false,"full-response fallback must report that Range was not supported");

  const attempts=[];
  const rangeFallback=await run("1",async(_url,init)=>{
    const headers=new Headers(init?.headers||{});
    const range=headers.get("range");
    const referer=headers.get("referer")||"";
    attempts.push({range,referer});
    if(range)return new Response("range rejected",{status:502,headers:{"content-type":"text/plain"}});
    return mp4Response();
  });
  assert.equal(rangeFallback.response.status,200,"a valid full-response retry must recover a failed Range probe");
  assert.equal(rangeFallback.data?.valid,true,"the full-response retry must validate the MP4 signature");
  assert.ok(attempts.some(item=>item.range),"the test must exercise the initial Range request");
  assert.ok(attempts.some(item=>!item.range),"the test must exercise the no-Range fallback");

  const headerAttempts=[];
  const headerFallback=await run("1",async(_url,init)=>{
    const headers=new Headers(init?.headers||{});
    const referer=headers.get("referer")||"";
    headerAttempts.push(referer);
    if(referer==="https://www.tiktok.com/")return new Response("hotlink blocked",{status:403,headers:{"content-type":"text/plain"}});
    if(referer==="https://cdn.example/")return mp4Response(206,{"content-range":"bytes 0-15/16"});
    return new Response("unexpected header profile",{status:403,headers:{"content-type":"text/plain"}});
  });
  assert.equal(headerFallback.response.status,200,"the alternate CDN referer must recover a blocked source-referer request");
  assert.equal(headerFallback.data?.valid,true,"the alternate header profile must validate the MP4 signature");
  assert.ok(headerAttempts.includes("https://www.tiktok.com/"),"the source-referer profile must be attempted first");
  assert.ok(headerAttempts.includes("https://cdn.example/"),"the CDN-referer fallback profile must be attempted");
  assert.equal(headerAttempts.length,2,"a fast preflight must stop after the two most useful header profiles instead of waiting on the third profile");

  const boundedProfiles=[];
  const boundedFallbackRanges=[];
  const bounded=await run("1",async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    if(url.hostname==="cdn.example"){
      boundedProfiles.push(new Headers(init?.headers||{}).get("referer")||"");
      return new Response("blocked",{status:403,headers:{"content-type":"text/plain"}});
    }
    if(url.hostname==="btch-downloader-api-green.vercel.app"){
      boundedFallbackRanges.push(new Headers(init?.headers||{}).get("range"));
      return new Response("fallback unavailable",{status:502,headers:{"content-type":"text/plain"}});
    }
    throw new Error("Unexpected fast-probe fallback request: "+url.href);
  });
  assert.equal(bounded.response.status,502,"a failed fast preflight must return a bounded error when all public sources reject the request");
  assert.equal(boundedProfiles.length,2,"fast preflight must not wait for the low-value third CDN header profile");
  assert.deepEqual(boundedFallbackRanges,["bytes=0-65535",null],"the public media fallback must try a byte range and then a full response");

  const stalled=await run("1",async()=>{
    return new Response(new ReadableStream({start(){}}),{status:200,headers:{"content-type":"video/mp4"}});
  });
  assert.equal(stalled.response.status,502,"a stalled probe body must fail promptly instead of hanging like a full download");
  assert.match(stalled.data?.error||"",/Stream tidak mengirim data/,"the stalled probe must report its bounded stream timeout");

  console.log("ARYANZZ social media file preflight, bounded fast retries, alternate upstream fallback, and stalled-stream timeout tests passed.");
}finally{
  globalThis.fetch=originalFetch;
}
