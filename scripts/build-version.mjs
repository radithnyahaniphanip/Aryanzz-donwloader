import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const [major, minor, patch] = String(packageJson.version || "94.14.0").split(".").map(value => Number(value) || 0);

// Keep the release line in package.json; use the workflow run number as the
// monotonically increasing build component so every successful push gets a new version.
const runNumber = Number(process.env.GITHUB_RUN_NUMBER || process.env.CF_BUILD_NUMBER || 0);
const buildNumber = runNumber > 0 ? runNumber : patch;
const version = major + "." + minor + "." + buildNumber;
const commit = String(process.env.GITHUB_SHA || process.env.CF_COMMIT_SHA || "local").slice(0, 8);

writeFileSync(resolve(root, "src/build-version.js"), 'export const BUILD_VERSION = "' + version + '";\nexport const BUILD_COMMIT = "' + commit + '";\n');

const htmlPath = resolve(root, "public/index.html");
let html = readFileSync(htmlPath, "utf8").replaceAll("__ARYANZZ_VERSION__", version);
// Every local JS/CSS asset gets the same release query, preventing old browser
// and service-worker caches from mixing assets from different releases.
html = html.replace(/((?:src|href)=["']\/[^"']+\.(?:js|css))\?v=[^"']+(["'])/g, "$1?v=" + version + "$2");
html = html.replace(/(serviceWorker\.register\(["']\/sw\.js)\?v=[^"']+(["'])/g, "$1?v=" + version + "$2");
writeFileSync(htmlPath, html);

const swPath = resolve(root, "public/sw.js");
let sw = readFileSync(swPath, "utf8").replaceAll("__ARYANZZ_VERSION__", version);
sw = sw.replace(/(["']\/[^"']+\.(?:js|css))\?v=[^"']+(["'])/g, "$1?v=" + version + "$2");
writeFileSync(swPath, sw);

const manifestPath = resolve(root, "public/manifest.webmanifest");
const manifest = readFileSync(manifestPath, "utf8").replaceAll("__ARYANZZ_VERSION__", version);
writeFileSync(manifestPath, manifest);
writeFileSync(resolve(root, "public/release.json"), JSON.stringify({ name: "ARYANZZ", version, commit, builtAt: new Date().toISOString() }, null, 2) + "\n");
console.log("[ARYANZZ] Release " + version + " built from commit " + commit);
