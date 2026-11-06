(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const gate = $("aryAuthGate"), message = $("aryAuthMessage");
  const USERS_KEY = "aryanzz.local.accounts.v94", SESSION_KEY = "aryanzz.local.session.v94";
  let config = { ready: false, captchaSiteKey: "" }, widgetId = null, captchaToken = "", pendingEmail = "", pendingLegacy = null, pendingResetToken = new URLSearchParams(location.search).get("resetToken") || "";

  const say = (value, error = false) => { if (message) { message.textContent = value; message.classList.toggle("is-error", !!error); } };
  const readUsers = () => { try { const raw = localStorage.getItem(USERS_KEY); if (raw === null) return []; const value = JSON.parse(raw); return Array.isArray(value) ? value : null; } catch { return null; } };
  const saveLocalSession = user => { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, createdAt: Date.now() })); return true; } catch { return false; } };
  const localSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } };
  const hex = bytes => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
  async function passwordHash(password, saltHex, iterations = 250000) {
    const salt = Uint8Array.from(String(saltHex).match(/.{2}/g) || [], value => parseInt(value, 16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
  }
  function equal(a, b) { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let n = 0; for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i); return n === 0; }
  function validPassword(value) { return typeof value === "string" && value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value); }
  function passwordStrength(value) { let n = 0; if (value.length >= 12) n++; if (value.length >= 16) n++; if (/[a-z]/.test(value) && /[A-Z]/.test(value)) n++; if (/[0-9]/.test(value)) n++; if (/[^A-Za-z0-9]/.test(value)) n++; if (/(.)\1{3,}|1234|abcd|qwerty|password/i.test(value)) n = Math.max(0, n - 2); return Math.min(4, n); }
  function initStrength(inputId, barId, labelId) {
    const input = $(inputId), bar = $(barId), label = $(labelId), names = ["Lemah", "Menengah", "Kuat", "Lebih kuat"], widths = ["18%", "42%", "72%", "100%"];
    input?.addEventListener("input", () => { const n = passwordStrength(input.value), i = Math.max(0, n - 1); if (bar) bar.style.width = input.value ? widths[i] : "0%"; if (label) label.textContent = input.value ? "Kekuatan password: " + names[i] : "Kekuatan password: belum diisi"; });
  }
  function togglePassword(inputId, buttonId) {
    const input = $(inputId), button = $(buttonId); if (!input || !button) return;
    button.addEventListener("click", () => { const visible = input.type === "password"; input.type = visible ? "text" : "password"; button.textContent = visible ? "◌" : "◉"; button.setAttribute("aria-label", visible ? "Sembunyikan password" : "Lihat password"); });
  }
  function setUser(user, localOnly = false) {
    window.aryanzzAuthUser = user || null;
    const isDeveloper=!!user&&String(user.id||"").toUpperCase()==="ARY-ZFTLQPEX92";
    window.aryanzzIsDeveloper = isDeveloper;
    const id = $("profileRandomId"), copy = $("profileCopyId"), logout = $("accountLogout"), desc = $("profileIdDescription");
    if (id && user) { id.textContent = user.id; id.classList.toggle("ary-developer-id", isDeveloper); id.setAttribute("aria-label", "ID akun ARYANZZ"); }
    if (copy && user) copy.dataset.accountId = user.id;
    if (logout) logout.hidden = !user;
    if (desc) desc.textContent = localOnly ? "ID akun lokal pada browser ini." : "ID akun ARYANZZ.";
    const editor = $("ownerLinkEditor"), security = $("securityCenter"), ownerEdit = $("ownerEditProfile");
    if (editor) editor.hidden=!isDeveloper;
    if (security) security.hidden=!isDeveloper;
    if (ownerEdit) ownerEdit.hidden=!isDeveloper;
    document.body.classList.toggle("ary-developer-account", isDeveloper);
    if (gate) gate.hidden = !!user;
    document.body.classList.toggle("ary-authenticated", !!user);
    if ($("profileName") && user?.fullName && ["","Pengguna ARYANZZ","Anggota ARYANZZ"].includes($("profileName").value.trim())) $("profileName").value = user.fullName;
    if ($("profileSummary")) $("profileSummary").textContent = String(user?.fullName || "Anggota ARYANZZ");
  }
  function showStep(id) {
    for (const form of ["aryRegisterForm","aryLoginForm","aryResetStartForm","aryRegisterVerifyForm","aryLegacyVerifyForm","aryResetVerifyForm"]) if ($(form)) $(form).hidden = form !== id;
    const tabs = $("aryAuthTabs");
    if (tabs) tabs.hidden = ["aryResetStartForm","aryRegisterVerifyForm","aryLegacyVerifyForm","aryResetVerifyForm"].includes(id);
    if ($("aryAuthCaptcha")) $("aryAuthCaptcha").hidden = !config.ready || !["aryRegisterForm","aryLoginForm","aryResetStartForm"].includes(id);
    $("aryAuthTitle").textContent = id === "aryRegisterForm" ? "Buat akun ARYANZZ." : id === "aryLoginForm" ? "Selamat datang kembali." : id.includes("Reset") ? "Reset password." : "Verifikasi email.";
    const foot = $("aryAuthFoot");
    if (foot) foot.hidden = id === "aryResetStartForm" || id === "aryResetVerifyForm";
    say("");
  }
  function mode(value) {
    showStep(value === "register" ? "aryRegisterForm" : value === "reset" ? "aryResetStartForm" : "aryLoginForm");
    document.querySelectorAll("[data-auth-mode]").forEach(button => button.classList.toggle("active", button.dataset.authMode === value));
  }
  async function post(path, data) {
    const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) { const error = new Error(result.error || "Permintaan belum berhasil."); error.code = result.code || ""; error.status = response.status; throw error; }
    return result;
  }
  async function get(path) {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.error || "Permintaan belum berhasil.");
    return result;
  }
  function takeCaptcha() {
    if (!config.ready) return "";
    if (!captchaToken) { say("Selesaikan verifikasi CAPTCHA terlebih dahulu.", true); return ""; }
    const token = captchaToken; captchaToken = "";
    try { if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId); } catch {}
    return token;
  }
  function loadCaptcha() {
    if (!config.ready || !config.captchaSiteKey || widgetId !== null) return;
    const mount = $("aryAuthCaptcha"); if (!mount) return;
    const render = () => {
      if (!window.turnstile || widgetId !== null) return;
      try { widgetId = window.turnstile.render(mount, { sitekey: config.captchaSiteKey, theme: "dark", callback: token => { captchaToken = String(token || ""); }, "expired-callback": () => { captchaToken = ""; }, "error-callback": () => { captchaToken = ""; say("CAPTCHA gagal dimuat. Muat ulang halaman.", true); } }); }
      catch { say("CAPTCHA belum dapat dimuat. Periksa konfigurasi Turnstile.", true); }
    };
    if (window.turnstile) { render(); return; }
    if (document.querySelector('script[data-aryanzz-turnstile="1"]')) return;
    const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true; script.defer = true; script.dataset.aryanzzTurnstile = "1"; script.onload = render; script.onerror = () => say("CAPTCHA gagal dimuat. Periksa koneksi lalu muat ulang.", true); document.head.appendChild(script);
  }
  function legacyAccount(identifier) {
    const users = readUsers(); if (!Array.isArray(users)) return null;
    const key = String(identifier || "").trim().toLowerCase();
    return users.find(user => String(user.email || "").toLowerCase() === key || String(user.id || "").toLowerCase() === key) || null;
  }
  async function validLegacyPassword(user, password) {
    if (!user?.salt || !user?.passwordHash) return false;
    const iterations = Math.max(100000, Math.min(1000000, Number(user.iterations) || 250000));
    return equal(await passwordHash(password, user.salt, iterations), String(user.passwordHash));
  }
  async function localLogin(identifier, password) {
    const user = legacyAccount(identifier);
    if (!user || !(await validLegacyPassword(user, password))) { say("Email/ID atau password tidak cocok.", true); return; }
    if (!saveLocalSession(user)) { say("Sesi lokal tidak dapat disimpan. Aktifkan penyimpanan browser.", true); return; }
    setUser(user, true);
    say("Berhasil masuk ke akun lokal. Pemindahan ke sistem online tersedia setelah email dan CAPTCHA dikonfigurasi.");
  }
  async function register(event) {
    event.preventDefault();
    if (!config.ready) return say("Pendaftaran online belum aktif. Database, email, dan CAPTCHA harus dikonfigurasi dahulu.", true);
    const fullName = $("aryRegName").value.trim(), email = $("aryRegEmail").value.trim().toLowerCase(), password = $("aryRegPassword").value, confirm = $("aryRegPasswordConfirm").value;
    if (fullName.length < 2 || fullName.length > 80) return say("Nama lengkap harus 2–80 karakter.", true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("Masukkan email yang valid.", true);
    if (!validPassword(password)) return say("Password minimal 12 karakter, gunakan huruf besar, huruf kecil, angka, dan simbol.", true);
    if (password !== confirm) return say("Konfirmasi password belum sama.", true);
    const captchaToken = takeCaptcha(); if (!captchaToken) return;
    const button = $("aryRegisterSubmit"); button.disabled = true; button.textContent = "Mengirim kode…";
    try {
      await post("/api/auth/register/start", { fullName, email, password, passwordConfirm: confirm, redeemCode: $("aryRegRedeem").value.trim(), captchaToken });
      pendingEmail = email; $("aryRegisterVerifyEmail").textContent = email; showStep("aryRegisterVerifyForm"); say("Kode verifikasi 6 digit dikirim ke email. Periksa kotak masuk dan folder spam.");
    } catch (error) { say(error.message, true); }
    finally { button.disabled = false; button.textContent = "Kirim kode verifikasi"; }
  }
  async function verifyRegister(event) {
    event.preventDefault(); const button = $("aryRegisterVerifySubmit"); button.disabled = true;
    try { const result = await post("/api/auth/register/verify", { email: pendingEmail, code: $("aryRegisterCode").value.trim() }); setUser(result.user); say("Email berhasil diverifikasi. Akun ARYANZZ berhasil dibuat."); }
    catch (error) { say(error.message, true); } finally { button.disabled = false; }
  }
  async function login(event) {
    event.preventDefault(); const identifier = $("aryLoginIdentifier").value.trim(), password = $("aryLoginPassword").value;
    if (!identifier || !password) return say("Masukkan email/ID dan password.", true);
    if (!config.ready) return localLogin(identifier, password);
    const captchaToken = takeCaptcha(); if (!captchaToken) return;
    const button = $("aryLoginSubmit"); button.disabled = true; button.textContent = "Memeriksa…"; $("aryLegacyMigrate").hidden = true; pendingLegacy = null;
    try {
      const result = await post("/api/auth/login", { identifier, password, captchaToken }); setUser(result.user); say("Berhasil masuk. Selamat menggunakan ARYANZZ.");
    } catch (error) {
      if (error.code === "ACCOUNT_NOT_FOUND") {
        const legacy = legacyAccount(identifier);
        if (legacy && await validLegacyPassword(legacy, password)) { pendingLegacy = legacy; $("aryLegacyMigrate").hidden = false; say("Akun lokal lama ditemukan. Selesaikan CAPTCHA, lalu pilih Kirim kode migrasi akun lama."); }
        else say(error.message, true);
      } else say(error.message, true);
    } finally { button.disabled = false; button.textContent = "Masuk ke ARYANZZ"; }
  }
  async function startLegacyMigration() {
    if (!pendingLegacy) return;
    const captchaToken = takeCaptcha(); if (!captchaToken) return;
    const button = $("aryLegacyMigrate"); button.disabled = true;
    try {
      const result = await post("/api/auth/legacy/start", { legacy: pendingLegacy, captchaToken });
      pendingEmail = String(pendingLegacy.email || "").toLowerCase(); $("aryLegacyVerifyEmail").textContent = pendingEmail; showStep("aryLegacyVerifyForm"); say(result.message || "Kode migrasi dikirim ke email kamu.");
    } catch (error) { say(error.message, true); } finally { button.disabled = false; }
  }
  async function verifyLegacy(event) {
    event.preventDefault(); const button = $("aryLegacyVerifySubmit"); button.disabled = true;
    try { const result = await post("/api/auth/legacy/verify", { email: pendingEmail, code: $("aryLegacyCode").value.trim() }); setUser(result.user); pendingLegacy = null; say("Akun lama berhasil dipindahkan. ID dan password tetap dipertahankan."); }
    catch (error) { say(error.message, true); } finally { button.disabled = false; }
  }
  async function startReset(event) {
    event.preventDefault();
    if (!config.ready) return say("Layanan akun online belum siap. Pendaftaran dan pemulihan akun memerlukan konfigurasi server.", true);
    const email = $("aryResetEmail").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("Masukkan email yang valid.", true);
    const captchaToken = takeCaptcha(); if (!captchaToken) return;
    const button = $("aryResetStartSubmit"), progress = $("aryResetProgress"), fill = $("aryResetProgressFill"), percent = $("aryResetProgressPercent"), status = $("aryResetProgressText"), resultBox = $("aryResetProgressResult");
    button.disabled = true; button.textContent = "Memeriksa email kamu…";
    if (progress) progress.hidden = false;
    if (resultBox) resultBox.hidden = true;
    if (fill) fill.style.width = "8%";
    if (percent) percent.textContent = "8%";
    if (status) status.textContent = "Memeriksa email dan akun…";
    try {
      await post("/api/auth/reset/start", { email, captchaToken });
      if (fill) fill.style.width = "100%";
      if (percent) percent.textContent = "100%";
      if (status) status.textContent = "Pemeriksaan selesai";
      if (resultBox) resultBox.hidden = false;
      say("Jika email cocok dengan akun ARYANZZ, tautan reset aman sudah dikirim ke Gmail.");
    } catch (error) { if (progress) progress.hidden = true; say(error.message, true); }
    finally { button.disabled = false; button.textContent = "Periksa email"; }
  }
  async function verifyReset(event) {
    event.preventDefault(); const password = $("aryResetPassword").value, confirm = $("aryResetPasswordConfirm").value;
    if (!validPassword(password)) return say("Password baru minimal 12 karakter, gunakan huruf besar, huruf kecil, angka, dan simbol.", true);
    if (password !== confirm) return say("Ulangi password belum sama.", true);
    if (!pendingResetToken) return say("Tautan reset tidak valid. Minta tautan baru melalui email.", true);
    const button = $("aryResetVerifySubmit"); button.disabled = true; button.textContent = "Menyimpan password…";
    try {
      const result = await post("/api/auth/reset/verify", { token: pendingResetToken, password, passwordConfirm: confirm });
      pendingResetToken = "";
      try { history.replaceState({}, "", location.pathname); } catch {}
      $("aryLoginPassword").value = ""; $("aryResetPassword").value = ""; $("aryResetPasswordConfirm").value = "";
      mode("login"); say(result.message || "Reset password berhasil. Silakan masuk menggunakan password baru.");
    } catch (error) { say(error.message, true); }
    finally { button.disabled = false; button.textContent = "Simpan password baru"; }
  }
  async function init() {
    if (!gate) return;
    gate.hidden = true;
    [["aryRegPassword","aryRegEye"],["aryRegPasswordConfirm","aryRegConfirmEye"],["aryLoginPassword","aryLoginEye"],["aryResetPassword","aryResetEye"],["aryResetPasswordConfirm","aryResetConfirmEye"]].forEach(pair => togglePassword(pair[0], pair[1]));
    initStrength("aryRegPassword","aryStrengthBar","aryStrengthLabel"); initStrength("aryResetPassword","aryResetStrengthBar","aryResetStrengthLabel");
    document.querySelectorAll("[data-auth-mode]").forEach(button => button.addEventListener("click", () => mode(button.dataset.authMode)));
    $("aryRegisterForm")?.addEventListener("submit", register); $("aryLoginForm")?.addEventListener("submit", login);
    $("aryRegisterVerifyForm")?.addEventListener("submit", verifyRegister); $("aryLegacyVerifyForm")?.addEventListener("submit", verifyLegacy);
    $("aryResetStartForm")?.addEventListener("submit", startReset); $("aryResetVerifyForm")?.addEventListener("submit", verifyReset);
    $("aryForgotPassword")?.addEventListener("click", () => mode("reset")); $("aryBackToLogin")?.addEventListener("click", () => mode("login"));
    $("aryBackToLoginFromRegister")?.addEventListener("click", () => mode("login")); $("aryBackToLoginFromLegacy")?.addEventListener("click", () => mode("login"));
    $("aryLegacyMigrate")?.addEventListener("click", startLegacyMigration);
    $("accountLogout")?.addEventListener("click", async () => { try { await post("/api/auth/logout", {}); } catch {} try { localStorage.removeItem(SESSION_KEY); } catch {} setUser(null); mode("login"); say("Kamu sudah keluar dari akun."); });
    try { const response = await fetch("/api/auth/config", { cache: "no-store", credentials: "same-origin" }); config = await response.json(); } catch { config = { ready: false, captchaSiteKey: "" }; }
    const registerTab = document.querySelector('[data-auth-mode="register"]'); if (registerTab) registerTab.hidden = false;
    if ($("aryAuthFoot")) $("aryAuthFoot").textContent = config.ready
      ? "Akun tersimpan secara online. Verifikasi email diperlukan untuk pendaftaran dan reset password."
      : "Layanan akun online belum siap: " + (Array.isArray(config.missing) ? config.missing.join(", ") : "konfigurasi server") + ". Akun lokal lama tetap dapat masuk dari perangkat asal.";
    if (pendingResetToken) {
      setUser(null);
      try {
        await post("/api/auth/reset/check", { token: pendingResetToken });
        showStep("aryResetVerifyForm");
        $("aryResetVerified").hidden = false;
        say("Verifikasi email berhasil. Silakan buat password baru.");
      } catch {
        pendingResetToken = "";
        try { history.replaceState({}, "", location.pathname); } catch {}
        mode("reset");
        say("Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.", true);
      }
      return;
    }
    if (config.ready) {
      try { const result = await get("/api/auth/me"); setUser(result.user); return; } catch {}
      const oldUsers = readUsers(), oldSession = localSession();
      const activeLegacy = oldSession && Array.isArray(oldUsers) ? oldUsers.find(user => user.id === oldSession.id) : null;
      setUser(null); mode(oldUsers?.length ? "login" : "register"); loadCaptcha();
      if (activeLegacy) {
        pendingLegacy = activeLegacy;
        $("aryLegacyMigrate").hidden = false;
        say("Sesi akun lama ditemukan di perangkat ini. Selesaikan CAPTCHA lalu pilih Kirim kode migrasi untuk memindahkan akun melalui verifikasi email.");
      } else if (oldUsers?.length) say("Akun lokal lama terdeteksi. Masuk dengan email/ID dan password untuk memindahkannya ke sistem online.");
      return;
    }
    const users = readUsers(), session = localSession();
    const sessionUser = session && Array.isArray(users) ? users.find(user => user.id === session.id) : null;
    if (sessionUser) { setUser(sessionUser, true); return; }
    setUser(null); mode("login");
    if (Array.isArray(users) && users.length) say("Akun lokal lama tetap tersimpan. Masuk menggunakan email atau ID dan password pada perangkat ini.");
    else say("Layanan akun online menunggu konfigurasi database, email verifikasi, dan CAPTCHA.", true);
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) say("Browser ini tidak mendukung Web Crypto. Gunakan Chrome terbaru melalui HTTPS.", true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();