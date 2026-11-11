import assert from "node:assert/strict";
import worker from "../src/index.js";

const DEFAULT_ORIGIN = "https://aryanzz-donwloader.aryanz.workers.dev";
const CUSTOM_ORIGIN = "https://aryanzz.net";
const SEO_PATHS = ["/", "/panduan", "/download-video", "/download-mp3", "/download-gambar"];

function envFor(origin, htmlPath = "/") {
  const html = `<!doctype html><html lang="id"><head>
    <link rel="canonical" href="${DEFAULT_ORIGIN}${htmlPath}">
    <meta property="og:url" content="${DEFAULT_ORIGIN}${htmlPath}">
    <script type="application/ld+json">{"url":"${DEFAULT_ORIGIN}${htmlPath}"}</script>
  </head><body>ARYANZZ</body></html>`;
  return {
    ARYANZZ_PUBLIC_ORIGIN: origin,
    ASSETS: {
      fetch: async () => new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    }
  };
}

for (const path of SEO_PATHS) {
  const response = await worker.fetch(
    new Request(CUSTOM_ORIGIN + path),
    envFor(CUSTOM_ORIGIN, path)
  );
  assert.equal(response.status, 200, path + " should remain available");
  assert.match(response.headers.get("content-type") || "", /text\/html/i);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  const html = await response.text();
  assert.ok(html.includes(CUSTOM_ORIGIN + path), path + " canonical and social metadata should use the configured domain");
  assert.ok(!html.includes(DEFAULT_ORIGIN), path + " must not advertise the workers.dev origin after custom-domain activation");
}

const sitemapPaths = SEO_PATHS;
const sitemapResponse = await worker.fetch(
  new Request(CUSTOM_ORIGIN + "/sitemap.xml"),
  envFor(CUSTOM_ORIGIN)
);
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
for (const path of sitemapPaths) {
  assert.ok(sitemap.includes("<loc>" + CUSTOM_ORIGIN + path + "</loc>"), "XML sitemap must include " + path + " on the configured domain");
}
assert.ok(!sitemap.includes(DEFAULT_ORIGIN), "XML sitemap must not advertise workers.dev after custom-domain activation");

const textSitemapResponse = await worker.fetch(
  new Request(CUSTOM_ORIGIN + "/sitemap.txt"),
  envFor(CUSTOM_ORIGIN)
);
assert.equal(textSitemapResponse.status, 200);
const textSitemap = await textSitemapResponse.text();
assert.ok(textSitemap.includes(CUSTOM_ORIGIN + "/download-video"));
assert.ok(!textSitemap.includes(DEFAULT_ORIGIN));

const robotsResponse = await worker.fetch(
  new Request(CUSTOM_ORIGIN + "/robots.txt"),
  envFor(CUSTOM_ORIGIN)
);
assert.equal(robotsResponse.status, 200);
const robots = await robotsResponse.text();
assert.ok(robots.includes("Sitemap: " + CUSTOM_ORIGIN + "/sitemap.xml"));
assert.ok(!robots.includes(DEFAULT_ORIGIN));

const invalidOriginResponse = await worker.fetch(
  new Request(CUSTOM_ORIGIN + "/download-video"),
  envFor("http://not-secure.example", "/download-video")
);
const invalidOriginHtml = await invalidOriginResponse.text();
assert.ok(invalidOriginHtml.includes(DEFAULT_ORIGIN), "Invalid public-origin configuration must safely fall back to the current official origin");
assert.ok(!invalidOriginHtml.includes("http://not-secure.example"));

console.log("Custom-domain origin smoke test passed: HTML canonicals, Open Graph, JSON-LD, XML/text sitemaps, robots.txt, and invalid-origin fallback.");
