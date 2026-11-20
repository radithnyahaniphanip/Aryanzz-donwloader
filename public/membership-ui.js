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
      const button = make("button", "ary-membership-select", "Pilih " + plan.name);
      button.type = "button";
      button.disabled = !state.checkoutEnabled;
      button.addEventListener("click", () => choosePlan(plan));
      card.append(button);
      grid.append(card);
    });
  }

  function choosePlan(plan) {
    state.selectedPlan = plan;
    const price = state.period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    byId("membershipCheckoutTitle").textContent = "Checkout " + plan.name;
    byId("membershipCheckoutSummary").textContent =
      money(price) + (state.period === "yearly" ? " untuk 1 tahun." : " untuk 1 bulan.");
    byId("membershipCheckout").hidden = false;
    byId("membershipPayment").hidden = true;
    setMessage("Lengkapi nama dan email jika ingin mencantumkannya pada catatan pesanan, lalu buat invoice QRIS.", "info");
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

  function showPayment(order, payment) {
    const data = payment || {};
    state.activeOrderId = order.id;
    byId("membershipPayment").hidden = false;
    byId("membershipCheckout").hidden = true;
    byId("membershipPaymentTitle").textContent = "Selesaikan pembayaran " + (order.planName || "membership");
    byId("membershipPaymentAmount").textContent = money(data.totalAmount || order.totalAmount || order.amount);
    byId("membershipPaymentBase").textContent = "Harga paket " + money(order.amount) +
      (Number(data.feeAmount || order.feeAmount || 0) > 0 ? " · biaya " + money(data.feeAmount || order.feeAmount) : "");
    byId("membershipPaymentExpiry").textContent = data.expiryAt || order.expiresAt
      ? "Batas pembayaran: " + formatDate(data.expiryAt || order.expiresAt)
      : "Selesaikan pembayaran sebelum invoice kedaluwarsa.";

    const qr = byId("membershipQr");
    const qrUrl = safeProviderLink(data.qrUrl || order.qrUrl);
    if (qrUrl) {
      qr.src = qrUrl;
      qr.hidden = false;
    } else {
      qr.removeAttribute("src");
      qr.hidden = true;
    }

    const payLink = byId("membershipPayLink");
    const payUrl = safeProviderLink(data.payUrl || order.payUrl);
    if (payUrl) {
      payLink.href = payUrl;
      payLink.hidden = false;
    } else {
      payLink.removeAttribute("href");
      payLink.hidden = true;
    }

    setMessage("Menunggu pembayaran. ARYANZZ akan memeriksa status langsung ke server AirPay.", "pending");
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
        showPayment(result.data.order, result.data.payment || {});
        setMessage("Masih ada invoice sebelumnya. Lanjutkan pembayaran invoice tersebut.", "pending");
        return;
      }
      if (!result.response.ok || !result.data.ok) {
        throw new Error(result.data.error || "Invoice belum berhasil dibuat.");
      }

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
      setMessage("Pembayaran berhasil diverifikasi. Membership " + (order.planName || "") + " sudah aktif!", "success");
      await refreshMe();
      byId("membershipPaymentExpiry").textContent = "Membership aktif sampai " + formatDate(state.membership.expiresAt);
      state.activeOrderId = "";
      return false;
    }
    if (order.status === "expired" || order.status === "failed" || order.status === "rejected") {
      stopPolling();
      setMessage("Invoice " + order.status + ". Pilih paket kembali untuk membuat invoice baru.", "error");
      await refreshMe();
      state.activeOrderId = "";
      return false;
    }
    setMessage("Pembayaran belum terdeteksi. Jika sudah membayar, tunggu beberapa saat lalu periksa kembali.", "pending");
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

  function renderOrders() {
    const list = byId("membershipOrdersList");
    list.replaceChildren();
    if (!state.orders.length) {
      list.append(make("p", "ary-membership-order-empty", "Belum ada transaksi membership."));
      return;
    }
    state.orders.slice(0, 8).forEach(order => {
      const row = make("div", "ary-membership-order");
      const copy = make("div", "");
      copy.append(make("strong", "", (order.planName || order.planId || "Membership") + " · " +
        (order.billingPeriod === "yearly" ? "Tahunan" : "Bulanan")));
      copy.append(make("small", "", money(order.amount) + " · " + formatDate(order.createdAt)));
      row.append(copy);
      row.append(make("span", "ary-membership-order-status", order.status || "pending"));
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
    state.checkoutEnabled = !!(configResult.response.ok && config.checkoutEnabled && config.identityReady);
    if (!state.catalog) {
      setMessage("Katalog membership belum dapat dimuat.", "error");
      return;
    }
    renderPlans();
    await refreshMe();

    if (!state.identityReady) {
      state.checkoutEnabled = false;
      renderPlans();
      setMessage("ID ARYANZZ belum tersinkron. Tunggu sebentar lalu muat ulang halaman agar membership terhubung ke ID perangkatmu.", "warning");
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
      const current = state.membership && state.membership.status === "active"
        ? String(state.membership.tier || "free").toLowerCase()
        : "free";
      return (rank[current] || 0) >= (rank[String(requiredTier || "free").toLowerCase()] || 0);
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
})();