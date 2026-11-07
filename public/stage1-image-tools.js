(()=>{"use strict";
const stage=window.ARYANZZStage1;if(!stage)return;
stage.register("image-lightweight",(root,core)=>{
 const $=id=>core.q("#"+id,root),set=(id,msg,state="info")=>core.status($(id),msg,state);
 function readTiff(bytes,start){
  if(start+8>bytes.length)return {};
  const little=bytes[start]===0x49&&bytes[start+1]===0x49;
  if(!little&&!(bytes[start]===0x4d&&bytes[start+1]===0x4d))return {};
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=o=>v.getUint16(o,little),u32=o=>v.getUint32(o,little);
  if(u16(start+2)!==42)return {};
  const tags={};let gps=false;
  function ifd(offset,depth=0){
   if(depth>2||offset<0||start+offset+2>bytes.length)return [];
   const pos=start+offset,count=Math.min(u16(pos),512),items=[];
   for(let i=0;i<count;i++){
    const p=pos+2+i*12;if(p+12>bytes.length)break;
    const tag=u16(p),type=u16(p+2),n=u32(p+4),unit=({1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8})[type]||0;
    if(!unit||n>4096)continue;
    const size=n*unit,location=size<=4?p+8:start+u32(p+8);if(location<start||location+size>bytes.length)continue;
    let value;
    if(type===2)value=new TextDecoder().decode(bytes.slice(location,location+size)).replace(/\0+$/,"").trim();
    else if(type===5||type===10){const numerator=u32(location),denominator=u32(location+4);value=denominator?numerator/denominator:null}
    else if(type===3)value=n===1?u16(location):Array.from({length:n},(_,j)=>u16(location+j*2));
    else if(type===4)value=n===1?u32(location):Array.from({length:n},(_,j)=>u32(location+j*4));
    else if(type===1||type===7)value=n===1?bytes[location]:Array.from(bytes.slice(location,location+n));
    else if(type===9)value=v.getInt32(location,little);
    items.push({tag,value});
   }
   return items;
  }
  const ifd0=ifd(u32(start+4));
  for(const item of ifd0)tags[item.tag]=item.value;
  const exifPointer=ifd0.find(item=>item.tag===0x8769)?.value;
  if(exifPointer){for(const item of ifd(exifPointer,1))tags[item.tag]=item.value}
  gps=ifd0.some(item=>item.tag===0x8825);
  return {tags,gps,little};
 }
 function readJpegExif(bytes){
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  let offset=2;
  while(offset+4<bytes.length){
   if(bytes[offset]!==0xff){offset++;continue}
   const marker=bytes[offset+1],length=(bytes[offset+2]<<8)|bytes[offset+3];
   if(length<2||offset+2+length>bytes.length)break;
   if(marker===0xe1&&bytes[offset+4]===0x45&&bytes[offset+5]===0x78&&bytes[offset+6]===0x69&&bytes[offset+7]===0x66){
    return readTiff(bytes,offset+10);
   }
   if(marker===0xda||marker===0xd9)break;
   offset+=2+length;
  }
  return null;
 }
 $("v1ltExifFile")?.addEventListener("change",async()=>{
  const file=$("v1ltExifFile").files?.[0];if(!file)return;
  set("v1ltExifStatus","Membaca dimensi dan metadata foto…");
  try{
   const bitmap=await core.imageBitmap(file),bytes=new Uint8Array(await file.slice(0,5*1024*1024).arrayBuffer()),exif=readJpegExif(bytes),tags=exif?.tags||{};
   const orientation=tags[0x0112],date=tags[0x9003]||tags[0x0132];
   const pairs=[
    ["Nama file",file.name],["Ukuran",core.formatBytes(file.size)],["Format",file.type||"Tidak diketahui"],["Dimensi",bitmap.width+" × "+bitmap.height],
    ["Kamera",([tags[0x010f],tags[0x0110]].filter(Boolean).join(" ")||"Tidak tersedia")],
    ["Tanggal foto",date||"Tidak tersedia"],["Orientasi",orientation?String(orientation):"Tidak tersedia"],
    ["Software",tags[0x0131]||"Tidak tersedia"],["Lens model",tags[0xa434]||"Tidak tersedia"],
    ["ISO",tags[0x8827]||"Tidak tersedia"],["GPS metadata",exif?.gps?"Ada (koordinat disembunyikan)":"Tidak terdeteksi"],
    ["EXIF",exif?"Terbaca":"Tidak ada / format bukan JPEG"]
   ];
   bitmap.close?.();core.resultPairs("v1ltExifResult",pairs);set("v1ltExifStatus",exif?"EXIF berhasil dibaca. Koordinat GPS tidak ditampilkan.":"Dimensi foto berhasil dibaca; metadata EXIF tidak ditemukan atau format tidak didukung.","success");
  }catch(error){set("v1ltExifStatus",error.message||"Gagal membaca foto.","error")}
 });
 let paletteCss="";
 $("v1ltPaletteFile")?.addEventListener("change",async()=>{
  const file=$("v1ltPaletteFile").files?.[0];if(!file)return;
  set("v1ltPaletteStatus","Menganalisis warna dominan…");$("v1ltPaletteDownload").disabled=true;$("v1ltPaletteResult").replaceChildren();
  try{
   const bitmap=await core.imageBitmap(file),scale=Math.min(1,120/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
   const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,hist=new Map();
   for(let i=0;i<data.length;i+=4){if(data[i+3]<100)continue;const r=data[i]>>3,g=data[i+1]>>3,b=data[i+2]>>3,key=(r<<10)|(g<<5)|b;const item=hist.get(key)||{r:0,g:0,b:0,n:0};item.r+=data[i];item.g+=data[i+1];item.b+=data[i+2];item.n++;hist.set(key,item)}
   const sorted=[...hist.values()].sort((a,b)=>b.n-a.n),colors=[];
   for(const item of sorted){const color={r:Math.round(item.r/item.n),g:Math.round(item.g/item.n),b:Math.round(item.b/item.n)};if(colors.every(c=>Math.hypot(c.r-color.r,c.g-color.g,c.b-color.b)>34))colors.push(color);if(colors.length===8)break}
   if(!colors.length)throw new Error("Tidak ada piksel gambar yang dapat dianalisis.");
   const hex=c=>"#"+[c.r,c.g,c.b].map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();
   const result=$("v1ltPaletteResult");
   colors.forEach(color=>{const swatch=document.createElement("div");swatch.className="v1lt-swatch";const sample=document.createElement("i");sample.style.background=hex(color);const label=document.createElement("span");label.textContent=hex(color);swatch.append(sample,label);result.append(swatch)});
   paletteCss=":root {\n"+colors.map((color,index)=>"  --aryanzz-color-"+(index+1)+": "+hex(color)+";").join("\n")+"\n}\n";
   $("v1ltPaletteDownload").disabled=false;set("v1ltPaletteStatus","Berhasil menemukan "+colors.length+" warna dominan. Unduh file CSS untuk menyimpan palet.","success");
  }catch(error){set("v1ltPaletteStatus",error.message||"Gagal menganalisis gambar.","error")}
 });
 $("v1ltPaletteDownload")?.addEventListener("click",()=>{if(paletteCss)core.downloadBlob(new Blob([paletteCss],{type:"text/css;charset=utf-8"}),"aryanzz-color-palette.css")});
 const blurCanvas=$("v1ltBlurCanvas"),blurCtx=blurCanvas?.getContext("2d"),blurSource=document.createElement("canvas");
 let blurBitmap=null,blurStrokes=[],blurDrawing=null,blurScale=1;
 function renderBlur(){
  if(!blurBitmap)return;const w=blurCanvas.width,h=blurCanvas.height,ctx=blurCtx;
  ctx.clearRect(0,0,w,h);ctx.drawImage(blurSource,0,0);
  const mode=$("v1ltBlurMode").value,color=$("v1ltBlurColor").value;
  for(const stroke of blurStrokes){
   const radius=stroke.width/2;
   for(const point of stroke.points){
    ctx.save();ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.clip();
    if(stroke.mode==="solid"){ctx.fillStyle=stroke.color;ctx.fillRect(point.x-radius,point.y-radius,radius*2,radius*2)}
    else if(stroke.mode==="pixel"){
     const low=document.createElement("canvas");low.width=8;low.height=8;const lowCtx=low.getContext("2d");
     lowCtx.drawImage(blurSource,point.x-radius,point.y-radius,radius*2,radius*2,0,0,8,8);
     ctx.imageSmoothingEnabled=false;ctx.drawImage(low,point.x-radius,point.y-radius,radius*2,radius*2);ctx.imageSmoothingEnabled=true;
    }else{ctx.filter="blur("+Math.max(7,radius*.55)+"px)";ctx.drawImage(blurSource,0,0);ctx.filter="none"}
    ctx.restore();
   }
  }
  if(blurDrawing){const last=blurDrawing.points[blurDrawing.points.length-1];if(last){ctx.save();ctx.strokeStyle="rgba(112,175,255,.8)";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(last.x,last.y,blurDrawing.width/2,0,Math.PI*2);ctx.stroke();ctx.restore()}}
 }
 function blurPoint(event){
  const rect=blurCanvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*blurCanvas.width/rect.width,y:(event.clientY-rect.top)*blurCanvas.height/rect.height}
 }
 $("v1ltBlurFile")?.addEventListener("change",async()=>{
  const file=$("v1ltBlurFile").files?.[0];if(!file)return;
  try{
   blurBitmap=await core.imageBitmap(file);blurScale=Math.min(1,1600/Math.max(blurBitmap.width,blurBitmap.height));blurCanvas.width=Math.round(blurBitmap.width*blurScale);blurCanvas.height=Math.round(blurBitmap.height*blurScale);
   blurSource.width=blurCanvas.width;blurSource.height=blurCanvas.height;blurSource.getContext("2d").drawImage(blurBitmap,0,0,blurCanvas.width,blurCanvas.height);
   blurStrokes=[];blurDrawing=null;blurCanvas.hidden=false;["v1ltBlurUndo","v1ltBlurReset","v1ltBlurExport"].forEach(id=>$(id).disabled=false);renderBlur();set("v1ltBlurStatus","Gambar siap. Usapkan kuas pada bagian sensitif; gunakan Undo jika perlu.","success");
  }catch(error){set("v1ltBlurStatus",error.message,"error")}
 });
 $("v1ltBlurBrush")?.addEventListener("input",()=>{$("v1ltBlurBrushValue").textContent=$("v1ltBlurBrush").value+" px"});
 $("v1ltBlurMode")?.addEventListener("change",renderBlur);$("v1ltBlurColor")?.addEventListener("change",renderBlur);
 blurCanvas?.addEventListener("pointerdown",event=>{if(!blurBitmap)return;blurCanvas.setPointerCapture(event.pointerId);blurDrawing={mode:$("v1ltBlurMode").value,color:$("v1ltBlurColor").value,width:Number($("v1ltBlurBrush").value),points:[blurPoint(event)]};renderBlur()});
 blurCanvas?.addEventListener("pointermove",event=>{if(!blurDrawing||blurDrawing.points.length>=300)return;const point=blurPoint(event),last=blurDrawing.points[blurDrawing.points.length-1];if(Math.hypot(point.x-last.x,point.y-last.y)>Math.max(5,blurDrawing.width*.3))blurDrawing.points.push(point)});
 function finishBlur(){if(!blurDrawing)return;blurStrokes.push(blurDrawing);blurDrawing=null;renderBlur();$("v1ltBlurUndo").disabled=!blurStrokes.length}
 blurCanvas?.addEventListener("pointerup",finishBlur);blurCanvas?.addEventListener("pointercancel",finishBlur);
 $("v1ltBlurUndo")?.addEventListener("click",()=>{blurStrokes.pop();renderBlur();$("v1ltBlurUndo").disabled=!blurStrokes.length});
 $("v1ltBlurReset")?.addEventListener("click",()=>{blurStrokes=[];renderBlur();$("v1ltBlurUndo").disabled=true;set("v1ltBlurStatus","Semua goresan dihapus.","success")});
 $("v1ltBlurExport")?.addEventListener("click",async()=>{try{renderBlur();const blob=await core.canvasBlob(blurCanvas,"image/png");core.downloadBlob(blob,"aryanzz-privacy-blur.png");set("v1ltBlurStatus","Gambar hasil berhasil diekspor.","success")}catch(error){set("v1ltBlurStatus",error.message,"error")}});
 const stickerCanvas=$("v1ltStickerCanvas"),stickerCtx=stickerCanvas?.getContext("2d"),stickerBase=document.createElement("canvas");
 let stickerBitmap=null,stickerDrawing=false,stickerPoint=null,stickerScale=1;
 function stickerCoords(event){const rect=stickerCanvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*stickerCanvas.width/rect.width,y:(event.clientY-rect.top)*stickerCanvas.height/rect.height}}
 function stickerBrush(point){
  const ctx=stickerCtx,r=Number($("v1ltStickerBrush").value)/2,mode=$("v1ltStickerMode").value;
  ctx.save();ctx.beginPath();ctx.arc(point.x,point.y,r,0,Math.PI*2);ctx.clip();
  if(mode==="erase"){ctx.globalCompositeOperation="destination-out";ctx.fillStyle="#000";ctx.fillRect(point.x-r,point.y-r,r*2,r*2)}
  else{ctx.globalCompositeOperation="source-over";ctx.drawImage(stickerBase,0,0)}
  ctx.restore();
 }
 function stickerRender(){if(!stickerBitmap)return;stickerCtx.clearRect(0,0,stickerCanvas.width,stickerCanvas.height);stickerCtx.drawImage(stickerBase,0,0);if(stickerDrawing&&stickerPoint){stickerCtx.save();stickerCtx.strokeStyle="rgba(112,175,255,.8)";stickerCtx.lineWidth=1.5;stickerCtx.beginPath();stickerCtx.arc(stickerPoint.x,stickerPoint.y,Number($("v1ltStickerBrush").value)/2,0,Math.PI*2);stickerCtx.stroke();stickerCtx.restore()}}
 $("v1ltStickerFile")?.addEventListener("change",async()=>{
  const file=$("v1ltStickerFile").files?.[0];if(!file)return;
  try{
   stickerBitmap=await core.imageBitmap(file);stickerScale=Math.min(1,1600/Math.max(stickerBitmap.width,stickerBitmap.height));
   stickerCanvas.width=Math.round(stickerBitmap.width*stickerScale);stickerCanvas.height=Math.round(stickerBitmap.height*stickerScale);
   stickerBase.width=stickerCanvas.width;stickerBase.height=stickerCanvas.height;stickerBase.getContext("2d").drawImage(stickerBitmap,0,0,stickerCanvas.width,stickerCanvas.height);
   stickerCanvas.hidden=false;stickerRender();$("v1ltStickerReset").disabled=false;$("v1ltStickerExport").disabled=false;set("v1ltStickerStatus","Gambar siap. Hapus latar dengan kuas, atau langsung tambahkan outline.","success");
  }catch(error){set("v1ltStickerStatus",error.message,"error")}
 });
 $("v1ltStickerBrush")?.addEventListener("input",()=>{$("v1ltStickerBrushValue").textContent=$("v1ltStickerBrush").value+" px"});
 $("v1ltStickerOutline")?.addEventListener("input",()=>{$("v1ltStickerOutlineValue").textContent=$("v1ltStickerOutline").value+" px"});
 stickerCanvas?.addEventListener("pointerdown",event=>{if(!stickerBitmap)return;stickerCanvas.setPointerCapture(event.pointerId);stickerDrawing=true;stickerPoint=stickerCoords(event);stickerBrush(stickerPoint)});
 stickerCanvas?.addEventListener("pointermove",event=>{if(!stickerDrawing)return;const point=stickerCoords(event);if(!stickerPoint||Math.hypot(point.x-stickerPoint.x,point.y-stickerPoint.y)>Math.max(2,Number($("v1ltStickerBrush").value)*.18)){stickerPoint=point;stickerBrush(point)}});
 function endSticker(){stickerDrawing=false;stickerPoint=null;}
 stickerCanvas?.addEventListener("pointerup",endSticker);stickerCanvas?.addEventListener("pointercancel",endSticker);
 $("v1ltStickerReset")?.addEventListener("click",()=>{if(!stickerBitmap)return;stickerCtx.clearRect(0,0,stickerCanvas.width,stickerCanvas.height);stickerCtx.drawImage(stickerBase,0,0);set("v1ltStickerStatus","Gambar dikembalikan ke file awal.","success")});
 $("v1ltStickerExport")?.addEventListener("click",async()=>{
  try{
   if(!stickerBitmap)throw new Error("Pilih gambar terlebih dahulu.");
   const edited=document.createElement("canvas");edited.width=stickerCanvas.width;edited.height=stickerCanvas.height;edited.getContext("2d").drawImage(stickerCanvas,0,0);
   const outline=Number($("v1ltStickerOutline").value),pad=outline+22,out=document.createElement("canvas");out.width=edited.width+pad*2;out.height=edited.height+pad*2;
   const outCtx=out.getContext("2d"),silhouette=document.createElement("canvas");silhouette.width=out.width;silhouette.height=out.height;const sctx=silhouette.getContext("2d");
   const steps=outline>0?Math.min(64,Math.max(12,Math.ceil(outline*2))):0;
   for(let i=0;i<steps;i++){const angle=i/steps*Math.PI*2;sctx.drawImage(edited,pad+Math.cos(angle)*outline,pad+Math.sin(angle)*outline)}
   if(outline>0){sctx.globalCompositeOperation="source-in";sctx.fillStyle=$("v1ltStickerColor").value;sctx.fillRect(0,0,silhouette.width,silhouette.height);sctx.globalCompositeOperation="source-over"}
   if($("v1ltStickerShadow").checked){outCtx.shadowColor="rgba(0,0,0,.35)";outCtx.shadowBlur=15;outCtx.shadowOffsetY=5;outCtx.drawImage(silhouette,0,0);outCtx.shadowColor="transparent";outCtx.shadowBlur=0;outCtx.shadowOffsetY=0}
   outCtx.drawImage(silhouette,0,0);outCtx.drawImage(edited,pad,pad);
   const blob=await core.canvasBlob(out,"image/png");core.downloadBlob(blob,"aryanzz-sticker.png");set("v1ltStickerStatus","Stiker PNG berhasil dibuat dengan latar transparan.","success");
  }catch(error){set("v1ltStickerStatus",error.message||"Gagal mengekspor stiker.","error")}
 });
});
})();