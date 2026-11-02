/* ARYANZZ V81.0 — Image Downloader + Image Studio */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const root=$("imageStudio");
if(!root)return;
const state={file:null,bitmap:null,objectUrl:null,lastResults:[]};
const imageExt=name=>{const m=String(name||"").toLowerCase().match(/\.(png|jpe?g|gif|webp|avif)$/);return m?m[1]:"jpg"};
const safeName=value=>String(value||"aryanzz-image").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().slice(0,90)||"aryanzz-image";
const setStatus=(message,error=false)=>{const el=$("imageDownloadStatus");if(el){el.textContent=message;el.classList.toggle("is-error",!!error)}};
async function postJson(path,payload){
 const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||("Server menjawab HTTP "+response.status));
 return data;
}
function addImageCard(container,item,postTitle){
 const card=document.createElement("article");card.className="is-image-card";
 const img=document.createElement("img");img.loading="lazy";img.alt=item.title||postTitle||"Gambar dari platform";img.src=item.previewUrl||item.downloadUrl;
 img.addEventListener("error",()=>{img.alt="Pratinjau tidak tersedia";img.classList.add("is-image-error")});
 const details=document.createElement("div");details.className="is-image-card-info";
 const title=document.createElement("b");title.textContent=item.title||postTitle||"Gambar";
 const meta=document.createElement("small");meta.textContent=[item.width&&item.height?(item.width+" × "+item.height+" px"):"",item.ext?item.ext.toUpperCase():"GAMBAR"].filter(Boolean).join(" · ");
 const link=document.createElement("a");link.className="is-download-button";link.href=item.downloadUrl;link.download=safeName(item.filename||postTitle||"aryanzz-image")+"."+(item.ext||"jpg");link.textContent="Unduh gambar ↓";link.rel="noopener";
 details.append(title,meta,link);card.append(img,details);container.append(card);
}
function renderPostResults(posts){
 const box=$("imageDownloadResults");box.replaceChildren();
 if(!posts.length){setStatus("Belum ada postingan gambar publik yang berhasil diverifikasi. Coba judul atau platform lain.",true);return}
 let total=0;
 posts.forEach(post=>{
  const section=document.createElement("section");section.className="is-post-result";
  const heading=document.createElement("h4");heading.textContent=post.title||"Postingan gambar";
  const note=document.createElement("p");note.className="is-post-meta";note.textContent=[post.platform||"",post.verified?"Tautan gambar terverifikasi":"",post.images.length+" gambar"].filter(Boolean).join(" · ");
  const grid=document.createElement("div");grid.className="is-image-grid";
  (post.images||[]).forEach(item=>{addImageCard(grid,item,post.title);total++});
  const source=document.createElement("a");source.href=post.url;source.target="_blank";source.rel="noopener noreferrer";source.className="is-source-link";source.textContent="Buka postingan sumber ↗";
  section.append(heading,note,grid,source);box.append(section);
 });
 setStatus(posts.length+" postingan ditemukan · "+total+" gambar siap diunduh. Unduh satu per satu agar Chrome tidak memblokir banyak file.");
}
$("socialImageAnalyze")?.addEventListener("click",async()=>{
 const url=String($("socialImageUrl")?.value||"").trim();
 if(!url){setStatus("Tempel tautan postingan Pinterest, Facebook, TikTok, Instagram, Threads, Vimeo, Reddit, X, atau CapCut.",true);return}
 const btn=$("socialImageAnalyze");btn.disabled=true;btn.textContent="Memeriksa…";$("imageDownloadResults").replaceChildren();setStatus("Memeriksa postingan dan mencari file gambar asli…");
 try{
  const data=await postJson("/api/social/images",{url});
  const post={title:data.title||"Postingan gambar",url,platform:data.platform||"",verified:true,images:data.images||[]};
  renderPostResults(post.images.length?[post]:[]);
 }catch(error){setStatus(error.message,true)}
 finally{btn.disabled=false;btn.textContent="Ambil gambar"}
});
$("socialImageSearchBtn")?.addEventListener("click",async()=>{
 const query=String($("socialImageQuery")?.value||"").trim();
 const platform=$("socialImageSearchPlatform")?.value||"pinterest";
 if(query.length<2){setStatus("Masukkan judul minimal 2 karakter.",true);return}
 const btn=$("socialImageSearchBtn");btn.disabled=true;btn.textContent="Mencari…";$("imageDownloadResults").replaceChildren();setStatus("Mencari postingan gambar publik di "+platform+"…");
 try{
  const data=await postJson("/api/social/image-search",{query,platform});
  state.lastResults=data.results||[];renderPostResults(state.lastResults);
 }catch(error){setStatus(error.message,true)}
 finally{btn.disabled=false;btn.textContent="Cari gambar"}
});
$("socialImageQuery")?.addEventListener("keydown",e=>{if(e.key==="Enter")$("socialImageSearchBtn")?.click()});
$("socialImageUrl")?.addEventListener("keydown",e=>{if(e.key==="Enter")$("socialImageAnalyze")?.click()});

function setPreviewMessage(message){const el=$("imageStudioInfo");if(el)el.textContent=message}
function sourceRatio(){return state.bitmap?state.bitmap.width/state.bitmap.height:1}
function outputSize(){
 const ratioValue=$("imageStudioRatio")?.value||"original";
 const resolution=$("imageStudioResolution")?.value||"1920";
 if(resolution==="custom"||ratioValue==="custom"){
  return {width:Math.max(1,Math.min(8192,Number($("imageStudioWidth")?.value)||1080)),height:Math.max(1,Math.min(8192,Number($("imageStudioHeight")?.value)||1080))};
 }
 const longEdge=Number(resolution)||1920;
 let ratio=sourceRatio();
 if(ratioValue!=="original"){
  const parts=ratioValue.split(":").map(Number);if(parts.length===2&&parts[0]>0&&parts[1]>0)ratio=parts[0]/parts[1];
 }
 if(ratio>=1)return {width:longEdge,height:Math.max(1,Math.round(longEdge/ratio))};
 return {width:Math.max(1,Math.round(longEdge*ratio)),height:longEdge};
}
function paint(canvas,maxEdge){
 if(!state.bitmap)return;
 const size=outputSize(),scale=Math.min(1,maxEdge/Math.max(size.width,size.height));
 const width=Math.max(1,Math.round(size.width*scale)),height=Math.max(1,Math.round(size.height*scale));
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext("2d",{alpha:true});
 const format=$("imageStudioFormat")?.value||"image/png";
 const fit=$("imageStudioFit")?.value||"cover";
 const bg=$("imageStudioBackground")?.value||"#ffffff";
 if(format==="image/jpeg"||fit==="contain"){ctx.fillStyle=bg;ctx.fillRect(0,0,width,height)}
 const sw=state.bitmap.width,sh=state.bitmap.height;
 if(fit==="contain"){
  const factor=Math.min(width/sw,height/sh),dw=sw*factor,dh=sh*factor;
  ctx.drawImage(state.bitmap,(width-dw)/2,(height-dh)/2,dw,dh);
 }else{
  const factor=Math.max(width/sw,height/sh),cropW=width/factor,cropH=height/factor;
  const sx=(sw-cropW)/2,sy=(sh-cropH)/2;
  ctx.drawImage(state.bitmap,sx,sy,cropW,cropH,0,0,width,height);
 }
 return {width:size.width,height:size.height};
}
function refreshPreview(){
 const canvas=$("imageStudioPreview");if(!canvas||!state.bitmap)return;
 try{const size=paint(canvas,760);setPreviewMessage("Pratinjau "+size.width+" × "+size.height+" px · gambar tetap diproses di perangkat.");}
 catch(error){setPreviewMessage(error.message)}
}
$("imageStudioFile")?.addEventListener("change",async event=>{
 const file=event.target.files?.[0];if(!file)return;
 if(!file.type.startsWith("image/")){setPreviewMessage("Pilih file gambar yang valid.");return}
 if(file.size>40*1024*1024){setPreviewMessage("Ukuran gambar maksimal 40 MB.");return}
 try{
  state.bitmap?.close?.();if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
  state.file=file;state.objectUrl=URL.createObjectURL(file);
  state.bitmap=await createImageBitmap(file);
  $("imageStudioName").value=safeName(file.name.replace(/\.[^.]+$/,""));
  const custom=$("imageStudioRatio");if(custom)custom.value="original";
  refreshPreview();
 }catch(error){setPreviewMessage("Gagal membuka gambar: "+error.message)}
});
["imageStudioRatio","imageStudioResolution","imageStudioWidth","imageStudioHeight","imageStudioFit","imageStudioFormat","imageStudioBackground"].forEach(id=>$(id)?.addEventListener("change",refreshPreview));
$("imageStudioQuality")?.addEventListener("input",e=>{const label=$("imageStudioQualityValue");if(label)label.textContent=e.target.value+"%";});
$("imageStudioExport")?.addEventListener("click",async()=>{
 if(!state.bitmap){setPreviewMessage("Pilih gambar terlebih dahulu.");return}
 const btn=$("imageStudioExport");btn.disabled=true;btn.textContent="Memproses…";
 try{
  const size=outputSize(),canvas=document.createElement("canvas");canvas.width=size.width;canvas.height=size.height;paint(canvas,Math.max(size.width,size.height));
  const type=$("imageStudioFormat").value,quality=Number($("imageStudioQuality").value||92)/100;
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error("Browser gagal membuat file gambar.")),type,quality));
  const ext=type==="image/jpeg"?"jpg":type==="image/webp"?"webp":"png";
  const filename=safeName($("imageStudioName").value)+"-"+size.width+"x"+size.height+"."+ext;
  const link=document.createElement("a"),url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  setPreviewMessage("Berhasil disimpan: "+filename+" · "+(blob.size/1048576).toFixed(2)+" MB. Catatan: memperbesar gambar tidak menambah detail asli.");
 }catch(error){setPreviewMessage(error.message)}
 finally{btn.disabled=false;btn.textContent="Ekspor & unduh gambar"}
});
$("imageStudioReset")?.addEventListener("click",()=>{
 if(state.bitmap){state.bitmap.close?.();state.bitmap=null}if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=null}
 state.file=null;$("imageStudioFile").value="";$("imageStudioPreview").width=1;$("imageStudioPreview").height=1;setPreviewMessage("Pilih gambar untuk mulai mengedit.");
});
document.querySelectorAll("[data-image-ratio]").forEach(button=>button.addEventListener("click",()=>{
 const select=$("imageStudioRatio");if(select){select.value=button.dataset.imageRatio;refreshPreview()}
 document.querySelectorAll("[data-image-ratio]").forEach(item=>item.classList.toggle("active",item===button));
}));
})();