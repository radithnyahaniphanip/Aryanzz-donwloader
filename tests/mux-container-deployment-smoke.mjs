import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const docker = read("../mux-container/Dockerfile");
const compose = read("../mux-container/docker-compose.yml");
const caddy = read("../mux-container/Caddyfile");
const envExample = read("../mux-container/.env.example");
const guide = read("../mux-container/README.md");
const worker = read("../src/index.js");
const deploy = read("../.github/workflows/deploy-cloudflare.yml");
const server = read("../mux-container/server.mjs");

assert.ok(docker.includes("ffmpeg") && docker.includes("USER node") && docker.includes("HEALTHCHECK"), "Mux container installs FFmpeg, runs non-root, and exposes a health check.");
assert.ok(compose.includes("MUX_TOKEN: ${MUX_TOKEN:?Set MUX_TOKEN in mux-container/.env}") && compose.includes("MUX_DOMAIN: ${MUX_DOMAIN:?Set MUX_DOMAIN in mux-container/.env}"), "Compose requires explicit mux credentials and domain configuration.");
assert.ok(compose.includes("127.0.0.1") === false && compose.includes('443:443') && compose.includes('80:80'), "Caddy publishes HTTPS while the mux service remains internal to the Docker network.");
assert.ok(compose.includes("cap_drop:") && compose.includes("no-new-privileges:true"), "The container drops Linux capabilities and disables privilege escalation.");
assert.ok(caddy.includes("reverse_proxy media-mux:8080") && caddy.includes("{$MUX_DOMAIN}"), "Caddy routes the public HTTPS domain to the private mux container.");
assert.ok(envExample.includes("MUX_TOKEN=") && envExample.includes("MUX_DOMAIN="), "The example environment file documents required deployment settings.");
assert.ok(guide.includes("does **not** have to run on Cloudflare") && guide.includes("MEDIA_MUX_URL") && guide.includes("MEDIA_MUX_TOKEN"), "The deployment guide explains external hosting and Worker connection.");
assert.ok(worker.includes("env?.MEDIA_MUX_URL||env?.YOUTUBE_MUX_URL") && worker.includes("env?.MEDIA_MUX_TOKEN||env?.YOUTUBE_MUX_TOKEN"), "The Worker accepts generic external mux settings and legacy YouTube settings.");
assert.ok(deploy.includes("Sync optional external FFmpeg mux host") && deploy.includes("secrets.MEDIA_MUX_URL") && deploy.includes("secrets.MEDIA_MUX_TOKEN"), "The production deployment workflow syncs optional external mux credentials.");
assert.ok(server.includes('if (!expected) return json(res, 503') && server.includes('supplied !== "Bearer " + expected'), "The mux service requires its Bearer token for probe and mux requests.");
console.log("ARYANZZ external FFmpeg mux host deployment smoke tests passed.");
