(()=>{
"use strict";
const DB_NAME="aryanzz-scam-evidence-v1";
const OFFICIAL={iasc:"https://iasc.ojk.go.id/",account:"https://cekrekening.id/",phone:"https://aduannomor.id/",safe:"https://transparencyreport.google.com/safe-browsing/search"};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const unique=values=>[...new Set(values)];
const cleanText=value=>String(value??"").replace(/\u0000/g,"").trim();
function normalizePhone(value){
 let digits=String(value||"").replace(/[^\d+]/g,"");
 if(digits.startsWith("00"))digits="+"+digits.slice(2);
 if(digits.startsWith("+"))digits=digits.slice(1);
 else if(digits.startsWith("0"))digits="62"+digits.slice(1);
 if(!/^\d{8,15}$/.test(digits))return "";
 return "+"+digits;
}
function extractPhones(text){
 const matches=String(text||"").match(/(?:\+\s?\d[\d\s().-]{7,}\d|\b0\d[\d\s().-]{7,}\d\b|\b62\d[\d\s().-]{7,}\d\b)/g)||[];
 return unique(matches.map(normalizePhone).filter(Boolean));
}
function maskIdentifier(value){
 const raw=String(value||"");if(raw.length<=4)return raw;
 return raw.slice(0,Math.min(3,raw.length-4))+"•".repeat(Math.min(6,raw.length-4))+raw.slice(-4);
}
function extractAccounts(text){
 const pattern=/(no(?:mor)?\s*(?:rekening|rek(?:ening)?|akun)|rekening|rek(?:ening)?|virtual\s*account|\bVA\b|DANA|GOPAY|OVO|SHOPEEPAY|LINKAJA|BCA|BRI|BNI|MANDIRI|BSI|CIMB|PERMATA|BTN)[^\n]{0,48}?(\d[\d .-]{7,24}\d)/gi;
 const out=[],seen=new Set();let match;
 while((match=pattern.exec(String(text||"")))!==null){
  const digits=match[2].replace(/\D/g,"");
  if(digits.length<8||digits.length>24||seen.has(digits))continue;
  seen.add(digits);out.push({label:match[1].trim().slice(0,42),value:digits,masked:maskIdentifier(digits)});
 }
 return out;
}
function extractUrls(text){
 const matches=String(text||"").match(/(?:https?:\/\/|www\.)[^\s<>"']+/gi)||[];
 return unique(matches.map(raw=>raw.replace(/[),.;!?]+$/,"")).filter(Boolean)).map(raw=>{
  try{const url=new URL(raw.startsWith("www.")?"https://"+raw:raw);return {raw,url:url.href,host:url.hostname.toLowerCase()}}catch{return null}
 }).filter(Boolean);
}
function inspectUrl(item){
 let url;try{url=new URL(typeof item==="string"?item:item.url)}catch{return {risk:"unknown",reasons:["Format URL tidak valid."]}}
 const host=url.hostname.toLowerCase(),reasons=[];
 if(url.protocol!=="https:")reasons.push("Tidak menggunakan HTTPS.");
 if(url.username||url.password)reasons.push("URL menyisipkan kredensial.");
 if(host.startsWith("xn--")||host.split(".").some(part=>part.startsWith("xn--")))reasons.push("Menggunakan karakter domain Punycode.");
 if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host))reasons.push("Menggunakan alamat IP langsung.");
 if(/(^|\.)((bit\.ly)|(tinyurl\.com)|(t\.co)|(cutt\.ly)|(is\.gd)|(rb\.gy)|(shorturl\.at))$/i.test(host))reasons.push("Menggunakan layanan pemendek tautan.");
 const root=host.split(".").slice(-2,-1)[0]||host,brands=["bca","bri","bni","mandiri","gojek","gopay","ovo","dana","shopee","tokopedia","whatsapp","facebook","instagram"];
 if(brands.some(word=>root.includes(word)&&root!==word&&!root.endsWith(word)))reasons.push("Nama domain menyerupai merek/layanan; verifikasi alamat resminya.");
 return {risk:reasons.length>=3?"high":reasons.length?"review":"no-obvious-indicator",reasons,host,url:url.href};
}
const RULES=[
 {label:"Meminta OTP, PIN, password, atau kode verifikasi",weight:35,pattern:/\b(otp|pin|password|kata sandi|kode verifikasi|kode login|kode whatsapp)\b/i},
 {label:"Mendesak korban bertindak segera atau mengancam",weight:18,pattern:/\b(sekarang juga|segera|dalam \d+\s*(menit|jam)|akun.{0,18}(dibekukan|diblokir)|akan.{0,18}(ditutup|ditahan)|terakhir hari ini|jangan sampai)\b/i},
 {label:"Meminta transfer, biaya awal, atau pembayaran untuk pencairan",weight:24,pattern:/\b(transfer|kirim uang|biaya admin|biaya pencairan|uang muka|deposit|tebus|bayar.{0,18}(dulu|sekarang)|top up)\b/i},
 {label:"Menawarkan hadiah, hadiah undian, atau keuntungan tidak wajar",weight:18,pattern:/\b(hadiah|undian|menang|selamat.{0,20}(terpilih|mendapat)|bonus.{0,15}(besar|jutaan)|profit.{0,15}(pasti|dijamin))\b/i},
 {label:"Meminta memasang APK atau aplikasi kendali jarak jauh",weight:32,pattern:/\b(install|pasang|unduh).{0,28}(apk|aplikasi|anydesk|teamviewer|remote|akses jarak jauh)\b/i},
 {label:"Mengaku sebagai petugas bank, kurir, atau instansi",weight:12,pattern:/\b(petugas bank|customer service|cs bank|kurir|bea cukai|pajak|polisi|ojk|kominfo|dukcapil)\b/i},
 {label:"Mengirim tautan untuk login atau memperbarui data",weight:18,pattern:/\b(login|masuk|verifikasi|perbarui|update).{0,35}(akun|data|rekening|tautan|link)\b/i}
];
function analyzeScamText(text){
 const value=String(text||"").slice(0,250000),indicators=RULES.filter(rule=>rule.pattern.test(value)).map(rule=>({label:rule.label,weight:rule.weight}));
 const score=clamp(indicators.reduce((sum,item)=>sum+item.weight,0),0,100);
 return {score,level:score>=60?"high":score>=30?"review":"low",indicators,disclaimer:"Skor adalah indikator pola berbasis aturan lokal, bukan keputusan bahwa seseorang melakukan penipuan."};
}
function parseTimeline(text){
 const rows=[],seen=new Set(),source=String(text||"");
 const patterns=[
  {regex:/\[?(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:,?\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/g,build:m=>{let year=Number(m[3]);if(year<100)year+=year>=70?1900:2000;return new Date(year,Number(m[2])-1,Number(m[1]),Number(m[4]),Number(m[5]),Number(m[6]||0))}},
  {regex:/\b(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/g,build:m=>new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0))}
 ];
 for(const item of patterns){let match;while((match=item.regex.exec(source))!==null){const date=item.build(match);if(Number.isNaN(date.getTime()))continue;const key=date.toISOString();if(seen.has(key))continue;seen.add(key);rows.push({date:key,label:match[0],index:match.index,context:source.slice(Math.max(0,match.index-90),Math.min(source.length,match.index+180)).replace(/\s+/g," ").trim()})}}
 return rows.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,250);
}
function validCoords(lat,lng){
 const a=Number(lat),b=Number(lng);
 return Number.isFinite(a)&&Number.isFinite(b)&&a>=-90&&a<=90&&b>=-180&&b<=180&&Math.abs(a)+Math.abs(b)>0;
}
function extractCoordinates(text){
 const source=String(text||""),out=[],seen=new Set();
 const patterns=[
  /@(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/g,
  /!3d(-?\d{1,2}\.\d{3,})!4d(-?\d{1,3}\.\d{3,})/g,
  /(?:[?&](?:q|ll|query)=)(-?\d{1,2}\.\d{3,})%?2C?%?2C?(-?\d{1,3}\.\d{3,})/gi,
  /(?:^|[^\d])(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})(?!\d)/g
 ];
 for(const pattern of patterns){let match;while((match=pattern.exec(source))!==null){const lat=Number(match[1]),lng=Number(match[2]);if(!validCoords(lat,lng))continue;const key=lat.toFixed(5)+","+lng.toFixed(5);if(seen.has(key))continue;seen.add(key);out.push({lat,lng,source:"Koordinat eksplisit dalam teks/tautan",verified:false})}}
 return out.slice(0,20);
}
function mapsLinks(lat,lng){
 if(!validCoords(lat,lng))return null;
 const pair=Number(lat).toFixed(6)+","+Number(lng).toFixed(6);
 return {google:"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(pair),osm:"https://www.openstreetmap.org/?mlat="+encodeURIComponent(lat)+"&mlon="+encodeURIComponent(lng)+"#map=16/"+encodeURIComponent(lat)+"/"+encodeURIComponent(lng)};
}
function escapeHtml(value){
 return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function openDb(){
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(new Error("IndexedDB tidak tersedia di browser ini."));return}
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("cases"))db.createObjectStore("cases",{keyPath:"id"});if(!db.objectStoreNames.contains("files")){const store=db.createObjectStore("files",{keyPath:"id"});store.createIndex("caseId","caseId",{unique:false})}};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error("Database lokal tidak dapat dibuka."));
 });
}
async function readExif(file){
 if(!file||!/^image\/jpe?g$/i.test(file.type||""))return {};
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<12||view.getUint16(0)!==0xffd8)return {};
 let offset=2,tiff=-1;
 while(offset+4<bytes.length){
  if(bytes[offset]!==0xff)break;
  const marker=bytes[offset+1],length=view.getUint16(offset+2);
  if(length<2||offset+2+length>bytes.length)break;
  if(marker===0xe1&&length>=10&&String.fromCharCode(...bytes.slice(offset+4,offset+10))==="Exif\u0000\u0000"){tiff=offset+10;break}
  offset+=2+length;
 }
 if(tiff<0||tiff+8>bytes.length)return {};
 const little=bytes[tiff]===0x49&&bytes[tiff+1]===0x49;
 if(!little&&!(bytes[tiff]===0x4d&&bytes[tiff+1]===0x4d))return {};
 const u16=o=>view.getUint16(o,little),u32=o=>view.getUint32(o,little);
 if(u16(tiff+2)!==42)return {};
 const readAscii=(entry,count)=>{const type=u16(entry+2),n=count??u32(entry+4),base=n<=4?entry+8:tiff+u32(entry+8);if(type!==2||base<0||base+n>bytes.length)return "";return new TextDecoder().decode(bytes.slice(base,base+n)).replace(/\0+$/,"").trim()};
 const readRationals=(entry,count)=>{const type=u16(entry+2),n=count??u32(entry+4),base=n<=1?entry+8:tiff+u32(entry+8),values=[];if(type!==5||n>4||base<0||base+n*8>bytes.length)return values;for(let i=0;i<n;i++){const numerator=u32(base+i*8),denominator=u32(base+i*8+4);values.push(denominator?numerator/denominator:0)}return values};
 const readIfd=at=>{if(at<tiff||at+2>bytes.length)return [];const count=u16(at),entries=[];if(count>512||at+2+count*12>bytes.length)return entries;for(let i=0;i<count;i++){const pos=at+2+i*12;entries.push({tag:u16(pos),entry:pos,count:u32(pos+4)})}return entries};
 const ifd0=readIfd(tiff+u32(tiff+4)),meta={make:"",model:"",software:"",dateTime:"",gps:null};
 for(const item of ifd0){
  if(item.tag===0x010f)meta.make=readAscii(item.entry,item.count);
  if(item.tag===0x0110)meta.model=readAscii(item.entry,item.count);
  if(item.tag===0x0131)meta.software=readAscii(item.entry,item.count);
  if(item.tag===0x0132)meta.dateTime=readAscii(item.entry,item.count);
  if(item.tag===0x8825){
   const gpsIfd=tiff+u32(item.entry+8),gps=readIfd(gpsIfd),values={};
   for(const field of gps){if(field.tag===1)values.latRef=readAscii(field.entry,field.count);if(field.tag===2)values.lat=readRationals(field.entry,field.count);if(field.tag===3)values.lngRef=readAscii(field.entry,field.count);if(field.tag===4)values.lng=readRationals(field.entry,field.count);if(field.tag===29)values.date=readAscii(field.entry,field.count)}
   if(values.lat?.length===3&&values.lng?.length===3){
    const lat=values.lat[0]+values.lat[1]/60+values.lat[2]/3600,lng=values.lng[0]+values.lng[1]/60+values.lng[2]/3600;
    const signedLat=values.latRef==="S"?-lat:lat,signedLng=values.lngRef==="W"?-lng:lng;
    if(validCoords(signedLat,signedLng))meta.gps={lat:signedLat,lng:signedLng,date:values.date||"",source:"EXIF GPS",verified:false};
   }
  }
 }
 return meta;
}
const core={normalizePhone,extractPhones,maskIdentifier,extractAccounts,extractUrls,inspectUrl,analyzeScamText,parseTimeline,extractCoordinates,validCoords,mapsLinks,readExif,escapeHtml,OFFICIAL};
if(typeof window!=="undefined")window.ARYANZZScamEvidenceCore=core;
const stage1=typeof window!=="undefined"?window.ARYANZZStage1:null;
if(!stage1||typeof stage1.register!=="function")return;
stage1.register("scam-evidence",init);
function init(root,api){
 const $=id=>root.querySelector("#"+id);
 const state={files:[],text:"",analysis:null,phones:[],accounts:[],urls:[],timeline:[],locations:[],metadata:[],hashes:[],caseId:""};
 const status=(message,kind)=>api.status("scamStatus",message,kind||"info");
 function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el}
 function renderList(target,items,renderer,empty){
  const el=$(target);if(!el)return;el.replaceChildren();
  if(!items.length){el.append(node("p","scam-empty",empty));return}
  items.forEach(item=>el.append(renderer(item)));
 }
 function makeLink(label,url){const a=node("a","scam-link",label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a}
 function renderPhones(){
  renderList("scamPhones",state.phones,phone=>{const card=node("article","scam-result-card"),title=node("strong","",api.safeName(phone)),sub=node("small","","Format internasional; tidak menunjukkan lokasi atau identitas pemilik."),actions=node("div","scam-inline-actions");actions.append(makeLink("Periksa laporan resmi",OFFICIAL.phone));card.append(title,sub,actions);return card},"Nomor telepon belum ditemukan dalam teks.");
 }
 function renderAccounts(){
  renderList("scamAccounts",state.accounts,account=>{const card=node("article","scam-result-card"),title=node("strong","",account.label+" · "+account.masked),sub=node("small","","Pemeriksaan status dilakukan melalui portal resmi; ARYANZZ tidak mengakses database rekening pribadi."),actions=node("div","scam-inline-actions");actions.append(makeLink("CekRekening.id",OFFICIAL.account),makeLink("Laporkan ke IASC",OFFICIAL.iasc));card.append(title,sub,actions);return card},"Nomor rekening/e-wallet belum ditemukan. Tambahkan label rekening di percakapan agar lebih mudah dikenali.");
 }
 function renderUrls(){
  renderList("scamUrls",state.urls,item=>{const result=core.inspectUrl(item),card=node("article","scam-result-card"),title=node("strong","",result.host||item.host),risk=node("span","scam-risk scam-risk-"+result.risk,result.risk==="high"?"Perlu waspada":result.risk==="review"?"Perlu diperiksa":result.risk==="unknown"?"Format tidak valid":"Tidak ada indikator dasar"),address=node("code","",item.url),reasons=node("ul","scam-reasons");(result.reasons.length?result.reasons:["Tidak ditemukan indikator sederhana. Ini bukan jaminan situs aman."]).forEach(reason=>reasons.append(node("li","",reason)));const actions=node("div","scam-inline-actions");actions.append(makeLink("Google Safe Browsing",OFFICIAL.safe+"?url="+encodeURIComponent(item.url)),makeLink("URLScan search","https://urlscan.io/search/#"+encodeURIComponent("domain:"+result.host)));card.append(title,risk,address,reasons,actions);return card},"Tautan belum ditemukan.");
 }
 function renderTimeline(){
  renderList("scamTimeline",state.timeline,item=>{const row=node("article","scam-timeline-item"),time=node("time","",new Date(item.date).toLocaleString("id-ID")),context=node("p","",item.context);row.append(time,context);return row},"Belum ditemukan tanggal atau waktu yang dapat dikenali.");
 }
 function renderLocations(){
  renderList("scamLocations",state.locations,point=>{const card=node("article","scam-result-card"),title=node("strong","",point.source),coords=node("code","",point.lat.toFixed(6)+", "+point.lng.toFixed(6)),note=node("small","","Koordinat ditemukan dalam bukti; keaslian dan keberadaan seseorang di lokasi tersebut belum terverifikasi."),links=core.mapsLinks(point.lat,point.lng),actions=node("div","scam-inline-actions");if(links)actions.append(makeLink("Google Maps",links.google),makeLink("OpenStreetMap",links.osm));card.append(title,coords,note,actions);return card},"Tidak ada koordinat GPS atau lokasi eksplisit pada bukti yang diperiksa. Nomor telepon tidak digunakan untuk mencari lokasi.");
 }
 function renderMetadata(){
  renderList("scamMetadata",state.metadata,item=>{const card=node("article","scam-result-card"),title=node("strong","",item.name),lines=node("ul","scam-reasons");[["Jenis",item.type||"Tidak diketahui"],["Ukuran",api.formatBytes(item.size||0)],["Dimensi",item.dimensions||"—"],["Kamera EXIF",item.camera||"Tidak tersedia"],["Perangkat lunak EXIF",item.software||"Tidak tersedia"],["Waktu EXIF",item.dateTime||"Tidak tersedia"],["GPS",item.gps?"Tersedia":"Tidak tersedia"]].forEach(pair=>lines.append(node("li","",pair[0]+": "+pair[1])));card.append(title,lines);return card},"Metadata file akan muncul setelah file diperiksa.");
 }
 function renderRisk(){
  const result=state.analysis;if(!result)return;
  const score=$("scamRiskScore"),level=$("scamRiskLevel"),bar=$("scamRiskBar");
  if(score)score.textContent=result.score+"/100";
  if(level){level.textContent=result.level==="high"?"Indikasi kuat":result.level==="review"?"Perlu ditinjau":"Indikasi rendah";level.dataset.level=result.level}
  if(bar)bar.style.width=result.score+"%";
  renderList("scamIndicators",result.indicators,item=>node("li","",item.label+" (+"+item.weight+")"),"Tidak ada pola risiko yang cocok dengan aturan sederhana.");
  if($("scamRiskDisclaimer"))$("scamRiskDisclaimer").textContent=result.disclaimer;
 }
 function renderAll(){renderRisk();renderPhones();renderAccounts();renderUrls();renderTimeline();renderLocations();renderMetadata();if($("scamEvidenceCount"))$("scamEvidenceCount").textContent=state.files.length+" file · "+state.phones.length+" nomor · "+state.urls.length+" tautan"}
 async function loadTesseract(){
  if(window.Tesseract)return window.Tesseract;
  if(!navigator.onLine)throw new Error("OCR belum tersedia offline. Tempel teks percakapan secara manual atau sambungkan internet untuk memuat mesin OCR pertama kali.");
  await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";script.async=true;script.crossOrigin="anonymous";script.onload=resolve;script.onerror=()=>reject(new Error("Mesin OCR tidak dapat dimuat. Periksa koneksi atau gunakan input teks manual."));document.head.append(script)});
  if(!window.Tesseract?.recognize)throw new Error("Mesin OCR tidak siap.");return window.Tesseract;
 }
 async function ocrImage(file){
  const tesseract=await loadTesseract(),result=await tesseract.recognize(file,"ind+eng",{logger:message=>{if(message.status==="recognizing text")status("OCR "+Math.round((message.progress||0)*100)+"%…","info")}});
  return result.data?.text||"";
 }
 async function readPdf(file){
  if(!navigator.onLine)throw new Error("Pembaca PDF memerlukan library PDF.js pada pemuatan pertama. Simpan teks PDF sebagai .txt atau sambungkan internet.");
  const pdfjs=await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,parts=[];
  for(let pageNo=1;pageNo<=Math.min(pdf.numPages,40);pageNo++){const page=await pdf.getPage(pageNo),content=await page.getTextContent(),text=content.items.map(item=>item.str||"").join(" ");parts.push("[Halaman "+pageNo+"] "+(text.trim()||"Tidak ada lapisan teks. Ekspor halaman sebagai gambar untuk OCR."))}
  return parts.join("\n");
 }
 async function inspectFiles(files,runOcr){
  const metadata=[],locations=[],hashes=[],texts=[];
  for(let i=0;i<files.length;i++){
   const file=files[i];if(file.size>25*1024*1024){metadata.push({name:file.name,type:file.type,size:file.size,dimensions:"Melewati batas 25 MB"});continue}
   const item={name:file.name,type:file.type,size:file.size,dimensions:"—",camera:"",software:"",dateTime:"",gps:null};
   if(file.type.startsWith("image/")){
    try{const bitmap=await createImageBitmap(file);item.dimensions=bitmap.width+" × "+bitmap.height;bitmap.close()}catch{}
    try{const exif=await core.readExif(file);item.camera=[exif.make,exif.model].filter(Boolean).join(" ")||"";item.software=exif.software||"";item.dateTime=exif.dateTime||"";item.gps=exif.gps||null;if(exif.gps)locations.push(exif.gps)}catch{}
    if(runOcr)try{const text=await ocrImage(file);if(text.trim())texts.push("[OCR "+file.name+"]\n"+text)}catch(error){status(error.message||"OCR gagal.","warning")}
   }else if(file.type==="text/plain"||/\.(txt|log)$/i.test(file.name))texts.push("[File "+file.name+"]\n"+(await file.text()).slice(0,150000));
   else if(file.type==="text/csv"||/\.(csv|tsv)$/i.test(file.name))texts.push("[File "+file.name+"]\n"+(await file.text()).slice(0,150000));
   else if(file.type==="application/pdf"||/\.pdf$/i.test(file.name)){try{texts.push("[PDF "+file.name+"]\n"+(await readPdf(file)).slice(0,180000))}catch(error){status(error.message||"PDF gagal dibaca.","warning")}}
   metadata.push(item);
   if(globalThis.crypto?.subtle)try{const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());hashes.push({name:file.name,sha256:[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("")})}catch{}
  }
  state.metadata=metadata;state.locations=unique([...state.locations,...locations].map(point=>({lat:point.lat,lng:point.lng,source:point.source,verified:false})).map(point=>JSON.stringify(point))).map(value=>JSON.parse(value));state.hashes=hashes;
  return texts.join("\n\n");
 }
 function analyze(){
  const text=cleanText($("scamText")?.value||"").slice(0,250000);state.text=text;state.analysis=core.analyzeScamText(text);
  state.phones=core.extractPhones(text);state.accounts=core.extractAccounts(text);state.urls=core.extractUrls(text);state.timeline=core.parseTimeline(text);
  const combined=[...state.locations,...core.extractCoordinates(text)],seen=new Set();
  state.locations=combined.filter(point=>{const key=point.lat.toFixed(5)+","+point.lng.toFixed(5);if(seen.has(key))return false;seen.add(key);return true});
  renderAll();status("Analisis lokal selesai. "+state.phones.length+" nomor, "+state.accounts.length+" rekening/e-wallet, "+state.urls.length+" tautan, "+state.locations.length+" lokasi berbasis bukti ditemukan. Skor bukan vonis.","success");
 }
 async function runOcr(){
  const files=state.files.filter(file=>file.type.startsWith("image/"));if(!files.length){status("Pilih screenshot atau foto terlebih dahulu.","warning");return}
  const button=$("scamOcr");if(button)button.disabled=true;
  try{const text=await inspectFiles(files,true);if(text){$("scamText").value=[$("scamText").value,text].filter(Boolean).join("\n\n");status("OCR selesai. Tinjau teks hasil pengenalan sebelum analisis.","success")}else status("OCR tidak menemukan teks. Kamu tetap bisa mengetik atau menempelkan percakapan.","warning")}
  catch(error){status(error.message||"OCR gagal.","error")}finally{if(button)button.disabled=false}
 }
 async function loadFiles(){
  state.files=[...($("scamFiles")?.files||[])];state.metadata=[];state.hashes=[];state.locations=[];
  if($("scamFileSummary"))$("scamFileSummary").textContent=state.files.length?state.files.map(file=>file.name).join(" · "):"Belum ada file dipilih.";
  if(!state.files.length)return;
  status("Memeriksa metadata file secara lokal…");
  try{const extracted=await inspectFiles(state.files,false);if(extracted)$("scamText").value=[$("scamText").value,extracted].filter(Boolean).join("\n\n");renderMetadata();renderLocations();status("Metadata selesai dibaca di perangkat. File tidak diunggah.","success")}
  catch(error){status(error.message||"Gagal memeriksa file.","error")}
 }
 function addManualLocation(){
  const raw=cleanText($("scamManualCoords")?.value||"");let point=core.extractCoordinates(raw)[0];
  if(!point){const match=raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);if(match&&core.validCoords(match[1],match[2]))point={lat:Number(match[1]),lng:Number(match[2]),source:"Lokasi yang dimasukkan pengguna",verified:false}}
  if(!point){status("Masukkan koordinat yang valid atau tautan peta dengan koordinat eksplisit.","warning");return}
  if(!state.locations.some(item=>Math.abs(item.lat-point.lat)<0.00001&&Math.abs(item.lng-point.lng)<0.00001))state.locations.push(point);
  renderLocations();$("scamManualCoords").value="";status("Lokasi bukti ditambahkan. Ini bukan pelacakan nomor telepon.","success");
 }
 function openOnlineSources(){
  if(selectedMode()!=="online"){status("Pilih mode Online untuk membuka sumber resmi.","info");return}
  [OFFICIAL.iasc,OFFICIAL.account,OFFICIAL.phone].forEach(url=>window.open(url,"_blank","noopener,noreferrer"));
  status("Portal resmi dibuka. Pemeriksaan dilakukan manual; ARYANZZ tidak mengirim bukti atau data pribadi.","info");
 }
 function selectedMode(){return $("scamMode")?.value||"local"}
 function createRecord(){
  return {id:"scam-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),createdAt:new Date().toISOString(),mode:selectedMode(),text:state.text,analysis:state.analysis,phones:state.phones,accounts:state.accounts.map(item=>({label:item.label,value:item.value,masked:item.masked})),urls:state.urls,timeline:state.timeline,locations:state.locations,metadata:state.metadata,hashes:state.hashes,fileNames:state.files.map(file=>file.name),privacy:"Local-only IndexedDB. Evidence files are not uploaded."};
 }
 async function saveCase(){
  if(!state.analysis)analyze();
  try{
   const db=await openDb(),record=createRecord(),tx=db.transaction(["cases","files"],"readwrite");tx.objectStore("cases").put(record);
   state.files.forEach((file,index)=>tx.objectStore("files").put({id:record.id+"-"+index,caseId:record.id,name:file.name,type:file.type,size:file.size,blob:file}));
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error("Penyimpanan dibatalkan."))});
   db.close();state.caseId=record.id;status("Kasus tersimpan di IndexedDB perangkat ini. Tidak ada sinkronisasi cloud.","success");await listCases();
  }catch(error){status(error.message||"Tidak dapat menyimpan kasus lokal.","error")}
 }
 async function listCases(){
  const target=$("scamSavedCases");if(!target)return;
  try{
   const db=await openDb(),records=await new Promise((resolve,reject)=>{const request=db.transaction("cases","readonly").objectStore("cases").getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)});db.close();records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
   renderList("scamSavedCases",records,record=>{
    const row=node("article","scam-saved-row"),info=node("div",""),title=node("strong","",record.fileNames?.join(", ")||"Analisis teks"),date=node("small","",record.createdAt?new Date(record.createdAt).toLocaleString("id-ID"):"Kasus lokal"),actions=node("div","scam-inline-actions"),load=node("button","scam-small-button","Buka"),remove=node("button","scam-small-button scam-danger","Hapus");
    info.append(title,date);load.type=remove.type="button";load.addEventListener("click",()=>restoreCase(record));remove.addEventListener("click",()=>deleteCase(record.id));actions.append(load,remove);row.append(info,actions);return row;
   },"Belum ada kasus tersimpan di perangkat ini.");
  }catch(error){target.textContent="Penyimpanan lokal tidak tersedia: "+error.message}
 }
 function restoreCase(record){
  state.text=record.text||"";state.analysis=record.analysis||core.analyzeScamText(state.text);state.phones=record.phones||[];state.accounts=record.accounts||[];state.urls=record.urls||[];state.timeline=record.timeline||[];state.locations=record.locations||[];state.metadata=record.metadata||[];state.hashes=record.hashes||[];state.caseId=record.id;
  $("scamText").value=state.text;renderAll();status("Kasus lokal dimuat. File asli tetap tersimpan di perangkat.","success");
 }
 async function deleteCase(id){
  try{
   const db=await openDb(),tx=db.transaction(["cases","files"],"readwrite"),files=tx.objectStore("files"),request=files.index("caseId").getAll(id);
   tx.objectStore("cases").delete(id);request.onsuccess=()=>request.result.forEach(file=>files.delete(file.id));
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});db.close();status("Kasus lokal dihapus dari perangkat.","success");await listCases();
  }catch(error){status(error.message||"Gagal menghapus kasus.","error")}
 }
 function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.rel="noopener";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 function exportJson(){
  if(!state.analysis)analyze();const record=createRecord();downloadBlob(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}),"aryanzz-scam-evidence.json");
 }
 function printReport(){
  if(!state.analysis)analyze();const record=createRecord();
  const html="<!doctype html><html lang='id'><meta charset='utf-8'><title>ARYANZZ Scam Evidence Report</title><style>body{font:14px Arial,sans-serif;color:#172033;max-width:900px;margin:32px auto;padding:0 20px}h1,h2{color:#142747}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{padding:8px;border:1px solid #ccd5e2;text-align:left;vertical-align:top}small,.muted{color:#53627a}.warning{padding:12px;background:#fff5df;border:1px solid #e7c87e;border-radius:8px}@media print{button{display:none}}</style><h1>ARYANZZ Scam Evidence Report</h1><p class='muted'>Dibuat "+core.escapeHtml(new Date().toLocaleString("id-ID"))+" · Analisis lokal · Bukan penetapan kesalahan</p><h2>Ringkasan</h2><p>Skor indikator: <b>"+record.analysis.score+"/100</b> · Tingkat: "+core.escapeHtml(record.analysis.level)+"</p><div class='warning'>Skor berbasis pola teks dan tidak membuktikan identitas atau kesalahan seseorang. Nomor telepon tidak digunakan untuk memperoleh GPS atau alamat pribadi.</div><h2>Indikator</h2><ul>"+record.analysis.indicators.map(item=>"<li>"+core.escapeHtml(item.label)+"</li>").join("")+"</ul><h2>Nomor telepon</h2><ul>"+record.phones.map(item=>"<li>"+core.escapeHtml(core.maskIdentifier(item))+"</li>").join("")+"</ul><h2>Rekening / e-wallet</h2><ul>"+record.accounts.map(item=>"<li>"+core.escapeHtml(item.label)+" · "+core.escapeHtml(item.masked)+"</li>").join("")+"</ul><h2>Tautan</h2><ul>"+record.urls.map(item=>"<li>"+core.escapeHtml(item.url)+"</li>").join("")+"</ul><h2>Kronologi</h2><table><tr><th>Waktu</th><th>Konteks</th></tr>"+record.timeline.map(item=>"<tr><td>"+core.escapeHtml(new Date(item.date).toLocaleString("id-ID"))+"</td><td>"+core.escapeHtml(item.context)+"</td></tr>").join("")+"</table><h2>Lokasi dalam bukti</h2><ul>"+record.locations.map(item=>"<li>"+core.escapeHtml(item.source)+" · "+item.lat.toFixed(6)+", "+item.lng.toFixed(6)+" (belum terverifikasi)</li>").join("")+"</ul><h2>Integritas file</h2><ul>"+record.hashes.map(item=>"<li>"+core.escapeHtml(item.name)+" · SHA-256: "+item.sha256+"</li>").join("")+"</ul><h2>Teks bukti</h2><pre style='white-space:pre-wrap'>"+core.escapeHtml(record.text)+"</pre><p class='muted'>Verifikasi lanjutan dilakukan melalui kanal resmi yang berwenang.</p><script>window.onload=()=>window.print()</script></html>";
  const url=URL.createObjectURL(new Blob([html],{type:"text/html"})),popup=window.open(url,"_blank","noopener");
  if(!popup){downloadBlob(new Blob([html],{type:"text/html"}),"aryanzz-scam-evidence-report.html");status("Popup diblokir. Laporan HTML diunduh; buka lalu pilih Cetak / Simpan sebagai PDF.","warning")}else status("Laporan dibuka. Pilih Simpan sebagai PDF pada dialog cetak browser.","success");
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 $("scamFiles")?.addEventListener("change",loadFiles);$("scamOcr")?.addEventListener("click",runOcr);$("scamAnalyze")?.addEventListener("click",analyze);
 $("scamMode")?.addEventListener("change",()=>{const online=$("scamMode").value==="online";$("scamOnlinePanel").hidden=!online;status(online?"Mode Online: buka portal resmi secara manual. Data bukti tidak dikirim otomatis.":"Mode Lokal: analisis dilakukan di browser.","info")});
 $("scamOnlineOpen")?.addEventListener("click",openOnlineSources);$("scamAddLocation")?.addEventListener("click",addManualLocation);$("scamSave")?.addEventListener("click",saveCase);$("scamExportJson")?.addEventListener("click",exportJson);$("scamPrint")?.addEventListener("click",printReport);
 $("scamText")?.addEventListener("input",()=>{state.text=$("scamText").value});
 $("scamClear")?.addEventListener("click",()=>{state.files=[];state.text="";state.analysis=null;state.phones=[];state.accounts=[];state.urls=[];state.timeline=[];state.locations=[];state.metadata=[];state.hashes=[];$("scamFiles").value="";$("scamText").value="";$("scamFileSummary").textContent="Belum ada file dipilih.";renderAll();status("Form analisis dibersihkan. Kasus tersimpan tidak ikut dihapus.","info")});
 $("scamOpenPhone")?.addEventListener("click",()=>window.open(OFFICIAL.phone,"_blank","noopener,noreferrer"));$("scamOpenAccount")?.addEventListener("click",()=>window.open(OFFICIAL.account,"_blank","noopener,noreferrer"));$("scamOpenIasc")?.addEventListener("click",()=>window.open(OFFICIAL.iasc,"_blank","noopener,noreferrer"));
 listCases();
}
})();