(()=>{"use strict";
const KEY="aryanzz.theme-studio.v94",MOTION_KEY="aryanzz.motion.enabled.v3",DESIGN_KEY="aryanzz.design.studio.v1";
const $=id=>document.getElementById(id);
const presets={
 midnight:{accent:"#8b5cf6",background:"#080d1c",surface:"#111c33"},
 ocean:{accent:"#25b9df",background:"#061521",surface:"#102b40"},
 violet:{accent:"#b36cff",background:"#10091f",surface:"#24143b"},
 emerald:{accent:"#36c99a",background:"#071a17",surface:"#102c27"}
};
const designDefaults={borderStyle:"solid",borderColor:"#38536b",borderWidth:1,radius:18,bgStyle:"gradient",bgA:"#101b2b",bgB:"#1a3046",effect:"none",speed:1,intensity:42};
const borderStyles=new Set(["solid","dashed","double","dotted","groove","none"]);
const bgStyles=new Set(["solid","gradient","aurora","grid","dots","glass","animated"]);
const effects=new Set(["none","float","pulse","shimmer","scan"]);
const valid=v=>/^#[0-9a-f]{6}$/i.test(v||"");
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const read=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||"null");return v&&valid(v.accent)&&valid(v.background)&&valid(v.surface)?v:presets.midnight}catch{return presets.midnight}};
const readDesign=()=>{try{const v=JSON.parse(localStorage.getItem(DESIGN_KEY)||"null");if(!v||!valid(v.borderColor)||!valid(v.bgA)||!valid(v.bgB))return {...designDefaults};return {...designDefaults,...v,borderStyle:borderStyles.has(v.borderStyle)?v.borderStyle:"solid",bgStyle:bgStyles.has(v.bgStyle)?v.bgStyle:"gradient",effect:effects.has(v.effect)?v.effect:"none",borderWidth:clamp(v.borderWidth,0,6),radius:clamp(v.radius,8,32),speed:clamp(v.speed,.5,2),intensity:clamp(v.intensity,0,100)}}catch{return {...designDefaults}}};
function applyMotion(enabled,save=true){
 const active=!!enabled,toggle=$("aryMotionToggle"),state=$("aryMotionState");
 document.body.classList.toggle("ary-motion-enabled",active);
 document.body.classList.toggle("ary-reduced-motion",!active);
 document.body.dataset.motion=active?"on":"off";
 if(toggle)toggle.checked=active;
 if(state)state.textContent=active?"Aktif":"Nonaktif";
 if(save)try{localStorage.setItem(MOTION_KEY,active?"1":"0")}catch{}
}
function apply(v,save=true){
 if(!valid(v.accent)||!valid(v.background)||!valid(v.surface))return false;
 const root=document.documentElement;
 root.style.setProperty("--ary-accent",v.accent);
 root.style.setProperty("--ary-bg",v.background);
 root.style.setProperty("--ary-surface",v.surface);
 document.body.dataset.aryTheme="custom";
 ["aryThemeAccent","aryThemeBackground","aryThemeSurface"].forEach((id,i)=>{const el=$(id);if(el)el.value=[v.accent,v.background,v.surface][i]});
 document.querySelectorAll("[data-theme-preset]").forEach(b=>b.classList.toggle("active",Object.entries(presets).some(([name,p])=>name===b.dataset.themePreset&&p.accent===v.accent&&p.background===v.background&&p.surface===v.surface)));
 if(save)try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}
 preview(v);return true;
}
function preview(v){const p=$("aryThemePreview");if(!p)return;p.style.setProperty("--preview-accent",v.accent);p.style.setProperty("--preview-bg",v.background);p.style.setProperty("--preview-surface",v.surface)}
function current(){return {accent:$("aryThemeAccent")?.value||presets.midnight.accent,background:$("aryThemeBackground")?.value||presets.midnight.background,surface:$("aryThemeSurface")?.value||presets.midnight.surface}}
function currentDesign(){
 return {
  borderStyle:borderStyles.has($("aryDesignBorderStyle")?.value)?$("aryDesignBorderStyle").value:"solid",
  borderColor:valid($("aryDesignBorderColor")?.value)?$("aryDesignBorderColor").value:designDefaults.borderColor,
  borderWidth:clamp($("aryDesignBorderWidth")?.value??designDefaults.borderWidth,0,6),
  radius:clamp($("aryDesignRadius")?.value??designDefaults.radius,8,32),
  bgStyle:bgStyles.has($("aryDesignBackgroundStyle")?.value)?$("aryDesignBackgroundStyle").value:"gradient",
  bgA:valid($("aryDesignBgA")?.value)?$("aryDesignBgA").value:designDefaults.bgA,
  bgB:valid($("aryDesignBgB")?.value)?$("aryDesignBgB").value:designDefaults.bgB,
  effect:effects.has($("aryDesignEffect")?.value)?$("aryDesignEffect").value:"none",
  speed:clamp($("aryDesignSpeed")?.value??designDefaults.speed,.5,2),
  intensity:clamp($("aryDesignIntensity")?.value??designDefaults.intensity,0,100)
 };
}
function previewDesign(v){
 const p=$("aryDesignPreview");if(!p)return;
 p.style.setProperty("--ary-design-border-color",v.borderColor);
 p.style.setProperty("--ary-design-border-width",v.borderWidth+"px");
 p.style.setProperty("--ary-design-border-style",v.borderStyle);
 p.style.setProperty("--ary-design-radius",v.radius+"px");
 p.style.setProperty("--ary-design-bg-a",v.bgA);
 p.style.setProperty("--ary-design-bg-b",v.bgB);
 p.dataset.bgStyle=v.bgStyle;p.dataset.effect=v.effect;
 const speed=$("aryDesignSpeedValue"),width=$("aryDesignBorderWidthValue"),radius=$("aryDesignRadiusValue"),intensity=$("aryDesignIntensityValue");
 if(speed)speed.textContent=v.speed.toFixed(1)+"×";
 if(width)width.textContent=v.borderWidth+" px";
 if(radius)radius.textContent=v.radius+" px";
 if(intensity)intensity.textContent=v.intensity+"%";
}
function applyDesign(v,save=true){
 if(!valid(v.borderColor)||!valid(v.bgA)||!valid(v.bgB))return false;
 const root=document.documentElement,body=document.body;
 root.style.setProperty("--ary-design-border-color",v.borderColor);
 root.style.setProperty("--ary-design-border-width",v.borderWidth+"px");
 root.style.setProperty("--ary-design-border-style",v.borderStyle);
 root.style.setProperty("--ary-design-radius",v.radius+"px");
 root.style.setProperty("--ary-design-bg-a",v.bgA);
 root.style.setProperty("--ary-design-bg-b",v.bgB);
 root.style.setProperty("--ary-design-speed",String(v.speed));
 root.style.setProperty("--ary-design-intensity",String(v.intensity/100));
 body.dataset.aryDesign="on";
 body.dataset.aryDesignBg=v.bgStyle;
 body.dataset.aryDesignEffect=v.effect;
 const controls={aryDesignBorderStyle:v.borderStyle,aryDesignBorderColor:v.borderColor,aryDesignBorderWidth:v.borderWidth,aryDesignRadius:v.radius,aryDesignBackgroundStyle:v.bgStyle,aryDesignBgA:v.bgA,aryDesignBgB:v.bgB,aryDesignEffect:v.effect,aryDesignSpeed:v.speed,aryDesignIntensity:v.intensity};
 for(const [id,value] of Object.entries(controls)){const el=$(id);if(el)el.value=String(value)}
 previewDesign(v);
 if(save)try{localStorage.setItem(DESIGN_KEY,JSON.stringify(v))}catch{}
 return true;
}
function init(){
 if(!$("colorStudio"))return;
 const status=$("aryThemeStatus"),designStatus=$("aryDesignStatus");
 const say=t=>{if(status)status.textContent=t};
 const sayDesign=t=>{if(designStatus)designStatus.textContent=t};
 const controls=["aryThemeAccent","aryThemeBackground","aryThemeSurface"].map($);
 controls.forEach(el=>el?.addEventListener("input",()=>preview(current())));
 document.querySelectorAll("[data-theme-preset]").forEach(btn=>btn.addEventListener("click",()=>{const p=presets[btn.dataset.themePreset];if(p){apply(p);say("Preset "+btn.dataset.themePreset+" diterapkan ke seluruh website.")}}));
 $("aryThemeApply")?.addEventListener("click",()=>{const v=current();if(apply(v))say("Warna baru berhasil diterapkan ke seluruh tampilan ARYANZZ.")});
 $("aryThemeReset")?.addEventListener("click",()=>{apply(presets.midnight);say("Warna awal ARYANZZ dipulihkan.")});
 $("aryMotionToggle")?.addEventListener("change",event=>{applyMotion(event.target.checked);say(event.target.checked?"Animasi antarmuka diaktifkan.":"Animasi antarmuka dinonaktifkan.")});
 const designControls=["aryDesignBorderStyle","aryDesignBorderColor","aryDesignBorderWidth","aryDesignRadius","aryDesignBackgroundStyle","aryDesignBgA","aryDesignBgB","aryDesignEffect","aryDesignSpeed","aryDesignIntensity"].map($);
 designControls.forEach(el=>{el?.addEventListener("input",()=>previewDesign(currentDesign()));el?.addEventListener("change",()=>previewDesign(currentDesign()))});
 $("aryDesignApply")?.addEventListener("click",()=>{const v=currentDesign();if(applyDesign(v))sayDesign("Border, background, dan efek berhasil diterapkan ke seluruh kartu dan panel ARYANZZ.")});
 $("aryDesignReset")?.addEventListener("click",()=>{applyDesign({...designDefaults});sayDesign("Pengaturan border dan background dikembalikan ke gaya awal.")});
 const saved=read();apply(saved,false);
 const savedMotion=(()=>{try{return localStorage.getItem(MOTION_KEY)}catch{return null}})();
 applyMotion(savedMotion===null?true:savedMotion==="1",false);
 applyDesign(readDesign(),false);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
window.addEventListener("storage",e=>{if(e.key===KEY)apply(read(),false);if(e.key===MOTION_KEY)applyMotion(e.newValue==="1",false);if(e.key===DESIGN_KEY)applyDesign(readDesign(),false)});
})();