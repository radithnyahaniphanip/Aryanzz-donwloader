import assert from "node:assert/strict";
import fs from "node:fs";
import { handleMembership } from "../src/membership.js";
const backend=fs.readFileSync(new URL("../src/membership.js",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../migrations/0004_membership.sql",import.meta.url),"utf8");
const prestigeMigration=fs.readFileSync(new URL("../migrations/0005_prestige_redeem_devices.sql",import.meta.url),"utf8");
const ui=fs.readFileSync(new URL("../public/membership.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../public/membership.css",import.meta.url),"utf8");
for(const [id,price] of [["starter",80000],["plus",140000],["pro",189000],["elite",328000],["ultimate",500000],["lifetime",1800000],["founder",5900000]]){
 assert.ok(backend.includes('id:"'+id+'"'),"Missing plan "+id);
 assert.ok(backend.includes("price:"+price),"Incorrect price for "+id);
 assert.ok(ui.includes("/api/membership/catalog"),"UI must load the server-owned plan catalog");
}
for(const table of ["membership_orders","user_memberships"])assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS "+table));
assert.ok(backend.includes("credentials")===false,"Credentials are handled by same-origin browser calls");
assert.ok(backend.includes("paymentVerified!==true"),"Manual payment review must fail closed without explicit verification");
assert.ok(migration.includes("provider_transaction_id"),"Provider transaction IDs are reserved for deduplication");
assert.ok(ui.includes("Free Member")&&ui.includes("/api/membership/me"),"UI must preserve Free Member and use authenticated API");
assert.ok(css.includes(".ary-membership"),"Membership styles must be scoped");
const unauth=await handleMembership(new Request("https://aryanzz.example/api/membership/me"),{AUTH_DB:{prepare(){throw new Error("should not be called without session")}},AUTH_SESSION_SECRET:"x".repeat(40)});
assert.equal(unauth.status,401);
const catalog=await handleMembership(new Request("https://aryanzz.example/api/membership/catalog"),{AUTH_DB:{prepare(){}}});
assert.equal(catalog.status,200);
const catalogBody=await catalog.json();assert.equal(catalogBody.plans.length,7);assert.equal(catalogBody.free.id,"free");
assert.equal(catalogBody.pricingStatus,"proposed");
assert.equal(catalogBody.paymentEnabled,true,"Checkout is enabled when D1 is bound and the merchant QRIS is built in.");
assert.equal(catalogBody.qrAvailable,true,"The supplied merchant QRIS must be available even when checkout database is not ready");
const qrisConfig=await handleMembership(new Request("https://aryanzz.example/api/membership/payment-config"),{});
const qrisConfigBody=await qrisConfig.json();assert.equal(qrisConfigBody.enabled,true);assert.equal(qrisConfigBody.checkoutEnabled,false);assert.ok(qrisConfigBody.qrisImageUrl.startsWith("data:image/png;base64,"));
console.log("ARYANZZ V1 Membership catalog, auth gate, migration, and fail-closed review checks passed.");
assert.ok(backend.includes("automaticWebhookReady:String(env.MEMBERSHIP_WEBHOOK_SECRET||\"\").length>=32"),"Payment config must distinguish static QRIS from an activated callback bridge");
assert.ok(ui.includes("QRIS statis tidak mengirim notifikasi otomatis")&&ui.includes("syncMembershipPolling"),"Checkout must explain static QRIS limits and refresh pending payment status");

assert.ok(backend.includes("/api/redeem/claim"),"Redeem claim endpoint must be implemented");
assert.ok(backend.includes("3*24*60*60*1000")&&backend.includes("redeemWindowExpiresAt"),"Redeem window must close three days after account creation");
assert.ok(backend.includes("const expires=null"),"Claimed Legendary cosmetics must remain permanent after the three-day redemption window");
assert.ok(backend.includes("legendary-avatar-frame")&&backend.includes("legendary-aurora-background"),"Redeem grants both avatar frame and animated profile background");
assert.ok(backend.includes("/api/membership/admin/redeem-codes"),"Owner must be able to generate redeem codes");
assert.ok(backend.includes("redeemed_count<max_redemptions"),"Code quota is enforced by conditional database update");
assert.ok(ui.includes("aryRedeemProfile")&&ui.includes("aryPrestigeActive")&&ui.includes("/api/cosmetics/me")&&ui.includes("updateRedeemWindow")&&ui.includes("d.redeemAvailable"),"Profile account card must expose redeem UI and a three-day new-account countdown");
assert.ok(css.includes(".ary-legendary-frame")&&css.includes(".ary-legendary-background")&&css.includes("prefers-reduced-motion"),"Prestige cosmetics must be animated and respect reduced motion");

for(const table of ["auth_device_accounts","redeem_codes","redeem_redemptions","user_cosmetics"])assert.ok(prestigeMigration.includes("CREATE TABLE IF NOT EXISTS "+table),"Missing prestige migration table "+table);
const redeemUnauth=await handleMembership(new Request("https://aryanzz.example/api/redeem/claim",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:"ARY-LEGEND-TESTCODE"})}),{AUTH_DB:{prepare(){throw new Error("should not query without a session")}},AUTH_SESSION_SECRET:"x".repeat(40)});
assert.equal(redeemUnauth.status,401);

assert.ok(backend.includes("/api/cosmetics/equip"),"Users can equip only cosmetics they own");
assert.ok(backend.includes("/api/membership/payment-config"),"Membership exposes official QRIS configuration state");
assert.ok(backend.includes("MEMBERSHIP_QRIS_IMAGE_URL")&&backend.includes("DEFAULT_MERCHANT_QRIS_DATA_URI"),"The supplied GoPay Merchant QRIS must be available as default image, with owner override support");
assert.ok(ui.includes("Avatar & Background Studio")&&ui.includes("aryCosmeticsStudio"),"Avatar and background management must be available in Tools");
assert.ok(ui.includes("Lanjut bayar QRIS")&&ui.includes("Database belum aktif")&&ui.includes("checkoutEnabled"),"Membership checkout must remain disabled until central account storage is configured while still showing the QRIS image");

assert.ok(ui.includes('data-panel="aryCosmeticsStudio"')&&ui.includes("loadCosmeticsStudio()"),"Opening Avatar & Background Studio must load the account inventory");

assert.ok(ui.includes('navItem.dataset.nav==="membership"){load();loadCatalog()}')&&ui.includes('navItem.dataset.nav==="profile")loadPrestige()'),"Membership and redeem status must refresh when their navigation tabs open after login");

const ownerMarkup=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const ownerScript=fs.readFileSync(new URL("../public/owner.js",import.meta.url),"utf8");
assert.ok(!ownerMarkup.includes("Pesanan Membership")&&!ownerScript.includes("ownerMembershipRefresh"),"Owner panel must not contain Membership order management");
assert.ok(ui.includes("ary-mem-nav-logo")&&ui.includes("ary-mem-nav-label"),"Membership nav must show its branded logo and label");

const studioUi=fs.readFileSync(new URL("../public/membership.js",import.meta.url),"utf8");
const studioCss=fs.readFileSync(new URL("../public/membership.css",import.meta.url),"utf8");
const platformBackend=fs.readFileSync(new URL("../src/index.js",import.meta.url),"utf8");
for(const id of ["local-frame-aurora","local-frame-royal","local-frame-nebula","local-frame-obsidian","local-bg-aurora","local-bg-crimson","local-bg-nebula","local-bg-midnight"])assert.ok(studioUi.includes(id),"Missing device-local cosmetic preset "+id);
assert.ok(studioUi.includes("aryanzz.cosmetics.local.v1")&&studioUi.includes("localStorage.setItem"),"Studio must save selected cosmetics locally without D1");
assert.ok(studioUi.includes("Mode perangkat aktif")&&studioUi.includes("applyLocalCosmetics()"),"Studio must render and apply local presets even if the account database is unavailable");
for(const cls of ["ary-local-frame-aurora","ary-local-frame-royal","ary-local-frame-nebula","ary-local-frame-obsidian","ary-local-bg-aurora","ary-local-bg-crimson","ary-local-bg-nebula","ary-local-bg-midnight"])assert.ok(studioCss.includes(cls),"Missing cosmetic presentation style "+cls);
assert.ok(platformBackend.includes("Promise.any(tasks)")&&platformBackend.includes("snackVideoNativePageFallback(rawUrl,requestUrl,8500)"),"SnackVideo public fallback providers must race concurrently with bounded timeouts");

const membershipBackend=fs.readFileSync(new URL("../src/membership.js",import.meta.url),"utf8");
assert.ok(membershipBackend.includes("/api/membership/webhook")&&membershipBackend.includes("MEMBERSHIP_WEBHOOK_SECRET")&&membershipBackend.includes("crypto.subtle.sign")&&membershipBackend.includes("x-aryanzz-signature"),"Membership webhook must authenticate trusted server-to-server callbacks");
assert.ok(membershipBackend.includes("Number(order.amount)!==amount")&&membershipBackend.includes("provider_transaction_id")&&membershipBackend.includes("transactionId"),"Webhook must match the exact order amount and persist a unique provider transaction ID");
assert.ok(membershipBackend.includes("env.AUTH_DB.batch")&&membershipBackend.includes("provider_transaction_id IS NULL")&&membershipBackend.includes("Membership berhasil diaktifkan"),"Verified webhook must atomically mark an order paid and activate membership once");
assert.ok(studioUi.includes("loadAdminOrders")&&studioUi.includes("data-review-order")&&studioUi.includes("paymentVerified:decision==="),"Owner must be able to review pending QRIS orders and explicitly confirm funds before manual approval");
assert.ok(studioUi.includes("aryMemAdminRefresh")&&studioCss.includes("ary-mem-admin-order"),"Owner payment review queue must have a refresh control and responsive styling");
