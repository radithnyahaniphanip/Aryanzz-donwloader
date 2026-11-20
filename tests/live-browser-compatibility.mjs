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
  console.log("PASS " + label + " layout: viewport=" + layout.width + "px, document=" + layout.documentWidth + "px, controls visible.");
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

async function testWorkspaceAndProfile(page, deviceLabel) {
  await page.waitForFunction(expected => document.querySelector("#homeReleaseVersion")?.dataset.buildId === expected, EXPECTED_BUILD_VERSION, { timeout: 30000 });
  const visual = await page.evaluate(() => {
    const hero = document.querySelector("#home>.v89-welcome");
    const header = document.querySelector("#home>.v674-top");
    const badge = document.querySelector("#homeReleaseVersion");
    const style = element => element ? getComputedStyle(element) : null;
    return {
      buildBadge: badge?.dataset.buildId || "",
      heroRadius: style(hero)?.borderRadius || "",
      heroBackground: style(hero)?.backgroundImage || "",
      headerRadius: style(header)?.borderRadius || "",
      stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.href)
    };
  });
  assert.equal(visual.buildBadge, EXPECTED_BUILD_VERSION, deviceLabel + " V2 refresh script did not confirm the active release build.");
  assert.ok(visual.stylesheets.some(url => url.includes("/arya-v2-refresh.css")), deviceLabel + " V2 refresh stylesheet is not linked.");
  assert.ok(visual.stylesheets.some(url => url.includes("/workspace-tools.css")), deviceLabel + " Workspace stylesheet is not linked.");
  assert.ok(visual.stylesheets.some(url => url.includes("/toolbox-100.css")), deviceLabel + " Toolbox stylesheet is not linked.");
  assert.ok(visual.stylesheets.some(url => url.includes("/v25.css")), deviceLabel + " Profile stylesheet is not linked.");
  assert.ok(parseFloat(visual.heroRadius) >= 20 && visual.heroBackground !== "none" && parseFloat(visual.headerRadius) >= 16,
    deviceLabel + " V2 visual layer did not apply to the homepage header and hero.");
  console.log("PASS " + deviceLabel + " V2 visual layer: build " + visual.buildBadge + ", hero " + visual.heroRadius + ", header " + visual.headerRadius + ".");

  await page.locator('.nav [data-nav="allTools"]').click();
  await page.locator("#allTools.active").waitFor({ state: "visible", timeout: 30000 });
  assert.equal(await page.locator("#toolsArea").isVisible(), true, deviceLabel + " Tools workspace did not open.");
  assert.ok(await page.locator('#allTools [data-panel="toolbox100"]').count() === 1, deviceLabel + " 100 Tools Lab entry is missing.");
  await page.evaluate(() => {
    const root = document.getElementById("toolsArea");
    const panel = document.createElement("section");
    panel.id = "qa-dynamic-workspace-panel";
    panel.className = "panel active";
    root.append(panel);
  });
  await page.locator("#toolsArea>.ary-tools-backbar").waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => document.getElementById("qa-dynamic-workspace-panel")?.remove());
  await page.locator("#toolsArea>.ary-tools-backbar").waitFor({ state: "hidden", timeout: 10000 });
  await page.locator('#allTools [data-panel="toolbox100"]').click();
  await page.locator("#toolbox100.active").waitFor({ state: "visible", timeout: 30000 });
  const toolCount = await page.locator("#toolbox100 [data-tool-id]").count();
  assert.equal(toolCount, 100, deviceLabel + " Toolbox should render exactly 100 tools; got " + toolCount + ".");
  await page.locator("#t100Input").fill("aryanzz v2");
  await page.locator("#t100Run").click();
  await page.waitForFunction(() => document.querySelector("#t100Output")?.value === "ARYANZZ V2", null, { timeout: 30000 });
  assert.equal(await page.locator("#t100Status").innerText(), "Selesai · 10 karakter hasil.", deviceLabel + " Toolbox did not complete the uppercase example.");
  if (await page.evaluate(() => window.innerWidth <= 600)) {
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(width <= 602, deviceLabel + " Toolbox causes horizontal overflow: " + width + "px.");
  }
  console.log("PASS " + deviceLabel + " Workspace navigation and 100 Tools Lab: 100 cards, local tool execution and responsive layout.");

  await page.locator('.nav [data-nav="profile"]').click();
  await page.locator("#profile.active").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(() => {
    const value = document.querySelector("#deviceCurrent")?.textContent?.trim() || "";
    return value && value !== "Membaca perangkat…";
  }, null, { timeout: 30000 });
  const profile = await page.evaluate(() => ({
    nameField: !!document.querySelector("#profileName"),
    device: document.querySelector("#deviceCurrent")?.textContent?.trim() || "",
    specs: [...document.querySelectorAll("#profile .ary-v1-device-specs dd")].map(node => node.textContent.trim()).filter(Boolean)
  }));
  assert.ok(profile.nameField, deviceLabel + " Profile name field is missing.");
  assert.ok(profile.device.length > 3, deviceLabel + " Profile did not detect the current device.");
  assert.ok(profile.specs.length >= 3, deviceLabel + " Profile device specifications are not populated.");
  console.log("PASS " + deviceLabel + " Profile V25: current device detected and " + profile.specs.length + " specifications populated.");

  await page.locator('.nav [data-nav="home"]').click();
  await page.locator("#url").waitFor({ state: "visible", timeout: 30000 });
  assert.equal(await page.locator("#home").isVisible(), true, deviceLabel + " Home navigation did not restore the downloader workspace.");
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
  await testWorkspaceAndProfile(desktopPage, "Desktop Chromium");
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
  await testWorkspaceAndProfile(mobilePage, "Android-like Chromium");
  await testDownload(mobilePage, tests[0], "Android-like");
  await testDownload(mobilePage, tests[3], "Android-like");
  await mobile.close();
  console.log("All live browser compatibility checks passed for build " + EXPECTED_BUILD_VERSION + ".");
} finally {
  await browser.close();
}
