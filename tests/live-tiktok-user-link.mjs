const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/,"");
const sourceUrl="https://vt.tiktok.com/ZSPNASKHN/";
const request=(path,init={})=>fetch(base+path,{cache:"no-store",signal:AbortSignal.timeout(45000),...init});
const report={test:"user-supplied TikTok short link",sourceUrl,infoStatus:null,canonicalUrl:null,providerName:null,provider:null,fallbackUsed:false,errorType:null,diagnostics:null,title:null,durationSeconds:null,durationLabel:null,videoFormats:0,formatCandidates:[],selectedFormat:null,probeStatus:null,probeMime:null,previewStatus:null,previewMime:null,previewDisposition:null,downloadUrlAvailable:false,playbackReady:false,downloadReady:false,embedUrl:null,embedStatus:null,error:null};
try{
  const infoResponse=await request("/api/platform/info",{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({url:sourceUrl,expectedPlatform:"tiktok"})});
  report.infoStatus=infoResponse.status;
  const info=await infoResponse.json().catch(()=>({}));
  report.canonicalUrl=info.canonicalUrl||null;
  report.providerName=info.providerName||null;
  report.provider=info.provider||null;
  report.fallbackUsed=info.fallbackUsed===true;
  report.errorType=info.errorType||null;
  report.diagnostics=info.diagnostics||info.fallbackDiagnostic||null;
  report.formatCandidates=(Array.isArray(info.formats)?info.formats:[]).slice(0,6).map(item=>({label:item.label||null,ext:item.ext||null,mimeType:item.mimeType||null,mode:item.mode||null,videoOnly:item.videoOnly===true}));
  if(!infoResponse.ok||!Array.isArray(info.formats)||!info.formats.length){
    if(info.embedUrl){
      const embed=new URL(info.embedUrl);
      if(embed.origin!=="https://www.tiktok.com"||!/^\/player\/v1\/\d{8,}$/.test(embed.pathname))throw new Error("TikTok embed URL tidak valid.");
      report.providerName=info.providerName||"TikTok Embed Player";
      report.embedUrl=embed.href;
      report.embedStatus=null;
      report.playbackReady=false;
      report.downloadReady=false;
      report.error=info.downloadMessage||"Player resmi tersedia, tetapi unduhan MP4 langsung belum tersedia.";
      const player=await fetch(embed.href,{cache:"no-store",signal:AbortSignal.timeout(15000)});
      report.embedStatus=player.status;
      await player.body?.cancel().catch(()=>{});
      report.playbackReady=player.ok;
      console.log("[TIKTOK-USER-LINK-RESULT] "+JSON.stringify(report));
      if(!player.ok)process.exitCode=1;
      return;
    }
    throw new Error(String(info.error||"Provider TikTok tidak mengembalikan format video yang dapat digunakan.").slice(0,320));
  }
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

const publicTikTokUrl="https://vm.tiktok.com/ZMkyTWLpV/";
const publicReport={test:"public TikTok sample short-link playback and download",sourceUrl:publicTikTokUrl,status:null,canonicalUrl:null,title:null,durationSeconds:null,videoFormats:0,probeAttempts:[],videoReady:false,previewStatus:null,previewMime:null,previewDisposition:null,error:null};
try{
  const response=await fetch(base+"/api/platform/info",{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({url:publicTikTokUrl,expectedPlatform:"tiktok"}),cache:"no-store",signal:AbortSignal.timeout(45000)});
  publicReport.status=response.status;
  const info=await response.json().catch(()=>({}));
  publicReport.canonicalUrl=info.canonicalUrl||null;
  publicReport.title=String(info.title||"").slice(0,120)||null;
  publicReport.durationSeconds=Number(info.duration)||null;
  const videos=(info.formats||[]).filter(item=>item?.mode==="video"&&item?.downloadUrl);
  publicReport.videoFormats=videos.length;
  const ordered=videos.slice().sort((a,b)=>{
    const ae=["mp4","m4v"].includes(String(a.ext||"").toLowerCase())?0:1;
    const be=["mp4","m4v"].includes(String(b.ext||"").toLowerCase())?0:1;
    return ae-be;
  }).slice(0,4);
  for(const [index,candidate] of ordered.entries()){
    try{
      const probe=new URL(candidate.downloadUrl);probe.searchParams.set("probe","1");
      const checked=await fetch(probe.href,{cache:"no-store",signal:AbortSignal.timeout(12000)});
      const data=await checked.json().catch(()=>({}));
      const valid=checked.ok&&data.valid===true&&String(data.mimeType||"").startsWith("video/");
      publicReport.probeAttempts.push({index:index+1,status:checked.status,mime:data.mimeType||null,valid,error:valid?null:String(data.error||"Video signature tidak valid.").slice(0,120)});
      if(valid){
        publicReport.videoReady=true;
        const previewUrl=new URL(candidate.previewUrl);
        const preview=await fetch(previewUrl.href,{headers:{range:"bytes=0-65535"},cache:"no-store",signal:AbortSignal.timeout(15000)});
        publicReport.previewStatus=preview.status;
        publicReport.previewMime=preview.headers.get("content-type");
        publicReport.previewDisposition=preview.headers.get("content-disposition");
        await preview.body?.cancel().catch(()=>{});
        break;
      }
    }catch(error){publicReport.probeAttempts.push({index:index+1,error:String(error?.message||error).slice(0,120)})}
  }
  if(!publicReport.videoReady&&!publicReport.error)publicReport.error=String(info.error||"Tidak ada format TikTok publik yang lolos validasi.").slice(0,180);
  console.log("[TIKTOK-PUBLIC-SAMPLE-RESULT] "+JSON.stringify(publicReport));
}catch(error){
  publicReport.error=String(error?.message||error).slice(0,220);
  console.log("[TIKTOK-PUBLIC-SAMPLE-RESULT] "+JSON.stringify(publicReport));
}
