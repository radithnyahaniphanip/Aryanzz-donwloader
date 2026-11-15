import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../public/toolbox-100.js");
const html = read("../public/index.html");
const sw = read("../public/sw.js");
const manifest = JSON.parse(read("../public/workspace-manifest.json"));
const sandbox = {
  window: {}, document: { getElementById() { return null; } }, globalThis: null,
  crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, URL, URLSearchParams,
  Blob, Date, Math, Number, String, Array, Object, Set, Map, RegExp, Error,
  Promise, JSON, BigInt, btoa, atob, navigator: { userAgent: "Mozilla/5.0 Chrome/120.0 Android" }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: "toolbox-100.js" });
const api = sandbox.window.ARYANZZToolbox100;
assert.ok(api, "tool catalog exports a testable API");
assert.equal(api.catalog.length, 100, "exactly 100 tools are registered");
assert.equal(new Set(api.catalog.map(x => x.id)).size, 100, "tool ids are unique");
assert.equal(new Set(api.catalog.map(x => x.group)).size, 10, "tools cover ten distinct categories");
assert.ok(api.catalog.every(x => x.title && x.desc), "every tool has a title and a functional description");
assert.equal(api.run("uppercase", "aryanzz"), "ARYANZZ");
assert.ok(String(api.run("word-count", "one two three")).includes("Kata: 3"));
assert.equal(api.run("slug-generator", "Halo Dunia!"), "halo-dunia");
assert.equal(api.run("base64-decode", api.run("base64-encode", "Halo 🌏")), "Halo 🌏");
assert.equal(api.run("roman-numeral", "2026"), "MMXXVI");
assert.equal(api.run("binary-to-decimal", "101101"), "45");
assert.equal(api.run("hex-to-rgb", "#3366ff"), "RGB: rgb(51, 102, 255)\nHSL: hsl(225, 100, 60)");
assert.equal(api.run("email-validator", "user@example.com"), "Format email terlihat valid ✓");
assert.equal(api.run("ipv4-validator", "192.168.1.1"), "IPv4 valid ✓");
assert.equal(api.run("json-path-lookup", '{"user":{"name":"Aura"}}', "user.name"), "Aura");
assert.ok(String(api.run("csv-to-json", 'name,city\n"Aura, A.",Pula')).includes("Aura, A."));
assert.ok(String(api.run("keyword-density", "hello hello world", "hello")).includes("Kepadatan: 66.67%"));
assert.ok(String(api.run("gradient-generator", "#112233,#ffffff", "90")).includes("90deg"));
assert.equal((await api.run("sha256-text", "abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
assert.equal(String(api.run("password-generator", "", "16")).length, 16);
assert.equal(String(api.run("uuid-generator", "", "2")).split("\n").length, 2);
assert.ok(html.includes('data-panel="toolbox100"'), "100 Tools Lab has a launcher in the main searchable catalog");
assert.ok(html.includes('/toolbox-100.js?v=__ARYANZZ_VERSION__'), "100 Tools Lab script is loaded");
assert.ok(html.includes('/toolbox-100.css?v=__ARYANZZ_VERSION__'), "100 Tools Lab stylesheet is loaded");
assert.ok(sw.includes("/toolbox-100.js?v=__ARYANZZ_VERSION__") && sw.includes("/toolbox-100.css?v=__ARYANZZ_VERSION__"), "PWA shell precaches both new assets");
assert.ok(manifest.featureModules.some(x => x.root === "#toolbox100" && x.js.includes("/toolbox-100.js")), "module ownership is recorded");
assert.ok(!source.includes("fetch("), "100 Tools Lab performs its transformations locally without remote API calls");
console.log("ARYANZZ 100 Tools Lab smoke test passed: 100 unique tools, ten categories, local operations and integration.");
