import assert from "node:assert/strict";
import worker from "../src/index.js";

const originalFetch=globalThis.fetch;
const source="https://www.tiktok.com/video/1234567890123456789";
const media="https://cdn.example/clip.mp4";
const mp4=Uint8Array.from([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0,0]);
const mp4Response=(status=200,headers={})=>new Response(mp4,{status,headers:{"content-type":"video/mp4","content-length":String(mp4.byteLength),...headers}});
const buildUrl=(probe,ext="mp4",mediaUrl="https://cdn.example/clip.mp4")=>{
  const url=new URL("https://aryanzz.example/api/social-file");
  url.searchParams.set("url",mediaUrl);
  url.searchParams.set("source",source);
  url.searchParams.set("mode","video");
  url.searchParams.set("ext",ext);
  url.searchParams.set("filename","probe-regression");
  url.searchParams.set("probe",probe);
  return url.href;
};
const run=async(probe,mock,ext="mp4",mediaUrl="https://cdn.example/clip.mp4")=>{
  globalThis.fetch=mock;
  try{
    const response=await worker.fetch(new Request(buildUrl(probe,ext,mediaUrl)),{});
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

  const probeSignature=async(ext,bytes,expectedMime,expectedExt)=>{
    const body=Uint8Array.from(bytes);
    const result=await run("1",async()=>new Response(body,{status:200,headers:{"content-type":expectedMime,"content-length":String(body.byteLength)}}),ext,"https://cdn.example/sample."+ext);
    assert.equal(result.response.status,200,ext+" source container should pass signature preflight");
    assert.equal(result.data?.valid,true,ext+" source container should be recognized as real video");
    assert.equal(result.data?.extension,expectedExt,ext+" should be reported using its verified container");
    assert.equal(result.data?.mimeType,expectedMime,ext+" should return the correct MIME type");
  };
  await probeSignature("mov",[0,0,0,24,0x66,0x74,0x79,0x70,0x71,0x74,0x20,0x20,0,0,0,0],"video/quicktime","mov");
  await probeSignature("avi",[0x52,0x49,0x46,0x46,0,0,0,0,0x41,0x56,0x49,0x20],"video/x-msvideo","avi");
  await probeSignature("webm",[0x1a,0x45,0xdf,0xa3,0x42,0x82,0x84,0x77,0x65,0x62,0x6d],"video/webm","webm");
  await probeSignature("mkv",[0x1a,0x45,0xdf,0xa3,0x42,0x82,0x88,0x6d,0x61,0x74,0x72,0x6f,0x73,0x6b,0x61],"video/x-matroska","mkv");
  await probeSignature("flv",[0x46,0x4c,0x56,1,1,0,0,0,9,0,0,0,0],"video/x-flv","flv");
  const transportStream=new Uint8Array(377);transportStream[0]=0x47;transportStream[188]=0x47;transportStream[376]=0x47;
  await probeSignature("ts",transportStream,"video/mp2t","ts");
  console.log("ARYANZZ social media file preflight and multi-container signature tests passed.");
}finally{
  globalThis.fetch=originalFetch;
}
