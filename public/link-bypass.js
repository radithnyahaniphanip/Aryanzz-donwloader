(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const form=$("sflBypassForm"),input=$("sflBypassUrl"),submit=$("sflBypassSubmit");
  const status=$("sflBypassStatus"),result=$("sflBypassResult"),target=$("sflBypassTarget");
  let resolvedUrl="";
  const allowed=new Set(["sf1.gl","sfl.gl","sflink.io"]);
  function message(text,kind="info"){
    if(!status)return;
    status.hidden=false;status.dataset.kind=kind;status.textContent=text;
  }
  function validShortUrl(raw){
    try{
      const u=new URL(raw.trim()),host=u.hostname.toLowerCase();
      if(!["https:","http:"].includes(u.protocol)||u.username||u.password||u.port||!allowed.has(host))return null;
      return u;
    }catch{return null;}
  }
  form?.addEventListener("submit",async event=>{
    event.preventDefault();
    const parsed=validShortUrl(input?.value||"");
    result.hidden=true;resolvedUrl="";
    if(!parsed){message("Masukkan tautan SFL yang valid, misalnya https://sf1.gl/xxxx.","error");return;}
    const autoOpen=$("sflAutoOpen")?.checked===true;
    let pendingTab=null;
    if(autoOpen){try{pendingTab=window.open("about:blank","_blank");if(pendingTab)pendingTab.opener=null;}catch{}}
    submit.disabled=true;submit.textContent="Memeriksa…";
    message("Memeriksa pengalihan tautan dengan aman…","loading");
    try{
      const response=await fetch("/api/link-bypass?url="+encodeURIComponent(parsed.href),{method:"GET",cache:"no-store",headers:{accept:"application/json"}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||"Tujuan tautan belum dapat ditemukan.");
      const finalUrl=new URL(data.url);
      if(!["http:","https:"].includes(finalUrl.protocol)||finalUrl.username||finalUrl.password)throw new Error("Alamat tujuan ditolak karena tidak aman.");
      resolvedUrl=finalUrl.href;target.href=resolvedUrl;target.textContent=resolvedUrl;
      result.hidden=false;message("Tujuan ditemukan · "+(data.hops||1)+" tahap pengalihan.","success");
      try{
        const saved=JSON.parse(localStorage.getItem("aryanzz.sfl-history.v93")||"[]");
        const next=[{source:parsed.href,target:resolvedUrl,at:Date.now()},...saved.filter(x=>x.source!==parsed.href)].slice(0,10);
        localStorage.setItem("aryanzz.sfl-history.v93",JSON.stringify(next));
      }catch{}
      if(pendingTab){try{pendingTab.location.replace(resolvedUrl);}catch{pendingTab.close();}}
    }catch(error){
      if(pendingTab)try{pendingTab.close();}catch{}
      message(error.message||"Gagal memeriksa tautan. Coba lagi nanti.","error");
    }finally{
      submit.disabled=false;submit.textContent="Periksa tujuan";
    }
  });
  $("sflBypassOpen")?.addEventListener("click",()=>{
    if(!resolvedUrl)return;
    const a=document.createElement("a");a.href=resolvedUrl;a.target="_blank";a.rel="noopener noreferrer";a.click();
  });
  $("sflBypassCopy")?.addEventListener("click",async()=>{
    if(!resolvedUrl)return;
    try{await navigator.clipboard.writeText(resolvedUrl);message("Link tujuan berhasil disalin.","success");}
    catch{const area=document.createElement("textarea");area.value=resolvedUrl;area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();const ok=document.execCommand("copy");area.remove();message(ok?"Link tujuan berhasil disalin.":"Salin link secara manual dari kotak hasil.",ok?"success":"error");}
  });
})();
