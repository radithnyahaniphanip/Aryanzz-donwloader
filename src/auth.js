const COOKIE = "aryanzz_session";
const ITERATIONS = 250000;
const OTP_TTL = 10 * 60 * 1000;
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const buckets = new Map();

function reply(data, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store, no-cache, must-revalidate");
  h.set("pragma", "no-cache");
  return new Response(JSON.stringify(data), { status, headers: h });
}
const emailOf = value => String(value || "").trim().toLowerCase();
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validDeviceHash = value => /^[a-f0-9]{64}$/i.test(String(value || ""));
const validPassword = value => typeof value === "string" && value.length >= 12 && value.length <= 128 &&
  /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
const hex = bytes => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
const randomHex = size => hex(crypto.getRandomValues(new Uint8Array(size)));
const randomCode = () => String(100000 + ((crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) % 900000));
const accountId = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "ARY-" + Array.from(crypto.getRandomValues(new Uint8Array(10)), value => alphabet[value % alphabet.length]).join("");
};
async function digest(value) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))));
}
async function passwordDigest(password, saltHex, iterations = ITERATIONS) {
  const salt = Uint8Array.from(String(saltHex).match(/.{2}/g) || [], value => parseInt(value, 16));
  if (salt.length < 16 || salt.length > 64) throw new Error("Salt tidak valid.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let value = 0;
  for (let i = 0; i < a.length; i++) value |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return value === 0;
}
function missingConfig(env) {
  const missing = [];
  if (!env.AUTH_DB || typeof env.AUTH_DB.prepare !== "function") missing.push("Cloudflare D1 (AUTH_DB)");
  if (String(env.AUTH_SESSION_SECRET || "").length < 32) missing.push("AUTH_SESSION_SECRET");
  if (!String(env.RESEND_API_KEY || "").trim()) missing.push("RESEND_API_KEY");
  if (!String(env.AUTH_EMAIL_FROM || "").trim()) missing.push("AUTH_EMAIL_FROM (verified sender)");
  if (!String(env.TURNSTILE_SECRET_KEY || "").trim()) missing.push("TURNSTILE_SECRET_KEY");
  if (!String(env.AUTH_TURNSTILE_SITE_KEY || "").trim()) missing.push("AUTH_TURNSTILE_SITE_KEY");
  return missing;
}
function ready(env) { return missingConfig(env).length === 0; }
function limited(request, name, max, windowMs) {
  const key = name + "|" + String(request.headers.get("cf-connecting-ip") || "unknown").slice(0, 80);
  const now = Date.now();
  let item = buckets.get(key);
  if (!item || now - item.start >= windowMs) item = { start: now, count: 0 };
  item.count++;
  buckets.set(key, item);
  if (buckets.size > 2500) for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k);
  return item.count > max;
}
async function bodyOf(request) {
  try { const value = await request.json(); return value && typeof value === "object" && !Array.isArray(value) ? value : null; }
  catch { return null; }
}
async function captcha(request, token, env) {
  if (!String(token || "").trim()) return false;
  const form = new URLSearchParams({ secret: String(env.TURNSTILE_SECRET_KEY), response: String(token) });
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) form.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true && (!result.hostname || String(result.hostname).toLowerCase() === new URL(request.url).hostname.toLowerCase());
  } catch { return false; }
}
async function sendCode(email, code, purpose, env) {
  const reset = purpose === "reset";
  const subject = reset ? "Kode reset password ARYANZZ" : "Verifikasi email ARYANZZ";
  const intro = reset ? "Gunakan kode ini untuk mengatur ulang password akun ARYANZZ." : "Gunakan kode ini untuk memverifikasi email akun ARYANZZ.";
  const html = '<div style="font-family:Arial,sans-serif;background:#0b1222;color:#edf4ff;padding:28px;border-radius:16px;max-width:520px;margin:auto">' +
    '<b style="letter-spacing:2px;color:#7fdcf1">ARYANZZ · V1 FULL RELEASE</b><h2>Verifikasi akun</h2><p style="color:#b9c8df">' + intro + '</p>' +
    '<div style="margin:24px 0;padding:18px;text-align:center;border:1px solid #38547b;border-radius:12px;background:#111f38;font-size:32px;font-weight:900;letter-spacing:9px">' + code + '</div>' +
    '<p style="color:#9eafc8;font-size:12px;line-height:1.6">Kode berlaku 10 menit dan hanya dapat digunakan sekali. Jangan bagikan kode ini. Jika kamu tidak meminta kode ini, abaikan email ini.</p></div>';
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + String(env.RESEND_API_KEY), "content-type": "application/json" },
    body: JSON.stringify({ from: String(env.AUTH_EMAIL_FROM), to: [email], subject, html })
  });
  if (!response.ok) {
    console.error("[ARYANZZ_AUTH] email_provider_error", response.status);
    throw new Error("Email provider gagal mengirim kode.");
  }
}
async function issueCode(email, purpose, payload, env) {
  const db = env.AUTH_DB, now = Date.now();
  const prior = await db.prepare("SELECT last_sent_at FROM auth_verifications WHERE email=?1 AND purpose=?2").bind(email, purpose).first();
  if (prior && now - Number(prior.last_sent_at || 0) < 60000) return { status: 429, error: "Tunggu 60 detik sebelum meminta kode baru." };
  const code = randomCode();
  const codeHash = await digest(String(env.AUTH_SESSION_SECRET) + "|" + purpose + "|" + email + "|" + code);
  await db.prepare("INSERT INTO auth_verifications (email,purpose,code_hash,payload_json,created_at,expires_at,attempts,last_sent_at) VALUES (?1,?2,?3,?4,?5,?6,0,?5) " +
    "ON CONFLICT(email,purpose) DO UPDATE SET code_hash=excluded.code_hash,payload_json=excluded.payload_json,created_at=excluded.created_at,expires_at=excluded.expires_at,attempts=0,last_sent_at=excluded.last_sent_at")
    .bind(email, purpose, codeHash, payload ? JSON.stringify(payload) : null, now, now + OTP_TTL).run();
  try { await sendCode(email, code, purpose, env); return { ok: true }; }
  catch {
    await db.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose=?2").bind(email, purpose).run();
    return { status: 502, error: "Kode email belum berhasil dikirim. Periksa konfigurasi layanan email." };
  }
}
async function verifyCode(email, purpose, code, env) {
  const db = env.AUTH_DB;
  const row = await db.prepare("SELECT * FROM auth_verifications WHERE email=?1 AND purpose=?2").bind(email, purpose).first();
  if (!row) return { error: "Kode verifikasi tidak valid atau sudah kedaluwarsa." };
  if (Number(row.expires_at) < Date.now() || Number(row.attempts) >= 5) {
    await db.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose=?2").bind(email, purpose).run();
    return { error: "Kode kedaluwarsa atau batas percobaan tercapai. Minta kode baru." };
  }
  const hash = await digest(String(env.AUTH_SESSION_SECRET) + "|" + purpose + "|" + email + "|" + String(code || "").trim());
  if (!equal(hash, String(row.code_hash || ""))) {
    await db.prepare("UPDATE auth_verifications SET attempts=attempts+1 WHERE email=?1 AND purpose=?2").bind(email, purpose).run();
    return { error: "Kode verifikasi salah. Periksa kembali email kamu." };
  }
  return { row };
}
function publicUser(row) {
  return { id: String(row.id), email: String(row.email), fullName: String(row.full_name), role: String(row.role || "member"), createdAt: Number(row.created_at || Date.now()) };
}
function tokenFrom(request) {
  const cookie = String(request.headers.get("cookie") || "");
  const part = cookie.split(";").map(value => value.trim()).find(value => value.startsWith(COOKIE + "="));
  return part ? part.slice(COOKIE.length + 1) : "";
}
async function rememberTrustedDevice(userId, deviceHash, env) {
  if (!validDeviceHash(deviceHash)) return false;
  const now = Date.now();
  const storedHash = await digest(String(env.AUTH_SESSION_SECRET) + "|trusted-device|" + String(deviceHash).toLowerCase());
  await env.AUTH_DB.prepare("INSERT INTO auth_trusted_devices (user_id,device_hash,created_at,last_seen_at) VALUES (?1,?2,?3,?3) ON CONFLICT(user_id,device_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at")
    .bind(userId, storedHash, now).run();
  await env.AUTH_DB.prepare("DELETE FROM auth_trusted_devices WHERE user_id=?1 AND device_hash NOT IN (SELECT device_hash FROM auth_trusted_devices WHERE user_id=?1 ORDER BY last_seen_at DESC LIMIT 8)")
    .bind(userId).run();
  return true;
}
async function createSession(row, env) {
  const token = randomHex(32), now = Date.now();
  await env.AUTH_DB.prepare("INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES (?1,?2,?3,?4)")
    .bind(await digest(token), row.id, now, now + SESSION_TTL).run();
  await env.AUTH_DB.prepare("DELETE FROM auth_sessions WHERE expires_at<=?1").bind(now).run();
  return reply({ ok: true, user: publicUser(row) }, 200, {
    "set-cookie": COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + Math.floor(SESSION_TTL / 1000)
  });
}
async function me(request, env) {
  const token = tokenFrom(request);
  if (!/^[a-f0-9]{64}$/i.test(token)) return reply({ ok: false, code: "NOT_AUTHENTICATED" }, 401);
  const row = await env.AUTH_DB.prepare("SELECT u.id,u.email,u.full_name,u.role,u.created_at FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1")
    .bind(await digest(token), Date.now()).first();
  return row ? reply({ ok: true, user: publicUser(row) }) : reply({ ok: false, code: "NOT_AUTHENTICATED" }, 401);
}
async function logout(request, env) {
  const token = tokenFrom(request);
  if (token && env.AUTH_DB) {
    try { await env.AUTH_DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?1").bind(await digest(token)).run(); } catch {}
  }
  return reply({ ok: true }, 200, { "set-cookie": COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
}
async function startRegister(request, env) {
  const b = await bodyOf(request), fullName = String(b?.fullName || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const email = emailOf(b?.email), password = String(b?.password || "");
  if (!b || fullName.length < 2 || !validEmail(email)) return reply({ ok: false, error: "Nama dan email harus diisi dengan benar." }, 400);
  if (!validPassword(password)) return reply({ ok: false, error: "Password minimal 12 karakter, berisi huruf besar, huruf kecil, angka, dan simbol." }, 400);
  if (password !== String(b.passwordConfirm || "")) return reply({ ok: false, error: "Konfirmasi password belum sama." }, 400);
  if (limited(request, "register", 5, 600000)) return reply({ ok: false, error: "Terlalu banyak percobaan pendaftaran." }, 429);
  if (!(await captcha(request, b.captchaToken, env))) return reply({ ok: false, error: "Verifikasi CAPTCHA belum berhasil." }, 400);
  const exists = await env.AUTH_DB.prepare("SELECT id FROM auth_users WHERE email=?1 COLLATE NOCASE LIMIT 1").bind(email).first();
  if (exists) return reply({ ok: false, code: "EMAIL_EXISTS", error: "Email sudah terdaftar. Silakan masuk atau reset password." }, 409);
  const salt = randomHex(16), passwordHash = await passwordDigest(password, salt);
  const result = await issueCode(email, "register", {
    fullName, email, salt, passwordHash, iterations: ITERATIONS, redeemCode: String(b.redeemCode || "").slice(0, 64)
  }, env);
  if (!result.ok) return reply({ ok: false, error: result.error }, result.status);
  return reply({ ok: true, message: "Kode verifikasi 6 digit telah dikirim ke email kamu." });
}
async function verifyRegister(request, env) {
  const b = await bodyOf(request), email = emailOf(b?.email), code = String(b?.code || "").trim(), deviceHash = String(b?.deviceHash || "");
  if (!validEmail(email) || !/^\d{6}$/.test(code) || !validDeviceHash(deviceHash)) return reply({ ok: false, error: "Email, kode, atau identitas perangkat tidak valid." }, 400);
  if (limited(request, "register-verify", 12, 600000)) return reply({ ok: false, error: "Terlalu banyak percobaan kode." }, 429);
  const checked = await verifyCode(email, "register", code, env);
  if (checked.error) return reply({ ok: false, error: checked.error }, 400);
  let data;
  try { data = JSON.parse(checked.row.payload_json || "{}"); } catch { data = null; }
  if (!data || data.email !== email || !data.passwordHash) return reply({ ok: false, error: "Data pendaftaran tidak dapat dipulihkan." }, 400);
  const id = accountId(), now = Date.now();
  try {
    await env.AUTH_DB.prepare("INSERT INTO auth_users (id,email,full_name,password_salt,password_hash,password_iterations,role,redeem_code,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,'member',?7,?8,?8)")
      .bind(id, email, data.fullName, data.salt, data.passwordHash, Number(data.iterations) || ITERATIONS, data.redeemCode || "", now).run();
  } catch { return reply({ ok: false, error: "Email sudah terdaftar. Silakan masuk." }, 409); }
  await env.AUTH_DB.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose=?2").bind(email, "register").run();
  const user = await env.AUTH_DB.prepare("SELECT id,email,full_name,role,created_at FROM auth_users WHERE id=?1").bind(id).first();
  await rememberTrustedDevice(id, deviceHash, env);
  return createSession(user, env);
}
async function login(request, env) {
  const b = await bodyOf(request), identifier = String(b?.identifier || "").trim().slice(0, 254), password = String(b?.password || ""), deviceHash = String(b?.deviceHash || "");
  if (!identifier || !password || password.length > 128) return reply({ ok: false, error: "Masukkan email/ID dan password." }, 400);
  if (limited(request, "login", 10, 600000)) return reply({ ok: false, error: "Terlalu banyak percobaan masuk. Tunggu beberapa menit." }, 429);
  if (!(await captcha(request, b.captchaToken, env))) return reply({ ok: false, error: "Verifikasi CAPTCHA belum berhasil." }, 400);
  const user = await env.AUTH_DB.prepare("SELECT id,email,full_name,password_salt,password_hash,password_iterations,role,created_at FROM auth_users WHERE email=?1 COLLATE NOCASE OR id=?2 COLLATE NOCASE LIMIT 1")
    .bind(identifier, identifier).first();
  if (!user) return reply({ ok: false, code: "ACCOUNT_NOT_FOUND", error: "Akun belum ditemukan. Periksa email atau ID." }, 404);
  const iterations = Math.max(100000, Math.min(1000000, Number(user.password_iterations) || ITERATIONS));
  if (!equal(await passwordDigest(password, user.password_salt, iterations), String(user.password_hash || ""))) {
    return reply({ ok: false, code: "INVALID_CREDENTIALS", error: "Email/ID atau password tidak cocok." }, 401);
  }
  if (validDeviceHash(deviceHash)) await rememberTrustedDevice(user.id, deviceHash, env);
  return createSession(user, env);
}
async function startLegacy(request, env) {
  const b = await bodyOf(request), old = b?.legacy || {};
  const email = emailOf(old.email), fullName = String(old.fullName || "").trim().slice(0, 80);
  const id = String(old.id || "").trim().toUpperCase(), salt = String(old.salt || "").toLowerCase();
  const passwordHash = String(old.passwordHash || "").toLowerCase(), iterations = Number(old.iterations) || ITERATIONS;
  if (!validEmail(email) || fullName.length < 2 || !/^ARY-[A-Z0-9]{10}$/.test(id) ||
      !/^[a-f0-9]{32,128}$/.test(salt) || !/^[a-f0-9]{64}$/.test(passwordHash) ||
      !Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return reply({ ok: false, error: "Data akun lokal lama tidak valid." }, 400);
  if (limited(request, "legacy", 4, 600000)) return reply({ ok: false, error: "Terlalu banyak percobaan migrasi akun." }, 429);
  if (!(await captcha(request, b.captchaToken, env))) return reply({ ok: false, error: "Selesaikan CAPTCHA sebelum memindahkan akun." }, 400);
  const exists = await env.AUTH_DB.prepare("SELECT id FROM auth_users WHERE email=?1 COLLATE NOCASE OR id=?2 COLLATE NOCASE LIMIT 1").bind(email, id).first();
  if (exists) return reply({ ok: false, code: "ACCOUNT_EXISTS", error: "Akun sudah ada di sistem online. Silakan masuk." }, 409);
  const result = await issueCode(email, "legacy", { email, fullName, id, salt, passwordHash, iterations, redeemCode: String(old.redeemCode || "").slice(0, 64) }, env);
  if (!result.ok) return reply({ ok: false, error: result.error }, result.status);
  return reply({ ok: true, message: "Kode verifikasi pemindahan akun dikirim ke email kamu." });
}
async function verifyLegacy(request, env) {
  const b = await bodyOf(request), email = emailOf(b?.email), code = String(b?.code || "").trim();
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return reply({ ok: false, error: "Email atau kode tidak valid." }, 400);
  const checked = await verifyCode(email, "legacy", code, env);
  if (checked.error) return reply({ ok: false, error: checked.error }, 400);
  let data;
  try { data = JSON.parse(checked.row.payload_json || "{}"); } catch { data = null; }
  if (!data || data.email !== email) return reply({ ok: false, error: "Data akun lama tidak dapat dipulihkan." }, 400);
  const duplicate = await env.AUTH_DB.prepare("SELECT id FROM auth_users WHERE id=?1 COLLATE NOCASE").bind(data.id).first();
  const id = duplicate ? accountId() : data.id;
  const now = Date.now();
  try {
    await env.AUTH_DB.prepare("INSERT INTO auth_users (id,email,full_name,password_salt,password_hash,password_iterations,role,redeem_code,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,'member',?7,?8,?8)")
      .bind(id, email, data.fullName, data.salt, data.passwordHash, data.iterations, data.redeemCode || "", now).run();
  } catch { return reply({ ok: false, error: "Akun lama tidak dapat dipindahkan karena email sudah terdaftar." }, 409); }
  await env.AUTH_DB.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose=?2").bind(email, "legacy").run();
  const user = await env.AUTH_DB.prepare("SELECT id,email,full_name,role,created_at FROM auth_users WHERE id=?1").bind(id).first();
  return createSession(user, env);
}
async function sendResetLink(email, resetUrl, env) {
  const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;background:#0b1222;color:#edf4ff;border-radius:16px"><b style="color:#7fdcf1;letter-spacing:2px">ARYANZZ · V1</b><h2>Atur ulang password</h2><p style="color:#b9c8df;line-height:1.6">Buka tautan aman berikut untuk memverifikasi email dan membuat password baru.</p><p style="margin:26px 0"><a href="' + resetUrl + '" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#398cff;color:#fff;text-decoration:none;font-weight:800">Verifikasi email & reset password</a></p><p style="color:#9eafc8;font-size:12px;line-height:1.6">Tautan hanya dapat digunakan sekali dan berlaku 15 menit. Abaikan email ini jika kamu tidak meminta reset password.</p></div>';
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + String(env.RESEND_API_KEY), "content-type": "application/json" },
    body: JSON.stringify({ from: String(env.AUTH_EMAIL_FROM), to: [email], subject: "Tautan reset password ARYANZZ", html })
  });
  if (!response.ok) throw new Error("Email reset gagal dikirim.");
}
async function resetLinkRow(token, env) {
  const hash = await digest(String(env.AUTH_SESSION_SECRET) + "|reset-link|" + token);
  return env.AUTH_DB.prepare("SELECT email,expires_at FROM auth_verifications WHERE purpose='reset_link' AND code_hash=?1 LIMIT 1").bind(hash).first();
}
async function startDeviceReset(request, env) {
  const b = await bodyOf(request), email = emailOf(b?.email), deviceHash = String(b?.deviceHash || "");
  if (!validEmail(email) || !validDeviceHash(deviceHash)) return reply({ ok: false, error: "Email atau identitas perangkat tidak valid." }, 400);
  if (limited(request, "device-reset-start", 4, 600000)) return reply({ ok: false, error: "Terlalu banyak pemeriksaan. Tunggu beberapa menit." }, 429);
  const user = await env.AUTH_DB.prepare("SELECT id FROM auth_users WHERE email=?1 COLLATE NOCASE LIMIT 1").bind(email).first();
  if (!user) return reply({ ok: false, code: "DEVICE_NOT_RECOGNIZED", error: "Email atau perangkat tidak cocok dengan akun yang terdaftar." }, 404);
  const deviceKeyHash = await digest(String(env.AUTH_SESSION_SECRET) + "|trusted-device|" + deviceHash.toLowerCase());
  const trusted = await env.AUTH_DB.prepare("SELECT user_id FROM auth_trusted_devices WHERE user_id=?1 AND device_hash=?2 LIMIT 1").bind(user.id, deviceKeyHash).first();
  if (!trusted) return reply({ ok: false, code: "DEVICE_NOT_RECOGNIZED", error: "Email atau perangkat tidak cocok dengan perangkat yang pernah digunakan untuk akun ini." }, 403);
  const token = randomHex(32), now = Date.now();
  const tokenHash = await digest(String(env.AUTH_SESSION_SECRET) + "|device-reset|" + token);
  const payload = JSON.stringify({ userId: user.id, deviceKeyHash });
  await env.AUTH_DB.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose='device_reset'").bind(email).run();
  await env.AUTH_DB.prepare("INSERT INTO auth_verifications (email,purpose,code_hash,payload_json,created_at,expires_at,attempts,last_sent_at) VALUES (?1,'device_reset',?2,?3,?4,?5,0,?4)")
    .bind(email, tokenHash, payload, now, now + 15 * 60 * 1000).run();
  return reply({ ok: true, verified: true, token, userId: user.id, expiresAt: now + 15 * 60 * 1000 });
}
async function verifyDeviceReset(request, env) {
  const b = await bodyOf(request), email = emailOf(b?.email), token = String(b?.token || "");
  const password = String(b?.password || ""), confirm = String(b?.passwordConfirm || "");
  if (!validEmail(email) || !/^[a-f0-9]{64}$/i.test(token)) return reply({ ok: false, error: "Sesi verifikasi tidak valid. Ulangi pemeriksaan perangkat." }, 400);
  if (!validPassword(password)) return reply({ ok: false, error: "Password baru minimal 12 karakter, memakai huruf besar, huruf kecil, angka, dan simbol." }, 400);
  if (password !== confirm) return reply({ ok: false, error: "Ulangi password baru belum sama." }, 400);
  if (limited(request, "device-reset-verify", 8, 600000)) return reply({ ok: false, error: "Terlalu banyak percobaan reset password." }, 429);
  const row = await env.AUTH_DB.prepare("SELECT * FROM auth_verifications WHERE email=?1 AND purpose='device_reset' LIMIT 1").bind(email).first();
  const expected = await digest(String(env.AUTH_SESSION_SECRET) + "|device-reset|" + token);
  if (!row || Number(row.expires_at) <= Date.now() || !equal(String(row.code_hash || ""), expected)) return reply({ ok: false, error: "Verifikasi perangkat sudah kedaluwarsa. Ulangi pemeriksaan." }, 400);
  let payload;
  try { payload = JSON.parse(row.payload_json || "{}"); } catch { payload = null; }
  if (!payload?.userId || !payload?.deviceKeyHash) return reply({ ok: false, error: "Data verifikasi perangkat tidak valid." }, 400);
  const trusted = await env.AUTH_DB.prepare("SELECT user_id FROM auth_trusted_devices WHERE user_id=?1 AND device_hash=?2 LIMIT 1").bind(payload.userId, payload.deviceKeyHash).first();
  const user = await env.AUTH_DB.prepare("SELECT id FROM auth_users WHERE id=?1 AND email=?2 COLLATE NOCASE LIMIT 1").bind(payload.userId, email).first();
  if (!trusted || !user) return reply({ ok: false, error: "Perangkat tidak lagi terdaftar pada akun ini." }, 403);
  const salt = randomHex(16), hash = await passwordDigest(password, salt), now = Date.now();
  await env.AUTH_DB.prepare("UPDATE auth_users SET password_salt=?1,password_hash=?2,password_iterations=?3,updated_at=?4 WHERE id=?5").bind(salt, hash, ITERATIONS, now, user.id).run();
  await env.AUTH_DB.prepare("DELETE FROM auth_sessions WHERE user_id=?1").bind(user.id).run();
  await env.AUTH_DB.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose='device_reset'").bind(email).run();
  return reply({ ok: true, message: "Reset password berhasil. Silakan masuk menggunakan email dan password baru." });
}
async function startReset(request, env) {
  const b = await bodyOf(request), email = emailOf(b?.email);
  if (!validEmail(email)) return reply({ ok: false, error: "Masukkan email yang valid." }, 400);
  if (limited(request, "reset-start", 4, 600000)) return reply({ ok: false, error: "Terlalu banyak permintaan reset." }, 429);
  if (!(await captcha(request, b.captchaToken, env))) return reply({ ok: false, error: "Selesaikan CAPTCHA sebelum memeriksa email." }, 400);
  const user = await env.AUTH_DB.prepare("SELECT id FROM auth_users WHERE email=?1 COLLATE NOCASE LIMIT 1").bind(email).first();
  if (user) {
    const token = randomHex(32), now = Date.now();
    const hash = await digest(String(env.AUTH_SESSION_SECRET) + "|reset-link|" + token);
    await env.AUTH_DB.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose='reset_link'").bind(email).run();
    await env.AUTH_DB.prepare("INSERT INTO auth_verifications (email,purpose,code_hash,payload_json,created_at,expires_at,attempts,last_sent_at) VALUES (?1,'reset_link',?2,NULL,?3,?4,0,?3)").bind(email, hash, now, now + 15 * 60 * 1000).run();
    const link = new URL("/", request.url); link.searchParams.set("resetToken", token);
    try { await sendResetLink(email, link.href, env); }
    catch {
      await env.AUTH_DB.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose='reset_link'").bind(email).run();
      return reply({ ok: false, error: "Email reset belum berhasil dikirim. Coba lagi nanti." }, 502);
    }
  }
  return reply({ ok: true, message: "Jika email cocok dengan akun ARYANZZ, tautan reset aman sudah dikirim ke Gmail." });
}
async function checkResetLink(request, env) {
  const b = await bodyOf(request), token = String(b?.token || "");
  if (!/^[a-f0-9]{64}$/i.test(token)) return reply({ ok: false, error: "Tautan reset tidak valid atau sudah kedaluwarsa." }, 400);
  const row = await resetLinkRow(token, env);
  if (!row || Number(row.expires_at) <= Date.now()) return reply({ ok: false, error: "Tautan reset tidak valid atau sudah kedaluwarsa." }, 400);
  return reply({ ok: true, valid: true });
}
async function verifyReset(request, env) {
  const b = await bodyOf(request), token = String(b?.token || "");
  const password = String(b?.password || ""), confirm = String(b?.passwordConfirm || "");
  if (!/^[a-f0-9]{64}$/i.test(token)) return reply({ ok: false, error: "Tautan reset tidak valid atau sudah kedaluwarsa." }, 400);
  if (!validPassword(password)) return reply({ ok: false, error: "Password baru minimal 12 karakter, memakai huruf besar, huruf kecil, angka, dan simbol." }, 400);
  if (password !== confirm) return reply({ ok: false, error: "Ulangi password belum sama." }, 400);
  if (limited(request, "reset-verify", 10, 600000)) return reply({ ok: false, error: "Terlalu banyak percobaan reset password." }, 429);
  const row = await resetLinkRow(token, env);
  if (!row || Number(row.expires_at) <= Date.now()) return reply({ ok: false, error: "Tautan reset tidak valid atau sudah kedaluwarsa." }, 400);
  const user = await env.AUTH_DB.prepare("SELECT id FROM auth_users WHERE email=?1 COLLATE NOCASE LIMIT 1").bind(row.email).first();
  if (!user) return reply({ ok: false, error: "Akun tidak ditemukan." }, 404);
  const salt = randomHex(16), hash = await passwordDigest(password, salt), now = Date.now();
  await env.AUTH_DB.prepare("UPDATE auth_users SET password_salt=?1,password_hash=?2,password_iterations=?3,updated_at=?4 WHERE id=?5").bind(salt, hash, ITERATIONS, now, user.id).run();
  await env.AUTH_DB.prepare("DELETE FROM auth_sessions WHERE user_id=?1").bind(user.id).run();
  await env.AUTH_DB.prepare("DELETE FROM auth_verifications WHERE email=?1 AND purpose='reset_link'").bind(row.email).run();
  return reply({ ok: true, message: "Reset password berhasil. Silakan masuk menggunakan password baru." });
}

export async function handleAuthRequest(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path === "/api/auth/config" && request.method === "GET") {
    const missing = missingConfig(env), active = missing.length === 0;
    return reply({ ok: true, ready: active, publicVersion: "V1", captchaSiteKey: String(env.AUTH_TURNSTILE_SITE_KEY || ""), missing,
      message: active ? "Layanan akun online siap." : "Layanan akun online menunggu konfigurasi: " + missing.join(", ") + "." });
  }
  if (path === "/api/auth/logout" && request.method === "POST") return logout(request, env);
  if (!ready(env)) return reply({ ok: false, code: "AUTH_NOT_CONFIGURED", error: "Layanan akun online belum dikonfigurasi. Akun lokal lama tetap dapat digunakan pada perangkat asal." }, 503);
  try {
    if (path === "/api/auth/me" && request.method === "GET") return me(request, env);
    if (request.method !== "POST") return reply({ ok: false, error: "Metode tidak diizinkan." }, 405);
    if (path === "/api/auth/register/start") return startRegister(request, env);
    if (path === "/api/auth/register/verify") return verifyRegister(request, env);
    if (path === "/api/auth/login") return login(request, env);
    if (path === "/api/auth/legacy/start") return startLegacy(request, env);
    if (path === "/api/auth/legacy/verify") return verifyLegacy(request, env);
    if (path === "/api/auth/reset/device/start") return startDeviceReset(request, env);
    if (path === "/api/auth/reset/device/verify") return verifyDeviceReset(request, env);
    if (path === "/api/auth/reset/start") return startReset(request, env);
    if (path === "/api/auth/reset/check") return checkResetLink(request, env);
    if (path === "/api/auth/reset/verify") return verifyReset(request, env);
    return reply({ ok: false, error: "Endpoint autentikasi tidak ditemukan." }, 404);
  } catch (error) {
    console.error("[ARYANZZ_AUTH] request_failed", path, error instanceof Error ? error.name : "unknown");
    return reply({ ok: false, error: "Layanan akun sementara tidak tersedia. Coba lagi nanti." }, 500);
  }
}
