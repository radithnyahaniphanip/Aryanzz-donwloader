import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ORIGIN = "https://aryanzz-donwloader.aryanz.workers.dev";
const OLD_ORIGIN = "https://aryanzz-donwloader.radithnyahaniphanip.workers.dev";
const home = readFileSync("public/index.html", "utf8");
const guide = readFileSync("public/panduan.html", "utf8");
const sitemap = readFileSync("public/sitemap.xml", "utf8");
const robots = readFileSync("public/robots.txt", "utf8");
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
const serviceWorker = readFileSync("public/sw.js", "utf8");

function meta(html, key, attribute = "name") {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp('<meta[^>]+\\b' + attribute + '="' + escaped + '"[^>]+content="([^"]*)"', "i"));
  return match?.[1] ?? "";
}
function canonical(html) {
  return html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? "";
}
function title(html) {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
}
function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
    .map(match => JSON.parse(match[1]));
}

assert.equal(canonical(home), ORIGIN + "/", "Homepage canonical must use the official production origin");
assert.match(title(home), /ARYANZZ Downloader V1/i);
assert.ok(title(home).length >= 45 && title(home).length <= 65, "Homepage title should be concise");
const homeDescription = meta(home, "description");
assert.ok(homeDescription.length >= 120 && homeDescription.length <= 165, "Homepage meta description should be a useful search snippet");
assert.ok(home.includes('<h1>Unduh Video, Audio &amp; Gambar<br><span>dari Satu Tautan</span></h1>'));
assert.ok(home.includes('href="/panduan.html"'), "Homepage should link to the crawlable guide page");
assert.ok(meta(home, "robots").includes("index,follow"));
assert.ok(meta(home, "og:image:alt", "property"), "Homepage social image should have descriptive alt text");

const homeSchemas = jsonLd(home).flatMap(schema => schema["@graph"] ?? [schema]);
assert.ok(homeSchemas.some(schema => schema["@type"] === "WebSite"), "Homepage WebSite schema is required");
const appSchema = homeSchemas.find(schema => schema["@type"] === "SoftwareApplication");
assert.ok(appSchema, "SoftwareApplication schema is required");
assert.equal(appSchema.softwareVersion, "V1");
assert.equal(appSchema.isAccessibleForFree, true);
assert.ok(Array.isArray(appSchema.featureList) && appSchema.featureList.length >= 4);

assert.equal(canonical(guide), ORIGIN + "/panduan.html", "Guide canonical must use the official production origin");
assert.match(title(guide), /Panduan ARYANZZ Downloader/i);
const guideDescriptionValue = meta(guide, "description");
assert.ok(guideDescriptionValue.length >= 120 && guideDescriptionValue.length <= 170, "Guide meta description should be a useful search snippet");
assert.equal((guide.match(/<h1\b/gi) ?? []).length, 1, "Guide page should have exactly one primary heading");
const guideSchemas = jsonLd(guide).flatMap(schema => schema["@graph"] ?? [schema]);
assert.ok(guideSchemas.some(schema => schema["@type"] === "BreadcrumbList"), "Guide breadcrumb schema is required");
const faq = guideSchemas.find(schema => schema["@type"] === "FAQPage");
assert.ok(faq && faq.mainEntity.length >= 6, "FAQ schema must describe the visible FAQ content");
for (const item of faq.mainEntity) {
  assert.ok(guide.includes(item.name), "FAQ question must also be visible on the page: " + item.name);
  assert.ok(item.acceptedAnswer?.text?.length > 30, "FAQ answer must contain useful text");
}

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.deepEqual(sitemapUrls, [ORIGIN + "/", ORIGIN + "/panduan.html"]);
assert.ok(sitemap.includes("<lastmod>2026-11-11</lastmod>"));
assert.ok(robots.includes("Disallow: /api/"));
assert.ok(robots.includes("Sitemap: " + ORIGIN + "/sitemap.xml"));
assert.equal(manifest.lang, "id-ID");
assert.ok(manifest.description.includes("video, audio, dan gambar"));
assert.ok(serviceWorker.includes('"/panduan.html"'), "PWA shell should cache the guide page");

for (const [name, content] of [["homepage",home],["guide",guide],["sitemap",sitemap],["robots",robots],["manifest",JSON.stringify(manifest)]]) {
  assert.ok(!content.includes(OLD_ORIGIN), name + " must not advertise the retired production origin");
}

console.log("SEO smoke test passed: canonical URLs, metadata, structured data, FAQ visibility, sitemap, robots, manifest, and PWA shell.");
