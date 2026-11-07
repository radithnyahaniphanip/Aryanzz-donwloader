(()=>{"use strict";
const home=document.getElementById("home");
const toolsArea=document.getElementById("toolsArea");
const nav=document.querySelector(".nav");
if(!home||!toolsArea||!nav)return;
nav.dataset.workspace="navigation";
function resetPanelScroll(){
 const root=document.documentElement,body=document.body;
 const wrap=document.querySelector(".app-shell.wrap")||document.querySelector(".wrap");
 const previous=root.style.scrollBehavior;
 root.style.scrollBehavior="auto";
 root.scrollTop=0;body.scrollTop=0;if(wrap)wrap.scrollTop=0;
 window.scrollTo(0,0);
 requestAnimationFrame(()=>{
  root.scrollTop=0;body.scrollTop=0;if(wrap)wrap.scrollTop=0;
  window.scrollTo(0,0);
  root.style.scrollBehavior=previous;
 });
}
function showPanel(id){
 let panelId=String(id||"");
 if(panelId==="home")panelId="";
 if(panelId){
  const candidate=document.getElementById(panelId);
  if(!candidate||candidate.parentElement!==toolsArea||!candidate.classList.contains("panel"))panelId="allTools";
 }
 const isHome=!panelId;
 const view=isHome?"home":panelId==="owner"?"owner":panelId==="profile"?"profile":panelId==="history"?"library":panelId==="allTools"?"tools":"tool";
 document.body.dataset.view=view;
 home.hidden=!isHome;
 home.inert=!isHome;
 home.setAttribute("aria-hidden",String(!isHome));
 toolsArea.hidden=isHome;
 toolsArea.inert=isHome;
 toolsArea.setAttribute("aria-hidden",String(isHome));
 toolsArea.classList.toggle("v8814-view-active",!isHome);
 toolsArea.querySelectorAll(":scope > .panel").forEach(panel=>{
  const active=!isHome&&panel.id===panelId;
  panel.classList.toggle("active",active);
  panel.hidden=!active;
  panel.inert=!active;
  panel.setAttribute("aria-hidden",String(!active));
  panel.classList.remove("v677-enter","v677-reveal","v25-reveal");
 });
 const navKey=isHome?"home":panelId==="history"?"history":panelId==="owner"?"owner":panelId==="profile"?"profile":"allTools";
 nav.querySelectorAll("[data-nav]").forEach(button=>{
  const active=button.dataset.nav===navKey;
  button.classList.toggle("active",active);
  button.setAttribute("aria-current",active?"page":"false");
 });
 resetPanelScroll();
 return panelId||"home";
}
window.aryanzzShowPanel=showPanel;
document.addEventListener("click",event=>{
 const navButton=event.target.closest("[data-nav]");
 if(navButton&&nav.contains(navButton)){
  showPanel(navButton.dataset.nav==="home"?"":navButton.dataset.nav);
  return;
 }
 const panelButton=event.target.closest("[data-panel]");
 if(panelButton)showPanel(panelButton.dataset.panel);
});
showPanel("home");
const membershipScript=document.createElement("script");membershipScript.src="/membership.js?v=1";membershipScript.defer=true;document.head.appendChild(membershipScript);
const membershipStyle=document.createElement("link");membershipStyle.rel="stylesheet";membershipStyle.href="/membership.css?v=1";document.head.appendChild(membershipStyle);
})();