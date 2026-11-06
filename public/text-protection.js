/* ARYANZZ V1 — prevent text selection/copy across every page and form field.
   Form controls remain editable and accept normal typing/paste from the keyboard. */
(()=>{"use strict";
 const stop=e=>{e.preventDefault();e.stopPropagation();};
 document.addEventListener("contextmenu",stop,true);
 document.addEventListener("copy",stop,true);
 document.addEventListener("cut",stop,true);
 document.addEventListener("selectstart",stop,true);
 document.addEventListener("dragstart",stop,true);
 document.addEventListener("keydown",e=>{
   if((e.ctrlKey||e.metaKey)&&["c","x","a"].includes(String(e.key||"").toLowerCase()))stop(e);
 },true);
 document.addEventListener("selectionchange",()=>{
   try{
     const selection=window.getSelection();
     if(selection&&!selection.isCollapsed)selection.removeAllRanges();
     const field=document.activeElement;
     if(field&&/^(INPUT|TEXTAREA)$/.test(field.tagName)&&typeof field.selectionStart==="number"&&field.selectionStart!==field.selectionEnd){
       const caret=field.selectionEnd;
       field.setSelectionRange(caret,caret);
     }
   }catch{}
 },true);
})();