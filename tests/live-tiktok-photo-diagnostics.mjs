const workerBase="https://aryanzz-donwloader.radithnyahaniphanip.workers.dev";
const shortUrl="https://vt.tiktok.com/ZSpYA7VKa/";
const itemId="7692687238634769682";
const canonicalUrl="https://www.tiktok.com/@taechi4.5/photo/"+itemId;
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
  const result={name,url:new URL(url).origin+new URL(url).pathname,status:null,contentType:null,finalUrl:null,bytes:0,kind:null,details:null,error:null};
  try{
    const response=await fetch(url,{headers:{...headers,...extraHeaders},redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(18000)});
    result.status=response.status;result.contentType=response.headers.get("content-type");result.finalUrl=new URL(response.url).origin+new URL(response.url).pathname;
    const text=await response.text();result.bytes=Buffer.byteLength(text);
    if((result.contentType||"").includes("json")||/^[\s]*[\[{]/.test(text)){
      result.kind="json";
      try{result.details=summarizeJson(JSON.parse(text))}catch{result.details={snippet:text.slice(0,700)}}
    }else{
      result.kind="html-or-text";
      const ids=[...text.matchAll(/<script\b[^>]*\bid=["']([^"']+)["']/gi)].map(m=>m[1]).slice(0,25);
      const urls=[...new Set((text.match(/https?:\/\/[^"' \t\r\n<>]+/g)||[]).map(value=>{try{return new URL(value).hostname}catch{return ""}}).filter(x=>/tiktok|tiktokcdn|byteoversea|ibytedtos|muscdn|akamaized/i.test(x)))].slice(0,10);
      result.details={title:text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0,180)||null,scriptIds:ids,hasImagePost:/imagePost|image_post|photoPost|photo_post/i.test(text),hasImageURL:/imageURL|imageUrl|urlList/i.test(text),hasUniversalData:text.includes("__UNIVERSAL_DATA_FOR_REHYDRATION__"),hasSigiState:text.includes("SIGI_STATE"),hasCaptcha:/captcha|verify to continue|access denied/i.test(text),urlHosts:urls,snippet:text.slice(0,350).replace(/\s+/g," ")};
    }
  }catch(error){result.error=String(error?.message||error).slice(0,200)}
  console.log("[TIKTOK-PHOTO-ENDPOINT] "+JSON.stringify(result));
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
await probe("official-player","https://www.tiktok.com/player/v1/"+itemId+"?controls=1&timestamp=1&description=1&music_info=1&rel=0");
await probe("short-link",shortUrl);
const workerImageUrl=workerBase+"/api/image/extract?url="+encodeURIComponent("https://www.tiktok.com/embed/v2/"+itemId);
try{
  const response=await fetch(workerImageUrl,{cache:"no-store",signal:AbortSignal.timeout(45000)});
  const data=await response.json().catch(()=>({}));
  console.log("[TIKTOK-EMBED-IMAGE-EXTRACTION] "+JSON.stringify({status:response.status,ok:data.ok===true,imageCount:Array.isArray(data.images)?data.images.length:0,title:String(data.title||"").slice(0,140),error:data.error||null,firstImageSource:data.images?.[0]?.source||null}));
}catch(error){console.log("[TIKTOK-EMBED-IMAGE-EXTRACTION] "+JSON.stringify({error:String(error?.message||error).slice(0,180)}))}
