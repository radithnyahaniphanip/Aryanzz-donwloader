(()=>{
  const $=id=>document.getElementById(id);
  const bell=$("aryNotifBell"),panel=$("aryNotifications"),list=$("aryNotifList"),badge=$("aryNotifBadge");
  if(!bell||!panel||!list)return;
  const KEY="aryanzz-notifications-v1";
  const seed=[
    {id:"v842-seo",type:"update",title:"Pembaruan tampilan Beranda",body:"Konten informasi ARYANZZ dipusatkan di Beranda agar halaman Alat, Pustaka, Pemilik, dan Profil tetap rapi.",date:"2026-11-03",read:false},
    {id:"v841-account",type:"fix",title:"Akses tanpa registrasi",body:"Gerbang login dan pendaftaran dihapus. Pengunjung dapat membuka downloader secara langsung.",date:"2026-11-03",read:false},
    {id:"v842-notice",type:"update",title:"Pusat notifikasi",body:"Pembaruan, perbaikan, dan pemberitahuan unduhan kini dikumpulkan di ikon lonceng Beranda.",date:"2026-11-03",read:false}
  ];
  let items=[];
  try{items=JSON.parse(localStorage.getItem(KEY)||"[]");if(!Array.isArray(items))items=[];}catch{}
  const known=new Set(items.map(x=>x.id));
  for(const n of seed)if(!known.has(n.id))items.push(n);
  function save(){try{localStorage.setItem(KEY,JSON.stringify(items.slice(0,80)));}catch{}}
  function unread(){return items.filter(x=>!x.read).length;}
  function updateBadge(){const n=unread();badge.hidden=!n;badge.textContent=n>99?"99+":String(n);}
  let filter="all";
  function render(){
    const shown=items.filter(x=>filter==="all"||x.type===filter).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    list.replaceChildren();
    if(!shown.length){const p=document.createElement("p");p.className="ary-members-empty";p.textContent="Belum ada pemberitahuan pada kategori ini.";list.append(p);}
    for(const n of shown){const article=document.createElement("article");article.className="ary-notif-item"+(n.read?"":" unread");
      const title=document.createElement("b");title.textContent=n.title;
      const body=document.createElement("p");body.textContent=n.body;
      const date=document.createElement("small");date.textContent=(n.date||"")+ " · "+({update:"Pembaruan",fix:"Perbaikan",download:"Unduhan"}[n.type]||"Pesan");
      article.append(title,body,date);list.append(article);
    }
    updateBadge();
  }
  function add(type,title,body){
    const id=type+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
    items.unshift({id,type,title,body,date:new Date().toLocaleString("id-ID"),read:false});save();render();
  }
  bell.addEventListener("click",()=>{panel.hidden=!panel.hidden;bell.setAttribute("aria-expanded",String(!panel.hidden));if(!panel.hidden)render();});
  $("aryNotifClose")?.addEventListener("click",()=>{panel.hidden=true;bell.setAttribute("aria-expanded","false");});
  $("aryNotifReadAll")?.addEventListener("click",()=>{items=items.map(x=>({...x,read:true}));save();render();});
  document.querySelectorAll("[data-notif-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.notifFilter;document.querySelectorAll("[data-notif-filter]").forEach(x=>x.classList.toggle("active",x===b));render();}));
  const seen=new Set();
  function watchResult(el){
    if(!el)return;
    const inspect=()=>{const t=(el.innerText||el.textContent||"").toLowerCase();if((t.includes("selesai")||t.includes("unduh lagi")||t.includes("download complete"))&&!seen.has(el)){seen.add(el);add("download","Unduhan selesai","Proses unduhan selesai. Periksa folder Download di perangkat kamu.");}};
    new MutationObserver(inspect).observe(el,{childList:true,subtree:true,characterData:true,attributes:true});inspect();
  }
  watchResult($("downloadResult"));watchResult($("imageDownloadResult"));
  window.addEventListener("aryanzz:download-complete",e=>add("download","Unduhan selesai",e.detail?.name||"File berhasil diproses."));
  save();render();
})();