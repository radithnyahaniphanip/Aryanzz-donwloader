/* ARYANZZ V1 — selective text protection.
   Protect decorative/UI copy, but allow normal selection, copy, cut and clearing in media inputs. */
(()=>{"use strict";
 const allowedSelector="#platformSearch,#url,#aryOutputName,.ary-copy-allowed,[data-copy-allowed='true']";
 const isAllowed=e=>!!(e?.target?.closest?.(allowedSelector));
 const stop=e=>{if(isAllowed(e))return;e.preventDefault();e.stopPropagation();};
 document.addEventListener("contextmenu",stop,true);
 document.addEventListener("copy",stop,true);
 document.addEventListener("cut",stop,true);
 document.addEventListener("selectstart",stop,true);
 document.addEventListener("dragstart",stop,true);
 document.addEventListener("keydown",e=>{
   if(isAllowed(e))return;
   if((e.ctrlKey||e.metaKey)&&["c","x","a"].includes(String(e.key||"").toLowerCase()))stop(e);
 },true);
 document.addEventListener("selectionchange",()=>{
   try{
     const field=document.activeElement;
     if(field&&field.matches?.(allowedSelector))return;
     const selection=window.getSelection();
     if(selection&&!selection.isCollapsed)selection.removeAllRanges();
     if(field&&/^(INPUT|TEXTAREA)$/.test(field.tagName)&&typeof field.selectionStart==="number"&&field.selectionStart!==field.selectionEnd){
       const caret=field.selectionEnd;field.setSelectionRange(caret,caret);
     }
   }catch{}
 },true);
})();