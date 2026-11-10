import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const auth = read("src/auth.js");
const gate = read("public/auth-gate.js");
const guest = read("public/guest-access.js");
const html = read("public/index.html");
const owner = read("public/owner.js");

assert.ok(auth.includes("/api/auth/guest/bootstrap") && auth.includes("async function guestBootstrap"), "Guest identity must be issued by the server");
assert.ok(auth.includes('limited(request,"guest-bootstrap",60,60000)'), "Automatic guest ID creation must be rate-limited to reduce bot abuse");
assert.ok(auth.includes("INSERT INTO auth_device_lock_accounts") && auth.includes("role,created_at,updated_at"), "Guest IDs must be linked to a server-side device lock and persistent auth row");
assert.ok(auth.includes("PUBLIC_LOGIN_DISABLED") && auth.includes("REGISTRATION_DISABLED"), "Public member login and registration must be disabled");
assert.ok(auth.includes("auth_user_bans") && auth.includes("ID kamu telah di-banned"), "Moderation must block the guest ID and show the requested banned state");
assert.ok(auth.includes("Akunmu telah dipulihkan. Silakan buka kembali website ARYANZZ."), "Restoration must tell the visitor public access has returned");
assert.ok(gate.includes('get("owner") === "1"') && gate.includes("if(!ownerMode){setUser(null);return;}"), "Only the explicit owner route may display the admin login");
assert.ok(guest.includes("/api/auth/guest/bootstrap") && guest.includes("aryanzz.public.guest.id.v1"), "The public client must bootstrap a server ID and use a local fallback only when the server is unavailable");
assert.ok(guest.includes('localStorage.setItem(LOCAL_ID_KEY, String(user.id))'), "The server-issued ID must remain available as a stable local fallback during temporary outages");
assert.ok(guest.includes("Akunmu telah dipulihkan") && guest.includes("082110767071"), "The guest client must display restoration notice and WhatsApp support");
assert.ok(guest.includes('document.addEventListener("DOMContentLoaded", start, { once: true })'), "Guest identity bootstrap must wait until the earlier auth-gate initialization has completed");
assert.ok(guest.includes("guestCopyBound") && guest.includes("navigator.clipboard.writeText"), "The automatically generated ID must be copyable from Profile");
assert.ok(html.includes("guest-access.js") && !html.includes("Akses administrator · Masuk admin"), "The guest client must remain while the Administrator entry is removed");
assert.ok(owner.includes("/api/auth/admin/") && owner.includes("ownerBanAccountId"), "Owner moderation UI must keep ban and restore controls");
assert.ok(!html.includes("membership.js") && !html.includes("membership.css"), "Membership, checkout, cosmetics, and redeem UI must not be loaded");
console.log("ARYANZZ V1 anonymous public access and guest ID checks passed; retired Membership and Administrator entry are absent.");
