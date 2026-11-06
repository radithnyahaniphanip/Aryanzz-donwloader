(()=>{"use strict";
const root=document.getElementById("eclipseRpg");
if(!root)return;
const $=id=>document.getElementById(id);
const SAVE_KEY_BASE="aryanzz.eclipse-rpg.save.v1";
function accountSaveKey(){const user=window.aryanzzAuthUser;const identity=user&&user.id?String(user.id):"guest";return SAVE_KEY_BASE+":"+encodeURIComponent(identity);}
let activeSaveKey=accountSaveKey();
const TIER_DATA=[
 {id:"biasa",name:"Biasa",count:30,mult:.8,color:"#a7b4c8",anim:"plain",prefix:"Prajurit"},
 {id:"sangat-biasa",name:"Sangat Biasa",count:60,mult:1,color:"#72c7d8",anim:"spark",prefix:"Penjelajah"},
 {id:"rare",name:"Rare",count:90,mult:1.55,color:"#5f9dff",anim:"glow",prefix:"Arkana"},
 {id:"langka",name:"Langka",count:52,mult:2.25,color:"#b17cff",anim:"orbit",prefix:"Relik"},
 {id:"collector",name:"Collector",count:6,mult:3.5,color:"#f2b85e",anim:"collector",prefix:"Kolektor"},
 {id:"juragan",name:"Juragan",count:4,mult:4.8,color:"#ff8a64",anim:"royal",prefix:"Juragan"},
 {id:"sultan",name:"Sultan",count:3,mult:6.7,color:"#ffcf65",anim:"sultan",prefix:"Sultan"},
 {id:"sangat-sultan",name:"Sangat Sultan",count:2,mult:9.2,color:"#f5f4ff",anim:"eclipse",prefix:"Eclipse"}
];
const TYPE_DATA=[
 {id:"weapon",label:"Senjata",names:["Pedang Fajar","Bilah Kabut","Tombak Reruntuhan","Katana Senja","Kapak Bara","Busur Astral","Belati Bayangan","Greatsword Raja"]},
 {id:"armor",label:"Armor",names:["Zirah Penjaga","Jubah Embun","Baju Perintis","Mantel Naga","Rantai Bulan","Pelindung Raja"]},
 {id:"shield",label:"Shield",names:["Perisai Aegis","Tameng Batu","Cermin Bintang","Benteng Senja","Lencana Penolak"]},
 {id:"helmet",label:"Helm",names:["Mahkota Penjaga","Topeng Wraith","Helm Penjelajah","Circlet Arunika","Kubah Kristal"]},
 {id:"boots",label:"Sepatu",names:["Sepatu Angin","Greaves Petir","Langkah Bayangan","Sandal Pengembara","Jejak Phoenix"]},
 {id:"gloves",label:"Sarung Tangan",names:["Sarung Tangan Titan","Cakar Naga","Genggam Rune","Handwrap Senja","Gauntlet Surya"]},
 {id:"ring",label:"Cincin",names:["Cincin Takdir","Cincin Bara","Segel Bulan","Lingkaran Arwah","Cincin Keberuntungan"]},
 {id:"necklace",label:"Kalung",names:["Kalung Kehidupan","Liontin Aether","Rantai Penjaga","Jimat Embun","Kalung Bintang"]},
 {id:"relic",label:"Artefak",names:["Relik Gerhana","Inti Dunia","Prisma Kuno","Jantung Naga","Fragmen Takdir"]}
];
const EFFECTS=[
 {id:"ember",name:"Api Abadi",desc:"Serangan berpeluang membakar target selama 3 detik."},
 {id:"frost",name:"Sentuhan Beku",desc:"Serangan berpeluang memperlambat gerakan musuh."},
 {id:"leech",name:"Pencuri Jiwa",desc:"Sebagian kecil damage memulihkan HP."},
 {id:"ward",name:"Benteng Arwah",desc:"Block yang berhasil memulihkan sedikit HP."},
 {id:"shock",name:"Petir Berantai",desc:"Serangan berpeluang membuat musuh tersentak."},
 {id:"fortune",name:"Sentuhan Juragan",desc:"Koin dari monster dan peti bertambah."},
 {id:"echo",name:"Gema Aether",desc:"Cooldown skill berkurang."},
 {id:"thorns",name:"Duri Balasan",desc:"Sebagian serangan yang diterima dipantulkan."},
 {id:"focus",name:"Fokus Rune",desc:"Kekuatan skill meningkat."},
 {id:"regen",name:"Nadi Kehidupan",desc:"HP pulih perlahan saat menjelajah."}
];
const equipmentCatalog=[];
TIER_DATA.forEach((tier,ti)=>{
 for(let j=0;j<tier.count;j++){
  const type=TYPE_DATA[j%TYPE_DATA.length];
  const power=tier.mult*(1+(j%7)*.065);
  const n=Math.round(power*10);
  const stats={maxHp:0,maxMp:0,atk:0,def:0,crit:0,speed:0,dodge:0,regen:0,skillPower:0,block:0,luck:0};
  if(type.id==="weapon"){stats.atk=2+n*1.15;stats.crit=1+(j%5)*.6;}
  if(type.id==="armor"){stats.maxHp=12+n*5;stats.def=2+n*.8;}
  if(type.id==="shield"){stats.def=3+n*1.05;stats.block=4+(j%6)*2;}
  if(type.id==="helmet"){stats.maxHp=8+n*2.4;stats.maxMp=5+n*1.6;stats.crit=1+(j%4)*.4;}
  if(type.id==="boots"){stats.speed=4+n*.55;stats.dodge=1+(j%5)*.8;}
  if(type.id==="gloves"){stats.atk=1+n*.7;stats.crit=2+(j%6)*.7;}
  if(type.id==="ring"){stats.crit=3+n*.7;stats.luck=1+(j%4)*1.2;}
  if(type.id==="necklace"){stats.maxHp=10+n*2.8;stats.regen=.2+(j%5)*.12;stats.maxMp=4+n;}
  if(type.id==="relic"){stats.skillPower=3+n*.85;stats.luck=2+(j%5)*1.4;stats.maxMp=8+n*1.4;}
  const effect=EFFECTS[(equipmentCatalog.length*7+ti*3)%EFFECTS.length];
  const roman=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];
  const subTier=tier.id==="langka"&&j>=39?"Sangat Langka":"";
  equipmentCatalog.push({
   id:equipmentCatalog.length,name:tier.prefix+" "+type.names[j%type.names.length]+" "+roman[j%roman.length]+" · "+(j+1),
   tier:tier.id,tierName:tier.name,subTier:subTier,tierIndex:ti,type:type.id,typeLabel:type.label,
   levelReq:Math.max(1,ti*3+Math.floor(j/12)+1),price:Math.round(45*tier.mult*tier.mult+j*4),
   color:tier.color,anim:tier.anim,effect:effect.id,effectName:effect.name,effectDesc:effect.desc,
   effectValue:1+(j%4)*.35+ti*.22,stats:stats
  });
 }
});
const SKILL_FAMILIES=[
 {name:"Ember Slash",element:"Api",type:"damage",desc:"Tebasan api yang menembus pertahanan.",power:1.8,mana:12,cool:5},
 {name:"Frost Lance",element:"Es",type:"freeze",desc:"Tombak es melukai dan memperlambat target.",power:1.5,mana:15,cool:7},
 {name:"Storm Arc",element:"Petir",type:"aoe",desc:"Petir menyambar semua musuh di sekitar.",power:1.25,mana:18,cool:9},
 {name:"Shadow Step",element:"Bayangan",type:"dash",desc:"Berpindah cepat dan menghindari serangan.",power:1.1,mana:10,cool:6},
 {name:"Guardian Ward",element:"Cahaya",type:"shield",desc:"Membentuk perisai energi sementara.",power:1.2,mana:16,cool:12},
 {name:"Renewal",element:"Alam",type:"heal",desc:"Memulihkan HP berdasarkan kekuatan karakter.",power:1.4,mana:20,cool:14},
 {name:"Soul Drain",element:"Arwah",type:"drain",desc:"Menyerap energi hidup target.",power:1.35,mana:18,cool:10},
 {name:"Meteor Fall",element:"Kosmik",type:"aoe",desc:"Meteor menghantam area pertempuran.",power:2.1,mana:28,cool:18},
 {name:"Venom Mark",element:"Racun",type:"burn",desc:"Tanda racun memberi damage berkala.",power:1.1,mana:14,cool:8},
 {name:"Iron Resolve",element:"Baja",type:"buff",desc:"Meningkatkan kekuatan serangan sementara.",power:1.3,mana:18,cool:16},
 {name:"Spirit Wolf",element:"Roh",type:"summon",desc:"Memanggil roh serigala untuk menyerang.",power:1.7,mana:24,cool:20},
 {name:"Rune Burst",element:"Rune",type:"aoe",desc:"Ledakan rune dengan jangkauan luas.",power:1.6,mana:22,cool:13},
 {name:"Void Pierce",element:"Void",type:"damage",desc:"Tusukan void dengan penetrasi pertahanan.",power:2.25,mana:24,cool:12},
 {name:"Moon Crescent",element:"Bulan",type:"damage",desc:"Busur energi bulan menyerang dari jarak jauh.",power:1.75,mana:17,cool:8},
 {name:"Thunder Roar",element:"Petir",type:"stun",desc:"Gelombang suara petir menghentikan musuh.",power:1.2,mana:21,cool:15},
 {name:"Crystal Bloom",element:"Kristal",type:"heal",desc:"Kristal memulihkan HP dan mana.",power:1.15,mana:22,cool:17},
 {name:"Blood Oath",element:"Darah",type:"drain",desc:"Mengorbankan energi untuk serangan dan pemulihan.",power:2.05,mana:26,cool:19},
 {name:"Wind Dance",element:"Angin",type:"dash",desc:"Gerakan angin meningkatkan kecepatan dan dodge.",power:1.35,mana:14,cool:9},
 {name:"Aegis Pulse",element:"Aegis",type:"shield",desc:"Gelombang pelindung menahan damage besar.",power:1.8,mana:25,cool:21},
 {name:"Starfall",element:"Bintang",type:"aoe",desc:"Hujan bintang menghantam seluruh area.",power:2.35,mana:32,cool:24}
];
const skillCatalog=Array.from({length:600},(_,i)=>{
 const family=SKILL_FAMILIES[i%SKILL_FAMILIES.length],rank=Math.floor(i/SKILL_FAMILIES.length)+1;
 return {id:i,name:family.name+" · Resonansi "+rank,element:family.element,type:family.type,desc:family.desc,
  power:family.power+rank*.075+(i%5)*.035,mana:Math.round(family.mana+rank*.55),cool:Math.max(2,+(family.cool-rank*.035).toFixed(1)),
  levelReq:1+Math.floor(i/10),pointCost:1+Math.floor(i/150),rank:rank};
});
const BOSS_PREFIX=["Raja","Ratu","Penjaga","Penguasa","Pemakan","Penghancur","Pengintai","Arbiter","Wali","Kaisar","Dewa","Nenek","Sang","Panglima","Kutukan","Bayangan","Penguasa Senja","Pewaris","Titan","Penakluk","Pengembara","Sang Terlarang","Arwah","Naga","Void","Penjaga Gerbang","Penguasa Mimpi","Mahkota","Penguasa Badai","Eclipse"];
const BOSS_KIND=["Slime Purba","Serigala Astral","Ksatria Retak","Naga Kabut","Raksasa Batu","Penyihir Hampa","Phoenix Hitam","Hydra Senja","Golem Rune","Raja Tengkorak","Leviathan","Malaikat Jatuh","Ular Dunia","Ratu Laba-laba","Raksasa Laut","Wraith Kuno","Drake Bara","Penjaga Waktu","Chimera","Raja Void","Behemoth","Roh Hutan","Colossus","Demon Aether","Jenderal Kegelapan","Raja Es","Mimic Kuno","Titan Petir","Seraphim","Naga Gerhana"];
const BOSS_HP=[100,300,500,800,1200];
const bossCatalog=Array.from({length:900},(_,i)=>{
 const id=i+1,k=Math.max(0,id-5);
 return {id:id,name:BOSS_PREFIX[i%30]+" "+BOSS_KIND[Math.floor(i/30)%30]+" #"+id,
  hp:id<=5?BOSS_HP[id-1]:Math.round(1200+k*1800+Math.pow(k,1.55)*60),
  atk:Math.round(12+id*2.1+Math.pow(id,1.15)*.3),def:Math.round(5+id*1.4+Math.sqrt(id)*2),
  levelReq:Math.max(1,Math.ceil(id/3)),pattern:["Cleave","Shadow Dash","Rune Burst","Earthquake","Soul Drain","Meteor Rain","Void Beam","Frost Prison","Summon Adds","Twin Strike","Gravity Well","Eclipse Pulse"][i%12],
  rewardCoins:100+id*15,rewardXp:160+id*45};
});
const SKINS=[
 {id:"wanderer",name:"Wanderer",cost:0,level:1,body:"#4d9dff",cape:"#233d70",glow:"#79d9ff"},
 {id:"ember",name:"Ember Knight",cost:350,level:3,body:"#ff875f",cape:"#702d35",glow:"#ffb36e"},
 {id:"frost",name:"Frost Warden",cost:600,level:5,body:"#8ce6f4",cape:"#245e88",glow:"#d7fbff"},
 {id:"shadow",name:"Shadow Reaper",cost:950,level:8,body:"#a58bff",cape:"#382a63",glow:"#bdaaff"},
 {id:"royal",name:"Royal Guardian",cost:1600,level:12,body:"#f0c46b",cape:"#684c27",glow:"#ffe6a0"},
 {id:"celestial",name:"Celestial",cost:3200,level:18,body:"#f4f2ff",cape:"#5268a6",glow:"#ffffff"},
 {id:"void",name:"Void Sovereign",cost:6500,level:25,body:"#e88aff",cape:"#422050",glow:"#ffb2fa"},
 {id:"eclipse",name:"Eclipse Monarch",cost:12000,level:35,body:"#f5e9ff",cape:"#23153d",glow:"#d7a6ff"}
];
const QUEST_POOL={
 daily:[
  {type:"kill",title:"Pemburu Kabut",desc:"Kalahkan monster di Mistwood.",target:5,reward:120,xp:90},
  {type:"collect",title:"Pengumpul Pecahan",desc:"Kumpulkan hasil jarahan monster.",target:3,reward:110,xp:80},
  {type:"explore",title:"Jejak Penjelajah",desc:"Temukan titik rahasia di dunia.",target:1,reward:100,xp:100},
  {type:"spend",title:"Belanja Perbekalan",desc:"Gunakan koin di toko.",target:100,reward:90,xp:75},
  {type:"upgrade",title:"Perkuat Perlengkapan",desc:"Tingkatkan satu equipment.",target:1,reward:150,xp:120},
  {type:"puzzle",title:"Simbol Terlupakan",desc:"Pecahkan satu teka-teki kuno.",target:1,reward:200,xp:160}
 ],
 weekly:[
  {type:"kill",title:"Pembersihan Hutan",desc:"Kalahkan monster sebanyak mungkin.",target:30,reward:700,xp:600},
  {type:"boss",title:"Penakluk Gerbang",desc:"Kalahkan boss.",target:1,reward:900,xp:800},
  {type:"collect",title:"Pemburu Relik",desc:"Kumpulkan hasil jarahan.",target:15,reward:550,xp:500},
  {type:"spend",title:"Pedagang Aktif",desc:"Belanjakan koin di toko.",target:900,reward:500,xp:450},
  {type:"upgrade",title:"Ahli Tempa",desc:"Upgrade equipment.",target:4,reward:850,xp:750},
  {type:"explore",title:"Peta Terbuka",desc:"Temukan area rahasia.",target:3,reward:600,xp:600}
 ],
 monthly:[
  {type:"boss",title:"Legenda Pemburu Boss",desc:"Kalahkan beberapa boss.",target:5,reward:4200,xp:3600},
  {type:"kill",title:"Penjaga Dunia",desc:"Kalahkan monster dalam perjalanan.",target:120,reward:3000,xp:2600},
  {type:"collect",title:"Gudang Relik",desc:"Kumpulkan hasil jarahan monster.",target:65,reward:2500,xp:2200},
  {type:"upgrade",title:"Master Pengrajin",desc:"Upgrade equipment berkali-kali.",target:15,reward:3500,xp:3000},
  {type:"spend",title:"Sirkulasi Koin",desc:"Gunakan koin di toko.",target:5000,reward:2600,xp:2200},
  {type:"puzzle",title:"Arsip Rahasia",desc:"Pecahkan teka-teki kuno.",target:3,reward:3000,xp:2500},
  {type:"explore",title:"Penjelajah Legendaris",desc:"Temukan titik eksplorasi.",target:10,reward:3200,xp:2800},
  {type:"boss",title:"Sang Penantang",desc:"Kalahkan boss dalam rangkaian tantangan.",target:10,reward:6000,xp:5200}
 ]
};
const QUEST_COUNT={daily:3,weekly:5,monthly:8};
function hashText(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function seeded(seed){let x=hashText(seed)||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
function dateKey(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function periodKey(period){
 const d=new Date();
 if(period==="daily")return dateKey(d);
 if(period==="monthly")return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
 const monday=new Date(d);monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));return dateKey(monday);
}
function nextReset(period){
 const d=new Date();d.setHours(0,0,0,0);
 if(period==="daily")d.setDate(d.getDate()+1);
 else if(period==="weekly"){d.setDate(d.getDate()+((8-d.getDay())%7||7));}
 else {d.setDate(1);d.setMonth(d.getMonth()+1);}
 return d.getTime();
}
function makeQuests(period,key){
 const pool=QUEST_POOL[period],rnd=seeded(period+"|"+key),chosen=[],used=new Set();
 while(chosen.length<QUEST_COUNT[period]&&chosen.length<pool.length){
  const ix=Math.floor(rnd()*pool.length);if(used.has(ix))continue;used.add(ix);
  const t=pool[ix],scale=period==="daily"?1:period==="weekly"?1:1;
  chosen.push({id:period+"-"+key+"-"+ix,type:t.type,title:t.title,desc:t.desc,target:Math.max(1,Math.round(t.target*scale)),progress:0,reward:t.reward,xp:t.xp,done:false});
 }
 return chosen;
}
function ensureQuestPeriods(){
 ["daily","weekly","monthly"].forEach(period=>{
  const key=periodKey(period),old=state.quests[period];
  if(!old||old.key!==key)state.quests[period]={key:key,items:makeQuests(period,key)};
 });
}
function freshState(){
 return {
  player:{name:"Penjelajah",level:1,xp:0,coins:250,hp:120,mp:60,skillPoints:8,stamina:100},
  ownedItems:[0,1,2],equipped:{weapon:0,armor:1,shield:2},upgrades:{},
  unlockedSkills:[0,1,2,3],skillSlots:[0,1,2,3],potions:3,manaPotions:2,enhanceStones:3,
  bossProgress:0,kills:0,loot:0,puzzleSolved:false,clueFound:false,explored:false,
  skinsUnlocked:["wanderer"],skin:"wanderer",quests:{},createdAt:Date.now()
 };
}
function loadState(){
 const base=freshState();
 try{
  const raw=localStorage.getItem(activeSaveKey);if(!raw)return base;
  const data=JSON.parse(raw);if(!data||typeof data!=="object")return base;
  base.player=Object.assign(base.player,data.player||{});
  ["ownedItems","upgrades","unlockedSkills","skillSlots","equipped","quests","skinsUnlocked"].forEach(k=>{if(data[k]&&typeof data[k]==="object")base[k]=data[k]});
  ["potions","manaPotions","enhanceStones","bossProgress","kills","loot","puzzleSolved","clueFound","explored","skin","createdAt"].forEach(k=>{if(data[k]!==undefined)base[k]=data[k]});
  if(!Array.isArray(base.ownedItems))base.ownedItems=[0,1,2];
  if(!Array.isArray(base.unlockedSkills))base.unlockedSkills=[0];
  if(!Array.isArray(base.skillSlots))base.skillSlots=[0,null,null,null];
  base.ownedItems=base.ownedItems.filter(id=>Number.isInteger(id)&&equipmentCatalog[id]);
  base.bossProgress=Math.max(0,Math.min(900,Number(base.bossProgress)||0));
  base.player.level=Math.max(1,Number(base.player.level)||1);
  return base;
 }catch{return base}
}
let state=loadState();
ensureQuestPeriods();
const world={w:1800,h:1260,tile:48};
const player={x:270,y:360,faceX:1,faceY:0,attackCd:0,dodge:0,invuln:0,shield:0,buff:0,burn:0,summon:0,regen:0,slow:0};
const input={up:false,down:false,left:false,right:false,block:false};
let enemies=[],boss=null,bossActive=false,particles=[],lastFrame=0,raf=0,running=false;
let activeTab="adventure",inventoryPage=0,skillPage=0,bossPage=0,questPeriod="daily",skillQuery="",bossQuery="",puzzleAttempt=[];
const canvas=$("eclCanvas"),ctx=canvas?canvas.getContext("2d"):null;
const touch=matchMedia("(pointer:coarse)").matches;
const decor=[];
for(let i=0;i<105;i++){
 const x=90+((i*197)%1600),y=70+((i*113)%1110);
 if(Math.hypot(x-270,y-360)>130)decor.push({x:x,y:y,size:22+(i%4)*5,kind:i%7===0?"pine":"tree"});
}
const objects=[
 {id:"elder",x:390,y:530,label:"Tetua Aruna",icon:"♙"},
 {id:"rune",x:560,y:270,label:"Prasasti Bulan",icon:"ᚱ"},
 {id:"chest",x:880,y:330,label:"Peti Tersegel",icon:"▣"},
 {id:"portal",x:1390,y:820,label:"Gerbang Boss",icon:"◉"},
 {id:"obelisk",x:1090,y:600,label:"Obelisk Kuno",icon:"✧"}
];
function seedEnemies(){
 enemies=[
  {id:1,name:"Slime Kabut",x:570,y:430,hp:42,maxHp:42,atk:7,def:1,speed:52,cd:0,dead:false,color:"#79d5bb"},
  {id:2,name:"Serigala Lumut",x:740,y:510,hp:58,maxHp:58,atk:9,def:2,speed:66,cd:0,dead:false,color:"#b6a16d"},
  {id:3,name:"Wraith Kecil",x:900,y:510,hp:68,maxHp:68,atk:10,def:2,speed:58,cd:0,dead:false,color:"#9b8be8"},
  {id:4,name:"Slime Bara",x:1040,y:390,hp:82,maxHp:82,atk:12,def:3,speed:48,cd:0,dead:false,color:"#e88b70"},
  {id:5,name:"Penjaga Rune",x:1180,y:660,hp:110,maxHp:110,atk:15,def:4,speed:45,cd:0,dead:false,color:"#74b4ee"}
 ];
}
seedEnemies();
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmt(n){return Math.floor(Number(n)||0).toLocaleString("id-ID")}
function toast(message){
 const node=$("eclToast");if(!node)return;node.textContent=message;node.classList.add("show");
 clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove("show"),2600);
}
function log(message){
 const node=$("eclLog");if(!node)return;
 const line=document.createElement("div");line.textContent="› "+message;node.prepend(line);
 while(node.children.length>5)node.lastChild.remove();
}
function save(show){
 try{localStorage.setItem(activeSaveKey,JSON.stringify(state));if(show)toast("Progress berhasil disimpan di perangkat ini.");}
 catch{toast("Penyimpanan perangkat penuh. Ekspor save agar progress aman.");}
 refreshHud();
}
function xpNeed(level){return Math.round(100+Math.pow(level,1.35)*32)}
function equippedItems(){return Object.keys(state.equipped).map(slot=>equipmentCatalog[state.equipped[slot]]).filter(Boolean)}
function hasEffect(id){return equippedItems().some(item=>item.effect===id)}
function getStats(){
 const lv=state.player.level;
 const s={maxHp:120+(lv-1)*18,maxMp:60+(lv-1)*8,atk:12+(lv-1)*5,def:6+(lv-1)*2.3,crit:5+(lv-1)*.18,speed:165,dodge:4,regen:.15,skillPower:0,block:0,luck:0};
 equippedItems().forEach(item=>{
  const upgrade=Number(state.upgrades[item.id]||0),scale=1+upgrade*.13;
  Object.keys(item.stats).forEach(key=>{if(s[key]!==undefined)s[key]+=item.stats[key]*scale});
 });
 if(hasEffect("focus"))s.skillPower+=5;
 if(hasEffect("regen"))s.regen+=.6;
 return s;
}
function refreshHud(){
 const p=state.player,s=getStats(),xp=xpNeed(p.level);
 p.hp=Math.max(0,Math.min(s.maxHp,Number(p.hp)||s.maxHp));p.mp=Math.max(0,Math.min(s.maxMp,Number(p.mp)||s.maxMp));
 const set=(id,value)=>{const n=$(id);if(n)n.textContent=value};
 const bar=(id,value)=>{const n=$(id);if(n)n.style.width=Math.max(0,Math.min(100,value))+"%"};
 set("eclLevel",p.level);set("eclCoin",fmt(p.coins));set("eclXpText",fmt(p.xp)+" / "+fmt(xp)+" EXP");
 set("eclHpText",fmt(p.hp)+" / "+fmt(s.maxHp));set("eclMpText",fmt(p.mp)+" / "+fmt(s.maxMp));
 set("eclAtk",fmt(s.atk));set("eclDef",fmt(s.def));set("eclCrit",Math.round(s.crit)+"%");
 state.skillSlots.forEach((id,index)=>{const node=$("eclSkillSlot"+index),skill=skillCatalog[id];if(node)node.textContent=skill?skill.name:"Slot kosong";});
 bar("eclXpFill",p.xp/xp*100);bar("eclHpFill",p.hp/s.maxHp*100);bar("eclMpFill",p.mp/s.maxMp*100);
 const bossHud=$("eclBossHud");if(bossHud)bossHud.hidden=!bossActive||!boss;
 if(bossActive&&boss){set("eclBossName",boss.name);set("eclBossHpText",fmt(boss.hp)+" / "+fmt(boss.maxHp)+" HP");bar("eclBossHpFill",boss.hp/boss.maxHp*100)}
}
function gainXp(amount){
 state.player.xp+=Math.max(0,Math.round(amount));
 let leveled=false;
 while(state.player.xp>=xpNeed(state.player.level)){
  state.player.xp-=xpNeed(state.player.level);state.player.level++;state.player.skillPoints++;
  const s=getStats();state.player.hp=s.maxHp;state.player.mp=s.maxMp;leveled=true;
  log("Level naik menjadi "+state.player.level+". Skill point +1.");
 }
 if(leveled)toast("LEVEL UP! Kamu mencapai level "+state.player.level+".");
 refreshHud();
}
function addCoins(amount){
 let bonus=hasEffect("fortune")?1.15:1;
 const earned=Math.max(0,Math.round(amount*bonus));state.player.coins+=earned;return earned;
}
function updateQuest(type,amount){
 ["daily","weekly","monthly"].forEach(period=>{
  const qset=state.quests[period];if(!qset)return;
  qset.items.forEach(q=>{
   if(q.done||q.type!==type)return;
   q.progress=Math.min(q.target,q.progress+amount);
   if(q.progress>=q.target){
    q.done=true;addCoins(q.reward);gainXp(q.xp);log("Quest selesai: "+q.title+".");
    toast("Quest selesai: "+q.title+" · +"+fmt(q.reward)+" koin");
   }
  });
 });
}
function addItem(id,source){
 const item=equipmentCatalog[id];if(!item)return;
 if(!state.ownedItems.includes(id))state.ownedItems.push(id);
 state.loot++;updateQuest("collect",1);
 log("Mendapatkan "+item.name+" ("+item.tierName+").");
 toast((source||"Loot")+": "+item.name);
 save(false);
}
function randomDrop(bossNo){
 let tierIndex=0;
 if(bossNo)tierIndex=Math.min(7,Math.floor((bossNo-1)/4)+2);
 else tierIndex=Math.min(3,Math.floor((state.player.level-1)/8)+1);
 const tier=TIER_DATA[tierIndex],items=equipmentCatalog.filter(item=>item.tier===tier.id);
 if(!items.length)return;
 const item=items[Math.floor(Math.random()*items.length)];addItem(item.id,bossNo?"Hadiah Boss":"Monster drop");
}
function damagePlayer(raw){
 if(player.invuln>0)return;
 const stats=getStats();let dmg=Math.max(1,Math.round(raw-stats.def*.55));
 if(input.block||player.shield>0){
  dmg=Math.max(1,Math.round(dmg*(.28-Math.min(.12,stats.block/200))));
  if(hasEffect("ward"))state.player.hp=Math.min(stats.maxHp,state.player.hp+3);
 }
 state.player.hp=Math.max(0,state.player.hp-dmg);
 if(hasEffect("thorns")&&bossActive&&boss)boss.hp=Math.max(0,boss.hp-dmg*.25);
 spawnParticles(player.x,player.y,"#ff707e",8);
 if(state.player.hp<=0){
  state.player.hp=Math.max(1,Math.round(stats.maxHp*.35));state.player.mp=Math.max(0,Math.round(stats.maxMp*.25));
  player.x=270;player.y=360;bossActive=false;boss=null;toast("Kamu tumbang. Tetua Aruna membawamu kembali ke perkemahan.");
  log("Kembali ke perkemahan. Sebagian HP dan MP dipulihkan.");
 }
 refreshHud();
}
function spawnParticles(x,y,color,count){
 const max=matchMedia("(max-width:680px)").matches?16:34;
 for(let i=0;i<Math.min(count,max);i++)particles.push({x:x,y:y,vx:(Math.random()-.5)*150,vy:(Math.random()-.5)*150,life:.35+Math.random()*.55,max:.9,color:color,size:2+Math.random()*4});
}
function closestTarget(range){
 let target=null,best=range;
 enemies.forEach(e=>{if(e.dead)return;const d=Math.hypot(e.x-player.x,e.y-player.y);if(d<best){best=d;target=e}});
 if(bossActive&&boss){const d=Math.hypot(boss.x-player.x,boss.y-player.y);if(d<best){best=d;target=boss}}
 return target;
}
function applyPassives(target,damage){
 if(hasEffect("leech"))state.player.hp=Math.min(getStats().maxHp,state.player.hp+Math.max(1,Math.round(damage*.035)));
 if(hasEffect("ember")&&Math.random()<.2){target.burn=3;target.burnDamage=Math.max(2,Math.round(damage*.12))}
 if(hasEffect("frost")&&Math.random()<.24)target.slow=2.5;
 if(hasEffect("shock")&&Math.random()<.12)target.stun=1.2;
}
function hitTarget(target,raw,kind){
 if(!target)return;
 const defense=Number(target.def||0),damage=Math.max(1,Math.round(raw-defense*.42));
 target.hp=Math.max(0,target.hp-damage);
 spawnParticles(target.x,target.y,kind==="skill"?"#b28aff":"#9deaff",kind==="skill"?18:9);
 applyPassives(target,damage);
 if(target===boss){if(target.hp<=0)defeatBoss();else refreshHud();}
 else if(target.hp<=0)killEnemy(target);
}
function attack(){
 if(player.attackCd>0||state.player.hp<=0)return;
 player.attackCd=.48;
 const stats=getStats(),target=closestTarget(112);
 const bonus=player.buff>0?1.35:1;
 if(target){
  let damage=stats.atk*bonus;
  if(Math.random()*100<stats.crit)damage*=1.8;
  hitTarget(target,damage,"basic");
  if(player.summon>0)hitTarget(target,damage*.35,"skill");
 }else spawnParticles(player.x+player.faceX*45,player.y+player.faceY*45,"#9deaff",5);
 refreshHud();
}
function killEnemy(enemy){
 if(enemy.dead)return;enemy.dead=true;state.kills++;
 const earned=addCoins(18+Math.round(state.player.level*2));gainXp(32+state.player.level*4);updateQuest("kill",1);
 log(enemy.name+" dikalahkan · +"+earned+" koin.");
 if(Math.random()<.28)randomDrop(0);
}
function bossHpPercent(){return boss?Math.max(0,boss.hp/boss.maxHp):0}
function defeatBoss(){
 if(!boss||boss.defeated)return;
 boss.defeated=true;const won=boss;
 state.bossProgress=Math.max(state.bossProgress,won.id);bossActive=false;boss=null;
 const coins=addCoins(won.rewardCoins);gainXp(won.rewardXp);updateQuest("boss",1);
 randomDrop(won.id);state.player.hp=Math.min(getStats().maxHp,state.player.hp+Math.round(getStats().maxHp*.3));
 state.player.mp=Math.min(getStats().maxMp,state.player.mp+Math.round(getStats().maxMp*.25));
 log("Boss "+won.id+" tumbang. Hadiah "+fmt(coins)+" koin dan relik.");
 toast("BOSS DEFEATED! "+won.name);
 save(false);refreshHud();
}
function startBoss(id){
 const info=bossCatalog[id-1];if(!info)return;
 if(id>state.bossProgress+1){toast("Kalahkan boss sebelumnya untuk membuka tantangan ini.");return}
 if(state.player.level<info.levelReq){toast("Boss ini membutuhkan level "+info.levelReq+".");return}
 if(bossActive){toast("Selesaikan pertarungan boss yang sedang berlangsung.");return}
 boss={id:info.id,name:info.name,hp:info.hp,maxHp:info.hp,atk:info.atk,def:info.def,pattern:info.pattern,
  x:player.x+190,y:player.y+10,speed:38+Math.min(70,id*.05),attackCd:1.6,telegraph:0,burn:0,slow:0,stun:0,phase:1};
 bossActive=true;switchTab("adventure");toast("Gerbang terbuka: "+info.name);log("Boss "+id+" memasuki arena.");refreshHud();save(false);
}
function castSkill(slot){
 const skillId=state.skillSlots[slot],skill=skillCatalog[skillId];if(skillId===null||skillId===undefined||!skill)return;
 if(!state.unlockedSkills.includes(skillId)){toast("Skill belum dibuka.");return}
 if(skillCooldowns[skillId]>0){toast("Skill masih cooldown.");return}
 if(state.player.mp<skill.mana){toast("Mana tidak cukup. Gunakan Mana Potion.");return}
 state.player.mp-=skill.mana;skillCooldowns[skillId]=skill.cool;
 const stats=getStats(),power=skill.power*(1+stats.skillPower/100),target=closestTarget(330);
 const damage=stats.atk*power;
 if(skill.type==="heal"){state.player.hp=Math.min(stats.maxHp,state.player.hp+Math.round(stats.maxHp*(.16+power*.055)));state.player.mp=Math.min(stats.maxMp,state.player.mp+Math.round(stats.maxMp*.08));}
 else if(skill.type==="shield"){player.shield=Math.max(player.shield,4+power*1.8);spawnParticles(player.x,player.y,"#9adfff",24);}
 else if(skill.type==="dash"){player.x=Math.max(35,Math.min(world.w-35,player.x+player.faceX*155));player.y=Math.max(35,Math.min(world.h-35,player.y+player.faceY*155));player.invuln=.85;player.dodge=.3;player.buff=Math.max(player.buff,2);}
 else if(skill.type==="buff"){player.buff=Math.max(player.buff,5+skill.rank*.15);}
 else if(skill.type==="aoe"){enemies.filter(e=>!e.dead&&Math.hypot(e.x-player.x,e.y-player.y)<240).forEach(e=>hitTarget(e,damage,"skill"));if(bossActive&&boss&&Math.hypot(boss.x-player.x,boss.y-player.y)<280)hitTarget(boss,damage,"skill");}
 else if(target){
  hitTarget(target,damage,"skill");
  if(skill.type==="freeze")target.slow=3+skill.rank*.04;
  if(skill.type==="stun")target.stun=1.2+skill.rank*.025;
  if(skill.type==="burn"){target.burn=4+skill.rank*.05;target.burnDamage=Math.max(2,Math.round(damage*.16))}
  if(skill.type==="drain")state.player.hp=Math.min(stats.maxHp,state.player.hp+Math.round(damage*.12));
  if(skill.type==="summon")player.summon=Math.max(player.summon,6);
 }
 else if(skill.type==="summon")player.summon=6;
 else toast("Tidak ada target dalam jangkauan skill.");
 spawnParticles(player.x,player.y,"#b28aff",12);refreshHud();save(false);
}
const skillCooldowns={};
function usePotion(kind){
 const s=getStats();
 if(kind==="hp"){
  if(state.potions<=0){toast("HP Potion habis. Beli di Shop.");return}
  if(state.player.hp>=s.maxHp){toast("HP masih penuh.");return}
  state.potions--;state.player.hp=Math.min(s.maxHp,state.player.hp+Math.round(s.maxHp*.45));
 }else{
  if(state.manaPotions<=0){toast("Mana Potion habis. Beli di Shop.");return}
  if(state.player.mp>=s.maxMp){toast("Mana masih penuh.");return}
  state.manaPotions--;state.player.mp=Math.min(s.maxMp,state.player.mp+Math.round(s.maxMp*.55));
 }
 refreshHud();save(false);toast(kind==="hp"?"HP Potion digunakan.":"Mana Potion digunakan.");
}
function interact(){
 let nearest=null,best=100;
 objects.forEach(o=>{const d=Math.hypot(o.x-player.x,o.y-player.y);if(d<best){best=d;nearest=o}});
 if(!nearest){toast("Tidak ada sesuatu yang bisa diperiksa di dekatmu.");return}
 if(nearest.id==="elder"){
  toast("Tetua Aruna: 'Gerhana membuka gerbang. Baca rune, perkuat perlengkapan, lalu hadapi penjaganya.'");
  updateQuest("explore",1);return;
 }
 if(nearest.id==="rune"){
  state.clueFound=true;toast("Prasasti terbaca: Bintang → Bulan → Matahari → Mahkota. Simpan urutannya.");log("Kamu menemukan petunjuk rune.");save(false);return;
 }
 if(nearest.id==="chest"){
  if(state.puzzleSolved){toast("Peti ini sudah dibuka. Isinya telah menjadi milikmu.");return}
  if(!state.clueFound){toast("Peti tersegel. Cari prasasti bercahaya untuk menemukan petunjuk.");return}
  openPuzzle();return;
 }
 if(nearest.id==="portal"){startBoss(state.bossProgress+1);return}
 if(nearest.id==="obelisk"){
  state.explored=true;updateQuest("explore",1);toast("Obelisk menyimpan catatan tentang 900 penjaga gerhana.");save(false);
 }
}
function openPuzzle(){
 puzzleAttempt=[];const modal=$("eclPuzzleModal");if(modal)modal.hidden=false;
 const status=$("eclPuzzleStatus");if(status)status.textContent="Urutkan simbol sesuai petunjuk prasasti.";
}
function closePuzzle(){const modal=$("eclPuzzleModal");if(modal)modal.hidden=true}
function chooseRune(n){
 if(state.puzzleSolved)return;
 puzzleAttempt.push(Number(n));
 const expected=[3,1,4,2];
 const status=$("eclPuzzleStatus");
 if(puzzleAttempt[puzzleAttempt.length-1]!==expected[puzzleAttempt.length-1]){
  puzzleAttempt=[];if(status)status.textContent="Urutan belum tepat. Coba baca kembali petunjuk.";return;
 }
 if(puzzleAttempt.length===expected.length){
  state.puzzleSolved=true;closePuzzle();updateQuest("puzzle",1);
  const item=equipmentCatalog.filter(x=>x.tier==="langka")[Math.floor(Math.random()*52)];
  if(item)addItem(item.id,"Peti misterius");
  const coins=addCoins(300);gainXp(240);log("Teka-teki berhasil. Peti kuno terbuka.");
  toast("MISTERI TERPECAHKAN! +"+fmt(coins)+" koin.");save(false);
 }else if(status)status.textContent="Simbol benar ("+puzzleAttempt.length+"/4). Lanjutkan.";
}
function upgradeItem(id){
 const item=equipmentCatalog[id];if(!item||!state.ownedItems.includes(id))return;
 const lv=Number(state.upgrades[id]||0);if(lv>=10){toast("Equipment sudah mencapai level maksimum +10.");return}
 const cost=Math.round((90+lv*85)*TIER_DATA[item.tierIndex].mult);
 if(state.player.coins<cost||state.enhanceStones<1){toast("Butuh "+fmt(cost)+" koin dan 1 Enhancement Stone.");return}
 state.player.coins-=cost;state.enhanceStones--;state.upgrades[id]=lv+1;updateQuest("upgrade",1);updateQuest("spend",cost);
 toast(item.name+" berhasil ditingkatkan ke +"+(lv+1)+".");log("Upgrade berhasil: "+item.name+" +"+(lv+1));save(false);renderInventory();renderShop();
}
function buyItem(id){
 const item=equipmentCatalog[id];if(!item)return;
 if(state.player.level<item.levelReq){toast("Butuh level "+item.levelReq+" untuk membeli item ini.");return}
 if(state.ownedItems.includes(id)){toast("Item ini sudah ada di inventory.");return}
 if(state.player.coins<item.price){toast("Koin belum cukup.");return}
 state.player.coins-=item.price;updateQuest("spend",item.price);addItem(id,"Shop");renderShop();
}
function buySupply(kind){
 const offers={hp:{price:70,field:"potions",name:"HP Potion"},mp:{price:75,field:"manaPotions",name:"Mana Potion"},stone:{price:150,field:"enhanceStones",name:"Enhancement Stone"}};
 const offer=offers[kind];if(!offer)return;
 if(state.player.coins<offer.price){toast("Koin belum cukup.");return}
 state.player.coins-=offer.price;state[offer.field]++;updateQuest("spend",offer.price);toast(offer.name+" dibeli.");save(false);renderShop();
}
function equipItem(id){
 const item=equipmentCatalog[id];if(!item||!state.ownedItems.includes(id))return;
 if(state.player.level<item.levelReq){toast("Butuh level "+item.levelReq+".");return}
 state.equipped[item.type]=id;toast(item.name+" dipakai.");save(false);renderInventory();refreshHud();
}
function buySkin(id){
 const skin=SKINS.find(s=>s.id===id);if(!skin)return;
 if(state.skinsUnlocked.includes(id)){state.skin=id;toast("Skin "+skin.name+" dipakai.");}
 else if(state.player.level<skin.level){toast("Skin ini membutuhkan level "+skin.level+".");return}
 else if(state.player.coins<skin.cost){toast("Koin belum cukup untuk skin ini.");return}
 else{state.player.coins-=skin.cost;updateQuest("spend",skin.cost);state.skinsUnlocked.push(id);state.skin=id;toast("Skin "+skin.name+" berhasil dibuka.");}
 save(false);renderSkins();
}
function switchTab(tab){
 activeTab=tab;
 root.querySelectorAll("[data-ecl-view]").forEach(v=>{const active=v.dataset.eclView===tab;v.hidden=!active;v.classList.toggle("active",active)});
 root.querySelectorAll("[data-ecl-tab]").forEach(b=>{const active=b.dataset.eclTab===tab;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))});
 if(tab==="inventory")renderInventory();if(tab==="skills")renderSkills();if(tab==="shop")renderShop();if(tab==="quests")renderQuests();if(tab==="bosses")renderBosses();if(tab==="codex")renderCodex();if(tab==="skins")renderSkins();
}
function itemCard(item,mode){
 const owned=state.ownedItems.includes(item.id),eq=state.equipped[item.type]===item.id,upgrade=Number(state.upgrades[item.id]||0);
 const stats=Object.entries(item.stats).filter(pair=>pair[1]>0).map(pair=>pair[0].replace("maxHp","HP").replace("maxMp","MP").replace("atk","ATK").replace("def","DEF").replace("crit","CRIT").replace("speed","SPD").replace("dodge","DODGE").replace("regen","REGEN").replace("skillPower","SKILL").replace("block","BLOCK").replace("luck","LUCK")+" +"+(Math.round(pair[1]*10)/10)).join(" · ");
 const sub=item.subTier?'<em class="ecl-subtier">'+item.subTier+'</em>':"";
 let action="";
 if(mode==="shop")action='<button data-ecl-action="buy" data-id="'+item.id+'" '+(owned||state.player.coins<item.price||state.player.level<item.levelReq?"disabled":"")+'> '+(owned?"Sudah dimiliki":"Beli · "+fmt(item.price)+" ◈")+'</button>';
 else action='<div class="ecl-card-actions"><button data-ecl-action="equip" data-id="'+item.id+'" '+(eq||state.player.level<item.levelReq?"disabled":"")+'>'+(eq?"Dipakai":"Pakai")+'</button><button data-ecl-action="upgrade" data-id="'+item.id+'">Upgrade +'+upgrade+'</button></div>';
 return '<article class="ecl-item-card ecl-tier-'+item.anim+(eq?" is-equipped":"")+'" style="--tier:'+item.color+'"><div class="ecl-item-top"><span>'+item.typeLabel+'</span><b>'+ (eq?"EQUIPPED":"+"+upgrade)+'</b></div><h4>'+esc(item.name)+'</h4><div class="ecl-tier-label">'+esc(item.tierName)+sub+'</div><p class="ecl-item-stats">'+esc(stats||"Efek khusus")+'</p><p class="ecl-item-effect"><strong>'+esc(item.effectName)+'</strong> · '+esc(item.effectDesc)+'</p><div class="ecl-item-foot"><small>Lv. '+item.levelReq+' · '+esc(item.typeLabel)+'</small>'+action+'</div></article>';
}
function renderInventory(){
 const equipped=$("eclEquipped"),grid=$("eclInventoryGrid");if(!grid||!equipped)return;
 equipped.innerHTML=TYPE_DATA.map(type=>{
  const item=equipmentCatalog[state.equipped[type.id]];
  return '<div class="ecl-equip-slot"><small>'+type.label+'</small><b>'+(item?esc(item.name):"Kosong")+'</b><span>'+(item?esc(item.tierName):"Belum dipakai")+'</span></div>';
 }).join("");
 const items=state.ownedItems.map(id=>equipmentCatalog[id]).filter(Boolean).sort((a,b)=>b.tierIndex-a.tierIndex||a.id-b.id);
 const pages=Math.max(1,Math.ceil(items.length/12));inventoryPage=Math.min(inventoryPage,pages-1);
 grid.innerHTML=items.slice(inventoryPage*12,inventoryPage*12+12).map(item=>itemCard(item,"inventory")).join("")||'<p class="ecl-empty">Inventory masih kosong.</p>';
 const label=$("eclInventoryPage");if(label)label.textContent=(inventoryPage+1)+" / "+pages+" · "+items.length+" item";
}
function renderSkills(){
 const grid=$("eclSkillsGrid");if(!grid)return;
 const filtered=skillCatalog.filter(skill=>!skillQuery||(skill.name+" "+skill.element+" "+skill.desc).toLowerCase().includes(skillQuery));
 const pages=Math.max(1,Math.ceil(filtered.length/12));skillPage=Math.min(skillPage,pages-1);
 grid.innerHTML=filtered.slice(skillPage*12,skillPage*12+12).map(skill=>{
  const unlocked=state.unlockedSkills.includes(skill.id),equipped=state.skillSlots.includes(skill.id);
  const action=unlocked?'<button data-ecl-action="slot" data-id="'+skill.id+'">'+(equipped?"Terpasang":"Pasang skill")+'</button>':'<button data-ecl-action="unlock" data-id="'+skill.id+'" '+(state.player.level<skill.levelReq||state.player.skillPoints<skill.pointCost?"disabled":"")+'>'+(state.player.skillPoints<skill.pointCost?"Butuh "+skill.pointCost+" SP":"Buka · "+skill.pointCost+" SP")+'</button>';
  return '<article class="ecl-skill-card"><div class="ecl-skill-top"><span>'+esc(skill.element)+'</span><b>RANK '+skill.rank+'</b></div><h4>'+esc(skill.name)+'</h4><p>'+esc(skill.desc)+'</p><div class="ecl-skill-meta"><span>DMG ×'+skill.power.toFixed(2)+'</span><span>MP '+skill.mana+'</span><span>CD '+skill.cool+'s</span></div><small>Level '+skill.levelReq+' · '+(unlocked?"Terbuka":"Belum terbuka")+'</small>'+action+'</article>';
 }).join("")||'<p class="ecl-empty">Skill tidak ditemukan.</p>';
 const label=$("eclSkillsPage");if(label)label.textContent=(skillPage+1)+" / "+pages+" · "+filtered.length+" skill";
 const points=$("eclSkillPoints");if(points)points.textContent=state.player.skillPoints+" Skill Points";
}
function renderShop(){
 const grid=$("eclShopGrid");if(!grid)return;
 const eligible=equipmentCatalog.filter(item=>item.levelReq<=state.player.level+5&&!state.ownedItems.includes(item.id));
 const offers=[];for(let i=0;i<8&&eligible.length;i++)offers.push(eligible[(state.player.level*11+i*7)%eligible.length]);
 grid.innerHTML=offers.map(item=>itemCard(item,"shop")).join("")+
 '<article class="ecl-item-card ecl-supply-card"><div class="ecl-item-top"><span>SUPPLY</span><b>CONSUMABLE</b></div><h4>HP Potion</h4><p>Memulihkan 45% HP maksimum.</p><div class="ecl-item-foot"><small>Dimiliki: '+state.potions+'</small><button data-ecl-action="supply" data-kind="hp">Beli · 70 ◈</button></div></article>'+
 '<article class="ecl-item-card ecl-supply-card"><div class="ecl-item-top"><span>SUPPLY</span><b>CONSUMABLE</b></div><h4>Mana Potion</h4><p>Memulihkan 55% MP maksimum.</p><div class="ecl-item-foot"><small>Dimiliki: '+state.manaPotions+'</small><button data-ecl-action="supply" data-kind="mp">Beli · 75 ◈</button></div></article>'+
 '<article class="ecl-item-card ecl-supply-card"><div class="ecl-item-top"><span>UPGRADE</span><b>MATERIAL</b></div><h4>Enhancement Stone</h4><p>Bahan untuk meningkatkan equipment hingga +10.</p><div class="ecl-item-foot"><small>Dimiliki: '+state.enhanceStones+'</small><button data-ecl-action="supply" data-kind="stone">Beli · 150 ◈</button></div></article>';
 const coin=$("eclShopCoin");if(coin)coin.textContent=fmt(state.player.coins)+" Koin";
}
function renderQuests(){
 const list=$("eclQuestList");if(!list)return;
 ensureQuestPeriods();
 root.querySelectorAll("[data-ecl-period]").forEach(b=>b.classList.toggle("active",b.dataset.eclPeriod===questPeriod));
 const set=state.quests[questPeriod];list.innerHTML=set.items.map(q=>{
  const pct=Math.min(100,q.progress/q.target*100);
  return '<article class="ecl-quest-card '+(q.done?"is-done":"")+'"><div class="ecl-quest-head"><span>'+q.title+'</span><b>'+(q.done?"SELESAI":fmt(q.progress)+" / "+fmt(q.target))+'</b></div><p>'+q.desc+'</p><div class="ecl-quest-track"><i style="width:'+pct+'%"></i></div><small>Hadiah: '+fmt(q.reward)+' koin · '+fmt(q.xp)+' EXP</small></article>';
 }).join("");
 const timer=$("eclQuestTimer");if(timer)timer.textContent="Reset "+({daily:"harian",weekly:"mingguan",monthly:"bulanan"}[questPeriod])+" dalam "+countdown(nextReset(questPeriod)-Date.now());
}
function renderBosses(){
 const grid=$("eclBossGrid");if(!grid)return;
 const filtered=bossCatalog.filter(b=>!bossQuery||(b.name+" "+b.id+" "+b.pattern).toLowerCase().includes(bossQuery));
 const pages=Math.max(1,Math.ceil(filtered.length/12));bossPage=Math.min(bossPage,pages-1);
 grid.innerHTML=filtered.slice(bossPage*12,bossPage*12+12).map(b=>{
  const defeated=b.id<=state.bossProgress,available=b.id===state.bossProgress+1,locked=b.levelReq>state.player.level||(!defeated&&!available);
  return '<article class="ecl-boss-card '+(defeated?"is-defeated":"")+'"><div class="ecl-boss-top"><span>BOSS #'+b.id+'</span><b>'+(defeated?"DEFEATED":locked?"LOCKED":"NEXT")+'</b></div><h4>'+esc(b.name)+'</h4><div class="ecl-boss-stats"><span>HP '+fmt(b.hp)+'</span><span>ATK '+fmt(b.atk)+'</span><span>DEF '+fmt(b.def)+'</span></div><p>Level '+b.levelReq+' · '+esc(b.pattern)+'</p><button data-ecl-action="challenge" data-id="'+b.id+'" '+(locked||defeated?"disabled":"")+'> '+(defeated?"Sudah dikalahkan":locked?"Terkunci":"Tantang Boss")+'</button></article>';
 }).join("")||'<p class="ecl-empty">Boss tidak ditemukan.</p>';
 const label=$("eclBossPage");if(label)label.textContent=(bossPage+1)+" / "+pages+" · "+filtered.length+" boss";
 const progress=$("eclBossProgress");if(progress)progress.textContent=state.bossProgress+" / 900 Boss dikalahkan";
}
function renderCodex(){
 const node=$("eclCodexStats");if(!node)return;
 const tierRows=TIER_DATA.map(t=>'<div><span>'+t.name+'</span><b>'+equipmentCatalog.filter(i=>i.tier===t.id).length+'</b></div>').join("");
 node.innerHTML='<div class="ecl-codex-grid"><div><b>'+state.ownedItems.length+' / 247</b><span>Equipment dimiliki</span></div><div><b>'+state.unlockedSkills.length+' / 600</b><span>Skill terbuka</span></div><div><b>'+state.bossProgress+' / 900</b><span>Boss dikalahkan</span></div><div><b>'+state.kills+'</b><span>Monster dikalahkan</span></div></div><h4>Koleksi equipment</h4><div class="ecl-tier-counts">'+tierRows+'</div><p class="ecl-lore">Catatan: 13 item terakhir pada kategori Langka memiliki sub-rank Sangat Langka. Efek visual Mewah diterapkan pada item tingkat tinggi.</p>';
}
function renderSkins(){
 const grid=$("eclSkinGrid");if(!grid)return;
 grid.innerHTML=SKINS.map(skin=>{
  const unlocked=state.skinsUnlocked.includes(skin.id),active=state.skin===skin.id;
  return '<article class="ecl-skin-card '+(active?"is-active":"")+'" style="--skin:'+skin.glow+'"><div class="ecl-skin-preview"><i style="--body:'+skin.body+';--cape:'+skin.cape+'"></i></div><h4>'+skin.name+'</h4><small>Level '+skin.level+' · '+(unlocked?"Terbuka":fmt(skin.cost)+" koin")+'</small><button data-ecl-action="skin" data-id="'+skin.id+'">'+(active?"Dipakai":unlocked?"Pakai":"Buka Skin")+'</button></article>';
 }).join("");
}
function countdown(ms){
 let s=Math.max(0,Math.floor(ms/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;
 return (d?d+"h ":"")+String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}
function updateQuestTimer(){
 ensureQuestPeriods();
 const node=$("eclQuestTimer");if(node)node.textContent="Reset "+({daily:"harian",weekly:"mingguan",monthly:"bulanan"}[questPeriod])+" dalam "+countdown(nextReset(questPeriod)-Date.now());
}
function nearestObject(){
 let nearest=null,best=120;objects.forEach(o=>{const d=Math.hypot(o.x-player.x,o.y-player.y);if(d<best){best=d;nearest=o}});
 const hint=$("eclInteractHint");if(hint){hint.hidden=!nearest;hint.textContent=nearest?"E · "+nearest.label:"WASD untuk bergerak · E untuk interaksi";}
}
function update(dt){
 const stats=getStats();
 let dx=(input.right?1:0)-(input.left?1:0),dy=(input.down?1:0)-(input.up?1:0);
 const len=Math.hypot(dx,dy)||1;if(dx||dy){dx/=len;dy/=len;player.faceX=dx;player.faceY=dy;}
 player.slow=Math.max(0,player.slow-dt);
 const speed=stats.speed*(player.buff>0?1.18:1)*(player.slow>0?.5:1);
 const nx=Math.max(28,Math.min(world.w-28,player.x+dx*speed*dt)),ny=Math.max(32,Math.min(world.h-32,player.y+dy*speed*dt));
 player.x=nx;player.y=ny;
 player.attackCd=Math.max(0,player.attackCd-dt);player.dodge=Math.max(0,player.dodge-dt);player.invuln=Math.max(0,player.invuln-dt);
 player.shield=Math.max(0,player.shield-dt);player.buff=Math.max(0,player.buff-dt);player.summon=Math.max(0,player.summon-dt);
 player.regen+=dt;if(player.regen>1){player.regen=0;if(stats.regen>0)state.player.hp=Math.min(stats.maxHp,state.player.hp+stats.regen);}
 Object.keys(skillCooldowns).forEach(id=>skillCooldowns[id]=Math.max(0,skillCooldowns[id]-dt*(hasEffect("echo")?1.12:1)));
 enemies.forEach(e=>{
  if(e.dead)return;e.cd=Math.max(0,e.cd-dt);e.slow=Math.max(0,(e.slow||0)-dt);e.stun=Math.max(0,(e.stun||0)-dt);
  if(e.burn>0){e.burn-=dt;e.hp-=Math.max(1,(e.burnDamage||2)*dt);if(e.hp<=0){killEnemy(e);return}}
  const d=Math.hypot(player.x-e.x,player.y-e.y);
  if(d<330&&e.stun<=0&&d>35){const sp=e.speed*(e.slow>0?.45:1);e.x+=(player.x-e.x)/d*sp*dt;e.y+=(player.y-e.y)/d*sp*dt;}
  if(d<42&&e.cd<=0){e.cd=1.45;damagePlayer(e.atk);}
 });
 if(bossActive&&boss){
  boss.attackCd=Math.max(0,boss.attackCd-dt);const telegraphWasActive=boss.telegraph>0;if(telegraphWasActive)boss.telegraph=Math.max(0,boss.telegraph-dt);boss.slow=Math.max(0,boss.slow-dt);boss.stun=Math.max(0,boss.stun-dt);
  if(boss.burn>0){boss.burn-=dt;boss.hp=Math.max(0,boss.hp-(boss.burnDamage||2)*dt);if(boss.hp<=0){defeatBoss();return}}
  const d=Math.hypot(player.x-boss.x,player.y-boss.y);
  if(boss.stun<=0&&d>90){const sp=boss.speed*(boss.slow>0?.4:1);boss.x+=(player.x-boss.x)/d*sp*dt;boss.y+=(player.y-boss.y)/d*sp*dt;}
  if(telegraphWasActive&&boss.telegraph===0){
   const pattern=boss.pattern;
   const ranges={"Cleave":120,"Shadow Dash":260,"Rune Burst":210,"Earthquake":210,"Soul Drain":185,"Meteor Rain":250,"Void Beam":330,"Frost Prison":165,"Summon Adds":185,"Twin Strike":135,"Gravity Well":245,"Eclipse Pulse":300};
   const multipliers={"Earthquake":1.5,"Meteor Rain":1.5,"Void Beam":1.35,"Twin Strike":.82,"Gravity Well":1.15,"Eclipse Pulse":1.8};
   const range=ranges[pattern]||120,mult=multipliers[pattern]||1;
   if(d<range)damagePlayer(boss.atk*mult);
   if(pattern==="Twin Strike"&&d<range)damagePlayer(boss.atk*.72);
   if(pattern==="Shadow Dash"&&d<330){boss.x=player.x-boss.x<0?player.x+100:player.x-100;boss.y=player.y;}
   if(pattern==="Soul Drain"&&d<range&&!(input.block||player.shield>0))boss.hp=Math.min(boss.maxHp,boss.hp+Math.round(boss.maxHp*.015));
   if(pattern==="Frost Prison"&&d<range)player.slow=2.2;
   if(pattern==="Gravity Well"&&d<range){const pull=Math.max(0,1-d/range);player.x+=(boss.x-player.x)*pull*.22;player.y+=(boss.y-player.y)*pull*.22;}
   if(pattern==="Summon Adds"){
    enemies.push({id:10000+Math.floor(Math.random()*100000),name:"Eclipse Wisp",x:boss.x+70,y:boss.y+45,hp:24+boss.id*2,maxHp:24+boss.id*2,atk:Math.max(4,boss.atk*.35),def:Math.max(1,boss.def*.2),speed:62,cd:0,dead:false,color:"#bb8cff"});
   }
   spawnParticles(boss.x,boss.y,"#ff718c",25);boss.attackCd=2.5+Math.random()*1.2;
  }
  if(!boss.telegraph&&boss.attackCd<=0){boss.telegraph=.85;log(boss.name+" menyiapkan "+boss.pattern+".");}
 }
 particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);
 nearestObject();refreshHud();
}
function drawGround(camX,camY){
 ctx.fillStyle="#173b32";ctx.fillRect(0,0,960,540);
 const tile=48,startX=Math.floor(camX/tile),startY=Math.floor(camY/tile);
 for(let y=startY;y<startY+13;y++)for(let x=startX;x<startX+22;x++){
  const sx=x*tile-camX,sy=y*tile-camY;
  const shade=((x*17+y*31)%9);
  ctx.fillStyle=shade<3?"#1c4738":shade<6?"#204b3b":"#1a4235";ctx.fillRect(sx,sy,tile,tile);
  if((x*3+y*7)%11===0){ctx.fillStyle="#3e7650";ctx.fillRect(sx+12,sy+13,3,3);ctx.fillRect(sx+33,sy+31,2,2);}
 }
 ctx.fillStyle="#46513e";ctx.fillRect(-camX,390-camY,world.w,84);
 ctx.fillStyle="#566044";ctx.fillRect(0,392-camY,world.w,5);
 ctx.fillStyle="#344b3d";ctx.fillRect(820-camX,0,74,world.h);
 ctx.fillStyle="#3f5a46";ctx.fillRect(823-camX,0,4,world.h);
}
function drawTree(o,camX,camY){
 const x=o.x-camX,y=o.y-camY,s=o.size;
 ctx.fillStyle="#0b211d";ctx.fillRect(x-s*.18,y-s*.05,s*.36,s*.75);
 ctx.fillStyle=o.kind==="pine"?"#24594b":"#2b664b";ctx.beginPath();ctx.arc(x,y-s*.25,s,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#367a55";ctx.beginPath();ctx.arc(x-s*.25,y-s*.43,s*.52,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#498c5c";ctx.fillRect(x-s*.32,y-s*.52,5,4);
}
function drawObject(o,camX,camY){
 const x=o.x-camX,y=o.y-camY;
 ctx.save();ctx.shadowBlur=o.id==="portal"?24:10;ctx.shadowColor=o.id==="portal"?"#b17cff":"#79e2dc";
 if(o.id==="portal"){ctx.strokeStyle="#a77dff";ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(x,y,34,48,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="#58d5ed";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,23,38,0,0,Math.PI*2);ctx.stroke();}
 else if(o.id==="chest"){ctx.fillStyle="#9a6838";ctx.fillRect(x-20,y-13,40,28);ctx.fillStyle="#e4b866";ctx.fillRect(x-20,y-14,40,7);ctx.fillRect(x-3,y-8,6,12);}
 else if(o.id==="rune"||o.id==="obelisk"){ctx.fillStyle="#526d91";ctx.fillRect(x-10,y-26,20,52);ctx.fillStyle="#9be7f3";ctx.fillRect(x-5,y-17,10,3);ctx.fillRect(x-3,y-7,6,3);}
 else{ctx.fillStyle="#c69b68";ctx.fillRect(x-12,y-25,24,35);ctx.fillStyle="#e9c98b";ctx.fillRect(x-18,y-29,36,7);}
 ctx.restore();
}
function drawEnemy(e,camX,camY){
 const x=e.x-camX,y=e.y-camY;
 ctx.fillStyle="#091510";ctx.beginPath();ctx.ellipse(x,y+14,18,7,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#f5fbff";ctx.fillRect(x-6,y-3,4,4);ctx.fillRect(x+3,y-3,4,4);
 ctx.fillStyle="#121a22";ctx.fillRect(x-20,y-25,40,4);ctx.fillStyle="#ff7d87";ctx.fillRect(x-20,y-25,40*Math.max(0,e.hp/e.maxHp),4);
}
function drawBoss(camX,camY){
 if(!bossActive||!boss)return;
 const x=boss.x-camX,y=boss.y-camY;
 ctx.save();ctx.shadowColor="#bb78ff";ctx.shadowBlur=26;
 ctx.fillStyle="#281c46";ctx.beginPath();ctx.ellipse(x,y+23,43,16,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#59418a";ctx.fillRect(x-30,y-35,60,58);ctx.fillStyle="#a989ec";ctx.fillRect(x-24,y-52,48,28);
 ctx.fillStyle="#ffb6d7";ctx.fillRect(x-15,y-43,7,5);ctx.fillRect(x+8,y-43,7,5);
 ctx.fillStyle="#e7c7ff";ctx.fillRect(x-37,y-57,14,18);ctx.fillRect(x+23,y-57,14,18);
 if(boss.telegraph>0){ctx.strokeStyle="#ff728e";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,82,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
function drawPlayer(camX,camY){
 const x=player.x-camX,y=player.y-camY,skin=SKINS.find(s=>s.id===state.skin)||SKINS[0];
 const best=equippedItems().reduce((m,i)=>Math.max(m,i.tierIndex),0),tier=TIER_DATA[best];
 ctx.save();
 if(best>=3){ctx.shadowColor=tier.color;ctx.shadowBlur=best>=6?28:16;}
 ctx.fillStyle="#0b1720";ctx.beginPath();ctx.ellipse(x,y+15,17,7,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=skin.cape;ctx.fillRect(x-10,y-5,20,23);ctx.fillStyle=skin.body;ctx.fillRect(x-9,y-15,18,22);
 ctx.fillStyle="#f4d6b5";ctx.fillRect(x-7,y-28,14,14);ctx.fillStyle="#23344c";ctx.fillRect(x-8,y-31,16,6);
 ctx.fillStyle="#eaf5ff";ctx.fillRect(x+player.faceX*12-2,y+player.faceY*12-2,4,4);
 ctx.strokeStyle=tier.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+player.faceX*9,y+player.faceY*9);ctx.lineTo(x+player.faceX*28-player.faceY*8,y+player.faceY*28+player.faceX*8);ctx.stroke();
 if(best>=4){ctx.globalAlpha=.75;ctx.strokeStyle=tier.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,28+Math.sin(performance.now()/220)*3,0,Math.PI*2);ctx.stroke();}
 if(player.invuln>0){ctx.globalAlpha=.5;ctx.strokeStyle="#b8f5ff";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,33,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
function render(){
 if(!ctx)return;
 const w=canvas.width,h=canvas.height;ctx.setTransform(w/960,0,0,h/540,0,0);ctx.imageSmoothingEnabled=false;
 const camX=Math.max(0,Math.min(world.w-960,player.x-480)),camY=Math.max(0,Math.min(world.h-540,player.y-270));
 drawGround(camX,camY);
 decor.forEach(o=>{if(o.x>camX-60&&o.x<camX+1020&&o.y>camY-60&&o.y<camY+600)drawTree(o,camX,camY)});
 objects.forEach(o=>drawObject(o,camX,camY));
 enemies.forEach(e=>{if(!e.dead)drawEnemy(e,camX,camY)});
 drawBoss(camX,camY);drawPlayer(camX,camY);
 particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x-camX,p.y-camY,p.size,p.size)});ctx.globalAlpha=1;
 ctx.fillStyle="rgba(5,10,20,.56)";ctx.fillRect(14,14,205,36);ctx.fillStyle="#e6f3ff";ctx.font="bold 13px system-ui";ctx.fillText("MISTWOOD  ·  ZONA 01",26,37);
 ctx.fillStyle="rgba(5,10,20,.5)";ctx.fillRect(760,14,186,36);ctx.fillStyle="#b5c8e2";ctx.font="11px system-ui";ctx.fillText("X "+Math.round(player.x)+"  ·  Y "+Math.round(player.y),774,37);
}
function resizeCanvas(){
 if(!canvas||!ctx)return;
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
 canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
}
function frame(ts){
 if(!running)return;
 const dt=Math.min(.04,(ts-lastFrame)/1000||.016);lastFrame=ts;update(dt);render();raf=requestAnimationFrame(frame);
}
function isVisible(){return root.classList.contains("active")&&!root.hidden}
function syncGame(){
 if(isVisible()&&!running){running=true;lastFrame=performance.now();resizeCanvas();raf=requestAnimationFrame(frame);}
 else if(!isVisible()&&running){running=false;cancelAnimationFrame(raf);input.up=input.down=input.left=input.right=input.block=false;save(false);}
}
function renderAll(){
 refreshHud();renderInventory();renderSkills();renderShop();renderQuests();renderBosses();renderCodex();renderSkins();
}
function syncAccountSave(){
 const nextKey=accountSaveKey();if(nextKey===activeSaveKey)return;
 save(false);activeSaveKey=nextKey;state=loadState();ensureQuestPeriods();renderAll();
 toast(window.aryanzzAuthUser?"Progress game untuk akun ini dimuat.":"Progress mode tamu dimuat.");
}
window.addEventListener("aryanzz:auth-changed",syncAccountSave);
root.addEventListener("click",event=>{
 const tab=event.target.closest("[data-ecl-tab]");if(tab){switchTab(tab.dataset.eclTab);return}
 const period=event.target.closest("[data-ecl-period]");if(period){questPeriod=period.dataset.eclPeriod;renderQuests();return}
 const rune=event.target.closest("[data-ecl-rune]");if(rune){chooseRune(rune.dataset.eclRune);return}
 const action=event.target.closest("[data-ecl-action]");if(action){
  const id=Number(action.dataset.id),kind=action.dataset.eclAction;
  if(kind==="equip")equipItem(id);if(kind==="upgrade")upgradeItem(id);if(kind==="buy")buyItem(id);
  if(kind==="supply")buySupply(action.dataset.kind);if(kind==="unlock"){
   const skill=skillCatalog[id];if(skill&&state.player.level>=skill.levelReq&&state.player.skillPoints>=skill.pointCost&&!state.unlockedSkills.includes(id)){
    state.player.skillPoints-=skill.pointCost;state.unlockedSkills.push(id);toast("Skill "+skill.name+" terbuka.");save(false);renderSkills();
   }
  }
  if(kind==="slot"){
   const slot=state.skillSlots.indexOf(id);
   if(slot>=0){state.skillSlots[slot]=null;toast("Skill dilepas dari slot "+(slot+1)+".");}
   else{const empty=state.skillSlots.findIndex(x=>x===null||x===undefined);if(empty<0){toast("Semua slot skill terisi. Lepas satu skill dahulu.");return}state.skillSlots[empty]=id;toast("Skill dipasang di slot "+(empty+1)+".");}
   save(false);renderSkills();
  }
  if(kind==="challenge")startBoss(id);if(kind==="skin")buySkin(action.dataset.id);
  return;
 }
 const cast=event.target.closest("[data-ecl-cast]");if(cast){castSkill(Number(cast.dataset.eclCast));return}
 const act=event.target.closest("[data-ecl-action-button]");if(act){const a=act.dataset.eclActionButton;if(a==="attack")attack();if(a==="dodge")dodge();if(a==="interact")interact();if(a==="hp")usePotion("hp");if(a==="mp")usePotion("mp");}
});
function dodge(){
 if(player.dodge>0)return;player.dodge=.65;player.invuln=.48;
 player.x=Math.max(28,Math.min(world.w-28,player.x+player.faceX*105));player.y=Math.max(32,Math.min(world.h-32,player.y+player.faceY*105));
 spawnParticles(player.x,player.y,"#85dfff",12);
}
root.querySelectorAll("[data-ecl-hold]").forEach(button=>{
 const key=button.dataset.eclHold;
 const down=e=>{e.preventDefault();input[key]=true;button.classList.add("pressed")};
 const up=()=>{input[key]=false;button.classList.remove("pressed")};
 button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointerleave",up);button.addEventListener("pointercancel",up);
});
const blockButton=$("eclBlockButton");
if(blockButton){
 blockButton.addEventListener("pointerdown",e=>{e.preventDefault();input.block=true;blockButton.classList.add("pressed")});
 ["pointerup","pointerleave","pointercancel"].forEach(name=>blockButton.addEventListener(name,()=>{input.block=false;blockButton.classList.remove("pressed")}));
}
document.addEventListener("keydown",event=>{
 if(!isVisible()||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
 const k=event.key.toLowerCase();
 if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))event.preventDefault();
 if(k==="w"||k==="arrowup")input.up=true;if(k==="s"||k==="arrowdown")input.down=true;
 if(k==="a"||k==="arrowleft")input.left=true;if(k==="d"||k==="arrowright")input.right=true;
 if(k==="q")input.block=true;
 if(k===" "||k==="j")attack();if(k==="shift")dodge();if(k==="e")interact();
 if(["1","2","3","4"].includes(k))castSkill(Number(k)-1);
});
document.addEventListener("keyup",event=>{
 const k=event.key.toLowerCase();
 if(k==="w"||k==="arrowup")input.up=false;if(k==="s"||k==="arrowdown")input.down=false;
 if(k==="a"||k==="arrowleft")input.left=false;if(k==="d"||k==="arrowright")input.right=false;
 if(k==="q")input.block=false;
});
const back=$("eclBackHome");if(back)back.addEventListener("click",()=>{running=false;cancelAnimationFrame(raf);});
const saveBtn=$("eclSave");if(saveBtn)saveBtn.addEventListener("click",()=>save(true));
const exportBtn=$("eclExport");if(exportBtn)exportBtn.addEventListener("click",()=>{
 const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="aryanzz-eclipse-save.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast("File save berhasil diekspor.");
});
const importInput=$("eclImportFile");if(importInput)importInput.addEventListener("change",async()=>{
 const file=importInput.files&&importInput.files[0];if(!file)return;
 try{const data=JSON.parse(await file.text());if(!data||!data.player||!Array.isArray(data.ownedItems))throw new Error("Format save tidak valid.");
  localStorage.setItem(activeSaveKey,JSON.stringify(data));state=loadState();ensureQuestPeriods();renderAll();toast("Save berhasil dipulihkan.");
 }catch(error){toast(error.message||"File save tidak dapat dibaca.");}finally{importInput.value="";}
});
const skillSearch=$("eclSkillSearch");if(skillSearch)skillSearch.addEventListener("input",()=>{skillQuery=skillSearch.value.toLowerCase().trim();skillPage=0;renderSkills()});
const bossSearch=$("eclBossSearch");if(bossSearch)bossSearch.addEventListener("input",()=>{bossQuery=bossSearch.value.toLowerCase().trim();bossPage=0;renderBosses()});
const bindPage=(id,fn)=>{const b=$(id);if(b)b.addEventListener("click",fn)};
bindPage("eclInventoryPrev",()=>{inventoryPage=Math.max(0,inventoryPage-1);renderInventory()});
bindPage("eclInventoryNext",()=>{inventoryPage++;renderInventory()});
bindPage("eclSkillsPrev",()=>{skillPage=Math.max(0,skillPage-1);renderSkills()});
bindPage("eclSkillsNext",()=>{skillPage++;renderSkills()});
bindPage("eclBossPrev",()=>{bossPage=Math.max(0,bossPage-1);renderBosses()});
bindPage("eclBossNext",()=>{bossPage++;renderBosses()});
bindPage("eclPuzzleClose",closePuzzle);
bindPage("eclPotionHp",()=>usePotion("hp"));
bindPage("eclPotionMp",()=>usePotion("mp"));
bindPage("eclAttackButton",attack);
bindPage("eclDodgeButton",dodge);
bindPage("eclInteractButton",interact);
const observer=new MutationObserver(syncGame);observer.observe(root,{attributes:true,attributeFilter:["class","hidden"]});
window.addEventListener("resize",resizeCanvas);
window.addEventListener("pagehide",()=>{running=false;save(false)});
setInterval(()=>{ensureQuestPeriods();updateQuestTimer();if(activeTab==="quests")renderQuests();save(false)},10000);
setInterval(updateQuestTimer,1000);
renderAll();switchTab("adventure");updateQuestTimer();refreshHud();
log("Selamat datang di Mistwood. Temukan rune, kumpulkan koin, dan hadapi penjaga gerbang.");
window.ARYANZZ_ECLIPSE_RPG=Object.freeze({equipmentCount:equipmentCatalog.length,skillCount:skillCatalog.length,bossCount:bossCatalog.length,save:()=>save(true)});
})();