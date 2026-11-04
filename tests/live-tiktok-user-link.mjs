const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/,"");
const sourceUrl="https://vt.tiktok.com/ZSPNASKHN/";
const request=(path,init={})=>fetch(base+path,{cache:"no-store",signal:AbortSignal.timeout(45000),...init});
const report={test:"user-supplied TikTok short link",sourceUrl,infoStatus:null,title:null,durationSeconds:null,durationLabel:null,videoFormats:0,selectedFormat:null,probeStatus:null,probeMime:null,previewStatus:null,previewMime:null,previewDisposition:null,downloadUrlAvailable:false,playbackReady:false,downloadReady:false,error:null};
try{
  const infoResponse=await request("/api/platform/info",{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({url:sourceUrl,expectedPlatform:"tiktok"})});
  report.infoStatus=infoResponse.status;
  const info=await infoResponse.json().catch(()=>({}));
  if(!infoResponse.ok||!Array.isArray(info.formats)||!info.formats.length)throw new Error(String(info.error||"Provider TikTok tidak mengembalikan format video yang dapat digunakan.").slice(0,260));
  report.title=String(info.title||"").slice(0,160)||null;
  report.durationSeconds=Number(info.duration)||null;
  if(report.durationSeconds){const total=Math.floor(report.durationSeconds);report.durationLabel=Math.floor(total/60)+":"+String(total%60).padStart(2,"0");}
  const videos=info.formats.filter(item=>item?.mode==="video"&&item?.previewUrl&&item?.downloadUrl);
  report.videoFormats=videos.length;
  if(!videos.length)throw new Error("Metadata ditemukan, tetapi provider tidak memberi URL pratinjau dan unduhan video.");
  const selected=videos.find(item=>!item.videoOnly&&["mp4","m4v"].includes(String(item.ext||"").toLowerCase()))||videos.find(item=>["mp4","m4v"].includes(String(item.ext||"").toLowerCase()))||videos[0];
  report.selectedFormat=String(selected.label||selected.ext||"video").slice(0,80);
  report.downloadUrlAvailable=true;
  const downloadProbe=new URL(selected.downloadUrl);
  if(downloadProbe.origin!==base||downloadProbe.pathname!=="/api/social-file")throw new Error("URL unduhan tidak memakai proxy ARYANZZ yang aman.");
  downloadProbe.searchParams.set("probe","1");
  const probeResponse=await request(downloadProbe.pathname+downloadProbe.search);
  report.probeStatus=probeResponse.status;
  const probe=await probeResponse.json().catch(()=>({}));
  report.probeMime=probe.mimeType||null;
  if(!probeResponse.ok||probe.valid!==true||!String(probe.mimeType||"").startsWith("video/"))throw new Error(String(probe.error||"Stream gagal melewati pemeriksaan signature video.").slice(0,260));
  report.downloadReady=true;
  const previewUrl=new URL(selected.previewUrl);
  if(previewUrl.origin!==base||previewUrl.pathname!=="/api/social-file")throw new Error("URL pratinjau tidak memakai proxy ARYANZZ yang aman.");
  const previewResponse=await request(previewUrl.pathname+previewUrl.search,{headers:{range:"bytes=0-65535"}});
  report.previewStatus=previewResponse.status;
  report.previewMime=previewResponse.headers.get("content-type");
  report.previewDisposition=previewResponse.headers.get("content-disposition");
  await previewResponse.body?.cancel().catch(()=>{});
  if(!previewResponse.ok||!String(report.previewMime||"").startsWith("video/")||!String(report.previewDisposition||"").startsWith("inline"))throw new Error("Stream lolos pemeriksaan unduhan tetapi endpoint pratinjau inline gagal: HTTP "+previewResponse.status+"; "+String(report.previewMime||"tanpa MIME"));
  report.playbackReady=true;
  console.log("[TIKTOK-USER-LINK-RESULT] "+JSON.stringify(report));
  if(!report.durationSeconds)console.log("[TIKTOK-USER-LINK-NOTE] Provider tidak mengirim durasi pada metadata; pemutar HP harus mengambil durasi asli melalui event loadedmetadata.");
}catch(error){
  report.error=String(error?.message||error).slice(0,320);
  console.log("[TIKTOK-USER-LINK-RESULT] "+JSON.stringify(report));
  process.exitCode=1;
}
