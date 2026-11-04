// ARYANZZ V90.2 — wait for the FFmpeg module worker to register its message handler
// before the main thread can send LOAD. Without top-level await, the first message
// can arrive while the dynamic import is still pending and be silently lost.
try {
  await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js");
} catch (firstError) {
  try {
    await import("https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js");
  } catch (secondError) {
    const reason = String(secondError?.message || firstError?.message || "Worker module gagal dimuat");
    self.onmessage = ({ data }) => {
      self.postMessage({
        id: data?.id,
        type: "ERROR",
        data: "FFmpeg worker gagal dimuat dari CDN: " + reason
      });
    };
  }
}