import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const API_TOKEN = process.env.PLATFORM_API_TOKEN || "";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(x => x.trim());
const TEMP = path.join(os.tmpdir(), "aryanzz-downloads");
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_DURATION = 3 * 60 * 60;
mkdirSync(TEMP, { recursive: true });

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin(origin, cb) {
  if (!origin || ORIGINS.includes("*") || ORIGINS.includes(origin)) return cb(null, true);
  return cb(new Error("Origin tidak diizinkan"));
} }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false }));

const ALLOWED = ["youtube.com","youtu.be","youtube-nocookie.com","tiktok.com","instagram.com","threads.net","facebook.com","fb.watch","pinterest.com","pin.it","x.com","twitter.com","reddit.com","redd.it","vimeo.com","dailymotion.com","dai.ly","soundcloud.com","twitch.tv","streamable.com","tumblr.com","bilibili.com","b23.tv","vk.com","ok.ru","rutube.ru","likee.video","snapchat.com","imgur.com","bandcamp.com","mixcloud.com","ted.com","archive.org","loom.com","rumble.com","odysee.com","weibo.com","xiaohongshu.com"];
function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("URL tidak valid."); }
  if (!["http:","https:"].includes(u.protocol)) throw new Error("Hanya URL HTTP/HTTPS yang diizinkan.");
  const host = u.hostname.toLowerCase();
  if (!ALLOWED.some(d => host === d || host.endsWith("." + d))) throw new Error("Domain belum didukung untuk ekstraksi platform.");
  if (u.username || u.password) throw new Error("URL dengan kredensial tidak diizinkan.");
  return u.href;
}
function run(args, timeout = 180000) {
  return new Promise((resolve,reject) => {
    const child = spawn(YTDLP,args,{stdio:["ignore","pipe","pipe"]});
    let stdout="",stderr="",done=false;
    const timer=setTimeout(()=>{child.kill("SIGKILL");finish(new Error("Waktu proses habis. Coba kualitas lebih rendah."));},timeout);
    function finish(err,val){if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(val);}
    child.stdout.on("data",d=>{stdout+=d.toString();if(stdout.length>4_000_000){child.kill("SIGKILL");finish(new Error("Metadata terlalu besar."));}});
    child.stderr.on("data",d=>{stderr+=d.toString();if(stderr.length>24000)stderr=stderr.slice(-24000);});
    child.on("error",()=>finish(new Error("yt-dlp tidak tersedia pada server.")));
    child.on("close",code=>code===0?finish(null,stdout):finish(new Error(stderr.trim().split("\n").slice(-3).join(" ").slice(-900)||"Proses media gagal.")));
  });
}
function cleanTitle(s){return String(s||"aryanzz-media").replace(/[\\/:*?"<>|\r\n]+/g,"_").slice(0,100);}
function qualityHeight(q){const n=Number(q);return [360,480,720,1080,1440,2160].includes(n)?n:720;}

function runBinary(command,args,timeout=45000){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:["ignore","pipe","pipe"]});
    const chunks=[];let size=0,stderr="",done=false;
    const timer=setTimeout(()=>{child.kill("SIGKILL");finish(new Error("Waktu ekstraksi audio habis."));},timeout);
    function finish(error,value){if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);}
    child.stdout.on("data",chunk=>{size+=chunk.length;if(size>20*1024*1024){child.kill("SIGKILL");finish(new Error("Sampel audio terlalu besar."));return;}chunks.push(chunk);});
    child.stderr.on("data",chunk=>{stderr=(stderr+chunk.toString()).slice(-5000);});
    child.on("error",()=>finish(new Error(command+" tidak tersedia pada container.")));
    child.on("close",code=>code===0?finish(null,Buffer.concat(chunks)):finish(new Error(stderr.trim().split("\n").slice(-3).join(" ").slice(0,700)||command+" gagal.")));
  });
}
function runShazamPayload(payload,timeout=60000){
  return new Promise((resolve,reject)=>{
    const script=path.join(process.cwd(),"server","shazam_recognize.py");
    const child=spawn("python3",[script],{stdio:["pipe","pipe","pipe"]});
    let stdout="",stderr="",done=false;
    const timer=setTimeout(()=>{child.kill("SIGKILL");finish(new Error("Shazam tidak merespons tepat waktu."));},timeout);
    function finish(error,value){if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);}
    child.stdout.on("data",chunk=>{stdout+=chunk.toString();if(stdout.length>2_000_000){child.kill("SIGKILL");finish(new Error("Respons Shazam terlalu besar."));}});
    child.stderr.on("data",chunk=>{stderr=(stderr+chunk.toString()).slice(-5000);});
    child.on("error",()=>finish(new Error("Python/ShazamIO tidak tersedia pada container.")));
    child.on("close",code=>{
      if(code!==0){finish(new Error(stderr.trim().slice(-700)||"Shazam gagal memproses audio."));return;}
      try{
        const data=JSON.parse(stdout);
        if(!data.ok)finish(new Error(data.error||"Shazam tidak dapat mengenali audio."));
        else finish(null,data);
      }catch{finish(new Error("Respons Shazam tidak valid."));}
    });
    child.stdin.on("error",()=>{});
    child.stdin.end(JSON.stringify(payload));
  });
}
function formatOffset(seconds){
  const n=Math.max(0,Math.floor(Number(seconds)||0));
  return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
}
async function identifyShazamBuffer(buffer){
  if(!Buffer.isBuffer(buffer)||!buffer.length)throw new Error("Sampel audio kosong.");
  return runShazamPayload({audio:buffer.toString("base64")},45000);
}
async function scanShazamMedia(inputPath,skip,every,limit){
  const durationBuffer=await runBinary("ffprobe",["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",inputPath],30000);
  const duration=Number(durationBuffer.toString().trim());
  if(!Number.isFinite(duration)||duration<=0)throw new Error("Durasi video/audio tidak dapat dibaca.");
  if(duration>MAX_DURATION)throw new Error("Durasi media melebihi batas 3 jam.");
  const interval=Math.max(12,(skip+1)*12);
  const consecutive=Math.max(1,Math.min(3,every));
  const cap=Math.min(30,Math.max(1,limit));
  const samples=[];
  for(let base=0;base<duration&&samples.length<cap;base+=interval*consecutive){
    for(let j=0;j<consecutive&&samples.length<cap;j++){
      const offset=base+j*12;
      if(offset>=duration)break;
      const audio=await runBinary("ffmpeg",["-hide_banner","-loglevel","error","-ss",String(offset),"-i",inputPath,"-t","12","-vn","-ac","1","-ar","16000","-f","mp3","pipe:1"],35000);
      if(audio.length)samples.push({offset:formatOffset(offset),audio:audio.toString("base64")});
    }
  }
  if(!samples.length)throw new Error("Tidak ada segmen audio yang bisa dipindai.");
  const result=await runShazamPayload({samples},240000);
  return {...result,provider:"Shazam",scannedChunks:samples.length};
}

app.get("/ping",(_req,res)=>res.status(200).send("ok"));
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"ARYANZZ Self-Hosted Downloader",version:"67.7",engine:"yt-dlp + FFmpeg + ShazamIO",maxFileMB:500,maxDurationMinutes:180,platforms:ALLOWED,features:["platform-info","title-search","mp4","mp3","quality-select","progress-stream","shazam-fallback","dj-mix-scan"]}));
function requirePlatformToken(req,res,next){
  if(process.env.CONTAINER_INTERNAL_MODE==="true")return next();
  const supplied=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!API_TOKEN)return res.status(503).json({error:"PLATFORM_API_TOKEN belum dikonfigurasi pada backend."});
  const a=Buffer.from(supplied),b=Buffer.from(API_TOKEN);
  if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({error:"Token backend tidak valid."});
  next();
}

app.post("/api/search",requirePlatformToken,async(req,res)=>{
  try{
    const query=String(req.body?.query||"").replace(/\s+/g," ").trim();
    if(query.length<2)return res.status(400).json({error:"Masukkan minimal 2 karakter untuk mencari judul video."});
    if(query.length>160)return res.status(400).json({error:"Judul pencarian maksimal 160 karakter."});
    const raw=await run(["--dump-single-json","--flat-playlist","--no-warnings","--skip-download","ytsearch8:"+query],90000);
    const data=JSON.parse(raw);
    const entries=Array.isArray(data.entries)?data.entries:[];
    const results=entries.filter(item=>item&&item.id&&item.title).slice(0,8).map(item=>{
      const videoUrl=typeof item.webpage_url==="string"&&item.webpage_url.startsWith("https://www.youtube.com/")?item.webpage_url:"https://www.youtube.com/watch?v="+encodeURIComponent(String(item.id));
      const thumbs=Array.isArray(item.thumbnails)?item.thumbnails:[];
      const thumbnail=item.thumbnail||thumbs.slice().reverse().find(x=>typeof x?.url==="string"&&x.url.startsWith("https://"))?.url||null;
      return {id:String(item.id).slice(0,80),title:String(item.title).slice(0,300),channel:String(item.channel||item.uploader||"").slice(0,180),duration:Number.isFinite(Number(item.duration))?Number(item.duration):null,thumbnail, url:videoUrl};
    });
    res.json({ok:true,query,results});
  }catch(error){res.status(502).json({error:error.message||"Pencarian judul gagal. Coba kata kunci lain."});}
});

app.post("/api/info",requirePlatformToken,async(req,res)=>{
  try {
    const url=validateUrl(req.body?.url);
    const raw=await run(["--dump-single-json","--no-warnings","--no-playlist","--skip-download",url],90000);
    const info=JSON.parse(raw);
    const heights=[...new Set((info.formats||[]).filter(f=>f.vcodec&&f.vcodec!=="none"&&f.height).map(f=>f.height))].sort((a,b)=>a-b);
    res.json({
      title:info.title||"Media",
      extractor:info.extractor_key||info.extractor||"Media",
      duration:info.duration||null,
      thumbnail:info.thumbnail||null,
      webpage_url:info.webpage_url||url,
      formats:heights.filter(h=>h<=2160).map(height=>({height,label:height+"p"}))
    });
  } catch(e){res.status(400).json({error:e.message});}
});
app.post("/api/download",requirePlatformToken,async(req,res)=>{
  let output;
  try {
    const url=validateUrl(req.body?.url);
    const mode=req.body?.mode==="audio"?"audio":"video";
    const height=qualityHeight(req.body?.quality);
    const id=randomUUID();
    output=path.join(TEMP,id+(mode==="audio"?".mp3":".mp4"));
    const args=mode==="audio"
      ? ["--no-warnings","--no-playlist","--max-filesize",String(MAX_FILE_BYTES),"--match-filter",`duration <= ${MAX_DURATION}`,"-x","--audio-format","mp3","--audio-quality","0","-o",output,url]
      : ["--no-warnings","--no-playlist","--max-filesize",String(MAX_FILE_BYTES),"--match-filter",`duration <= ${MAX_DURATION}`,"-f",`bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/b[height<=${height}][ext=mp4]/best[height<=${height}]`,"--merge-output-format","mp4","-o",output,url];
    await run(args,240000);
    if(!existsSync(output))throw new Error("File hasil tidak ditemukan.");
    const size=statSync(output).size;
    if(size>MAX_FILE_BYTES)throw new Error("File melebihi batas 100 MB.");
    const filename=cleanTitle(mode==="audio"?"aryanzz-audio.mp3":"aryanzz-video-"+height+"p.mp4");
    res.download(output,filename,()=>{try{if(existsSync(output))unlinkSync(output);}catch{}});
  } catch(e){
    try{if(output&&existsSync(output))unlinkSync(output);}catch{}
    if(!res.headersSent)res.status(400).json({error:e.message});
  }
});

app.post("/api/music/sample",requirePlatformToken,async(req,res)=>{
  let output;
  try{
    const url=validateUrl(req.body?.url);
    const start=Number(req.body?.startSeconds??0),duration=12;
    if(!Number.isFinite(start)||start<0||start>MAX_DURATION-duration)
      return res.status(400).json({error:"Posisi cuplikan video tidak valid."});
    const id=randomUUID();output=path.join(TEMP,id+".mp3");
    const args=["--no-warnings","--no-playlist","--max-filesize",String(MAX_FILE_BYTES),
      "--download-sections","*"+start+"-"+(start+duration),"--force-keyframes-at-cuts",
      "-x","--audio-format","mp3","--audio-quality","5","-o",output,url];
    await run(args,240000);
    if(!existsSync(output))throw new Error("Cuplikan audio tidak ditemukan. Pastikan video publik dan memiliki suara.");
    const size=statSync(output).size;
    if(!size)throw new Error("Cuplikan audio kosong.");
    if(size>10*1024*1024)throw new Error("Cuplikan audio melebihi batas 10 MB.");
    res.setHeader("Cache-Control","no-store");
    res.download(output,"aryanzz-music-sample.mp3",()=>{
      try{if(output&&existsSync(output))unlinkSync(output);}catch{}
    });
  }catch(e){
    try{if(output&&existsSync(output))unlinkSync(output);}catch{}
    if(!res.headersSent)res.status(400).json({error:e.message||"Gagal mengekstrak cuplikan audio."});
  }
});

app.post("/api/music/recognize",requirePlatformToken,express.raw({type:"application/octet-stream",limit:"10mb"}),async(req,res)=>{
  try{
    if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({ok:false,error:"Sampel audio kosong."});
    const result=await identifyShazamBuffer(req.body);
    res.json(result);
  }catch(error){res.status(502).json({ok:false,error:error.message||"Shazam gagal mengenali audio."});}
});
app.post("/api/music/scan",requirePlatformToken,express.raw({type:"application/octet-stream",limit:"50mb"}),async(req,res)=>{
  let inputPath;
  try{
    const skip=Number(req.headers["x-scan-skip"]??4);
    const every=Number(req.headers["x-scan-every"]??1);
    const limit=Number(req.headers["x-scan-limit"]??30);
    if(!Number.isInteger(skip)||skip<0||skip>29||!Number.isInteger(every)||every<1||every>3||!Number.isInteger(limit)||limit<1||limit>100)
      return res.status(400).json({ok:false,error:"Pengaturan interval pemindaian tidak valid."});
    if((req.headers["content-type"]||"").includes("application/json")){
      const url=validateUrl(req.body?.url);
      const id=randomUUID();inputPath=path.join(TEMP,id+".mp3");
      await run(["--no-warnings","--no-playlist","--max-filesize",String(MAX_FILE_BYTES),"--match-filter","duration <= "+MAX_DURATION,"-x","--audio-format","mp3","--audio-quality","5","-o",inputPath,url],240000);
    }else{
      if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({ok:false,error:"File video/audio kosong."});
      const rawName=String(req.headers["x-media-filename"]||"scan.mp4");
      const ext=(rawName.split(".").pop()||"mp4").toLowerCase().replace(/[^a-z0-9]/g,"");
      const allowed=new Set(["mp4","mov","m4v","webm","mkv","avi","mp3","m4a","aac","wav","ogg","oga","flac","opus"]);
      if(!allowed.has(ext))return res.status(415).json({ok:false,error:"Format video/audio tidak didukung."});
      if(req.body.length>50*1024*1024)return res.status(413).json({ok:false,error:"File melebihi batas 50 MB."});
      inputPath=path.join(TEMP,randomUUID()+"."+ext);
      writeFileSync(inputPath,req.body,{flag:"wx"});
    }
    const result=await scanShazamMedia(inputPath,skip,every,limit);
    res.json(result);
  }catch(error){if(!res.headersSent)res.status(400).json({ok:false,error:error.message||"Pemindaian Shazam gagal."});}
  finally{try{if(inputPath&&existsSync(inputPath))unlinkSync(inputPath);}catch{}}
});

app.use(express.static(path.join(process.cwd(),"public")));app.use(express.static(path.join(process.cwd(),"public")));
app.listen(PORT,()=>console.log("ARYANZZ listening on "+PORT));
