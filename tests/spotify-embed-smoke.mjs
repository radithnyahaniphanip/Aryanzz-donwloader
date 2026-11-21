import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function spotifyEmbedInfo");
const end = source.indexOf("\nasync function platformMediaInfo", start);
assert.ok(start >= 0 && end > start, "Spotify share-link resolver must exist before platformMediaInfo");
const helper = source.slice(start, end) + "\nglobalThis.spotifyEmbedInfo=spotifyEmbedInfo;";

const trackId = "1234567890123456789012";
const requests = [];
const sandbox = {
  URL,
  AbortSignal,
  Response,
  safePublicMediaUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url : null;
    } catch { return null; }
  },
  json(value, status = 200) {
    return new Response(JSON.stringify(value), {
      status,
      headers: { "content-type": "application/json" }
    });
  },
  fetch: async input => {
    const url = new URL(String(input));
    requests.push(url.href);
    if (url.hostname === "spotify.link") {
      return {
        url: "https://open.spotify.com/track/" + trackId,
        body: { cancel: async () => {} }
      };
    }
    if (url.hostname === "open.spotify.com" && url.pathname === "/oembed") {
      return new Response(JSON.stringify({
        title: "Demo DJ Track",
        author_name: "Demo Artist",
        thumbnail_url: "https://i.scdn.co/image/demo"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error("Unexpected Spotify request: " + url.href);
  }
};
vm.runInNewContext(helper, sandbox);

const directResponse = await sandbox.spotifyEmbedInfo(
  "https://open.spotify.com/track/" + trackId,
  "https://aryanzz.example"
);
assert.equal(directResponse.status, 200);
const direct = await directResponse.json();
assert.equal(direct.platform, "spotify");
assert.equal(direct.type, "audio");
assert.equal(direct.title, "Demo DJ Track");
assert.equal(direct.artist, "Demo Artist");
assert.equal(direct.embedUrl, "https://open.spotify.com/embed/track/" + trackId + "?utm_source=generator&theme=0");
assert.equal(direct.directDownloadAvailable, false, "Spotify playback must use its official embed, not claim an unrestricted download");
assert.deepEqual(direct.formats, []);

const shortResponse = await sandbox.spotifyEmbedInfo("https://spotify.link/demo", "https://aryanzz.example");
const short = await shortResponse.json();
assert.equal(shortResponse.status, 200);
assert.equal(short.spotifyId, trackId, "Spotify short share links should resolve to the canonical track");

const invalid = await sandbox.spotifyEmbedInfo("https://example.com/track/" + trackId, "https://aryanzz.example");
assert.equal(invalid.status, 400, "Non-Spotify URLs must not be accepted by the Spotify resolver");

const unsupported = await sandbox.spotifyEmbedInfo("https://open.spotify.com/artist/" + trackId, "https://aryanzz.example");
assert.equal(unsupported.status, 400, "Unsupported Spotify entity types must fail clearly");

assert.ok(requests.some(value => value.includes("open.spotify.com/oembed")), "Spotify oEmbed metadata should be requested from Spotify");
console.log("ARYANZZ Spotify official embed smoke test passed.");
