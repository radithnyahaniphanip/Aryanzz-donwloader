/* ARYANZZ V59.5 — backend status and release UI */
(() => {
  "use strict";
  const status = document.getElementById("backendStatus");
  async function refreshBackendStatus() {
    if (!status) return;
    try {
      const response = await fetch("/api/platform/status", { cache: "no-store", headers: { accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (data.configured && data.ok) {
        status.dataset.state = "ready";
        status.textContent = "Downloader server aktif · yt-dlp + FFmpeg · " + (data.platforms?.length || "multi") + " platform";
      } else if (!data.configured) {
        status.dataset.state = "warn";
        status.textContent = "File media langsung siap. Ekstraksi link platform aktif setelah server downloader dihubungkan.";
      } else {
        status.dataset.state = "error";
        status.textContent = "Server downloader terdaftar tetapi belum merespons. Periksa layanan backend.";
      }
    } catch {
      status.dataset.state = "error";
      status.textContent = "Status server downloader belum dapat diperiksa.";
    }
  }
  refreshBackendStatus();
  window.addEventListener("online", refreshBackendStatus);
  window.addEventListener("focus", refreshBackendStatus);
})();
