/* ARYANZZ V69.0 — serverless status and release UI */
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
        status.textContent = "Backend downloader aktif · yt-dlp + FFmpeg · " + (data.platforms?.length || "multi") + " platform";
      } else if (!data.configured) {
        status.dataset.state = "warn";
        status.textContent = "Mode gratis tanpa server aktif · file media langsung dapat diunduh; tautan sosial memakai provider komunitas.";
      } else {
        status.dataset.state = "error";
        status.textContent = "Provider ekstraksi belum tersedia. File media langsung tetap bisa diunduh; gunakan direktori komunitas untuk tautan sosial.";
      }
    } catch {
      status.dataset.state = "error";
      status.textContent = "Status backend downloader belum dapat diperiksa.";
    }
  }
  refreshBackendStatus();
  window.addEventListener("online", refreshBackendStatus);
  window.addEventListener("focus", refreshBackendStatus);
})();
