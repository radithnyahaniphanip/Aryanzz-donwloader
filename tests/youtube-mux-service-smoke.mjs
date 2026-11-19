import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  buildFfmpegArgs,
  buildFfprobeArgs,
  createMuxServer,
  validateMuxRequest
} from "../mux-container/server.mjs";

const id = "00000000-0000-4000-8000-000000000001";
const payload = {
  id,
  videoUrl: "https://rr1---sn-a5mekn6s.googlevideo.com/videoplayback?itag=402&expire=1999999999",
  audioUrl: "https://rr2---sn-a5mekn6s.googlevideo.com/videoplayback?itag=140&expire=1999999999",
  title: "ARYANZZ 8K test.mp4",
  height: 4320,
  videoExt: "mp4",
  audioExt: "m4a",
  videoCodec: "av1",
  audioCodec: "aac"
};

const valid = validateMuxRequest(payload);
assert.equal(valid.height, 4320);
assert.equal(valid.title, "ARYANZZ 8K test.mp4");
assert.throws(() => validateMuxRequest({ ...payload, videoUrl: "http://127.0.0.1/private.mp4" }), /HTTPS/);
assert.throws(() => validateMuxRequest({ ...payload, videoUrl: "https://example.com/video.mp4" }), /diizinkan/);
assert.throws(() => validateMuxRequest({ ...payload, height: 1081 }), /Resolusi/);
assert.throws(() => validateMuxRequest({ ...payload, videoExt: "exe" }), /Format video/);
const socialSingleFile = validateMuxRequest({
  ...payload,
  videoUrl: "https://scontent.cdninstagram.com/v/t50.2886-16/clip.mov",
  audioUrl: null,
  videoExt: "mov",
  audioExt: "",
  height: 0,
  referer: "https://www.instagram.com/"
});
assert.equal(socialSingleFile.audioUrl, null);
assert.ok(buildFfmpegArgs(socialSingleFile).includes("0:a:0"), "A progressive social video should map its embedded audio track.");
const socialAdaptive = validateMuxRequest({
  ...payload,
  videoUrl: "https://v16m.tiktokcdn.com/video.webm",
  audioUrl: "https://v16m.tiktokcdn.com/audio.opus",
  videoExt: "webm",
  audioExt: "opus",
  videoCodec: "vp9",
  audioCodec: "opus",
  referer: "https://www.tiktok.com/"
});
const socialArgs = buildFfmpegArgs(socialAdaptive);
assert.equal(socialArgs[socialArgs.indexOf("-c:v") + 1], "copy");
assert.equal(socialArgs[socialArgs.indexOf("-c:a") + 1], "aac");
assert.ok(socialArgs.includes("192k"), "Social Opus audio should be converted to AAC for MP4 output.");
const webmPayload = validateMuxRequest({
  ...payload,
  videoExt: "webm",
  audioExt: "opus",
  videoCodec: "vp9",
  audioCodec: "opus"
});
const webmArgs = buildFfmpegArgs(webmPayload);
assert.equal(webmArgs[webmArgs.indexOf("-c:v") + 1], "copy");
assert.equal(webmArgs[webmArgs.indexOf("-c:a") + 1], "aac");
assert.ok(webmArgs.includes("192k"), "Opus audio should be converted to AAC for MP4 output.");
assert.equal(webmArgs.at(-1), "pipe:1");

const ffmpegArgs = buildFfmpegArgs(valid);
assert.equal(ffmpegArgs[ffmpegArgs.indexOf("-c:v") + 1], "copy");
assert.equal(ffmpegArgs[ffmpegArgs.indexOf("-c:a") + 1], "copy");
assert.ok(ffmpegArgs.includes("+frag_keyframe+empty_moov+default_base_moof"));
assert.equal(ffmpegArgs.at(-1), "pipe:1");
assert.ok(!ffmpegArgs.includes("libx264"), "Mux must copy source streams, not re-encode or upscale.");
const ffprobeVideoArgs = buildFfprobeArgs(valid.videoUrl);
const ffprobeAudioArgs = buildFfprobeArgs(valid.audioUrl);
assert.ok(ffprobeVideoArgs.includes("stream=codec_type,height,codec_name"));
assert.ok(ffprobeVideoArgs.includes(valid.videoUrl));
assert.ok(ffprobeAudioArgs.includes(valid.audioUrl));

function fakeSpawn(command, args) {
  assert.equal(command, "ffmpeg");
  assert.ok(args.includes("pipe:1"));
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.exitCode = 1;
    child.stdout.end();
    child.emit("close", 1, "SIGTERM");
  };
  child.stdout.once("end", () => {
    child.exitCode = 0;
    child.emit("close", 0, null);
  });
  queueMicrotask(() => {
    child.stdout.write(Buffer.from([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,2,0,0x69,0x73,0x6f,0x6d,0x61,0x76,0x63,0x31]));
    child.stdout.end();
    child.stderr.end();
  });
  return child;
}

const server = createMuxServer({
  spawnImpl: fakeSpawn,
  probeImpl: async value => ({ ok: true, height: value.height, videoCodec: "av01", audioCodec: "aac" })
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = "http://127.0.0.1:" + address.port;
try {
  const probe = await fetch(base + "/probe/" + id, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  assert.equal(probe.status, 200);
  assert.equal((await probe.json()).height, 4320);

  const response = await fetch(base + "/mux/" + id, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("x-aryanzz-source-height"), "4320");
  assert.ok((await response.arrayBuffer()).byteLength >= 24);
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

console.log("ARYANZZ high-resolution MP4 mux tests passed: 2K/4K/8K source validation, MP4+M4A pairing, stream-copy FFmpeg, FFprobe preflight, and streamed response.");
