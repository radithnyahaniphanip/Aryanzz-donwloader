import assert from "node:assert/strict";

const videoId = process.env.ARYANZZ_TEST_VIDEO_ID || "4dpnHLPMQGs";
const providers = [
  { name: "Piped", api: "https://pipedapi.kavin.rocks", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.adminforge.de", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.leptons.xyz", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.nosebs.ru", kind: "piped" },
  { name: "Piped", api: "https://piped-api.privacy.com.de", kind: "piped" },
  { name: "Piped", api: "https://api.piped.yt", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.drgns.space", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.owo.si", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.ducks.party", kind: "piped" },
  { name: "Piped", api: "https://piped-api.codespace.cz", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.reallyaweso.me", kind: "piped" },
  { name: "Piped", api: "https://api.piped.private.coffee", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.darkness.services", kind: "piped" },
  { name: "Piped", api: "https://pipedapi.orangenet.cc", kind: "piped" },
  { name: "Invidious", api: "https://invidious.tiekoetter.com", kind: "invidious" },
  { name: "Invidious", api: "https://invidious.nerdvpn.de", kind: "invidious" },
  { name: "Invidious", api: "https://yt.chocolatemoo53.com", kind: "invidious" },
  { name: "Invidious", api: "https://inv.nadeko.net", kind: "invidious" }
];
const failures = [];

async function request(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(4500) });
}

for (const provider of providers) {
  try {
    const endpoint = provider.kind === "piped"
      ? provider.api + "/streams/" + encodeURIComponent(videoId)
      : provider.api + "/api/v1/videos/" + encodeURIComponent(videoId) + "?region=ID";
    const response = await request(endpoint, { headers: { accept: "application/json", referer: provider.kind === "piped" ? "https://piped.video/" : provider.api + "/" } });
    if (!response.ok) throw new Error("metadata HTTP " + response.status);
    const data = await response.json();
    let stream = null;
    if (provider.kind === "piped") {
      stream = (data.videoStreams || []).find(x =>
        x && x.videoOnly === false &&
        ["video/mp4","video/webm"].includes(String(x.mimeType || "").toLowerCase().split(";")[0]) &&
        typeof x.url === "string"
      );
    } else {
      stream = (data.formatStreams || []).find(x =>
        x && ["mp4","webm"].includes(String(x.container || "").toLowerCase()) &&
        typeof x.url === "string"
      );
    }
    if (!stream) throw new Error("no progressive MP4 stream");
    const probe = await request(stream.url, {
      headers: { range: "bytes=0-0", accept: "*/*" }
    });
    if (!(probe.ok || probe.status === 206)) throw new Error("stream HTTP " + probe.status);
    const mime = String(probe.headers.get("content-type") || "").toLowerCase();
    if (mime && !mime.includes("video/mp4") && !mime.includes("video/webm") && !mime.includes("octet-stream")) {
      throw new Error("unexpected stream MIME " + mime);
    }
    if (probe.body) await probe.body.cancel();
    assert.ok(data.title, "provider response must include a title");
    console.log("LIVE PROVIDER PASS: " + provider.name + " (" + provider.api + ") returned " +
      (stream.qualityLabel || stream.quality || stream.height || "MP4") + " and a byte-range stream.");
    process.exit(0);
  } catch (error) {
    failures.push(provider.name + " " + provider.api + ": " + String(error.message || error));
  }
}
console.error("No public community instance returned a testable progressive MP4 stream.");
for (const failure of failures) console.error(" - " + failure);
process.exit(1);
