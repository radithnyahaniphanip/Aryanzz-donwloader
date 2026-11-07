(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const gate = $("aryAuthGate"), message = $("aryAuthMessage");
  const USERS_KEY = "aryanzz.local.accounts.v94", SESSION_KEY = "aryanzz.local.session.v94", DEVICE_KEY = "aryanzz.device.key.v1";
  let config = { ready: false, moderationReady:false, captchaSiteKey: "" }, widgetId = null, captchaToken = "", pendingEmail = "", pendingLegacy = null, pendingResetToken = new URLSearchParams(location.search).get("resetToken") || "", resetVerifiedUserId = "", resetDeviceToken = "", resetUsesLocalAccount = false;

  const say = (value, error = false) => { if (message) { message.textContent = value; message.classList.toggle("is-error", !!error); } };
  function showModerationBlock(reason){
    if(!gate)return;
    gate.replaceChildren();
    const card=document.createElement("section");card.className="ary-auth-blocked-card";
    const mark=document.createElement("div");mark.textContent="⛔";mark.className="ary-auth-blocked-mark";
    const title=document.createElement("h1");title.textContent="Akunmu diblokir";
    const detail=document.createElement("p");detail.textContent=String(reason||"Akses ARYANZZ dihentikan karena pelanggaran aturan.").slice(0,500);
    const help=document.createElement("a");help.href="https://wa.me/6282110767071?text=Halo%20pembuat%20ARYANZZ%2C%20saya%20ingin%20meminta%20peninjauan%20pemblokiran%20akun%20saya.";help.target="_blank";help.rel="noopener noreferrer";help.textContent="Hubungi pembuat · WhatsApp 082110767071";help.className="ary-auth-blocked-contact";
    card.append(mark,title,detail,help);gate.append(card);gate.hidden=false;
    document.body.classList.remove("ary-authenticated");
  }
  const readUsers = () => { try { const raw = localStorage.getItem(USERS_KEY); if (raw === null) return []; const value = JSON.parse(raw); return Array.isArray(value) ? value : null; } catch { return null; } };
  const saveLocalSession = user => { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, createdAt: Date.now() })); return true; } catch { return false; } };
  const localSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } };
  const hex = bytes => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
  async function passwordHash(password, saltHex, iterations = 250000) {
    const salt = Uint8Array.from(String(saltHex).match(/.{2}/g) || [], value => parseInt(value, 16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
  }
  async function currentDeviceHash() {
    const cookieName = "aryanzz_device_id";
    const cookieToken = document.cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith(cookieName+"="))?.slice(cookieName.length+1)||"";
    let token = localStorage.getItem(DEVICE_KEY) || cookieToken;
    if (!/^[a-f0-9]{64}$/i.test(token)) token = hex(crypto.getRandomValues(new Uint8Array(32)));
    try { localStorage.setItem(DEVICE_KEY, token); } catch {}
    try { if (cookieToken !== token) document.cookie = cookieName+"="+token+"; Max-Age=63072000; Path=/; Secure; SameSite=Lax"; } catch {}
    return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  }
  async function rememberCurrentDevice(user) {
    const users = readUsers();
    if (!Array.isArray(users)) throw new Error("Data akun pada browser tidak dapat dibaca.");
    const index = users.findIndex(item => item.id === user.id);
    if (index < 0) throw new Error("Akun tidak ditemukan pada browser ini.");
    const deviceKeyHash = await currentDeviceHash();
    users[index] = { ...users[index], deviceKeyHash };
    delete users[index].recoverySalt;
    delete users[index].recoveryHash;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    Object.assign(user, users[index]);
  }
  function equal(a, b) { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let n = 0; for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i); return n === 0; }
  function validPassword(value) { return typeof value === "string" && value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value); }
  function passwordStrength(value) { let n = 0; if (value.length >= 12) n++; if (value.length >= 16) n++; if (/[a-z]/.test(value) && /[A-Z]/.test(value)) n++; if (/[0-9]/.test(value)) n++; if (/[^A-Za-z0-9]/.test(value)) n++; if (/(.)\1{3,}|1234|abcd|qwerty|password/i.test(value)) n = Math.max(0, n - 2); return Math.min(4, n); }
  function initStrength(inputId, barId, labelId) {
    const input = $(inputId), bar = $(barId), label = $(labelId), names = ["Lemah", "Menengah", "Kuat", "Lebih kuat"], widths = ["18%", "42%", "72%", "100%"];
    input?.addEventListener("input", () => { const n = passwordStrength(input.value), i = Math.max(0, n - 1); if (bar) bar.style.width = input.value ? widths[i] : "0%"; if (label) label.textContent = input.value ? "Kekuatan password: " + names[i] : "Kekuatan password: belum diisi"; });
  }
  const eyeSvg = visible => visible
    ? '<svg class="ary-eye-svg is-open" viewBox="0 0 24 24" aria-hidden="true"><path class="ary-eye-outline" d="M2.2 12s3.4-6.2 9.8-6.2S21.8 12 21.8 12 18.4 18.2 12 18.2 2.2 12 2.2 12Z"/><circle class="ary-eye-pupil" cx="12" cy="12" r="3.1"/><path class="ary-eye-glint" d="M10.9 10.9a1.4 1.4 0 0 1 2.2 1.6"/></svg>'
    : '<svg class="ary-eye-svg is-closed" viewBox="0 0 24 24" aria-hidden="true"><path class="ary-eye-outline" d="M2.2 12s3.4-6.2 9.8-6.2S21.8 12 21.8 12 18.4 18.2 12 18.2 2.2 12 2.2 12Z"/><circle class="ary-eye-pupil" cx="12" cy="12" r="3.1"/><path class="ary-eye-slash" d="M3 3 21 21"/></svg>';
  function togglePassword(inputId, buttonId) {
    const input = $(inputId), button = $(buttonId); if (!input || !button) return;
    const paint = visible => {
      button.innerHTML = eyeSvg(visible);
      button.dataset.visible = visible ? "true" : "false";
      button.setAttribute("aria-pressed", visible ? "true" : "false");
      button.setAttribute("aria-label", visible ? "Sembunyikan password" : "Lihat password");
      button.title = visible ? "Sembunyikan password" : "Lihat password";
    };
    paint(input.type === "text");
    button.addEventListener("click", () => {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      paint(visible);
      input.focus({ preventScroll: true });
    });
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
    const accountEmail = $("profileAccountEmail"), accountNote = $("profileAccountNote");
    if (accountEmail) accountEmail.textContent = user ? (storedEmail(user) || "Email belum tercatat pada akun ini") : "Belum terhubung";
    if (accountNote) accountNote.textContent = "● " + (user ? (localOnly ? "Akun tersimpan di browser ini" : "Akun tersimpan di server ARYANZZ") : "Belum ada sesi akun aktif");
    const editor = $("ownerLinkEditor"), security = $("securityCenter"), ownerEdit = $("ownerEditProfile");
    if (editor) editor.hidden=!isDeveloper;
    if (security) security.hidden=!isDeveloper;
    if (ownerEdit) ownerEdit.hidden=!isDeveloper;
    document.body.classList.toggle("ary-developer-account", isDeveloper);
    if (gate) gate.hidden = !!user;
    document.body.classList.toggle("ary-authenticated", !!user);
    if ($("profileName") && user?.fullName && ["","Pengguna ARYANZZ","Anggota ARYANZZ"].includes($("profileName").value.trim())) $("profileName").value = user.fullName;
    if ($("profileSummary")) $("profileSummary").textContent = String(user?.fullName || "Anggota ARYANZZ");
    window.dispatchEvent(new CustomEvent("aryanzz:auth-change",{detail:{userId:String(user?.id||""),authenticated:!!user,localOnly:!!localOnly}}));
  }
  function showStep(id) {
    for (const form of ["aryRegisterForm","aryLoginForm","aryResetStartForm","aryRegisterVerifyForm","aryLegacyVerifyForm","aryResetVerifyForm"]) if ($(form)) $(form).hidden = form !== id;
    const tabs = $("aryAuthTabs");
    if (tabs) tabs.hidden = ["aryResetStartForm","aryRegisterVerifyForm","aryLegacyVerifyForm","aryResetVerifyForm"].includes(id);
    const needsServerCaptcha = config.ready && (id === "aryLoginForm" || (config.registrationReady && ["aryRegisterForm","aryResetStartForm"].includes(id)));
    if ($("aryAuthCaptcha")) $("aryAuthCaptcha").hidden = !needsServerCaptcha;
    document.querySelectorAll(".ary-local-captcha").forEach(node => { node.hidden = true; });
    $("aryAuthTitle").textContent = id === "aryRegisterForm" ? "Buat akun ARYANZZ." : id === "aryLoginForm" ? "Selamat datang kembali." : id === "aryResetStartForm" ? "Reset password." : "Verifikasi email.";
    const foot = $("aryAuthFoot");
    if (foot) foot.hidden = id === "aryResetStartForm" || id === "aryResetVerifyForm";
    say("");
  }
  function mode(value) {
    if (value !== "reset") resetVerifiedUserId = "";
    if (value === "register" && !config.registrationReady) { say("Pendaftaran belum tersedia. Layanan email verifikasi belum dikonfigurasi.", true); value = "login"; }
    if (value === "reset") {
      resetVerifiedUserId = ""; resetDeviceToken = ""; resetUsesLocalAccount = false;
      if ($("aryResetCheckPanel")) $("aryResetCheckPanel").hidden = true;
      if ($("aryResetProgressFill")) $("aryResetProgressFill").style.width = "0%";
      if ($("aryResetProgressPercent")) $("aryResetProgressPercent").textContent = "0%";
      if ($("aryResetProgressResult")) $("aryResetProgressResult").hidden = true;
      if ($("aryResetPasswordStage")) $("aryResetPasswordStage").hidden = true;
      if ($("aryResetPassword")) { $("aryResetPassword").value = ""; $("aryResetPassword").disabled = true; }
      if ($("aryResetPasswordConfirm")) { $("aryResetPasswordConfirm").value = ""; $("aryResetPasswordConfirm").disabled = true; }
      if ($("aryResetStartSubmit")) $("aryResetStartSubmit").textContent = "Periksa email dan perangkat";
    }
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
    if (!response.ok || result.ok === false) { const error = new Error(result.error || "Permintaan belum berhasil."); error.code = result.code || ""; error.status = response.status; throw error; }
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
      try { widgetId = window.turnstile.render(mount, { sitekey: config.captchaSiteKey, theme: "light", callback: token => { captchaToken = String(token || ""); }, "expired-callback": () => { captchaToken = ""; }, "error-callback": () => { captchaToken = ""; say("CAPTCHA gagal dimuat. Muat ulang halaman.", true); } }); }
      catch { say("CAPTCHA belum dapat dimuat. Periksa konfigurasi Turnstile.", true); }
    };
    if (window.turnstile) { render(); return; }
    if (document.querySelector('script[data-aryanzz-turnstile="1"]')) return;
    const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true; script.defer = true; script.dataset.aryanzzTurnstile = "1"; script.onload = render; script.onerror = () => say("CAPTCHA gagal dimuat. Periksa koneksi lalu muat ulang.", true); document.head.appendChild(script);
  }
  const normalizeEmail = value => String(value || "").normalize("NFKC").trim().toLowerCase();
  function storedEmail(user) { return normalizeEmail(user?.email || user?.emailAddress || user?.email_address || user?.gmail || user?.mail || user?.account?.email || ""); }
  function legacyAccount(identifier) {
    const users = readUsers(); if (!Array.isArray(users)) return null;
    const key = normalizeEmail(identifier);
    return users.find(user => storedEmail(user) === key || String(user.id || "").trim().toLowerCase() === key) || null;
  }
  async function validLegacyPassword(user, password) {
    if (!user?.salt || !user?.passwordHash) return false;
    const iterations = Math.max(100000, Math.min(1000000, Number(user.iterations) || 250000));
    return equal(await passwordHash(password, user.salt, iterations), String(user.passwordHash));
  }
  const captchaAnswers = Object.create(null);
  function refreshLocalCaptcha(prefix) {
    const left = 2 + Math.floor(Math.random() * 8), right = 1 + Math.floor(Math.random() * 8);
    captchaAnswers[prefix] = String(left + right);
    const label = $(prefix + "CaptchaQuestion"), input = $(prefix + "CaptchaAnswer");
    if (label) label.textContent = "Verifikasi manusia: " + left + " + " + right + " = ?";
    if (input) input.value = "";
  }
  function checkLocalCaptcha(prefix) {
    const answer = String($(prefix + "CaptchaAnswer")?.value || "").trim();
    const ok = !!answer && answer === captchaAnswers[prefix];
    refreshLocalCaptcha(prefix);
    if (!ok) say("Jawaban CAPTCHA belum benar. Coba soal yang baru.", true);
    return ok;
  }
  async function localLogin(identifier, password) {
    const user = legacyAccount(identifier);
    if (!user || !(await validLegacyPassword(user, password))) { say("Email/ID atau password tidak cocok.", true); return; }
    try { await rememberCurrentDevice(user); }
    catch (error) { return say(error.message, true); }
    if (!saveLocalSession(user)) { say("Sesi lokal tidak dapat disimpan. Aktifkan penyimpanan browser.", true); return; }
    setUser(user, true); say("Berhasil masuk ke akun ARYANZZ pada browser ini.");
  }
  async function register(event) {
    event.preventDefault();
    const fullName = $("aryRegName").value.trim(), email = normalizeEmail($("aryRegEmail").value), password = $("aryRegPassword").value, confirm = $("aryRegPasswordConfirm").value;
    if (!config.registrationReady) return say("Pendaftaran sementara ditutup sampai database, perlindungan server, dan email verifikasi siap.", true);
    if (fullName.length < 2 || fullName.length > 80) return say("Nama lengkap harus 2–80 karakter.", true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("Masukkan email yang valid.", true);
    if (!validPassword(password)) return say("Password minimal 12 karakter, gunakan huruf besar, huruf kecil, angka, dan simbol.", true);
    const button = $("aryRegisterSubmit"); button.disabled = true; button.textContent = "Memproses pendaftaran…";
    try {
      const deviceHash = await currentDeviceHash();
      if (config.ready) {
        const captchaToken = takeCaptcha(); if (!captchaToken) return;
        const result = await post("/api/auth/register/start", {
          fullName, email, password, passwordConfirm: confirm,
          captchaToken, deviceHash
        });
        pendingEmail = email; $("aryRegisterVerifyEmail").textContent = email;
        showStep("aryRegisterVerifyForm");
        say(result.message || "Kode verifikasi pendaftaran telah dikirim ke email kamu.");
        return;
      }
      if (!checkLocalCaptcha("aryReg")) return;
      const users = readUsers();
      if (!Array.isArray(users)) return say("Penyimpanan browser tidak dapat dibaca. Periksa izin penyimpanan.", true);
      if (users.some(u => storedEmail(u) === email)) return say("Email tersebut sudah terdaftar pada browser ini.", true);
      if (users.some(u => u.deviceKeyHash === deviceHash)) return say("Dilarang! Pakai akun utama kamu yang sudah terhubung di perangkat ini.", true);
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      const [hash, deviceKeyHash] = await Promise.all([passwordHash(password, salt, 250000), Promise.resolve(deviceHash)]);
      const user = {
        id:"ARY-" + Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(16).padStart(2,"0")).join("").toUpperCase(),
        fullName, email, salt, passwordHash:hash, iterations:250000, deviceKeyHash,
        createdAt:Date.now(), localOnly:true
      };
      users.push(user); localStorage.setItem(USERS_KEY, JSON.stringify(users));
      saveLocalSession(user); setUser(user, true);
      say("Akun dibuat pada browser ini. Penyimpanan akun online belum aktif.");
    } catch (error) { say("Pendaftaran belum berhasil: " + error.message, true); }
    finally { button.disabled = false; button.textContent = "Buat akun ARYANZZ"; }
  }
  async function verifyRegister(event) {
    event.preventDefault(); const button = $("aryRegisterVerifySubmit"); button.disabled = true;
    try {
      const result = await post("/api/auth/register/verify", {
        email: pendingEmail, code: $("aryRegisterCode").value.trim(),
        deviceHash: await currentDeviceHash()
      });
      setUser(result.user, false); pendingEmail = "";
      say("Email berhasil diverifikasi. Akun tersimpan di server ARYANZZ.");
    } catch (error) { say(error.message, true); }
    finally { button.disabled = false; }
  }
  async function login(event) {
    event.preventDefault();
    const identifier = $("aryLoginIdentifier").value.trim(), password = $("aryLoginPassword").value;
    if (!config.ready) return say("Login online belum aktif. Pemilik website perlu menyelesaikan konfigurasi keamanan server.", true);
    if (!identifier || !password) return say("Masukkan email/ID dan password.", true);
    if (password !== confirm) return say("Konfirmasi password belum sama.", true);
    const button = $("aryLoginSubmit"); button.disabled = true; button.textContent = "Memeriksa…";
    try {
      if (config.ready) {
        const captchaToken = takeCaptcha(); if (!captchaToken) return;
        try {
          const result = await post("/api/auth/login", { identifier, password, captchaToken, deviceHash: await currentDeviceHash() });
          setUser(result.user, false); $("aryLegacyMigrate").hidden = true;
          say(result.message || "Berhasil masuk. Akun ditemukan menggunakan email atau ID ARYANZZ.");
          return;
        } catch (error) {
          const localUser = error.code === "ACCOUNT_NOT_FOUND" ? legacyAccount(identifier) : null;
          if (localUser && await validLegacyPassword(localUser, password)) {
            pendingLegacy = localUser; $("aryLegacyMigrate").hidden = false;
            say("Akun lama ditemukan pada perangkat ini. Pilih “Pindahkan akun lama” agar email dan ID tersimpan di server ARYANZZ.");
            return;
          }
          throw error;
        }
      }
      if (!checkLocalCaptcha("aryLogin")) return;
      await localLogin(identifier, password);
    } catch (error) { if(error.code==="ACCOUNT_BANNED"||error.code==="DEVICE_BANNED")showModerationBlock(error.message);else say(error.message, true); }
    finally { button.disabled = false; button.textContent = "Masuk ke ARYANZZ"; }
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
    try {
      const result = await post("/api/auth/legacy/verify", {
        email: pendingEmail, code: $("aryLegacyCode").value.trim(),
        deviceHash: await currentDeviceHash()
      });
      setUser(result.user, false); pendingLegacy = null; $("aryLegacyMigrate").hidden = true;
      say("Akun lama berhasil dipindahkan ke server. ID dan password tetap dipertahankan.");
    } catch (error) { say(error.message, true); }
    finally { button.disabled = false; }
  }
  const resetWait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function animateDeviceCheck() {
    const panel = $("aryResetCheckPanel"), fill = $("aryResetProgressFill"), percent = $("aryResetProgressPercent"), text = $("aryResetProgressText"), result = $("aryResetProgressResult");
    panel.hidden = false; result.hidden = true; fill.style.width = "0%"; percent.textContent = "0%";
    const steps = [
      ["Memeriksa email kamu…", 28],
      ["Mencari ID ARYANZZ yang terhubung…", 62],
      ["Mencocokkan perangkat yang pernah terdaftar…", 92]
    ];
    for (const [label, value] of steps) {
      text.textContent = label; fill.style.width = value + "%"; percent.textContent = value + "%";
      await resetWait(420);
    }
    text.textContent = "Mencocokkan data akun dan perangkat…";
    await resetWait(220);
  }
  async function startReset(event) {
    event.preventDefault();
    const email = normalizeEmail($("aryResetEmail").value), button = $("aryResetStartSubmit");
    if (!resetVerifiedUserId) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("Masukkan alamat email yang benar.", true);
      const captchaToken = config.ready ? takeCaptcha() : "";
      if (config.ready && !captchaToken) return;
      const users = config.ready ? null : readUsers();
      if (!config.ready && !Array.isArray(users)) return say("Data akun pada browser tidak dapat dibaca.", true);
      button.disabled = true; button.textContent = "Memeriksa email kamu…";
      try {
        await animateDeviceCheck();
        if (config.ready) {
          try {
            const result = await post("/api/auth/reset/device/start", {
              email, deviceHash: await currentDeviceHash(), captchaToken
            });
            resetVerifiedUserId = result.userId; resetDeviceToken = result.token;
            resetUsesLocalAccount = false;
          } catch (serverError) {
            if (!["DEVICE_NOT_RECOGNIZED","ACCOUNT_NOT_FOUND"].includes(serverError.code)) throw serverError;
            const localUsers = readUsers();
            if (!Array.isArray(localUsers)) throw serverError;
            const localUser = localUsers.find(item => storedEmail(item) === email && item.localOnly !== false);
            if (!localUser) throw serverError;
            const deviceHash = await currentDeviceHash();
            if (!localUser.deviceKeyHash || !equal(String(localUser.deviceKeyHash), deviceHash)) {
              throw new Error("Email ditemukan pada akun lama yang tersimpan di browser, tetapi perangkat ini tidak cocok. Gunakan browser asal akun tersebut.");
            }
            resetVerifiedUserId = localUser.id;
            resetUsesLocalAccount = true;
          }
        } else {
          const user = users.find(item => storedEmail(item) === email);
          if (!user) { say("Email ini belum terdaftar pada browser/perangkat ini.", true); return; }
          const deviceHash = await currentDeviceHash();
          if (!user.deviceKeyHash || !equal(String(user.deviceKeyHash), deviceHash)) {
            say("Perangkat ini tidak cocok dengan perangkat yang pernah digunakan untuk akun tersebut. Gunakan browser dan perangkat asal.", true);
            return;
          }
          resetVerifiedUserId = user.id;
          resetUsesLocalAccount = true;
        }
        $("aryResetProgressFill").style.width = "100%";
        $("aryResetProgressPercent").textContent = "100%";
        $("aryResetProgressText").textContent = "Pemeriksaan selesai";
        $("aryResetProgressResult").hidden = false;
        $("aryResetPasswordStage").hidden = false;
        $("aryResetPassword").disabled = false;
        $("aryResetPasswordConfirm").disabled = false;
        $("aryResetProgressResult").querySelector("small").textContent = "Email, ID " + resetVerifiedUserId + ", dan perangkat terdaftar cocok.";
        button.textContent = "Simpan Password Baru";
        $("aryResetPassword").focus();
        say("Verifikasi berhasil. Sekarang buat password baru.");
      } catch (error) { say(error.message, true); }
      finally { button.disabled = false; if (!resetVerifiedUserId) button.textContent = "Periksa email dan perangkat"; }
      return;
    }
    const password = $("aryResetPassword").value, confirm = $("aryResetPasswordConfirm").value;
    if (!validPassword(password)) return say("Password baru minimal 12 karakter, gunakan huruf besar, huruf kecil, angka, dan simbol.", true);
    if (password !== confirm) return say("Ulangi password baru belum sama.", true);
    try {
      button.disabled = true; button.textContent = "Menyimpan password…";
      if (config.ready && !resetUsesLocalAccount) {
        await post("/api/auth/reset/device/verify", {
          email, token: resetDeviceToken, password, passwordConfirm: confirm
        });
      } else {
        const users = readUsers();
        if (!Array.isArray(users)) return say("Data akun pada browser tidak dapat dibaca.", true);
        const index = users.findIndex(item => item.id === resetVerifiedUserId && storedEmail(item) === email);
        if (index < 0) { resetVerifiedUserId = ""; return say("Akun tidak ditemukan. Ulangi pemeriksaan email.", true); }
        const deviceHash = await currentDeviceHash();
        if (!users[index].deviceKeyHash || !equal(String(users[index].deviceKeyHash), deviceHash)) {
          resetVerifiedUserId = ""; return say("Perangkat berubah. Ulangi pemeriksaan dari perangkat yang terdaftar.", true);
        }
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        users[index].passwordHash = await passwordHash(password, salt, 250000);
        users[index].salt = salt; users[index].iterations = 250000;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      resetVerifiedUserId = ""; resetDeviceToken = ""; resetUsesLocalAccount = false;
      $("aryResetPassword").value = ""; $("aryResetPasswordConfirm").value = "";
      $("aryResetPassword").disabled = true; $("aryResetPasswordConfirm").disabled = true;
      $("aryLoginPassword").value = "";
      mode("login"); $("aryLoginIdentifier").value = email;
      say("✓ Reset password berhasil. Silakan masuk menggunakan email dan password baru.");
    } catch (error) { say(error.message, true); }
    finally { button.disabled = false; if (resetVerifiedUserId) button.textContent = "Simpan Password Baru"; }
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
    [["aryRegPassword","aryRegEye"],["aryRegPasswordConfirm","aryRegConfirmEye"],["aryLoginPassword","aryLoginEye"],["aryResetPassword","aryResetEye"],["aryResetPasswordConfirm","aryResetConfirmEye"],["aryLegacyResetPassword","aryLegacyResetEye"],["aryLegacyResetPasswordConfirm","aryLegacyResetConfirmEye"]].forEach(pair => togglePassword(pair[0], pair[1]));
    initStrength("aryRegPassword","aryStrengthBar","aryStrengthLabel"); initStrength("aryResetPassword","aryResetStrengthBar","aryResetStrengthLabel");
    document.querySelectorAll("[data-auth-mode]").forEach(button => button.addEventListener("click", () => mode(button.dataset.authMode)));
    $("aryRegisterForm")?.addEventListener("submit", register); $("aryLoginForm")?.addEventListener("submit", login);

    $("aryRegisterVerifyForm")?.addEventListener("submit", verifyRegister); $("aryLegacyVerifyForm")?.addEventListener("submit", verifyLegacy);
    $("aryResetStartForm")?.addEventListener("submit", startReset); $("aryResetVerifyForm")?.addEventListener("submit", verifyReset);
    $("aryForgotPassword")?.addEventListener("click", () => mode("reset")); $("aryBackToLogin")?.addEventListener("click", () => mode("login"));
    $("aryBackToLoginFromRegister")?.addEventListener("click", () => mode("login")); $("aryBackToLoginFromLegacy")?.addEventListener("click", () => mode("login"));
    $("aryLegacyMigrate")?.addEventListener("click", startLegacyMigration);
    $("aryLegacyMigrate").hidden = true;
    $("accountLogout")?.addEventListener("click", async () => { try { await post("/api/auth/logout", {}); } catch {} try { localStorage.removeItem(SESSION_KEY); } catch {} setUser(null); mode("login"); say("Kamu sudah keluar dari akun."); });
    config = { ready:false, registrationReady:false, moderationReady:false, captchaSiteKey:"", missingLogin:[], missingRegistration:[] };
    try {
      const remoteConfig = await get("/api/auth/config");
      config = { ready: remoteConfig.loginReady === true || remoteConfig.ready === true, registrationReady: remoteConfig.registrationReady === true, moderationReady:remoteConfig.moderationReady===true, captchaSiteKey: String(remoteConfig.captchaSiteKey || ""), missingLogin:Array.isArray(remoteConfig.missingLogin)?remoteConfig.missingLogin:[], missingRegistration:Array.isArray(remoteConfig.missingRegistration)?remoteConfig.missingRegistration:[] };
    } catch(error) {
      if(error.code==="ACCOUNT_BANNED"||error.code==="DEVICE_BANNED"){showModerationBlock(error.message);return;}
    }
    const registerTab = document.querySelector('[data-auth-mode="register"]'); if (registerTab) registerTab.hidden = !config.registrationReady;
    refreshLocalCaptcha("aryReg"); refreshLocalCaptcha("aryLogin"); refreshLocalCaptcha("aryReset");
    setUser(null);mode("login");
    if (config.ready) {
      if ($("aryRegisterSubmit")) $("aryRegisterSubmit").disabled = !config.registrationReady;
      if ($("aryAuthFoot")) $("aryAuthFoot").textContent = "Akun tersimpan di server ARYANZZ dan dilindungi pemeriksaan moderasi perangkat.";
      loadCaptcha();
      try {
        const current = await get("/api/auth/me");
        if (current.user) { setUser(current.user, false); return; }
      } catch(error) {
        if(error.code==="ACCOUNT_BANNED"||error.code==="DEVICE_BANNED"){showModerationBlock(error.message);return}
      }
      say(config.registrationReady ? "Layanan akun online siap. Masuk atau daftar menggunakan email atau ID ARYANZZ." : "Login siap. Pendaftaran sementara tidak tersedia karena email verifikasi belum dikonfigurasi: " + config.missingRegistration.join(", "), !config.registrationReady);
    } else {
      if ($("aryAuthFoot")) $("aryAuthFoot").textContent = "Login lokal dinonaktifkan. Akun hanya dapat digunakan setelah layanan keamanan server aktif.";
      if ($("aryLoginSubmit")) $("aryLoginSubmit").disabled = true;
      if ($("aryRegisterSubmit")) $("aryRegisterSubmit").disabled = true;
      say("Layanan akun online belum siap. Konfigurasi yang belum tersedia: " + (config.missingLogin.join(", ") || "koneksi server akun") + ".",true);
    }
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) say("Browser ini tidak mendukung Web Crypto. Gunakan Chrome terbaru melalui HTTPS.", true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();