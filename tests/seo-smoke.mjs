import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ORIGIN = "https://aryanzz-donwloader.aryanz.workers.dev";
const OLD_ORIGIN = "https://aryanzz-donwloader.radithnyahaniphanip.workers.dev";
const home = readFileSync("public/index.html", "utf8");
const guide = readFileSync("public/panduan.html", "utf8");
const video = readFileSync("public/download-video.html", "utf8");
const mp3 = readFileSync("public/download-mp3.html", "utf8");
const image = readFileSync("public/download-gambar.html", "utf8");
const sitemap = readFileSync("public/sitemap.xml", "utf8");
const sitemapTxt = readFileSync("public/sitemap.txt", "utf8");
const robots = readFileSync("public/robots.txt", "utf8");
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
const serviceWorker = readFileSync("public/sw.js", "utf8");
const worker = readFileSync("src/index.js", "utf8");

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
assert.match(title(home), /ARYANZZ Downloader V1|ARYANZZ Downloader/i);
assert.ok(title(home).length >= 45 && title(home).length <= 65, "Homepage title should be concise");
assert.equal(meta(home, "application-name"), "ARYANZZ");
assert.equal(meta(home, "apple-mobile-web-app-title"), "ARYANZZ");
assert.equal(meta(home, "og:site_name", "property"), "ARYANZZ");
assert.ok(home.includes('rel="icon" type="image/svg+xml" href="/favicon.svg'), "Google and browsers receive the custom ARYANZZ SVG favicon");
const homeDescription = meta(home, "description");
assert.ok(homeDescription.length >= 120 && homeDescription.length <= 165, "Homepage meta description should be a useful search snippet");
assert.ok(home.includes("<h1>Download Video Online<br><span>Audio MP3 &amp; Gambar</span></h1>"));
assert.ok(home.includes('href="/panduan"'), "Homepage should link to the general guide");
for (const path of ["/download-video", "/download-mp3", "/download-gambar"]) {
  assert.ok(home.includes('href="' + path + '"'), "Homepage should link to " + path);
}
assert.ok(meta(home, "robots").includes("index,follow"));
assert.ok(meta(home, "og:image:alt", "property"), "Homepage social image should have descriptive alt text");

const homeSchemas = jsonLd(home).flatMap(schema => schema["@graph"] ?? [schema]);
const websiteSchema = homeSchemas.find(schema => schema["@type"] === "WebSite");
assert.ok(websiteSchema, "Homepage WebSite schema is required");
assert.equal(websiteSchema.name, "ARYANZZ");
assert.equal(websiteSchema.alternateName, "ARYANZZ Downloader");
const appSchema = homeSchemas.find(schema => schema["@type"] === "SoftwareApplication");
assert.ok(appSchema, "SoftwareApplication schema is required");
assert.equal(appSchema.softwareVersion, "V1");
assert.equal(appSchema.isAccessibleForFree, true);
assert.ok(Array.isArray(appSchema.featureList) && appSchema.featureList.length >= 4);

assert.equal(canonical(guide), ORIGIN + "/panduan", "Guide canonical must use the official production origin");
assert.match(title(guide), /Panduan ARYANZZ Downloader/i);
const guideDescriptionValue = meta(guide, "description");
assert.ok(guideDescriptionValue.length >= 120 && guideDescriptionValue.length <= 170);
assert.equal((guide.match(/<h1\b/gi) ?? []).length, 1);
const guideSchemas = jsonLd(guide).flatMap(schema => schema["@graph"] ?? [schema]);
assert.ok(guideSchemas.some(schema => schema["@type"] === "BreadcrumbList"));
const faq = guideSchemas.find(schema => schema["@type"] === "FAQPage");
assert.ok(faq && faq.mainEntity.length >= 6, "General guide FAQ schema is required");
for (const item of faq.mainEntity) {
  assert.ok(guide.includes(item.name), "FAQ question must also be visible: " + item.name);
  assert.ok(item.acceptedAnswer?.text?.length > 30);
}
for (const path of ["/download-video", "/download-mp3", "/download-gambar"]) {
  assert.ok(guide.includes('href="' + path + '"'), "General guide should link to " + path);
}

const landingPages = [
  { html: video, path: "/download-video", phrase: "Download Video Online", related: ["/download-mp3", "/download-gambar"] },
  { html: mp3, path: "/download-mp3", phrase: "Download Audio MP3", related: ["/download-video", "/download-gambar"] },
  { html: image, path: "/download-gambar", phrase: "Download Gambar Online", related: ["/download-video", "/download-mp3"] }
];
for (const page of landingPages) {
  assert.equal(canonical(page.html), ORIGIN + page.path, page.path + " canonical must match the clean public URL");
  assert.ok(title(page.html).length >= 35 && title(page.html).length <= 65, page.path + " title should be concise");
  const description = meta(page.html, "description");
  assert.ok(description.length >= 120 && description.length <= 170, page.path + " needs a unique useful description");
  assert.ok(meta(page.html, "robots").includes("index,follow"));
  assert.equal((page.html.match(/<h1\b/gi) ?? []).length, 1, page.path + " must have one primary heading");
  assert.ok(page.html.includes(page.phrase), page.path + " must use its primary search phrase naturally");
  assert.ok(page.html.includes('href="/#home"'), page.path + " must link to the working downloader");
  assert.ok(page.html.includes('href="/panduan"'), page.path + " must link to the general guide");
  for (const relatedPath of page.related) {
    assert.ok(page.html.includes('href="' + relatedPath + '"'), page.path + " should link to related media guides");
  }
  const schemas = jsonLd(page.html).flatMap(schema => schema["@graph"] ?? [schema]);
  assert.ok(schemas.some(schema => schema["@type"] === "WebPage"), page.path + " WebPage schema is required");
  assert.ok(schemas.some(schema => schema["@type"] === "BreadcrumbList"), page.path + " breadcrumb schema is required");
  assert.ok((page.html.match(/<details>/g) ?? []).length >= 4, page.path + " should include useful visible FAQs");
}

const expectedUrls = [ORIGIN + "/", ORIGIN + "/panduan", ORIGIN + "/download-video", ORIGIN + "/download-mp3", ORIGIN + "/download-gambar"];
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.deepEqual(sitemapUrls, expectedUrls, "Static sitemap must list every public SEO page");
for (const url of expectedUrls) assert.ok(sitemapTxt.includes(url), "Text sitemap must include " + url);
assert.ok(robots.includes("Disallow: /api/"));
assert.ok(robots.includes("Sitemap: " + ORIGIN + "/sitemap.xml"));
assert.equal(manifest.lang, "id-ID");
assert.ok(manifest.description.includes("video, audio, dan gambar"));
for (const path of ["/panduan", "/download-video", "/download-mp3", "/download-gambar"]) {
  assert.ok(serviceWorker.includes('"' + path + '"'), "PWA shell should include " + path);
}

const sitemapStart = worker.indexOf('if(url.pathname==="/sitemap.xml"');
const sitemapEnd = worker.indexOf('if(url.pathname==="/sitemap.txt"', sitemapStart);
const sitemapRoute = worker.slice(sitemapStart, sitemapEnd);
assert.ok(sitemapStart >= 0 && sitemapEnd > sitemapStart, "Worker must expose a dedicated XML sitemap route");
for (const path of ["/", "/panduan", "/download-video", "/download-mp3", "/download-gambar"]) {
  assert.ok(sitemapRoute.includes('"' + path + '"'), "Worker-generated sitemap must include " + path);
}
assert.ok(sitemapRoute.includes("?>\\n<urlset"), "Worker sitemap must use real newline escapes");
assert.ok(!sitemapRoute.includes("?>\\\\n<urlset"), "Worker sitemap must not emit literal backslash-n text");
const robotsStart = worker.indexOf('if(url.pathname==="/robots.txt"');
const robotsEnd = worker.indexOf('if(request.method==="OPTIONS"', robotsStart);
const robotsRoute = worker.slice(robotsStart, robotsEnd);
assert.ok(robotsRoute.includes("User-agent: *\\nAllow: /"), "Worker robots response must use newline escapes");
assert.ok(!robotsRoute.includes("User-agent: *\\\\n"), "Worker robots response must not emit literal backslash-n text");

for (const [name, content] of [["homepage",home],["guide",guide],["video page",video],["MP3 page",mp3],["image page",image],["sitemap",sitemap],["sitemap text",sitemapTxt],["robots",robots],["manifest",JSON.stringify(manifest)]]) {
  assert.ok(!content.includes(OLD_ORIGIN), name + " must not advertise the retired production origin");
}

console.log("SEO smoke test passed: homepage, three keyword landing pages, canonical metadata, structured data, internal links, XML/text sitemap, robots, manifest, and PWA shell.");
