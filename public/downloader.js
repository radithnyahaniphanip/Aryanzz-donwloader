/* ARYANZZ V29 — single YouTube link-check and download controller */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const formats = [
    {group:"Audio",items:[["mp3","MP3 · 320 kbps"],["m4a","M4A"],["aac","AAC"],["flac","FLAC"],["opus","OPUS"],["ogg","OGG"],["wav","WAV"],["webm","WEBM Audio"]]},
    {group:"Video MP4",items:[["360","360p"],["720","720p HD"],["1080","1080p Full HD"],["1440","1440p · 2K"],["4k","4K · MP4"]]}
  ];
  const make = (tag,cls,text) => {
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  const safeYouTube = value => {
    try {
      const u=new URL(value),h=u.hostname.toLowerCase();
      const hosts=["youtube.com","youtu.be","youtube-nocookie.com"];
      return ["https:","http:"].includes(u.protocol)&&hosts.some(x=>h===x||h.endsWith("."+x))?u:null;
    } catch { return null; }
  };
  const safeTikTok = value => {
    try { const u=new URL(value),h=u.hostname.toLowerCase();return ["tiktok.com"].some(x=>h===x||h.endsWith("."+x))?u:null; }
    catch { return null; }
  };
  const setStatus=(el,message,isError=false)=>{
    el.textContent=message;
    el.className=isError?"warning":"muted";
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
  };
  const formatDuration=value=>{
    const n=Number(value);
    if(!Number.isFinite(n)||n<=0)return "";
    const s=Math.floor(n),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    return h?[h,m.toString().padStart(2,"0"),sec.toString().padStart(2,"0")].join(":"):[m,sec.toString().padStart(2,"0")].join(":");
  };
  const remember=(url,name,format)=>{
    try{
      const key="aryanzz.history.v2",old=JSON.parse(localStorage.getItem(key)||"[]");
      const next=[{url,name,mode:format==="mp3"?"audio":"video",quality:format,at:Date.now()},...old.filter(x=>x.url!==url)].slice(0,40);
      localStorage.setItem(key,JSON.stringify(next));
    }catch{}
  };
  function renderTikTok(url){
    const out=$("downloadResult");out.hidden=false;out.replaceChildren();
    const title=make("b","","TikTok terdeteksi");
    const intro=make("p","muted","Gunakan fitur Simpan Video yang disediakan TikTok oleh kreator.");
    const steps=make("p","muted","Buka video → Bagikan → Simpan video. Jika tombol Simpan Video tidak muncul, kreator menonaktifkan unduhan untuk postingan tersebut.");
    const link=make("a","tag","Buka video TikTok ↗");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";link.style.display="inline-block";
    const note=make("p","warning","ARYANZZ tidak menghapus watermark atau mengakali pembatasan unduhan.");
    out.append(title,intro,steps,link,note);
  }
  async function checkYouTube(url,button){
    const out=$("downloadResult");out.hidden=false;out.replaceChildren();
    const box=make("section","youtube-result");
    const title=make("b","","Memeriksa video YouTube…");
    const status=make("p","muted","Mengambil judul, thumbnail, dan durasi. Tahap ini belum membuat pekerjaan unduhan.");
    box.append(title,status);out.append(box);
    button.disabled=true;const oldText=button.textContent;button.textContent="Memeriksa…";
    try{
      const response=await fetch("/api/youtube/info?url="+encodeURIComponent(url.href),{headers:{accept:"application/json"},cache:"no-store"});
      const info=await response.json().catch(()=>({}));
      if(!response.ok||!info.ok)throw new Error(info.error||"Video YouTube tidak dapat diperiksa.");
      box.replaceChildren();
      const heading=make("div","youtube-heading");
      if(info.thumbnail){
        try{
          const imageUrl=new URL(info.thumbnail);
          if(imageUrl.protocol==="https:"){
            const img=make("img","youtube-thumbnail");img.src=imageUrl.href;img.alt="Thumbnail video YouTube";img.loading="lazy";heading.append(img);
          }
        }catch{}
      }
      const details=make("div","youtube-details");
      details.append(make("b","youtube-title",info.title||"YouTube Content"));
      const meta=[formatDuration(info.duration), "YouTube"].filter(Boolean).join(" · ");
      details.append(make("small","muted",meta));
      heading.append(details);box.append(heading);
      const label=make("label","label","PILIH FORMAT DAN KUALITAS");
      const select=make("select","field");select.id="youtubeFormat";
      formats.forEach(group=>{
        const optgroup=document.createElement("optgroup");optgroup.label=group.group;
        group.items.forEach(([value,text])=>{
          const option=document.createElement("option");option.value=value;option.textContent=text;
          if(value==="mp3")option.selected=true;
          optgroup.append(option);
        });
        select.append(optgroup);
      });
      box.append(label,select);
      const note=make("p",info.providerReady===false?"warning":"youtube-note",info.providerReady===false?(info.providerMessage||"Saldo API provider tidak mencukupi untuk membuat file unduhan."):"Catatan: membuat file unduhan dapat menggunakan saldo API provider. Pemeriksaan link tidak membuat job.");
      box.append(note);
      const start=make("button","primary youtube-start",info.providerReady===false?"Saldo API belum cukup":"Mulai download");
      start.type="button";
      start.disabled=info.providerReady===false;
      const progressWrap=make("div","youtube-progress-wrap");
      const progressTrack=make("div","progress-track");
      const progressBar=make("div","progress-fill");progressBar.style.width="0%";
      progressTrack.append(progressBar);progressWrap.append(progressTrack);
      const progressText=make("p","muted",info.providerReady===false?"Isi saldo API SaveNow sebelum memulai unduhan.":"Pilih format, lalu mulai download.");
      const actions=make("div","youtube-actions");
      actions.append(start);
      box.append(actions,progressWrap,progressText);
      let currentJob=null,currentInfo={title:info.title,thumbnail:info.thumbnail},stopped=false;
      const createDownloadLink=(jobId,format,result)=>{
        progressBar.style.width="100%";
        setStatus(progressText,"File sudah siap. Tekan tombol di bawah untuk mengunduh.");
        const link=make("a","primary youtube-download","Unduh "+(format==="mp3"?"MP3":format==="4k"?"Video 4K":"Video "+format+"p"));
        link.href="/api/youtube/file?id="+encodeURIComponent(jobId)+"&format="+encodeURIComponent(format);
        link.setAttribute("download",result?.filename||"aryanzz-youtube");
        link.setAttribute("aria-label","Unduh file YouTube yang sudah selesai");
        actions.replaceChildren(link);
        remember(url.href,result?.filename||info.title||"YouTube",format);
      };
      const poll=async(job,format,jobInfo)=>{
        stopped=false;
        const pause=make("button","tag youtube-pause","Hentikan pengecekan");
        actions.replaceChildren(pause);
        pause.onclick=()=>{stopped=true;actions.replaceChildren();const resume=make("button","tag","Lanjut cek progres");resume.onclick=()=>poll(job,format,jobInfo);actions.append(resume);setStatus(progressText,"Pengecekan dihentikan. Pekerjaan di server tetap berjalan; lanjutkan tanpa membuat job baru.");};
        for(let attempt=0;attempt<120&&!stopped;attempt++){
          await sleep(5000);if(stopped)return;
          const response=await fetch("/api/youtube/progress",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({id:job,format,info:jobInfo}),cache:"no-store"});
          const state=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(state.error||"Gagal memeriksa progres unduhan.");
          if(state.result){createDownloadLink(job,format,state.result);return;}
          const pct=Number(state.progress);
          if(Number.isFinite(pct))progressBar.style.width=Math.max(1,Math.min(99.5,pct/10))+"%";
          setStatus(progressText,(state.text||"Sedang menyiapkan file…")+" "+(Number.isFinite(pct)?Math.floor(pct/10)+"%":""));
        }
        if(!stopped){
          actions.replaceChildren();
          const resume=make("button","tag youtube-resume","Lanjut cek progres");
          resume.onclick=()=>poll(job,format,jobInfo);
          actions.append(resume);
          setStatus(progressText,"Server masih memproses. Job tidak dibuat ulang agar tidak menagih saldo dua kali. Kamu bisa lanjut memeriksa progres.");
        }
      };
      start.onclick=async()=>{
        const format=select.value;
        start.disabled=true;select.disabled=true;
        setStatus(progressText,"Mengirim satu permintaan ke penyedia…");
        try{
          const response=await fetch("/api/youtube/download",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({url:url.href,format}),cache:"no-store"});
          const job=await response.json().catch(()=>({}));
          if(!response.ok||!job.status)throw new Error(job.error||"Penyedia tidak menerima permintaan unduhan.");
          if(job.result?.url){
            const direct=make("a","primary youtube-download","Buka file siap unduh ↗");
            direct.href=job.result.url;direct.target="_blank";direct.rel="noopener noreferrer";actions.replaceChildren(direct);
            setStatus(progressText,"File siap dari penyedia.");
            return;
          }
          if(!job.id)throw new Error("ID pekerjaan tidak diterima dari penyedia.");
          currentJob=job.id;currentInfo=job.info||currentInfo;
          start.remove();select.disabled=true;
          setStatus(progressText,"Job dibuat. Menunggu proses konversi… Jangan buat job kedua untuk link yang sama.");
          await poll(currentJob,format,currentInfo);
        }catch(error){setStatus(progressText,error.message||"Unduhan gagal.",true);actions.replaceChildren();if(currentJob){const resume=make("button","tag youtube-resume","Lanjut cek progres");resume.onclick=()=>poll(currentJob,format,currentInfo).catch(e=>setStatus(progressText,e.message||"Pengecekan gagal.",true));actions.append(resume);}else{const retry=make("button","tag youtube-retry","Coba lagi");retry.onclick=()=>{select.disabled=false;start.disabled=false;start.click();};actions.append(retry);}}
        finally{if(!currentJob){start.disabled=false;select.disabled=false;}}
      };
    }catch(error){
      box.replaceChildren(make("b","","Link YouTube belum bisa diperiksa"),make("p","warning",error.message||"Terjadi kesalahan saat memeriksa video."));
      const retry=make("button","tag","Periksa lagi");retry.type="button";retry.onclick=()=>checkYouTube(url,button);box.append(retry);
    }finally{
      button.disabled=false;button.textContent=oldText;
    }
  }
  function init(){
    const button=$("analyze"),input=$("url");
    if(!button||!input)return;
    button.addEventListener("click",event=>{
      const raw=input.value.trim(),url=safeYouTube(raw),tiktok=safeTikTok(raw);
      if(!url&&!tiktok)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(url)checkYouTube(url,button);else renderTikTok(tiktok);
    },true);
    input.addEventListener("keydown",event=>{
      if(event.key==="Enter"){
        const url=safeYouTube(input.value.trim());
        if(url){event.preventDefault();event.stopImmediatePropagation();button.click();}
      }
    },true);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
