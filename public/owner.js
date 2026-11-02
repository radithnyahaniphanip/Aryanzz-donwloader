/* ARYANZZ V28 owner profile and social cards */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const KEY = "aryanzz.owner.links.v28";
  const DEFAULTS = {
    whatsapp: "https://wa.me/6282110767071",
    github: "https://github.com/radithnyahaniphanip",
    telegram: "",
    tiktok: "https://www.tiktok.com/@azazeuu?_r=1&_t=ZS-9B2FU0QemSi"
  };
  const safeRead = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
    catch { return fallback; }
  };
  function validLink(raw) {
    if (!raw) return "";
    try {
      const u = new URL(raw);
      return ["http:", "https:"].includes(u.protocol) ? u.href : "";
    } catch { return ""; }
  }
  function linksRead() {
    const stored = safeRead(KEY, {});
    return Object.fromEntries(Object.keys(DEFAULTS).map(key => [
      key, validLink(stored[key]) || DEFAULTS[key]
    ]));
  }
  function renderLinks() {
    const links = linksRead();
    const fields = {
      whatsapp: "ownerWhatsappUrl",
      github: "ownerGithubUrl",
      telegram: "ownerTelegramUrl",
      tiktok: "ownerTiktokUrl"
    };
    Object.entries(fields).forEach(([key, id]) => {
      const input = $(id);
      if (input && document.activeElement !== input) input.value = links[key] || "";
    });
    document.querySelectorAll("[data-owner-link]").forEach(card => {
      const key = card.dataset.ownerLink;
      const href = validLink(links[key]);
      const action = card.querySelector(".owner-social-action");
      if (href) {
        card.href = href;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.classList.remove("is-unset");
        card.setAttribute("aria-disabled", "false");
        if (action) action.firstChild.textContent = ({whatsapp:"Chat WhatsApp ",github:"Kunjungi GitHub ",telegram:"Buka Telegram ",tiktok:"Follow di TikTok "})[key] || "Buka tautan ";
      } else {
        card.removeAttribute("href");
        card.removeAttribute("target");
        card.classList.add("is-unset");
        card.setAttribute("aria-disabled", "true");
        if (action) action.firstChild.textContent = "Tautan belum diatur ";
      }
    });
  }
  function renderOwnerProfile() {
    const profile = safeRead("aryanzz.profile.v2", {});
    const design = safeRead("aryanzz.profile.design.v25", {});
    const name = String(profile.name || "").trim() || "ARYANZZ";
    const bio = String(profile.bio || "").trim() || "Pengelola dan pengembang ARYANZZ.";
    const nameNode = $("ownerName"), bioNode = $("ownerBio"), avatar = $("ownerAvatar"), cover = $("ownerCover");
    if (nameNode) nameNode.textContent = name;
    if (bioNode) bioNode.textContent = bio;
    if (avatar) {
      avatar.textContent = (name.charAt(0) || "A").toUpperCase();
      avatar.style.backgroundImage = profile.photo ? 'url("' + profile.photo + '")' : "none";
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
    }
    if (cover) {
      cover.style.backgroundImage = design.banner ? 'linear-gradient(120deg,rgba(7,13,25,.45),rgba(7,13,25,.58)),url("' + design.banner + '")' : "none";
      cover.style.backgroundSize = "cover";
      cover.style.backgroundPosition = "center";
    }
    const history = safeRead("aryanzz.history.v2", safeRead("aryanzz-download-history-v1", []));
    if ($("ownerHistoryCount")) $("ownerHistoryCount").textContent = Array.isArray(history) ? history.length : 0;
    if ($("ownerToolsCount")) $("ownerToolsCount").textContent = document.querySelectorAll("#allTools .tool").length;
    if ($("ownerYear")) $("ownerYear").textContent = new Date().getFullYear();
  }
  function saveLinks() {
    const values = {
      whatsapp: $("ownerWhatsappUrl")?.value.trim() || "",
      github: $("ownerGithubUrl")?.value.trim() || "",
      telegram: $("ownerTelegramUrl")?.value.trim() || "",
      tiktok: $("ownerTiktokUrl")?.value.trim() || ""
    };
    for (const [key, value] of Object.entries(values)) {
      if (value && !validLink(value)) {
        const input = ({whatsapp:"ownerWhatsappUrl",github:"ownerGithubUrl",telegram:"ownerTelegramUrl",tiktok:"ownerTiktokUrl"})[key];
        $(input)?.focus();
        alert("Tautan " + key + " harus berupa URL lengkap yang diawali https:// atau http://.");
        return;
      }
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
      renderLinks();
      alert("Tautan sosial tersimpan di browser ini.");
    } catch {
      alert("Penyimpanan browser penuh. Hapus data lama lalu coba lagi.");
    }
  }
  function init() {
    if (!$("owner")) return;
    renderOwnerProfile();
    renderLinks();
    $("ownerLinksSave")?.addEventListener("click", saveLinks);
    $("ownerEditProfile")?.addEventListener("click", () => window.aryanzzShowPanel?.("profile"));
    window.addEventListener("storage", () => { renderOwnerProfile(); renderLinks(); });
    window.addEventListener("aryanzz:profile-assets-updated", renderOwnerProfile);
    window.addEventListener("aryanzz:profile-assets-updated", renderOwnerProfile);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
