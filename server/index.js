import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const app = express();
const PORT = process.env.PORT || 3000;
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(x => x.trim());
const TEMP = path.join(os.tmpdir(), "aryanzz-downloads");
mkdirSync(TEMP, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin(origin, cb) {
  if (!origin || ORIGINS.includes("*") || ORIGINS.includes(origin)) return cb(null, true);
  return cb(new Error("Origin tidak diizinkan"));
} }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false }));

const ALLOWED = ["youtube.com","youtu.be","youtube-nocookie.com","tiktok.com","instagram.com","facebook.com","fb.watch","pinterest.com","pin.it","mediafire.com"];
function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("URL tidak valid"); }
  if (!["http:","https:"].includes(u.protocol)) throw new Error("Hanya URL HTTP/HTTPS yang diizinkan");
  const host = u.hostname.toLowerCase();
  if (!ALLOWED.some(d => host === d || host.endsWith("." + d))) throw new Error("Domain belum didukung");
  if (u.username || u.password) throw new Error("URL dengan kredensial tidak diizinkan");
  return u.href;
}
function run(args, timeout = 180000) {
  return new Promise((resolve,reject) => {
    const child = spawn(YTDLP,args,{stdio:["ignore","pipe","pipe"]});
    let stdout="",stderr="",done=false;
    const timer=setTimeout(()=>{child.kill("SIGKILL");finish(new Error("Waktu proses habis"));},timeout);
    function finish(err,val){if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(val);}
    child.stdout.on("data",d=>{stdout+=d.toString();if(stdout.length>2000000)child.kill("SIGKILL");});
    child.stderr.on("data",d=>{stderr+=d.toString();if(stderr.length>16000)stderr=stderr.slice(-16000);});
    child.on("error",()=>finish(new Error("yt-dlp tidak tersedia pada server")));
    child.on("close",code=>code===0?finish(null,stdout):finish(new Error(stderr.trim().slice(-1000)||"Proses media gagal")));
  });
}
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"ARYANZZ Downloader API"}));
app.post("/api/info",async(req,res)=>{
  try {
    const url=validateUrl(req.body?.url);
    const info=JSON.parse(await run(["--dump-single-json","--no-warnings","--no-playlist",url]));
    res.json({title:info.title||"Media",extractor:info.extractor_key||info.extractor||"Media",duration:info.duration||null,thumbnail:info.thumbnail||null,formats:(info.formats||[]).slice(0,25).map(f=>({ext:f.ext,height:f.height||null}))});
  } catch(e){res.status(400).json({error:e.message});}
});
app.post("/api/download",async(req,res)=>{
  let output;
  try {
    const url=validateUrl(req.body?.url);
    const audio=req.body?.mode==="audio";
    const id=randomUUID();
    output=path.join(TEMP,id+(audio?".mp3":".mp4"));
    const args=audio
      ? ["--no-warnings","--no-playlist","-x","--audio-format","mp3","--audio-quality","0","-o",output,url]
      : ["--no-warnings","--no-playlist","-f","best[ext=mp4]/best","--merge-output-format","mp4","-o",output,url];
    await run(args,240000);
    if(!existsSync(output))throw new Error("File hasil tidak ditemukan");
    res.download(output,audio?"aryanzz-audio.mp3":"aryanzz-video.mp4",()=>{try{if(existsSync(output))unlinkSync(output);}catch{}});
  } catch(e){try{if(output&&existsSync(output))unlinkSync(output);}catch{}if(!res.headersSent)res.status(400).json({error:e.message});}
});
app.use(express.static(path.join(process.cwd(),"public")));
app.listen(PORT,()=>console.log("ARYANZZ listening on "+PORT));