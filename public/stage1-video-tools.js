(()=>{"use strict";
const stage=window.ARYANZZStage1;if(!stage)return;
stage.register("video-lightweight",(root,core)=>{
 const $=id=>core.q("#"+id,root);
 function setStatus(id,message,state="info"){core.status($(id),message,state)}
 function parseBoxes(bytes,start=0,end=bytes.length){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=[];let offset=start,guard=0;
  while(offset+8<=end&&guard++<10000){
   let size=view.getUint32(offset,false),header=8;
   const type=String.fromCharCode(bytes[offset+4],bytes[offset+5],bytes[offset+6],bytes[offset+7]);
   if(size===1){if(offset+16>end)break;const large=view.getBigUint64(offset+8,false);if(large>BigInt(Number.MAX_SAFE_INTEGER))break;size=Number(large);header=16}
   else if(size===0)size=end-offset;
   if(size<header||offset+size>end)break;
   out.push({type,start:offset,size,header,payload:offset+header,end:offset+size});
   offset+=size;
  }
  return out;
 }
 function child(boxes,type){return boxes.find(box=>box.type===type)}
 function ascii(bytes,start,length){return String.fromCharCode(...bytes.slice(start,start+length))}
 function readDuration(box,bytes){
  if(!box)return null;const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),p=box.payload,version=bytes[p];
  if(version===1){const scale=v.getUint32(p+20,false),duration=Number(v.getBigUint64(p+24,false));return scale?duration/scale:null}
  const scale=v.getUint32(p+12,false),duration=v.getUint32(p+16,false);return scale?duration/scale:null;
 }
 function parseMp4(bytes){
  const top=parseBoxes(bytes);let moov=child(top,"moov");
  if(!moov){for(let i=4;i+4<=bytes.length;i++){if(bytes[i]===0x6d&&bytes[i+1]===0x6f&&bytes[i+2]===0x6f&&bytes[i+3]===0x76){const start=i-4,size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(start,false);if(size>=8&&start+size<=bytes.length){moov={type:"moov",start,size,header:8,payload:start+8,end:start+size};break}}}}
  if(!moov)return null;
  const moovBoxes=parseBoxes(bytes,moov.payload,moov.end),mvhd=child(moovBoxes,"mvhd");
  let videoCodec="Tidak terbaca",fps=null,audio=false,video=false;
  for(const trak of moovBoxes.filter(x=>x.type==="trak")){
   const trakBoxes=parseBoxes(bytes,trak.payload,trak.end),mdia=child(trakBoxes,"mdia");if(!mdia)continue;
   const mdiaBoxes=parseBoxes(bytes,mdia.payload,mdia.end),hdlr=child(mdiaBoxes,"hdlr"),mdhd=child(mdiaBoxes,"mdhd");
   const kind=hdlr?ascii(bytes,hdlr.payload+8,4):"";
   if(kind==="soun")audio=true;
   if(kind!=="vide")continue;
   video=true;
   const minf=child(mdiaBoxes,"minf"),minfBoxes=minf?parseBoxes(bytes,minf.payload,minf.end):[],stbl=child(minfBoxes,"stbl"),stblBoxes=stbl?parseBoxes(bytes,stbl.payload,stbl.end):[];
   const stsd=child(stblBoxes,"stsd");
   if(stsd&&stsd.payload+16<=stsd.end){const entryStart=stsd.payload+8;videoCodec=ascii(bytes,entryStart+4,4).replace(/\0/g,"").toUpperCase()}
   const stts=child(stblBoxes,"stts");
   if(stts&&mdhd){
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),version=bytes[mdhd.payload],scale=v.getUint32(mdhd.payload+(version===1?20:12),false);
    const count=v.getUint32(stts.payload+4,false);let samples=0,ticks=0,pos=stts.payload+8;
    for(let i=0;i<count&&pos+8<=stts.end;i++,pos+=8){const sampleCount=v.getUint32(pos,false),delta=v.getUint32(pos+4,false);samples+=sampleCount;ticks+=sampleCount*delta}
    if(scale&&ticks)fps=samples/(ticks/scale);
   }
  }
  return {duration:readDuration(mvhd,bytes),videoCodec,fps,audio,video};
 }
 async function parseMp4File(file){
  if(!/\.mp4$|\.m4v$/i.test(file.name)&&file.type!=="video/mp4")return null;
  const windowSize=12*1024*1024;
  const head=new Uint8Array(await file.slice(0,Math.min(file.size,windowSize)).arrayBuffer());
  let result=parseMp4(head);if(result)return result;
  if(file.size>windowSize){
   const tail=new Uint8Array(await file.slice(Math.max(0,file.size-windowSize)).arrayBuffer());
   result=parseMp4(tail);
  }
  return result;
 }
 async function loadVideo(video,file){
  if(video.dataset.objectUrl)URL.revokeObjectURL(video.dataset.objectUrl);
  const url=URL.createObjectURL(file);video.dataset.objectUrl=url;video.src=url;video.load();
  if(video.readyState<1)await core.waitEvent(video,"loadedmetadata",20000);
  if(!Number.isFinite(video.duration)||video.videoWidth<1||video.videoHeight<1)throw new Error("Metadata video tidak dapat dibaca.");
  return video;
 }
 function seek(video,time){
  const target=Math.max(0,Math.min(Number(time)||0,Math.max(0,video.duration-.04)));
  if(Math.abs(video.currentTime-target)<.025)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{cleanup();reject(new Error("Gagal berpindah ke frame yang diminta."))},10000);
   const done=()=>{cleanup();resolve()};
   const fail=()=>{cleanup();reject(new Error("Video gagal melakukan seek."))};
   function cleanup(){clearTimeout(timer);video.removeEventListener("seeked",done);video.removeEventListener("error",fail)}
   video.addEventListener("seeked",done,{once:true});video.addEventListener("error",fail,{once:true});video.currentTime=target;
  });
 }
 function drawContain(ctx,video,x,y,w,h){
  const scale=Math.min(w/video.videoWidth,h/video.videoHeight),dw=video.videoWidth*scale,dh=video.videoHeight*scale;
  ctx.fillStyle="#0b1423";ctx.fillRect(x,y,w,h);ctx.drawImage(video,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
 }
 const metaFile=$("v1ltMetaFile");
 metaFile?.addEventListener("change",async()=>{
  const file=metaFile.files?.[0];if(!file)return;
  setStatus("v1ltMetaStatus","Membaca metadata video…");
  try{
   const video=document.createElement("video");video.preload="metadata";video.muted=true;
   await loadVideo(video,file);
   const duration=video.duration,mp4=await parseMp4File(file).catch(()=>null);
   const bitrate=duration>0?(file.size*8/duration/1000).toFixed(0)+" kbps (perkiraan keseluruhan)":"Tidak tersedia";
   const pairs=[
    ["Nama file",file.name],["Ukuran file",core.formatBytes(file.size)],["Durasi",new Date(duration*1000).toISOString().slice(11,19)],["Resolusi",video.videoWidth+" × "+video.videoHeight],["Rasio",gcdRatio(video.videoWidth,video.videoHeight)],["Tipe media",file.type||"Tidak dinyatakan"],["Bitrate",bitrate],
    ["Video codec",mp4?.videoCodec||"Tidak tersedia untuk parser ringan"],["FPS rata-rata",mp4?.fps?mp4.fps.toFixed(2)+" fps":"Tidak tersedia"],["Audio track",mp4?mp4.audio?"Terdeteksi":"Tidak terdeteksi":"Tidak dapat diperiksa"],["Container",/\.mp4$|\.m4v$/i.test(file.name)?"MP4 / M4V":"Mengikuti tipe file"],["Terakhir diubah",file.lastModified?new Date(file.lastModified).toLocaleString():"Tidak tersedia"]
   ];
   core.resultPairs("v1ltMetaResult",pairs);setStatus("v1ltMetaStatus","Metadata berhasil dibaca. Bitrate adalah estimasi berdasarkan ukuran file total; codec/FPS hanya ditampilkan bila struktur MP4 dapat dianalisis.","success");
   video.removeAttribute("src");video.load();if(video.dataset.objectUrl){URL.revokeObjectURL(video.dataset.objectUrl);delete video.dataset.objectUrl;}
  }catch(error){setStatus("v1ltMetaStatus",error.message||"Gagal membaca video.","error")}
 });
 function gcdRatio(w,h){let a=w,b=h;while(b){const t=b;b=a%b;a=t}return a?(w/a)+":"+(h/a):"—"}
 const frameVideo=$("v1ltFrameVideo"),frameFile=$("v1ltFrameFile"),frameCapture=$("v1ltFrameCapture"),frameCanvas=$("v1ltFrameCanvas");
 let frameBlob=null,frameName="aryanzz-frame.png";
 frameFile?.addEventListener("change",async()=>{
  const file=frameFile.files?.[0];if(!file)return;
  frameCapture.disabled=true;frameBlob=null;$("v1ltFrameDownload").disabled=true;
  try{if(file.size>core.MAX_TOTAL)throw new Error("Video melebihi batas 250 MB untuk pemrosesan frame.");
   await loadVideo(frameVideo,file);$("v1ltFrameTime").max=String(Math.max(0,frameVideo.duration));$("v1ltFrameTime").value="0";frameCapture.disabled=false;setStatus("v1ltFrameStatus","Video siap · "+frameVideo.videoWidth+" × "+frameVideo.videoHeight+" · "+frameVideo.duration.toFixed(2)+" detik.","success")
  }catch(error){setStatus("v1ltFrameStatus",error.message,"error")}
 });
 frameCapture?.addEventListener("click",async()=>{
  try{
   const time=Number($("v1ltFrameTime").value);if(!Number.isFinite(time)||time<0||time>frameVideo.duration)throw new Error("Posisi waktu berada di luar durasi video.");
   await seek(frameVideo,time);
   const scale=Math.min(1,4096/frameVideo.videoWidth,4096/frameVideo.videoHeight);
   frameCanvas.width=Math.round(frameVideo.videoWidth*scale);frameCanvas.height=Math.round(frameVideo.videoHeight*scale);
   frameCanvas.getContext("2d").drawImage(frameVideo,0,0,frameCanvas.width,frameCanvas.height);
   const type=$("v1ltFrameFormat").value;frameBlob=await core.canvasBlob(frameCanvas,type,.94);frameName=core.safeName(frameFile.files[0].name.replace(/\.[^.]+$/,""))+"-frame-"+time.toFixed(1)+"."+(type==="image/png"?"png":"jpg");
   frameCanvas.hidden=false;$("v1ltFrameDownload").disabled=false;setStatus("v1ltFrameStatus","Frame berhasil diambil pada "+time.toFixed(2)+" detik.","success");
  }catch(error){setStatus("v1ltFrameStatus",error.message,"error")}
 });
 $("v1ltFrameDownload")?.addEventListener("click",()=>{if(frameBlob)core.downloadBlob(frameBlob,frameName)});
 const sheetVideo=$("v1ltSheetVideo"),sheetFile=$("v1ltSheetFile"),sheetRun=$("v1ltSheetGenerate"),sheetCanvas=$("v1ltSheetCanvas");
 let sheetBlob=null;
 sheetFile?.addEventListener("change",async()=>{
  const file=sheetFile.files?.[0];if(!file)return;
  sheetRun.disabled=true;sheetBlob=null;$("v1ltSheetDownload").disabled=true;
  try{if(file.size>core.MAX_TOTAL)throw new Error("Video melebihi batas 250 MB.");
   await loadVideo(sheetVideo,file);sheetRun.disabled=false;setStatus("v1ltSheetStatus","Video siap · "+sheetVideo.duration.toFixed(1)+" detik.","success")
  }catch(error){setStatus("v1ltSheetStatus",error.message,"error")}
 });
 sheetRun?.addEventListener("click",async()=>{
  const count=Number($("v1ltSheetCount").value),columns=Number($("v1ltSheetColumns").value);
  if(!sheetVideo.duration||!count||!columns)return;
  sheetRun.disabled=true;sheetBlob=null;$("v1ltSheetDownload").disabled=true;sheetCanvas.hidden=true;
  try{
   const cellW=180,cellH=124,rows=Math.ceil(count/columns);sheetCanvas.width=columns*cellW;sheetCanvas.height=rows*cellH;
   const ctx=sheetCanvas.getContext("2d");ctx.fillStyle="#0a1423";ctx.fillRect(0,0,sheetCanvas.width,sheetCanvas.height);
   for(let i=0;i<count;i++){
    const time=sheetVideo.duration*(i+.5)/count;await seek(sheetVideo,time);
    const x=(i%columns)*cellW,y=Math.floor(i/columns)*cellH;
    drawContain(ctx,sheetVideo,x+3,y+3,cellW-6,cellH-25);
    ctx.fillStyle="#dce8fa";ctx.font="11px sans-serif";ctx.fillText("Frame "+(i+1)+" · "+time.toFixed(1)+"s",x+8,y+cellH-8);
    $("v1ltSheetProgress").style.width=((i+1)/count*100)+"%";setStatus("v1ltSheetStatus","Mengambil thumbnail "+(i+1)+" dari "+count+"…");await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   sheetBlob=await core.canvasBlob(sheetCanvas,"image/jpeg",.9);sheetCanvas.hidden=false;$("v1ltSheetDownload").disabled=false;setStatus("v1ltSheetStatus","Contact sheet berhasil dibuat · "+count+" thumbnail.","success");
  }catch(error){setStatus("v1ltSheetStatus",error.message,"error")}
  finally{sheetRun.disabled=false}
 });
 $("v1ltSheetDownload")?.addEventListener("click",()=>{if(sheetBlob)core.downloadBlob(sheetBlob,"aryanzz-contact-sheet.jpg")});
 window.addEventListener("pagehide",()=>[frameVideo,sheetVideo].forEach(video=>{if(video?.dataset.objectUrl)URL.revokeObjectURL(video.dataset.objectUrl)}),{once:true});
});
})();