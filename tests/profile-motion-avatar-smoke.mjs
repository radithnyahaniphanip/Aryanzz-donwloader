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
const toolboxCss = read("public/toolbox-100.css");
const toolboxJs = read("public/toolbox-100.js");
const workspaceToolsJs = read("public/workspace-tools.js");
const workspaceLayoutJs = read("public/workspace-layout.js");
const navigationJs = read("public/workspace-navigation.js");
const homeJs = read("public/workspace-home.js");
const assetCount = pattern => (html.match(pattern) || []).length;
const workspaceScriptOrder = [
  html.indexOf('/workspace-layout.js?v=__ARYANZZ_VERSION__'),
  html.indexOf('/toolbox-100.js?v=__ARYANZZ_VERSION__'),
  html.indexOf('/workspace-tools.js?v=__ARYANZZ_VERSION__'),
  html.indexOf('/workspace-navigation.js?v=__ARYANZZ_VERSION__'),
  html.indexOf('/v25.js?v=__ARYANZZ_VERSION__')
];

const checks = [
  ["Public app title keeps the V2 release label and identifies the downloader", /<title>ARYANZZ Downloader V2/.test(html) && html.includes('name="application-name" content="ARYANZZ"')],
  ["PWA app identity uses the ARYANZZ brand rather than the internal V2 release label", pwaManifest.name === "ARYANZZ" && pwaManifest.short_name === "ARYANZZ"],
  ["Public release channel is V2 while the private cache version remains dynamic", html.includes('name="aryanzz-public-version" content="V2"') && html.includes('name="aryanzz-version" content="V2"') && html.includes('name="aryanzz-build-id" content="__ARYANZZ_VERSION__"')],
  ["Profile cover actions are moved into the profile heading", profileJs.includes("function moveCoverActions()") && profileJs.includes("moveCoverActions();installAutoSaveObserver()")],
  ["Animated GIF profile photos are stored as original blobs in IndexedDB", profileJs.includes('MOTION_AVATAR_DB="aryanzz-profile-motion-v1"') && profileJs.includes('file.type||"").toLowerCase()==="image/gif"') && profileJs.includes("saveMotionAvatar(file)") && profileJs.includes("URL.createObjectURL(blob)")],
  ["Static avatar replacement and photo removal clear the animated GIF state", profileJs.includes("d.avatarAnimated=false") && profileJs.includes("removeMotionAvatar()")],
  ["Profile identity no longer overlaps the cover and member badge stays below it", profileCss.includes("margin-top:0!important") && profileCss.includes(".ary-profile2-member-label{order:3;margin-top:7px}")],
  ["Tools Center uses the unified neutral background and readable single-column mobile cards", toolsCss.includes("#toolsArea #allTools") && toolsCss.includes("--ary-tools-bg:#0d1726") && toolsCss.includes("background:var(--ary-tools-bg)!important") && toolsCss.includes("#toolsArea #allTools .v674-tool-grid{grid-template-columns:1fr;gap:8px}")],
  ["Legacy decorative Tools gradients are no longer required by any internal tool panel", toolsCss.includes("--ary-tools-bg:#0d1726") && toolsCss.includes("background:var(--ary-tools-bg)!important") && !toolsCss.includes("radial-gradient(520px 260px")],
  ["The service worker uses the stable V2 release channel", sw.includes('const RELEASE_CHANNEL="V2"')],
  ["Package metadata and workspace manifest identify the single public V2 release", packageJson.release === "V2" && workspace.release?.publicVersion === "V2" && workspace.release?.status === "full-release"],
  ["Release JSON keeps a stable public release label beside the internal build identifier", build.includes('const publicRelease = String(packageJson.release || "V2")') && build.includes("release: publicRelease") && build.includes("version, commit, builtAt")],
  ["V2 loads each Profile, Workspace and Toolbox asset exactly once with one shared build token",
    assetCount(/<link rel="stylesheet" href="\\/workspace-tools\\.css\\?v=__ARYANZZ_VERSION__">/g) === 1 &&
    assetCount(/<link rel="stylesheet" href="\\/toolbox-100\\.css\\?v=__ARYANZZ_VERSION__">/g) === 1 &&
    assetCount(/<link rel="stylesheet" href="\\/v25\\.css\\?v=__ARYANZZ_VERSION__">/g) === 1 &&
    assetCount(/<script src="\\/workspace-tools\\.js\\?v=__ARYANZZ_VERSION__">/g) === 1 &&
    assetCount(/<script src="\\/toolbox-100\\.js\\?v=__ARYANZZ_VERSION__">/g) === 1 &&
    assetCount(/<script src="\\/v25\\.js\\?v=__ARYANZZ_VERSION__" defer>/g) === 1],
  ["Service Worker precaches the same V2 Profile and Workspace assets served by the homepage",
    ["/workspace-tools.css", "/toolbox-100.css", "/toolbox-100.js", "/v25.css", "/v25.js", "/arya-v2-refresh.css", "/arya-v2-refresh.js"].every(asset => sw.includes(asset + "?v=__ARYANZZ_VERSION__"))],
  ["Workspace layout mounts Toolbox before search/back navigation initializes",
    workspaceScriptOrder.every(index => index >= 0) && workspaceScriptOrder.every((index, i) => i === 0 || workspaceScriptOrder[i - 1] < index) &&
    toolboxJs.includes('panel.id="toolbox100"') && toolboxJs.includes("toolsArea.insertBefore(panel,profilePanel||null)") &&
    workspaceToolsJs.includes("root.insertBefore(backbar,root.firstChild)") && navigationJs.includes("candidate.parentElement!==toolsArea")],
  ["Profile, Tools and Toolbox keep independent ownership inside the single V2 release",
    workspace.workspaces.profile.root === "#profile" && workspace.workspaces.profile.js.includes("/v25.js") &&
    workspace.workspaces.tools.root === "#toolsArea" && workspace.workspaces.tools.js.includes("/workspace-tools.js") &&
    workspace.featureModules.some(module => module.root === "#toolbox100" && module.css.includes("/toolbox-100.css") && module.js.includes("/toolbox-100.js")) &&
    toolsCss.includes("#toolsArea") && toolboxCss.includes("#toolbox100") && homeJs.includes('home.dataset.workspace="home"')],
  ["Legacy-named V1 assets remain internal modules, not a second public release",
    packageJson.release === "V2" && html.includes('name="aryanzz-public-version" content="V2"') &&
    sw.includes('const RELEASE_CHANNEL="V2"') && workspace.release?.publicVersion === "V2"]
];

for (const [name, ok] of checks) {
  assert.ok(ok, name + " failed");
  console.log("✔ " + name);
}
console.log("\nARYANZZ V2 profile and workspace regression tests passed.");
