(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const API = (window.ARYANZZ_API_BASE || location.origin).replace(/\/$/,"");
  const KEY = {history:"aryanzz.history.v2",favorites:"aryanzz.favorites.v2",profile:"aryanzz.profile.v2"};
  const read = key => { try { return JSON.parse(localStorage.getItem(key)||"[]"); } catch { return []; } };
  const write = (key,value) => localStorage.setItem(key,JSON.stringify(value));
  const safeName = value => String(value||"aryanzz-media").replace(/[^a-z0-9._-]+/gi,"_").slice(0,100);
  const mediaExt = url => { try { const m=new URL(url).pathname.toLowerCase().match(/\.(mp4|webm|mov|m4v|mp3|m4a|aac|wav|ogg|oga|flac)$/); return m?m[1]:""; } catch { return ""; } };
  const fmtSize = n => n ? (n/1048576).toFixed(2)+" MB" : "Ukuran tidak diketahui";
  function notify(message){const box=$("advancedNotice");if(box){box.hidden=false;box.textContent=message;}}
  function setPanel(id){
    document.body.dataset.view=id?"tool":"home";
    document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===id));
    document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===id||(!id&&b.dataset.nav==="home")));
    (id?$("toolsArea"):$("home"))?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  if(!document.querySelector('script[src*="v15.js"]'))document.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>setPanel(b.dataset.panel)));
  function historyAdd(item){const list=[item,...read(KEY.history).filter(x=>x.url!==item.url)].slice(0,40);write(KEY.history,list);renderSaved();}
  function favoriteToggle(item){let list=read(KEY.favorites);const exists=list.some(x=>x.url===item.url);list=exists?list.filter(x=>x.url!==item.url):[{...item,at:Date.now()},...list].slice(0,40);write(KEY.favorites,list);renderSaved();return !exists;}
  function renderSaved(){
    const hist=$("historyList"),fav=$("favoriteList");
    if(hist){hist.innerHTML="";const items=read(KEY.history);hist.innerHTML=items.length?"":"<p class='muted'>Belum ada unduhan.</p>";items.forEach(x=>{const d=document.createElement("div");d.className="saved-row";const a=document.createElement("a");a.href=x.url;a.target="_blank";a.rel="noopener";a.textContent=x.name||x.url;const s=document.createElement("small");s.textContent=new Date(x.at).toLocaleString();d.append(a,s);hist.append(d);});}
    if(fav){fav.innerHTML="";const items=read(KEY.favorites);fav.innerHTML=items.length?"":"<p class='muted'>Belum ada favorit.</p>";items.forEach(x=>{const d=document.createElement("div");d.className="saved-row";const a=document.createElement("a");a.href=x.url;a.target="_blank";a.rel="noopener";a.textContent=x.name||x.url;const b=document.createElement("button");b.className="tag";b.textContent="Hapus";b.onclick=()=>{write(KEY.favorites,read(KEY.favorites).filter(y=>y.url!==x.url));renderSaved();};d.append(a,b);fav.append(d);});}
  }
  async function inspect(url){
    const response=await fetch(API+"/api/info",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Link tidak dapat diperiksa.");
    return data;
  }
  async function saveResponse(response,filename,onProgress){
    if(!response.ok){const e=await response.json().catch(()=>({}));throw new Error(e.error||"Unduhan gagal.");}
    const total=Number(response.headers.get("content-length")||0);
    if(!response.body){const blob=await response.blob();return triggerSave(blob,filename);}
    const reader=response.body.getReader(),chunks=[];let loaded=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;if(onProgress)onProgress(total?Math.min(99,Math.round(loaded/total*100)):null,loaded,total);}
    const blob=new Blob(chunks,{type:response.headers.get("content-type")||"application/octet-stream"});
    triggerSave(blob,filename);if(onProgress)onProgress(100,loaded,total);
  }
  function triggerSave(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function downloadOne(url,mode,quality,progress){
    const response=await fetch(API+"/api/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,mode,quality})});
    const ext=mode==="audio"?"mp3":"mp4";
    const filename="aryanzz-"+(mode==="audio"?"audio":"video-"+quality+"p")+"."+ext;
    await saveResponse(response,filename,progress);
    historyAdd({url,name:filename,at:Date.now(),mode,quality});
  }
  function showMedia(data,url){
    const box=$("downloadResult");box.hidden=false;box.innerHTML="";
    const title=document.createElement("b");title.textContent=data.title||data.filename||"Media siap diproses";
    const meta=document.createElement("p");meta.className="muted";meta.textContent=[data.extractor||data.source||"Media",data.duration?Math.round(data.duration)+" detik":null,data.size?fmtSize(data.size):null].filter(Boolean).join(" · ");
    box.append(title,meta);
    if(data.thumbnail){const img=document.createElement("img");img.src=data.thumbnail;img.alt="Preview thumbnail";img.loading="lazy";img.style.cssText="width:100%;max-height:210px;object-fit:contain;border-radius:12px;background:#050a12";box.append(img);}
    const row=document.createElement("div");row.className="feature-row";
    const mode=document.createElement("select");mode.className="field";mode.id="aryMode";["video","audio"].forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v==="video"?"Video MP4":"Audio MP3";mode.append(o)});
    const quality=document.createElement("select");quality.className="field";quality.id="aryQuality";
    const heights=(data.formats||[]).map(f=>typeof f==="number"?f:f.height).filter(Boolean);
    const available=heights.length?[...new Set(heights)].sort((a,b)=>a-b):[720];
    available.forEach(h=>{const o=document.createElement("option");o.value=h;o.textContent=h+"p";if(h===720)o.selected=true;quality.append(o)});
    if(data.type==="audio")mode.value="audio";
    quality.disabled=mode.value==="audio";
    row.append(mode,quality);box.append(row);
    mode.addEventListener("change",()=>quality.disabled=mode.value==="audio");
    const progress=document.createElement("div");progress.className="progress-track";const bar=document.createElement("div");bar.className="progress-fill";progress.append(bar);box.append(progress);
    const status=document.createElement("p");status.className="muted";status.textContent="Siap. Pilih format dan kualitas yang tersedia.";box.append(status);
    const actions=document.createElement("div");actions.className="feature-row";
    const btn=document.createElement("button");btn.className="primary";btn.textContent="Unduh sekarang";
    btn.onclick=async()=>{btn.disabled=true;btn.textContent="Memproses…";try{await downloadOne(url,mode.value,Number(quality.value), (pct,loaded,total)=>{bar.style.width=(pct??5)+"%";status.textContent=pct===null?"Mengunduh "+fmtSize(loaded):"Progress "+pct+"%"+(total?" · "+fmtSize(loaded)+" / "+fmtSize(total):"");});status.textContent="Selesai — file dikirim ke perangkat.";btn.textContent="Unduh lagi";}catch(e){status.textContent=e.message;btn.disabled=false;btn.textContent="Coba lagi";}};
    const fav=document.createElement("button");fav.className="tag";fav.textContent=read(KEY.favorites).some(x=>x.url===url)?"♥ Tersimpan":"♡ Favorit";fav.onclick=()=>{const added=favoriteToggle({url,name:data.title||url});fav.textContent=added?"♥ Tersimpan":"♡ Favorit";};
    actions.append(btn,fav);box.append(actions);
  }
  const analyze=$("analyze");
  if(analyze)analyze.onclick=async()=>{
    const url=$("url").value.trim(),box=$("downloadResult");box.hidden=false;box.textContent="Memeriksa link…";
    try{const u=new URL(url);if(!["http:","https:"].includes(u.protocol))throw new Error("Gunakan tautan HTTP atau HTTPS.");const data=await inspect(u.href);showMedia(data,u.href);}
    catch(e){box.innerHTML="";const b=document.createElement("b");b.textContent="Link belum bisa diproses";const p=document.createElement("p");p.className="muted";p.textContent=e.message;const hint=document.createElement("p");hint.className="muted";hint.textContent="Tautan file langsung didukung oleh Cloudflare Worker. Link halaman TikTok/Instagram/YouTube memerlukan backend ekstraksi yt-dlp yang aktif dan terhubung.";box.append(b,p,hint);}
  };
  const queue=$("queueList"),queueItems=[];
  function drawQueue(){if(!queue)return;queue.innerHTML="";if(!queueItems.length){queue.innerHTML="<p class='muted'>Antrean masih kosong.</p>";return;}queueItems.forEach((x,i)=>{const d=document.createElement("div");d.className="queue-row";const label=document.createElement("span");label.textContent=(i+1)+". "+x.url;const state=document.createElement("small");state.textContent=x.status;d.append(label,state);queue.append(d);});}
  $("queueAdd")?.addEventListener("click",()=>{const urls=$("queueUrls").value.split(/\n|,|;/).map(x=>x.trim()).filter(Boolean);for(const url of urls){try{const u=new URL(url);if(!["http:","https:"].includes(u.protocol))continue;if(!queueItems.some(x=>x.url===u.href))queueItems.push({url:u.href,status:"Menunggu"});}catch{}}$("queueUrls").value="";drawQueue();});
  $("queueRun")?.addEventListener("click",async()=>{const b=$("queueRun");b.disabled=true;for(const item of queueItems){if(item.status!=="Menunggu")continue;item.status="Memproses";drawQueue();try{const data=await inspect(item.url);const mode=data.type==="audio"||mediaExt(item.url)&&["mp3","m4a","aac","wav","ogg","flac"].includes(mediaExt(item.url))?"audio":"video";await downloadOne(item.url,mode,720,(pct)=>{item.status=pct===null?"Mengunduh…":pct+"%";drawQueue();});item.status="Selesai";}catch(e){item.status="Gagal: "+e.message;}drawQueue();}b.disabled=false;});
  $("queueClear")?.addEventListener("click",()=>{queueItems.length=0;drawQueue();});
  $("clearHistoryV2")?.addEventListener("click",()=>{write(KEY.history,[]);renderSaved();});
  $("clearFavoritesV2")?.addEventListener("click",()=>{write(KEY.favorites,[]);renderSaved();});
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
  // V5: local profile/settings; no account data is sent to a third party.
  function profileLoad(){let p={name:"Pengguna ARYANZZ",bio:"",photo:""};try{p={...p,...JSON.parse(localStorage.getItem(KEY.profile)||"{}")}}catch{}$("profileName").value=p.name;$("profileBio").value=p.bio;$("profileAvatar").textContent=(p.name.trim()[0]||"A").toUpperCase();$("profileAvatar").style.backgroundImage=p.photo?'url("'+p.photo+'")':"";$("profileAvatar").style.backgroundSize="cover";$("profileAvatar").style.backgroundPosition="center";$("profileSummary").textContent=p.name;window.aryanzzProfile=p;}
  $("profilePhoto")?.addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;if(!file.type.startsWith("image/")||file.size>1024*1024){notify("Foto profil harus berupa gambar maksimal 1 MB.");e.target.value="";return;}const reader=new FileReader();reader.onload=()=>{const p={...(window.aryanzzProfile||{}),photo:reader.result};localStorage.setItem(KEY.profile,JSON.stringify(p));profileLoad();};reader.readAsDataURL(file);});
  $("profileSave")?.addEventListener("click",()=>{const p={...(window.aryanzzProfile||{}),name:$("profileName").value.trim()||"Pengguna ARYANZZ",bio:$("profileBio").value.trim()};localStorage.setItem(KEY.profile,JSON.stringify(p));profileLoad();notify("Profil tersimpan di perangkat ini.");});
  $("profileReset")?.addEventListener("click",()=>{localStorage.removeItem(KEY.profile);profileLoad();notify("Profil lokal direset.");});
  $("exportData")?.addEventListener("click",()=>{const data={profile:JSON.parse(localStorage.getItem(KEY.profile)||"{}"),history:read(KEY.history),favorites:read(KEY.favorites),exportedAt:new Date().toISOString()};triggerSave(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),"aryanzz-backup.json");});
  $("importData")?.addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());if(d.profile)localStorage.setItem(KEY.profile,JSON.stringify(d.profile));if(Array.isArray(d.history))write(KEY.history,d.history.slice(0,40));if(Array.isArray(d.favorites))write(KEY.favorites,d.favorites.slice(0,40));profileLoad();renderSaved();notify("Backup berhasil dipulihkan.");}catch{notify("File backup tidak valid.");}});
 
  $("imagePdfBtn")?.addEventListener("click",()=>{const file=$("imagePdfFile").files[0];if(!file){notify("Pilih gambar terlebih dahulu.");return;}const u=URL.createObjectURL(file),w=window.open("","_blank");if(!w){URL.revokeObjectURL(u);notify("Izinkan pop-up untuk membuat PDF.");return;}const img=w.document.createElement("img");img.src=u;img.style.cssText="max-width:100%;max-height:95vh;display:block;margin:auto";w.document.body.style.margin="0";w.document.body.append(img);w.document.title="ARYANZZ Image to PDF";w.onload=()=>w.print();});
  $("qrGenerate")?.addEventListener("click",async()=>{const value=$("qrText").value.trim(),box=$("qrCanvas");if(!value){box.textContent="Masukkan teks atau URL.";return;}box.innerHTML="Memuat generator QR lokal…";try{if(!window.QRCode){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";s.onload=resolve;s.onerror=reject;document.head.append(s);});}box.innerHTML="";new QRCode(box,{text:value,width:220,height:220,colorDark:"#07101e",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});$("qrDownload").disabled=false;}catch{box.textContent="Library QR tidak dapat dimuat. Periksa koneksi internet.";}});
  $("qrDownload")?.addEventListener("click",()=>{const box=$("qrCanvas"),img=box.querySelector("img"),canvas=box.querySelector("canvas");let url=canvas?.toDataURL("image/png")||img?.src;if(!url){notify("Buat QR terlebih dahulu.");return;}const a=document.createElement("a");a.href=url;a.download="aryanzz-qr.png";a.click();});
  renderSaved();profileLoad();drawQueue();
  const health=$("apiHealth");
  if(health)fetch(API+"/api/health").then(r=>r.json()).then(d=>{health.textContent=d.ok?"API tersedia · "+(d.version||"Worker"):"API tidak tersedia";health.className=d.ok?"status-ok":"status-warn";}).catch(()=>{health.textContent="API belum terhubung";health.className="status-warn";});
})();