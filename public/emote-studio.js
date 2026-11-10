(()=>{"use strict";
const root=document.getElementById("emoteStudio");
if(!root)return;
function initialize(){
const $=id=>root.querySelector("#"+id);
const qa=(selector,scope=root)=>[...scope.querySelectorAll(selector)];
const state={image:null,imageName:"",strokes:[],objects:[],tool:"move",selected:-1,gesture:null,aiBlob:null,aiUrl:"",libraryDb:null,ffmpeg:null,ffmpegPromise:null,videoUrl:"",videoFile:null,videoRaf:0,gifUrl:"",videoResultUrl:"",busy:false};
let markupReady=false;
const canvas=$("emoteCanvas"),ctx=canvas?.getContext("2d");
const video=$("emoteVideoPreview"),videoCanvas=$("emoteVideoCanvas"),videoCtx=videoCanvas?.getContext("2d");
const MAX_IMAGE=20*1024*1024,MAX_VIDEO=35*1024*1024,MAX_VIDEO_SECONDS=60;
const CDN_MODULES=["https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js","https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js"];
const CDN_CORES=["https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm","https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm"];
const say=(id,message,type="info")=>{const el=$(id);if(el){el.textContent=String(message||"");el.dataset.state=type}};
const sizeText=n=>{if(!Number.isFinite(n)||n<=0)return"0 B";const units=["B","KB","MB","GB"],i=Math.min(3,Math.floor(Math.log(n)/Math.log(1024)));return(n/Math.pow(1024,i)).toFixed(i?1:0)+" "+units[i]};
const safeName=value=>String(value||"aryanzz-emote").normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().replace(/\.[^.]+$/,"").slice(0,70)||"aryanzz-emote";
function setTab(name){
 qa("[data-emote-tab]").forEach(button=>{const active=button.dataset.emoteTab===name;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active))});
 qa("[data-emote-view]").forEach(view=>view.hidden=view.dataset.emoteView!==name);
 if(name==="library")refreshLibrary();
 if(name==="motion")drawVideoOverlay();
}
qa("[data-emote-tab]").forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.emoteTab)));
function loadImageBitmap(file){
 return new Promise((resolve,reject)=>{
  if(!file||!/^image\/(png|jpeg|webp|gif|avif)$/i.test(file.type)){reject(new Error("Pilih gambar PNG, JPG, WEBP, GIF, atau AVIF."));return}
  if(file.size>MAX_IMAGE){reject(new Error("Gambar melebihi batas 20 MB."));return}
  createImageBitmap(file).then(resolve,reject);
 });
}
function imageRect(bitmap){
 const margin=canvas.width*.12,available=canvas.width-margin*2,scale=Math.min(available/bitmap.width,available/bitmap.height,1.5);
 const w=bitmap.width*scale,h=bitmap.height*scale;
 return{x:(canvas.width-w)/2,y:(canvas.height-h)/2,w,h};
}
function drawStrokeLayer(target){
 const c=target.getContext("2d");
 for(const stroke of state.strokes){
  if(!stroke.points.length)continue;
  c.save();c.lineCap="round";c.lineJoin="round";c.lineWidth=stroke.width;
  c.globalCompositeOperation=stroke.mode==="erase"?"destination-out":"source-over";
  c.strokeStyle=stroke.color;c.fillStyle=stroke.color;
  if(stroke.points.length===1){c.beginPath();c.arc(stroke.points[0].x,stroke.points[0].y,stroke.width/2,0,Math.PI*2);c.fill()}
  else{c.beginPath();c.moveTo(stroke.points[0].x,stroke.points[0].y);for(const point of stroke.points.slice(1))c.lineTo(point.x,point.y);c.stroke()}
  c.restore();
 }
}
function drawObjects(target,showSelection=false){
 const c=target.getContext("2d");
 state.objects.forEach((item,index)=>{
  c.save();c.translate(item.x,item.y);c.rotate(item.rotation||0);
  if(item.type==="text"){
   c.font="900 "+item.size+"px system-ui, sans-serif";c.textAlign="center";c.textBaseline="middle";
   c.lineJoin="round";c.strokeStyle=item.outline||"#ffffff";c.lineWidth=Math.max(5,item.size*.16);c.strokeText(item.text,0,0,canvas.width*.85);
   c.fillStyle=item.color||"#ffffff";c.fillText(item.text,0,0,canvas.width*.85);
   if(showSelection&&index===state.selected){const width=Math.min(canvas.width*.88,c.measureText(item.text).width+24);c.setLineDash([8,6]);c.lineWidth=2;c.strokeStyle="#4d91ff";c.strokeRect(-width/2,-item.size*.72,width,item.size*1.45)}
  }else{
   c.font=item.size+"px system-ui, Apple Color Emoji, Segoe UI Emoji";c.textAlign="center";c.textBaseline="middle";c.fillText(item.text,0,0);
   if(showSelection&&index===state.selected){c.setLineDash([8,6]);c.lineWidth=2;c.strokeStyle="#4d91ff";c.strokeRect(-item.size*.65,-item.size*.65,item.size*1.3,item.size*1.3)}
  }
  c.restore();
 });
}
function renderCanvas(showSelection=true){
 if(!canvas||!ctx)return;
 const work=document.createElement("canvas");work.width=canvas.width;work.height=canvas.height;
 const wctx=work.getContext("2d");
 if(state.image){const r=imageRect(state.image);wctx.drawImage(state.image,r.x,r.y,r.w,r.h)}
 drawStrokeLayer(work);
 ctx.clearRect(0,0,canvas.width,canvas.height);
 const outlineSize=$("emoteOutlineEnabled")?.checked?Number($("emoteOutlineSize")?.value||0):0;
 if(outlineSize>0){
  const mask=document.createElement("canvas");mask.width=canvas.width;mask.height=canvas.height;
  const mctx=mask.getContext("2d");mctx.drawImage(work,0,0);mctx.globalCompositeOperation="source-in";mctx.fillStyle="#ffffff";mctx.fillRect(0,0,mask.width,mask.height);
  const steps=Math.max(12,Math.min(40,Math.round(outlineSize*2.2)));
  for(let i=0;i<steps;i++){const angle=i/steps*Math.PI*2;ctx.drawImage(mask,Math.cos(angle)*outlineSize,Math.sin(angle)*outlineSize)}
 }
 ctx.drawImage(work,0,0);drawObjects(canvas,showSelection);
 const empty=$("emoteCanvasEmpty");if(empty)empty.hidden=!!state.image||state.strokes.length>0||state.objects.length>0;
 drawVideoOverlay();
}
function canvasPoint(event){
 const rect=canvas.getBoundingClientRect();
 return{x:(event.clientX-rect.left)/rect.width*canvas.width,y:(event.clientY-rect.top)/rect.height*canvas.height};
}
function hitObject(point){
 for(let i=state.objects.length-1;i>=0;i--){
  const item=state.objects[i],half=item.type==="text"?Math.max(item.size*1.4,(item.text.length||1)*item.size*.3):item.size*.8;
  if(Math.abs(point.x-item.x)<=half&&Math.abs(point.y-item.y)<=item.size*.85)return i;
 }
 return -1;
}
function setTool(tool){
 state.tool=tool;qa("[data-emote-tool]").forEach(button=>button.classList.toggle("active",button.dataset.emoteTool===tool));
 canvas.style.cursor=tool==="move"?"grab":tool==="erase"?"cell":"crosshair";
}
qa("[data-emote-tool]").forEach(button=>button.addEventListener("click",()=>setTool(button.dataset.emoteTool)));
canvas?.addEventListener("pointerdown",event=>{
 if(state.busy)return;
 const point=canvasPoint(event);canvas.setPointerCapture?.(event.pointerId);
 if(state.tool==="move"){
  const index=hitObject(point);state.selected=index;
  if(index>=0){const item=state.objects[index];state.gesture={kind:"move",index,dx:point.x-item.x,dy:point.y-item.y};canvas.style.cursor="grabbing"}
  renderCanvas();return;
 }
 state.selected=-1;state.gesture={kind:"stroke",stroke:{mode:state.tool==="erase"?"erase":"draw",color:$("emoteBrushColor").value,width:Number($("emoteBrushSize").value),points:[point]}};
 state.strokes.push(state.gesture.stroke);renderCanvas();
});
canvas?.addEventListener("pointermove",event=>{
 if(!state.gesture)return;const point=canvasPoint(event);
 if(state.gesture.kind==="move"){const item=state.objects[state.gesture.index];if(item){item.x=point.x-state.gesture.dx;item.y=point.y-state.gesture.dy}}
 else state.gesture.stroke.points.push(point);
 renderCanvas();
});
function finishGesture(){if(state.gesture?.kind==="move")canvas.style.cursor="grab";state.gesture=null}
canvas?.addEventListener("pointerup",finishGesture);canvas?.addEventListener("pointercancel",finishGesture);canvas?.addEventListener("lostpointercapture",finishGesture);
$("emoteBrushSize")?.addEventListener("input",()=>{$("emoteBrushValue").textContent=$("emoteBrushSize").value+" px"});
$("emoteOutlineSize")?.addEventListener("input",()=>{$("emoteOutlineValue").textContent=$("emoteOutlineSize").value+" px";renderCanvas()});
$("emoteOutlineEnabled")?.addEventListener("change",()=>renderCanvas());
$("emoteAddText")?.addEventListener("click",()=>{
 const text=$("emoteTextInput").value.trim();if(!text){say("emoteEditorStatus","Tulis teks terlebih dahulu.","error");return}
 state.objects.push({type:"text",text,x:canvas.width/2,y:canvas.height*.78,size:Number($("emoteTextSize").value),color:$("emoteTextColor").value,outline:"#ffffff",rotation:0});state.selected=state.objects.length-1;renderCanvas();say("emoteEditorStatus","Teks ditambahkan. Geser teks di kanvas untuk mengatur posisi.","success");
});
$("emoteAddEmoji")?.addEventListener("click",()=>{
 state.objects.push({type:"emoji",text:$("emoteEmoji").value,x:canvas.width/2,y:canvas.height/2,size:110,rotation:0});state.selected=state.objects.length-1;renderCanvas();say("emoteEditorStatus","Emoji ditambahkan. Geser untuk mengatur posisi.","success");
});
$("emoteUndoBtn")?.addEventListener("click",()=>{
 if(state.objects.length){state.objects.pop();state.selected=-1}
 else if(state.strokes.length)state.strokes.pop();
 renderCanvas();say("emoteEditorStatus","Edit terakhir diurungkan.");
});
$("emoteClearBtn")?.addEventListener("click",()=>{
 if(!confirm("Hapus semua coretan dan objek dari kanvas? Gambar sumber tetap ada."))return;
 state.strokes=[];state.objects=[];state.selected=-1;renderCanvas();say("emoteEditorStatus","Edit kanvas dibersihkan.");
});
async function loadIntoEditor(file,fromAI=false){
 try{
  const bitmap=await loadImageBitmap(file);
  state.image?.close?.();state.image=bitmap;state.imageName=file.name||"aryanzz-ai-emote";state.strokes=[];state.objects=[];state.selected=-1;
  renderCanvas();say("emoteEditorStatus",(fromAI?"Hasil AI dimuat":"Gambar dimuat")+" · "+bitmap.width+" × "+bitmap.height+" px. File diproses lokal.","success");
  setTab("editor");
 }catch(error){say("emoteEditorStatus",error.message||"Gambar gagal dibuka.","error")}
}
$("emoteEditorFile")?.addEventListener("change",event=>{const file=event.target.files?.[0];if(file)loadIntoEditor(file);event.target.value=""});
function canvasBlob(type="image/png",quality=.92){
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Browser gagal membuat file hasil.")),type,quality));
}
function downloadBlob(blob,name){
 if(!(blob instanceof Blob)||!blob.size)throw new Error("Hasil kosong dan tidak dapat diunduh.");
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.rel="noopener";a.style.display="none";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function exportImage(type){
 try{const blob=await canvasBlob(type);downloadBlob(blob,safeName(state.imageName||"aryanzz-emote")+"."+(type==="image/webp"?"webp":"png"));say("emoteEditorStatus","Ekspor "+type.split("/")[1].toUpperCase()+" selesai · "+sizeText(blob.size)+".","success")}
 catch(error){say("emoteEditorStatus",error.message||"Ekspor gambar gagal.","error")}
}
$("emoteExportPng")?.addEventListener("click",()=>exportImage("image/png"));
$("emoteExportWebp")?.addEventListener("click",()=>exportImage("image/webp"));
function openLibraryDb(){
 if(state.libraryDb)return Promise.resolve(state.libraryDb);
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open("aryanzz-emote-studio-v1",1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("stickers"))db.createObjectStore("stickers",{keyPath:"id",autoIncrement:true})};
  request.onsuccess=()=>{state.libraryDb=request.result;resolve(state.libraryDb)};
  request.onerror=()=>reject(request.error||new Error("Pustaka lokal tidak dapat dibuka."));
 });
}
async function saveSticker(){
 try{
  const blob=await canvasBlob("image/png");
  const db=await openLibraryDb();
  const record={name:safeName(state.imageName||"aryanzz-emote"),blob,mimeType:"image/png",width:canvas.width,height:canvas.height,createdAt:Date.now()};
  await new Promise((resolve,reject)=>{const tx=db.transaction("stickers","readwrite");tx.objectStore("stickers").add(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error("Gagal menyimpan stiker."))});
  say("emoteEditorStatus","Stiker disimpan di Pustaka lokal perangkat · "+sizeText(blob.size)+".","success");
 }catch(error){say("emoteEditorStatus",error.message||"Tidak dapat menyimpan stiker.","error")}
}
$("emoteSaveSticker")?.addEventListener("click",saveSticker);
async function refreshLibrary(){
 const grid=$("emoteLibraryGrid");if(!grid)return;grid.replaceChildren();
 try{
  const db=await openLibraryDb();
  const records=await new Promise((resolve,reject)=>{const req=db.transaction("stickers","readonly").objectStore("stickers").getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});
  records.sort((a,b)=>b.createdAt-a.createdAt);
  if(!records.length){const empty=document.createElement("div");empty.className="emote-empty-art";empty.innerHTML="<span>▤</span><b>Belum ada stiker tersimpan</b><small>Simpan hasil dari Editor untuk mengisinya.</small>";grid.append(empty);return}
  records.forEach(record=>{
   const card=document.createElement("article");card.className="emote-library-item";
   const image=document.createElement("img"),url=URL.createObjectURL(record.blob);image.src=url;image.alt=record.name;
   image.addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});
   const title=document.createElement("b");title.textContent=record.name;
   const actions=document.createElement("div");actions.className="emote-library-actions";
   const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";
   edit.addEventListener("click",()=>loadIntoEditor(new File([record.blob],record.name+".png",{type:"image/png"})));
   const save=document.createElement("button");save.type="button";save.textContent="Unduh";
   save.addEventListener("click",()=>downloadBlob(record.blob,record.name+".png"));
   const remove=document.createElement("button");remove.type="button";remove.textContent="Hapus";
   remove.addEventListener("click",async()=>{if(!confirm("Hapus stiker ini dari pustaka lokal?"))return;await new Promise((resolve,reject)=>{const tx=db.transaction("stickers","readwrite");tx.objectStore("stickers").delete(record.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});refreshLibrary()});
   actions.append(edit,save,remove);card.append(image,title,actions);grid.append(card);
  });
 }catch(error){const note=document.createElement("p");note.className="emote-status";note.textContent=error.message||"Pustaka belum dapat dibaca.";grid.append(note)}
}
$("emoteRefreshLibrary")?.addEventListener("click",refreshLibrary);

function bytesToBlob(base64,mime){
 const binary=atob(base64),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new Blob([bytes],{type:mime||"image/png"});
}
async function checkAiStatus(){
 const badge=$("emoteAiAvailability"),button=$("emoteGenerateBtn");
 try{
  const response=await fetch("/api/emote/status",{cache:"no-store"}),data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||"Status AI tidak tersedia.");
  if(data.configured){badge.textContent="AI SIAP";badge.dataset.state="ready";button.disabled=false;say("emoteAiStatus","AI aktif · "+(data.model||"image model")+" · penggunaan dapat dikenakan biaya API.","success")}
  else{badge.textContent="AI BELUM DIATUR";badge.dataset.state="pending";button.disabled=true;say("emoteAiStatus","Editor manual tetap aktif. Untuk AI, pemilik perlu memasang Secret OPENAI_API_KEY pada Cloudflare Worker. Kunci tidak dimasukkan ke browser.","error")}
 }catch(error){badge.textContent="AI TIDAK TERHUBUNG";badge.dataset.state="error";button.disabled=true;say("emoteAiStatus","Status AI belum dapat diperiksa. Editor lokal tetap bisa digunakan. "+(error.message||""),"error")}
}
$("emoteCreateMode")?.addEventListener("change",()=>{
 const photo=$("emoteCreateMode").value==="photo";$("emotePhotoWrap").hidden=!photo;
});
$("emotePrompt")?.addEventListener("input",()=>{$("emotePromptCount").textContent=$("emotePrompt").value.length+"/900"});
$("emoteGenerateBtn")?.addEventListener("click",async()=>{
 if(state.busy)return;
 const prompt=$("emotePrompt").value.trim(),mode=$("emoteCreateMode").value,photo=$("emoteReferenceFile").files?.[0];
 if(prompt.length<8){say("emoteAiStatus","Tulis deskripsi karakter minimal 8 karakter.","error");return}
 if(mode==="photo"&&!photo){say("emoteAiStatus","Pilih foto referensi terlebih dahulu.","error");return}
 if(photo&&photo.size>8*1024*1024){say("emoteAiStatus","Foto referensi maksimal 8 MB.","error");return}
 state.busy=true;const button=$("emoteGenerateBtn");button.disabled=true;button.textContent="Membuat karakter…";say("emoteAiStatus","Mengirim permintaan ke layanan AI. Proses dapat memerlukan waktu hingga 2 menit…");
 try{
  const style=$("emoteStyle").value;
  const finalPrompt=prompt+". Style: "+style+". Create one single full-body character as a clean die-cut sticker, centered with comfortable margins, expressive clear pose, polished consistent character design, thick clean white sticker outline, transparent background, no captions, no lettering, no watermark.";
  const form=new FormData();form.set("mode",mode==="photo"?"edit":"generate");form.set("prompt",finalPrompt);form.set("output_format","png");if(photo)form.set("image",photo,photo.name);
  const response=await fetch("/api/emote/generate",{method:"POST",body:form,signal:AbortSignal.timeout?AbortSignal.timeout(150000):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||"Layanan AI gagal membuat gambar (HTTP "+response.status+").");
  const blob=bytesToBlob(data.imageBase64,data.mimeType||"image/png");
  state.aiBlob=blob;
  if(state.aiUrl)URL.revokeObjectURL(state.aiUrl);
  state.aiUrl=URL.createObjectURL(blob);
  $("emoteAiImage").src=state.aiUrl;$("emoteAiImage").hidden=false;
  $("emoteAiPreview").querySelector(".emote-empty-art")?.remove();
  $("emoteAiActions").hidden=false;$("emoteAiDownload").href=state.aiUrl;$("emoteAiDownload").download="aryanzz-emote.png";
  say("emoteAiStatus","Karakter berhasil dibuat · "+sizeText(blob.size)+" · model "+(data.model||"AI image")+".","success");
 }catch(error){say("emoteAiStatus",error.message||"Gagal membuat karakter. Coba lagi.","error")}
 finally{state.busy=false;button.disabled=false;button.textContent="✦ Generate Karakter";checkAiStatus()}
});
$("emoteUseAiImage")?.addEventListener("click",()=>{if(state.aiBlob)loadIntoEditor(new File([state.aiBlob],"aryanzz-ai-emote.png",{type:"image/png"}),true)});
async function loadFfmpeg(statusId){
 if(state.ffmpeg?.loaded)return state.ffmpeg;
 if(state.ffmpegPromise)return state.ffmpegPromise;
 state.ffmpegPromise=(async()=>{
  let lastError=null;
  for(const moduleUrl of CDN_MODULES){
   let instance=null;
   try{
    say(statusId,"Memuat modul ekspor GIF/MP4…");
    const mod=await import(moduleUrl);if(typeof mod.FFmpeg!=="function")throw new Error("Kelas FFmpeg tidak ditemukan.");
    const workerUrl=new URL("/ffmpeg-worker-bootstrap.js?v=92.2",location.origin).href;
    for(const base of CDN_CORES){
     instance=new mod.FFmpeg();
     try{
      await Promise.race([
       instance.load({classWorkerURL:workerUrl,coreURL:base+"/ffmpeg-core.js",wasmURL:base+"/ffmpeg-core.wasm"}),
       new Promise((_,reject)=>setTimeout(()=>reject(new Error("Mesin ekspor belum siap setelah 75 detik.")),75000))
      ]);
      if(instance.loaded){state.ffmpeg=instance;return instance}
     }catch(error){lastError=error;try{instance.terminate()}catch{}instance=null}
    }
   }catch(error){lastError=error;if(instance)try{instance.terminate()}catch{}}
  }
  throw new Error("Mesin ekspor gagal dimuat dari CDN utama maupun cadangan. Periksa koneksi internet lalu coba lagi. "+String(lastError?.message||""));
 })().catch(error=>{state.ffmpegPromise=null;throw error});
 return state.ffmpegPromise;
}
function animationTransform(c,t,preset){
 const angle=t*Math.PI*2;let scale=1,x=0,y=0,rotation=0;
 if(preset==="bounce")y=-Math.abs(Math.sin(angle))*26;
 else if(preset==="float")y=Math.sin(angle)*18;
 else if(preset==="pulse")scale=1+Math.sin(angle)*.07;
 else if(preset==="shake")rotation=Math.sin(angle*3)*.055;
 else if(preset==="spin")rotation=angle;
 c.translate(c.canvas.width/2+x,c.canvas.height/2+y);c.rotate(rotation);c.scale(scale,scale);c.drawImage(canvas,-c.canvas.width/2,-c.canvas.height/2,c.canvas.width,c.canvas.height);
}
async function exportGif(){
 const button=$("emoteExportGif");if(button.disabled)return;
 if(!state.image&&!state.strokes.length&&!state.objects.length){say("emoteMotionStatus","Buat atau unggah stiker di Editor terlebih dahulu.","error");return}
 button.disabled=true;button.textContent="Merender GIF…";$("emoteMotionProgress").hidden=false;$("emoteMotionProgressFill").style.width="5%";
 try{
  const ffmpeg=await loadFfmpeg("emoteMotionStatus"),duration=Number($("emoteGifDuration").value)||2,fps=12,frames=Math.max(12,Math.round(duration*fps)),size=512,preset=$("emoteMotionPreset").value;
  for(let i=0;i<frames;i++){
   const frame=document.createElement("canvas");frame.width=size;frame.height=size;const c=frame.getContext("2d");
   animationTransform(c,i/frames,preset);
   const blob=await new Promise((resolve,reject)=>frame.toBlob(value=>value?resolve(value):reject(new Error("Gagal membuat frame GIF.")),"image/png"));
   await ffmpeg.writeFile("emote-frame-"+String(i).padStart(3,"0")+".png",new Uint8Array(await blob.arrayBuffer()));
   $("emoteMotionProgressFill").style.width=(8+Math.round((i+1)/frames*65))+"%";
  }
  const inputPattern="emote-frame-%03d.png";
  try{
   await ffmpeg.exec(["-framerate",String(fps),"-i",inputPattern,"-vf","split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse","-loop","0","aryanzz-emote.gif"]);
  }catch{
   await ffmpeg.exec(["-framerate",String(fps),"-i",inputPattern,"-vf","scale=512:512:flags=lanczos","-loop","0","aryanzz-emote.gif"]);
  }
  const result=await ffmpeg.readFile("aryanzz-emote.gif");const blob=new Blob([result],{type:"image/gif"});
  if(!blob.size)throw new Error("GIF yang dihasilkan kosong.");
  if(state.gifUrl)URL.revokeObjectURL(state.gifUrl);state.gifUrl=URL.createObjectURL(blob);
  $("emoteGifPreview").src=state.gifUrl;$("emoteGifPreview").hidden=false;$("emoteGifEmpty").hidden=true;
  const link=$("emoteGifDownload");link.href=state.gifUrl;link.download=safeName(state.imageName)+".gif";link.hidden=false;
  $("emoteMotionProgressFill").style.width="100%";say("emoteMotionStatus","GIF selesai · "+frames+" frame · "+sizeText(blob.size)+".","success");
  for(let i=0;i<frames;i++)try{await ffmpeg.deleteFile("emote-frame-"+String(i).padStart(3,"0")+".png")}catch{}
  try{await ffmpeg.deleteFile("aryanzz-emote.gif")}catch{}
 }catch(error){say("emoteMotionStatus",error.message||"Gagal mengekspor GIF.","error")}
 finally{button.disabled=false;button.textContent="▶ Buat GIF bergerak";setTimeout(()=>$("emoteMotionProgress").hidden=true,1800)}
}
$("emoteExportGif")?.addEventListener("click",exportGif);
function drawVideoOverlay(){
 if(!videoCanvas||!videoCtx)return;
 const w=videoCanvas.width,h=videoCanvas.height;videoCtx.clearRect(0,0,w,h);
 if(canvas&&video.readyState>=2&&state.videoFile){
  const ratio=canvas.width/canvas.height,scale=Number($("emoteVideoScale")?.value||22)/100;
  const stickerW=Math.min(w*.7,w*scale),stickerH=stickerW/ratio;
  const x=(w-stickerW)*(Number($("emoteVideoX")?.value||76)/100),y=(h-stickerH)*(Number($("emoteVideoY")?.value||76)/100);
  videoCtx.drawImage(canvas,x,y,stickerW,stickerH);
 }
 if(video.readyState>=2&&state.videoFile)state.videoRaf=requestAnimationFrame(drawVideoOverlay);
}
function stopVideoLoop(){if(state.videoRaf)cancelAnimationFrame(state.videoRaf);state.videoRaf=0}
$("emoteVideoScale")?.addEventListener("input",()=>{$("emoteVideoScaleValue").textContent=$("emoteVideoScale").value+"%";drawVideoOverlay()});
["emoteVideoX","emoteVideoY"].forEach(id=>$(id)?.addEventListener("input",drawVideoOverlay));
$("emoteVideoFile")?.addEventListener("change",event=>{
 const file=event.target.files?.[0];event.target.value="";if(!file)return;
 if(!file.type.startsWith("video/")){say("emoteVideoStatus","Pilih file video yang valid.","error");return}
 if(file.size>MAX_VIDEO){say("emoteVideoStatus","Video melebihi batas 35 MB agar aman diproses di HP.","error");return}
 if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);
 state.videoFile=file;state.videoUrl=URL.createObjectURL(file);video.src=state.videoUrl;video.load();
 $("emoteVideoEmpty").hidden=true;$("emoteExportMp4").disabled=true;say("emoteVideoStatus","Memuat metadata video…");
});
video?.addEventListener("loadedmetadata",()=>{
 if(video.duration>MAX_VIDEO_SECONDS){state.videoFile=null;$("emoteExportMp4").disabled=true;say("emoteVideoStatus","Durasi video maksimal 60 detik. Potong video terlebih dahulu.","error");video.removeAttribute("src");video.load();return}
 const scale=Math.min(1,1280/video.videoWidth);videoCanvas.width=Math.max(1,Math.round(video.videoWidth*scale));videoCanvas.height=Math.max(1,Math.round(video.videoHeight*scale));
 $("emoteExportMp4").disabled=false;say("emoteVideoStatus","Video siap · "+video.videoWidth+" × "+video.videoHeight+" · "+video.duration.toFixed(1)+" detik. Atur posisi stiker lalu ekspor.","success");drawVideoOverlay();
});
video?.addEventListener("play",drawVideoOverlay);video?.addEventListener("pause",()=>{drawVideoOverlay()});
async function exportVideoMp4(){
 const button=$("emoteExportMp4");if(button.disabled||!state.videoFile)return;
 if(!state.image&&!state.strokes.length&&!state.objects.length){say("emoteVideoStatus","Buat stiker di Editor terlebih dahulu.","error");return}
 if(!window.MediaRecorder||!videoCanvas.captureStream){say("emoteVideoStatus","Browser ini belum mendukung rekam kanvas. Gunakan Chrome atau Safari versi terbaru.","error");return}
 button.disabled=true;button.textContent="Merekam video…";stopVideoLoop();
 let canvasStream=null,sourceStream=null,recorder=null;
 try{
  const types=["video/mp4;codecs=avc1.42E01E","video/mp4","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"];
  const mime=types.find(type=>MediaRecorder.isTypeSupported(type))||"";
  canvasStream=videoCanvas.captureStream(24);
  const capture=video.captureStream||video.mozCaptureStream;
  if(capture){try{sourceStream=capture.call(video);sourceStream.getAudioTracks().forEach(track=>canvasStream.addTrack(track))}catch{}}
  const chunks=[];
  recorder=new MediaRecorder(canvasStream,mime?{mimeType:mime,videoBitsPerSecond:2500000}:undefined);
  const stopped=new Promise((resolve,reject)=>{
   recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
   recorder.onerror=event=>reject(event.error||new Error("Perekaman video gagal."));
   recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||mime||"video/webm"}));
  });
  video.pause();video.currentTime=0;await new Promise(resolve=>{if(video.readyState>=2)resolve();else video.addEventListener("seeked",resolve,{once:true})});
  recorder.start(700);
  try{video.muted=false;await video.play()}catch{video.muted=true;await video.play()}
  say("emoteVideoStatus","Merekam video dan overlay stiker…");
  await Promise.race([new Promise(resolve=>video.addEventListener("ended",resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,Math.min(MAX_VIDEO_SECONDS,video.duration||MAX_VIDEO_SECONDS)*1000+3000))]);
  if(recorder.state!=="inactive")recorder.stop();
  let blob=await stopped;
  video.pause();video.muted=true;stopVideoLoop();
  if(!blob.size)throw new Error("Rekaman video kosong.");
  let filename="aryanzz-emote-video.mp4";
  if(!blob.type.includes("mp4")){
   button.textContent="Mengubah ke MP4…";say("emoteVideoStatus","Mengonversi rekaman ke MP4. Proses dapat berat pada HP dengan RAM kecil…");
   const ffmpeg=await loadFfmpeg("emoteVideoStatus");
   await ffmpeg.writeFile("emote-video-input.webm",new Uint8Array(await blob.arrayBuffer()));
   try{
    await ffmpeg.exec(["-i","emote-video-input.webm","-c:v","mpeg4","-q:v","5","-pix_fmt","yuv420p","-c:a","aac","-b:a","96k","-movflags","+faststart","aryanzz-emote-video.mp4"]);
   }catch{
    await ffmpeg.exec(["-i","emote-video-input.webm","-c:v","mpeg4","-q:v","5","-pix_fmt","yuv420p","-an","-movflags","+faststart","aryanzz-emote-video.mp4"]);
    say("emoteVideoStatus","MP4 selesai. Browser/encoder tidak menyediakan audio yang kompatibel, jadi hasil ini tanpa suara.","info");
   }
   const bytes=await ffmpeg.readFile("aryanzz-emote-video.mp4");blob=new Blob([bytes],{type:"video/mp4"});
   try{await ffmpeg.deleteFile("emote-video-input.webm");await ffmpeg.deleteFile("aryanzz-emote-video.mp4")}catch{}
  }
  if(!blob.size)throw new Error("Hasil MP4 kosong.");
  if(state.videoResultUrl)URL.revokeObjectURL(state.videoResultUrl);state.videoResultUrl=URL.createObjectURL(blob);
  const link=$("emoteVideoDownload");link.href=state.videoResultUrl;link.download=filename;link.hidden=false;
  say("emoteVideoStatus","Ekspor selesai · "+sizeText(blob.size)+" · MP4 siap diunduh.","success");
 }catch(error){say("emoteVideoStatus",error.message||"Ekspor MP4 gagal. Coba video yang lebih pendek atau resolusi lebih rendah.","error")}
 finally{
  if(recorder&&recorder.state!=="inactive")try{recorder.stop()}catch{}
  canvasStream?.getTracks().forEach(track=>track.stop());sourceStream?.getTracks().forEach(track=>track.stop());
  video.pause();video.muted=true;button.disabled=!state.videoFile;button.textContent="▶ Ekspor video MP4";drawVideoOverlay();
 }
}
$("emoteExportMp4")?.addEventListener("click",exportVideoMp4);

}
async function boot(){
 try{
  const response=await fetch("/emote-studio.html",{cache:"no-cache"});
  if(!response.ok)throw new Error("Panel Emote Studio tidak dapat dimuat (HTTP "+response.status+").");
  const markup=await response.text();
  if(!markup.includes('id="emoteApp"'))throw new Error("Struktur Emote Studio tidak valid.");
  root.innerHTML=markup;
  initialize();
 }catch(error){root.textContent="Emote Studio gagal dimuat: "+(error.message||"kesalahan tidak diketahui")}
}
boot();
})();
