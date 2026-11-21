import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const membership = read("src/membership-store.js");
const worker = read("src/index.js");
const wrangler = read("wrangler.toml");
const html = read("public/index.html");
const ui = read("public/membership-ui.js");
const navigation = read("public/workspace-navigation.js");
const membershipCss = read("public/membership.css");
const workflow = read(".github/workflows/deploy-cloudflare.yml");

assert.match(membership, /https:\/\/airpaygateway\.site\/api\/qris\/create/);
assert.match(membership, /https:\/\/airpaygateway\.site\/api\/qris\/status/);
assert.match(membership, /AIRPAY_API_KEY/);
assert.match(membership, /callback_url:/);
assert.match(membership, /X-AirPay-Signature/);
assert.match(membership, /safeAirPayUrl/);
assert.match(membership, /PENDING_ORDER_EXISTS/);
assert.match(membership, /10 \* 60 \* 1000/);
assert.match(membership, /AIRPAY_API_KEY/);
assert.match(workflow, /secrets\.AIRPAY_API_KEY/);
assert.match(workflow, /wrangler secret put "\$name"/);
assert.match(membershipCss, /ary-membership-qr-wrap[\s\S]*?background:transparent!important/);
assert.match(membershipCss, /ary-membership-payment-back/);
assert.match(membershipCss, /ary-membership-methods\{display:flex!important/);
assert.match(aryHtmlSection(html), /id="membershipPaymentBack"/);
assert.match(aryHtmlSection(html), /DANA/);
assert.match(aryHtmlSection(html), /GoPay/);
assert.match(aryHtmlSection(html), /LinkAja/);
assert.match(aryHtmlSection(html), /OVO/);
assert.match(aryHtmlSection(html), /ShopeePay/);
assert.match(membership, /supportedApps: \["DANA", "GoPay", "LinkAja", "OVO", "ShopeePay", "Mobile Banking"\]/);
assert.match(membership, /supportedApps: \["DANA", "GoPay", "LinkAja", "OVO", "ShopeePay", "Mobile Banking"\]/);
assert.match(ui, /membershipPaymentBack/);
assert.match(ui, /Waktu checkout 10 menit habis/);
assert.match(ui, /renderCart\(\);[\s\S]*?renderPlans\(\);/);
assert.match(membership, /aryanzz_device_lock/);
assert.match(membership, /auth_device_lock_accounts/);
assert.doesNotMatch(membership, /poketo\.id/i);
assert.match(membership, /statusVerification: "webhook-and-server-side-polling"/);
assert.match(worker, /env\.MEMBERSHIP_STORE/);
assert.match(worker, /signedAirPayWebhook/);
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
assert.match(navigation, /!membership\|\|!membership\.canAccess/);

function aryHtmlSection(source) {
  const start = source.indexOf('id="membership"');
  const end = source.indexOf('id="members"', start);
  return start >= 0 && end > start ? source.slice(start, end) : "";
}

assert.match(aryHtmlSection(html), /id="membershipCart"/);
assert.doesNotMatch(html.slice(0, html.indexOf('id="membership"')), /id="membershipCart"/);
assert.match(html, /data-membership-min="pro"/);
assert.match(html, /data-membership-min="ultra"/);
assert.match(html, /data-membership-min="max"/);

console.log("ARYANZZ AirPay membership smoke tests passed.");
