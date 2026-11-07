(()=>{"use strict";
const root=document.getElementById("toolsArea");
const input=root?.querySelector("#toolSearch");
const grid=root?.querySelector("#toolGrid");
const filters=root?.querySelector("#toolFilters");
const empty=root?.querySelector("#toolEmpty");
if(!root||!input||!grid||!filters)return;
root.dataset.workspace="tools";
let category="all";
function apply(){
 let visible=0;
 const query=input.value.toLowerCase().trim();
 grid.querySelectorAll(".tool").forEach(card=>{
  const show=(category==="all"||card.dataset.category===category)&&card.textContent.toLowerCase().includes(query);
  card.hidden=!show;
  if(show)visible++;
 });
 if(empty)empty.hidden=visible>0;
}
filters.addEventListener("click",event=>{
 const button=event.target.closest("[data-tool-filter]");
 if(!button||!filters.contains(button))return;
 category=button.dataset.toolFilter||"all";
 filters.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button));
 apply();
});
input.addEventListener("input",apply);
window.ARYANZZToolsWorkspace=Object.freeze({apply});
apply();
})();