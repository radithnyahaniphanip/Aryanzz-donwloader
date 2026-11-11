import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const html = read("public/index.html");
const profileJs = read("public/v25.js");
const profileCss = read("public/v25.css");
const toolsCss = read("public/workspace-tools.css");
const packageJson = JSON.parse(read("package.json"));
const workspace = JSON.parse(read("public/workspace-manifest.json"));
const pwaManifest = JSON.parse(read("public/manifest.webmanifest"));
const sw = read("public/sw.js");
const build = read("scripts/build-version.mjs");

const checks = [
  ["Public app title keeps the V1 release label and identifies the downloader", /<title>ARYANZZ Downloader V1/.test(html) && html.includes('name="application-name" content="ARYANZZ"')],
  ["PWA app identity uses the ARYANZZ brand rather than the internal V1 release label", pwaManifest.name === "ARYANZZ" && pwaManifest.short_name === "ARYANZZ"],
  ["Public release channel is V1 while the private cache version remains dynamic", html.includes('name="aryanzz-public-version" content="V1"') && html.includes('name="aryanzz-version" content="V1"') && html.includes('name="aryanzz-build-id" content="__ARYANZZ_VERSION__"')],
  ["Profile cover actions are moved into the profile heading", profileJs.includes("function moveCoverActions()") && profileJs.includes("moveCoverActions();installAutoSaveObserver()")],
  ["Animated GIF profile photos are stored as original blobs in IndexedDB", profileJs.includes('MOTION_AVATAR_DB="aryanzz-profile-motion-v1"') && profileJs.includes('file.type||"").toLowerCase()==="image/gif"') && profileJs.includes("saveMotionAvatar(file)") && profileJs.includes("URL.createObjectURL(blob)")],
  ["Static avatar replacement and photo removal clear the animated GIF state", profileJs.includes("d.avatarAnimated=false") && profileJs.includes("removeMotionAvatar()")],
  ["Profile identity no longer overlaps the cover and member badge stays below it", profileCss.includes("margin-top:0!important") && profileCss.includes(".ary-profile2-member-label{order:3;margin-top:7px}")],
  ["Tools Center uses the unified neutral background and readable single-column mobile cards", toolsCss.includes("#toolsArea #allTools") && toolsCss.includes("--ary-tools-bg:#0d1726") && toolsCss.includes("background:var(--ary-tools-bg)!important") && toolsCss.includes("#toolsArea #allTools .v674-tool-grid{grid-template-columns:1fr;gap:8px}")],
  ["Legacy decorative Tools gradients are no longer required by any internal tool panel", toolsCss.includes("--ary-tools-bg:#0d1726") && toolsCss.includes("background:var(--ary-tools-bg)!important") && !toolsCss.includes("radial-gradient(520px 260px")],
  ["The service worker uses the stable V1 release channel", sw.includes('const RELEASE_CHANNEL="V1"')],
  ["Package metadata and workspace manifest identify the single public V1 release", packageJson.release === "V1" && workspace.release?.publicVersion === "V1" && workspace.release?.status === "full-release"],
  ["Release JSON keeps a stable public release label beside the internal build identifier", build.includes('const publicRelease = String(packageJson.release || "V1")') && build.includes("release: publicRelease") && build.includes("version, commit, builtAt")]
];

for (const [name, ok] of checks) {
  assert.ok(ok, name + " failed");
  console.log("✔ " + name);
}
console.log("\nARYANZZ V1 profile and workspace regression tests passed.");
