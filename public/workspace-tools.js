(()=>{"use strict";
const root=document.getElementById("toolsArea");
const input=root?.querySelector("#toolSearch");
const grid=root?.querySelector("#toolGrid");
const filters=root?.querySelector("#toolFilters");
const empty=root?.querySelector("#toolEmpty");
const meta=root?.querySelector("#toolResultsMeta");
if(!root||!input||!grid||!filters)return;
root.dataset.workspace="tools";
let category="all";
function cards(){return [...grid.querySelectorAll(".tool")]}
function updateFilterCounts(items){
 filters.querySelectorAll("[data-tool-filter]").forEach(button=>{
  const key=button.dataset.toolFilter||"all";
  const count=key==="all"?items.length:items.filter(card=>card.dataset.category===key).length;
  let badge=button.querySelector(".ary-tools-filter-count");
  if(!badge){badge=document.createElement("span");badge.className="ary-tools-filter-count";badge.setAttribute("aria-hidden","true");button.append(badge)}
  badge.textContent=String(count);
 });
}
function apply(){
 const items=cards(),query=input.value.toLowerCase().trim();
 let visible=0;
 items.forEach(card=>{
  const categoryMatch=category==="all"||card.dataset.category===category;
  const searchMatch=!query||card.textContent.toLowerCase().includes(query);
  const show=categoryMatch&&searchMatch;
  card.hidden=!show;
  if(show)visible++;
 });
 updateFilterCounts(items);
 if(empty){empty.hidden=visible>0;empty.textContent=query?"Tidak ada alat yang cocok. Coba kata kunci lain.":"Belum ada alat pada kategori ini."}
 if(meta)meta.textContent=query?visible+" alat ditemukan":category==="all"?visible+" alat tersedia":visible+" alat dalam kategori ini";
}
filters.addEventListener("click",event=>{
 const button=event.target.closest("[data-tool-filter]");
 if(!button||!filters.contains(button))return;
 category=button.dataset.toolFilter||"all";
 filters.querySelectorAll("[data-tool-filter]").forEach(item=>{
  const active=item===button;
  item.classList.toggle("active",active);
  item.setAttribute("aria-pressed",String(active));
 });
 apply();
});
input.addEventListener("input",apply);

/* Sits outside panels so lazy-loaded modules cannot replace the return path. */
const backbar=document.createElement("div");
backbar.className="ary-tools-backbar";backbar.hidden=true;
const crumb=document.createElement("div");crumb.className="ary-tools-crumb";
const brand=document.createElement("span");brand.textContent="ARYANZZ";
const slash=document.createElement("span");slash.textContent="/";
const current=document.createElement("strong");current.textContent="RUANG ALAT";
crumb.append(brand,slash,current);
const back=document.createElement("button");
back.type="button";back.className="ary-tools-back";back.dataset.panel="allTools";
back.setAttribute("aria-label","Kembali ke daftar semua alat");
const arrow=document.createElement("span");arrow.setAttribute("aria-hidden","true");arrow.textContent="←";
const label=document.createElement("span");label.textContent="Semua alat";
back.append(arrow,label);backbar.append(crumb,back);root.insertBefore(backbar,root.firstChild);
function syncBackbar(){
 const active=root.querySelector(":scope > .panel.active:not(.all-tools-panel)");
 const excluded=active&&(active.classList.contains("v25-profile-panel")||active.classList.contains("owner-panel")||active.classList.contains("ary-library-panel"));
 backbar.hidden=!active||!!excluded;
}
const panelObserver=new MutationObserver(syncBackbar);
root.querySelectorAll(":scope > .panel").forEach(panel=>panelObserver.observe(panel,{attributes:true,attributeFilter:["class"]}));
syncBackbar();
const gridObserver=new MutationObserver(apply);
gridObserver.observe(grid,{childList:true,subtree:true});
window.ARYANZZToolsWorkspace=Object.freeze({apply,syncBackbar});
apply();
})();