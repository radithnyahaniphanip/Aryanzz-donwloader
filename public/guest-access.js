(() => {
  "use strict";
  const ownerMode = new URLSearchParams(location.search).get("owner") === "1";
  if (ownerMode) { window.aryanzzGuestReady = Promise.resolve(null); return; }
  const $ = id => document.getElementById(id);
  const LOCAL_ID_KEY = "aryanzz.public.guest.id.v1";
  const RESTORE_KEY = "aryanzz.public.guest.restore.v1";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomId = () => "ARY-" + Array.from(crypto.getRandomValues(new Uint8Array(10)), v => alphabet[v % alphabet.length]).join("");
  function setIdentity(user, localOnly = false) {
    if (!user || !/^ARY-[A-Z0-9]{10}$/i.test(String(user.id || ""))) return;
    if (!localOnly) { try { localStorage.setItem(LOCAL_ID_KEY, String(user.id)); } catch {} }
    const role = String(user.role || "guest").toLowerCase();
    const isAdmin = ["owner", "admin", "developer"].includes(role) || String(user.id).toUpperCase() === "ARY-ZFTLQPEX92";
    window.aryanzzAuthUser = user;
    window.aryanzzIsDeveloper = isAdmin;
    const id = $("profileRandomId"), copy = $("profileCopyId"), logout = $("accountLogout");
    if (id) {
      id.textContent = user.id;
      id.classList.toggle("ary-developer-id", isAdmin);
      id.setAttribute("aria-label", "ID pengguna ARYANZZ");
    }
    if (copy) {
      copy.dataset.accountId = user.id;
      if (!copy.dataset.guestCopyBound) {
        copy.dataset.guestCopyBound = "1";
        copy.addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(String(window.aryanzzAuthUser?.id || user.id)); showNotice("ID ARYANZZ berhasil disalin."); }
          catch { showNotice("Browser tidak mengizinkan penyalinan otomatis. Tekan lama ID untuk menyalinnya.", true); }
        });
      }
    }
    if (logout) logout.hidden = true;
    if ($("profileIdDescription")) $("profileIdDescription").textContent = "ID otomatis untuk mengenali perangkat dan status Membership ARYANZZ.";
    if ($("profileAccountEmail")) $("profileAccountEmail").textContent = user.guest || localOnly ? "Tidak diperlukan" : (user.email || "Tidak diperlukan");
    if ($("profileAccountNote")) $("profileAccountNote").textContent = "● " + (localOnly ? "ID sementara · server belum tersambung" : "Akses publik · ID otomatis tersimpan di server");
    if ($("profileSummary")) $("profileSummary").textContent = user.fullName || "Pengunjung ARYANZZ";
    if ($("profileName") && !String($("profileName").value || "").trim()) $("profileName").value = user.fullName || "Pengunjung ARYANZZ";
    for (const id of ["ownerLinkEditor", "securityCenter", "ownerEditProfile"]) if ($(id)) $(id).hidden = !isAdmin;
    document.body.classList.toggle("ary-developer-account", isAdmin);
    document.body.classList.add("ary-public-access");
    document.dispatchEvent(new CustomEvent("aryanzz:guest-ready", { detail: { userId: user.id, localOnly } }));
    window.dispatchEvent(new CustomEvent("aryanzz:auth-change", { detail: { userId: user.id, authenticated: true, guest: !!user.guest, localOnly } }));
  }
  function showNotice(message, error = false) {
    let node = $("aryGuestAccessNotice");
    if (!node) {
      node = document.createElement("div");
      node.id = "aryGuestAccessNotice";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      node.style.cssText = "position:fixed;z-index:99999;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,460px);padding:14px 17px;border:1px solid #45627f;border-radius:14px;background:#0c1929;color:#edf5ff;box-shadow:0 18px 55px #0009;font:600 14px/1.5 system-ui,sans-serif";
      document.body.append(node);
    }
    node.style.borderColor = error ? "#e66b83" : "#39c7ad";
    node.textContent = message;
    node.hidden = false;
    if (!error) setTimeout(() => { if (node.isConnected) node.hidden = true; }, 6500);
  }
  function showBlocked(id, message) {
    const gate = $("aryAuthGate");
    if (!gate) return;
    gate.replaceChildren();
    const card = document.createElement("section"); card.className = "ary-auth-blocked-card";
    const mark = document.createElement("div"); mark.className = "ary-auth-blocked-mark"; mark.textContent = "⛔";
    const title = document.createElement("h1"); title.textContent = "ID kamu telah di-banned";
    const detail = document.createElement("p"); detail.textContent = (message || "Akses ARYANZZ dihentikan oleh administrator.") + (id ? " ID: " + id : "");
    const help = document.createElement("a"); help.className = "ary-auth-blocked-contact"; help.href = "https://wa.me/6282110767071?text=" + encodeURIComponent("Halo dukungan ARYANZZ, saya ingin meminta peninjauan pemblokiran ID " + (id || "saya") + "."); help.target = "_blank"; help.rel = "noopener noreferrer"; help.textContent = "Hubungi dukungan WhatsApp · 082110767071";
    card.append(mark, title, detail, help); gate.append(card); gate.hidden = false;
    document.body.classList.remove("ary-authenticated");
  }
  function localFallback(message = "Website dapat digunakan tanpa login. ID sementara ini belum tersinkron dengan server moderasi.", error = true) {
    let id = "";
    try { id = localStorage.getItem(LOCAL_ID_KEY) || ""; } catch {}
    if (!/^ARY-[A-Z0-9]{10}$/i.test(id)) {
      id = randomId();
      try { localStorage.setItem(LOCAL_ID_KEY, id); } catch {}
    }
    setIdentity({ id, fullName: "Pengunjung ARYANZZ", role: "guest", guest: true }, true);
    showNotice(message, error);
    return { ok: false, localOnly: true, user: window.aryanzzAuthUser };
  }
  async function bootstrap() {
    const response = await fetch("/api/auth/guest/bootstrap", { method: "GET", credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      if (response.status === 403 || data.code === "ACCOUNT_BANNED" || data.code === "DEVICE_BANNED") {
        showBlocked(data.userId || "", data.error || "ID ini diblokir.");
        return data;
      }
      const failure = new Error(data.error || "ID pengunjung belum dapat disinkronkan.");
      failure.code = data.code || "";
      throw failure;
    }
    setIdentity(data.user, false);
    if (data.restoredAt) {
      const stamp = String(data.user.id) + ":" + String(data.restoredAt);
      let previous = "";
      try { previous = localStorage.getItem(RESTORE_KEY) || ""; } catch {}
      if (previous !== stamp) {
        try { localStorage.setItem(RESTORE_KEY, stamp); } catch {}
        showNotice("Akunmu telah dipulihkan. Akses ARYANZZ sudah aktif kembali; kamu tidak perlu login.");
      }
    }
    return data;
  }
  window.aryanzzGuestReady = new Promise(resolve => {
    const start = () => {
      bootstrap().catch(error => {
        console.warn("[ARYANZZ] Guest identity fallback:", error?.message || "unavailable");
        if(error?.code==="ADMIN_SESSION_REQUIRED")return localFallback("Akses publik tetap tersedia. Sesi administrator berakhir; gunakan /?owner=1 untuk masuk kembali ke panel admin.",false);
        return localFallback();
      }).then(resolve);
    };
    // auth-gate.js registers its DOMContentLoaded handler first; wait for it
    // so the public guest identity cannot be overwritten by setUser(null).
    if (document.readyState === "loading" || document.readyState === "interactive") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else start();
  });
})();