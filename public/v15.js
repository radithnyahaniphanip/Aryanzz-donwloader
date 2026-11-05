/* ARYANZZ V7–V15: progressive enhancements, no external analytics or login required. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const KEY = {history:"aryanzz.history.v2", favorites:"aryanzz.favorites.v2"};
  const mediaExtension = /\.(mp4|webm|mov|m4v|mp3|m4a|aac|wav|ogg|oga|flac)$/i;
  const audioExtensions = new Set(["mp3","m4a","aac","wav","ogg","oga","flac"]);
  const formatSize = n => Number(n)>0 ? (Number(n)/(1024*1024)).toFixed(2)+" MB" : "Ukuran tidak diketahui";
  const formatSpeed = n => Number(n)>0 ? (Number(n)/(1024*1024)).toFixed(1)+" MB" : "0 MB";
  const safeName = name => String(name||"aryanzz-media").replace(/[^a-z0-9._-]/gi,"_").slice(0,95)||"aryanzz-media";
  const safeURL = raw => {const u=new URL(String(raw));if(!["http:","https:"].includes(u.protocol))throw new Error("Gunakan URL HTTP atau HTTPS.");return u;};
  const readArray = key => {try{const v=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(v)?v:[]}catch{return []}};
  const saveArray = (key,v) => {try{localStorage.setItem(key,JSON.stringify(v))}catch{toast("Penyimpanan perangkat penuh.")}};
  const node=(type,className,text)=>{const el=document.createElement(type);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  let toastTimer;
  function toast(message){
    let bar=$("v15Toast");
    if(!bar){bar=node("div","v15-toast");bar.id="v15Toast";bar.setAttribute("role","status");bar.setAttribute("aria-live","polite");document.body.append(bar)}
    bar.textContent=message;bar.classList.add("shown");
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>bar.classList.remove("shown"),3200);
  }
  function goto(id){
    const controller=window.aryanzzShowPanel;
    if(typeof controller==="function"&&controller!==goto)return controller(id);
    const panelId=id==="home"||!id?"":String(id);
    const home=$("home"),toolsArea=$("toolsArea"),welcome=$("v89Welcome"),viewHeader=$("appViewHeader");
    document.body.dataset.view=panelId==="owner"?"owner":panelId?"tool":"home";
    if(home)home.hidden=!!panelId;
    if(welcome)welcome.hidden=!!panelId;
    if(viewHeader)viewHeader.hidden=!panelId;
    if(toolsArea)toolsArea.hidden=!panelId;
    document.querySelectorAll("#toolsArea>.panel").forEach(p=>{
      const active=!!panelId&&p.id===panelId;
      p.classList.toggle("active",activfunction bindNavigation(){
    document.querySelectorAll("[data-nav], [data-panel]").forEach(btn=>{
      btn.onclick=null;
      btn.addEventListener("click",()=>{goto(btn.dataset.nav||btn.dataset.panel||"")});
    });
    document.querySelectorAll("#toolsArea > .panel:not(#allTools)").forEach(p=>{
      if(["history","owner","profile"].includes(p.id)||p.querySelector(".back-home"))return;
      const back=node("button","back-home","← Semua Tools");
      back.type="button";
      back.addEventListener("click",()=>goto("allTools"));
      p.append(back);
    });
    if(typeof window.aryanzzShowPanel==="function")window.aryanzzShowPanel("home");
    else goto("home");
  }

  /* V8 filter/search and fast tool discovery. */
  function setupToolSearch(){
    const parent=$("allTools"),grid=parent?.querySelector(".all-tools-grid");if(!parent||!grid||parent.querySelector("#toolSearch")||parent.querySelector("#toolFilters"))return;
    const category={
      speed:"network",checker:"network",heart:"network",
      queue:"media",history:"media",
      imageTools:"creative",pdfTools:"creative",qrTools:"creative",
      securityTools:"utility",install:"utility",
      profile:"account",owner:"account",about:"account",help:"account"
    };
    const aliases={network:"Internet",media:"Media",creative:"Kreatif",utility:"Utilitas",account:"Akun"};
    const tools=[...grid.querySelectorAll("[data-panel]")];
    tools.forEach(t=>{const cat=category[t.dataset.panel]||"utility";t.dataset.category=cat;t.dataset.categoryLabel=aliases[cat]});
    const search=node("div","tool-search-wrap");
    const input=document.createElement("input");input.id="toolSearch";input.type="search";input.placeholder="Cari fitur ARYANZZ…";input.setAttribute("aria-label","Cari fitur");search.append(input);
    const filters=node("div","tool-filters");
    const labels=[["all","Semua"],["media","Media"],["creative","Kreatif"],["network","Internet"],["utility","Utilitas"],["account","Akun"]];
    let active="all";
    const empty=node("p","tool-empty","Fitur tidak ditemukan. Coba kata kunci lain.");empty.hidden=true;
    function filter(){const q=input.value.trim().toLocaleLowerCase("id");let shown=0;tools.forEach(t=>{
      const match=(active==="all"||t.dataset.category===active)&&t.textContent.toLocaleLowerCase("id").includes(q);
      t.hidden=!match;if(match)shown++;
    });empty.hidden=shown!==0;}
    labels.forEach(([id,label])=>{const btn=node("button","tool-filter"+(id==="all"?" active":""),label);btn.type="button";btn.dataset.filter=id;
      btn.addEventListener("click",()=>{active=id;[...filters.children].forEach(b=>b.classList.toggle("active",b===btn));filter()});filters.append(btn)});
    input.addEventListener("input",filter);grid.parentNode.insertBefore(search,grid);grid.parentNode.insertBefore(filters,grid);grid.after(empty);
    document.addEventListener("keydown",e=>{
      const tag=document.activeElement?.tagName;
      if(e.key==="/"&&!["INPUT","TEXTAREA"].includes(tag)){e.preventDefault();goto("allTools");input.focus();}
      if(e.key==="Escape"&&document.body.dataset.view==="tool"){if(document.activeElement===input)input.blur();goto("home");}
    });
  }

  /* V9 real downloader result, direct-file transparency, progress and cancellation. */
  let activeController=null;
  async function apiInfo(url){
    const r=await fetch("/api/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||"Tautan belum dapat diperiksa.");return data;
  }
  function recordHistory(item){
    const key=KEY.history;const values=readArray(key);
    saveArray(key,[{...item,at:Date.now()},...values.filter(v=>v.url!==item.url)].slice(0,40));
    renderLibrary();window.dispatchEvent(new Event("aryanzz:history-updated"));
  }
  function setFavorite(item){
    const values=readArray(KEY.favorites);const has=values.some(v=>v.url===item.url);
    saveArray(KEY.favorites,has?values.filter(v=>v.url!==item.url):[{...item,at:Date.now()},...values].slice(0,40));
    renderLibrary();window.dispatchEvent(new Event("aryanzz:history-updated"));return !has;
  }
  async function startDownload(url,data,mode,quality,bar,label,btn,cancel){
    const controller=new AbortController();activeController=controller;
    btn.disabled=true;cancel.hidden=false;bar.style.width="2%";label.textContent="Menghubungkan ke sumber…";
    try{
      const response=await fetch("/api/download",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url,mode,quality}),signal:controller.signal});
      if(!response.ok){let err={};try{err=await response.json()}catch{}throw new Error(err.error||"Unduhan gagal ("+response.status+").");}
      const ct=response.headers.get("content-type")||"application/octet-stream";
      if(ct.includes("text/html")||ct.includes("application/json"))throw new Error("Sumber tidak memberikan file media.");
      const total=Number(response.headers.get("content-length")||0);
      const chunks=[];let loaded=0;
      if(response.body){const reader=response.body.getReader();while(true){
        const chunk=await reader.read();if(chunk.done)break;
        loaded+=chunk.value.byteLength;
        if(loaded>105*1024*1024)throw new Error("File terlalu besar untuk mode browser.");
        chunks.push(chunk.value);
        if(total)bar.style.width=Math.max(2,Math.min(98,Math.round(loaded/total*100)))+"%";
        label.textContent="Mengunduh "+formatSpeed(loaded)+(total?" / "+formatSpeed(total):"");
      }}else{const blob=await response.blob();loaded=blob.size;chunks.push(blob)}
      if(!loaded)throw new Error("File kosong.");
      const blob=new Blob(chunks,{type:ct});
      const ext=String(data.extension||"").toLowerCase();
      const generatedExt=mode==="audio"?"mp3":"mp4";
      const file=ext?safeName(data.filename||data.title||"aryanzz-media."+ext):safeName("aryanzz-"+mode+"."+generatedExt);
      const object=URL.createObjectURL(blob),link=document.createElement("a");link.href=object;link.download=file;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(object),60000);
      bar.style.width="100%";label.textContent="File selesai disiapkan dan dikirim ke browser.";
      recordHistory({name:file,url,mode,quality});toast("Unduhan selesai: "+file);
    }catch(e){bar.style.width="0%";label.textContent=e?.name==="AbortError"?"Unduhan dibatalkan.":e.message;toast(label.textContent);}
    finally{cancel.hidden=true;btn.disabled=false;activeController=null}
  }
  function showMedia(url,data){
    const out=$("downloadResult");out.hidden=false;out.replaceChildren();
    const wrap=node("div","v15-box");const heading=node("div","v15-result-head");
    heading.append(node("div","v15-media-icon",data.type==="audio"?"♫":"▶"));
    const about=node("div");about.append(node("b","",data.title||data.filename||"Media"),node("small","",[data.source||data.extractor||new URL(url).hostname,data.size?formatSize(data.size):""].filter(Boolean).join(" · ")));
    heading.append(about);wrap.append(heading);
    if(data.thumbnail){try{const img=node("img","v15-visual-preview");img.src=safeURL(data.thumbnail).href;img.alt="Thumbnail media";img.loading="lazy";wrap.append(img)}catch{}}
    const direct=!!data.extension;
    if(direct){
      const type=data.type==="audio"?"audio":"video";
      const media=node(type,"v15-visual-preview");media.src=url;media.controls=true;media.preload="none";media.playsInline=true;wrap.append(media);
      wrap.append(node("p","v15-note","Mengunduh file asli tanpa konversi. Kualitas mengikuti sumber."));
    }
    const row=node("div","v15-row");const mode=document.createElement("select");mode.className="v15-control";mode.setAttribute("aria-label","Jenis unduhan");
    if(direct){const opt=document.createElement("option");opt.value=data.type==="audio"?"audio":"video";opt.textContent="File asli · "+String(data.extension||"").toUpperCase();mode.append(opt);mode.disabled=true;}
    else for(const [v,label] of [["video","Video MP4"],["audio","Audio MP3"]]){const opt=document.createElement("option");opt.value=v;opt.textContent=label;mode.append(opt)}
    row.append(mode);
    const formats=Array.isArray(data.formats)?[...new Set(data.formats.map(f=>Number(f.height||f)).filter(n=>Number.isFinite(n)&&n>0))].sort((a,b)=>b-a):[];
    let quality=null;
    if(!direct&&formats.length){quality=document.createElement("select");quality.className="v15-control";quality.setAttribute("aria-label","Kualitas video");formats.forEach(v=>{const o=new Option(v+"p",String(v));quality.append(o)});row.append(quality)}
    mode.addEventListener("change",()=>{if(quality)quality.disabled=mode.value==="audio"});
    wrap.append(row);
    const progress=node("div","v15-progress"),bar=node("div");progress.append(bar);
    const info=node("div","v15-subtle", "Siap untuk diunduh.");
    const actions=node("div","v15-row");actions.style.marginTop="12px";
    const btn=node("button","v15-action strong","↓ Unduh media");btn.type="button";
    const cancel=node("button","v15-action","Batalkan");cancel.type="button";cancel.hidden=true;
    cancel.addEventListener("click",()=>activeController?.abort());
    const favorite=node("button","v15-action",readArray(KEY.favorites).some(x=>x.url===url)?"♥ Favorit":"♡ Favorit");favorite.type="button";
    favorite.addEventListener("click",()=>{const saved=setFavorite({name:data.title||data.filename||url,url});favorite.textContent=saved?"♥ Favorit":"♡ Favorit";toast(saved?"Ditambahkan ke favorit":"Dihapus dari favorit")});
    btn.addEventListener("click",()=>startDownload(url,data,mode.value,Number(quality?.value||720),bar,info,btn,cancel));
    actions.append(btn,cancel,favorite);wrap.append(progress,info,actions);out.append(wrap);
  }
  function setupDownloader(){
    const input=$("url"),button=$("analyze"),out=$("downloadResult");if(!input||!button||!out)return;
    const actions=node("div","v15-row");actions.style.marginTop="10px";
    const paste=node("button","v15-action","⧉ Tempel link");paste.type="button";
    paste.addEventListener("click",async()=>{try{const text=await navigator.clipboard.readText();input.value=text.trim();input.focus();toast("Link ditempel.")}catch{input.focus();toast("Tekan lama di kolom untuk menempel link.")}});
    const clear=node("button","v15-action","× Hapus");clear.type="button";clear.addEventListener("click",()=>{input.value="";out.hidden=true;out.replaceChildren();input.focus()});
    actions.append(paste,clear);const strip=document.querySelector(".v6-download .format-strip");strip?.after(actions);
    /* The V29 downloader controller owns the single analyze click handler. */
    input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();button.click()}});
  }
  /* V10 convert and resize images entirely on the device. */
  function setupImageLab(){
    const panel=$("imageTools");if(!panel)return;
    const box=node("section","v15-box");box.append(node("div","v15-title","Image Studio · Convert & Resize"),node("p","v15-subtle","Ubah PNG/JPEG/WebP dan resolusi. File tidak dikirim ke server."));
    const upload=document.createElement("input");upload.type="file";upload.accept="image/png,image/jpeg,image/webp";upload.className="v15-control";upload.style.width="100%";upload.setAttribute("aria-label","Pilih gambar untuk dikonversi");
    const preview=node("img","v15-file-preview");preview.hidden=true;
    const row=node("div","v15-two-col");
    const type=document.createElement("select");type.className="v15-control";type.setAttribute("aria-label","Format hasil gambar");
    for(const [mime,label] of [["image/webp","WebP"],["image/jpeg","JPEG"],["image/png","PNG"]]){const o=new Option(label,mime);type.append(o)}
    const max=document.createElement("select");max.className="v15-control";max.setAttribute("aria-label","Panjang sisi maksimum");
    for(const [n,label] of [["original","Resolusi asli"],["1920","Maks. 1920 px"],["1280","Maks. 1280 px"],["800","Maks. 800 px"]])max.append(new Option(label,n));
    row.append(type,max);
    const run=node("button","v15-action strong","Konversi & unduh");run.type="button";run.style.marginTop="12px";
    const result=node("div","v15-file-result");result.setAttribute("role","status");
    let objectUrl;
    upload.addEventListener("change",()=>{const file=upload.files?.[0];if(objectUrl)URL.revokeObjectURL(objectUrl);preview.hidden=!file;if(file){objectUrl=URL.createObjectURL(file);preview.src=objectUrl;result.textContent=file.name+" · "+formatSize(file.size)}else result.textContent=""});
    run.addEventListener("click",async()=>{const file=upload.files?.[0];if(!file)return toast("Pilih gambar PNG, JPEG atau WebP.");if(file.size>30*1024*1024)return toast("Batas gambar 30 MB.");run.disabled=true;result.textContent="Memproses…";
      try{const bitmap=await createImageBitmap(file);const factor=max.value==="original"?1:Math.min(1,Number(max.value)/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*factor));canvas.height=Math.max(1,Math.round(bitmap.height*factor));const context=canvas.getContext("2d");if(type.value==="image/jpeg"){context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height)}context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,type.value,0.88));if(!blob)throw Error("Konversi gagal.");const url=URL.createObjectURL(blob);const a=node("a");a.href=url;a.download="aryanzz-"+safeName(file.name.replace(/\.[^.]+$/,""))+"."+({ "image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[type.value]);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);result.textContent="Selesai · "+canvas.width+"×"+canvas.height+" · "+formatSize(blob.size);toast("Gambar berhasil dikonversi.")}
      catch(e){result.textContent=e.message}finally{run.disabled=false}
    });
    box.append(upload,preview,row,run,result);const existing=panel.querySelector("#compressResult");existing?.after(box);
  }
  /* V11 QR helper, V12 text counters and JSON formatting. */
  function setupTextExtras(){
    const panel=$("pdfTools"),text=$("textInput");if(!panel||!text)return;
    const counter=node("div","v15-counter");
    const update=()=>{const t=text.value;counter.textContent=t.length+" karakter · "+(t.trim()?t.trim().split(/\s+/).length:0)+" kata · "+(t?t.split(/\r\n|\n|\r/).length:0)+" baris"};
    text.addEventListener("input",update);update();text.after(counter);
    const extras=node("div","v15-extra-tools");
    const pretty=node("button","v15-action","{ } Format JSON"),minify=node("button","v15-action","− Minify JSON");
    pretty.type="button";minify.type="button";
    function process(min){try{const data=JSON.parse(text.value);$("textOutput").value=JSON.stringify(data,null,min?0:2);toast("JSON berhasil diproses.")}catch{toast("JSON tidak valid. Periksa struktur teks.")}}
    pretty.addEventListener("click",()=>process(false));minify.addEventListener("click",()=>process(true));
    extras.append(pretty,minify);counter.after(extras);
    const qr=$("qrTools"),qrInput=$("qrText");if(qr&&qrInput){const c=node("div","v15-counter");qrInput.after(c);const updateQR=()=>c.textContent=qrInput.value.length+" karakter untuk QR";qrInput.addEventListener("input",updateQR);updateQR();}
  }

  /* V13 searchable local media library and stats, no fake online sync. */
  let libraryQuery="";
  function renderLibrary(){
    const history=$("historyList"),fav=$("favoriteList");if(!history||!fav)return;
    const values=[...readArray(KEY.history),...readArray("aryanzz-download-history-v1")]
      .filter((x,i,arr)=>x&&x.url&&arr.findIndex(y=>y&&y.url===x.url)===i)
      .sort((a,b)=>Number(b.at||0)-Number(a.at||0)).slice(0,80);
    const favorites=readArray(KEY.favorites).filter(x=>x&&x.url);
    const render=(root,items,isFavorite)=>{
      root.replaceChildren();
      const filtered=items.filter(x=>(String(x.name||"")+" "+String(x.url||"")).toLocaleLowerCase("id").includes(libraryQuery));
      if(!filtered.length){root.append(node("p","ary-library-empty",isFavorite?"Belum ada favorit.":"Belum ada riwayat."));return}
      for(const item of filtered){
        let url;try{url=safeURL(item.url).href}catch{continue}
        const row=node("div","v15-library-row"),info=node("div","v15-library-info");
        info.append(node("b","",item.name||"Media"),node("small","",new Date(item.at||Date.now()).toLocaleDateString("id-ID")));
        const open=node("button","v15-action","Buka");open.type="button";open.addEventListener("click",()=>window.open(url,"_blank","noopener,noreferrer"));
        const action=node("button","v15-action",isFavorite?"Hapus":"♡");action.type="button";
        action.addEventListener("click",()=>{setFavorite({name:item.name||url,url});toast(isFavorite?"Favorit dihapus":"Disimpan ke favorit")});
        row.append(info,open,action);root.append(row);
      }
    };
    render(history,values,false);render(fav,favorites,true);
    const counts={
      history:["aryLibraryHistoryCount","aryLibraryHistoryBadge","v15HistoryCount"],
      favorites:["aryLibraryFavoriteCount","aryLibraryFavoriteBadge","v15FavoriteCount"]
    };
    counts.history.forEach(id=>{const el=$(id);if(el)el.textContent=String(values.length)});
    counts.favorites.forEach(id=>{const el=$(id);if(el)el.textContent=String(favorites.length)});
  }
  function setupLibrary(){
    const panel=$("history");if(!panel||panel.dataset.v15LibraryBound==="1")return;
    panel.dataset.v15LibraryBound="1";
    const existingStats=panel.querySelector(".ary-library-stats");
    if(!existingStats){
      const stats=node("div","v15-stats");
      for(const [id,label,value] of [["v15HistoryCount","Riwayat","0"],["v15FavoriteCount","Favorit","0"],["v15LocalStatus","Penyimpanan","Lokal"]]){
        const box=node("div","v15-stat"),b=node("b","",value);b.id=id;box.append(b,node("small","",label));stats.append(box);
      }
      panel.insertBefore(stats,panel.querySelector("#historyList"));
    }
    let search=panel.querySelector("#v15LibrarySearch");
    if(!search){
      search=node("input","v15-control ary-library-search");
      search.id="v15LibrarySearch";search.type="search";search.placeholder="Cari di pustaka…";
      search.setAttribute("aria-label","Cari riwayat dan favorit");search.style.width="100%";search.style.marginTop="12px";
      search.addEventListener("input",()=>{libraryQuery=search.value.trim().toLocaleLowerCase("id");renderLibrary()});
      const tabs=panel.querySelector(".ary-library-switch");
      if(tabs)tabs.after(search);else panel.insertBefore(search,panel.querySelector("#historyList"));
    }
    const historyTab=$("aryLibraryHistoryTab"),favoriteTab=$("aryLibraryFavoriteTab");
    const historyView=$("aryLibraryHistoryView"),favoriteView=$("aryLibraryFavoriteView");
    const showTab=favorite=>{
      if(historyTab){historyTab.classList.toggle("active",!favorite);historyTab.setAttribute("aria-selected",String(!favorite));}
      if(favoriteTab){favoriteTab.classList.toggle("active",favorite);favoriteTab.setAttribute("aria-selected",String(favorite));}
      if(historyView)historyView.hidden=favorite;
      if(favoriteView)favoriteView.hidden=!favorite;
    };
    historyTab?.addEventListener("click",()=>showTab(false));
    favoriteTab?.addEventListener("click",()=>showTab(true));
    const clearHistory=$("clearHistoryV2");
    if(clearHistory&&!clearHistory.dataset.v15Bound){
      clearHistory.dataset.v15Bound="1";
      clearHistory.addEventListener("click",()=>{
        if(!window.confirm("Hapus seluruh riwayat unduhan dari perangkat ini?"))return;
        try{localStorage.removeItem(KEY.history);localStorage.removeItem("aryanzz-download-history-v1");}
        catch{toast("Riwayat tidak dapat dihapus. Periksa penyimpanan browser.");return;}
        renderLibrary();window.dispatchEvent(new Event("aryanzz:history-updated"));toast("Seluruh riwayat unduhan dihapus.");
      });
    }
    const clearFavorites=$("clearFavoritesV2");
    if(clearFavorites&&!clearFavorites.dataset.v15Bound){
      clearFavorites.dataset.v15Bound="1";
      clearFavorites.addEventListener("click",()=>{
        if(!window.confirm("Hapus seluruh media favorit dari perangkat ini?"))return;
        try{localStorage.removeItem(KEY.favorites);}
        catch{toast("Favorit tidak dapat dihapus. Periksa penyimpanan browser.");return;}
        renderLibrary();window.dispatchEvent(new Event("aryanzz:history-updated"));toast("Seluruh media favorit dihapus.");
      });
    }
    window.addEventListener("storage",renderLibrary);
    window.addEventListener("aryanzz:history-updated",renderLibrary);
    renderLibrary();
  }

  /* V15 finish. */
  function init(){
    bindNavigation();setupToolSearch();setupDownloader();setupImageLab();setupTextExtras();setupLibrary();
    if("serviceWorker" in navigator)navigator.serviceWorker.ready.then(r=>r.update().catch(()=>{})).catch(()=>{});
    document.querySelector(".pill")?.setAttribute("title","ARYANZZ V25 Premium Experience");
  }
  init();
})();
