/* ARYANZZ V59.5 — unified self-hosted downloader controller */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const FORMATS = {
    audio: [["mp3","MP3 Audio"],["m4a","M4A Audio"]],
    video: [[360,"360p"],[480,"480p"],[720,"720p HD"],[1080,"1080p Full HD"],[1440,"1440p · 2K"],[2160,"2160p · 4K"]]
  };
  const PLATFORM_NAMES = [
    ["youtube.com","YouTube"],["youtu.be","YouTube"],["tiktok.com","TikTok"],
    ["instagram.com","Instagram"],["facebook.com","Facebook"],["fb.watch","Facebook"],
    ["pinterest.com","Pinterest"],["pin.it","Pinterest"],["x.com","X"],["twitter.com","X"],
    ["reddit.com","Reddit"],["redd.it","Reddit"],["v.redd.it","Reddit"],
    ["vimeo.com","Vimeo"],["dailymotion.com","Dailymotion"],["soundcloud.com","SoundCloud"],
    ["twitch.tv","Twitch"],["streamable.com","Streamable"],["tumblr.com","Tumblr"],
    ["bilibili.com","Bilibili"],["b23.tv","Bilibili"],["vk.com","VK"],["ok.ru","OK.ru"],
    ["rutube.ru","Rutube"],["likee.video","Likee"],["snapchat.com","Snapchat"],
    ["imgur.com","Imgur"],["bandcamp.com","Bandcamp"],["mixcloud.com","Mixcloud"],
    ["ted.com","TED"],["archive.org","Internet Archive"]
  ];
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function safeUrl(raw) {
    try {
      const url = new URL(raw);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
      return url;
    } catch { return null; }
  }
  function platformName(url) {
    const host = url.hostname.toLowerCase();
    const item = PLATFORM_NAMES.find(([domain]) => host === domain || host.endsWith("." + domain));
    return item ? item[1] : "Direct Media URL";
  }
  function status(el, text, error) {
    el.textContent = text;
    el.className = error ? "warning" : "muted";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
  }
  function duration(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    const s = Math.floor(n), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? [h, String(m).padStart(2,"0"), String(sec).padStart(2,"0")].join(":") : [m, String(sec).padStart(2,"0")].join(":");
  }
  function remember(url, name, mode, quality) {
    try {
      const key = "aryanzz.history.v2";
      const old = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([{url,name,mode,quality,at:Date.now()}, ...old.filter(x => x.url !== url)].slice(0,40)));
    } catch {}
  }
  function favorite(url, name, button) {
    try {
      const key = "aryanzz.favorites.v2";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const exists = list.some(x => x.url === url);
      const next = exists ? list.filter(x => x.url !== url) : [{url,name,at:Date.now()}, ...list].slice(0,40);
      localStorage.setItem(key, JSON.stringify(next));
      button.textContent = exists ? "♡ Favorit" : "♥ Tersimpan";
    } catch { button.textContent = "Favorit tidak tersimpan"; }
  }
  async function postJson(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: {"Content-Type":"application/json","Accept":"application/json"},
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Server downloader tidak dapat memproses tautan.");
    return data;
  }
  async function downloadFile(url, mode, quality, bar, progressText) {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: {"Content-Type":"application/json","Accept":"application/octet-stream"},
      body: JSON.stringify({url,mode,quality}),
      cache: "no-store"
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Unduhan gagal. Coba lagi atau pilih kualitas lebih rendah.");
    }
    const total = Number(response.headers.get("content-length") || 0);
    const reader = response.body && response.body.getReader ? response.body.getReader() : null;
    let blob;
    if (!reader) {
      blob = await response.blob();
    } else {
      const chunks = [];
      let loaded = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        chunks.push(part.value);
        loaded += part.value.byteLength;
        const pct = total ? Math.min(99, Math.round(loaded / total * 100)) : null;
        if (pct !== null) bar.style.width = pct + "%";
        progressText.textContent = pct === null
          ? "Mengunduh " + (loaded / 1048576).toFixed(1) + " MB…"
          : "Mengunduh… " + pct + "% · " + (loaded / 1048576).toFixed(1) + " MB";
      }
      blob = new Blob(chunks, {type:response.headers.get("content-type") || (mode === "audio" ? "audio/mpeg" : "video/mp4")});
    }
    if (!blob.size) throw new Error("File hasil kosong. Coba ulangi proses.");
    const mime = blob.type || "";
    const ext = mode === "audio" ? (mime.includes("mp4") ? "m4a" : "mp3") : (mime.includes("webm") ? "webm" : "mp4");
    const filename = "aryanzz-" + (mode === "audio" ? "audio" : "video-" + quality + "p") + "." + ext;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 90000);
    bar.style.width = "100%";
    progressText.textContent = "Selesai · " + (blob.size / 1048576).toFixed(1) + " MB";
    remember(url, filename, mode, quality);
    return filename;
  }
  function showError(out, error, url) {
    out.hidden = false;
    out.replaceChildren();
    const title = make("b", "", "Link belum dapat diproses");
    const note = make("p", "warning", error.message || "Terjadi kesalahan saat memeriksa tautan.");
    out.append(title, note);
    if (/backend ekstraksi|server downloader|PLATFORM_API|belum dihubungkan|tidak dapat dijangkau/i.test(error.message || "")) {
      const help = make("p", "muted", "Untuk link platform, hubungkan server yt-dlp + FFmpeg ke Cloudflare Worker. File media langsung tetap dapat diproses tanpa server ekstraksi.");
      out.append(help);
    }
    if (url) {
      const link = make("a", "tag", "Buka sumber ↗");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.display = "inline-block";
      out.append(link);
    }
  }
  async function checkLink(url, button) {
    const out = $("downloadResult");
    out.hidden = false;
    out.replaceChildren();
    const box = make("section", "youtube-result");
    const heading = make("b", "", "Memeriksa " + platformName(url) + "…");
    const intro = make("p", "muted", "Mengambil informasi media dari backend ARYANZZ.");
    box.append(heading, intro);
    out.append(box);
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Memeriksa…";
    try {
      const info = await postJson("/api/info", {url:url.href});
      box.replaceChildren();
      const header = make("div", "youtube-heading");
      if (info.thumbnail) {
        try {
          const imageUrl = new URL(info.thumbnail);
          if (imageUrl.protocol === "https:" || imageUrl.protocol === "http:") {
            const img = make("img", "youtube-thumbnail");
            img.src = imageUrl.href;
            img.alt = "Thumbnail media";
            img.loading = "lazy";
            header.append(img);
          }
        } catch {}
      }
      const details = make("div", "youtube-details");
      details.append(make("b", "youtube-title", info.title || info.filename || "Media siap diunduh"));
      details.append(make("small", "muted", [info.extractor || info.source || platformName(url), duration(info.duration), info.size ? (info.size / 1048576).toFixed(1) + " MB" : ""].filter(Boolean).join(" · ")));
      header.append(details);
      box.append(header);

      const formatLabel = make("label", "label", "PILIH FORMAT");
      const mode = make("select", "field");
      mode.id = "aryMode";
      [["video","Video"],["audio","Audio MP3"]].forEach(([value,label]) => {
        const option = make("option", "", label);
        option.value = value;
        mode.append(option);
      });
      if (info.type === "audio") mode.value = "audio";
      const qualityLabel = make("label", "label", "KUALITAS VIDEO");
      qualityLabel.style.marginTop = "12px";
      const quality = make("select", "field");
      quality.id = "aryQuality";
      const heights = Array.isArray(info.formats)
        ? [...new Set(info.formats.map(item => Number(typeof item === "number" ? item : item.height)).filter(n => [360,480,720,1080,1440,2160].includes(n)))].sort((a,b) => a-b)
        : [];
      const available = heights.length ? heights : [360,480,720,1080,1440,2160];
      FORMATS.video.filter(item => available.includes(Number(item[0]))).forEach(([value,label]) => {
        const option = make("option", "", label);
        option.value = String(value);
        if (Number(value) === 720) option.selected = true;
        quality.append(option);
      });
      const audioHint = make("p", "muted", "Audio akan diekspor sebagai MP3. Kualitas video hanya berlaku untuk mode video.");
      const note = make("p", "youtube-note", "Unduh hanya media milik sendiri atau konten yang memang diizinkan. Ketersediaan format mengikuti sumber dan dukungan yt-dlp.");
      box.append(formatLabel, mode, qualityLabel, quality, audioHint, note);

      const progress = make("div", "progress-track");
      const bar = make("div", "progress-fill");
      bar.style.width = "0%";
      progress.append(bar);
      const progressText = make("p", "muted", "Siap. Pilih format dan kualitas, lalu mulai unduh.");
      const actions = make("div", "feature-row");
      const start = make("button", "primary youtube-start", "Mulai download");
      start.type = "button";
      const fav = make("button", "tag youtube-favorite", "♡ Favorit");
      fav.type = "button";
      fav.addEventListener("click", () => favorite(url.href, info.title || url.href, fav));
      actions.append(start, fav);
      box.append(progress, progressText, actions);
      mode.addEventListener("change", () => {
        quality.disabled = mode.value === "audio";
        qualityLabel.style.opacity = mode.value === "audio" ? ".45" : "1";
      });
      start.addEventListener("click", async () => {
        start.disabled = true;
        mode.disabled = true;
        quality.disabled = true;
        start.textContent = "Memproses…";
        try {
          const filename = await downloadFile(url.href, mode.value, Number(quality.value) || 720, bar, progressText);
          progressText.textContent = "Berhasil disimpan: " + filename;
          start.textContent = "Unduhan selesai ✓";
        } catch (error) {
          status(progressText, error.message || "Unduhan gagal.", true);
          start.disabled = false;
          mode.disabled = false;
          quality.disabled = mode.value === "audio";
          start.textContent = "Coba lagi";
        }
      });
    } catch (error) {
      showError(out, error, url.href);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
  function init() {
    const button = $("analyze");
    const input = $("url");
    if (!button || !input) return;
    button.addEventListener("click", event => {
      const raw = input.value.trim();
      const url = safeUrl(raw);
      if (!url) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const out = $("downloadResult");
        out.hidden = false;
        out.replaceChildren(make("b", "", "URL tidak valid"), make("p", "warning", "Masukkan tautan HTTP atau HTTPS yang benar."));
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      checkLink(url, button);
    }, true);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        button.click();
      }
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();