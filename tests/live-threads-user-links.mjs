const origin=(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/$/,"");
const examples=[
  {kind:"video",url:"https://www.threads.com/share/_hmjQ-mLv"},
  {kind:"image",url:"https://www.threads.com/share/BBbOsV3Lue"}
];
const report={test:"actual user-supplied Threads public URLs",date:new Date().toISOString(),items:[]};
const request=async(url,options={})=>fetch(url,{cache:"no-store",signal:AbortSignal.timeout(65000),...options});
let success=true;
for(const test of examples){
  const item={kind:test.kind,url:test.url,ok:false,status:null,provider:null,canonical:null,mediaCount:0,probeStatus:null,probeValid:false,error:null};
  report.items.push(item);
  try{
    if(test.kind==="video"){
      const response=await request(origin+"/api/platform/info",{
        method:"POST",
        headers:{"content-type":"application/json","accept":"application/json"},
        body:JSON.stringify({url:test.url,expectedPlatform:"threads",fast:false})
      });
      item.status=response.status;
      const data=await response.json().catch(()=>({}));
      item.provider=data.providerName||data.provider||null;
      item.canonical=data.canonicalUrl||null;
      item.error=data.error||null;
      item.mediaCount=Array.isArray(data.formats)?data.formats.filter(v=>v.mode==="video"&&v.downloadUrl).length:0;
      const candidate=data.formats?.find(v=>v.mode==="video"&&v.downloadUrl);
      if(candidate){
        const file=new URL(candidate.downloadUrl,origin);
        if(file.origin!==origin||file.pathname!=="/api/social-file")throw Error("Video download URL is not the ARYANZZ verified media proxy");
        file.searchParams.set("probe","1");
        const probe=await request(file.href);
        item.probeStatus=probe.status;
        const result=await probe.json().catch(()=>({}));
        item.probeValid=probe.ok&&result.valid===true;
      }
      item.ok=response.ok&&item.mediaCount>0&&item.probeValid;
    }else{
      const url=new URL(origin+"/api/image/extract");
      url.searchParams.set("url",test.url);
      const response=await request(url.href);
      item.status=response.status;
      const data=await response.json().catch(()=>({}));
      item.provider=data.providerName||data.provider||null;
      item.canonical=data.sourceUrl||null;
      item.error=data.error||null;
      item.mediaCount=Array.isArray(data.images)?data.images.length:0;
      const first=data.images?.find(v=>v.previewUrl);
      if(first){
        const preview=new URL(first.previewUrl,origin);
        if(preview.origin!==origin||preview.pathname!=="/api/social-image-file")throw Error("Image preview URL is not ARYANZZ proxy");
        const img=await request(preview.href);
        item.probeStatus=img.status;
        item.probeValid=img.ok&&String(img.headers.get("content-type")||"").startsWith("image/");
        await img.body?.cancel().catch(()=>{});
      }
      item.ok=response.ok&&item.mediaCount>0&&item.probeValid;
    }
  }catch(error){item.error=String(error?.message||error).slice(0,240)}
  if(!item.ok)success=false;
}
report.ok=success;
console.log(JSON.stringify(report,null,2));
if(!success)process.exitCode=1;
