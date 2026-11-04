(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const API = (window.ARYANZZ_API_BASE || location.origin).replace(/\/$/,"");
  const fmtSize = n => n ? (n/1048576).toFixed(2)+" MB" : "Ukuran tidak diketahui";
  function notify(message){const box=$("advancedNotice");if(box){box.hidden=false;box.textContent=message;}}
  function setPanel(id){
    document.body.dataset.view=id?"tool":"home";
    document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===id));
    document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===id||(!id&&b.dataset.nav==="home")));
    (id?$("toolsArea"):$("home"))?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  if(!document.querySelector('script[src*="v15.js"]'))document.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>setPanel(b.dataset.panel)));
  function triggerSave(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  // V4: browser-local image compression; image bytes never leave this device.
  $("compressBtn")?.addEventListener("click",async()=>{
    const file=$("imageFile").files[0],out=$("compressResult");if(!file){out.textContent="Pilih gambar terlebih dahulu.";return;}
    try{const bitmap=await createImageBitmap(file);const max=Number($("imageMax").value)||1920,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);const type=$("imageFormat").value;const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,Number($("imageQuality").value)/100));if(!blob)throw new Error("Gagal mengolah gambar.");triggerSave(blob,"aryanzz-compressed."+(type==="image/webp"?"webp":"jpg"));out.textContent="Selesai. Ukuran awal "+fmtSize(file.size)+" · hasil "+fmtSize(blob.size)+". Pemrosesan dilakukan di perangkat.";}catch(e){out.textContent=e.message;}
  });
  $("imageQuality")?.addEventListener("input",e=>{$("imageQualityVal").textContent=e.target.value+"%";});
  // V4: password generator and text utilities.
  $("passwordBtn")?.addEventListener("click",()=>{const n=Math.min(64,Math.max(8,Number($("passwordLength").value)||20));const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-+";const bytes=new Uint8Array(n);crypto.getRandomValues(bytes);$("passwordOutput").value=Array.from(bytes,b=>chars[b%chars.length]).join("");});
  $("passwordCopy")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("passwordOutput").value);$("passwordMsg").textContent="Password disalin.";}catch{$("passwordMsg").textContent="Salin manual dari kolom password.";}});
  $("textConvert")?.addEventListener("click",()=>{const t=$("textInput").value,mode=$("textMode").value;const result=mode==="upper"?t.toUpperCase():mode==="lower"?t.toLowerCase():mode==="title"?t.toLowerCase().replace(/\b\p{L}/gu,c=>c.toUpperCase()):mode==="trim"?t.split("\n").map(x=>x.trim()).join("\n"):t.replace(/\s+/g," ").trim();$("textOutput").value=result;});
  $("textCopy")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("textOutput").value);$("textMsg").textContent="Teks disalin.";}catch{$("textMsg").textContent="Salin manual dari hasil.";}});
  $("pdfPrint")?.addEventListener("click",()=>{const text=$("pdfText").value;if(!text.trim()){notify("Isi teks terlebih dahulu untuk membuat PDF.");return;}const w=window.open("","_blank");if(!w){notify("Izinkan pop-up untuk membuat PDF.");return;}const pre=w.document.createElement("pre");pre.textContent=text;pre.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;font:12pt Arial;padding:24px";w.document.body.append(pre);w.document.title="ARYANZZ PDF";w.print();});
  $("imagePdfBtn")?.addEventListener("click",()=>{const file=$("imagePdfFile").files[0];if(!file){notify("Pilih gambar terlebih dahulu.");return;}const u=URL.createObjectURL(file),w=window.open("","_blank");if(!w){URL.revokeObjectURL(u);notify("Izinkan pop-up untuk membuat PDF.");return;}const img=w.document.createElement("img");img.src=u;img.style.cssText="max-width:100%;max-height:95vh;display:block;margin:auto";w.document.body.style.margin="0";w.document.body.append(img);w.document.title="ARYANZZ Image to PDF";w.onload=()=>w.print();});
  $("qrGenerate")?.addEventListener("click",async()=>{const value=$("qrText").value.trim(),box=$("qrCanvas");if(!value){box.textContent="Masukkan teks atau URL.";return;}box.innerHTML="Memuat generator QR lokal…";try{if(!window.QRCode){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";s.onload=resolve;s.onerror=reject;document.head.append(s);});}box.innerHTML="";new QRCode(box,{text:value,width:220,height:220,colorDark:"#07101e",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});$("qrDownload").disabled=false;}catch{box.textContent="Library QR tidak dapat dimuat. Periksa koneksi internet.";}});
  $("qrDownload")?.addEventListener("click",()=>{const box=$("qrCanvas"),img=box.querySelector("img"),canvas=box.querySelector("canvas");let url=canvas?.toDataURL("image/png")||img?.src;if(!url){notify("Buat QR terlebih dahulu.");return;}const a=document.createElement("a");a.href=url;a.download="aryanzz-qr.png";a.click();});
  const health=$("apiHealth");
  if(health)fetch(API+"/api/health").then(r=>r.json()).then(d=>{health.textContent=d.ok?"API tersedia · "+(d.version||"Worker"):"API tidak tersedia";health.className=d.ok?"status-ok":"status-warn";}).catch(()=>{health.textContent="API belum terhubung";health.className="status-warn";});
})();