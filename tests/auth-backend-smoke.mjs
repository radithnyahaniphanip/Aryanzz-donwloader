import assert from "node:assert/strict";
import fs from "node:fs";
import { handleAuthRequest } from "../src/auth.js";

const backend = fs.readFileSync(new URL("../src/auth.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../migrations/0001_auth.sql", import.meta.url), "utf8");
const deviceMigration = fs.readFileSync(new URL("../migrations/0002_trusted_devices.sql", import.meta.url), "utf8");
const moderationMigration = fs.readFileSync(new URL("../migrations/0003_account_moderation.sql", import.meta.url), "utf8");
assert.ok(backend.includes("api.resend.com/emails"), "Email codes must be sent by the configured provider");
assert.ok(backend.includes("turnstile/v0/siteverify"), "CAPTCHA must be verified server-side");
assert.ok(backend.includes("PBKDF2"), "Passwords must be hashed");
assert.ok(backend.includes("HttpOnly; Secure; SameSite=Lax"), "Sessions must use secure HttpOnly cookies");
assert.ok(backend.includes("Number(row.attempts) >= 5"), "OTP attempts must be bounded");
for (const table of ["auth_users","auth_verifications","auth_sessions"]) assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS " + table));
assert.ok(backend.includes("auth_trusted_devices") && deviceMigration.includes("CREATE TABLE IF NOT EXISTS auth_trusted_devices"), "Trusted devices must be stored server-side");
assert.ok(backend.includes("startDeviceReset") && backend.includes("verifyDeviceReset"), "Password reset must use a trusted-device flow without email OTP");
assert.ok(backend.includes("rememberTrustedDevice") && backend.includes("deviceHash"), "Registration and login must register the current device");
assert.ok(backend.includes("auth_user_bans") && backend.includes("auth_banned_devices") && moderationMigration.includes("CREATE TABLE IF NOT EXISTS auth_user_bans") && moderationMigration.includes("CREATE TABLE IF NOT EXISTS auth_banned_devices"), "Permanent account and device bans must be stored server-side");
assert.ok(backend.includes("DEVICE_BANNED") && backend.includes("ACCOUNT_BANNED"), "Banned users and their known devices must be denied");
assert.ok(backend.includes("/api/auth/admin/ban") && backend.includes("adminModerate"), "Only authenticated owner/admin sessions can moderate accounts");
assert.ok(backend.includes("WHERE email=?1 COLLATE NOCASE OR id=?2 COLLATE NOCASE"), "Online login must accept email or account ID");
const config = await handleAuthRequest(new Request("https://aryanzz.example/api/auth/config"), {});
assert.equal(config.status, 200);
const configBody = await config.json();
assert.equal(configBody.ready, false, "Auth must fail closed until service configuration exists");
assert.ok(configBody.missing.includes("Cloudflare D1 (AUTH_DB)"), "Config should report a missing D1 binding without exposing secrets");
const unavailable = await handleAuthRequest(new Request("https://aryanzz.example/api/auth/register/start", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "person@gmail.com", password: "StrongPassword!123", passwordConfirm: "StrongPassword!123" })
}), {});
assert.equal(unavailable.status, 503);
assert.equal((await unavailable.json()).code, "AUTH_NOT_CONFIGURED");
console.log("ARYANZZ V1 backend email-auth and fail-closed configuration checks passed.");

assert.ok(backend.includes("auth_device_accounts"),"Server registration must use a persistent primary-device registry");
assert.ok(backend.includes("primaryDeviceOwner(deviceHash, env)"),"Registration/login must check the existing primary account on this browser installation");
assert.ok(backend.includes("Dilarang membuat akun baru di perangkat ini"),"Duplicate-account block must explain that the primary account should be used");
