(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const gate = $("authGate");
  if (!gate) return;
  const html = document.documentElement;
  const form = $("authForm");
  const errorBox = $("authError");
  const submit = $("authSubmit");
  let mode = "login";
  const allowedSymbol = /[*\-_#@]/;
  const passwordRules = value => ({
    length: value.length >= 8,
    number: /[0-9]/.test(value),
    symbol: allowedSymbol.test(value)
  });
  function setError(message) {
    errorBox.textContent = message || "";
    errorBox.classList.toggle("show", !!message);
  }
  function setMode(next) {
    mode = next;
    setError("");
    $("authTitle").textContent = mode === "register" ? "Buat akun ARYANZZ" : "Selamat datang kembali";
    $("authSubtitle").textContent = mode === "register" ? "Daftar sekali untuk mulai menggunakan seluruh fitur." : "Masuk untuk melanjutkan ke ARYANZZ Downloader.";
    $("authNameField").hidden = mode !== "register";
    $("authConfirmField").hidden = mode !== "register";
    $("authRules").hidden = mode !== "register";
    $("authSubmit").textContent = mode === "register" ? "Daftar akun" : "Masuk";
    $("authSwitchText").textContent = mode === "register" ? "Sudah punya akun?" : "Belum punya akun?";
    $("authSwitch").textContent = mode === "register" ? "Masuk" : "Daftar sekarang";
    $("authPassword").autocomplete = mode === "register" ? "new-password" : "current-password";
    updateRules();
  }
  function updateRules() {
    const value = $("authPassword").value;
    const rules = passwordRules(value);
    $("ruleLength").classList.toggle("ok", rules.length);
    $("ruleNumber").classList.toggle("ok", rules.number);
    $("ruleSymbol").classList.toggle("ok", rules.symbol);
    if (mode === "register") $("authPassword").setAttribute("aria-invalid", String(value.length > 0 && !Object.values(rules).every(Boolean)));
  }
  document.querySelectorAll("[data-auth-eye]").forEach(button => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.authEye);
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.setAttribute("aria-label", reveal ? "Sembunyikan password" : "Tampilkan password");
      button.innerHTML = reveal
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.2-2.2 3.2M6.2 6.2C3.9 7.7 2.8 10 2.5 12c.9 2.8 4.5 7 9.5 7 1.1 0 2.1-.2 3-.6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  });
  $("authPassword").addEventListener("input", updateRules);
  $("authSwitch").addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));
  $("authLogout")?.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    location.reload();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    setError("");
    const name = $("authName").value.trim();
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    const confirm = $("authConfirm").value;
    if (mode === "register") {
      const rules = passwordRules(password);
      if (!name || name.length < 2) return setError("Nama minimal 2 karakter.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Masukkan alamat email yang valid.");
      if (!Object.values(rules).every(Boolean)) return setError("Password minimal 8 karakter dan wajib berisi angka serta salah satu simbol: * - _ # @.");
      if (password !== confirm) return setError("Konfirmasi password belum sama. Periksa kembali.");
    } else if (!email || !password) return setError("Isi email dan password terlebih dahulu.");
    submit.disabled = true;
    submit.textContent = mode === "register" ? "Membuat akun…" : "Memeriksa akun…";
    try {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "register" ? { name, email, password } : { email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Permintaan akun gagal. Coba lagi.");
      setError("");
      html.classList.remove("auth-required");
      gate.hidden = true;
      location.reload();
    } catch (error) {
      setError(error.message || "Tidak dapat menghubungi layanan akun.");
    } finally {
      submit.disabled = false;
      submit.textContent = mode === "register" ? "Daftar akun" : "Masuk";
    }
  });
  async function boot() {
    html.classList.add("auth-required");
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok && data.user) {
        html.classList.remove("auth-required");
        gate.hidden = true;
        return;
      }
      if (data.code === "AUTH_DATABASE_NOT_READY") setError("Layanan akun sedang disiapkan. Database akun belum aktif; silakan coba lagi setelah deployment selesai.");
      else if (!response.ok && response.status >= 500) setError(data.error || "Layanan akun sementara tidak tersedia.");
    } catch {
      setError("Tidak dapat terhubung ke layanan akun. Periksa koneksi internet lalu coba lagi.");
    }
  }
  setMode("login");
  boot();
})();
