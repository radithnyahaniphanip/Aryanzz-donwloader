import assert from "node:assert/strict";
import worker from "../src/index.js";
import { readFileSync } from "node:fs";

const searchUi=readFileSync(new URL("../public/v674.js",import.meta.url),"utf8");
assert.ok(searchUi.includes("function searchDomainsForPlatform")&&searchUi.includes("platformCatalog.flatMap"),"Link/search filtering must retain the full live platform catalogue");
assert.ok(searchUi.includes("platform.searchModes")&&searchUi.includes("catalogForMode"),"Title-search picker must filter platforms by verified media modes");
assert.ok(searchUi.includes("[10,20,50,100]"),"Search result pagination must offer 10, 20, 50 and 100 results per page");
assert.ok(searchUi.includes("data.fallbackUsed===true")&&searchUi.includes("item?.platform===\"youtube\""),"The UI must allow explicitly marked YouTube fallback results for a selected social platform");
assert.ok(searchUi.includes("https://www.youtube.com/results?search_query=")&&searchUi.includes("Cari di YouTube"),"Empty social searches must offer YouTube as the external fallback");
assert.ok(searchUi.includes("Periksa tautan & unduh"),"Public title results without verified streams must still render an in-app check-and-download action");
assert.ok(searchUi.includes("Mencari judul satu per satu di semua platform video yang didukung"),"All-platform mode must explain that each eligible platform is searched separately");

const originalFetch=globalThis.fetch;
const imageSearchHtml='<a class="iusc" m=\'{"purl":"https://www.instagram.com/p/123/","murl":"https://cdn.example/cat.jpg","desc":"cat photo","w":640,"h":480}\'></a>';
const videoSearchHtml='<a class="result__a" href="https://bsky.app/profile/demo/post/123">Cat video</a><div class="result__snippet">Cat video from a public post</div>';
const publicPostHtml='<html><head><title>Cat video post</title><meta property="og:title" content="Cat video post"><meta property="og:image" content="https://cdn.example/cat.jpg"><meta property="og:video" content="https://cdn.example/clip.mp4"><meta property="og:video:type" content="video/mp4"><meta property="og:video:width" content="1920"><meta property="og:video:height" content="1080"></head><body></body></html>';
const publicImagePostHtml='<html><head><title>Cat image post</title><meta property="og:title" content="Cat image post"><meta property="og:image" content="https://cdn.example/cat.jpg"></head><body></body></html>';

globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
  if(url.hostname==="pipedapi.kavin.rocks"&&url.pathname==="/search"){
    const searchQuery=String(url.searchParams.get("q")||"Cat video").replace(/\\s+/g," ").trim();
    if(/tabola bale/i.test(searchQuery))return new Response(JSON.stringify([]),{status:200,headers:{"content-type":"application/json"}});
    const searchTitle=searchQuery.slice(0,120)+" official video";
    return new Response(JSON.stringify([{videoId:"abcdefghijk",title:searchTitle,thumbnail:"https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",uploaderName:"Test Channel",duration:120}]),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url.hostname==="pipedapi.kavin.rocks"&&url.pathname==="/streams/abcdefghijk")
    return new Response(JSON.stringify({title:"Cat video official",uploader:"Test Channel",duration:120,thumbnailUrl:"https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",videoStreams:[{url:"https://pipedapi.kavin.rocks/media/cat.mp4",mimeType:"video/mp4",format:"mp4",quality:"720p",height:720,hasAudio:true}]}),{status:200,headers:{"content-type":"application/json"}});
  if(url.hostname==="pipedapi.kavin.rocks"&&url.pathname==="/media/cat.mp4")
    return new Response(new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0,0]),{status:206,headers:{"content-type":"video/mp4","content-length":"16","content-range":"bytes 0-15/1024","accept-ranges":"bytes"}});
  if(url.hostname==="www.bing.com"&&url.pathname==="/images/search")
    return new Response(imageSearchHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="html.duckduckgo.com"){
    const searchQuery=String(url.searchParams.get("q")||"");
    if(/green screen meme kucing/i.test(searchQuery))return new Response(videoSearchHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
    if(/site:instagram\.com/i.test(searchQuery))return new Response('<a class="result__a" href="https://www.instagram.com/reel/ABC123xyz/">Cat video Instagram reel</a><div class="result__snippet">Cat video public reel</div>',{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
    if(/site:tiktok\.com/i.test(searchQuery))return new Response('<a class="result__a" href="https://www.tiktok.com/@demo/video/1234567890123456789">Cat video TikTok</a><div class="result__snippet">Cat video public TikTok</div>',{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
    return new Response(videoSearchHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  }
  if(url.hostname==="www.bing.com"&&url.pathname==="/search")
    return new Response(videoSearchHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="www.youtube.com"&&url.pathname==="/youtubei/v1/search"){
    const body=JSON.parse(init.body||"{}");
    const query=String(body.query||"Tabola Bale");
    const title=/tabola bale/i.test(query)?"Tabola Bale - Official Music Video":query+" official video";
    const videoId="zyxwvutsrqp";
    return new Response(JSON.stringify({contents:{twoColumnSearchResultsRenderer:{primaryContents:{sectionListRenderer:{contents:[{itemSectionRenderer:{contents:[{videoRenderer:{videoId,title:{runs:[{text:title}]},ownerText:{runs:[{text:"Test Channel"}]},lengthText:{simpleText:"3:45"},viewCountText:{simpleText:"1.2M views"},thumbnail:{thumbnails:[{url:"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg",width:480,height:360}]}}}]}}]}}}}}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url.hostname==="www.google.com")
    return new Response("",{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="cdn.example"&&url.pathname==="/not-image.jpg")
    return new Response("<html>not an image</html>",{status:200,headers:{"content-type":"image/jpeg","content-length":"25"}});
  if(url.hostname==="cdn.example")
    return new Response(new Uint8Array([0xff,0xd8,0xff,0xd9]),{status:200,headers:{"content-type":"image/jpeg","content-length":"4"}});
  if(url.hostname==="www.instagram.com")
    return new Response(publicImagePostHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  if(url.hostname==="bsky.app"){
    const imageOnly=url.pathname.endsWith("/456");
    return new Response(imageOnly?publicImagePostHtml:publicPostHtml,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  }
  return new Response("",{status:404,headers:{"content-type":"text/html; charset=utf-8"}});
};

try{
  const status=await worker.fetch(new Request("https://aryanzz.example/api/platform/status"),{});
  const statusData=await status.json();
  const bluesky=statusData.platforms.find(item=>item.id==="bluesky");
  const instagram=statusData.platforms.find(item=>item.id==="instagram");
  assert.deepEqual(bluesky.searchModes,[],"AIO-only platforms must not be advertised for title video/image search");
  assert.ok(instagram.searchModes.includes("video")&&instagram.searchModes.includes("image"),"Dedicated Instagram provider must advertise its supported search modes");
  assert.ok(statusData.searchablePlatformCounts.video>0&&statusData.searchablePlatformCounts.image>0,"Status must expose real searchable provider counts");
  console.log("✔ Platform status separates the 200 link catalogue from provider-backed title-search capabilities");

  const youtubeTitleSearch=await worker.fetch(new Request("https://aryanzz.example/api/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.39"},
    body:JSON.stringify({query:"Tabola Bale"})
  }),{});
  assert.equal(youtubeTitleSearch.status,200,"YouTube title search must return public results even when the download stream cannot be verified");
  const youtubeTitleData=await youtubeTitleSearch.json();
  assert.ok(youtubeTitleData.results.some(item=>item.platform==="youtube"&&/tabola bale/i.test(item.title)),"Official YouTube InnerTube search must return the requested title");
  assert.ok(youtubeTitleData.results.every(item=>item.searchOnly===true||item.verified===true),"YouTube search cards must state whether their download source is verified");
  console.log("✔ YouTube official title search returns in-app results independently from download extraction");

  const youtubeSocialTitleSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.40"},
    body:JSON.stringify({query:"Tabola Bale",platform:"youtube",mediaType:"video"})
  }),{});
  assert.equal(youtubeSocialTitleSearch.status,200,"YouTube selected-platform search must use the shared source-aware title-search route");
  const youtubeSocialData=await youtubeSocialTitleSearch.json();
  assert.ok(youtubeSocialData.results.some(item=>item.platform==="youtube"&&/tabola bale/i.test(item.title)),"Selecting YouTube in the UI must display official YouTube results inside ARYANZZ");
  assert.ok(youtubeSocialData.results.some(item=>item.searchOnly===true),"YouTube search results remain available even if the download stream has not yet been verified");
  console.log("✔ Selected YouTube uses the same in-app source-aware result pipeline");

  const tiktokTitleSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.41"},
    body:JSON.stringify({query:"cat",platform:"tiktok",mediaType:"video"})
  }),{});
  assert.equal(tiktokTitleSearch.status,200,"TikTok selected-platform title search must return a valid result response");
  const tiktokTitleData=await tiktokTitleSearch.json();
  assert.ok(tiktokTitleData.results.some(item=>item.platform==="tiktok"&&item.searchOnly===true),"Selecting TikTok must show TikTok public title results even if the downloader cannot verify a stream before selection");
  assert.equal(tiktokTitleData.fallbackUsed,false,"YouTube fallback must not replace real TikTok public candidates");
  console.log("✔ Selected TikTok shows TikTok results in-app before download verification");

  const imageAll=await worker.fetch(new Request("https://aryanzz.example/api/image/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.31"},
    body:JSON.stringify({query:"cat",platform:"all"})
  }),{});
  assert.equal(imageAll.status,200,"All-platform image search should return a valid response");
  const allData=await imageAll.json();
  assert.ok(allData.results.length>0,"All-platform image search should keep a supported provider result");
  assert.ok(allData.results.every(group=>group.platform==="instagram"),"AIO-only image platforms must be excluded from all-platform image search");
  assert.ok(allData.results.every(group=>group.images?.every(image=>image.mediaVerified===true&&image.previewUrl?.includes("/api/social-image-file"))),"Every displayed image must pass the live image MIME check and use ARYANZZ proxy URLs");
  assert.ok(allData.failedImageChecks>=0&&allData.searchablePlatformCount>0,"Image search must report verification and supported-platform diagnostics");
  console.log("✔ All-platform image search filters unsupported providers and validates every displayed image file");

  const invalidImageProbe=await worker.fetch(new Request("https://aryanzz.example/api/social-image-file?url="+encodeURIComponent("https://cdn.example/not-image.jpg")+"&probe=1",{
    headers:{"cf-connecting-ip":"198.51.100.38"}
  }),{});
  assert.equal(invalidImageProbe.status,415,"MIME-spoofed non-image content must fail the image signature probe");
  const invalidImageData=await invalidImageProbe.json();
  assert.equal(invalidImageData.valid,false);
  console.log("✔ Image MIME spoofing is rejected by byte-signature validation");

  const imageSelected=await worker.fetch(new Request("https://aryanzz.example/api/image/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.32"},
    body:JSON.stringify({query:"cat",platform:"bluesky"})
  }),{});
  assert.equal(imageSelected.status,400,"Selected AIO image search must be rejected instead of showing non-downloadable results");
  const selectedImages=await imageSelected.json();
  assert.equal(selectedImages.ok,false);
  assert.match(selectedImages.error,/provider gambar terverifikasi/i);
  console.log("✔ Selected AIO image search is blocked with a clear capability message");

  const videoSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.33"},
    body:JSON.stringify({query:"cat",platform:"bluesky",mediaType:"video"})
  }),{});
  assert.equal(videoSearch.status,400,"Selected AIO title/video search must be rejected");
  const videoData=await videoSearch.json();
  assert.equal(videoData.ok,false);
  assert.match(videoData.error,/provider video terverifikasi/i);
  console.log("✔ Selected AIO video title search is blocked before searching");

  const allVideoSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.37"},
    body:JSON.stringify({query:"cat",platform:"all",mediaType:"video"})
  }),{});
  assert.equal(allVideoSearch.status,200,"All-platform title search should return a valid response");
  const allVideoData=await allVideoSearch.json();
  assert.ok(allVideoData.results.every(item=>(item.verified===true&&item.downloadable===true)||item.searchOnly===true),"Every all-platform result must be either verified media or an explicitly unverified public title candidate");
  assert.equal(allVideoData.searchOnlyCount,allVideoData.results.filter(item=>item.searchOnly===true).length,"Search-only result count must match the cards that need verification on selection");
  assert.ok(allVideoData.results.some(item=>item.platform==="youtube"),"All-platform search must include YouTube results from the official search route");
  assert.ok(allVideoData.results.some(item=>item.platform==="instagram"&&item.searchOnly===true),"All-platform search must keep public Instagram title results even when the downloader cannot verify them");
  assert.ok(allVideoData.results.some(item=>item.platform==="tiktok"&&item.searchOnly===true),"All-platform search must keep public TikTok title results even when the downloader cannot verify them");
  assert.ok(allVideoData.unsupportedCandidateCount>0,"AIO-only results must be counted as excluded rather than shown");
  console.log("✔ All-platform video search keeps real public platform candidates and labels unverified streams");

  const expansionSearch=await worker.fetch(new Request("https://aryanzz.example/api/social/search",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.36"},
    body:JSON.stringify({query:"green screen meme kucing",platform:"instagram",mediaType:"video"})
  }),{});
  assert.equal(expansionSearch.status,200,"Keyword expansion search should return a valid response");
  const expansionData=await expansionSearch.json();
  assert.ok(expansionData.searchVariants.includes("green screen meme template"),"Green-screen meme searches must expand to useful related title variants");
  assert.equal(expansionData.fallbackUsed,true,"A selected social platform with no verified result must activate the YouTube fallback");
  assert.ok(expansionData.results.some(item=>item.platform==="youtube"&&item.searchOnly===true),"Selected-platform fallback must show a real YouTube title result even if its stream is not yet verified");
  console.log("✔ Title-search keyword expansion remains active for supported providers");

  const videoInfo=await worker.fetch(new Request("https://aryanzz.example/api/platform/info",{
    method:"POST",
    headers:{"content-type":"application/json","cf-connecting-ip":"198.51.100.34"},
    body:JSON.stringify({url:"https://bsky.app/profile/demo/post/123",expectedPlatform:"bluesky"})
  }),{});
  const videoInfoData=await videoInfo.json();
  assert.equal(videoInfo.status,200,"Generic public-page video metadata should remain available for manual link analysis: "+JSON.stringify(videoInfoData));
  assert.ok(videoInfoData.formats?.some(item=>item.mode==="video"&&item.ext==="mp4"),"Generic public-page fallback should preserve an actual MP4 source");
  assert.equal(videoInfoData.width,1920,"Generic video metadata should preserve source width");
  assert.equal(videoInfoData.height,1080,"Generic video metadata should preserve source height");
  assert.equal(videoInfoData.aspectRatio,1920/1080,"Generic video metadata should preserve the source aspect ratio");
  console.log("✔ Experimental platforms remain available for manual pasted-link extraction");

  const imageInfo=await worker.fetch(new Request("https://aryanzz.example/api/image/extract?url="+encodeURIComponent("https://bsky.app/profile/demo/post/456"),{
    headers:{"cf-connecting-ip":"198.51.100.35"}
  }),{});
  const imageInfoData=await imageInfo.json();
  assert.equal(imageInfo.status,200,"Generic public-page image extraction should remain available for manual links: "+JSON.stringify(imageInfoData));
  assert.equal(imageInfoData.platform,"bluesky");
  assert.ok(imageInfoData.images?.some(item=>item.previewUrl?.includes("/api/social-image-file")),"Generic platform image links should return ARYANZZ image proxy URLs");
  console.log("✔ Experimental platform image links still reach safe public-page extraction in link mode");
}finally{
  globalThis.fetch=originalFetch;
}
