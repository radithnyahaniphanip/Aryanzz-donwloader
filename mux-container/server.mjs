import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MAX_MUX_OUTPUT_BYTES = 14 * 1024 * 1024 * 1024;
const PORT = Number(process.env.PORT || 8080);
const MAX_BODY_BYTES = 64 * 1024;
const BUILTIN_MEDIA_ROOTS = [
  "googlevideo.com","kavin.rocks","leptons.xyz","nosebs.ru","privacy.com.de","adminforge.de",
  "piped.yt","drgns.space","owo.si","ducks.party","codespace.cz","reallyaweso.me","private.coffee",
  "darkness.services","orangenet.cc","nadeko.net","nerdvpn.de","tiekoetter.com",
  "cdninstagram.com","fbcdn.net","fbsbx.com","tiktokcdn.com","tiktokcdn-us.com","tiktokcdn-eu.com","tiktokcdn.net","tiktokv.com","byteoversea.com",
  "ibytedtos.com","bytecdn.cn","muscdn.com","musical.ly","twimg.com","redditmedia.com","redd.it","vimeocdn.com","vimeo.com",
  "pinimg.com","kwai.net","snackvideo.com","threads.net","threads.com","capcut.com"
];
const ALLOWED_MEDIA_ROOTS=[...new Set([...BUILTIN_MEDIA_ROOTS,...String(process.env.MUX_ALLOWED_HOSTS||"").split(",").map(value=>value.trim().toLowerCase().replace(/^\.+|\.+$/g,"")).filter(Boolean)])];
const ALLOWED_REFERER_ROOTS=[...ALLOWED_MEDIA_ROOTS,"youtube.com","tiktok.com","instagram.com","facebook.com","x.com","twitter.com","reddit.com","pinterest.com","threads.com","threads.net","vimeo.com","capcut.com","soundcloud.com"];
const ALLOWED_VIDEO_EXTS=new Set(["mp4","m4v","webm","mov","avi","3gp","flv","mkv","ts","mpg","mpeg","wmv"]);
const ALLOWED_AUDIO_EXTS=new Set(["m4a","aac","mp3","opus","ogg","wav","flac","webm"]);
const ALLOWED_HEIGHTS = new Set([144, 240, 360, 480, 720, 1080, 1440, 2160, 4320]);
const USER_AGENT = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

function safeFilename(value) {
  const clean = String(value || "aryanzz-youtube")
    .replace(/\.(?:mp4|m4v|webm)$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "aryanzz-youtube";
  return clean + ".mp4";
}

function allowedMediaUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("URL stream tidak valid."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
    throw new Error("Stream harus memakai HTTPS dan tidak boleh berisi kredensial.");
  }
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_MEDIA_ROOTS.some(root => host === root || host.endsWith("." + root));
  if (!allowed) throw new Error("Host stream tidak termasuk CDN media publik yang diizinkan.");
  return url.href;
}
function allowedReferer(raw) {
  if (!raw) return "https://www.youtube.com/";
  let url;
  try { url = new URL(raw); } catch { throw new Error("Referer sumber tidak valid."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Referer harus memakai HTTPS.");
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_REFERER_ROOTS.some(root => host === root || host.endsWith("." + root))) throw new Error("Domain referer tidak diizinkan.");
  return url.origin + "/";
}

export function validateMuxRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Data mux tidak valid.");
  if (!/^[0-9a-f-]{36}$/i.test(String(payload.id || ""))) throw new Error("ID proses tidak valid.");
  const height = Number(payload.height) || 0;
  if (height !== 0 && (!Number.isInteger(height) || height < 144 || height > 4320)) throw new Error("Resolusi sumber tidak didukung.");
  const videoExt = String(payload.videoExt || "").toLowerCase();
  const audioExt = String(payload.audioExt || "").toLowerCase();
  if (!ALLOWED_VIDEO_EXTS.has(videoExt)) throw new Error("Format video sumber belum didukung untuk MP4.");
  const audioUrl = payload.audioUrl ? allowedMediaUrl(payload.audioUrl) : null;
  if (audioUrl && !ALLOWED_AUDIO_EXTS.has(audioExt)) throw new Error("Format audio sumber belum didukung untuk MP4.");
  if (!audioUrl && audioExt) throw new Error("Ekstensi audio dikirim tanpa URL audio.");
  const videoCodec = String(payload.videoCodec || "").toLowerCase();
  const audioCodec = String(payload.audioCodec || "").toLowerCase();
  const supportedVideoCodecs = ["h264","hevc","av1","vp9","vp8","mpeg4","mpeg2video","mpeg1video","h263","mjpeg","prores","theora","wmv3","vc1","flv1"];
  const supportedAudioCodecs = ["aac","opus","vorbis","mp3","mp2","ac3","eac3","flac","pcm_s16le","alac","wma","wmav1","wmav2"];
  if (videoCodec && !supportedVideoCodecs.includes(videoCodec)) throw new Error("Codec video " + videoCodec + " belum didukung oleh FFmpeg.");
  if (audioCodec && !supportedAudioCodecs.includes(audioCodec)) throw new Error("Codec audio " + audioCodec + " belum didukung oleh FFmpeg.");
  const videoUrl = allowedMediaUrl(payload.videoUrl);
  const title = safeFilename(payload.title);
  const referer = allowedReferer(payload.referer);
  return { id: String(payload.id), videoUrl, audioUrl, title, height, videoExt, audioExt, videoCodec, audioCodec, referer };
}

export function buildFfmpegArgs(payload) {
  const referer = payload.referer || "https://www.youtube.com/";
  const origin = new URL(referer).origin;
  const headers = "Referer: " + referer + "\r\nOrigin: " + origin + "\r\n";
  const input = url => [
    "-user_agent", USER_AGENT,
    "-headers", headers,
    "-rw_timeout", "90000000",
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-i", url
  ];
  const videoCodecArgs = ["h264","hevc","av1","vp9"].includes(String(payload.videoCodec||"").toLowerCase())
    ? ["-c:v","copy"]
    : ["-c:v","libx264","-preset","veryfast","-crf","18","-pix_fmt","yuv420p"];
  const audioCodec=String(payload.audioCodec||"").toLowerCase();
  const audioCodecArgs = !audioCodec||audioCodec==="aac"
    ? ["-c:a","copy"]
    : ["-c:a","aac","-b:a","192k","-ar","48000"];
  const inputs = [...input(payload.videoUrl), ...(payload.audioUrl ? input(payload.audioUrl) : [])];
  const maps = payload.audioUrl ? ["-map","0:v:0","-map","1:a:0"] : ["-map","0:v:0","-map","0:a:0?"];
  return [
    "-hide_banner","-loglevel","error","-nostdin","-y",
    ...inputs,...maps,...videoCodecArgs,...audioCodecArgs,
    "-map_metadata","-1",
    "-metadata","title="+payload.title.replace(/\.mp4$/i,""),
    "-max_muxing_queue_size","2048",
    "-movflags","+frag_keyframe+empty_moov+default_base_moof",
    "-shortest","-f","mp4","pipe:1"
  ];
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("Permintaan mux terlalu besar.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function json(res, status, body) {
  if (res.headersSent || res.destroyed) return;
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(data.length),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(data);
}

export function buildFfprobeArgs(streamUrl, referer = "https://www.youtube.com/") {
  const origin = new URL(referer).origin;
  const headers = "Referer: " + referer + "\r\nOrigin: " + origin + "\r\n";
  return [
    "-v","error","-user_agent",USER_AGENT,"-headers",headers,
    "-rw_timeout","30000000",
    "-show_entries","stream=codec_type,height,codec_name",
    "-of","json","-i",streamUrl
  ];
}

function probeSingleStream(streamUrl, spawnImpl, referer = "https://www.youtube.com/") {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl("ffprobe", buildFfprobeArgs(streamUrl, referer), { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch (error) {
      reject(new Error("FFprobe tidak dapat dijalankan: " + String(error?.message || error).slice(0, 120)));
      return;
    }
    let stdout = "", stderr = "";
    child.stdout?.on("data", chunk => { stdout = (stdout + chunk.toString("utf8")).slice(-64000); });
    child.stderr?.on("data", chunk => { stderr = (stderr + chunk.toString("utf8")).slice(-4000); });
    child.on("error", error => reject(new Error("FFprobe gagal: " + String(error?.message || error).slice(0, 140))));
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error("Stream tidak lolos pemeriksaan FFprobe. " + (stderr.trim().slice(-240) || "Provider menolak stream.")));
        return;
      }
      try { resolve(JSON.parse(stdout || "{}")); }
      catch { reject(new Error("Metadata stream dari FFprobe tidak valid.")); }
    });
  });
}

async function inspectMuxStreams(payload, spawnImpl) {
  const videoData = await probeSingleStream(payload.videoUrl, spawnImpl, payload.referer);
  const audioData = payload.audioUrl ? await probeSingleStream(payload.audioUrl, spawnImpl, payload.referer) : videoData;
  const video = (Array.isArray(videoData.streams) ? videoData.streams : []).find(item => item.codec_type === "video");
  const audio = (Array.isArray(audioData.streams) ? audioData.streams : []).find(item => item.codec_type === "audio");
  if (!video) throw new Error("Sumber tidak memiliki track video.");
  if (payload.audioUrl && !audio) throw new Error("Sumber audio terpisah tidak memiliki track audio.");
  const actualHeight = Number(video.height) || 0;
  const videoCodec = String(video.codec_name || "").toLowerCase();
  const audioCodec = String(audio?.codec_name || "").toLowerCase();
  if (!Number.isInteger(actualHeight) || actualHeight < 144 || actualHeight > 4320) throw new Error("Resolusi sumber " + actualHeight + "p belum didukung oleh mesin MP4.");
  if (payload.height && actualHeight !== payload.height) throw new Error("Resolusi sumber sebenarnya " + actualHeight + "p, bukan " + payload.height + "p. ARYANZZ menghentikan proses agar tidak memberi label kualitas palsu.");
  if (!["h264","hevc","av1","vp9","vp8","mpeg4","mpeg2video","mpeg1video","h263","mjpeg","prores","theora","wmv3","vc1","flv1"].includes(videoCodec)) throw new Error("Codec video " + (videoCodec || "tidak diketahui") + " belum didukung oleh FFmpeg.");
  if (audioCodec && !["aac","opus","vorbis","mp3","mp2","ac3","eac3","flac","pcm_s16le","alac","wma","wmav1","wmav2"].includes(audioCodec)) throw new Error("Codec audio " + audioCodec + " belum didukung oleh FFmpeg.");
  return { ok: true, height: actualHeight, videoCodec, audioCodec };
}

export function createMuxServer({ spawnImpl = spawn, probeImpl = inspectMuxStreams, token = process.env.MUX_TOKEN } = {}) {
  let activeJobs = 0;
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://container");
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "aryanzz-universal-mp4-mux", ffmpeg: true, authConfigured: Boolean(token) });
    }
    if (url.pathname.startsWith("/probe/") || url.pathname.startsWith("/mux/")) {
      const expected = String(token || "");
      const supplied = String(req.headers.authorization || "");
      if (!expected) return json(res, 503, { ok: false, error: "MUX_TOKEN belum dikonfigurasi pada server." });
      if (supplied !== "Bearer " + expected) return json(res, 401, { ok: false, error: "Token mux tidak valid." });
    }
    if (req.method === "POST" && /^\/probe\/[0-9a-f-]{36}$/i.test(url.pathname)) {
      let payload;
      try {
        payload = validateMuxRequest(await readJson(req));
        if (payload.id !== url.pathname.split("/").pop()) throw new Error("ID proses tidak cocok.");
        return json(res, 200, await probeImpl(payload, spawnImpl));
      } catch (error) {
        return json(res, 422, { ok: false, error: String(error?.message || "Stream tidak lolos pemeriksaan.").slice(0, 300) });
      }
    }
    if (req.method !== "POST" || !/^\/mux\/[0-9a-f-]{36}$/i.test(url.pathname)) {
      return json(res, 404, { ok: false, error: "Endpoint tidak ditemukan." });
    }
    if (activeJobs >= 1) return json(res, 429, { ok: false, error: "Mesin mux sedang memproses unduhan lain. Coba lagi sebentar." });

    let payload;
    try {
      payload = validateMuxRequest(await readJson(req));
      const pathId = url.pathname.split("/").pop();
      if (payload.id !== pathId) throw new Error("ID proses tidak cocok.");
      if (!payload.videoCodec || (payload.audioUrl && !payload.audioCodec)) throw new Error("Metadata codec sumber belum diverifikasi.");
    } catch (error) {
      return json(res, 400, { ok: false, error: String(error?.message || "Data mux tidak valid.").slice(0, 180) });
    }

    activeJobs++;
    let child;
    let responseStarted = false;
    let outputBytes = 0;
    let stderrTail = "";
    let finished = false;
    const headers = {
      "content-type": "video/mp4",
      "content-disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(payload.title),
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-content-type-options": "nosniff",
      "x-aryanzz-mux-mode": ["h264","hevc","av1","vp9"].includes(payload.videoCodec) ? "video-stream-copy" : "video-transcode",
      "x-aryanzz-source-height": String(payload.height)
    };
    const cleanup = () => {
      if (finished) return;
      finished = true;
      activeJobs = Math.max(0, activeJobs - 1);
    };

    try {
      child = spawnImpl("ffmpeg", buildFfmpegArgs(payload), {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
    } catch (error) {
      cleanup();
      return json(res, 502, { ok: false, error: "Mesin FFmpeg tidak dapat dijalankan: " + String(error?.message || error).slice(0, 140) });
    }

    child.stderr?.on("data", chunk => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(-5000);
    });
    child.stdout?.on("data", chunk => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_MUX_OUTPUT_BYTES) {
        child.kill("SIGTERM");
        if (!responseStarted) json(res, 413, { ok: false, error: "Hasil MP4 melebihi batas aman 14 GB." });
        else res.destroy(new Error("Hasil MP4 melebihi batas aman 14 GB."));
        return;
      }
      if (!responseStarted) {
        responseStarted = true;
        res.writeHead(200, headers);
      }
      if (!res.destroyed && !res.write(chunk)) child.stdout.pause();
    });
    child.on("error", error => {
      if (!responseStarted) json(res, 502, { ok: false, error: "FFmpeg gagal dimulai: " + String(error?.message || error).slice(0, 140) });
      else if (!res.destroyed) res.destroy(error);
      cleanup();
    });
    child.on("close", (code, signal) => {
      if (!responseStarted) {
        json(res, 502, {
          ok: false,
          error: "Stream publik tidak dapat digabung menjadi MP4. " + (stderrTail.trim().slice(-260) || "Provider menolak stream atau audio/video tidak cocok.")
        });
      } else if (code === 0 && !res.destroyed) {
        res.end();
      } else if (!res.destroyed) {
        res.destroy(new Error("FFmpeg berhenti sebelum MP4 selesai (kode " + code + ", " + String(signal || "tanpa sinyal") + ")."));
      }
      cleanup();
    });
    res.on("drain", () => child?.stdout?.resume());
    res.on("close", () => {
      if (!finished && child && child.exitCode === null && !child.killed) child.kill("SIGTERM");
      cleanup();
    });
    req.on("aborted", () => {
      if (child && child.exitCode === null && !child.killed) child.kill("SIGTERM");
    });
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const server = createMuxServer();
  server.listen(PORT, "0.0.0.0", () => {
    console.log("[ARYANZZ_MUX] Listening on port " + PORT);
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}
