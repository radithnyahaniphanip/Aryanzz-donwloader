(()=>{"use strict";
const KEY="aryanzz.theme-studio.v94";
const $=id=>document.getElementById(id);
const presets={
 midnight:{accent:"#8b5cf6",background:"#080d1c",surface:"#111c33"},
 ocean:{accent:"#25b9df",background:"#061521",surface:"#102b40"},
 violet:{accent:"#b36cff",background:"#10091f",surface:"#24143b"},
 emerald:{accent:"#36c99a",background:"#071a17",surface:"#102c27"}
};
const valid=v=>/^#[0-9a-f]{6}$/i.test(v||"");
const read=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||"null");return v&&valid(v.accent)&&valid(v.background)&&valid(v.surface)?v:presets.midnight}catch{return presets.midnight}};
function apply(v,save=true){
 if(!valid(v.accent)||!valid(v.background)||!valid(v.surface))return false;
 const root=document.documentElement;
 root.style.setProperty("--ary-accent",v.accent);
 root.style.setProperty("--ary-bg",v.background);
 root.style.setProperty("--ary-surface",v.surface);
 document.body.dataset.aryTheme="custom";
 ["aryThemeAccent","aryThemeBackground","aryThemeSurface"].forEach((id,i)=>{const el=$(id);if(el)el.value=[v.accent,v.background,v.surface][i]});
 document.querySelectorAll("[data-theme-preset]").forEach(b=>b.classList.toggle("active",Object.entries(presets).some(([name,p])=>name===b.dataset.themePreset&&p.accent===v.accent&&p.background===v.background&&p.surface===v.surface)));
 if(save){try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}}
 preview(v);return true;
}
function preview(v){const p=$("aryThemePreview");if(!p)return;p.style.setProperty("--preview-accent",v.accent);p.style.setProperty("--preview-bg",v.background);p.style.setProperty("--preview-surface",v.surface)}
function current(){return {accent:$("aryThemeAccent")?.value||presets.midnight.accent,background:$("aryThemeBackground")?.value||presets.midnight.background,surface:$("aryThemeSurface")?.value||presets.midnight.surface}}
function init(){
 if(!$("colorStudio"))return;
 const status=$("aryThemeStatus");
 const say=t=>{if(status)status.textContent=t};
 const controls=["aryThemeAccent","aryThemeBackground","aryThemeSurface"].map($);
 controls.forEach(el=>el?.addEventListener("input",()=>preview(current())));
 document.querySelectorAll("[data-theme-preset]").forEach(btn=>btn.addEventListener("click",()=>{const p=presets[btn.dataset.themePreset];if(p){apply(p);say("Preset "+btn.dataset.themePreset+" diterapkan ke seluruh website.")}}));
 $("aryThemeApply")?.addEventListener("click",()=>{const v=current();if(apply(v))say("Warna baru berhasil diterapkan ke seluruh tampilan ARYANZZ.")});
 $("aryThemeReset")?.addEventListener("click",()=>{apply(presets.midnight);say("Warna awal ARYANZZ dipulihkan.")});
 const saved=read();apply(saved,false);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
window.addEventListener("storage",e=>{if(e.key===KEY)apply(read(),false)});
})();