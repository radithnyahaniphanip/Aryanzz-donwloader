import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MAX_MUX_OUTPUT_BYTES = 14 * 1024 * 1024 * 1024;
const PORT = Number(process.env.PORT || 8080);
const MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_MEDIA_ROOTS = [
  "googlevideo.com",
  "kavin.rocks",
  "leptons.xyz",
  "nosebs.ru",
  "privacy.com.de",
  "adminforge.de",
  "piped.yt",
  "drgns.space",
  "owo.si",
  "ducks.party",
  "codespace.cz",
  "reallyaweso.me",
  "private.coffee",
  "darkness.services",
  "orangenet.cc",
  "nadeko.net",
  "nerdvpn.de",
  "tiekoetter.com"
];
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
  if (!allowed) throw new Error("Host stream tidak termasuk sumber YouTube yang diizinkan.");
  return url.href;
}

export function validateMuxRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Data mux tidak valid.");
  if (!/^[0-9a-f-]{36}$/i.test(String(payload.id || ""))) throw new Error("ID proses tidak valid.");
  const height = Number(payload.height);
  if (!ALLOWED_HEIGHTS.has(height)) throw new Error("Resolusi sumber tidak didukung.");
  const videoUrl = allowedMediaUrl(payload.videoUrl);
  const audioUrl = allowedMediaUrl(payload.audioUrl);
  const title = safeFilename(payload.title);
  return { id: String(payload.id), videoUrl, audioUrl, title, height };
}

export function buildFfmpegArgs(payload) {
  const referer = "https://www.youtube.com/";
  const headers = "Referer: " + referer + "\r\nOrigin: https://www.youtube.com\r\n";
  const input = url => [
    "-user_agent", USER_AGENT,
    "-headers", headers,
    "-rw_timeout", "90000000",
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-i", url
  ];
  return [
    "-hide_banner",
    "-loglevel", "error",
    "-nostdin",
    "-y",
    ...input(payload.videoUrl),
    ...input(payload.audioUrl),
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "copy",
    "-map_metadata", "-1",
    "-metadata", "title=" + payload.title.replace(/\.mp4$/i, ""),
    "-max_muxing_queue_size", "2048",
    "-movflags", "+frag_keyframe+empty_moov+default_base_moof",
    "-shortest",
    "-f", "mp4",
    "pipe:1"
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

export function buildFfprobeArgs(payload) {
  const headers = "Referer: https://www.youtube.com/\r\nOrigin: https://www.youtube.com\r\n";
  const input = url => ["-user_agent", USER_AGENT, "-headers", headers, "-rw_timeout", "30000000", "-i", url];
  return ["-v", "error", ...input(payload.videoUrl), ...input(payload.audioUrl), "-show_entries", "stream=codec_type,height,codec_name", "-of", "json"];
}

function inspectMuxStreams(payload, spawnImpl) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl("ffprobe", buildFfprobeArgs(payload), { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
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
        reject(new Error("Stream video/audio tidak lolos pemeriksaan FFprobe. " + (stderr.trim().slice(-240) || "Provider menolak stream.")));
        return;
      }
      try {
        const data = JSON.parse(stdout || "{}");
        const streams = Array.isArray(data.streams) ? data.streams : [];
        const video = streams.find(item => item.codec_type === "video");
        const audio = streams.find(item => item.codec_type === "audio");
        if (!video || !audio) throw new Error("Sumber tidak memiliki pasangan video dan audio lengkap.");
        const actualHeight = Number(video.height) || 0;
        if (actualHeight !== payload.height) throw new Error("Resolusi sumber sebenarnya " + actualHeight + "p, bukan " + payload.height + "p. ARYANZZ menghentikan proses agar tidak memberi label kualitas palsu.");
        resolve({ ok: true, height: actualHeight, videoCodec: String(video.codec_name || ""), audioCodec: String(audio.codec_name || "") });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function createMuxServer({ spawnImpl = spawn, probeImpl = inspectMuxStreams } = {}) {
  let activeJobs = 0;
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://container");
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "aryanzz-youtube-mp4-mux", ffmpeg: true });
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
      "x-aryanzz-mux-mode": "stream-copy",
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
          error: "Stream YouTube tidak dapat digabung menjadi MP4. " + (stderrTail.trim().slice(-260) || "Provider menolak stream atau audio/video tidak cocok.")
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
