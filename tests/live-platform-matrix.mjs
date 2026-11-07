import { writeFileSync } from "node:fs";
import { PLATFORM_CATALOG } from "../src/platform-catalog.js";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/$/,"");
const dedicated=PLATFORM_CATALOG.filter(platform=>platform.providerKey!=="aio");
const imagePlatforms=dedicated.filter(platform=>!platform.aliasOf&&platform.mediaModes?.includes("image"));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sampleLinks={tiktok:"https://vt.tiktok.com/ZSgEFBrCq/",snackvideo:"https://s.snackvideo.com/p/ztwycdXp"};

async function probeImage(rawUrl){
  const url=new URL(rawUrl,base);
  if(url.origin!==new URL(base).origin)throw new Error("Image URL tidak berasal dari Worker ARYANZZ.");
  const response=await fetch(url.href,{headers:{accept:"image/*"},cache:"no-store",signal:AbortSignal.timeout(18000)});
  const mime=String(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
  const disposition=String(response.headers.get("content-disposition")||"");
  const reader=response.body?.getReader();
  let first=null;
  if(reader){
    try{const part=await reader.read();first=part.value||null}
    finally{await reader.cancel().catch(()=>{})}
  }
  const bytes=first||new Uint8Array();
  const signatureValid=
    (bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)||
    (bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)||
    (bytes[0]===0x47&&bytes[1]===0x49&&bytes[2]===0x46)||
    (bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50)||
    (bytes[0]===0x42&&bytes[1]===0x4d)||
    (bytes[4]===0x66&&bytes[5]===0x74&&bytes[6]===0x79&&bytes[7]===0x70&&(/avif|avis/.test(String.fromCharCode(...bytes.slice(8,16)).toLowerCase())));
  return {status:response.status,mime,disposition,firstChunkBytes:bytes.byteLength,signatureValid};
}

const rows=dedicated.map(platform=>({
  platform:platform.id,
  providerKey:platform.providerKey,
  aliasOf:platform.aliasOf||null,
  mediaModes:platform.mediaModes||[],
  searchMode:platform.mediaModes?.includes("video")?"video":"audio",
  searchStatus:"not-run",
  searchResults:0,
  sourceUrl:null,
  extractStatus:"not-run",
  extractFormats:0,
  extractDuration:null,
  extractor:null,
  providerDiagnostics:null,
  imageSearchStatus:"not-run",
  imageResults:0,
  imagePreview:null,
  imageDownload:null,
  imageDownloadReady:false,
  detail:""
}));

for(const row of rows){
  const platform=PLATFORM_CATALOG.find(item=>item.id===row.platform);
  try{
    const search=await fetch(base+"/api/social/search",{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify({platform:row.platform,query:"Tabola Bale",mediaType:row.searchMode}),
      cache:"no-store",
      signal:AbortSignal.timeout(25000)
    });
    const data=await search.json().catch(()=>({}));
    row.searchStatus=search.ok?"ok":"http-"+search.status;
    row.searchResults=Array.isArray(data.results)?data.results.length:0;
    row.providerDiagnostics=data.providerDiagnostics||null;
    if(!search.ok)row.detail=String(data.error||"Title search failed").slice(0,180);
    const candidate=(data.results||[]).find(item=>item?.url&&item.platform)||(sampleLinks[row.platform]?{url:sampleLinks[row.platform],platform:row.platform}:null);
    if(candidate){
      row.sourceUrl=candidate.url;
      try{
        let response;
        if(row.platform==="youtube"){
          const url=new URL("/api/youtube/hybrid/info",base);
          url.searchParams.set("url",candidate.url);
          response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(18000)});
        }else{
          response=await fetch(base+"/api/platform/info",{
            method:"POST",
            headers:{"content-type":"application/json","accept":"application/json"},
            body:JSON.stringify({url:candidate.url,expectedPlatform:row.platform}),
            cache:"no-store",
            signal:AbortSignal.timeout(22000)
          });
        }
        const info=await response.json().catch(()=>({}));
        row.extractStatus=response.ok&&info.ok!==false&&Array.isArray(info.formats)&&info.formats.length>0?"ok":response.ok?"no-media-formats":"http-"+response.status;
        row.extractFormats=Array.isArray(info.formats)?info.formats.length:0;
        row.extractDuration=Number(info.duration)||null;
        row.extractor=info.extractor||info.providerName||null;
        if(!response.ok||info.ok===false)row.detail=(row.detail?row.detail+" | ":"")+String(info.error||"Link extraction did not return media").slice(0,180);
      }catch(error){
        row.extractStatus="timeout-or-network";
        row.detail=(row.detail?row.detail+" | ":"")+String(error?.message||error).slice(0,180);
      }
    }else{
      row.extractStatus="no-search-result";
      row.detail=(row.detail?row.detail+" | ":"")+"No public title-search result to use as an extraction sample.";
    }
  }catch(error){
    row.searchStatus="timeout-or-network";
    row.detail=String(error?.message||error).slice(0,180);
  }
  console.log("[PLATFORM-VIDEO-AUDIO] "+JSON.stringify(row));
  await wait(1200);
}

for(const row of rows.filter(item=>imagePlatforms.some(platform=>platform.id===item.platform))){
  try{
    const response=await fetch(base+"/api/image/search",{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify({platform:row.platform,query:"cat meme"}),
      cache:"no-store",
      signal:AbortSignal.timeout(25000)
    });
    const data=await response.json().catch(()=>({}));
    row.imageSearchStatus=response.ok&&data.ok!==false?"ok":"http-"+response.status;
    row.imageResults=Number(data.imageCount)||0;
    const group=(data.results||[]).find(item=>Array.isArray(item.images)&&item.images.length);
    const image=group?.images?.find(item=>item.previewUrl&&item.downloadUrl);
    if(image){
      const [preview,download]=await Promise.all([
        probeImage(image.previewUrl).catch(error=>({error:String(error?.message||error).slice(0,160)})),
        probeImage(image.downloadUrl).catch(error=>({error:String(error?.message||error).slice(0,160)}))
      ]);
      row.imagePreview=preview;
      row.imageDownload=download;
      row.imageDownloadReady=preview.status===200&&preview.mime?.startsWith("image/")&&preview.signatureValid===true&&download.status===200&&download.mime?.startsWith("image/")&&download.signatureValid===true&&/attachment/i.test(download.disposition||"");
    }
    if(!response.ok||data.ok===false)row.detail=(row.detail?row.detail+" | ":"")+String(data.error||"Image search failed").slice(0,180);
  }catch(error){
    row.imageSearchStatus="timeout-or-network";
    row.detail=(row.detail?row.detail+" | ":"")+String(error?.message||error).slice(0,180);
  }
  console.log("[PLATFORM-IMAGE] "+JSON.stringify({platform:row.platform,providerKey:row.providerKey,imageSearchStatus:row.imageSearchStatus,imageResults:row.imageResults,imagePreview:row.imagePreview,imageDownload:row.imageDownload,imageDownloadReady:row.imageDownloadReady,detail:row.detail}));
  await wait(800);
}

const summary={
  generatedAt:new Date().toISOString(),
  catalogPlatformCount:PLATFORM_CATALOG.length,
  dedicatedPlatformCount:dedicated.length,
  imagePlatformCount:imagePlatforms.length,
  titleSearchOk:rows.filter(row=>row.searchStatus==="ok").length,
  titleSearchWithResults:rows.filter(row=>row.searchResults>0).length,
  mediaExtractionOk:rows.filter(row=>row.extractStatus==="ok").length,
  imageSearchOk:rows.filter(row=>row.imageSearchStatus==="ok").length,
  imageSearchWithResults:rows.filter(row=>row.imageResults>0).length,
  imageDownloadReady:rows.filter(row=>row.imageDownloadReady).length,
  rows
};
writeFileSync("platform-matrix.json",JSON.stringify(summary,null,2)+"\n");
console.log("[PLATFORM-MATRIX-SUMMARY] "+JSON.stringify({
  catalogPlatformCount:summary.catalogPlatformCount,
  dedicatedPlatformCount:summary.dedicatedPlatformCount,
  imagePlatformCount:summary.imagePlatformCount,
  titleSearchOk:summary.titleSearchOk,
  titleSearchWithResults:summary.titleSearchWithResults,
  mediaExtractionOk:summary.mediaExtractionOk,
  imageSearchOk:summary.imageSearchOk,
  imageSearchWithResults:summary.imageSearchWithResults,
  imageDownloadReady:summary.imageDownloadReady
}));
