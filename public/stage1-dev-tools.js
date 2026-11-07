(()=>{"use strict";
const stage=window.ARYANZZStage1;if(!stage)return;
stage.register("developer-lightweight",(root,core)=>{
 const $=id=>core.q("#"+id,root),set=(id,msg,state="info")=>core.status($(id),msg,state);
 function decodePart(part){
  const normalized=part.replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4);
  const binary=atob(padded),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 }
 function pretty(value){return JSON.stringify(value,null,2)}
 $("v1ltJwtDecode")?.addEventListener("click",()=>{
  const token=$("v1ltJwtInput").value.trim();$("v1ltJwtHeader").textContent="—";$("v1ltJwtPayload").textContent="—";$("v1ltJwtClaims").replaceChildren();
  try{
   const parts=token.split(".");if(parts.length!==3||parts.some(part=>!part))throw new Error("Format JWT harus terdiri dari tiga bagian.");
   const header=decodePart(parts[0]),payload=decodePart(parts[1]);
   if(!header||typeof header!=="object"||Array.isArray(header)||!payload||typeof payload!=="object"||Array.isArray(payload))throw new Error("Header atau payload JWT bukan objek JSON.");
   $("v1ltJwtHeader").textContent=pretty(header);$("v1ltJwtPayload").textContent=pretty(payload);
   const claims=[];
   for(const [key,label] of [["iss","Issuer"],["sub","Subject"],["aud","Audience"],["jti","Token ID"]])if(payload[key]!==undefined)claims.push([label,Array.isArray(payload[key])?payload[key].join(", "):payload[key]]);
   for(const [key,label] of [["iat","Issued at"],["nbf","Not before"],["exp","Expires at"]])if(payload[key]!==undefined){
    const date=new Date(Number(payload[key])*1000),valid=Number.isFinite(date.getTime());
    claims.push([label,valid?date.toLocaleString():String(payload[key])]);
    if(key==="exp"&&valid)claims.push(["Expiry status",date.getTime()<Date.now()?"Claim menyatakan token kedaluwarsa":"Claim belum melewati waktu kedaluwarsa"]);
   }
   if(header.alg)claims.unshift(["Algorithm claim",header.alg]);
   if(header.typ)claims.unshift(["Token type",header.typ]);
   if(!claims.length)claims.push(["Claims","Tidak ada claim standar yang dikenali"]);
   core.resultPairs("v1ltJwtClaims",claims);
   set("v1ltJwtStatus","JWT berhasil didekode secara lokal. Isi token dapat dibaca, tetapi tanda tangan dan keaslian token TIDAK diverifikasi.","success");
  }catch(error){set("v1ltJwtStatus",error.message||"JWT tidak valid atau encoding tidak didukung.","error")}
 });
 let activeWorker=null,activeWorkerUrl="",workerTimer=null;
 function stopWorker(){
  if(workerTimer)clearTimeout(workerTimer);workerTimer=null;
  if(activeWorker)activeWorker.terminate();activeWorker=null;
  if(activeWorkerUrl)URL.revokeObjectURL(activeWorkerUrl);activeWorkerUrl="";
 }
 $("v1ltRegexRun")?.addEventListener("click",()=>{
  stopWorker();
  const pattern=$("v1ltRegexPattern").value,text=$("v1ltRegexText").value,flags=$("v1ltRegexFlags").value;
  $("v1ltRegexSummary").replaceChildren();$("v1ltRegexHighlight").replaceChildren();
  if(pattern.length>500||text.length>30000){set("v1ltRegexStatus","Pola maksimal 500 karakter dan teks maksimal 30.000 karakter.","error");return}
  if(new Set(flags).size!==flags.length){set("v1ltRegexStatus","Flags tidak boleh berulang.","error");return}
  const workerSource=[
   "self.onmessage=(event)=>{",
   " const {pattern,text,flags}=event.data;",
   " try{",
   "  const scanFlags=flags.includes('g')?flags:flags+'g';",
   "  const regex=new RegExp(pattern,scanFlags),matches=[];let match;",
   "  while((match=regex.exec(text))!==null){",
   "   matches.push({value:match[0],index:match.index,length:match[0].length,groups:match.slice(1)});",
   "   if(matches.length>=500)break;",
   "   if(match[0]==='')regex.lastIndex++;",
   "  }",
   "  self.postMessage({ok:true,matches,truncated:matches.length>=500});",
   " }catch(error){self.postMessage({ok:false,error:error.message||'Regex error'})}",
   "};"
  ].join("\n");
  try{
   const blob=new Blob([workerSource],{type:"text/javascript"});activeWorkerUrl=URL.createObjectURL(blob);activeWorker=new Worker(activeWorkerUrl);
   activeWorker.onmessage=event=>{
    const result=event.data;stopWorker();
    if(!result.ok){set("v1ltRegexStatus","Regex error: "+result.error,"error");return}
    const matches=result.matches||[],summary=document.createElement("div");summary.className="v1lt-status";
    summary.textContent=matches.length+" kecocokan ditemukan"+(result.truncated?" · hasil dibatasi 500":"");$("v1ltRegexSummary").append(summary);
    const highlight=$("v1ltRegexHighlight"),fragment=document.createDocumentFragment();let cursor=0;
    matches.forEach(item=>{
     if(item.index<cursor)return;
     fragment.append(document.createTextNode(text.slice(cursor,item.index)));
     const mark=document.createElement("mark");mark.textContent=text.slice(item.index,item.index+item.length);fragment.append(mark);cursor=item.index+item.length;
    });
    fragment.append(document.createTextNode(text.slice(cursor)));highlight.replaceChildren(fragment);
    if(matches.length){
     const list=document.createElement("div");list.className="v1lt-file-list";
     matches.slice(0,50).forEach((item,index)=>list.append(core.fileRow("Match "+(index+1)+" · posisi "+item.index,JSON.stringify(item.value))));
     $("v1ltRegexSummary").append(list);
    }else highlight.textContent="Tidak ada kecocokan.";
    set("v1ltRegexStatus",matches.length?"Pola berhasil diuji di Web Worker.":"Tidak ada teks yang cocok dengan pola.","success");
   };
   activeWorker.onerror=()=>{stopWorker();set("v1ltRegexStatus","Worker regex gagal dijalankan pada browser ini.","error")};
   activeWorker.postMessage({pattern,text,flags});
   workerTimer=setTimeout(()=>{stopWorker();set("v1ltRegexStatus","Eksekusi dihentikan setelah 350 ms. Pola mungkin terlalu kompleks atau menyebabkan backtracking berlebihan.","error")},350);
   set("v1ltRegexStatus","Menjalankan regex di worker terisolasi…");
  }catch(error){stopWorker();set("v1ltRegexStatus",error.message||"Web Worker tidak tersedia.","error")}
 });
 window.addEventListener("pagehide",stopWorker,{once:true});
});
})();