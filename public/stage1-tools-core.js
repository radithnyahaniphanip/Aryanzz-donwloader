(()=>{"use strict";
const root=document.getElementById("v1LightTools");
if(!root)return;
const modules=[];
let loaded=false,pendingTool="";
const MAX_FILE=100*1024*1024,MAX_TOTAL=250*1024*1024,MAX_ENTRIES=200;
const q=(selector,scope=root)=>scope.querySelector(selector);
const qa=(selector,scope=root)=>[...scope.querySelectorAll(selector)];
function status(target,message,state="info"){
 const el=typeof target==="string"?q("#"+target):target;
 if(!el)return;
 el.textContent=String(message||"");
 el.dataset.state=state;
}
function formatBytes(value){
 const n=Number(value)||0;if(n<1024)return n+" B";
 const units=["KB","MB","GB","TB"];let x=n/1024,i=0;
 while(x>=1024&&i<units.length-1){x/=1024;i++}
 return x.toFixed(x>=100?0:x>=10?1:2)+" "+units[i];
}
function safeName(value,fallback="aryanzz-file"){
 const name=String(value||fallback).replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_").replace(/\s+/g," ").trim().replace(/^\.+/,"").slice(0,120);
 return name||fallback;
}
function downloadBlob(blob,name){
 if(!(blob instanceof Blob)||!blob.size)throw new Error("Tidak ada data hasil untuk diunduh.");
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=safeName(name);a.rel="noopener";a.style.display="none";
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function resultPairs(target,pairs){
 const el=typeof target==="string"?q("#"+target):target;if(!el)return;
 el.replaceChildren();
 for(const [label,value] of pairs){
  const item=document.createElement("div");item.className="v1lt-result-item";
  const small=document.createElement("small");small.textContent=label;
  const bold=document.createElement("b");bold.textContent=String(value??"—");
  item.append(small,bold);el.append(item);
 }
}
function fileRow(name,detail="",action){
 const row=document.createElement("div");row.className="v1lt-file-row";
 const left=document.createElement("span");left.textContent=name;
 const right=document.createElement("small");right.textContent=detail;
 row.append(left,right);
 if(action){const button=document.createElement("button");button.type="button";button.className="v1lt-secondary";button.textContent=action.label;button.addEventListener("click",action.run);row.append(button)}
 return row;
}
async function readFile(file,max=MAX_FILE){
 if(!file)throw new Error("Pilih file terlebih dahulu.");
 if(file.size>max)throw new Error("Ukuran file melebihi batas "+formatBytes(max)+".");
 return new Uint8Array(await file.arrayBuffer());
}
async function imageBitmap(file,maxBytes=35*1024*1024){
 if(!file||!file.type.startsWith("image/"))throw new Error("Pilih file gambar yang didukung.");
 if(file.size>maxBytes)throw new Error("Ukuran gambar terlalu besar. Batas "+formatBytes(maxBytes)+".");
 if(!("createImageBitmap" in window))throw new Error("Browser ini belum mendukung pemrosesan gambar lokal.");
 return createImageBitmap(file);
}
function canvasBlob(canvas,type="image/png",quality=.92){
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Browser gagal membuat file hasil.")),type,quality));
}
function waitEvent(target,event,timeout=12000){
 return new Promise((resolve,reject)=>{
  let timer=setTimeout(()=>{cleanup();reject(new Error("Waktu tunggu media habis."))},timeout);
  const done=()=>{cleanup();resolve()};
  const fail=()=>{cleanup();reject(new Error("Browser tidak dapat membaca media ini."))};
  function cleanup(){clearTimeout(timer);target.removeEventListener(event,done);target.removeEventListener("error",fail)}
  target.addEventListener(event,done,{once:true});target.addEventListener("error",fail,{once:true});
 });
}
function concatBytes(chunks){
 const total=chunks.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(total);let offset=0;
 for(const part of chunks){out.set(part,offset);offset+=part.length}
 return out;
}
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0}return table})();
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
function dosDate(date=new Date()){
 const year=Math.max(1980,date.getFullYear());
 return {time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2),date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};
}
function u16(view,offset,value){view.setUint16(offset,value,true)}
function u32(view,offset,value){view.setUint32(offset,value>>>0,true)}
async function transformRaw(bytes,mode){
 const Constructor=mode==="compress"?globalThis.CompressionStream:globalThis.DecompressionStream;
 if(typeof Constructor!=="function")throw new Error("Browser tidak mendukung kompresi DEFLATE untuk ZIP ini.");
 const stream=new Blob([bytes]).stream().pipeThrough(new Constructor("deflate-raw"));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function createZip(entries){
 if(!Array.isArray(entries)||!entries.length)throw new Error("Tambahkan minimal satu file.");
 if(entries.length>MAX_ENTRIES)throw new Error("Maksimal "+MAX_ENTRIES+" file per arsip.");
 const locals=[],centrals=[];let localOffset=0,total=0;
 for(const entry of entries){
  const name=safeName(entry.name||"file.bin");
  const nameBytes=new TextEncoder().encode(name);
  if(nameBytes.length>65535)throw new Error("Nama file terlalu panjang.");
  const source=entry.data instanceof Blob?new Uint8Array(await entry.data.arrayBuffer()):entry.data instanceof Uint8Array?entry.data:new TextEncoder().encode(String(entry.data??""));
  total+=source.length;if(source.length>MAX_FILE||total>MAX_TOTAL)throw new Error("Total data ZIP melebihi batas "+formatBytes(MAX_TOTAL)+".");
  const checksum=crc32(source),date=dosDate();
  let compressed=source,method=0;
  if(source.length>256&&typeof CompressionStream==="function"){
   try{const candidate=await transformRaw(source,"compress");if(candidate.length<source.length){compressed=candidate;method=8}}catch{}
  }
  const local=new Uint8Array(30+nameBytes.length),lv=new DataView(local.buffer);
  u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,method);u16(lv,10,date.time);u16(lv,12,date.date);u32(lv,14,checksum);u32(lv,18,compressed.length);u32(lv,22,source.length);u16(lv,26,nameBytes.length);u16(lv,28,0);local.set(nameBytes,30);
  locals.push(local,compressed);
  const central=new Uint8Array(46+nameBytes.length),cv=new DataView(central.buffer);
  u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,method);u16(cv,12,date.time);u16(cv,14,date.date);u32(cv,16,checksum);u32(cv,20,compressed.length);u32(cv,24,source.length);u16(cv,28,nameBytes.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,localOffset);central.set(nameBytes,46);
  centrals.push(central);localOffset+=local.length+compressed.length;
 }
 const centralBytes=concatBytes(centrals),localBytes=concatBytes(locals);
 if(centrals.length>65535||localOffset>0xffffffff||centralBytes.length>0xffffffff)throw new Error("Arsip melebihi batas ZIP standar (ZIP64 belum didukung).");
 const end=new Uint8Array(22),ev=new DataView(end.buffer);
 u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,centrals.length);u16(ev,10,centrals.length);u32(ev,12,centralBytes.length);u32(ev,16,localBytes.length);u16(ev,20,0);
 return new Blob([localBytes,centralBytes,end],{type:"application/zip"});
}
function findEocd(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50)return i;
 return -1;
}
async function extractZip(file){
 const bytes=await readFile(file,MAX_TOTAL),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),eocd=findEocd(bytes);
 if(eocd<0)throw new Error("Struktur ZIP tidak valid atau arsip ZIP64 tidak didukung.");
 const count=view.getUint16(eocd+10,true),cdSize=view.getUint32(eocd+12,true),cdOffset=view.getUint32(eocd+16,true);
 if(count===0xffff||cdSize===0xffffffff||cdOffset===0xffffffff)throw new Error("ZIP64 belum didukung pada mode ringan.");
 if(count>MAX_ENTRIES||cdOffset+cdSize>bytes.length)throw new Error("Daftar isi ZIP tidak valid atau terlalu besar.");
 const out=[];let offset=cdOffset,total=0;
 for(let index=0;index<count;index++){
  if(offset+46>bytes.length||view.getUint32(offset,true)!==0x02014b50)throw new Error("Entri ZIP rusak pada nomor "+(index+1)+".");
  const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),checksum=view.getUint32(offset+16,true),compressedSize=view.getUint32(offset+20,true),size=view.getUint32(offset+24,true),nameLen=view.getUint16(offset+28,true),extraLen=view.getUint16(offset+30,true),commentLen=view.getUint16(offset+32,true),localOffset=view.getUint32(offset+42,true);
  if(flags&1)throw new Error("ZIP terenkripsi tidak didukung.");
  if(method!==0&&method!==8)throw new Error("Metode kompresi ZIP "+method+" tidak didukung.");
  if(size>MAX_FILE||(total+=size)>MAX_TOTAL)throw new Error("Hasil ekstraksi melewati batas "+formatBytes(MAX_TOTAL)+".");
  const name=new TextDecoder("utf-8",{fatal:false}).decode(bytes.slice(offset+46,offset+46+nameLen)).replace(/\\/g,"/");
  if(name.startsWith("/")||name.split("/").includes(".."))throw new Error("Arsip berisi jalur file yang tidak aman.");
  offset+=46+nameLen+extraLen+commentLen;
  if(name.endsWith("/"))continue;
  if(localOffset+30>bytes.length||view.getUint32(localOffset,true)!==0x04034b50)throw new Error("Header file ZIP tidak valid.");
  const localNameLen=view.getUint16(localOffset+26,true),localExtraLen=view.getUint16(localOffset+28,true),dataStart=localOffset+30+localNameLen+localExtraLen,dataEnd=dataStart+compressedSize;
  if(dataEnd>bytes.length)throw new Error("Isi file ZIP terpotong.");
  const packed=bytes.slice(dataStart,dataEnd);
  const data=method===0?packed:await transformRaw(packed,"decompress");
  if(data.length!==size||crc32(data)!==checksum)throw new Error("Pemeriksaan integritas gagal untuk "+name+".");
  out.push({name:safeName(name.split("/").pop()||"file.bin"),data:new Blob([data],{type:"application/octet-stream"})});
 }
 return out;
}
function parseCsv(text){
 const first=String(text).split(/\r?\n/,1)[0]||"";
 const delimiters=[",",";","\t"];let delimiter=",",best=-1;
 for(const candidate of delimiters){let count=0,quoted=false;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted}else if(first[i]===candidate&&!quoted)count++}if(count>best){best=count;delimiter=candidate}}
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"')quoted=false;else cell+=ch}
  else if(ch==='"'&&cell==="")quoted=true;
  else if(ch===delimiter){row.push(cell);cell=""}
  else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(v=>v!==""))rows.push(row);row=[];cell=""}
  else cell+=ch;
 }
 row.push(cell);if(row.some(v=>v!==""))rows.push(row);
 if(!rows.length)return {headers:[],rows:[],delimiter};
 const headers=rows.shift().map((value,index)=>value.trim()||"Kolom "+(index+1));
 return {headers,rows:rows.map(values=>headers.map((_,index)=>values[index]??"")),delimiter};
}
function csvString(headers,rows){
 const encode=value=>{let text=String(value??"");if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 return [headers,...rows].map(row=>row.map(encode).join(",")).join("\r\n");
}
function openTool(id){
 const hub=q("#v1ltHub");
 if(!loaded){pendingTool=id;return}
 qa("[data-v1lt-view]").forEach(view=>view.hidden=view.dataset.v1ltView!==id);
 if(hub)hub.hidden=!!id;
 if(!id){if(hub)hub.hidden=false;return}
 const view=q('[data-v1lt-view="'+CSS.escape(id)+'"]');
 if(view)view.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}
function back(){openTool("")}
const api={q,qa,status,formatBytes,safeName,downloadBlob,resultPairs,fileRow,readFile,imageBitmap,canvasBlob,waitEvent,createZip,extractZip,parseCsv,csvString,openTool,back,MAX_FILE,MAX_TOTAL,MAX_ENTRIES};
window.ARYANZZStage1Core=api;
window.ARYANZZStage1={register(name,init){if(typeof init==="function")modules.push({name,init})},open:openTool,back};
document.addEventListener("click",event=>{
 const open=event.target.closest("[data-v1lt-open]");
 if(open){openTool(open.dataset.v1ltOpen);return}
 if(event.target.closest("[data-v1lt-back]")){back();return}
});
async function boot(){
 try{
  const response=await fetch("/stage1-tools-panel.html",{cache:"no-cache"});
  if(!response.ok)throw new Error("Panel alat tidak dapat dimuat (HTTP "+response.status+").");
  const markup=await response.text();
  if(!markup.includes('id="v1ltApp"'))throw new Error("Struktur panel alat tidak valid.");
  root.innerHTML=markup;loaded=true;
  for(const item of modules){try{item.init(root,api)}catch(error){console.error("[ARYANZZ Stage1] module init failed:",item.name,error)}}
  if(pendingTool){const id=pendingTool;pendingTool="";openTool(id)}
 }catch(error){
  root.innerHTML='<div class="v1lt-view"><h3>Tools Studio belum dapat dimuat</h3><p class="v1lt-status" data-state="error"></p><button type="button" class="v1lt-secondary" id="v1ltRetry">Coba lagi</button></div>';
  const message=q(".v1lt-status");if(message)message.textContent=error.message||"Gagal memuat modul.";
  q("#v1ltRetry")?.addEventListener("click",boot);
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();