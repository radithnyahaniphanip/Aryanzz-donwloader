const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/,"");
const sourceUrl="https://www.instagram.com/p/Dek72MYE141/?xtok=OWdvNjR4dmZscnlx";
const report={test:"user-supplied Instagram post image and video extraction",sourceUrl,status:null,title:null,platform:null,imageCount:0,previewStatus:null,previewMime:null,previewDisposition:null,signatureValid:false,downloadUrlAvailable:false,videoInfoStatus:null,videoInfoType:null,imageOnly:false,videoFormatCount:0,videoProbeStatus:null,videoProbeMime:null,videoProbeValid:false,videoProbeAttempts:[],videoError:null,error:null};
try{
  const endpoint=new URL("/api/image/extract",base);endpoint.searchParams.set("url",sourceUrl);
  const response=await fetch(endpoint.href,{headers:{accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(35000)});
  report.status=response.status;
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true||!Array.isArray(data.images)||!data.images.length)
    throw new Error(String(data.error||"Instagram tidak mengembalikan gambar publik yang dapat diekstrak.").slice(0,260));
  report.title=String(data.title||"").slice(0,160)||null;
  report.platform=data.platform||null;
  report.imageCount=data.images.length;
  const item=data.images[0];
  const preview=new URL(item.previewUrl||item.downloadUrl);
  const download=new URL(item.downloadUrl||item.previewUrl);
  if(preview.origin!==base||download.origin!==base||!["/api/social-image-file","/api/image/file"].includes(preview.pathname)||!["/api/social-image-file","/api/image/file"].includes(download.pathname))
    throw new Error("Tautan pratinjau/unduhan gambar tidak melewati proxy ARYANZZ.");
  report.downloadUrlAvailable=true;
  const media=await fetch(preview.href,{headers:{range:"bytes=0-1023",accept:"image/*"},cache:"no-store",signal:AbortSignal.timeout(25000)});
  report.previewStatus=media.status;
  report.previewMime=media.headers.get("content-type");
  report.previewDisposition=media.headers.get("content-disposition");
  if(!media.ok||!String(report.previewMime||"").toLowerCase().startsWith("image/"))
    throw new Error("Gambar ditemukan, tetapi endpoint pratinjau tidak mengirim MIME gambar yang valid (HTTP "+media.status+").");
  const reader=media.body?.getReader();
  const chunks=[];let length=0;
  while(reader&&length<16){const part=await reader.read();if(part.done)break;chunks.push(part.value);length+=part.value.byteLength;}
  const bytes=new Uint8Array(Math.min(length,32));let offset=0;
  for(const chunk of chunks){const count=Math.min(chunk.byteLength,bytes.length-offset);bytes.set(chunk.subarray(0,count),offset);offset+=count;if(offset>=bytes.length)break;}
  report.signatureValid=(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)||(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)||(bytes[0]===0x47&&bytes[1]===0x49&&bytes[2]===0x46)||(bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50)||(bytes[4]===0x66&&bytes[5]===0x74&&bytes[6]===0x79&&bytes[7]===0x70);
  await reader?.cancel().catch(()=>{});
  if(!report.signatureValid)throw new Error("Data awal yang dikirim bukan signature JPEG/PNG/GIF/WebP/AVIF yang dikenali.");
  try{
    const videoInfoResponse=await fetch(base+"/api/platform/info",{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({url:sourceUrl,expectedPlatform:"instagram"}),cache:"no-store",signal:AbortSignal.timeout(45000)});
    report.videoInfoStatus=videoInfoResponse.status;
    const videoInfo=await videoInfoResponse.json().catch(()=>({}));
    report.videoInfoType=videoInfo.type||null;
    report.imageOnly=videoInfo.imageOnly===true;
    const videoFormats=(videoInfo.formats||[]).filter(item=>item?.mode==="video"&&item?.downloadUrl);
    report.videoFormatCount=videoFormats.length;
    if(videoFormats.length){
      const ordered=videoFormats.slice().sort((a,b)=>{
        const ae=["mp4","m4v"].includes(String(a.ext||"").toLowerCase())?0:1;
        const be=["mp4","m4v"].includes(String(b.ext||"").toLowerCase())?0:1;
        return ae-be;
      }).slice(0,4);
      for(const [index,candidate] of ordered.entries()){
        try{
          const probe=new URL(candidate.downloadUrl);probe.searchParams.set("probe","1");
          const checked=await fetch(probe.href,{cache:"no-store",signal:AbortSignal.timeout(12000)});
          const result=await checked.json().catch(()=>({}));
          const valid=checked.ok&&result.valid===true&&String(result.mimeType||"").startsWith("video/");
          report.videoProbeAttempts.push({index:index+1,label:String(candidate.label||candidate.ext||"video").slice(0,60),status:checked.status,mime:result.mimeType||null,valid,error:valid?null:String(result.error||"Format tidak lolos validasi.").slice(0,120)});
          if(valid){
            report.videoProbeStatus=checked.status;
            report.videoProbeMime=result.mimeType||null;
            report.videoProbeValid=true;
            break;
          }
          report.videoProbeStatus=checked.status;
          report.videoProbeMime=result.mimeType||null;
        }catch(error){
          report.videoProbeAttempts.push({index:index+1,status:null,valid:false,error:String(error?.message||error).slice(0,120)});
        }
      }
      if(!report.videoProbeValid)report.videoError=String(report.videoProbeAttempts.at(-1)?.error||"Empat format video pertama tidak lolos validasi.").slice(0,180);
    }else report.videoError=report.imageOnly?"Postingan Instagram ini berisi foto, bukan video. Galeri foto tersedia untuk diunduh.":String(videoInfo.error||"Tidak ada stream video pada postingan ini.").slice(0,180);
  }catch(error){report.videoError=String(error?.message||error).slice(0,180)}
  console.log("[INSTAGRAM-USER-LINK-RESULT] "+JSON.stringify(report));
}catch(error){
  report.error=String(error?.message||error).slice(0,320);
  console.log("[INSTAGRAM-USER-LINK-RESULT] "+JSON.stringify(report));
  process.exitCode=1;
}
