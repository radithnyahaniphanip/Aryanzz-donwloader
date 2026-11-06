import assert from "node:assert/strict";
import fs from "node:fs";
import { handleAuthRequest } from "../src/auth.js";

const backend = fs.readFileSync(new URL("../src/auth.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../migrations/0001_auth.sql", import.meta.url), "utf8");
assert.ok(backend.includes("api.resend.com/emails"), "Email codes must be sent by the configured provider");
assert.ok(backend.includes("turnstile/v0/siteverify"), "CAPTCHA must be verified server-side");
assert.ok(backend.includes("PBKDF2"), "Passwords must be hashed");
assert.ok(backend.includes("HttpOnly; Secure; SameSite=Lax"), "Sessions must use secure HttpOnly cookies");
assert.ok(backend.includes("Number(row.attempts) >= 5"), "OTP attempts must be bounded");
for (const table of ["auth_users","auth_verifications","auth_sessions"]) assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS " + table));
const config = await handleAuthRequest(new Request("https://aryanzz.example/api/auth/config"), {});
assert.equal(config.status, 200);
assert.equal((await config.json()).ready, false, "Auth must fail closed until service configuration exists");
const unavailable = await handleAuthRequest(new Request("https://aryanzz.example/api/auth/register/start", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "person@gmail.com", password: "StrongPassword!123", passwordConfirm: "StrongPassword!123" })
}), {});
assert.equal(unavailable.status, 503);
assert.equal((await unavailable.json()).code, "AUTH_NOT_CONFIGURED");
console.log("ARYANZZ V1 backend email-auth and fail-closed configuration checks passed.");
