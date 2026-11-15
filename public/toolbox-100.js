(()=>{"use strict";
const groups=["Text Editing","Text Analysis","Data & Documents","Encoding & Developer","Math & Numbers","Date & Time","Color & Design","Web & Validation","File & Data","Creative & Content"];
const tools=[];
const add=(id,group,title,desc,run)=>tools.push({id,group,title,desc,run});
const lines=v=>String(v||"").replace(/\r\n?/g,"\n").split("\n");
const nums=v=>(String(v||"").match(/-?\d+(?:\.\d+)?/g)||[]).map(Number).filter(Number.isFinite);
const esc=s=>String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const slug=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function parseCsv(text,delimiter=","){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){row.push(cell);cell="";}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell="";}else cell+=ch;}row.push(cell);if(row.some(x=>x!==""))rows.push(row);return rows;}
function csvCell(v){const s=String(v??"");return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function jsonSort(value){if(Array.isArray(value))return value.map(jsonSort);if(value&&typeof value==="object")return Object.keys(value).sort().reduce((o,k)=>(o[k]=jsonSort(value[k]),o),{});return value;}
function base64Encode(s){const bytes=new TextEncoder().encode(s);let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin);}
function base64Decode(s){const bin=atob(String(s).replace(/\s/g,""));const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
function hexRgb(v){let h=String(v).trim().replace(/^#/,"");if(h.length===3)h=h.split("").map(c=>c+c).join("");if(!/^[0-9a-f]{6}$/i.test(h))throw Error("Masukkan warna HEX valid, contoh #3366ff.");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function rgbHex(r,g,b){return "#"+[r,g,b].map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0")).join("").toUpperCase();}
function rgbHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0,s=0,l=(max+min)/2;if(d){s=d/(1-Math.abs(2*l-1));switch(max){case r:h=((g-b)/d)%6;break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h*=60;if(h<0)h+=360;}return [Math.round(h),Math.round(s*100),Math.round(l*100)];}
function hslRgb(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgb.map(v=>Math.round((v+m)*255));}
function lum(rgb){const a=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*a[0]+.7152*a[1]+.0722*a[2];}
function roman(n){n=Number(n);if(!Number.isInteger(n)||n<1||n>3999)throw Error("Masukkan bilangan bulat 1–3999.");const vals=[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];let out="";for(const [v,s] of vals)while(n>=v){out+=s;n-=v;}return out;}
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a;}
function randomInt(min,max){if(max<min)[min,max]=[max,min];const c=globalThis.crypto;if(c?.getRandomValues){const x=new Uint32Array(1);c.getRandomValues(x);return min+(x[0]%(max-min+1));}return min+Math.floor(Math.random()*(max-min+1));}
function dateInput(v){const d=new Date(v);if(Number.isNaN(d.getTime()))throw Error("Tanggal tidak valid. Gunakan format YYYY-MM-DD.");return d;}
function fmtDate(d){return d.toISOString().slice(0,10);}
function parseQueryLines(v){return lines(v).filter(x=>x.trim()).map(x=>{const i=x.indexOf("=");if(i<0)throw Error("Setiap baris harus memakai format key=value.");return [x.slice(0,i).trim(),x.slice(i+1).trim()];});}
function getMime(ext){const map={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif",svg:"image/svg+xml",mp4:"video/mp4",webm:"video/webm",mov:"video/quicktime",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",pdf:"application/pdf",txt:"text/plain",csv:"text/csv",json:"application/json",zip:"application/zip",html:"text/html",css:"text/css",js:"text/javascript",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};return map[String(ext).toLowerCase().replace(/^\./,"")]||"MIME tidak dikenal dalam daftar lokal.";}
function hashText(s){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)).then(buf=>Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,"0")).join(""));}
function titleCase(s){return String(s).toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g,(m,a,b)=>a+b.toUpperCase());}
function markdownText(s){return String(s).replace(/!\[([^\]]*)\]\([^)]+\)/g,"$1").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/^#{1,6}\s+/gm,"").replace(/^\s*>\s?/gm,"").replace(/^\s*[-*+]\s+/gm,"").replace(/^\s*\d+\.\s+/gm,"").replace(/[*_~]/g,"").replace(/\n{3,}/g,"\n\n");}
function contrast(a,b){const x=lum(hexRgb(a)),y=lum(hexRgb(b));return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)+":1";}
function csvToObjects(text){const rows=parseCsv(text);if(rows.length<2)throw Error("CSV harus memiliki header dan minimal satu baris.");const head=rows[0].map(x=>x.trim());return rows.slice(1).map(row=>Object.fromEntries(head.map((h,i)=>[h,row[i]??""])));}
function toolRun(id,v,a){const item=tools.find(t=>t.id===id);if(!item)throw Error("Alat tidak ditemukan.");return item.run(String(v??""),String(a??""));}

/* 01–10 · Text Editing */
add("uppercase","Text Editing","Uppercase Converter","Ubah seluruh teks menjadi huruf kapital.",v=>v.toLocaleUpperCase());
add("lowercase","Text Editing","Lowercase Converter","Ubah seluruh teks menjadi huruf kecil.",v=>v.toLocaleLowerCase());
add("title-case","Text Editing","Title Case Converter","Kapitalisasi awal kata untuk judul.",v=>titleCase(v));
add("sentence-case","Text Editing","Sentence Case Converter","Rapikan kapitalisasi awal kalimat.",v=>v.toLowerCase().replace(/(^\s*[a-zà-ÿ]|[.!?]\s+[a-zà-ÿ])/g,m=>m.toUpperCase()));
add("trim-lines","Text Editing","Trim Each Line","Hapus spasi di awal dan akhir setiap baris.",v=>lines(v).map(x=>x.trim()).join("\n"));
add("remove-blank-lines","Text Editing","Blank Line Cleaner","Hapus baris kosong dari teks.",v=>lines(v).filter(x=>x.trim()).join("\n"));
add("sort-lines","Text Editing","Line Sorter A–Z","Urutkan baris secara alfabetis.",v=>lines(v).sort((a,b)=>a.localeCompare(b,"id",{sensitivity:"base"})).join("\n"));
add("reverse-lines","Text Editing","Reverse Line Order","Balik urutan seluruh baris.",v=>lines(v).reverse().join("\n"));
add("unique-lines","Text Editing","Duplicate Line Remover","Hapus baris duplikat dan pertahankan urutan pertama.",v=>[...new Set(lines(v))].join("\n"));
add("slug-generator","Text Editing","Slug Generator","Ubah judul menjadi slug URL yang aman.",v=>slug(v));

/* 11–20 · Text Analysis */
add("word-count","Text Analysis","Word Counter","Hitung kata, karakter, dan estimasi waktu baca.",v=>{const w=v.trim()?v.trim().split(/\s+/).length:0;return "Kata: "+w+"\nKarakter: "+Array.from(v).length+"\nTanpa spasi: "+Array.from(v.replace(/\s/g,"")).length+"\nEstimasi baca: "+(w?Math.max(1,Math.ceil(w/200))+" menit":"0 menit");});
add("character-count","Text Analysis","Character Counter","Hitung karakter termasuk dan tanpa spasi.",v=>"Karakter Unicode: "+Array.from(v).length+"\nKarakter tanpa spasi: "+Array.from(v.replace(/\s/g,"")).length+"\nByte UTF-8: "+new TextEncoder().encode(v).length);
add("line-count","Text Analysis","Line Counter","Hitung baris total dan baris yang tidak kosong.",v=>"Total baris: "+(v?lines(v).length:0)+"\nBaris terisi: "+lines(v).filter(x=>x.trim()).length);
add("sentence-count","Text Analysis","Sentence Counter","Hitung perkiraan jumlah kalimat.",v=>"Jumlah kalimat: "+((v.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).filter(x=>x.trim()).length));
add("paragraph-count","Text Analysis","Paragraph Counter","Hitung paragraf berdasarkan pemisah baris kosong.",v=>"Jumlah paragraf: "+(v.trim()?v.trim().split(/\n\s*\n/).length:0));
add("reading-time","Text Analysis","Reading Time Estimator","Perkirakan waktu baca pada kecepatan 200 kata per menit.",v=>{const n=v.trim()?v.trim().split(/\s+/).length:0;return n+" kata · sekitar "+(n?Math.max(1,Math.ceil(n/200)):0)+" menit baca.";});
add("keyword-density","Text Analysis","Keyword Density Checker","Masukkan kata kunci pada parameter untuk menghitung frekuensi dan persentasenya.",(v,a)=>{if(!a.trim())throw Error("Isi parameter dengan kata kunci.");const w=v.trim()?v.trim().split(/\s+/).length:0;const re=new RegExp(a.replace(/[.*+?^{}$()|[\]\\]/g,"\\$&"),"gi");const n=(v.match(re)||[]).length;return "Kata kunci: "+a+"\nFrekuensi: "+n+"\nKepadatan: "+(w?(n/w*100).toFixed(2):"0.00")+"%";});
add("extract-emails","Text Analysis","Email Extractor","Temukan alamat email di dalam teks.",v=>[...new Set(v.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[])].join("\n")||"Tidak ada email ditemukan.");
add("extract-urls","Text Analysis","URL Extractor","Temukan tautan HTTP dan HTTPS di dalam teks.",v=>[...new Set(v.match(/https?:\/\/[^\s<>"']+/gi)||[])].join("\n")||"Tidak ada URL ditemukan.");
add("duplicate-words","Text Analysis","Duplicate Word Finder","Temukan kata berulang yang berdekatan.",v=>{const found=[...v.matchAll(/\b([\p{L}\p{N}]+)\s+\1\b/giu)].map(m=>m[0]);return [...new Set(found)].join("\n")||"Tidak ada kata berulang berdekatan.";});

/* 21–30 · Data & Documents */
add("json-formatter","Data & Documents","JSON Formatter","Format JSON agar mudah dibaca.",v=>JSON.stringify(JSON.parse(v),null,2));
add("json-minifier","Data & Documents","JSON Minifier","Hilangkan spasi JSON yang tidak diperlukan.",v=>JSON.stringify(JSON.parse(v)));
add("json-validator","Data & Documents","JSON Validator","Periksa sintaks JSON dan tampilkan status valid.",v=>{JSON.parse(v);return "JSON VALID ✓";});
add("json-sort-keys","Data & Documents","JSON Key Sorter","Urutkan key objek JSON secara alfabetis.",v=>JSON.stringify(jsonSort(JSON.parse(v)),null,2));
add("csv-to-json","Data & Documents","CSV to JSON","Ubah CSV menjadi array objek JSON.",v=>JSON.stringify(csvToObjects(v),null,2));
add("json-to-csv","Data & Documents","JSON to CSV","Ubah array objek JSON menjadi CSV.",v=>{const data=JSON.parse(v);if(!Array.isArray(data)||!data.length||typeof data[0]!=="object")throw Error("Masukkan array objek JSON.");const head=[...new Set(data.flatMap(x=>Object.keys(x)))];return [head.map(csvCell).join(","),...data.map(row=>head.map(k=>csvCell(row[k])).join(","))].join("\n");});
add("csv-to-tsv","Data & Documents","CSV to TSV","Ubah CSV menjadi tabel tab-separated.",v=>parseCsv(v).map(r=>r.join("\t")).join("\n"));
add("tsv-to-csv","Data & Documents","TSV to CSV","Ubah tabel tab-separated menjadi CSV.",v=>parseCsv(v,"\t").map(r=>r.map(csvCell).join(",")).join("\n"));
add("markdown-to-text","Data & Documents","Markdown to Plain Text","Bersihkan markup Markdown menjadi teks biasa.",v=>markdownText(v));
add("markdown-toc","Data & Documents","Markdown Table of Contents","Buat daftar isi dari heading Markdown.",v=>lines(v).map(x=>{const m=x.match(/^(#{1,6})\s+(.+)/);return m?"  ".repeat(m[1].length-1)+"- ["+m[2]+"](#"+slug(m[2])+")":""}).filter(Boolean).join("\n")||"Tidak ada heading Markdown.");

/* 31–40 · Encoding & Developer */
add("base64-encode","Encoding & Developer","Base64 Encoder","Encode teks UTF-8 ke Base64.",v=>base64Encode(v));
add("base64-decode","Encoding & Developer","Base64 Decoder","Decode Base64 menjadi teks UTF-8.",v=>base64Decode(v));
add("url-encode","Encoding & Developer","URL Component Encoder","Encode teks untuk parameter URL.",v=>encodeURIComponent(v));
add("url-decode","Encoding & Developer","URL Component Decoder","Decode teks URL-encoded.",v=>decodeURIComponent(v.replace(/\+/g," ")));
add("html-escape","Encoding & Developer","HTML Escape","Amankan karakter khusus untuk ditampilkan sebagai HTML.",v=>esc(v));
add("html-unescape","Encoding & Developer","HTML Entity Decoder","Decode entity HTML umum dan numeric.",v=>v.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(m,k)=>{const map={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "};if(map[k.toLowerCase()]!==undefined)return map[k.toLowerCase()];const n=k[1].toLowerCase()==="x"?parseInt(k.slice(2),16):parseInt(k.slice(1),10);try{return String.fromCodePoint(n)}catch{return m;}}));
add("jwt-decode","Encoding & Developer","JWT Payload Decoder","Decode payload JWT lokal; tidak memverifikasi tanda tangan token.",v=>{const p=v.trim().split(".");if(p.length<2)throw Error("Token JWT harus memiliki minimal dua bagian.");return JSON.stringify(JSON.parse(base64Decode(p[1].replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-p[1].length%4)%4))),null,2);});
add("uuid-generator","Encoding & Developer","UUID Generator","Buat UUID v4 secara lokal.",(v,a)=>{const n=Math.max(1,Math.min(50,Number(a)||1));return Array.from({length:n},()=>crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=randomInt(0,15);return(c==="x"?r:(r&3|8)).toString(16)})).join("\n");});
add("regex-tester","Encoding & Developer","Regex Tester","Masukkan pola regex pada parameter; hasil menampilkan semua kecocokan.",(v,a)=>{if(!a)throw Error("Isi parameter dengan pola regex.");if(a.length>180||v.length>12000||/(?:\([^)]*[+*][^)]*\)|\[[^\]]+\])[+*{]/.test(a))throw Error("Pola terlalu kompleks atau panjang untuk pemeriksaan aman.");const m=[...v.matchAll(new RegExp(a,"gi"))].map(x=>x[0]);return "Jumlah kecocokan: "+m.length+"\n"+m.join("\n");});
add("regex-replace","Encoding & Developer","Regex Replace","Parameter gunakan format pola=>pengganti. Regex dijalankan global.",(v,a)=>{const i=a.indexOf("=>");if(i<0)throw Error("Parameter harus berformat pola=>pengganti.");const p=a.slice(0,i);if(p.length>180||/(?:\([^)]*[+*][^)]*\)|\[[^\]]+\])[+*{]/.test(p))throw Error("Pola regex terlalu kompleks.");return v.replace(new RegExp(p,"g"),a.slice(i+2));});

/* 41–50 · Math & Numbers */
add("percentage-calc","Math & Numbers","Percentage Calculator","Masukkan nilai dasar pada teks dan persentase pada parameter.",(v,a)=>{const base=Number(v),pct=Number(a);if(!Number.isFinite(base)||!Number.isFinite(pct))throw Error("Isi nilai dasar dan persentase.");return pct+"% dari "+base+" = "+(base*pct/100);});
add("average-calc","Math & Numbers","Average Calculator","Hitung rata-rata dari angka yang dipisahkan koma atau spasi.",v=>{const a=nums(v);if(!a.length)throw Error("Masukkan daftar angka.");return "Jumlah data: "+a.length+"\nTotal: "+a.reduce((x,y)=>x+y,0)+"\nRata-rata: "+(a.reduce((x,y)=>x+y,0)/a.length);});
add("median-calc","Math & Numbers","Median Calculator","Hitung nilai tengah dari daftar angka.",v=>{const a=nums(v).sort((x,y)=>x-y);if(!a.length)throw Error("Masukkan daftar angka.");const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;});
add("stddev-calc","Math & Numbers","Standard Deviation","Hitung simpangan baku populasi dari daftar angka.",v=>{const a=nums(v);if(!a.length)throw Error("Masukkan daftar angka.");const avg=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((s,x)=>s+(x-avg)**2,0)/a.length).toFixed(6);});
add("random-number","Math & Numbers","Random Number Generator","Parameter gunakan min,max,jumlah. Default 1,100,1.",(v,a)=>{const p=nums(a);const min=p[0]??1,max=p[1]??100,count=Math.max(1,Math.min(100,p[2]??1));if(!Number.isInteger(min)||!Number.isInteger(max))throw Error("Min dan max harus bilangan bulat.");return Array.from({length:count},()=>randomInt(min,max)).join("\n");});
add("base-converter","Math & Numbers","Number Base Converter","Parameter gunakan basis asal,basis tujuan. Contoh 10,16.",(v,a)=>{const p=nums(a);const from=p[0]??10,to=p[1]??2;if(from<2||from>36||to<2||to>36)throw Error("Basis harus antara 2 dan 36.");const n=parseInt(v.trim(),from);if(!Number.isFinite(n))throw Error("Angka tidak valid untuk basis asal.");return n.toString(to).toUpperCase();});
add("binary-to-decimal","Math & Numbers","Binary to Decimal","Konversi bilangan biner menjadi desimal.",v=>{const s=v.trim();if(!/^[01]+$/.test(s))throw Error("Masukkan angka biner 0 dan 1 saja.");return BigInt("0b"+s).toString(10);});
add("roman-numeral","Math & Numbers","Roman Numeral Converter","Konversi angka 1–3999 menjadi angka Romawi.",v=>roman(v.trim()));
add("prime-checker","Math & Numbers","Prime Number Checker","Periksa apakah bilangan bulat merupakan bilangan prima.",v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw Error("Masukkan bilangan bulat non-negatif.");if(n<2)return n+" bukan bilangan prima.";for(let i=2;i<=Math.sqrt(n);i++)if(n%i===0)return n+" bukan prima; faktor: "+i+" × "+(n/i);return n+" adalah bilangan prima ✓";});
add("gcd-lcm","Math & Numbers","GCD & LCM Calculator","Masukkan dua bilangan pada teks, dipisahkan koma.",v=>{const a=nums(v);if(a.length<2||!a.every(Number.isInteger))throw Error("Masukkan dua bilangan bulat.");const g=gcd(a[0],a[1]);return "GCD: "+g+"\nLCM: "+(g?Math.abs(a[0]*a[1])/g:0);});

/* 51–60 · Date & Time */
add("unix-timestamp","Date & Time","Unix Timestamp Converter","Konversi timestamp detik/milidetik ke tanggal ISO. Kosong = waktu sekarang.",v=>{const n=v.trim()?Number(v):Date.now();if(!Number.isFinite(n))throw Error("Timestamp tidak valid.");const d=new Date(Math.abs(n)<1e12?n*1000:n);if(Number.isNaN(d.getTime()))throw Error("Timestamp di luar rentang.");return "ISO: "+d.toISOString()+"\nLokal: "+d.toLocaleString()+"\nUnix detik: "+Math.floor(d.getTime()/1000);});
add("date-difference","Date & Time","Date Difference Calculator","Masukkan dua tanggal dipisahkan koma atau baris baru.",v=>{const p=v.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);if(p.length<2)throw Error("Masukkan tanggal awal dan akhir.");const ms=Math.abs(dateInput(p[1])-dateInput(p[0])),days=Math.floor(ms/86400000);return "Selisih: "+days+" hari\nJam: "+(ms/3600000).toFixed(2)+"\nMinggu: "+(days/7).toFixed(2);});
add("add-days","Date & Time","Add Days to Date","Masukkan tanggal pada teks dan jumlah hari pada parameter.",(v,a)=>{const d=dateInput(v);const n=Number(a);if(!Number.isInteger(n))throw Error("Parameter harus jumlah hari berupa bilangan bulat.");d.setDate(d.getDate()+n);return fmtDate(d);});
add("age-calculator","Date & Time","Age Calculator","Masukkan tanggal lahir dengan format YYYY-MM-DD.",v=>{const dob=dateInput(v),now=new Date();let age=now.getFullYear()-dob.getFullYear();if(now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate()))age--;if(age<0)throw Error("Tanggal lahir berada di masa depan.");return "Usia saat ini: "+age+" tahun\nTanggal lahir: "+fmtDate(dob);});
add("weekday-finder","Date & Time","Weekday Finder","Cari nama hari dari tanggal.",v=>dateInput(v).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}));
add("date-format-converter","Date & Time","Date Format Converter","Parameter opsional berupa locale, contoh en-GB atau id-ID.",(v,a)=>{const d=dateInput(v);return d.toLocaleDateString(a.trim()||"id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"});});
add("duration-converter","Date & Time","Duration Converter","Konversi durasi detik menjadi jam, menit, detik.",v=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error("Masukkan durasi detik non-negatif.");const s=Math.floor(n),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;return [h,m,r].map(x=>String(x).padStart(2,"0")).join(":");});
add("business-days","Date & Time","Business Days Counter","Masukkan tanggal awal dan akhir dipisahkan koma.",v=>{const p=v.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);if(p.length<2)throw Error("Masukkan tanggal awal dan akhir.");let d=dateInput(p[0]),end=dateInput(p[1]);if(d>end)[d,end]=[end,d];let count=0;for(;d<=end;d.setDate(d.getDate()+1)){const day=d.getDay();if(day!==0&&day!==6)count++;}return "Hari kerja (Senin–Jumat): "+count;});
add("timezone-formatter","Date & Time","Time Zone Formatter","Masukkan tanggal opsional; parameter isi zona IANA, contoh Asia/Jakarta.",(v,a)=>{const d=v.trim()?dateInput(v):new Date(),tz=a.trim()||"Asia/Jakarta";try{return d.toLocaleString("id-ID",{timeZone:tz,dateStyle:"full",timeStyle:"long"})+"\nZona: "+tz;}catch{throw Error("Nama zona waktu tidak dikenal.");}});
add("countdown-calculator","Date & Time","Countdown Calculator","Masukkan tanggal dan waktu target, contoh 2027-01-01T00:00:00.",v=>{const d=dateInput(v),ms=d-Date.now();if(ms<=0)return "Waktu target sudah berlalu.";const day=Math.floor(ms/86400000),hour=Math.floor(ms%86400000/3600000),min=Math.floor(ms%3600000/60000);return day+" hari, "+hour+" jam, "+min+" menit lagi.";});

/* 61–70 · Color & Design */
add("hex-to-rgb","Color & Design","HEX to RGB","Konversi warna HEX ke nilai RGB dan HSL.",v=>{const r=hexRgb(v);return "RGB: rgb("+r.join(", ")+")\nHSL: hsl("+rgbHsl(...r).join(", ")+")";});
add("rgb-to-hex","Color & Design","RGB to HEX","Masukkan nilai R,G,B dipisahkan koma.",v=>{const p=nums(v);if(p.length<3||p.slice(0,3).some(n=>n<0||n>255))throw Error("Masukkan R,G,B antara 0–255.");return rgbHex(...p.slice(0,3));});
add("hsl-to-rgb","Color & Design","HSL to RGB","Masukkan hue,saturation,lightness. Contoh 210,80,50.",v=>{const p=nums(v);if(p.length<3)throw Error("Masukkan H,S,L.");return "RGB: "+hslRgb(...p.slice(0,3)).join(", ")+"\nHEX: "+rgbHex(...hslRgb(...p.slice(0,3)));});
add("contrast-ratio","Color & Design","Color Contrast Checker","Masukkan dua warna HEX dipisahkan koma untuk cek rasio kontras.",v=>{const p=v.split(/[,\s]+/).filter(Boolean);if(p.length<2)throw Error("Masukkan warna teks dan latar, contoh #000000,#ffffff.");const ratio=contrast(p[0],p[1]);return "Rasio kontras: "+ratio+"\nWCAG AA teks normal: "+(Number(ratio.split(":")[0])>=4.5?"LULUS":"BELUM LULUS");});
add("gradient-generator","Color & Design","CSS Gradient Generator","Masukkan dua warna HEX dipisahkan koma; parameter sudut derajat.",(v,a)=>{const p=v.split(/[,\s]+/).filter(Boolean);if(p.length<2)throw Error("Masukkan dua warna HEX.");hexRgb(p[0]);hexRgb(p[1]);return "background: linear-gradient("+(Number(a)||135)+"deg, "+p[0]+", "+p[1]+");";});
add("palette-generator","Color & Design","Color Palette Generator","Buat palet lima warna dari warna dasar HEX.",v=>{const [r,g,b]=hexRgb(v),[h,s,l]=rgbHsl(r,g,b);return [-40,-20,0,20,40].map(delta=>rgbHex(...hslRgb(h+delta,Math.max(20,s),Math.max(15,Math.min(85,l))))).join("\n");});
add("random-color","Color & Design","Random Color Generator","Parameter jumlah warna; default 1, maksimum 30.",(v,a)=>Array.from({length:Math.max(1,Math.min(30,Number(a)||1))},()=>rgbHex(randomInt(0,255),randomInt(0,255),randomInt(0,255))).join("\n"));
add("box-shadow-generator","Color & Design","CSS Box Shadow Generator","Parameter opsional: x,y,blur,spread,color.",(v,a)=>{const p=a.split(",").map(x=>x.trim());const x=Number(p[0]??"0"),y=Number(p[1]??"8"),blur=Number(p[2]??"24"),spread=Number(p[3]??"0"),color=p[4]||"rgba(0,0,0,.18)";return "box-shadow: "+x+"px "+y+"px "+blur+"px "+spread+"px "+color+";";});
add("border-radius-generator","Color & Design","Border Radius Generator","Masukkan satu sampai empat nilai radius (px).",v=>{const p=nums(v);if(!p.length||p.length>4||p.some(n=>n<0))throw Error("Masukkan 1–4 nilai radius non-negatif.");return "border-radius: "+p.map(n=>n+"px").join(" ")+";";});
add("spacing-scale-generator","Color & Design","Spacing Scale Generator","Parameter adalah nilai dasar dalam px; default 4.",(v,a)=>{const base=Number(a)||4;if(base<=0||base>100)throw Error("Nilai dasar harus 1–100.");return [1,2,3,4,6,8,12,16].map(n=>"--space-"+n+": "+(base*n)+"px;").join("\n");});

/* 71–80 · Web & Validation */
add("url-validator","Web & Validation","URL Validator","Validasi URL dan tampilkan komponen utamanya.",v=>{const u=new URL(v.trim());return "Valid ✓\nProtocol: "+u.protocol+"\nHost: "+u.host+"\nPath: "+u.pathname+"\nQuery: "+u.search;});
add("email-validator","Web & Validation","Email Validator","Periksa format alamat email secara lokal.",v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())?"Format email terlihat valid ✓":"Format email tidak valid.");
add("ipv4-validator","Web & Validation","IPv4 Validator","Periksa format alamat IPv4.",v=>{const p=v.trim().split(".");const ok=p.length===4&&p.every(x=>/^\d{1,3}$/.test(x)&&Number(x)>=0&&Number(x)<=255);return ok?"IPv4 valid ✓":"IPv4 tidak valid.";});
add("domain-extractor","Web & Validation","Domain Extractor","Ambil nama host dari URL atau domain.",v=>{const raw=v.trim().includes("://")?v.trim():"https://"+v.trim();return new URL(raw).hostname;});
add("query-string-parser","Web & Validation","Query String Parser","Masukkan URL atau query string untuk diubah menjadi JSON.",v=>{const raw=v.includes("?")?v.slice(v.indexOf("?")+1).split("#")[0]:v.replace(/^\?/,"");const p=new URLSearchParams(raw),o={};for(const [k,val] of p)o[k]=o[k]===undefined?val:Array.isArray(o[k])?[...o[k],val]:[o[k],val];return JSON.stringify(o,null,2);});
add("query-string-builder","Web & Validation","Query String Builder","Masukkan pasangan key=value per baris.",v=>"?"+new URLSearchParams(parseQueryLines(v)).toString());
add("user-agent-parser","Web & Validation","User Agent Quick Inspector","Masukkan user-agent; kosong memakai browser saat ini.",v=>{const ua=v.trim()||navigator.userAgent;return "Browser: "+((ua.match(/(Edg|OPR|Chrome|Firefox|Safari)\/[\d.]+/)||["Tidak diketahui"])[0])+"\nOS: "+(/Android/i.test(ua)?"Android":/iPhone|iPad|iOS/i.test(ua)?"iOS":/Windows/i.test(ua)?"Windows":/Mac OS/i.test(ua)?"macOS":/Linux/i.test(ua)?"Linux":"Tidak diketahui")+"\nMobile: "+(/Mobile|Android|iPhone/i.test(ua)?"Ya":"Tidak");});
add("slug-validator","Web & Validation","Slug Validator","Periksa apakah string aman sebagai slug URL.",v=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.trim())?"Slug valid ✓":"Slug tidak valid. Gunakan huruf kecil, angka, dan tanda hubung.");
add("password-strength","Web & Validation","Password Strength Checker","Analisis kekuatan password secara lokal; password tidak dikirim.",v=>{const c=[v.length>=12,/[a-z]/.test(v),/[A-Z]/.test(v),/\d/.test(v),/[^A-Za-z0-9]/.test(v)],score=c.filter(Boolean).length;return "Skor: "+score+"/5\nPanjang: "+v.length+" karakter\nPanjang 12+: "+(c[0]?"Ya":"Tidak")+"\nHuruf kecil: "+(c[1]?"Ya":"Tidak")+"\nHuruf besar: "+(c[2]?"Ya":"Tidak")+"\nAngka: "+(c[3]?"Ya":"Tidak")+"\nSimbol: "+(c[4]?"Ya":"Tidak")+"\nKekuatan: "+(score>=5?"Kuat":score>=3?"Sedang":"Lemah");});
add("password-generator","Web & Validation","Password Generator","Parameter panjang password; default 18, maksimum 64.",(v,a)=>{const n=Math.max(8,Math.min(64,Number(a)||18)),chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_",bytes=new Uint8Array(n);crypto.getRandomValues(bytes);return Array.from(bytes,b=>chars[b%chars.length]).join("");});

/* 81–90 · File & Data */
add("file-size-converter","File & Data","File Size Converter","Masukkan ukuran dalam byte.",v=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error("Masukkan jumlah byte non-negatif.");return ["B","KB","MB","GB","TB"].map((u,i)=>u+": "+(n/Math.pow(1024,i)).toFixed(i?3:0)).join("\n");});
add("filename-sanitizer","File & Data","Filename Sanitizer","Bersihkan nama file dari karakter yang tidak aman.",v=>v.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g,"_").replace(/\s+/g,"_").replace(/[. ]+$/g,"").slice(0,180)||"file");
add("extension-extractor","File & Data","File Extension Extractor","Ambil ekstensi dari nama file atau path.",v=>{const name=v.trim().split(/[\\/]/).pop(),i=name.lastIndexOf(".");return i>0?name.slice(i+1).toLowerCase():"Tidak memiliki ekstensi.";});
add("mime-lookup","File & Data","MIME Type Lookup","Masukkan ekstensi file, misalnya png atau mp4.",v=>getMime(v.trim()));
add("sha256-text","File & Data","SHA-256 Text Hash","Hitung SHA-256 dari teks secara lokal di browser.",v=>hashText(v));
add("text-file-splitter","File & Data","Text Splitter","Parameter jumlah baris per bagian; default 100.",(v,a)=>{const n=Math.max(1,Math.min(5000,Number(a)||100)),arr=lines(v),parts=[];for(let i=0;i<arr.length;i+=n)parts.push("=== BAGIAN "+(parts.length+1)+" ===\n"+arr.slice(i,i+n).join("\n"));return parts.join("\n\n");});
add("text-file-joiner","File & Data","Text File Joiner","Gabungkan potongan teks yang dipisahkan baris === FILE ===.",v=>v.split(/\n?===\s*FILE\s*===\n?/i).map(x=>x.trim()).filter(Boolean).join("\n"));
add("csv-column-extractor","File & Data","CSV Column Extractor","Parameter adalah nama kolom atau indeks mulai dari 0.",(v,a)=>{const rows=parseCsv(v),head=rows[0]||[];if(!rows.length)throw Error("CSV kosong.");const i=/^\d+$/.test(a)?Number(a):head.indexOf(a);if(i<0||i>=head.length)throw Error("Kolom tidak ditemukan.");return rows.map(r=>r[i]??"").join("\n");});
add("csv-row-filter","File & Data","CSV Row Filter","Parameter format kolom=nilai; hasil mempertahankan header.",(v,a)=>{const i=a.indexOf("=");if(i<0)throw Error("Parameter harus kolom=nilai.");const rows=parseCsv(v),head=rows[0]||[],col=a.slice(0,i).trim(),value=a.slice(i+1).trim(),idx=/^\d+$/.test(col)?Number(col):head.indexOf(col);if(idx<0)throw Error("Kolom tidak ditemukan.");return rows.filter((r,n)=>n===0||String(r[idx]??"").toLowerCase().includes(value.toLowerCase())).map(r=>r.map(csvCell).join(",")).join("\n");});
add("json-path-lookup","File & Data","JSON Path Lookup","Parameter jalur, contoh user.profile.name atau items[0].id.",(v,a)=>{let data=JSON.parse(v);if(!a.trim())throw Error("Isi parameter dengan jalur JSON.");const path=a.replace(/\[(\d+)\]/g,".$1").split(".").filter(Boolean);for(const key of path){if(data==null||!(key in Object(data)))throw Error("Jalur tidak ditemukan: "+key);data=data[key];}return typeof data==="string"?data:JSON.stringify(data,null,2);});

/* 91–100 · Creative & Content */
add("lorem-generator","Creative & Content","Lorem Ipsum Generator","Parameter jumlah kata; default 60, maksimum 1000.",(v,a)=>{const words="lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(" "),n=Math.max(1,Math.min(1000,Number(a)||60));return Array.from({length:n},(_,i)=>words[i%words.length]).join(" ").replace(/^lorem/,"Lorem")+".";
});
add("quote-generator","Creative & Content","Random Quote Generator","Buat kutipan singkat original untuk inspirasi konten.",()=>["Langkah kecil yang konsisten lebih berarti daripada rencana besar yang tak dimulai.","Tidak semua proses terlihat, tetapi setiap usaha punya arah.","Berhenti sejenak bukan berarti menyerah; kadang itu cara menjaga langkah tetap kuat.","Fokus pada hal yang bisa kamu perbaiki hari ini.","Kemajuan tidak selalu cepat, tetapi bisa tetap nyata."][randomInt(0,4)]);
add("hashtag-generator","Creative & Content","Hashtag Generator","Ubah kata penting dari caption menjadi hashtag.",(v,a)=>{const max=Math.max(1,Math.min(30,Number(a)||10)),words=(v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z0-9]+/g)||[]).filter(x=>x.length>2);return [...new Set(words)].slice(0,max).map(x=>"#"+x).join(" ")||"Masukkan caption terlebih dahulu.";});
add("caption-formatter","Creative & Content","Caption Formatter","Rapikan baris caption; parameter batas karakter opsional.",(v,a)=>{const max=Number(a)||2200;return lines(v).map(x=>x.trim()).filter(Boolean).join("\n\n").slice(0,Math.max(1,Math.min(5000,max)));});
add("text-to-markdown-list","Creative & Content","Text to Markdown List","Ubah setiap baris menjadi bullet list Markdown.",v=>lines(v).filter(x=>x.trim()).map(x=>"- "+x.trim()).join("\n"));
add("text-to-csv-table","Creative & Content","Text to CSV Table","Ubah kolom yang dipisahkan tab atau tanda | menjadi CSV.",v=>lines(v).filter(x=>x.trim()).map(row=>row.split(/\t|\s*\|\s*/).map(csvCell).join(",")).join("\n"));
add("markdown-table-generator","Creative & Content","Markdown Table Generator","Masukkan data per baris; pisahkan kolom dengan tab atau |.",v=>{const rows=lines(v).filter(x=>x.trim()).map(x=>x.split(/\t|\s*\|\s*/).map(y=>y.trim()));if(!rows.length)throw Error("Masukkan setidaknya satu baris.");const width=Math.max(...rows.map(r=>r.length)),norm=r=>Array.from({length:width},(_,i)=>r[i]||""),head=norm(rows[0]);return "| "+head.join(" | ")+" |\n| "+head.map(()=>"---").join(" | ")+" |\n"+rows.slice(1).map(r=>"| "+norm(r).join(" | ")+" |").join("\n");});
add("emoji-cleaner","Creative & Content","Emoji Cleaner","Hapus emoji dari teks tanpa mengubah kata.",v=>v.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,"").replace(/\s{2,}/g," ").trim());
add("remove-accents","Creative & Content","Accent Remover","Hilangkan tanda diakritik untuk membuat teks ASCII lebih sederhana.",v=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,""));
add("random-username-generator","Creative & Content","Random Username Generator","Parameter jumlah username; default 5.",(v,a)=>{const left=["lunar","pixel","silent","rapid","cloud","ember","nova","urban","velvet","echo"],right=["fox","orbit","pixel","rider","wave","leaf","comet","owl","spark","mango"],n=Math.max(1,Math.min(30,Number(a)||5));return Array.from({length:n},()=>left[randomInt(0,left.length-1)]+right[randomInt(0,right.length-1)]+randomInt(10,999)).join("\n");});

const examples=Object.freeze({
  "uppercase":{input:"selamat datang ke aryanzz",arg:""},
  "lowercase":{input:"ARYANZZ TOOLS LAB",arg:""},
  "title-case":{input:"cara menggunakan 100 tools",arg:""},
  "sentence-case":{input:"halo dunia. ini contoh kedua!",arg:""},
  "trim-lines":{input:"  ARYANZZ  \n  100 Tools  ",arg:""},
  "remove-blank-lines":{input:"satu\n\n dua\n\n tiga",arg:""},
  "sort-lines":{input:"pisang\napel\njeruk",arg:""},
  "reverse-lines":{input:"pertama\nkedua\nketiga",arg:""},
  "unique-lines":{input:"apel\njeruk\napel\nmangga",arg:""},
  "slug-generator":{input:"Cara Menggunakan ARYANZZ V1!",arg:""},
  "word-count":{input:"ARYANZZ punya 100 alat praktis untuk pekerjaan sehari-hari.",arg:""},
  "character-count":{input:"Belajar ARYANZZ",arg:""},
  "line-count":{input:"Baris satu\n\nBaris tiga",arg:""},
  "sentence-count":{input:"ARYANZZ mudah digunakan. Pilih alat yang dibutuhkan! Mulai sekarang.",arg:""},
  "paragraph-count":{input:"Paragraf pertama.\n\nParagraf kedua.",arg:""},
  "reading-time":{input:"Belajar menggunakan alat digital membantu pekerjaan menjadi lebih cepat dan rapi setiap hari.",arg:""},
  "keyword-density":{input:"Belajar alat ARYANZZ. Alat ini membantu belajar.",arg:"alat"},
  "extract-emails":{input:"Hubungi tim di halo@example.com atau support@example.org.",arg:""},
  "extract-urls":{input:"Buka https://example.com dan https://aryanzz.example/tools untuk contoh.",arg:""},
  "duplicate-words":{input:"Ini ini contoh kata kata yang berulang.",arg:""},
  "json-formatter":{input:'{"nama":"Rani","umur":20,"aktif":true}',arg:""},
  "json-minifier":{input:'{\n  "nama": "Rani",\n  "umur": 20\n}',arg:""},
  "json-validator":{input:'{"status":"ok","jumlah":3}',arg:""},
  "json-sort-keys":{input:'{"zebra":1,"apel":2,"mangga":3}',arg:""},
  "csv-to-json":{input:"nama,umur\nRani,20\nDina,22",arg:""},
  "json-to-csv":{input:'[{"nama":"Rani","umur":20},{"nama":"Dina","umur":22}]',arg:""},
  "csv-to-tsv":{input:"nama,umur\nRani,20\nDina,22",arg:""},
  "tsv-to-csv":{input:"nama\tumur\nRani\t20\nDina\t22",arg:""},
  "markdown-to-text":{input:"# Judul\n\n**Teks tebal** dan _teks miring_.",arg:""},
  "markdown-toc":{input:"# Pendahuluan\n## Tujuan\n## Langkah",arg:""},
  "base64-encode":{input:"Halo ARYANZZ!",arg:""},
  "base64-decode":{input:"SGFsbyBBUllBTlp6IQ==",arg:""},
  "url-encode":{input:"belajar ARYANZZ & tools",arg:""},
  "url-decode":{input:"belajar%20ARYANZZ%20%26%20tools",arg:""},
  "html-escape":{input:"<h1>Halo & selamat</h1>",arg:""},
  "html-unescape":{input:"&lt;h1&gt;Halo &amp; selamat&lt;/h1&gt;",arg:""},
  "jwt-decode":{input:"eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vLXVzZXIiLCJyb2xlIjoidXNlciJ9.",arg:""},
  "uuid-generator":{input:"",arg:"3"},
  "regex-tester":{input:"cat dog cat bird",arg:"\\bcat\\b"},
  "regex-replace":{input:"apel jeruk apel",arg:"apel=>mangga"},
  "percentage-calc":{input:"200",arg:"15"},
  "average-calc":{input:"10, 20, 30",arg:""},
  "median-calc":{input:"8, 2, 10, 4",arg:""},
  "stddev-calc":{input:"2, 4, 4, 4, 5, 5, 7, 9",arg:""},
  "random-number":{input:"",arg:"1,10,3"},
  "base-converter":{input:"255",arg:"10,16"},
  "binary-to-decimal":{input:"101101",arg:""},
  "roman-numeral":{input:"2026",arg:""},
  "prime-checker":{input:"29",arg:""},
  "gcd-lcm":{input:"12,18",arg:""},
  "unix-timestamp":{input:"1735689600",arg:""},
  "date-difference":{input:"2026-11-02,2026-11-15",arg:""},
  "add-days":{input:"2026-11-15",arg:"10"},
  "age-calculator":{input:"2000-01-01",arg:""},
  "weekday-finder":{input:"2026-11-15",arg:""},
  "date-format-converter":{input:"2026-11-15",arg:"id-ID"},
  "duration-converter":{input:"3661",arg:""},
  "business-days":{input:"2026-11-02,2026-11-06",arg:""},
  "timezone-formatter":{input:"2026-11-15T12:00:00",arg:"Asia/Jakarta"},
  "countdown-calculator":{input:"2027-01-01T00:00:00",arg:""},
  "hex-to-rgb":{input:"#3366FF",arg:""},
  "rgb-to-hex":{input:"51,102,255",arg:""},
  "hsl-to-rgb":{input:"210,80,50",arg:""},
  "contrast-ratio":{input:"#000000,#FFFFFF",arg:""},
  "gradient-generator":{input:"#3366FF,#FF6699",arg:"135"},
  "palette-generator":{input:"#3366FF",arg:""},
  "random-color":{input:"",arg:"5"},
  "box-shadow-generator":{input:"",arg:"0,8,24,0,#00000033"},
  "border-radius-generator":{input:"12,18,24,30",arg:""},
  "spacing-scale-generator":{input:"",arg:"4"},
  "url-validator":{input:"https://example.com/path?source=aryanzz",arg:""},
  "email-validator":{input:"halo@example.com",arg:""},
  "ipv4-validator":{input:"192.168.1.10",arg:""},
  "domain-extractor":{input:"https://aryanzz.example.com/page",arg:""},
  "query-string-parser":{input:"https://example.com/?q=aryanzz&page=2",arg:""},
  "query-string-builder":{input:"q=aryanzz\npage=2",arg:""},
  "user-agent-parser":{input:"",arg:""},
  "slug-validator":{input:"aryanzz-tools-lab",arg:""},
  "password-strength":{input:"ContohPassword!123",arg:""},
  "password-generator":{input:"",arg:"16"},
  "file-size-converter":{input:"1048576",arg:""},
  "filename-sanitizer":{input:"Laporan ARYANZZ: Final?.pdf",arg:""},
  "extension-extractor":{input:"folder/video-final.MP4",arg:""},
  "mime-lookup":{input:"png",arg:""},
  "sha256-text":{input:"contoh teks untuk hash",arg:""},
  "text-file-splitter":{input:"baris 1\nbaris 2\nbaris 3\nbaris 4",arg:"2"},
  "text-file-joiner":{input:"bagian pertama\nbaris kedua\n=== FILE ===\nbagian kedua",arg:""},
  "csv-column-extractor":{input:"nama,umur\nRani,20\nDina,22",arg:"nama"},
  "csv-row-filter":{input:"nama,umur\nRani,20\nDina,22",arg:"umur=20"},
  "json-path-lookup":{input:'{"user":{"profile":{"name":"Rani"}}}',arg:"user.profile.name"},
  "lorem-generator":{input:"",arg:"30"},
  "quote-generator":{input:"",arg:""},
  "hashtag-generator":{input:"Belajar desain konten kreatif dengan ARYANZZ",arg:"10"},
  "caption-formatter":{input:"  Halo semua!  \n\n  Ini contoh caption.  ",arg:"2200"},
  "text-to-markdown-list":{input:"Video\nGambar\nAudio",arg:""},
  "text-to-csv-table":{input:"Nama | Umur\nRani | 20\nDina | 22",arg:""},
  "markdown-table-generator":{input:"Nama | Umur\nRani | 20\nDina | 22",arg:""},
  "emoji-cleaner":{input:"Halo 😊 ARYANZZ 🚀",arg:""},
  "remove-accents":{input:"café déjà vu",arg:""},
  "random-username-generator":{input:"",arg:"5"}
});

const api=Object.freeze({groups:Object.freeze(groups.slice()),catalog:Object.freeze(tools.map(({id,group,title,desc})=>Object.freeze({id,group,title,desc,example:examples[id]}))),examples,run:toolRun});
window.ARYANZZToolbox100=api;
if(!document.getElementById("toolsArea")||document.getElementById("toolbox100"))return;
const toolsArea=document.getElementById("toolsArea"),panel=document.createElement("section");
panel.id="toolbox100";panel.className="panel card t100-panel";panel.hidden=true;
panel.innerHTML='<header class="t100-head"><div><span class="t100-kicker">ARYANZZ · LOCAL EXPERIMENTS</span><h2>100 Tools Lab</h2><p>100 alat untuk teks, data, angka, desain, validasi, dan konten. Pemrosesan dilakukan di browser.</p></div><span class="t100-count">100 TOOLS</span></header><div class="t100-toolbar"><label class="t100-search"><span>CARI FITUR</span><input id="t100Search" type="search" placeholder="Cari nama alat atau fungsi..." autocomplete="off"></label><div id="t100Groups" class="t100-groups"></div></div><div class="t100-layout"><aside class="t100-library"><div class="t100-library-head"><strong>Daftar alat</strong><span id="t100VisibleCount">100 tersedia</span></div><div id="t100Grid" class="t100-grid"></div></aside><section class="t100-work" aria-live="polite"><div class="t100-selected"><span class="t100-kicker">ALAT TERPILIH</span><h3 id="t100Title">Uppercase Converter</h3><p id="t100Desc">Ubah seluruh teks menjadi huruf kapital.</p></div><label class="t100-field"><span>Input / data</span><textarea id="t100Input" rows="7" placeholder="Masukkan teks atau data di sini..."></textarea></label><label class="t100-field"><span>Parameter tambahan (opsional)</span><input id="t100Arg" type="text" placeholder="Isi sesuai petunjuk alat yang dipilih"></label><div class="t100-actions"><button type="button" class="t100-run" id="t100Run">Jalankan alat</button><button type="button" id="t100Copy" disabled>Salin hasil</button><button type="button" id="t100Download" disabled>Unduh TXT</button><button type="button" id="t100Clear">Bersihkan</button></div><p class="t100-status" id="t100Status" role="status" aria-live="polite">Pilih alat, isi input, lalu jalankan.</p><label class="t100-field"><span>Hasil</span><textarea id="t100Output" rows="10" readonly placeholder="Hasil akan muncul di sini..."></textarea></label><p class="t100-note">Privasi: alat memproses input secara lokal. SHA-256, UUID, dan generator password menggunakan Web Crypto browser. Jangan masukkan data rahasia pada perangkat bersama.</p></section></div><button type="button" class="back-home" data-panel="allTools">← Kembali ke Pusat Alat</button>';
const profilePanel=document.getElementById("profile");toolsArea.insertBefore(panel,profilePanel||null);
const $=id=>panel.querySelector("#"+id),grid=$("t100Grid"),groupBox=$("t100Groups"),search=$("t100Search");
let selected=tools[0],activeGroup="all";
function setStatus(text,error){$("t100Status").textContent=text;$("t100Status").dataset.error=error?"1":"0";}
function selectTool(item){selected=item;$("t100Title").textContent=item.title;$("t100Desc").textContent=item.desc;$("t100Input").value="";$("t100Arg").value="";$("t100Output").value="";$("t100Copy").disabled=true;$("t100Download").disabled=true;setStatus("Alat siap digunakan.");grid.querySelectorAll("[data-tool-id]").forEach(b=>{const active=b.dataset.toolId===item.id;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});}
function renderCards(){grid.replaceChildren();tools.forEach(item=>{const b=document.createElement("button");b.type="button";b.className="t100-card";b.dataset.toolId=item.id;const name=document.createElement("strong");name.textContent=item.title;const desc=document.createElement("small");desc.textContent=item.desc;const group=document.createElement("span");group.textContent=item.group;b.append(name,desc,group);grid.append(b);});}
function renderGroups(){groupBox.replaceChildren();["all",...groups].forEach(group=>{const b=document.createElement("button");b.type="button";b.dataset.group=group;b.textContent=group==="all"?"Semua":group;b.classList.toggle("active",group===activeGroup);b.setAttribute("aria-pressed",String(group===activeGroup));groupBox.append(b);});}
function filterCards(){const q=search.value.trim().toLowerCase();let n=0;grid.querySelectorAll("[data-tool-id]").forEach(b=>{const item=tools.find(t=>t.id===b.dataset.toolId),visible=(activeGroup==="all"||item.group===activeGroup)&&(!q||(item.title+" "+item.desc+" "+item.group).toLowerCase().includes(q));b.hidden=!visible;if(visible)n++;});$("t100VisibleCount").textContent=n+" alat ditemukan";}
renderCards();renderGroups();selectTool(selected);filterCards();
panel.addEventListener("click",event=>{const target=event.target instanceof Element?event.target:event.target?.parentElement;const closest=selector=>{const path=event.composedPath?.()||[];return path.find(node=>node instanceof Element&&node.matches(selector))||target?.closest(selector);};const card=closest("[data-tool-id]");if(card){const item=tools.find(t=>t.id===card.dataset.toolId);if(item)selectTool(item);return;}const group=closest("[data-group]");if(group){activeGroup=group.dataset.group;renderGroups();filterCards();return;}if(closest("#t100Run")){const run=$("t100Run");run.disabled=true;setStatus("Memproses...");Promise.resolve().then(()=>toolRun(selected.id,$("t100Input").value,$("t100Arg").value)).then(result=>{const output=typeof result==="string"?result:JSON.stringify(result,null,2);$("t100Output").value=output;$("t100Copy").disabled=!output;$("t100Download").disabled=!output;setStatus("Selesai · "+output.length+" karakter hasil.");}).catch(error=>{$("t100Output").value="";$("t100Copy").disabled=true;$("t100Download").disabled=true;setStatus(error?.message||"Alat gagal memproses input.",true);}).finally(()=>{run.disabled=false;});return;}if(closest("#t100Copy")){const output=$("t100Output").value;if(!output)return;const fallback=()=>{$("t100Output").focus();$("t100Output").select();try{document.execCommand("copy");setStatus("Hasil disalin.");}catch{setStatus("Salin otomatis tidak tersedia; pilih teks hasil secara manual.",true);}};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(output).then(()=>setStatus("Hasil disalin."),fallback);else fallback();return;}if(closest("#t100Download")){const output=$("t100Output").value;if(!output)return;const blob=new Blob([output],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="aryanzz-tool-result.txt";document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);setStatus("File TXT disiapkan.");return;}if(closest("#t100Clear")){$("t100Input").value="";$("t100Arg").value="";$("t100Output").value="";$("t100Copy").disabled=true;$("t100Download").disabled=true;setStatus("Input dan hasil dibersihkan.");}},true);
panel.addEventListener("input",event=>{if(event.target===search){filterCards();return;}if(event.target===$("t100Input")||event.target===$("t100Arg")){$("t100Copy").disabled=true;$("t100Download").disabled=true;}});
panel.addEventListener("keydown",event=>{if(event.key==="Enter"&&event.ctrlKey&&event.target===$("t100Input"))$("t100Run").click();});
})();