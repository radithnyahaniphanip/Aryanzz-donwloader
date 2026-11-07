/* ARYANZZ V92.3 — owner profile reads the same profile store as Profile Studio */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const KEY = "aryanzz.owner.links.v28";
  const PROFILE_KEY = "aryanzz.profile.info.v25";
  const DESIGN_KEY = "aryanzz.profile.design.v25";
  const DEFAULTS = {
    whatsapp: "https://wa.me/6282110767071",
    github: "https://github.com/radithnyahaniphanip",
    telegram: "",
    tiktok: "https://www.tiktok.com/@azazeuu?_r=1&_t=ZS-9B2FU0QemSi"
  };
  const safeRead = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch { return fallback; }
  };
  function validLink(raw) {
    if (!raw) return "";
    try {
      const u = new URL(String(raw));
      return ["http:", "https:"].includes(u.protocol) ? u.href : "";
    } catch { return ""; }
  }
  function validImage(raw) {
    return typeof raw === "string" && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(raw) ? raw : "";
  }
  function linksRead() {
    const stored = safeRead(KEY, {});
    return Object.fromEntries(Object.keys(DEFAULTS).map(key => [
      key, Object.prototype.hasOwnProperty.call(stored,key) ? validLink(stored[key]) : DEFAULTS[key]
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
        if (action) action.textContent = ({whatsapp:"Chat WhatsApp",github:"Kunjungi GitHub",telegram:"Buka Telegram",tiktok:"Follow di TikTok"})[key] || "Buka tautan";
      } else {
        card.removeAttribute("href");
        card.removeAttribute("target");
        card.classList.add("is-unset");
        card.setAttribute("aria-disabled", "true");
        if (action) action.textContent = "Tautan belum diatur";
      }
    });
  }
  function renderOwnerProfile() {
    const profile = safeRead(PROFILE_KEY, safeRead("aryanzz.profile.v2", {}));
    const design = safeRead(DESIGN_KEY, {});
    const name = String(profile.name || "").trim() || "ARYANZZ";
    const bio = String(profile.bio || "").trim() || "Merancang, membangun, dan mengembangkan ekosistem digital ARYANZZ.";
    const nameNode = $("ownerName"), bioNode = $("ownerBio"), avatar = $("ownerAvatar"), cover = $("ownerCover");
    const developerBadge = $("ownerDeveloperBadge");
    if (developerBadge) {
      developerBadge.textContent = "♛ DEVELOPER WEBSITE";
      developerBadge.setAttribute("aria-label", "Developer Website · Pemilik ARYANZZ");
    }
    if (nameNode) nameNode.textContent = name;
    if (bioNode) bioNode.textContent = bio;
    const avatarData = validImage(design.avatar) || validImage(profile.photo);
    const bannerData = validImage(design.banner);
    if (avatar) {
      avatar.textContent = avatarData ? "" : (name.charAt(0) || "A").toUpperCase();
      avatar.style.backgroundImage = avatarData ? 'url("' + avatarData + '")' : "none";
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
    }
    if (cover) {
      cover.style.backgroundImage = bannerData ? 'linear-gradient(120deg,rgba(7,13,25,.45),rgba(7,13,25,.58)),url("' + bannerData + '")' : "none";
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
      alert("Tautan sosial berhasil diperbarui.");
    } catch {
      alert("Penyimpanan browser penuh atau tidak tersedia. Kosongkan ruang lalu coba lagi.");
    }
  }
  async function initSecurityCenter() {
    const root = $("securityCenter");
    if (!root) return;
    const state = $("securityCenterState");
    const refresh = $("securityCenterRefresh");
    const draw = async () => {
      if (refresh) refresh.disabled = true;
      try {
        const response = await fetch("/api/security/status", { cache: "no-store", headers: { accept: "application/json" } });
        const data = await response.json();
        if (!response.ok || data?.security?.active !== true) throw new Error("Status belum dapat diverifikasi");
        const events = data.security.events || {};
        const set = (id, value) => { const node = $(id); if (node) node.textContent = String(Number(value) || 0); };
        set("securityBlockedOrigin", events.blockedOrigin);
        set("securityRateLimited", events.rateLimited);
        set("securityOversized", events.oversizedRequest);
        set("securityMethods", events.blockedMethod);
        if (state) { state.textContent = "● Perlindungan Worker aktif"; state.classList.add("is-active"); state.classList.remove("is-warning"); }
      } catch {
        if (state) { state.textContent = "Status keamanan belum dapat diverifikasi"; state.classList.add("is-warning"); state.classList.remove("is-active"); }
      } finally {
        if (refresh) refresh.disabled = false;
      }
    };
    refresh?.addEventListener("click", draw);
    const banStatus=$("ownerBanStatus"),banId=$("ownerBanAccountId"),banReason=$("ownerBanReason");
    async function moderate(action){
      const userId=String(banId?.value||"").trim().toUpperCase();
      if(!/^ARY-[A-Z0-9]{10}$/.test(userId)){if(banStatus)banStatus.textContent="Masukkan ID akun yang valid.";return;}
      const reason=String(banReason?.value||"").trim();
      if(action==="ban"&&reason.length<8){if(banStatus)banStatus.textContent="Alasan minimal 8 karakter.";return;}
      const button=$(action==="ban"?"ownerBanSubmit":"ownerUnbanSubmit");
      if(button)button.disabled=true;
      if(banStatus){banStatus.textContent="Memproses permintaan...";banStatus.dataset.error="";}
      try{
        const response=await fetch("/api/auth/admin/"+action,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({userId,reason})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok||!result.ok)throw new Error(result.error||"Permintaan moderasi ditolak.");
        if(banStatus)banStatus.textContent=result.message||"Berhasil.";
        if(action==="ban"&&banReason)banReason.value="";
      }catch(error){if(banStatus){banStatus.textContent=error.message;banStatus.dataset.error="1";}}
      finally{if(button)button.disabled=false;}
    }
    $("ownerBanSubmit")?.addEventListener("click",()=>moderate("ban"));
    $("ownerUnbanSubmit")?.addEventListener("click",()=>moderate("unban"));
    draw();
  }
  function init() {
    if (!$("owner")) return;
    renderOwnerProfile();
    renderLinks();
    initSecurityCenter();
    $("ownerLinksSave")?.addEventListener("click", saveLinks);
    $("ownerEditProfile")?.addEventListener("click", () => window.aryanzzShowPanel?.("profile"));
    window.addEventListener("storage", event => {
      if (!event.key || [PROFILE_KEY, DESIGN_KEY, "aryanzz.profile.v2", "aryanzz.history.v2", "aryanzz-download-history-v1"].includes(event.key)) renderOwnerProfile();
      if (!event.key || event.key === KEY) renderLinks();
    });
    window.addEventListener("aryanzz:profile-assets-updated", renderOwnerProfile);
    window.addEventListener("aryanzz:history-updated", renderOwnerProfile);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
