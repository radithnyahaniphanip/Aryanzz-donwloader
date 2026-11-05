const workerBase=(process.env.WORKER_URL||"https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/,"");
const shortUrl="https://vt.tiktok.com/ZSpY4TkPP/";
const infoResponse=await fetch(workerBase+"/api/platform/info",{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({url:shortUrl,expectedPlatform:"tiktok"}),cache:"no-store",signal:AbortSignal.timeout(30000)});
const resolvedInfo=await infoResponse.json().catch(()=>({}));
const canonicalUrl=resolvedInfo.canonicalUrl||shortUrl;
const itemId=canonicalUrl.match(/\/(?:video|photo)\/(\d{8,})/i)?.[1]||null;
if(!itemId)throw new Error("TikTok short link tidak menghasilkan ID video/foto. "+String(resolvedInfo.error||""));

const headers={
  accept:"application/json,text/plain,text/html,*/*",
  "accept-language":"en-US,en;q=0.9,id;q=0.8",
  "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  referer:"https://www.tiktok.com/"
};
function summarizeJson(payload){
  const item=payload?.itemInfo?.itemStruct||payload?.item_info?.item_struct||payload?.itemStruct||payload?.item||null;
  const imagePost=item?.imagePost||item?.image_post||item?.photoPost||item?.photo_post||null;
  const images=Array.isArray(imagePost?.images)?imagePost.images:Array.isArray(imagePost?.imageList)?imagePost.imageList:[];
  const first=images[0]||null;
  const firstKeys=first&&typeof first==="object"?Object.keys(first):[];
  const serialized=JSON.stringify(payload||{});
  const urlHosts=[...new Set((serialized.match(/https?:\/\/[^"' \t\r\n]+/g)||[]).map(value=>{try{return new URL(value).hostname}catch{return ""}}).filter(host=>/tiktok|tiktokcdn|byteoversea|ibytedtos|muscdn|akamaized/i.test(host)).slice(0,8))];
  return {topKeys:Object.keys(payload||{}).slice(0,30),statusCode:payload?.statusCode??payload?.status_code??null,hasItem:!!item,itemKeys:item?Object.keys(item).slice(0,40):[],imagePostKeys:imagePost?Object.keys(imagePost).slice(0,30):[],imageCount:images.length,firstImageKeys:firstKeys,firstImagePreview:first?JSON.stringify(first).slice(0,700):null,mentionsImagePost:serialized.includes("imagePost"),mentionsImageURL:serialized.includes("imageURL"),mentionsUrlList:serialized.includes("urlList"),urlHosts};
}
async function probe(name,url,extraHeaders={}){
  const result={name,url:new URL(url).origin+new URL(url).pathname,status:null,contentType:null,corsAllowOrigin:null,corsAllowHeaders:null,finalUrl:null,bytes:0,kind:null,details:null,error:null};
  try{
    const response=await fetch(url,{headers:{...headers,...extraHeaders},redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(18000)});
    result.status=response.status;result.contentType=response.headers.get("content-type");result.corsAllowOrigin=response.headers.get("access-control-allow-origin");result.corsAllowHeaders=response.headers.get("access-control-allow-headers");result.finalUrl=new URL(response.url).origin+new URL(response.url).pathname;
    const text=await response.text();result.bytes=Buffer.byteLength(text);
    if((result.contentType||"").includes("json")||/^[\s]*[\[{]/.test(text)){
      result.kind="json";
      try{result.details=summarizeJson(JSON.parse(text))}catch{result.details={snippet:text.slice(0,700)}}
    }else{
      result.kind="html-or-text";
      const ids=[...text.matchAll(/<script\b[^>]*\bid=["']([^"']+)["']/gi)].map(m=>m[1]).slice(0,25);
      const urls=[...new Set((text.match(/https?:\/\/[^"' \t\r\n<>]+/g)||[]).map(value=>{try{return new URL(value).hostname}catch{return ""}}).filter(x=>/tiktok|tiktokcdn|byteoversea|ibytedtos|muscdn|akamaized/i.test(x)))].slice(0,10);
      const excerptAt=pattern=>{const index=text.search(pattern);return index<0?null:text.slice(Math.max(0,index-350),Math.min(text.length,index+1100)).replace(/\s+/g," ").slice(0,1450)};
      const stateMatch=text.match(/<script\b[^>]*id=["']__FRONTITY_CONNECT_STATE__["'][^>]*>([\s\S]*?)<\/script>/i);
      const stateBody=stateMatch?.[1]||"";
      const statePreview=stateBody?{length:stateBody.length,start:stateBody.slice(0,450),imagePostAt:stateBody.search(/imagePost|image_post|photoPost|photo_post/i),imageURLAt:stateBody.search(/imageURL|imageUrl|urlList/i)}:null;
      result.details={title:text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0,180)||null,scriptIds:ids,hasImagePost:/imagePost|image_post|photoPost|photo_post/i.test(text),hasImageURL:/imageURL|imageUrl|urlList/i.test(text),hasUniversalData:text.includes("__UNIVERSAL_DATA_FOR_REHYDRATION__"),hasSigiState:text.includes("SIGI_STATE"),hasCaptcha:/captcha|verify to continue|access denied/i.test(text),urlHosts:urls,statePreview,imagePostExcerpt:excerptAt(/imagePost|image_post|photoPost|photo_post/i),imageURLExcerpt:excerptAt(/imageURL|imageUrl|urlList/i),urlHosts:urls,snippet:text.slice(0,350).replace(/\s+/g," ")};
    }
  }catch(error){result.error=String(error?.message||error).slice(0,200)}
  console.log("[TIKTOK-PHOTO-ENDPOINT] "+JSON.stringify(result));
}
if(!itemId)throw new Error("TikTok item ID tidak ditemukan untuk Photo Mode.");
try{
  const extractUrl=new URL("/api/image/extract",workerBase);
  extractUrl.searchParams.set("url",canonicalUrl);
  const extractResponse=await fetch(extractUrl.href,{cache:"no-store",headers:{accept:"application/json"},signal:AbortSignal.timeout(30000)});
  const extractData=await extractResponse.json().catch(()=>({}));
  console.log("[TIKTOK-PHOTO-WORKER-IMAGE-EXTRACT] "+JSON.stringify({
    status:extractResponse.status,
    ok:extractData.ok===true,
    imageCount:Array.isArray(extractData.images)?extractData.images.length:0,
    firstPreview:extractData.images?.[0]?.previewUrl||null,
    firstDownload:extractData.images?.[0]?.downloadUrl||null,
    error:extractData.error||null,
    diagnostics:extractData.diagnostics||null
  }));
}catch(error){
  console.log("[TIKTOK-PHOTO-WORKER-IMAGE-EXTRACT] "+JSON.stringify({error:String(error?.message||error).slice(0,240)}));
}

const apiBase=new URL("https://www.tiktok.com/api/item/detail/");
const variants=[
  ["minimal",new URLSearchParams({itemId,aid:"1988",app_name:"tiktok_web",device_platform:"web_pc"})],
  ["full-web",new URLSearchParams({itemId,aid:"1988",app_name:"tiktok_web",device_platform:"web_pc",region:"US",os:"windows",browser_language:"en",browser_platform:"Win32",browser_name:"Mozilla",browser_version:"5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",timezone_name:"Asia/Jakarta",priority_region:"US",from_page:"video",cookie_enabled:"true",screen_width:"1920",screen_height:"1080",browser_online:"true"})]
];
for(const [name,params] of variants){const url=new URL(apiBase);url.search=params.toString();await probe("item-detail-"+name,url.href,{"referer":canonicalUrl});}
const postList=new URL("https://www.tiktok.com/api/post/item_list/");
postList.search=new URLSearchParams({aid:"1988",app_name:"tiktok_web",itemId,count:"1"}).toString();
await probe("post-item-list",postList.href,{"referer":canonicalUrl});
await probe("oembed", "https://www.tiktok.com/oembed?url="+encodeURIComponent(canonicalUrl));
await probe("photo-page",canonicalUrl,{"referer":"https://www.tiktok.com/"});
await probe("embed-v2","https://www.tiktok.com/embed/v2/"+itemId);
await probe("jina-embed-v2-http","https://r.jina.ai/http://www.tiktok.com/embed/v2/"+itemId);
await probe("jina-embed-v2-https","https://r.jina.ai/https://www.tiktok.com/embed/v2/"+itemId);
await probe("jina-embed-v2-html","https://r.jina.ai/http://www.tiktok.com/embed/v2/"+itemId,{"x-return-format":"html"});
await probe("allorigins-embed","https://api.allorigins.win/raw?url="+encodeURIComponent("https://www.tiktok.com/embed/v2/"+itemId));
await probe("codetabs-embed","https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent("https://www.tiktok.com/embed/v2/"+itemId));
await probe("corsproxy-embed","https://corsproxy.io/?url="+encodeURIComponent("https://www.tiktok.com/embed/v2/"+itemId));
try{
  const jinaUrl="https://r.jina.ai/http://www.tiktok.com/embed/v2/"+itemId;
  const jinaResponse=await fetch(jinaUrl,{headers:{...headers,"x-return-format":"html"},redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(18000)});
  const jinaText=await jinaResponse.text();
  const candidateUrls=[...jinaText.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)].map(match=>match[0].replace(/[),.;\]}]+$/g,""));
  const photoUrl=candidateUrls.find(value=>{
    try{
      const u=new URL(value);
      return /tiktokcdn|byteoversea|ibytedtos|muscdn/i.test(u.hostname)&&/photomode/i.test(u.pathname)&&/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(u.href);
    }catch{return false}
  });
  let proxyResult=null;
  if(photoUrl){
    const proxyUrl=new URL("/api/social-image-file",workerBase);
    proxyUrl.searchParams.set("url",photoUrl);
    proxyUrl.searchParams.set("source",canonicalUrl);
    proxyUrl.searchParams.set("filename","aryanzz-photo-diagnostic.jpg");
    const imageResponse=await fetch(proxyUrl.href,{headers:{accept:"image/*"},cache:"no-store",signal:AbortSignal.timeout(22000)});
    const reader=imageResponse.body?.getReader();
    let first=null;
    if(reader){
      const chunk=await reader.read();
      first=chunk.value||null;
      await reader.cancel().catch(()=>{});
    }
    const signature=!!(first&&((first[0]===0xff&&first[1]===0xd8&&first[2]===0xff)||(first[0]===0x89&&first[1]===0x50&&first[2]===0x4e&&first[3]===0x47)||(first[0]===0x47&&first[1]===0x49&&first[2]===0x46)||(first[0]===0x52&&first[1]===0x49&&first[2]===0x46&&first[8]===0x57&&first[9]===0x45&&first[10]===0x42&&first[11]===0x50)));
    proxyResult={status:imageResponse.status,mime:imageResponse.headers.get("content-type"),firstChunkBytes:first?.byteLength||0,validImageSignature:signature};
  }
  console.log("[TIKTOK-PHOTO-CLIENT-READER-PROBE] "+JSON.stringify({status:jinaResponse.status,corsAllowOrigin:jinaResponse.headers.get("access-control-allow-origin"),contentType:jinaResponse.headers.get("content-type"),bytes:Buffer.byteLength(jinaText),photomodeUrlCount:candidateUrls.filter(value=>/photomode/i.test(value)).length,photoUrl:photoUrl||null,workerImageProxy:proxyResult}));
}catch(error){
  console.log("[TIKTOK-PHOTO-CLIENT-READER-PROBE] "+JSON.stringify({error:String(error?.message||error).slice(0,220)}));
}
await probe("official-player","https://www.tiktok.com/player/v1/"+itemId+"?controls=1&timestamp=1&description=1&music_info=1&rel=0");
await probe("short-link",shortUrl);
console.log("[TIKTOK-PHOTO-RESOLUTION] "+JSON.stringify({shortUrl,canonicalUrl,itemId,infoStatus:infoResponse.status,providerName:resolvedInfo.providerName||null,embedUrl:resolvedInfo.embedUrl||null}));
