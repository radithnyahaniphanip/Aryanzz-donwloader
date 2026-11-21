import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE || "/tmp/aryanzz-qa/node_modules/playwright/index.mjs";
const { chromium } = await import(pathToFileURL(modulePath).href);
const WORKER_URL = String(process.env.WORKER_URL || "https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/+$/, "");
const EXPECTED_BUILD_VERSION = String(process.env.EXPECTED_BUILD_VERSION || "").trim();
if (!EXPECTED_BUILD_VERSION) throw new Error("EXPECTED_BUILD_VERSION is required.");

const startsWith = (bytes, values) => values.every((value, index) => bytes[index] === value);
const containsAscii = (bytes, value) => bytes.includes(Buffer.from(value, "ascii"));
const tests = [
  { name: "MP4", ext: "mp4", mode: "video", url: "https://pnb-website-bucket.s3.us-east-2.amazonaws.com/samples/videos/mp4/sample-video-480x270-1mb.mp4", signature: bytes => containsAscii(bytes, "ftyp") },
  { name: "WebM", ext: "webm", mode: "video", url: "https://pnb-website-bucket.s3.us-east-2.amazonaws.com/samples/videos/webm/sample-video-480x270-1mb.webm", signature: bytes => startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) },
  { name: "MKV", ext: "mkv", mode: "video", url: "https://pnb-website-bucket.s3.us-east-2.amazonaws.com/samples/videos/mkv/sample-video-480x270-1mb.mkv", signature: bytes => startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) },
  { name: "MP3", ext: "mp3", mode: "audio", url: "https://pnb-freetoolsforweb.s3.us-east-2.amazonaws.com/samples/audio/mp3/sample-audio-15s-mono-64kbps.mp3", signature: bytes => bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) },
  { name: "WAV", ext: "wav", mode: "audio", url: "https://pnb-website-bucket.s3.us-east-2.amazonaws.com/samples/audio/wav/sample-audio-10s-8khz-mono.wav", signature: bytes => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE" },
  { name: "FLAC", ext: "flac", mode: "audio", url: "https://pnb-website-bucket.s3.us-east-2.amazonaws.com/samples/audio/flac/sample-audio-10s.flac", signature: bytes => bytes.subarray(0, 4).toString("ascii") === "fLaC" },
  { name: "OGG", ext: "ogg", mode: "audio", url: "https://pnb-website-bucket.s3.us-east-2.amazonaws.com/samples/audio/ogg/sample-audio-15s.ogg", signature: bytes => bytes.subarray(0, 4).toString("ascii") === "OggS" }
];

async function openHome(context, label) {
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(WORKER_URL + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("#url").waitFor({ state: "visible", timeout: 90000 });
  const build = await page.locator('meta[name="aryanzz-build-id"]').getAttribute("content");
  assert.equal(build, EXPECTED_BUILD_VERSION, label + " HTML build ID mismatch: " + build);
  const layout = await page.evaluate(() => {
    const rect = element => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    };
    return {
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      input: rect(document.querySelector("#url")),
      button: rect(document.querySelector("#analyze"))
    };
  });
  assert.ok(layout.documentWidth <= layout.width + 2, label + " page has horizontal overflow: document=" + layout.documentWidth + "px, viewport=" + layout.width + "px.");
  assert.ok(layout.input.width >= 100 && layout.input.height >= 24, label + " URL input is too small.");
  assert.ok(layout.button.width >= 60 && layout.button.height >= 24, label + " Analyze button is too small.");
  assert.ok(layout.input.left >= -2 && layout.input.right <= layout.width + 2, label + " URL input is clipped outside viewport.");
  assert.ok(layout.button.left >= -2 && layout.button.right <= layout.width + 2, label + " Analyze button is clipped outside viewport.");

  // Regression for real Android screenshot: a five-column legacy grid put the
  // sixth "Member" tab on a second row and obscured the QRIS checkout.
  const navigation = await page.evaluate(() => {
    const element = document.querySelector("nav.nav");
    const outer = element.getBoundingClientRect();
    const tabs = Array.from(element.querySelectorAll("button")).map(button => {
      const rect = button.getBoundingClientRect();
      return { key: button.dataset.nav, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    return {
      display: getComputedStyle(element).display,
      outer: { left: outer.left, right: outer.right, top: outer.top, bottom: outer.bottom, height: outer.height },
      tabs
    };
  });
  assert.equal(navigation.tabs.length, 6, label + " must preserve all six navigation tabs.");
  if (layout.width < 900) {
    assert.equal(navigation.display, "grid", label + " must use a six-column bottom nav.");
    assert.ok(navigation.tabs.every(t => Math.abs(t.top - navigation.tabs[0].top) <= 3),
      label + " Member nav wrapped to a second row: " + JSON.stringify(navigation.tabs));
    assert.ok(navigation.tabs.every(t => t.left >= navigation.outer.left - 2 && t.right <= navigation.outer.right + 2),
      label + " navigation tab overflows its dock.");
    assert.ok(navigation.outer.height < 110, label + " mobile dock is too tall.");
    await page.locator('nav.nav button[data-nav="membership"]').click();
    await page.locator("#membership").waitFor({ state: "visible", timeout: 15000 });
    // User's Android screenshot showed cramped Profile heading and Pustaka
    // cards overflowing their shared page gutters.
    if(layout.width<=767){
      await page.locator('nav.nav button[data-nav="history"]').click();
      await page.locator('#history').waitFor({state:"visible",timeout:15000});
      const libraryGeometry=await page.evaluate(()=>{
        const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}};
        const root=document.querySelector("#history");
        return {panel:box(root),hero:box(root.querySelector(".ary-library-hero")),stats:box(root.querySelector(".ary-library-stats")),filter:box(root.querySelector(".ary-library-filter-row")),title:root.querySelector(".ary-library-hero h2")?.textContent?.trim(),legacyHeader:!!root.querySelector(":scope > .v677-feature-hero")};
      });
      assert.equal(libraryGeometry.title,"Pustaka",label+" Pustaka must not inherit duplicate 'Your Library • 05' header text");
      assert.equal(libraryGeometry.legacyHeader,false,label+" Pustaka must not have a second header injected by V67.7");
      assert.ok(libraryGeometry.hero.top>=libraryGeometry.panel.top+8,
        label+" Pustaka hero overlaps panel border: "+JSON.stringify(libraryGeometry));
      assert.ok(libraryGeometry.hero.left>=libraryGeometry.panel.left-2&&libraryGeometry.hero.right<=libraryGeometry.panel.right+2,
        label+" Pustaka hero overflows its container");
      assert.ok(libraryGeometry.filter.left>=libraryGeometry.panel.left-2&&libraryGeometry.filter.right<=libraryGeometry.panel.right+2,
        label+" Pustaka filters overflow their container");
      await page.locator('nav.nav button[data-nav="profile"]').click();
      await page.locator('#profile').waitFor({state:"visible",timeout:15000});
      const profileGeometry=await page.evaluate(()=>{
        const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}};
        const root=document.querySelector("#profile");
        return {panel:box(root),heading:box(root.querySelector(".ary-profile2-header h1")),hero:box(root.querySelector(".ary-profile2-hero")),stats:box(root.querySelector(".ary-profile2-stats"))};
      });
      assert.ok(profileGeometry.heading.top>=profileGeometry.panel.top+16,
        label+" Profil Saya title touches the panel border: "+JSON.stringify(profileGeometry));
      assert.ok(profileGeometry.heading.left>=profileGeometry.panel.left+12,
        label+" Profil Saya title is too close to the left border: "+JSON.stringify(profileGeometry));
      assert.ok(profileGeometry.hero.left>=profileGeometry.panel.left+10,
        label+" Profile cover needs consistent inner gutters: "+JSON.stringify(profileGeometry));
      assert.ok(profileGeometry.hero.left>=profileGeometry.panel.left-2&&profileGeometry.hero.right<=profileGeometry.panel.right+2,
        label+" Profile card spills outside the shared gutters");
      assert.ok(Math.abs(profileGeometry.panel.left-libraryGeometry.panel.left)<6,
        label+" Pustaka and Profil panel gutters should match");
    }
    await page.locator('nav.nav button[data-nav="home"]').click();
    await page.locator("#url").waitFor({ state: "visible", timeout: 15000 });
  } else {
    assert.equal(navigation.display, "flex", label + " should retain the desktop vertical sidebar.");
    assert.ok(navigation.tabs.every((t,i) => i===0 || t.top >= navigation.tabs[i-1].bottom - 2),
      label + " desktop navigation is not a vertical rail.");
    assert.ok(navigation.outer.left >= 0 && navigation.outer.left <= 42,
      label + " desktop navigation rail is not left-aligned.");

    const homeTypography = await page.evaluate(() => {
      const title=document.querySelector("#home .ary-v1-hero-title");
      const lines=[...(title?.querySelectorAll(".ary-v1-hero-line")||[])].map(el=>{
        const box=el.getBoundingClientRect();
        return {text:el.textContent.trim(),whiteSpace:getComputedStyle(el).whiteSpace,
          clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,top:box.top,bottom:box.bottom};
      });
      const headline=document.querySelector("#aryWorkspaceHeadline");
      const platformTiles=[...document.querySelectorAll("#home .v736-platform")].slice(0,8).map(el=>{
        const logo=el.querySelector(".v736-logo")?.getBoundingClientRect();
        const card=el.getBoundingClientRect();
        return {top:card.top,height:card.height,logoWidth:logo?.width||0,logoHeight:logo?.height||0};
      });
      return {lines,headlineWidth:headline?.getBoundingClientRect().width||0,platformTiles};
    });
    assert.equal(homeTypography.lines.length,2,label+" desktop hero should contain exactly two intentional full-word lines.");
    assert.ok(homeTypography.lines.every(line=>line.whiteSpace==="nowrap"&&line.scrollWidth<=line.clientWidth+3),
      label+" hero is fragmented or clipped: "+JSON.stringify(homeTypography.lines));
    assert.ok(homeTypography.lines[1].top>=homeTypography.lines[0].bottom-2,
      label+" desktop hero lines overlap");
    assert.ok(homeTypography.headlineWidth>190,label+" downloader headline is compressed");
    assert.ok(homeTypography.platformTiles.length>=4&&homeTypography.platformTiles.every(t=>t.logoWidth>=28&&t.logoHeight>=28),
      label+" desktop platform icons are not sized consistently");

  }

  const startup=await page.evaluate(()=>{
    const n=performance.getEntriesByType("navigation")[0];
    const entries=performance.getEntriesByType("resource");
    return {
      ttfb:n?Math.round(n.responseStart-n.requestStart):null,
      domContentLoaded:n?Math.round(n.domContentLoadedEventEnd-n.startTime):null,
      load:n&&n.loadEventEnd?Math.round(n.loadEventEnd-n.startTime):null,
      css:entries.filter(r=>/\.css(?:\?|$)/.test(r.name)).length,
      js:entries.filter(r=>/\.js(?:\?|$)/.test(r.name)).length
    };
  });
  console.log("STARTUP "+label+" metrics: "+JSON.stringify(startup));
  console.log("PASS " + label + " layout: viewport=" + layout.width + "px, document=" + layout.documentWidth + "px, controls and all six nav tabs visible.");
  return page;
}

async function readServiceWorkerVersion(page) {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active || navigator.serviceWorker.controller;
    if (!worker) return "no-active-worker";
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => {
        channel.port1.close();
        resolve("timeout");
      }, 12000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        resolve(String(event.data?.buildId || "missing"));
        channel.port1.close();
      };
      worker.postMessage({ type: "ARYANZZ_GET_VERSION" }, [channel.port2]);
    });
  });
}

async function testDownload(page, test, deviceLabel) {
  await page.locator("#url").fill(test.url);
  await page.locator("#analyze").click();
  await page.waitForFunction(() => {
    const result = document.querySelector("#downloadResult");
    return !!result && !result.hidden && Array.from(result.querySelectorAll("button")).some(button => /Unduh file asli/i.test(button.textContent || ""));
  }, null, { timeout: 90000 });
  const resultText = await page.locator("#downloadResult").innerText();
  assert.ok(resultText.includes("File langsung"), deviceLabel + " " + test.name + " was not identified as a direct media file: " + resultText.slice(0, 500));
  const detectedMode = await page.locator("#aryMode").inputValue();
  assert.equal(detectedMode, test.mode, deviceLabel + " " + test.name + " selected the wrong media mode: " + detectedMode);
  const button = page.getByRole("button", { name: /Unduh file asli/i });
  await button.waitFor({ state: "visible", timeout: 30000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 90000 });
  await button.click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  assert.ok(filename.toLowerCase().endsWith("." + test.ext), deviceLabel + " " + test.name + " filename extension mismatch: " + filename);
  const path = await download.path();
  assert.ok(path, deviceLabel + " " + test.name + " download did not produce a file.");
  const bytes = readFileSync(path);
  assert.ok(bytes.length > 0, deviceLabel + " " + test.name + " downloaded an empty file.");
  assert.ok(test.signature(bytes.subarray(0, 64)), deviceLabel + " " + test.name + " file signature mismatch.");
  console.log("PASS " + deviceLabel + " " + test.name + ": " + filename + " (" + bytes.length + " bytes, signature valid).");
}

async function testInvalidMedia(page) {
  await page.locator("#url").fill("https://httpbin.org/anything/not-a-video.mp4");
  await page.locator("#analyze").click();
  await page.waitForFunction(() => {
    const result = document.querySelector("#downloadResult");
    return !!result && !result.hidden && /bukan file media|tidak cocok dengan tanda tangan|tanda tangan.*media|file tidak cocok/i.test(result.innerText || "");
  }, null, { timeout: 90000 });
  const text = await page.locator("#downloadResult").innerText();
  const hasDownload = await page.getByRole("button", { name: /Unduh file asli/i }).count();
  assert.equal(hasDownload, 0, "A JSON/HTML response with an .mp4 suffix must not produce a download action.");
  assert.ok(/bukan file media|file tidak cocok|tanda tangan|tidak cocok|gagal|error/i.test(text), "Invalid media response did not show a useful rejection message: " + text.slice(0, 500));
  console.log("PASS invalid .mp4 URL: non-media response rejected before download.");
}

async function testPwaAndStorage(page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  const version = await readServiceWorkerVersion(page);
  assert.equal(version, EXPECTED_BUILD_VERSION, "Service Worker build mismatch: " + version);
  const installedStatic = await page.evaluate(async build => {
    const cache=await caches.open("aryanzz-build-"+build);
    const entry=await cache.match("/v674.css?v="+build);
    return !!entry && entry.ok && (entry.headers.get("content-type")||"").includes("text/css");
  }, EXPECTED_BUILD_VERSION);
  assert.ok(installedStatic,"Versioned static CSS must be installed for instant repeat visits.");
  const cacheNames = await page.evaluate(() => caches.keys());
  assert.ok(cacheNames.includes("aryanzz-build-" + EXPECTED_BUILD_VERSION), "Current versioned PWA cache is missing: " + cacheNames.join(", "));
  const marker = "qa-preserve-" + Date.now();
  await page.evaluate(async marker => {
    localStorage.setItem("aryanzz-qa-preserve", marker);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("aryanzz-offline-v1", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("settings")) database.createObjectStore("settings", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    });
    if (!db.objectStoreNames.contains("settings")) throw new Error("PWA settings object store is missing.");
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("settings", "readwrite");
      transaction.objectStore("settings").put({ key: marker, value: "preserved" });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB write failed"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB write aborted"));
    });
    db.close();
  }, marker);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("#url").waitFor({ state: "visible", timeout: 90000 });
  const persisted = await page.evaluate(async marker => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("aryanzz-offline-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB reopen failed"));
    });
    const value = await new Promise((resolve, reject) => {
      const transaction = db.transaction("settings", "readonly");
      const request = transaction.objectStore("settings").get(marker);
      request.onsuccess = () => resolve(request.result?.value || "");
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
    });
    db.close();
    return { local: localStorage.getItem("aryanzz-qa-preserve"), indexed: value };
  }, marker);
  assert.equal(persisted.local, marker, "localStorage marker was lost after reload.");
  assert.equal(persisted.indexed, "preserved", "IndexedDB marker was lost after reload.");
  const afterVersion = await readServiceWorkerVersion(page);
  assert.equal(afterVersion, EXPECTED_BUILD_VERSION, "Service Worker changed or became stale after reload: " + afterVersion);
  console.log("PASS PWA: active SW " + afterVersion + ", versioned cache present, localStorage and IndexedDB test records survived reload.");
}

const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    acceptDownloads: true,
    serviceWorkers: "allow"
  });
  const desktopPage = await openHome(desktop, "Desktop Chromium");
  await testPwaAndStorage(desktopPage);
  for (const test of tests) await testDownload(desktopPage, test, "Desktop");
  await testInvalidMedia(desktopPage);
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
    serviceWorkers: "allow",
    userAgent: "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
  });
  const mobilePage = await openHome(mobile, "Android-like Chromium");
  await testDownload(mobilePage, tests[0], "Android-like");
  await testDownload(mobilePage, tests[3], "Android-like");
  await mobile.close();

  // Additional narrow-screen QA for Android WebView sizes like the screenshot.
  const narrowMobile = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "allow"
  });
  await openHome(narrowMobile, "Narrow Android 360px");
  await narrowMobile.close();

  console.log("All live browser compatibility checks passed for build " + EXPECTED_BUILD_VERSION + ".");
} finally {
  await browser.close();
}
