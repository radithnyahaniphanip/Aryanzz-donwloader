import assert from "node:assert/strict";
import worker from "../src/index.js";

const originalFetch=globalThis.fetch;
const shortUrl="https://vt.tiktok.com/ZSPNASKHN/";
const canonicalUrl="https://www.tiktok.com/video/1234567890123456789";
const videoBytes=Uint8Array.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,2,0,105,115,111,109,105,115,111,50]);
const hydration={
  __DEFAULT_SCOPE__:{
    "webapp.video-detail":{
      itemInfo:{
        itemStruct:{
          id:"1234567890123456789",
          desc:"TikTok native page fallback regression",
          author:{uniqueId:"demo"},
          video:{
            duration:14,
            playAddr:"https://cdn.example/tiktok-video.mp4",
            downloadAddr:"https://cdn.example/tiktok-video.mp4",
            cover:"https://cdn.example/tiktok-cover.jpg",
            bitrateInfo:[{GearName:"normal_720_0",Bitrate:900000,PlayAddr:{UrlList:["https://cdn.example/tiktok-video.mp4"]}}]
          }
        }
      }
    }
  }
};
const malformedShareUrl="https://www.tiktok.com/@/video/1234567890123456789?share_item_id=1234567890123456789";
const pageHtml='<html><head><link rel="canonical" href="'+malformedShareUrl+'"><meta property="og:title" content="TikTok native page fallback regression"></head><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'+JSON.stringify(hydration)+'</script></body></html>';

try{
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    if(url.hostname==="vt.tiktok.com"||url.hostname==="www.tiktok.com"&&(url.pathname==="/video/1234567890123456789"||url.pathname==="/@/video/1234567890123456789"))
      return new Response(pageHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
    if(url.hostname==="www.tiktok.com"&&url.pathname==="/oembed"){
      const target=new URL(url.searchParams.get("url")||"https://www.tiktok.com/video/9876543210987654321");
      const id=(target.pathname.match(/video\/(\d{8,})/)||[])[1]||"9876543210987654321";
      if(id==="8876543210987654321")return new Response(JSON.stringify({
        type:"video",title:"TikTok oEmbed playback regression",author_name:"ARYANZZ Test",
        embed_product_id:id,thumbnail_url:"https://cdn.example/tiktok-cover.jpg",
        html:'<iframe src="https://www.tiktok.com/player/v1/'+id+'"></iframe>'
      }),{status:200,headers:{"content-type":"application/json"}});
      return new Response(JSON.stringify({error:"Video unavailable"}),{status:404,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="www.tiktok.com"&&url.pathname==="/api/item/detail/"){
      const id=url.searchParams.get("itemId");
      if(id==="1234567890123456789")return new Response(JSON.stringify({statusCode:10216,itemInfo:null}),{status:403,headers:{"content-type":"application/json"}});
      if(id==="9876543210987654321")return new Response(JSON.stringify({statusCode:0,itemInfo:{itemStruct:{
        id,desc:"TikTok item detail API regression",author:{uniqueId:"demo"},
        video:{duration:9,playAddr:"https://cdn.example/tiktok-video-api.mp4",downloadAddr:"https://cdn.example/tiktok-video-api.mp4",bitrateInfo:[{GearName:"normal_480_0",Bitrate:500000,PlayAddr:{UrlList:["https://cdn.example/tiktok-video-api.mp4"]}}]}
      }}}),{status:200,headers:{"content-type":"application/json"}});
      return new Response(JSON.stringify({statusCode:10216}),{status:403,headers:{"content-type":"application/json"}});
    }
    if(url.hostname==="btch-downloader-api-green.vercel.app")
      return new Response(JSON.stringify({success:false,error:"provider unavailable"}),{status:502,headers:{"content-type":"application/json"}});
    if(url.hostname==="download-tktk-video.drummerduck.com")
      return new Response(JSON.stringify({ok:false,error:{message:"provider blocked"}}),{status:403,headers:{"content-type":"application/json"}});
    if(url.hostname==="tk.seekubo.com")
      return new Response(JSON.stringify({success:false,error:{message:"provider unavailable"}}),{status:530,headers:{"content-type":"application/json"}});
    if(url.hostname==="tdownv4.sl-bjs.workers.dev")
      return new Response(JSON.stringify({error:"provider unavailable"}),{status:500,headers:{"content-type":"application/json"}});
    if(url.hostname==="www.tikwm.com")
      return new Response(JSON.stringify({code:-1,msg:"Url parsing is failed!"}),{status:200,headers:{"content-type":"application/json"}});
    if(url.hostname==="cdn.example"&&(url.pathname==="/tiktok-video.mp4"||url.pathname==="/tiktok-video-api.mp4"))
      return new Response(videoBytes,{status:206,headers:{"content-type":"video/mp4","content-length":String(videoBytes.length),"content-range":"bytes 0-"+(videoBytes.length-1)+"/"+videoBytes.length,"accept-ranges":"bytes"}});
    throw new Error("Unexpected mocked fetch: "+url.href);
  };

  const response=await worker.fetch(new Request("https://aryanzz.example/api/platform/info",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"192.0.2.220"},
    body:JSON.stringify({url:shortUrl,expectedPlatform:"tiktok"})
  }),{});
  assert.equal(response.status,200,"public TikTok short link should fall back to hydration metadata");
  const info=await response.json();
  assert.equal(info.canonicalUrl,canonicalUrl,"canonical link should be extracted from TikTok page metadata");
  assert.equal(info.providerName,"TikTok public page fallback");
  assert.equal(info.title,"TikTok native page fallback regression");
  assert.equal(info.duration,14);
  assert.ok(info.formats.some(item=>item.mode==="video"&&item.ext==="mp4"&&item.height===720));
  const video=info.formats.find(item=>item.mode==="video");
  const probeUrl=new URL(video.downloadUrl);probeUrl.searchParams.set("probe","1");
  const probe=await worker.fetch(new Request(probeUrl.href),{});
  assert.equal(probe.status,200,"native TikTok video stream should pass file signature validation");
  const checked=await probe.json();
  assert.equal(checked.valid,true);
  assert.equal(checked.mimeType,"video/mp4");
  assert.equal(checked.extension,"mp4");
  assert.equal(checked.bytes,videoBytes.length);
  console.log("✔ TikTok short-link canonical metadata, public hydration extraction and MP4 signature preflight pass");
  const embedResponse=await worker.fetch(new Request("https://aryanzz.example/api/platform/info",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"192.0.2.222"},
    body:JSON.stringify({url:"https://www.tiktok.com/video/8876543210987654321",expectedPlatform:"tiktok"})
  }),{});
  assert.equal(embedResponse.status,200,"public TikTok oEmbed should provide a playback-only fallback");
  const embedInfo=await embedResponse.json();
  assert.equal(embedInfo.providerName,"TikTok Embed Player");
  assert.equal(embedInfo.directDownloadAvailable,false);
  assert.equal(embedInfo.formats.length,0);
  assert.equal(embedInfo.embedUrl,"https://www.tiktok.com/player/v1/8876543210987654321?controls=1&timestamp=1&description=1&music_info=1&rel=0");
  console.log("✔ TikTok oEmbed returns a validated official player fallback without inventing an MP4 download");
  const apiInfoResponse=await worker.fetch(new Request("https://aryanzz.example/api/platform/info",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"192.0.2.221"},
    body:JSON.stringify({url:"https://www.tiktok.com/video/9876543210987654321",expectedPlatform:"tiktok"})
  }),{});
  assert.equal(apiInfoResponse.status,200,"public item-detail endpoint should supply metadata when page hydration is unavailable");
  const apiInfo=await apiInfoResponse.json();
  assert.equal(apiInfo.providerName,"TikTok public page fallback");
  assert.equal(apiInfo.title,"TikTok item detail API regression");
  assert.equal(apiInfo.duration,9);
  assert.ok(apiInfo.formats.some(item=>item.mode==="video"&&item.height===480));
  const apiVideo=apiInfo.formats.find(item=>item.mode==="video");
  const apiProbeUrl=new URL(apiVideo.downloadUrl);apiProbeUrl.searchParams.set("probe","1");
  const apiProbe=await worker.fetch(new Request(apiProbeUrl.href),{});
  assert.equal(apiProbe.status,200);
  assert.equal((await apiProbe.json()).valid,true);
  console.log("✔ TikTok public item-detail endpoint extracts video metadata and passes MP4 signature preflight");
}finally{
  globalThis.fetch=originalFetch;
}
