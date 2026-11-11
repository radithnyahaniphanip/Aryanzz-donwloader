import assert from "node:assert/strict";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/$/,"");
async function search(platform,query){
  const response=await fetch(base+"/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({query,platform,mediaType:"video"}),
    cache:"no-store",
    signal:AbortSignal.timeout(75000)
  });
  const data=await response.json().catch(()=>({}));
  const results=Array.isArray(data?.results)?data.results:[];
  console.log(JSON.stringify({
    platform,query,httpStatus:response.status,ok:data?.ok,
    providerDiagnostics:data?.providerDiagnostics||null,
    candidateCount:data?.candidateCount||0,
    returnedPublicResults:results.length,
    verifiedCount:results.filter(item=>item.verified===true&&item.downloadable===true).length,
    searchOnlyCount:results.filter(item=>item.searchOnly===true).length,
    sources:[...new Set(results.map(item=>item.platform).filter(Boolean))],
    sample:results.slice(0,8).map(item=>({title:item.title,platform:item.platform,searchProvider:item.searchProvider||item.provider,verified:item.verified===true,searchOnly:item.searchOnly===true,url:item.url}))
  },null,2));
  assert.equal(response.status,200,platform+" title search must return HTTP 200");
  assert.equal(data?.ok,true,platform+" title search must return ok=true");
  return results;
}

const youtube=await search("youtube","Tabola Bale");
assert.ok(youtube.some(item=>item.platform==="youtube"&&/tabola bale/i.test(String(item.title||""))),
  "Live YouTube title search did not return a Tabola Bale result from YouTube.");

const all=await search("all","Tabola Bale");
assert.ok(all.some(item=>item.platform==="youtube"&&/tabola bale/i.test(String(item.title||""))),
  "Live all-platform search did not include YouTube's Tabola Bale results.");

console.log("ARYANZZ live title-search diagnostics passed: YouTube and all-platform searches returned in-app Tabola Bale results.");
