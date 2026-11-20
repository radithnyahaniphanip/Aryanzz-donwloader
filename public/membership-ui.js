(() => {
  "use strict";
  const root = document.getElementById("membership");
  if (!root) return;

  const byId = id => document.getElementById(id);
  const state = {
    catalog: null,
    membership: { tier: "free", planName: "Free", status: "free" },
    orders: [],
    period: "monthly",
    selectedPlan: null,
    activeOrderId: "",
    pollTimer: null,
    countdownTimer: null,
    cart: null,
    checkoutEnabled: false,
    identityReady: false
  };

  const rank = { free: 0, starter: 1, pro: 2, ultra: 3, max: 4 };
  const money = value => new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
  }).format(Number(value || 0));

  async function api(path, options) {
    const opts = options || {};
    const headers = new Headers(opts.headers || {});
    if (opts.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, {
      ...opts,
      headers,
      credentials: "same-origin",
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  function setMessage(message, kind) {
    const target = byId("membershipStatus");
    if (!target) return;
    target.textContent = String(message || "");
    target.dataset.kind = kind || "info";
  }

  function formatDate(value) {
    if (!value) return "Belum aktif";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium", timeStyle: "short"
    }).format(date);
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function canAccessTier(requiredTier) {
    const current = state.membership && state.membership.status === "active"
      ? String(state.membership.tier || "free").toLowerCase()
      : "free";
    return (rank[current] || 0) >= (rank[String(requiredTier || "free").toLowerCase()] || 0);
  }

  function renderFeatureLocks() {
    document.querySelectorAll("[data-membership-min]").forEach(element => {
      const required = String(element.dataset.membershipMin || "free").toLowerCase();
      const locked = !canAccessTier(required);
      element.dataset.membershipLocked = locked ? "true" : "false";
      if (element.classList.contains("tool")) {
        let tag = element.querySelector(".ary-membership-lock-tag");
        if (locked && !tag) {
          tag = make("span", "ary-membership-lock-tag", "🔒 " + required.toUpperCase());
          element.append(tag);
        } else if (!locked && tag) tag.remove();
      }
    });
  }

  function renderAccount() {
    const membership = state.membership || { tier: "free", planName: "Free", status: "free" };
    const active = membership.status === "active";
    const tier = active ? String(membership.tier || "free").toUpperCase() : "FREE";
    byId("membershipCurrentBadge").textContent = tier;
    byId("membershipAccountTitle").textContent = active
      ? "Membership " + (membership.planName || tier) + " aktif"
      : "Kamu menggunakan ARYANZZ Free";
    byId("membershipAccountExpiry").textContent = active
      ? "Aktif sampai " + formatDate(membership.expiresAt)
      : "Pilih paket untuk membuka fasilitas member.";
    renderFeatureLocks();
  }

  function renderPlans() {
    const grid = byId("membershipPlans");
    grid.replaceChildren();
    const plans = state.catalog && Array.isArray(state.catalog.plans) ? state.catalog.plans : [];
    plans.forEach(plan => {
      const price = state.period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
      const card = make("article", "ary-membership-plan" + (plan.id === "pro" ? " is-popular" : ""));
      const top = make("div", "ary-membership-plan-top");
      top.append(make("h3", "", plan.name));
      top.append(make("span", "ary-membership-plan-label", plan.badge || plan.name.toUpperCase()));
      card.append(top);
      card.append(make("div", "ary-membership-plan-price", money(price)));
      card.append(make("div", "ary-membership-plan-period", state.period === "yearly" ? "per tahun" : "per bulan"));
      card.append(make("p", "ary-membership-plan-summary", plan.summary || ""));
      const list = make("ul", "");
      (plan.features || []).forEach(feature => list.append(make("li", "", feature)));
      card.append(list);
      const inCart = state.cart && state.cart.planId === plan.id && state.cart.period === state.period;
      const button = make("button", "ary-membership-select", inCart ? "✓ Di keranjang" : "＋ Tambah ke keranjang");
      button.type = "button";
      button.disabled = false;
      button.addEventListener("click", () => addToCart(plan));
      card.append(button);
      grid.append(card);
    });
  }

  function persistCart() {
    try {
      if (state.cart) sessionStorage.setItem("aryanzz_membership_cart_v1", JSON.stringify(state.cart));
      else sessionStorage.removeItem("aryanzz_membership_cart_v1");
    } catch {}
  }

  function restoreCart() {
    try {
      const saved = JSON.parse(sessionStorage.getItem("aryanzz_membership_cart_v1") || "null");
      const plan = state.catalog?.plans?.find(item => item.id === saved?.planId);
      if (plan && ["monthly", "yearly"].includes(saved.period)) state.cart = { planId: plan.id, period: saved.period };
    } catch {}
    renderCart();
  }

  function clearCart() {
    state.cart = null;
    persistCart();
    renderCart();
    renderPlans();
  }

  function renderCart() {
    const cart = byId("membershipCart");
    if (!cart) return;
    const count = state.cart ? 1 : 0;
    byId("membershipCartCount").textContent = String(count);
    const button = byId("membershipCartToggle");
    if (button) button.setAttribute("aria-expanded", String(!cart.hidden));
    const items = byId("membershipCartItems");
    items.replaceChildren();
    const plan = state.cart && state.catalog?.plans?.find(item => item.id === state.cart.planId);
    if (!plan) {
      items.append(make("p", "ary-membership-cart-empty", "Keranjang masih kosong. Tambahkan satu paket dari daftar Membership."));
      byId("membershipCartTotal").textContent = money(0);
      byId("membershipCartCheckout").disabled = true;
      return;
    }
    const price = state.cart.period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    const row = make("div", "ary-membership-cart-item");
    const copy = make("div", "ary-membership-cart-item-copy");
    copy.append(make("strong", "", plan.name + " · " + (state.cart.period === "yearly" ? "Tahunan" : "Bulanan")));
    copy.append(make("small", "", state.cart.period === "yearly" ? "Masa aktif 365 hari" : "Masa aktif 30 hari"));
    row.append(copy, make("b", "ary-membership-cart-item-price", money(price)));
    const remove = make("button", "ary-membership-cart-remove", "Hapus");
    remove.type = "button";
    remove.addEventListener("click", clearCart);
    row.append(remove);
    items.append(row);
    byId("membershipCartTotal").textContent = money(price);
    byId("membershipCartCheckout").disabled = !state.checkoutEnabled;
  }

  function addToCart(plan) {
    const replaced = !!state.cart && state.cart.planId !== plan.id;
    state.cart = { planId: plan.id, period: state.period };
    persistCart();
    renderCart();
    renderPlans();
    byId("membershipCart").hidden = false;
    byId("membershipCartToggle").setAttribute("aria-expanded", "true");
    setMessage(replaced
      ? "Keranjang diperbarui. Satu pesanan Membership hanya berisi satu paket."
      : "Paket " + plan.name + " ditambahkan ke keranjang.", "success");
    byId("membershipCart").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function openCheckout() {
    const plan = state.cart && state.catalog?.plans?.find(item => item.id === state.cart.planId);
    if (!plan) {
      setMessage("Tambahkan paket Membership ke keranjang terlebih dahulu.", "warning");
      return;
    }
    if (!state.checkoutEnabled) {
      setMessage("Checkout belum siap. Pastikan akun tersinkron dan API Key AirPay sudah dipasang pada server.", "warning");
      return;
    }
    state.selectedPlan = plan;
    state.period = state.cart.period;
    byId("membershipMonthly").classList.toggle("active", state.period === "monthly");
    byId("membershipYearly").classList.toggle("active", state.period === "yearly");
    const price = state.period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    byId("membershipCheckoutTitle").textContent = "Checkout " + plan.name;
    byId("membershipCheckoutSummary").textContent =
      money(price) + (state.period === "yearly" ? " untuk 1 tahun." : " untuk 1 bulan.");
    byId("membershipCart").hidden = true;
    byId("membershipCartToggle").setAttribute("aria-expanded", "false");
    byId("membershipCheckout").hidden = false;
    byId("membershipPayment").hidden = true;
    setMessage("Paket siap dibayar melalui QRIS. Tidak perlu memasukkan nomor rekening atau nomor HP.", "info");
    byId("membershipCheckout").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function safeProviderLink(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function stopCountdown() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }

  function startCheckoutCountdown(order) {
    stopCountdown();
    const deadline = Number(order.checkoutExpiresAt || (Number(order.createdAt || Date.now()) + 10 * 60 * 1000));
    const display = byId("membershipPaymentCountdown");
    const caption = document.querySelector(".ary-membership-countdown-caption");
    const update = () => {
      const remaining = Math.max(0, deadline - Date.now());
      const minutes = String(Math.floor(remaining / 60000)).padStart(2, "0");
      const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
      display.textContent = minutes + ":" + seconds;
      if (remaining <= 0) {
        stopCountdown();
        const qr = byId("membershipQr");
        qr.removeAttribute("src");
        qr.hidden = true;
        if (caption) caption.textContent = "Waktu checkout berakhir · menunggu status final AirPay";
        byId("membershipPaymentExpiry").textContent = "Sesi checkout 10 menit telah berakhir. QR ditutup dan pesanan dikeluarkan dari keranjang.";
        clearCart();
        setMessage("Waktu checkout 10 menit habis. QR ditutup dan keranjang direset. Server tetap memeriksa status AirPay sampai hasil akhir; pembayaran yang benar-benar berhasil tetap akan mengaktifkan Membership.", "warning");
      }
    };
    update();
    if (deadline > Date.now()) state.countdownTimer = setInterval(update, 1000);
  }

  function showPayment(order, payment) {
    const data = payment || {};
    state.activeOrderId = order.id;
    byId("membershipPayment").hidden = false;
    byId("membershipCheckout").hidden = true;
    byId("membershipCart").hidden = true;
    byId("membershipCartToggle").setAttribute("aria-expanded", "false");
    byId("membershipPaymentTitle").textContent = "Selesaikan pembayaran " + (order.planName || "membership");
    byId("membershipPaymentAmount").textContent = money(data.totalAmount || order.totalAmount || order.amount);
    byId("membershipPaymentBase").textContent = "Harga paket " + money(order.amount) +
      (Number(data.feeAmount || order.feeAmount || 0) > 0 ? " · biaya " + money(data.feeAmount || order.feeAmount) : "");

    const checkoutDeadline = Number(order.checkoutExpiresAt || (Number(order.createdAt || Date.now()) + 10 * 60 * 1000));
    const checkoutExpired = Date.now() >= checkoutDeadline;
    byId("membershipPaymentExpiry").textContent = checkoutExpired
      ? "Sesi checkout berakhir. Menunggu konfirmasi final dari AirPay."
      : data.expiryAt || order.gatewayExpiresAt || order.expiresAt
        ? "Invoice gateway berlaku sampai " + formatDate(data.expiryAt || order.gatewayExpiresAt || order.expiresAt)
        : "Selesaikan checkout dalam 10 menit.";

    const qr = byId("membershipQr");
    const qrUrl = safeProviderLink(data.qrUrl || order.qrUrl);
    if (qrUrl && !checkoutExpired) {
      qr.src = qrUrl;
      qr.hidden = false;
    } else {
      qr.removeAttribute("src");
      qr.hidden = true;
    }

    const checkButton = byId("membershipCheckStatus");
    checkButton.disabled = false;
    startCheckoutCountdown(order);
    if (checkoutExpired) {
      const caption = document.querySelector(".ary-membership-countdown-caption");
      if (caption) caption.textContent = "Waktu checkout berakhir · menunggu status final AirPay";
      setMessage("Invoice ini melewati batas checkout 10 menit. QR disembunyikan; ARYANZZ tetap memeriksa status gateway agar pembayaran yang sudah masuk tidak hilang.", "warning");
    } else {
      setMessage("Menunggu pembayaran. ARYANZZ memeriksa status langsung ke server AirPay.", "pending");
    }
    byId("membershipPayment").scrollIntoView({ behavior: "smooth", block: "nearest" });
    startPolling(order.id);
  }

  async function submitCheckout(event) {
    event.preventDefault();
    if (!state.selectedPlan) return;
    const button = byId("membershipCreateInvoice");
    button.disabled = true;
    button.textContent = "Membuat invoice…";
    setMessage("Menghubungkan ke AirPay dan membuat QRIS.", "info");

    try {
      const result = await api("/api/membership/orders", {
        method: "POST",
        body: JSON.stringify({
          planId: state.selectedPlan.id,
          billingPeriod: state.period,
          customerName: byId("membershipCustomerName").value.trim(),
          customerEmail: byId("membershipCustomerEmail").value.trim()
        })
      });

      if (result.response.status === 409 && result.data.order) {
        clearCart();
        showPayment(result.data.order, result.data.payment || {});
        setMessage("Masih ada invoice sebelumnya. ARYANZZ menampilkan status pesanan yang sama agar tidak membuat tagihan ganda.", "pending");
        return;
      }
      if (!result.response.ok || !result.data.ok) {
        throw new Error(result.data.error || "Invoice belum berhasil dibuat.");
      }

      clearCart();
      showPayment(result.data.order, result.data.payment);
      await refreshMe();
    } catch (error) {
      setMessage(error.message || "Tidak dapat membuat invoice.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Buat invoice QRIS";
    }
  }

  function stopPolling() {
    if (state.pollTimer) clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }

  async function pollOnce() {
    if (!state.activeOrderId) return false;
    const result = await api("/api/membership/orders/status?orderId=" + encodeURIComponent(state.activeOrderId), {
      method: "GET"
    });
    if (!result.response.ok || !result.data.ok) {
      setMessage(result.data.error || "Status pembayaran belum dapat diperiksa. Coba lagi sebentar.", "error");
      return true;
    }

    const order = result.data.order;
    if (result.data.membership) state.membership = result.data.membership;
    if (order.status === "paid") {
      stopPolling();
      stopCountdown();
      clearCart();
      setMessage("Pembayaran berhasil diverifikasi. Membership " + (order.planName || "") + " sudah aktif!", "success");
      await refreshMe();
      byId("membershipPaymentExpiry").textContent = "Membership aktif sampai " + formatDate(state.membership.expiresAt);
      byId("membershipPaymentCountdown").textContent = "LUNAS";
      state.activeOrderId = "";
      return false;
    }
    if (order.status === "expired" || order.status === "failed" || order.status === "rejected") {
      stopPolling();
      stopCountdown();
      clearCart();
      byId("membershipQr").removeAttribute("src");
      byId("membershipQr").hidden = true;
      byId("membershipPaymentExpiry").textContent = "Invoice sudah " + order.status + ".";
      setMessage("Invoice " + order.status + ". Keranjang dikosongkan; pilih paket kembali untuk membuat invoice baru.", "error");
      await refreshMe();
      state.activeOrderId = "";
      return false;
    }
    const checkoutExpired = order.checkoutExpired === true ||
      Date.now() >= Number(order.checkoutExpiresAt || (Number(order.createdAt || Date.now()) + 10 * 60 * 1000));
    if (checkoutExpired) {
      setMessage("Batas checkout 10 menit berakhir. QR sudah ditutup dan keranjang direset. ARYANZZ masih memeriksa status AirPay agar pembayaran yang sudah masuk tetap tercatat.", "warning");
    } else {
      setMessage("Pembayaran belum terdeteksi. Jika sudah membayar, tunggu beberapa saat lalu periksa kembali.", "pending");
    }
    return true;
  }

  async function pollLoop() {
    if (!state.activeOrderId) return;
    let keepGoing = true;
    try {
      keepGoing = await pollOnce();
    } catch (error) {
      setMessage(error.message || "Gangguan saat memeriksa pembayaran.", "error");
    }
    if (keepGoing && state.activeOrderId) {
      state.pollTimer = setTimeout(pollLoop, 6000);
    }
  }

  function startPolling(orderId) {
    stopPolling();
    state.activeOrderId = orderId;
    pollLoop();
  }

  async function refreshMe() {
    const result = await api("/api/membership/me", { method: "GET" });
    if (!result.response.ok || !result.data.ok) {
      state.identityReady = false;
      return false;
    }
    state.identityReady = true;
    state.membership = result.data.membership || state.membership;
    state.orders = Array.isArray(result.data.orders) ? result.data.orders : [];
    renderAccount();
    renderOrders();
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
  }

  function downloadReceipt(order) {
    const paidAt = order.paidAt ? formatDate(order.paidAt) : "Belum dibayar";
    const html = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bukti Transaksi ARYANZZ</title>
    <style>body{font:15px/1.6 Arial,sans-serif;color:#172033;margin:0;padding:28px;background:#f3f6fa}.receipt{max-width:620px;margin:auto;padding:28px;background:#fff;border:1px solid #dce4ee;border-radius:18px}.brand{font-size:12px;letter-spacing:2px;font-weight:900;color:#2766b4}.title{font-size:25px;margin:8px 0 3px}.status{display:inline-block;margin:14px 0;padding:6px 11px;border-radius:30px;background:#e6f8ef;color:#13784c;font-weight:800}.line{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid #e7edf4}.line span{color:#66758b}.total{font-size:19px;font-weight:900}.foot{margin-top:22px;color:#78869a;font-size:11px}@media print{body{background:#fff;padding:0}.receipt{border:0;box-shadow:none}}</style>
    <main class="receipt"><div class="brand">ARYANZZ MEMBERSHIP</div><h1 class="title">Bukti Transaksi</h1><div>Dokumen pembayaran digital</div><div class="status">PEMBAYARAN BERHASIL</div>
    <div class="line"><span>ID Pesanan</span><b>${escapeHtml(order.id)}</b></div>
    <div class="line"><span>ID Transaksi AirPay</span><b>${escapeHtml(order.providerTransactionId || order.transactionId || "-")}</b></div>
    <div class="line"><span>Paket</span><b>${escapeHtml(order.planName || order.planId || "Membership")}</b></div>
    <div class="line"><span>Periode</span><b>${order.billingPeriod === "yearly" ? "Tahunan · 365 hari" : "Bulanan · 30 hari"}</b></div>
    <div class="line"><span>Harga paket</span><b>${escapeHtml(money(order.amount))}</b></div>
    <div class="line"><span>Biaya transaksi</span><b>${escapeHtml(money(order.feeAmount || 0))}</b></div>
    <div class="line total"><span>Total dibayar</span><b>${escapeHtml(money(order.totalAmount || order.amount))}</b></div>
    <div class="line"><span>Waktu pembayaran</span><b>${escapeHtml(paidAt)}</b></div>
    <div class="line"><span>Metode</span><b>QRIS · AirPay</b></div>
    <p class="foot">Bukti ini dibuat oleh ARYANZZ berdasarkan status pembayaran yang telah diverifikasi oleh server. Simpan dokumen ini sebagai arsip transaksi.</p><button onclick="window.print()">Cetak / Simpan PDF</button></main></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = make("a", "");
    link.href = url;
    link.download = "ARYANZZ-Bukti-" + String(order.id || "transaksi").replace(/[^A-Za-z0-9-]/g, "") + ".html";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function renderOrders() {
    const list = byId("membershipOrdersList");
    list.replaceChildren();
    if (!state.orders.length) {
      list.append(make("p", "ary-membership-order-empty", "Belum ada transaksi membership."));
      return;
    }
    state.orders.slice(0, 20).forEach(order => {
      const row = make("div", "ary-membership-order");
      const copy = make("div", "ary-membership-order-copy");
      copy.append(make("strong", "", (order.planName || order.planId || "Membership") + " · " +
        (order.billingPeriod === "yearly" ? "Tahunan" : "Bulanan")));
      copy.append(make("small", "", money(order.totalAmount || order.amount) + " · " + formatDate(order.createdAt)));
      if (order.transactionId) copy.append(make("small", "", "ID transaksi: " + order.transactionId));
      row.append(copy);
      row.append(make("span", "ary-membership-order-status status-" + String(order.status || "pending").toLowerCase(), order.status || "pending"));
      if (order.status === "paid") {
        const receipt = make("button", "ary-membership-receipt", "Bukti transaksi ↓");
        receipt.type = "button";
        receipt.addEventListener("click", () => downloadReceipt(order));
        row.append(receipt);
      } else if (order.status === "pending") {
        const resume = make("button", "ary-membership-receipt", "Periksa");
        resume.type = "button";
        resume.addEventListener("click", () => showPayment(order, {
          qrUrl: order.qrUrl,
          totalAmount: order.totalAmount,
          feeAmount: order.feeAmount,
          expiryAt: order.gatewayExpiresAt || order.expiresAt
        }));
        row.append(resume);
      }
      list.append(row);
    });
  }

  async function waitForGuestIdentity() {
    if (window.aryanzzAuthUser && window.aryanzzAuthUser.id) return true;
    if (window.aryanzzGuestReady && typeof window.aryanzzGuestReady.then === "function") {
      try { await window.aryanzzGuestReady; } catch {}
      return !!(window.aryanzzAuthUser && window.aryanzzAuthUser.id);
    }
    return await new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        document.removeEventListener("aryanzz:guest-ready", finish);
        resolve(!!(window.aryanzzAuthUser && window.aryanzzAuthUser.id));
      };
      const timer = setTimeout(finish, 8000);
      document.addEventListener("aryanzz:guest-ready", finish, { once: true });
    });
  }

  async function load() {
    await waitForGuestIdentity();
    const [catalogResult, configResult] = await Promise.all([
      api("/api/membership/catalog", { method: "GET" }),
      api("/api/membership/payment-config", { method: "GET" })
    ]);
    if (catalogResult.response.ok && catalogResult.data.ok) state.catalog = catalogResult.data;
    const config = configResult.data || {};
    if (state.catalog) restoreCart();
    state.checkoutEnabled = !!(configResult.response.ok && config.checkoutEnabled && config.identityReady);
    renderCart();
    if (!state.catalog) {
      setMessage("Katalog membership belum dapat dimuat.", "error");
      return;
    }
    renderPlans();
    await refreshMe();

    if (!state.identityReady) {
      state.checkoutEnabled = false;
      renderPlans();
      renderCart();
      renderFeatureLocks();
      setMessage(window.aryanzzAuthUser?.localOnly
        ? "Akun lokal ini hanya tersimpan di browser. Checkout Membership memerlukan akun server ARYANZZ yang terverifikasi; layanan database akun dan keamanan server perlu diaktifkan terlebih dahulu."
        : "ID ARYANZZ belum tersinkron. Tunggu sebentar lalu muat ulang halaman agar membership terhubung ke ID perangkatmu.", "warning");
      return;
    }
    if (!state.checkoutEnabled) {
      const missing = Array.isArray(config.missing) ? config.missing.join(", ") : "AIRPAY_API_KEY";
      setMessage("Paket sudah ditampilkan, tetapi checkout belum aktif. Konfigurasi yang diperlukan: " + missing + ".", "warning");
    }

    const pending = state.orders.find(order => order.status === "pending" && order.transactionId);
    if (pending && !state.activeOrderId) {
      showPayment(pending, {
        qrUrl: pending.qrUrl,
        payUrl: pending.payUrl,
        totalAmount: pending.totalAmount,
        feeAmount: pending.feeAmount,
        expiryAt: pending.expiresAt
      });
    }
  }

  function setPeriod(period) {
    state.period = period;
    if (state.cart) {
      state.cart.period = period;
      persistCart();
      renderCart();
    }
    byId("membershipMonthly").classList.toggle("active", period === "monthly");
    byId("membershipYearly").classList.toggle("active", period === "yearly");
    if (state.selectedPlan) {
      const plan = state.selectedPlan;
      const price = period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
      byId("membershipCheckoutSummary").textContent =
        money(price) + (period === "yearly" ? " untuk 1 tahun." : " untuk 1 bulan.");
    }
    renderPlans();
  }

  byId("membershipMonthly").addEventListener("click", () => setPeriod("monthly"));
  byId("membershipYearly").addEventListener("click", () => setPeriod("yearly"));
  byId("membershipCartToggle").addEventListener("click", () => {
    const cart = byId("membershipCart");
    cart.hidden = !cart.hidden;
    byId("membershipCartToggle").setAttribute("aria-expanded", String(!cart.hidden));
  });
  byId("membershipCartClear").addEventListener("click", clearCart);
  byId("membershipCartCheckout").addEventListener("click", openCheckout);
  byId("membershipCheckoutForm").addEventListener("submit", submitCheckout);
  byId("membershipCheckStatus").addEventListener("click", async () => {
    if (!state.activeOrderId) return;
    stopPolling();
    const keepChecking = await pollOnce();
    if (keepChecking && state.activeOrderId) startPolling(state.activeOrderId);
  });

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target && (target.closest('[data-panel="membership"]') || target.closest('[data-nav="membership"]'))) {
      load().catch(error => setMessage(error.message || "Gagal memuat Membership.", "error"));
    }
  });

  window.ARYANZZMembership = {
    refresh: load,
    canAccess(requiredTier) {
      return canAccessTier(requiredTier);
    },
    setNotice(message) {
      setMessage(message, "warning");
    }
  };

  load().then(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("membership") === "return" && params.get("order")) {
      const id = params.get("order");
      const order = state.orders.find(item => item.id === id);
      if (order) {
        showPayment(order, {
          qrUrl: order.qrUrl,
          payUrl: order.payUrl,
          totalAmount: order.totalAmount,
          feeAmount: order.feeAmount,
          expiryAt: order.expiresAt
        });
        startPolling(id);
      } else {
        state.activeOrderId = id;
        pollOnce().catch(() => {});
      }
      if (typeof window.aryanzzShowPanel === "function") window.aryanzzShowPanel("membership");
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete("membership");
      cleanUrl.searchParams.delete("order");
      history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    }
  }).catch(error => setMessage(error.message || "Gagal memuat Membership.", "error"));
  window.addEventListener("aryanzz:auth-change",()=>{load().catch(()=>{});});
})();