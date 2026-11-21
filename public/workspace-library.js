(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const HISTORY_KEYS = ["aryanzz.history.v2", "aryanzz-download-history-v1"];
  const FAVORITE_KEYS = ["aryanzz.favorites.v2", "aryanzz.favorites.v1", "aryanzz-library-favorites-v1"];
  const HISTORY_LIMIT = 50;
  const FAVORITE_LIMIT = 80;

  function readList(keys, limit) {
    const items = [];
    const seen = new Set();
    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(value)) continue;
        for (const raw of value) {
          if (!raw || typeof raw !== "object") continue;
          const item = { ...raw };
          const url = String(item.url || item.link || item.mediaUrl || "").trim();
          const identity = url || String(item.id || item.name || JSON.stringify(item));
          if (!identity || seen.has(identity)) continue;
          seen.add(identity);
          if (url) item.url = url;
          items.push(item);
        }
      } catch {}
    }
    items.sort((a, b) => Number(b.savedAt || b.at || 0) - Number(a.savedAt || a.at || 0));
    return items.slice(0, limit);
  }

  function writeKeys(keys, items) {
    let saved = true;
    for (const key of keys) {
      try { localStorage.setItem(key, JSON.stringify(items)); }
      catch { saved = false; }
    }
    return saved;
  }

  function notifyLibraryChanged() {
    window.dispatchEvent(new Event("aryanzz:history-updated"));
    window.dispatchEvent(new Event("aryanzz:library-updated"));
  }

  function readHistory() { return readList(HISTORY_KEYS, HISTORY_LIMIT); }
  function readFavorites() { return readList(FAVORITE_KEYS, FAVORITE_LIMIT); }

  function saveHistory(item) {
    if (!item || typeof item !== "object") return false;
    const url = String(item.url || item.link || item.mediaUrl || "").trim();
    if (!url) return false;
    const next = [{ ...item, url, at: Number(item.at || Date.now()) }, ...readHistory().filter(entry => entry.url !== url)].slice(0, HISTORY_LIMIT);
    const saved = writeKeys(HISTORY_KEYS, next);
    renderHistory();
    renderLibrary();
    notifyLibraryChanged();
    return saved;
  }

  function safeLink(value) {
    try {
      const url = new URL(String(value || ""), location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch { return ""; }
  }

  function renderHistory() {
    const box = $("historyBox");
    if (!box) return;
    const history = readHistory();
    box.replaceChildren();
    if (!history.length) { box.hidden = true; return; }
    box.hidden = false;
    const heading = document.createElement("b");
    heading.textContent = "Riwayat unduhan di perangkat ini";
    const list = document.createElement("div");
    list.id = "historyItems";
    history.slice(0, 12).forEach(item => {
      const row = document.createElement("div");
      row.style.cssText = "padding:8px 0;border-bottom:1px solid #263852;overflow-wrap:anywhere";
      const link = document.createElement("a");
      const href = safeLink(item.url);
      link.href = href || "#";
      link.textContent = item.name || item.title || item.url || "Media";
      link.style.color = "#8ec5ff";
      if (href) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
      const small = document.createElement("div");
      small.className = "muted";
      small.textContent = item.at ? new Date(item.at).toLocaleString("id-ID") : "Disimpan di perangkat ini";
      row.append(link, small);
      list.append(row);
    });
    const clear = document.createElement("button");
    clear.id = "clearHistory";
    clear.type = "button";
    clear.className = "tag";
    clear.style.marginTop = "9px";
    clear.textContent = "Hapus riwayat";
    clear.addEventListener("click", () => {
      if (!confirm("Hapus semua riwayat pada perangkat ini?")) return;
      HISTORY_KEYS.forEach(key => { try { localStorage.removeItem(key); } catch {} });
      renderHistory();
      renderLibrary();
      notifyLibraryChanged();
    });
    box.append(heading, list, clear);
  }

  function writeFavorites(items) {
    const normalized = items.slice(0, FAVORITE_LIMIT);
    const saved = writeKeys(FAVORITE_KEYS, normalized);
    renderLibrary();
    notifyLibraryChanged();
    return saved;
  }

  function renderLibrary() {
    const history = readHistory(), favorites = readFavorites();
    const historyCount = $("aryLibraryHistoryCount"), favoriteCount = $("aryLibraryFavoriteCount");
    const historyBadge = $("aryLibraryHistoryBadge"), favoriteBadge = $("aryLibraryFavoriteBadge");
    if (historyCount) historyCount.textContent = history.length;
    if (favoriteCount) favoriteCount.textContent = favorites.length;
    if (historyBadge) historyBadge.textContent = history.length;
    if (favoriteBadge) favoriteBadge.textContent = favorites.length;

    const query = String($("aryLibrarySearch")?.value || "").trim().toLocaleLowerCase("id-ID");
    const draw = (id, items, kind) => {
      const box = $(id);
      if (!box) return;
      box.replaceChildren();
      const visible = items.filter(item => !query || [item.name, item.title, item.url, item.platform, item.uploader].some(value => String(value || "").toLocaleLowerCase("id-ID").includes(query)));
      if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "ary-library-empty-state";
        const icon = document.createElement("span");
        icon.className = "ary-library-empty-icon";
        icon.textContent = items.length ? "⌕" : kind === "history" ? "◷" : "♡";
        const title = document.createElement("b");
        title.textContent = items.length ? "Tidak ada hasil yang cocok" : kind === "history" ? "Belum ada riwayat" : "Belum ada favorit";
        const note = document.createElement("small");
        note.textContent = items.length ? "Coba kata kunci lain atau hapus pencarian." : kind === "history" ? "Aktivitas media yang kamu periksa atau unduh akan muncul di sini." : "Tekan ikon bintang pada riwayat untuk menyimpan item favorit.";
        empty.append(icon, title, note);
        box.append(empty);
        return;
      }
      visible.forEach(item => {
        const row = document.createElement("div");
        row.className = "ary-library-item";
        const icon = document.createElement("span");
        icon.className = "ary-library-item-icon";
        const mediaType = String(item.type || item.mediaType || item.ext || item.name || "").toLowerCase();
        icon.textContent = /audio|mp3|m4a|wav|flac|spotify|soundcloud/.test(mediaType) ? "♫" : /image|jpg|jpeg|png|webp/.test(mediaType) ? "▧" : "▶";
        const main = document.createElement("div");
        main.className = "ary-library-item-main";
        const link = document.createElement("a");
        const href = safeLink(item.url);
        link.href = href || "#";
        link.textContent = item.name || item.title || item.url || "Media";
        link.title = item.name || item.title || item.url || "";
        if (href) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
        const meta = document.createElement("small");
        const details = [item.platform || "", item.uploader || item.author || "", item.at ? new Date(item.at).toLocaleString("id-ID") : "Disimpan di perangkat ini"].filter(Boolean);
        meta.textContent = details.join(" · ");
        main.append(link, meta);
        const action = document.createElement("button");
        action.type = "button";
        action.className = "ary-library-item-action";
        action.textContent = kind === "history" ? (favorites.some(saved => saved.url === item.url) ? "★" : "☆") : "×";
        action.setAttribute("aria-label", kind === "history" ? "Simpan ke favorit" : "Hapus dari favorit");
        action.addEventListener("click", () => {
          if (kind === "history") {
            const current = readFavorites();
            const exists = current.some(saved => saved.url === item.url);
            writeFavorites(exists ? current.filter(saved => saved.url !== item.url) : [{ ...item, savedAt: Date.now() }, ...current]);
          } else {
            writeFavorites(readFavorites().filter(saved => saved.url !== item.url));
          }
        });
        row.append(icon, main, action);
        box.append(row);
      });
    };
    draw("historyList", history, "history");
    draw("favoriteList", favorites, "favorite");
  }

  function setLibraryTab(tab) {
    const historyActive = tab === "history";
    const historyTab = $("aryLibraryHistoryTab"), favoriteTab = $("aryLibraryFavoriteTab");
    const historyView = $("aryLibraryHistoryView"), favoriteView = $("aryLibraryFavoriteView");
    historyTab?.classList.toggle("active", historyActive);
    favoriteTab?.classList.toggle("active", !historyActive);
    historyTab?.setAttribute("aria-selected", String(historyActive));
    favoriteTab?.setAttribute("aria-selected", String(!historyActive));
    historyView?.classList.toggle("active", historyActive);
    favoriteView?.classList.toggle("active", !historyActive);
    if (historyView) historyView.hidden = !historyActive;
    if (favoriteView) favoriteView.hidden = historyActive;
  }

  $("aryLibraryHistoryTab")?.addEventListener("click", () => setLibraryTab("history"));
  $("aryLibraryFavoriteTab")?.addEventListener("click", () => setLibraryTab("favorite"));
  $("aryLibrarySearch")?.addEventListener("input", renderLibrary);
  $("clearHistoryV2")?.addEventListener("click", () => {
    if (!confirm("Hapus semua riwayat pada perangkat ini?")) return;
    HISTORY_KEYS.forEach(key => { try { localStorage.removeItem(key); } catch {} });
    renderHistory();
    renderLibrary();
    notifyLibraryChanged();
  });
  $("clearFavoritesV2")?.addEventListener("click", () => {
    if (!confirm("Hapus semua favorit pada perangkat ini?")) return;
    ["aryanzz.favorites.v2", "aryanzz.favorites.v1", "aryanzz-library-favorites-v1"].forEach(key => { try { localStorage.removeItem(key); } catch {} });
    renderLibrary();
    notifyLibraryChanged();
  });

  window.addEventListener("storage", event => {
    if (!event.key || [...HISTORY_KEYS, ...FAVORITE_KEYS].includes(event.key)) {
      renderHistory();
      renderLibrary();
    }
  });

  window.ARYANZZLibrary = Object.freeze({ saveHistory, renderHistory, renderLibrary, readHistory, readFavorites });
  renderHistory();
  renderLibrary();
})();