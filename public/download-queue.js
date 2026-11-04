/* ARYANZZ V91.0 — Smart Download Queue */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const input=$("queueUrls"),list=$("queueList"),add=$("queueAdd"),run=$("queueRun"),clear=$("queueClear"),pause=$("queuePause");
  if(!input||!list||!add||!run||!clear)return;
  const KEY="aryanzz-smart-queue-v1";
  const MAX_ITEMS=100;
  let items=[],running=false,activeId=null;
  const makeId=()=>crypto.randomUUID?crypto.randomUUID():"q-"+Date.now()+"-"+Math.random().toString(36).slice(2);
  const safeText=value=>String(value||"");
  function save(){try{localStorage.setItem(KEY,JSON.stringify(items));}catch{setStatus("Penyimpanan browser penuh. Hapus beberapa item lama.");}}
  function setStatus(message){const el=$("queueStatus");if(el)el.textContent=message;}
  function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||"[]");items=Array.isArray(raw)?raw.filter(x=>x&&typeof x.url==="string"&&["pending","active","done","skipped","failed"].includes(x.status)).slice(0,MAX_ITEMS):[];}catch{items=[];}}
  function hostOf(raw){try{return new URL(raw).hostname.replace(/^www\./,"");}catch{return "";}}
  function addItems(){
    const lines=input.value.split(/[\r\n]+/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length){setStatus("Tempel satu atau beberapa tautan, masing-masing satu baris.");return;}
    let added=0,duplicates=0,invalid=0;
    for(const raw of lines){
      if(items.length>=MAX_ITEMS)break;
      let url;try{url=new URL(raw);if(!["http:","https:"].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error("URL invalid");}catch{invalid++;continue;}
      if(items.some(x=>x.url===url.href)){duplicates++;continue;}
      items.push({id:makeId(),url:url.href,host:hostOf(url.href),status:"pending",addedAt:Date.now()});added++;
    }
    input.value="";save();render();
    setStatus(added+" tautan ditambahkan"+(duplicates?", "+duplicates+" duplikat dilewati":"")+(invalid?", "+invalid+" tautan tidak valid":"")+". Maksimal "+MAX_ITEMS+" item.");
  }
  function nextPending(){return items.find(x=>x.status==="pending");}
  function openItem(item){
    if(!item)return;
    activeId=item.id;item.status="active";save();render();
    const urlField=$("url"),analyze=$("analyze");
    if(!urlField||!analyze){setStatus("Kolom downloader utama tidak ditemukan. Buka Beranda lalu coba lagi.");return;}
    if(typeof window.panel==="function")window.panel("");
    urlField.value=item.url;
    urlField.dispatchEvent(new Event("input",{bubbles:true}));
    analyze.click();
    setStatus("Menunggu proses unduhan. Jika file selesai diunduh melalui ARYANZZ, status akan berubah otomatis.");
  }
  function advanceQueue(message){
    const next=nextPending();
    if(running&&next){setStatus(message+" Melanjutkan ke tautan berikutnya…");openItem(next);return;}
    if(running){running=false;setStatus(message+" Semua item antrean sudah diproses.");}
    else setStatus(message);
    render();
  }
  function mark(id,status,automatic=false){
    const item=items.find(x=>x.id===id);if(!item)return;
    item.status=status;item.externalStarted=false;item.updatedAt=Date.now();
    if(activeId===id)activeId=null;
    save();render();
    if(status==="done")advanceQueue(automatic?"File berhasil disiapkan dan unduhan dimulai.":"Unduhan ditandai selesai.");
    else if(status==="failed")advanceQueue("Unduhan gagal. Item berikutnya dapat dilanjutkan.");
    else if(status==="skipped")advanceQueue("Item dilewati.");
    else setStatus("Item diperbarui.");
  }
  function findActive(detail){
    const raw=detail&&typeof detail.url==="string"?detail.url:"";
    let normalized=raw;try{normalized=new URL(raw).href;}catch{}
    return items.find(x=>x.id===activeId&&x.status==="active")||items.find(x=>x.status==="active"&&x.url===normalized);
  }
  window.addEventListener("aryanzz:download-start",event=>{
    const item=findActive(event.detail);if(!item)return;
    item.externalStarted=false;item.downloadStartedAt=Date.now();save();render();
    setStatus("Unduhan sedang diproses: "+(item.host||"media")+"…");
  });
  window.addEventListener("aryanzz:download-complete",event=>{
    const item=findActive(event.detail);if(!item)return;
    const detail=event.detail||{};
    mark(item.id,"done",true);
    const suffix=detail.bytes?" · "+(detail.bytes/1048576).toFixed(1)+" MB":"";
    setStatus("✓ "+(detail.name||item.host||"File")+" siap"+suffix+". "+(running?"Melanjutkan antrean…":""));
  });
  window.addEventListener("aryanzz:download-failed",event=>{
    const item=findActive(event.detail);if(!item)return;
    mark(item.id,"failed",true);
    setStatus("✕ "+(item.host||"Unduhan")+" gagal: "+String(event.detail?.error||"Kesalahan tidak diketahui").slice(0,150));
  });
  window.addEventListener("aryanzz:download-link-opened",event=>{
    const item=findActive(event.detail);if(!item)return;
    item.externalStarted=true;save();render();
    setStatus("Tautan unduhan dibuka di tab lain. Browser tidak memberi status selesai untuk tautan eksternal; konfirmasi setelah file benar-benar tersimpan.");
  });
  function button(label,cls,handler,disabled=false){const b=document.createElement("button");b.type="button";b.className=cls;b.textContent=label;b.disabled=disabled;b.addEventListener("click",handler);return b;}
  function render(){
    const pending=items.filter(x=>x.status==="pending").length,active=items.filter(x=>x.status==="active").length,done=items.filter(x=>x.status==="done").length;
    const counts=$("queueCounts");if(counts)counts.textContent=items.length+" item · "+pending+" menunggu · "+active+" aktif · "+done+" selesai";
    list.replaceChildren();
    if(!items.length){const empty=document.createElement("div");empty.className="queue-empty";empty.textContent="Antrean masih kosong. Tambahkan tautan di atas untuk mulai.";list.append(empty);}
    for(const item of items){
      const row=document.createElement("article");row.className="queue-item queue-"+item.status;
      const top=document.createElement("div");top.className="queue-item-top";
      const title=document.createElement("b");title.textContent=item.host||"Tautan media";
      const badge=document.createElement("span");badge.className="queue-state";badge.textContent=item.status==="active"&&item.externalStarted?"Menunggu konfirmasi":({pending:"Menunggu",active:"Mengunduh",done:"Selesai",skipped:"Dilewati",failed:"Gagal"})[item.status];
      top.append(title,badge);
      const url=document.createElement("div");url.className="queue-url";url.textContent=item.url;
      const actions=document.createElement("div");actions.className="queue-item-actions";
      if(item.status==="pending"||item.status==="active")actions.append(button("Buka di Downloader","tag",()=>openItem(item)));
      if(item.status==="active")actions.append(button("Konfirmasi selesai","tag queue-success",()=>mark(item.id,"done")),button("Tandai gagal","tag queue-danger",()=>mark(item.id,"failed")),button("Lewati","tag",()=>mark(item.id,"skipped")));
      if(["done","failed","skipped"].includes(item.status))actions.append(button("Ulangi","tag",()=>{item.status="pending";save();render();setStatus("Item dikembalikan ke antrean.");}));
      actions.append(button("Hapus","tag queue-danger",()=>{items=items.filter(x=>x.id!==item.id);if(activeId===item.id)activeId=null;save();render();}));
      row.append(top,url,actions);list.append(row);
    }
    run.disabled=!items.some(x=>x.status==="pending"||x.status==="active");
    run.textContent=running?"Lanjutkan antrean":"Mulai antrean";
    if(pause)pause.hidden=!running;
    clear.disabled=!items.length;
  }
  add.addEventListener("click",addItems);
  run.addEventListener("click",()=>{running=true;const active=items.find(x=>x.status==="active");const next=active||nextPending();if(next)openItem(next);else{running=false;setStatus("Tidak ada tautan yang menunggu.");}render();});
  if(pause)pause.addEventListener("click",()=>{running=false;setStatus("Antrean dijeda. Item yang sedang aktif tidak dibatalkan.");render();});
  clear.addEventListener("click",()=>{if(!items.length)return;if(!confirm("Kosongkan seluruh antrean unduhan?"))return;items=[];activeId=null;running=false;save();render();setStatus("Antrean dikosongkan.");});
  input.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key==="Enter")addItems();});
  load();render();
})();