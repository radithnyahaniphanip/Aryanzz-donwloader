import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packagePath = resolve(root, "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const publicRelease = String(packageJson.release || "V1").trim() || "V1";
const [major, minor, patch] = String(packageJson.version || "95.0.0").split(".").map(value => Number(value) || 0);

// Production releases must come from the serialized GitHub Actions pipeline.
// Cloudflare's independent build hook can run without GitHub identity and must not
// silently deploy a lower "local" version over a verified production release.
const runNumber = Number(process.env.GITHUB_RUN_NUMBER || 0);
const githubSha = String(process.env.GITHUB_SHA || "").trim();
const isGitHubActionsBuild = process.env.GITHUB_ACTIONS === "true" &&
  Number.isSafeInteger(runNumber) && runNumber > 0 &&
  /^[0-9a-f]{7,40}$/i.test(githubSha);
const allowLocalBuild = process.env.ARYANZZ_ALLOW_LOCAL_BUILD === "1";
if (!isGitHubActionsBuild && !allowLocalBuild) {
  throw new Error("Refusing to create a production release without a verified GitHub Actions build. Use GitHub Actions for production deployment; set ARYANZZ_ALLOW_LOCAL_BUILD=1 only for an intentional local deployment.");
}
const buildNumber = isGitHubActionsBuild ? runNumber : patch + 1;
const version = major + "." + minor + "." + buildNumber;
packageJson.version = version;
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");
const commit = isGitHubActionsBuild ? githubSha.slice(0, 8) : "local";

const workerPath = resolve(root, "src/index.js");
let worker = readFileSync(workerPath, "utf8").replaceAll("__ARYANZZ_VERSION__", version);
writeFileSync(workerPath, worker);
const wranglerPath = resolve(root, "wrangler.toml");
const wrangler = readFileSync(wranglerPath, "utf8").replaceAll("__ARYANZZ_VERSION__", version);
if (!wrangler.includes('ARYANZZ_BUILD_VERSION = "' + version + '"\n')) throw new Error("Wrangler build version variable was not generated.");
writeFileSync(wranglerPath, wrangler);
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
writeFileSync(resolve(root, "public/release.json"), JSON.stringify({ name: "ARYANZZ", release: publicRelease, releaseName: "Full Release", version, commit, builtAt: new Date().toISOString() }, null, 2) + "\n");
console.log("[ARYANZZ] Release " + version + " built from commit " + commit);
