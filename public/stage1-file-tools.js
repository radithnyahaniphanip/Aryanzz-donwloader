(()=>{"use strict";
const stage=window.ARYANZZStage1;if(!stage)return;
stage.register("file-lightweight",(root,core)=>{
 const $=id=>core.q("#"+id,root),set=(id,msg,state="info")=>core.status($(id),msg,state);
 $("v1ltZipFiles")?.addEventListener("change",()=>{$("v1ltZipCreate").disabled=!$("v1ltZipFiles").files?.length;set("v1ltZipCreateStatus",$("v1ltZipFiles").files?.length+" file dipilih.")});
 $("v1ltZipCreate")?.addEventListener("click",async()=>{
  const files=[...$("v1ltZipFiles").files||[]];$("v1ltZipCreate").disabled=true;
  try{const blob=await core.createZip(files.map(file=>({name:file.name,data:file})));core.downloadBlob(blob,"aryanzz-archive.zip");set("v1ltZipCreateStatus","ZIP berhasil dibuat · "+files.length+" file · "+core.formatBytes(blob.size)+".","success")}
  catch(error){set("v1ltZipCreateStatus",error.message||"Gagal membuat ZIP.","error")}
  finally{$("v1ltZipCreate").disabled=!$("v1ltZipFiles").files?.length}
 });
 $("v1ltZipArchive")?.addEventListener("change",()=>{$("v1ltZipExtract").disabled=!$("v1ltZipArchive").files?.length;$("v1ltZipExtractList").replaceChildren()});
 $("v1ltZipExtract")?.addEventListener("click",async()=>{
  const file=$("v1ltZipArchive").files?.[0];if(!file)return;$("v1ltZipExtract").disabled=true;
  try{
   const entries=await core.extractZip(file),list=$("v1ltZipExtractList");list.replaceChildren();
   entries.forEach(entry=>list.append(core.fileRow(entry.name,core.formatBytes(entry.data.size),{label:"Unduh",run:()=>core.downloadBlob(entry.data,entry.name)})));
   set("v1ltZipExtractStatus","Ekstraksi berhasil · "+entries.length+" file lolos pemeriksaan CRC32.","success");
   if(!entries.length)list.textContent="Arsip tidak memiliki file yang dapat diekstrak.";
  }catch(error){set("v1ltZipExtractStatus",error.message||"Gagal mengekstrak ZIP.","error")}
  finally{$("v1ltZipExtract").disabled=!$("v1ltZipArchive").files?.length}
 });
 let renameFiles=[];
 function renamePreview(){
  const prefix=$("v1ltRenamePrefix").value,suffix=$("v1ltRenameSuffix").value,from=$("v1ltRenameFrom").value,to=$("v1ltRenameTo").value,used=new Set(),list=$("v1ltRenameList");list.replaceChildren();
  const names=renameFiles.map((file,index)=>{
   const dot=file.name.lastIndexOf("."),hasExt=dot>0,base=hasExt?file.name.slice(0,dot):file.name,ext=hasExt?file.name.slice(dot):"";
   let next=base;if(from)next=next.split(from).join(to);next=core.safeName(prefix+next+suffix+ext,"file-"+(index+1));
   const key=next.toLowerCase();if(used.has(key)){let n=2,candidate;do{candidate=core.safeName((next.slice(0,next.length-ext.length)||next)+"-"+n+ext);n++}while(used.has(candidate.toLowerCase()));next=candidate}
   used.add(next.toLowerCase());return next;
  });
  names.forEach((name,index)=>list.append(core.fileRow(renameFiles[index].name+"  →  "+name,core.formatBytes(renameFiles[index].size))));
  $("v1ltRenameExport").disabled=!renameFiles.length;return names;
 }
 $("v1ltRenameFiles")?.addEventListener("change",()=>{
  renameFiles=[...$("v1ltRenameFiles").files||[]];$("v1ltRenamePreview").disabled=!renameFiles.length;renamePreview();
  set("v1ltRenameStatus",renameFiles.length?renameFiles.length+" file siap diberi nama baru.":"Pilih file untuk membuat pola nama.");
 });
 ["v1ltRenamePrefix","v1ltRenameSuffix","v1ltRenameFrom","v1ltRenameTo"].forEach(id=>$(id)?.addEventListener("input",()=>{if(renameFiles.length)renamePreview()}));
 $("v1ltRenamePreview")?.addEventListener("click",renamePreview);
 $("v1ltRenameExport")?.addEventListener("click",async()=>{
  if(!renameFiles.length)return;$("v1ltRenameExport").disabled=true;
  try{const names=renamePreview(),blob=await core.createZip(renameFiles.map((file,index)=>({name:names[index],data:file})));core.downloadBlob(blob,"aryanzz-renamed-files.zip");set("v1ltRenameStatus","Berhasil mengemas "+renameFiles.length+" file dengan nama baru. File asli tidak diubah.","success")}
  catch(error){set("v1ltRenameStatus",error.message||"Gagal mengemas file.","error")}
  finally{$("v1ltRenameExport").disabled=!renameFiles.length}
 });
 let duplicateReport=[];
 $("v1ltDuplicateFiles")?.addEventListener("change",()=>{
  const files=[...$("v1ltDuplicateFiles").files||[]];$("v1ltDuplicateScan").disabled=!files.length;$("v1ltDuplicateResult").replaceChildren();$("v1ltDuplicateReport").disabled=true;
  set("v1ltDuplicateStatus",files.length?files.length+" file dipilih.":"Pilih file untuk mulai memindai.");
 });
 $("v1ltDuplicateScan")?.addEventListener("click",async()=>{
  const files=[...$("v1ltDuplicateFiles").files||[]];if(!files.length)return;
  if(!crypto?.subtle){set("v1ltDuplicateStatus","Browser tidak menyediakan Web Crypto SHA-256.","error");return}
  $("v1ltDuplicateScan").disabled=true;$("v1ltDuplicateResult").replaceChildren();duplicateReport=[];
  try{
   let total=0;const groups=new Map();
   for(let i=0;i<files.length;i++){
    const file=files[i];total+=file.size;if(total>core.MAX_TOTAL)throw new Error("Total file melebihi batas 250 MB.");
    if(file.size>core.MAX_FILE)throw new Error("File "+file.name+" melebihi batas 100 MB.");
    const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer()),hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
    const key=file.size+":"+hash;const group=groups.get(key)||{hash,size:file.size,files:[]};group.files.push(file.name);groups.set(key,group);
    set("v1ltDuplicateStatus","Memeriksa "+(i+1)+" dari "+files.length+" file…");
   }
   const duplicates=[...groups.values()].filter(group=>group.files.length>1);
   duplicates.forEach((group,index)=>{
    const row=document.createElement("div");row.className="v1lt-subtool";const title=document.createElement("h4");title.textContent="Grup duplikat "+(index+1)+" · "+group.files.length+" file";
    const info=document.createElement("p");info.textContent=core.formatBytes(group.size)+" per file · SHA-256 "+group.hash.slice(0,24)+"…";
    row.append(title,info);group.files.forEach(name=>row.append(core.fileRow(name,"identik")));$("v1ltDuplicateResult").append(row);
    group.files.forEach(name=>duplicateReport.push([name,group.size,group.hash,"duplicate-"+(index+1)]));
   });
   if(!duplicates.length)$("v1ltDuplicateResult").textContent="Tidak ditemukan file identik.";
   $("v1ltDuplicateReport").disabled=!duplicateReport.length;
   set("v1ltDuplicateStatus","Pemindaian selesai · "+duplicates.length+" grup duplikat ditemukan dari "+files.length+" file. Tidak ada file yang dihapus.","success");
  }catch(error){set("v1ltDuplicateStatus",error.message||"Pemindaian gagal.","error")}
  finally{$("v1ltDuplicateScan").disabled=!files.length}
 });
 $("v1ltDuplicateReport")?.addEventListener("click",()=>{
  const csv=core.csvString(["Nama file","Ukuran byte","SHA-256","Grup"],duplicateReport);
  core.downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),"aryanzz-duplicate-report.csv");
 });
 $("v1ltSplitFile")?.addEventListener("change",()=>{$("v1ltSplitRun").disabled=!$("v1ltSplitFile").files?.length;set("v1ltSplitStatus",$("v1ltSplitFile").files?.[0]?.name||"Pilih file yang ingin dipecah.")});
 $("v1ltSplitRun")?.addEventListener("click",async()=>{
  const file=$("v1ltSplitFile").files?.[0];if(!file)return;$("v1ltSplitRun").disabled=true;
  try{
   if(file.size>core.MAX_TOTAL)throw new Error("File melebihi batas 250 MB.");
   const chunkSize=Number($("v1ltSplitSize").value)*1024*1024,parts=[],base=core.safeName(file.name);
   if(file.size===0)parts.push({name:base+".part001",data:file});
   for(let offset=0,index=1;offset<file.size;offset+=chunkSize,index++){
    const partName=base+".part"+String(index).padStart(3,"0");
    parts.push({name:partName,data:file.slice(offset,Math.min(file.size,offset+chunkSize))});
   }
   const manifest={format:"ARYANZZ-SPLIT-1",originalName:file.name,originalSize:file.size,partCount:parts.length,partNames:parts.map(p=>p.name)};
   parts.push({name:"aryanzz-parts-manifest.json",data:JSON.stringify(manifest,null,2)});
   const blob=await core.createZip(parts);core.downloadBlob(blob,base+".parts.zip");
   set("v1ltSplitStatus","File berhasil dipecah menjadi "+manifest.partCount+" bagian dan dikemas dalam ZIP.","success");
  }catch(error){set("v1ltSplitStatus",error.message||"Gagal memecah file.","error")}
  finally{$("v1ltSplitRun").disabled=!$("v1ltSplitFile").files?.length}
 });
 $("v1ltJoinFiles")?.addEventListener("change",()=>{$("v1ltJoinRun").disabled=!($("v1ltJoinFiles").files?.length>1);set("v1ltJoinStatus",$("v1ltJoinFiles").files?.length?$("v1ltJoinFiles").files.length+" bagian dipilih.":"Pilih bagian file untuk digabungkan.")});
 $("v1ltJoinRun")?.addEventListener("click",async()=>{
  const files=[...$("v1ltJoinFiles").files||[]];if(files.length<2)return;$("v1ltJoinRun").disabled=true;
  try{
   if(files.reduce((sum,file)=>sum+file.size,0)>core.MAX_TOTAL)throw new Error("Total bagian melebihi batas 250 MB.");
   const parsed=files.map(file=>{const match=file.name.match(/^(.*)\.part(\d+)$/i);return {file,base:match?.[1]||"",index:match?Number(match[2]):0}});
   if(parsed.some(item=>!item.base||!item.index))throw new Error("Nama bagian harus mengikuti pola nama.part001, nama.part002, dan seterusnya.");
   const base=parsed[0].base;if(parsed.some(item=>item.base!==base))throw new Error("Semua bagian harus berasal dari nama file yang sama.");
   parsed.sort((a,b)=>a.index-b.index);
   for(let i=0;i<parsed.length;i++)if(parsed[i].index!==i+1)throw new Error("Urutan bagian tidak lengkap. Bagian yang hilang: part"+String(i+1).padStart(3,"0")+".");
   const blob=new Blob(parsed.map(item=>item.file),{type:"application/octet-stream"});core.downloadBlob(blob,base);
   set("v1ltJoinStatus","Berhasil menggabungkan "+parsed.length+" bagian menjadi "+core.formatBytes(blob.size)+".","success");
  }catch(error){set("v1ltJoinStatus",error.message||"Gagal menggabungkan bagian.","error")}
  finally{$("v1ltJoinRun").disabled=!($("v1ltJoinFiles").files?.length>1)}
 });
 let csvData=null,csvPage=0,csvSort={index:-1,direction:1};
 function csvFiltered(){
  if(!csvData)return [];
  const query=$("v1ltCsvSearch").value.toLocaleLowerCase();
  let rows=csvData.rows.filter(row=>!query||row.some(value=>String(value).toLocaleLowerCase().includes(query)));
  if(csvSort.index>=0)rows=rows.slice().sort((a,b)=>String(a[csvSort.index]??"").localeCompare(String(b[csvSort.index]??""),undefined,{numeric:true,sensitivity:"base"})*csvSort.direction);
  return rows;
 }
 function renderCsv(){
  if(!csvData)return;const rows=csvFiltered(),size=Number($("v1ltCsvPageSize").value)||25,pages=Math.max(1,Math.ceil(rows.length/size));csvPage=Math.min(csvPage,pages-1);
  const start=csvPage*size,visible=rows.slice(start,start+size),table=document.createElement("table");table.className="v1lt-table";
  const thead=document.createElement("thead"),headRow=document.createElement("tr");
  csvData.headers.forEach((header,index)=>{const th=document.createElement("th"),button=document.createElement("button");button.type="button";button.dataset.sortIndex=String(index);button.textContent=header+(csvSort.index===index?(csvSort.direction===1?" ↑":" ↓"):"");th.append(button);headRow.append(th)});
  thead.append(headRow);table.append(thead);const tbody=document.createElement("tbody");
  visible.forEach(row=>{const tr=document.createElement("tr");row.forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td)});tbody.append(tr)});
  if(!visible.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=Math.max(1,csvData.headers.length);td.textContent="Tidak ada baris yang cocok.";tr.append(td);tbody.append(tr)}
  table.append(tbody);$("v1ltCsvTable").replaceChildren(table);
  $("v1ltCsvPage").textContent=(rows.length?csvPage+1:0)+" / "+(rows.length?pages:0)+" · "+rows.length+" baris";
  $("v1ltCsvPrev").disabled=csvPage<=0;$("v1ltCsvNext").disabled=csvPage>=pages-1;$("v1ltCsvExport").disabled=!rows.length;
 }
 $("v1ltCsvFile")?.addEventListener("change",async()=>{
  const file=$("v1ltCsvFile").files?.[0];if(!file)return;
  try{
   if(file.size>15*1024*1024)throw new Error("CSV melebihi batas 15 MB untuk tampilan tabel.");
   const text=await file.text();csvData=core.parseCsv(text);if(!csvData.headers.length)throw new Error("CSV kosong atau tidak memiliki header.");
   if(csvData.rows.length>50000)throw new Error("CSV memiliki lebih dari 50.000 baris. Pecah file terlebih dahulu.");
   csvPage=0;csvSort={index:-1,direction:1};$("v1ltCsvSearch").disabled=false;$("v1ltCsvPageSize").disabled=false;renderCsv();
   set("v1ltCsvStatus","Berhasil membaca "+csvData.rows.length+" baris dan "+csvData.headers.length+" kolom. Delimiter: "+(csvData.delimiter==="\t"?"TAB":csvData.delimiter)+".","success");
  }catch(error){csvData=null;$("v1ltCsvTable").replaceChildren();set("v1ltCsvStatus",error.message||"Gagal membaca CSV.","error")}
 });
 $("v1ltCsvSearch")?.addEventListener("input",()=>{csvPage=0;renderCsv()});
 $("v1ltCsvPageSize")?.addEventListener("change",()=>{csvPage=0;renderCsv()});
 $("v1ltCsvTable")?.addEventListener("click",event=>{const button=event.target.closest("[data-sort-index]");if(!button)return;const index=Number(button.dataset.sortIndex);csvSort={index,direction:csvSort.index===index?-csvSort.direction:1};renderCsv()});
 $("v1ltCsvPrev")?.addEventListener("click",()=>{csvPage=Math.max(0,csvPage-1);renderCsv()});
 $("v1ltCsvNext")?.addEventListener("click",()=>{csvPage++;renderCsv()});
 $("v1ltCsvExport")?.addEventListener("click",()=>{if(!csvData)return;const rows=csvFiltered(),csv=core.csvString(csvData.headers,rows);core.downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),"aryanzz-filtered-data.csv");set("v1ltCsvStatus","Berhasil mengekspor "+rows.length+" baris. Formula spreadsheet berisiko diawali tanda petik untuk keamanan.","success")});
});
})();