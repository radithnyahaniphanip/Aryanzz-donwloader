import { writeFileSync } from "node:fs";
import { PLATFORM_CATALOG } from "../src/platform-catalog.js";
const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/,"");
const platforms=PLATFORM_CATALOG.filter(platform=>platform.providerKey!=="aio").map(platform=>platform.id);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sampleLinks={tiktok:"https://vt.tiktok.com/ZSgEFBrCq/",snackvideo:"https://s.snackvideo.com/p/ztwycdXp"};
const rows=[];
for(const platform of platforms){
  const row={platform,searchStatus:"not-run",searchResults:0,sourceUrl:null,extractStatus:"not-run",extractFormats:0,extractDuration:null,providerDiagnostics:null,detail:""};
  try{
    const search=await fetch(base+"/api/social/search",{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({platform,query:"Tabola Bale",mediaType:"video"}),cache:"no-store",signal:AbortSignal.timeout(45000)});
    const data=await search.json().catch(()=>({}));
    row.searchStatus=search.ok?"ok":"http-"+search.status;
    row.searchResults=Array.isArray(data.results)?data.results.length:0;
    row.providerDiagnostics=data.providerDiagnostics||null;
    if(!search.ok)row.detail=String(data.error||"Title search failed").slice(0,180);
    const candidate=(data.results||[]).find(item=>item?.url&&item.platform)|| (sampleLinks[platform]?{url:sampleLinks[platform],platform}:null);
    if(candidate){
      row.sourceUrl=candidate.url;
      try{
        let response,info;
        if(platform==="youtube"){
          const u=new URL("/api/youtube/hybrid/info",base);u.searchParams.set("url",candidate.url);
          response=await fetch(u,{cache:"no-store",signal:AbortSignal.timeout(18000)});
        }else{
          response=await fetch(base+"/api/platform/info",{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({url:candidate.url,expectedPlatform:platform}),cache:"no-store",signal:AbortSignal.timeout(18000)});
        }
        info=await response.json().catch(()=>({}));
        row.extractStatus=response.ok&&info.ok!==false&&Array.isArray(info.formats)&&info.formats.length>0?"ok":response.ok?"no-media-formats":"http-"+response.status;
        row.extractFormats=Array.isArray(info.formats)?info.formats.length:0;
        row.extractDuration=Number(info.duration)||null;
        if(!response.ok||info.ok===false)row.detail=(row.detail?row.detail+" | ":"")+String(info.error||"Link extraction did not return media").slice(0,180);
      }catch(error){row.extractStatus="timeout-or-network";row.detail=(row.detail?row.detail+" | ":"")+String(error?.message||error).slice(0,180)}
    }else{
      row.extractStatus="no-search-result";
      row.detail=(row.detail?row.detail+" | ":"")+"No public title-search result to use as an extraction sample.";
    }
  }catch(error){row.searchStatus="timeout-or-network";row.detail=String(error?.message||error).slice(0,180)}
  rows.push(row);
  console.log("[PLATFORM-MATRIX] "+JSON.stringify(row));
  await wait(2200);
}
const summary={generatedAt:new Date().toISOString(),platformCount:platforms.length,titleSearchOk:rows.filter(row=>row.searchStatus==="ok").length,titleSearchWithResults:rows.filter(row=>row.searchResults>0).length,extractionOk:rows.filter(row=>row.extractStatus==="ok").length,rows};
writeFileSync("platform-matrix.json",JSON.stringify(summary,null,2)+"\n");
console.log("[PLATFORM-MATRIX-SUMMARY] "+JSON.stringify({platformCount:summary.platformCount,titleSearchOk:summary.titleSearchOk,titleSearchWithResults:summary.titleSearchWithResults,extractionOk:summary.extractionOk}));
