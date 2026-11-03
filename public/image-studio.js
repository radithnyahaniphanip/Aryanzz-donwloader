/* ARYANZZ Image Studio V80.1 — local image editor + public image post downloader */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { bitmap: null, file: null, rotation: 0, objectUrl: "", lastImageUrl: "" };
  const ratioValues = {"1:1":1,"4:3":4/3,"3:2":3/2,"16:9":16/9,"9:16":9/16,"6:8":6/8};
  const MAX_INPUT = 30 * 1024 * 1024;
  const MAX_PIXELS = 24000000;
  const safeText = value => String(value == null ? "" : value);
  function status(message, bad) {
    const node = $("imageEditorStatus");
    if (node) { node.textContent = message; node.classList.toggle("is-error", !!bad); }
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function getDimensions() {
    if (!state.bitmap) return null;
    const w = state.rotation % 180 ? state.bitmap.height : state.bitmap.width;
    const h = state.rotation % 180 ? state.bitmap.width : state.bitmap.height;
    const ratio = $("imageRatio").value;
    let aspect = ratio === "source" ? w / h : ratio === "custom" ? null : ratioValues[ratio];
    const resolution = $("imageResolution").value;
    let outW, outH;
    if (resolution === "custom" || ratio === "custom") {
      outW = Math.max(1, Math.min(12000, Number($("imageCustomWidth").value) || 1080));
      outH = Math.max(1, Math.min(12000, Number($("imageCustomHeight").value) || 1080));
    } else {
      const edge = ({low:480,medium:1080,high:1920,ultra:3840})[resolution] || 1080;
      if (!aspect) aspect = w / h;
      const actualEdge = Math.min(edge, Math.max(w, h));
      if (aspect >= 1) { outW = Math.round(actualEdge); outH = Math.round(actualEdge / aspect); }
      else { outH = Math.round(actualEdge); outW = Math.round(actualEdge * aspect); }
    }
    if (!outW || !outH) return null;
    if (outW * outH > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / (outW * outH));
      outW = Math.max(1, Math.floor(outW * scale)); outH = Math.max(1, Math.floor(outH * scale));
    }
    return {width:outW,height:outH,sourceWidth:w,sourceHeight:h,aspect:outW/outH};
  }
  function drawPreview() {
    if (!state.bitmap) return;
    const canvas = $("imageEditorCanvas"), empty = $("imageEditorEmpty"), dims = getDimensions();
    if (!canvas || !dims) return;
    const ctx = canvas.getContext("2d");
    const previewScale = Math.min(1, 900 / Math.max(dims.width, dims.height));
    canvas.width = Math.max(1, Math.round(dims.width * previewScale));
    canvas.height = Math.max(1, Math.round(dims.height * previewScale));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if ($("imageOutputFormat").value === "image/jpeg") { ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); }
    const rotated = document.createElement("canvas");
    rotated.width = dims.sourceWidth; rotated.height = dims.sourceHeight;
    const rctx = rotated.getContext("2d");
    rctx.translate(rotated.width/2,rotated.height/2);
    rctx.rotate(state.rotation * Math.PI / 180);
    rctx.drawImage(state.bitmap,-state.bitmap.width/2,-state.bitmap.height/2);
    const ratio = dims.aspect, sourceRatio = rotated.width/rotated.height;
    let sx=0, sy=0, sw=rotated.width, sh=rotated.height;
    if ($("imageFit").value === "cover") {
      if (sourceRatio > ratio) { sw = rotated.height * ratio; sx = (rotated.width-sw)/2; }
      else { sh = rotated.width / ratio; sy = (rotated.height-sh)/2; }
      ctx.drawImage(rotated,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    } else {
      const scale = Math.min(canvas.width/rotated.width,canvas.height/rotated.height);
      const dw = rotated.width*scale, dh = rotated.height*scale;
      ctx.drawImage(rotated,0,0,rotated.width,rotated.height,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
    }
    if (empty) empty.hidden = true;
    const meta = $("imageEditorStatus");
    if (meta) meta.textContent = "Pratinjau siap · " + dims.width + " × " + dims.height + " px · sumber " + state.file.name;
  }
  async function loadImage(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type)) { status("Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau AVIF.",true); return; }
    if (file.size > MAX_INPUT) { status("Ukuran gambar melebihi 30 MB. Pilih file yang lebih kecil.",true); return; }
    try {
      if (state.bitmap && state.bitmap.close) state.bitmap.close();
      state.bitmap = await createImageBitmap(file); state.file = file; state.rotation = 0;
      $("imageEditorEmpty").hidden = true;
      $("imageRatio").value = "source";
      syncRatioGallery();
      drawPreview();
      status("Gambar siap diedit · " + state.bitmap.width + " × " + state.bitmap.height + " px");
    } catch (error) { status("Gagal membuka gambar: " + safeText(error.message),true); }
  }
  function updateCustomVisibility() {
    const show = $("imageResolution").value === "custom";
    $("imageCustomSize").hidden = !show;
    if ($("imageRatio").value === "custom") $("imageCustomSize").hidden = false;
  }
  function syncRatioGallery() {
    document.querySelectorAll("[data-image-ratio]").forEach(button => {
      const active = button.dataset.imageRatio === $("imageRatio").value;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
  }
  async function exportImage() {
    if (!state.bitmap) { status("Pilih gambar terlebih dahulu.",true); return; }
    const dims = getDimensions(); if (!dims) { status("Ukuran gambar tidak valid.",true); return; }
    const button = $("imageExport"); button.disabled = true; button.textContent = "Memproses…";
    try {
      const source = document.createElement("canvas");
      source.width = dims.sourceWidth; source.height = dims.sourceHeight;
      const sctx = source.getContext("2d");
      sctx.translate(source.width/2,source.height/2);
      sctx.rotate(state.rotation * Math.PI / 180);
      sctx.drawImage(state.bitmap,-state.bitmap.width/2,-state.bitmap.height/2);
      const canvas = document.createElement("canvas"); canvas.width = dims.width; canvas.height = dims.height;
      const ctx = canvas.getContext("2d");
      const type = $("imageOutputFormat").value;
      if (type === "image/jpeg") { ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); }
      const ratio = dims.aspect, sourceRatio = source.width/source.height;
      let sx=0,sy=0,sw=source.width,sh=source.height;
      if ($("imageFit").value === "cover") {
        if (sourceRatio > ratio) { sw=source.height*ratio; sx=(source.width-sw)/2; }
        else { sh=source.width/ratio; sy=(source.height-sh)/2; }
        ctx.drawImage(source,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
      } else {
        const scale=Math.min(canvas.width/source.width,canvas.height/source.height),dw=source.width*scale,dh=source.height*scale;
        ctx.drawImage(source,0,0,source.width,source.height,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
      }
      const quality = Number($("imageOutputQuality").value)/100;
      const blob = await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error("Browser gagal membuat file gambar.")),type,quality));
      const ext = type==="image/png"?"png":type==="image/webp"?"webp":"jpg";
      const base = (state.file.name || "aryanzz-image").replace(/\.[^.]+$/,"").replace(/[^\p{L}\p{N}._-]+/gu,"-").slice(0,70) || "aryanzz-image";
      downloadBlob(blob,base+"-"+dims.width+"x"+dims.height+"."+ext);
      status("Ekspor selesai · "+dims.width+" × "+dims.height+" px · "+(blob.size/1024).toFixed(1)+" KB");
    } catch (error) { status("Ekspor gagal: "+safeText(error.message),true); }
    finally { button.disabled=false; button.textContent="↓ Ekspor gambar"; }
  }
  function setMode(mode) {
    const edit = mode === "edit";
    $("imageEditTab").classList.toggle("active",edit); $("imageDownloadTab").classList.toggle("active",!edit);
    $("imageEditTab").setAttribute("aria-selected",String(edit)); $("imageDownloadTab").setAttribute("aria-selected",String(!edit));
    $("imageEditView").classList.toggle("active",edit); $("imageDownloadView").classList.toggle("active",!edit);
  }
  function setDownloadStatus(message,bad) {
    const node=$("imageDownloadStatus"); if(node){node.textContent=message;node.classList.toggle("is-error",!!bad);}
  }
  function makeImageCard(item, index) {
    const card=document.createElement("article");card.className="image-result-card";
    const preview=document.createElement("a");preview.className="image-result-preview";
    const previewUrl=new URL(item.previewUrl||item.downloadUrl,location.origin);
    if(previewUrl.origin!==location.origin||!["/api/social-image-file","/api/image/file"].includes(previewUrl.pathname))return card;
    preview.href=previewUrl.href;preview.target="_blank";preview.rel="noopener noreferrer";preview.setAttribute("aria-label","Lihat gambar "+(index+1));
    const img=document.createElement("img");img.loading="lazy";img.decoding="async";img.alt=item.title||"Gambar "+(index+1);img.src=previewUrl.href;preview.appendChild(img);
    const body=document.createElement("div");body.className="image-result-body";
    const title=document.createElement("b");title.textContent=item.title||"Gambar "+(index+1);
    const meta=document.createElement("small");meta.textContent=[item.platform||"Media sosial",item.width&&item.height?item.width+" × "+item.height+" px":""].filter(Boolean).join(" · ");
    const actions=document.createElement("div");actions.className="image-result-actions";
    const downloadUrl=new URL(item.downloadUrl||item.previewUrl,location.origin);
    if(downloadUrl.origin===location.origin&&["/api/social-image-file","/api/image/file"].includes(downloadUrl.pathname)){
      const dl=document.createElement("a");dl.href=downloadUrl.href;dl.textContent="↓ Unduh gambar";dl.setAttribute("download",item.filename||"aryanzz-image.jpg");dl.className="primary";actions.appendChild(dl);
    }
    if(item.sourceUrl){try{const sourceUrl=new URL(item.sourceUrl);if(sourceUrl.protocol==="https:"){const source=document.createElement("a");source.href=sourceUrl.href;source.target="_blank";source.rel="noopener noreferrer";source.textContent="Buka sumber asli ↗";source.className="tag";actions.appendChild(source)}}catch{}}
    body.append(title,meta,actions);card.append(preview,body);return card;
  }
  function renderImages(images) {
    const root=$("imageDownloadResults"); root.replaceChildren();
    if(!Array.isArray(images)||!images.length){root.textContent="Belum ada gambar publik yang bisa diakses dari tautan tersebut.";return;}
    images.forEach((item,index)=>root.appendChild(makeImageCard(item,index)));
  }
  async function extractImages() {
    const raw=$("imagePostUrl").value.trim(); if(!raw){setDownloadStatus("Tempel tautan gambar atau postingan terlebih dahulu.",true);return;}
    setDownloadStatus("Memeriksa tautan dan mencari gambar publik…");
    $("imageDownloadResults").replaceChildren();
    try {
      const response=await fetch("/api/image/extract?url="+encodeURIComponent(raw),{cache:"no-store"});
      const data=await response.json(); if(!response.ok||!data.ok)throw new Error(data.error||"Tautan tidak dapat diproses.");
      state.lastImageUrl=raw; renderImages(data.images);
      setDownloadStatus("Ditemukan "+data.images.length+" gambar · "+(data.title||data.platform||"tautan publik"));
    } catch(error) { setDownloadStatus(safeText(error.message),true); }
  }
  async function searchImages() {
    const query=$("imageSearchQuery").value.trim(),platform=$("imageSearchPlatform").value;
    if(query.length<2){setDownloadStatus("Masukkan judul minimal 2 karakter.",true);return;}
    setDownloadStatus(platform==="all"?"Mencari gambar publik di semua media sosial…":"Mencari gambar publik di "+platform+"…");
    $("imageDownloadResults").replaceChildren();
    try {
      const response=await fetch("/api/image/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({platform,query})});
      const data=await response.json(); if(!response.ok||!data.ok)throw new Error(data.error||"Pencarian gagal.");
      const images=(data.results||[]).flatMap(item=>item.images||[]);
      renderImages(images);
      setDownloadStatus(images.length+" gambar ditemukan dari "+(data.results||[]).length+" postingan"+(data.platformCounts?" · "+Object.entries(data.platformCounts).map(([name,count])=>name+": "+count).join(", "):"")+". "+(data.unavailableCount?data.unavailableCount+" postingan tidak dapat diakses.":""));
    } catch(error) { setDownloadStatus(safeText(error.message),true); }
  }
  function bind() {
    $("imageEditTab").addEventListener("click",()=>setMode("edit"));
    $("imageDownloadTab").addEventListener("click",()=>setMode("download"));
    $("imageStudioFile").addEventListener("change",event=>loadImage(event.target.files&&event.target.files[0]));
    ["imageRatio","imageResolution","imageFit","imageOutputFormat","imageCustomWidth","imageCustomHeight"].forEach(id=>$(id).addEventListener("change",()=>{updateCustomVisibility();syncRatioGallery();drawPreview();}));
    $("imageOutputQuality").addEventListener("input",()=>{$("imageOutputQualityValue").textContent=$("imageOutputQuality").value+"%";});
    $("imageRotateLeft").addEventListener("click",()=>{state.rotation=(state.rotation+270)%360;drawPreview();});
    $("imageRotateRight").addEventListener("click",()=>{state.rotation=(state.rotation+90)%360;drawPreview();});
    $("imageReset").addEventListener("click",()=>{if(!state.bitmap)return;state.rotation=0;$("imageRatio").value="source";$("imageResolution").value="medium";$("imageFit").value="cover";$("imageOutputFormat").value="image/jpeg";$("imageOutputQuality").value="90";$("imageOutputQualityValue").textContent="90%";updateCustomVisibility();syncRatioGallery();drawPreview();});
    document.querySelectorAll("[data-image-ratio]").forEach(button=>button.addEventListener("click",()=>{$("imageRatio").value=button.dataset.imageRatio;updateCustomVisibility();syncRatioGallery();drawPreview();}));
    $("imageExport").addEventListener("click",exportImage);
    $("imageExtractButton").addEventListener("click",extractImages);
    $("imageSearchButton").addEventListener("click",searchImages);
    $("imageSearchQuery").addEventListener("keydown",event=>{if(event.key==="Enter")searchImages();});
    $("imagePostUrl").addEventListener("keydown",event=>{if(event.key==="Enter")extractImages();});
    $("imageSearchPlatform").addEventListener("change",()=>setDownloadStatus("Platform pencarian: "+$("imageSearchPlatform").selectedOptions[0].textContent));
    $("imageResolution").addEventListener("change",updateCustomVisibility);
    updateCustomVisibility();syncRatioGallery();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();