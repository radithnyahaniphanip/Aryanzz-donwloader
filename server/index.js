import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const API_TOKEN = process.env.PLATFORM_API_TOKEN || "";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(x => x.trim());
const TEMP = path.join(os.tmpdir(), "aryanzz-downloads");
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_DURATION = 2 * 60 * 60;
mkdirSync(TEMP, { recursive: true });

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin(origin, cb) {
  if (!origin || ORIGINS.includes("*") || ORIGINS.includes(origin)) return cb(null, true);
  return cb(new Error("Origin tidak diizinkan"));
} }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false }));

const ALLOWED = ["youtube.com","youtu.be","youtube-nocookie.com","tiktok.com","instagram.com","facebook.com","fb.watch","pinterest.com","pin.it"];
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
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"ARYANZZ Downloader API",features:["platform-info","mp4","mp3","quality-select"]}));
function requirePlatformToken(req,res,next){
  const supplied=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!API_TOKEN)return res.status(503).json({error:"PLATFORM_API_TOKEN belum dikonfigurasi pada backend."});
  const a=Buffer.from(supplied),b=Buffer.from(API_TOKEN);
  if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({error:"Token backend tidak valid."});
  next();
}
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
app.use(express.static(path.join(process.cwd(),"public")));
app.listen(PORT,()=>console.log("ARYANZZ listening on "+PORT));
