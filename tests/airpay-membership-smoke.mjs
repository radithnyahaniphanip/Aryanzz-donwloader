import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const membership = read("src/membership-store.js");
const worker = read("src/index.js");
const wrangler = read("wrangler.toml");
const html = read("public/index.html");
const ui = read("public/membership-ui.js");
const navigation = read("public/workspace-navigation.js");

assert.match(membership, /https:\/\/airpaygateway\.site\/api\/qris\/create/);
assert.match(membership, /https:\/\/airpaygateway\.site\/api\/qris\/status/);
assert.match(membership, /AIRPAY_API_KEY/);
assert.match(membership, /callback_url:/);
assert.match(membership, /X-AirPay-Signature/);
assert.match(membership, /aryanzz_device_lock/);
assert.match(membership, /auth_device_lock_accounts/);
assert.doesNotMatch(membership, /poketo\.id/i);
assert.match(membership, /statusVerification: "webhook-and-server-side-polling"/);
assert.match(worker, /env\.MEMBERSHIP_STORE/);
assert.match(wrangler, /name = "MEMBERSHIP_STORE"/);
assert.match(html, /id="membership"/);
assert.match(html, /data-nav="membership"/);
assert.match(html, /membership-ui\.js/);
assert.match(ui, /\/api\/membership\/orders\/status/);
assert.match(ui, /waitForGuestIdentity/);
assert.match(html, /DANA/);
assert.match(html, /GoPay/);
assert.match(html, /LinkAja/);
assert.match(navigation, /candidate\.dataset\.membershipMin/);

console.log("ARYANZZ AirPay membership smoke tests passed.");
