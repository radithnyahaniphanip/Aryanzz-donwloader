import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const major = Number(String(packageJson.version || "94.0.0").split(".")[0]) || 94;
let build = Number(process.env.GITHUB_RUN_NUMBER || process.env.CF_BUILD_NUMBER || 0) || 0;
if (!build) {
  try {
    build = Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim()) || 1;
  } catch {
    build = 1;
  }
}
const version = major + "." + build;
const commit = (() => {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return process.env.CF_COMMIT_SHA?.slice(0, 8) || "local"; }
})();
writeFileSync(resolve(root, "src/build-version.js"), 'export const BUILD_VERSION = "' + version + '";\nexport const BUILD_COMMIT = "' + commit + '";\n');
const htmlPath = resolve(root, "public/index.html");
const html = readFileSync(htmlPath, "utf8").replaceAll("__ARYANZZ_VERSION__", version);
writeFileSync(htmlPath, html);
const swPath = resolve(root, "public/sw.js");
const sw = readFileSync(swPath, "utf8").replaceAll("__ARYANZZ_VERSION__", version);
writeFileSync(swPath, sw);
const manifestPath = resolve(root, "public/manifest.webmanifest");
const manifest = readFileSync(manifestPath, "utf8").replaceAll("__ARYANZZ_VERSION__", version);
writeFileSync(manifestPath, manifest);
writeFileSync(resolve(root, "public/release.json"), JSON.stringify({ name: "ARYANZZ", version, commit, builtAt: new Date().toISOString() }, null, 2) + "\n");
console.log("[ARYANZZ] Release " + version + " built from commit " + commit);
