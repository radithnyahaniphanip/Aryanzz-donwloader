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
 const navKey=isHome?"home":panelId==="history"?"history":panelId==="owner"?"owner":panelId==="profile"?"profile" :"allTools";
 nav.querySelectorAll("[data-nav]").forEach(button=>{
  const active=button.dataset.nav===navKey;
  button.classList.toggle("active",active);
  button.setAttribute("aria-current",active?"page":"false");
 });
 resetPanelScroll();
 return panelId||"home";
}
window.aryanzzShowPanel=showPanel;

// Small, delegated click feedback. It also covers platform tiles created after
// the 200-item catalogue loads, without enabling continuous site-wide motion.
function pulseInteractiveControl(target){
 if(!target||target.matches(":disabled")||target.getAttribute("aria-disabled")==="true")return;
 if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
 target.classList.remove("ary-click-fx");
 void target.offsetWidth;
 target.classList.add("ary-click-fx");
}
const interactiveSelector='button:not(:disabled),a[href],[role="button"]:not([aria-disabled="true"])';
document.addEventListener("pointerdown",event=>{
 if(event.button!==0)return;
 const origin=event.target instanceof Element?event.target:null;
 const target=origin?.closest(interactiveSelector);
 if(target)pulseInteractiveControl(target);
},true);
document.addEventListener("click",event=>{
 if(event.detail!==0)return; // Keyboard and assistive-technology activation.
 const origin=event.target instanceof Element?event.target:null;
 const target=origin?.closest(interactiveSelector);
 if(target)pulseInteractiveControl(target);
},true);
document.addEventListener("animationend",event=>{
 if(event.animationName==="aryTapPulse")event.target.classList.remove("ary-click-fx");
},true);
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

const clearInputScript=document.createElement("script");clearInputScript.src="/clear-inputs.js?v=1";clearInputScript.defer=true;document.head.appendChild(clearInputScript);

})();