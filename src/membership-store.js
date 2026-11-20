const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_POLL_MS = 30 * 1000;

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    badge: "STARTER",
    monthlyPrice: 10000,
    yearlyPrice: 40000,
    durationDays: 30,
    yearlyDurationDays: 365,
    summary: "Mulai menikmati pengalaman member ARYANZZ.",
    features: [
      "Badge Starter pada panel Membership",
      "Status keanggotaan terhubung ke ID ARYANZZ",
      "Riwayat pembayaran dan masa aktif",
      "Perpanjangan paket dari akun yang sama"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    badge: "PRO",
    monthlyPrice: 66000,
    yearlyPrice: 127000,
    durationDays: 30,
    yearlyDurationDays: 365,
    summary: "Untuk pengguna aktif yang membutuhkan ruang kerja media lebih lengkap.",
    features: [
      "Semua fasilitas Starter",
      "Membuka Media Studio Pro",
      "Pustaka media dan pemutar lokal",
      "Smart Queue untuk mengatur unduhan"
    ]
  },
  {
    id: "ultra",
    name: "Ultra",
    badge: "ULTRA",
    monthlyPrice: 200000,
    yearlyPrice: 370000,
    durationDays: 30,
    yearlyDurationDays: 365,
    summary: "Pengalaman kreatif lanjutan dengan akses Studio yang lebih luas.",
    features: [
      "Semua fasilitas Pro",
      "Membuka Video Editor Studio",
      "Trim, filter, teks, dan audio",
      "Subtitle dan ekspor hasil edit"
    ]
  },
  {
    id: "max",
    name: "Max",
    badge: "MAX",
    monthlyPrice: 600000,
    yearlyPrice: 1600000,
    durationDays: 30,
    yearlyDurationDays: 365,
    summary: "Paket tertinggi untuk pengguna yang ingin membuka seluruh ruang kreatif member.",
    features: [
      "Semua fasilitas Ultra",
      "Membuka Emote Studio",
      "Edit stiker dan ekspor PNG/WebP",
      "Buat GIF dan tambahkan stiker ke MP4"
    ]
  }
];

const TIER_RANK = { free: 0, starter: 1, pro: 2, ultra: 3, max: 4 };

function json(data, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store, no-cache, must-revalidate");
  h.set("pragma", "no-cache");
  return new Response(JSON.stringify(data), { status, headers: h });
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

function readCookie(request, name = "aryanzz_device_lock") {
  const cookie = String(request.headers.get("cookie") || "");
  const prefix = name + "=";
  const part = cookie.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
  return part ? part.slice(prefix.length) : "";
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function planFor(id) {
  return PLANS.find(plan => plan.id === String(id || "")) || null;
}

function publicOrder(order) {
  return {
    id: order.id,
    planId: order.planId,
    planName: order.planName,
    billingPeriod: order.billingPeriod,
    amount: order.amount,
    totalAmount: order.totalAmount || order.amount,
    feeAmount: order.feeAmount || 0,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    expiresAt: order.expiryAt || null,
    gatewayExpiresAt: order.expiryAt || null,
    checkoutExpiresAt: order.checkoutExpiresAt || (Number(order.createdAt || Date.now()) + 10 * 60 * 1000),
    checkoutExpired: order.status === "pending" && Date.now() >= Number(order.checkoutExpiresAt || (Number(order.createdAt || Date.now()) + 10 * 60 * 1000)),
    transactionId: order.transactionId || null,
    qrUrl: order.qrUrl || null,
    payUrl: order.payUrl || null,
    note: order.note || ""
  };
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyAirPaySignature(rawBody, signature, apiKey) {
  if (!signature || !apiKey) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return constantTimeEqual(hex(digest), String(signature).trim().toLowerCase());
}

function normalizedPaymentStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["success", "paid", "settled", "lunas", "payment.success", "checkout.successful"].includes(status)) return "paid";
  if (["expired", "expire", "timeout", "payment.expired", "checkout.expired"].includes(status)) return "expired";
  if (["cancelled", "canceled", "failed", "rejected", "refunded", "payment.failed", "checkout.cancelled"].includes(status)) return "failed";
  return "pending";
}

export class MembershipStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async session(request) {
    const deviceToken = readCookie(request, "aryanzz_device_lock");
    if (!/^[a-f0-9]{64}$/i.test(deviceToken)) return null;
    const lockHash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deviceToken.toLowerCase())));
    const deviceId = "device-" + lockHash;
    const db = this.env.AUTH_DB;
    if (!db || typeof db.prepare !== "function" || String(this.env.AUTH_SESSION_SECRET || "").length < 32) {
      return { id: deviceId, cookie: null, deviceBound: true };
    }
    try {
      const row = await db.prepare("SELECT user_id FROM auth_device_lock_accounts WHERE lock_hash=?1 LIMIT 1").bind(lockHash).first();
      if (!row || !row.user_id) return { id: deviceId, cookie: null, deviceBound: true };
      const accountId = String(row.user_id);
      if (accountId !== deviceId) await this.migrateDeviceIdentity(deviceId, accountId);
      return { id: accountId, cookie: null, deviceBound: false };
    } catch (error) {
      console.warn("[ARYANZZ_MEMBERSHIP] identity_lookup_failed", error && error.name || "unknown");
      return { id: deviceId, cookie: null, deviceBound: true };
    }
  }

  async migrateDeviceIdentity(deviceId, accountId) {
    try {
      const deviceMembership = await this.ctx.storage.get("membership:" + deviceId);
      const accountMembership = await this.ctx.storage.get("membership:" + accountId);
      if (deviceMembership && (!accountMembership || accountMembership.status !== "active")) {
        await this.ctx.storage.put("membership:" + accountId, deviceMembership);
      }
      const deviceOrders = await this.ctx.storage.get("orders:" + deviceId) || [];
      if (deviceOrders.length) {
        const accountOrders = await this.ctx.storage.get("orders:" + accountId) || [];
        const known = new Set(accountOrders.map(order => order.id));
        for (const order of deviceOrders) {
          order.userId = accountId;
          await this.ctx.storage.put("order:" + order.id, order);
          if (!known.has(order.id)) await this.saveOrderList(accountId, order);
        }
      }
    } catch (error) {
      console.warn("[ARYANZZ_MEMBERSHIP] device_membership_migration_failed", error && error.name || "unknown");
    }
  }

  apiKey() {
    return String(this.env.AIRPAY_API_KEY || "").trim();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === "/api/membership/webhook") return this.webhook(request);

    if (path === "/api/membership/catalog" && method === "GET") {
      return json({
        ok: true,
        pricingStatus: "active",
        provider: "AirPay QRIS",
        paymentEnabled: !!this.apiKey(),
        plans: PLANS,
        free: {
          id: "free",
          name: "Free",
          price: 0,
          summary: "Tetap bisa menggunakan fitur dasar ARYANZZ tanpa membayar."
        }
      });
    }

    if (path === "/api/membership/payment-config" && method === "GET") {
      const apiKeyReady = !!this.apiKey();
      const session = await this.session(request);
      const identityReady = !!session;
      const authReady = !!this.env.AUTH_DB && typeof this.env.AUTH_DB.prepare === "function" && String(this.env.AUTH_SESSION_SECRET || "").length >= 32;
      const ready = apiKeyReady && identityReady;
      const missing = [];
      const optionalMissing = [];
      if (!apiKeyReady) missing.push("AIRPAY_API_KEY · Secret API Key AirPay pada Cloudflare Worker");
      if (!identityReady) missing.push("ID perangkat ARYANZZ belum tersedia; muat ulang halaman");
      if (!authReady) optionalMissing.push("AUTH_DB + AUTH_SESSION_SECRET · sinkronisasi Membership lintas perangkat");
      return json({
        ok: true,
        enabled: ready,
        checkoutEnabled: ready,
        apiKeyReady,
        authReady,
        identityReady,
        identityMode: session?.deviceBound ? "device" : identityReady ? "account" : "unavailable",
        provider: "AirPay QRIS",
        mode: this.apiKey().startsWith("ak_test_") ? "sandbox" : apiKeyReady ? "live" : "not-configured",
        statusVerification: "webhook-and-server-side-polling",
        webhookAvailable: true,
        webhookUrl: new URL("/api/membership/webhook", url.origin).href,
        missing,
        optionalMissing,
        message: ready
          ? authReady
            ? "Checkout QRIS siap. Pembayaran diverifikasi server dan Membership tersimpan pada akun ARYANZZ."
            : "Checkout QRIS siap pada perangkat ini. Membership terikat ke ID perangkat; aktifkan D1 dan AUTH_SESSION_SECRET untuk sinkronisasi lintas perangkat."
          : "Checkout menunggu API Key AirPay dan ID perangkat ARYANZZ."
      });
    }

    if (path === "/api/membership/payment-methods" && method === "GET") {
      return json({
        ok: true,
        provider: "AirPay QRIS",
        methods: [{
          id: "qris",
          name: "QRIS",
          description: "Satu QR untuk aplikasi yang mendukung QRIS, termasuk DANA, GoPay, LinkAja, OVO, dan mobile banking."
        }]
      });
    }

    if (path === "/api/membership/me" && method === "GET") {
      const session = await this.session(request);
      if (!session) return json({ ok: false, error: "ID ARYANZZ belum siap. Muat ulang halaman dan tunggu sinkronisasi identitas selesai." }, 401);
      const membership = await this.membershipFor(session.id);
      const orders = await this.ctx.storage.get("orders:" + session.id) || [];
      return json({
        ok: true,
        user: { id: session.id },
        membership,
        orders: orders.slice(0, 20).map(publicOrder)
      });
    }

    if (path === "/api/membership/orders" && method === "POST") {
      return this.createOrder(request);
    }

    if (path === "/api/membership/orders/status" && method === "GET") {
      return this.orderStatus(request);
    }

    if (path === "/api/membership/admin/orders" && method === "GET") {
      return json({
        ok: false,
        error: "Riwayat seluruh pelanggan hanya tersedia melalui panel admin yang terautentikasi."
      }, 403);
    }

    return json({ ok: false, error: "Endpoint Membership tidak ditemukan." }, 404);
  }

  async membershipFor(sessionId) {
    let membership = await this.ctx.storage.get("membership:" + sessionId) || {
      tier: "free",
      planName: "Free",
      status: "free",
      startedAt: null,
      expiresAt: null
    };

    if (membership.status === "active" && membership.expiresAt && Number(membership.expiresAt) <= Date.now()) {
      membership = { ...membership, status: "expired", expiredAt: Date.now() };
      await this.ctx.storage.put("membership:" + sessionId, membership);
    }

    if (membership.status !== "active") {
      return {
        ...membership,
        tier: "free",
        planName: "Free"
      };
    }

    return membership;
  }

  async createOrder(request) {
    if (!this.apiKey()) {
      return json({
        ok: false,
        error: "Pembayaran belum dikonfigurasi. AIRPAY_API_KEY belum terpasang di Cloudflare Worker."
      }, 503);
    }

    const session = await this.session(request);
    if (!session) {
      return json({ ok: false, error: "ID ARYANZZ belum tersinkron. Muat ulang halaman dan tunggu identitas perangkat siap." }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Data checkout tidak valid." }, 400);
    }

    const plan = planFor(body && body.planId);
    const billingPeriod = String(body && body.billingPeriod || "monthly").toLowerCase();
    if (!plan || !["monthly", "yearly"].includes(billingPeriod)) {
      return json({ ok: false, error: "Paket atau periode membership tidak valid." }, 400);
    }

    const customerName = String(body.customerName || "").trim().replace(/\s+/g, " ").slice(0, 100);
    const customerEmail = String(body.customerEmail || "").trim().toLowerCase();
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return json({ ok: false, error: "Format email tidak valid." }, 400);
    }

    const amount = billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    if (!Number.isInteger(amount) || amount < 1000 || amount > 10000000) {
      return json({ ok: false, error: "Nominal paket tidak memenuhi batas transaksi AirPay." }, 400);
    }

    const currentMembership = await this.membershipFor(session.id);
    if (currentMembership.status === "active" &&
        (TIER_RANK[plan.id] || 0) < (TIER_RANK[currentMembership.tier] || 0)) {
      return json({
        ok: false,
        code: "LOWER_TIER_WHILE_ACTIVE",
        error: "Membership " + currentMembership.planName + " masih aktif. Kamu bisa memperpanjang paket yang sama atau upgrade ke tier lebih tinggi; paket lebih rendah tersedia setelah masa aktif berakhir."
      }, 409);
    }

    const priorOrders = await this.ctx.storage.get("orders:" + session.id) || [];
    const pending = priorOrders.find(order =>
      order.status === "pending" &&
      (!order.expiryAt || new Date(order.expiryAt).getTime() > Date.now())
    );
    if (pending) {
      return json({
        ok: false,
        code: "PENDING_ORDER_EXISTS",
        error: "Masih ada invoice yang menunggu pembayaran. Lanjutkan pembayaran sebelumnya terlebih dahulu.",
        order: publicOrder(pending),
        payment: {
          provider: "AirPay QRIS",
          qrUrl: pending.qrUrl || null,
          payUrl: pending.payUrl || null,
          totalAmount: pending.totalAmount || pending.amount,
          expiryAt: pending.expiryAt || null
        }
      }, 409);
    }

    const now = Date.now();
    const id = "ARYM-" + now.toString(36).toUpperCase() + "-" + randomId().slice(0, 8);
    const order = {
      id,
      userId: session.id,
      planId: plan.id,
      planName: plan.name,
      billingPeriod,
      amount,
      totalAmount: amount,
      feeAmount: 0,
      status: "pending",
      paymentProvider: "airpay",
      customerName,
      customerEmail,
      createdAt: now,
      checkoutExpiresAt: now + 10 * 60 * 1000,
      transactionId: null,
      qrUrl: null,
      payUrl: null,
      expiryAt: null,
      note: "Menunggu pembuatan invoice AirPay."
    };

    await this.ctx.storage.put("order:" + id, order);
    await this.saveOrderList(session.id, order);

    const returnUrl = new URL("/", request.url);
    returnUrl.searchParams.set("membership", "return");
    returnUrl.searchParams.set("order", id);

    try {
      const response = await fetch("https://airpaygateway.site/api/qris/create", {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey(),
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          amount,
          external_id: id,
          description: "ARYANZZ Membership " + plan.name + " " + (billingPeriod === "yearly" ? "Tahunan" : "Bulanan"),
          callback_url: new URL("/api/membership/webhook", request.url).href,
          return_url: returnUrl.href
        }),
        signal: AbortSignal.timeout(15000),
        cache: "no-store"
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.success === false) {
        throw new Error(payload && payload.message || "AirPay gagal membuat invoice QRIS (HTTP " + response.status + ").");
      }

      const invoice = payload.data || payload;
      const transactionId = String(invoice.transaction_id || invoice.id || "").trim();
      const qrUrl = safeHttpsUrl(invoice.qr_url);
      const payUrl = safeHttpsUrl(invoice.pay_url);
      if (!transactionId || !qrUrl) {
        throw new Error("AirPay harus mengembalikan transaction_id dan qr_url agar pembayaran dapat dipindai langsung di ARYANZZ.");
      }
      if (invoice.base_amount !== undefined && Number(invoice.base_amount) !== amount) {
        throw new Error("Nominal dasar invoice AirPay tidak cocok dengan harga paket.");
      }
      const gatewayTotal = Number(invoice.total_amount || amount);
      if (!Number.isSafeInteger(gatewayTotal) || gatewayTotal < amount || gatewayTotal > amount + 999) {
        throw new Error("Total pembayaran AirPay tidak valid.");
      }

      order.transactionId = transactionId;
      order.qrUrl = qrUrl || null;
      order.payUrl = payUrl || null;
      order.totalAmount = gatewayTotal;
      order.feeAmount = Number(invoice.fee_amount ?? Math.max(0, order.totalAmount - amount));
      if (!Number.isSafeInteger(order.feeAmount) || order.feeAmount < 0 || order.amount + order.feeAmount !== order.totalAmount) {
        throw new Error("Rincian biaya invoice AirPay tidak konsisten.");
      }
      order.expiryAt = invoice.expiry_at || new Date(now + 15 * 60 * 1000).toISOString();
      order.note = "Invoice QRIS dibuat. Menunggu pembayaran.";
      await this.ctx.storage.put("order:" + id, order);
      await this.saveOrderList(session.id, order);
      await this.scheduleStatusCheck();

      return json({
        ok: true,
        order: publicOrder(order),
        payment: {
          provider: "AirPay QRIS",
          transactionId,
          qrUrl: order.qrUrl,
          payUrl: order.payUrl,
          baseAmount: amount,
          feeAmount: order.feeAmount,
          totalAmount: order.totalAmount,
          expiryAt: order.expiryAt,
          supportedApps: ["DANA", "GoPay", "LinkAja", "OVO", "Mobile Banking"]
        },
        message: "Invoice QRIS berhasil dibuat. Membership akan aktif setelah status lunas diverifikasi oleh server."
      }, 201);
    } catch (error) {
      order.status = "rejected";
      order.note = String(error && error.message || error).slice(0, 260);
      await this.ctx.storage.put("order:" + id, order);
      await this.saveOrderList(session.id, order);
      return json({ ok: false, error: "Invoice AirPay gagal dibuat. " + order.note }, 502);
    }
  }

  async saveOrderList(sessionId, order) {
    const current = await this.ctx.storage.get("orders:" + sessionId) || [];
    const next = [order, ...current.filter(item => item.id !== order.id)].slice(0, 50);
    await this.ctx.storage.put("orders:" + sessionId, next);
  }

  async orderStatus(request) {
    const session = await this.session(request);
    if (!session) return json({ ok: false, error: "ID ARYANZZ belum tersinkron pada perangkat ini." }, 401);

    const url = new URL(request.url);
    const orderId = String(url.searchParams.get("orderId") || "").trim();
    if (!/^ARYM-[A-Z0-9-]{8,80}$/.test(orderId)) {
      return json({ ok: false, error: "ID invoice tidak valid." }, 400);
    }

    const order = await this.ctx.storage.get("order:" + orderId);
    if (!order || order.userId !== session.id) {
      return json({ ok: false, error: "Invoice tidak ditemukan pada sesi ini." }, 404);
    }

    let checkError = "";
    if (order.status === "pending") {
      try {
        await this.checkOrderStatus(order);
      } catch (error) {
        checkError = String(error && error.message || error).slice(0, 180);
      }
    }

    const updated = await this.ctx.storage.get("order:" + orderId) || order;
    return json({
      ok: true,
      order: publicOrder(updated),
      membership: await this.membershipFor(session.id),
      checkError: checkError || null
    });
  }

  async checkOrderStatus(order) {
    if (!order || order.status !== "pending") return order;
    if (!order.transactionId) return order;
    if (!this.apiKey()) throw new Error("AIRPAY_API_KEY belum tersedia pada server.");

    const endpoint = new URL("https://airpaygateway.site/api/qris/status");
    endpoint.searchParams.set("transaction_id", order.transactionId);

    const response = await fetch(endpoint.href, {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey(),
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store"
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.success === false) {
      throw new Error(payload && payload.message || "AirPay belum dapat memberikan status transaksi (HTTP " + response.status + ").");
    }

    const result = payload.data || payload;
    const returnedTransactionId = String(result.transaction_id || result.id || "").trim();
    if (returnedTransactionId && returnedTransactionId !== order.transactionId) {
      throw new Error("ID transaksi dari AirPay tidak cocok dengan invoice ARYANZZ.");
    }

    const externalId = String(result.external_id || "").trim();
    if (externalId && externalId !== order.id) {
      throw new Error("Referensi invoice AirPay tidak cocok dengan pesanan ARYANZZ.");
    }

    const baseAmount = Number(result.base_amount || result.requested_amount || 0);
    const totalAmount = Number(result.total_amount || result.paid_amount || 0);
    if (baseAmount && baseAmount !== Number(order.amount)) {
      throw new Error("Nominal dasar transaksi AirPay tidak cocok dengan paket membership.");
    }
    if (totalAmount && totalAmount !== Number(order.totalAmount)) {
      throw new Error("Total pembayaran transaksi AirPay tidak cocok dengan invoice ARYANZZ.");
    }

    const status = normalizedPaymentStatus(result.status || payload.status);
    if (status === "paid") {
      await this.activateMembership(order, result);
    } else if (status === "expired" || status === "failed") {
      order.status = status;
      order.note = status === "expired" ? "Invoice QRIS kedaluwarsa." : "Transaksi QRIS gagal atau dibatalkan.";
      order.lastCheckedAt = Date.now();
      await this.ctx.storage.put("order:" + order.id, order);
      await this.saveOrderList(order.userId, order);
    } else {
      order.lastCheckedAt = Date.now();
      await this.ctx.storage.put("order:" + order.id, order);
      await this.saveOrderList(order.userId, order);
    }

    return await this.ctx.storage.get("order:" + order.id) || order;
  }

  async activateMembership(order, paymentData = {}) {
    if (!order || order.status === "paid") return order;

    const plan = planFor(order.planId);
    if (!plan) throw new Error("Paket pada invoice tidak ditemukan.");

    const now = Date.now();
    const previous = await this.membershipFor(order.userId);
    const previousRank = previous.status === "active" ? (TIER_RANK[previous.tier] || 0) : 0;
    const nextRank = TIER_RANK[plan.id] || 0;
    const effectivePlan = previousRank > nextRank ? planFor(previous.tier) || plan : plan;
    const base = previous.status === "active" && previous.expiresAt
      ? Math.max(now, Number(previous.expiresAt))
      : now;
    const durationDays = order.billingPeriod === "yearly" ? plan.yearlyDurationDays : plan.durationDays;
    const expiresAt = base + durationDays * DAY_MS;

    order.status = "paid";
    order.paidAt = now;
    order.providerTransactionId = String(paymentData.transaction_id || order.transactionId || "");
    order.note = "Pembayaran QRIS terverifikasi oleh AirPay (webhook/status server).";
    order.lastCheckedAt = now;

    const membership = {
      tier: effectivePlan.id,
      planName: effectivePlan.name,
      status: "active",
      startedAt: previous.status === "active" && previous.startedAt ? previous.startedAt : now,
      expiresAt,
      sourceOrderId: order.id,
      updatedAt: now
    };

    await this.ctx.storage.put("order:" + order.id, order);
    await this.ctx.storage.put("membership:" + order.userId, membership);
    await this.saveOrderList(order.userId, order);
    return order;
  }

  async scheduleStatusCheck() {
    try {
      const current = await this.ctx.storage.getAlarm();
      const next = Date.now() + STATUS_POLL_MS;
      if (!current || current > next) await this.ctx.storage.setAlarm(next);
    } catch (error) {
      console.warn("[ARYANZZ_MEMBERSHIP] alarm_schedule_failed", error && error.name || "unknown");
    }
  }

  async alarm() {
    try {
      const entries = await this.ctx.storage.list({ prefix: "order:", limit: 1000 });
      const pendingOrders = Array.from(entries.values()).filter(order => order && order.status === "pending");
      if (!pendingOrders.length) {
        await this.ctx.storage.deleteAlarm();
        return;
      }

      // Rotate the batch cursor so pending orders beyond the first 20 are not starved.
      const cursor = String(await this.ctx.storage.get("membership-alarm-cursor") || "");
      let start = pendingOrders.findIndex(order => String(order.id) > cursor);
      if (start < 0) start = 0;
      const rotated = pendingOrders.slice(start).concat(pendingOrders.slice(0, start));
      const batch = rotated.slice(0, 20);

      for (const order of batch) {
        try {
          await this.checkOrderStatus(order);
        } catch (error) {
          order.lastCheckError = String(error && error.message || error).slice(0, 180);
          order.lastCheckedAt = Date.now();
          await this.ctx.storage.put("order:" + order.id, order);
          await this.saveOrderList(order.userId, order);
        }
      }

      if (batch.length) await this.ctx.storage.put("membership-alarm-cursor", String(batch[batch.length - 1].id));
      await this.ctx.storage.setAlarm(Date.now() + STATUS_POLL_MS);
    } catch (error) {
      console.error("[ARYANZZ_MEMBERSHIP] alarm_failed", error && error.name || "unknown");
      await this.ctx.storage.setAlarm(Date.now() + STATUS_POLL_MS).catch(() => {});
    }
  }

  async webhook(request) {
    if (request.method !== "POST") return json({ ok: false, error: "Method tidak diizinkan." }, 405);
    if (!this.apiKey()) return json({ ok: false, error: "AIRPAY_API_KEY belum dikonfigurasi." }, 503);

    const rawBody = await request.text();
    const signature = String(request.headers.get("X-AirPay-Signature") || "");
    if (!await verifyAirPaySignature(rawBody, signature, this.apiKey())) {
      return json({ ok: false, error: "Tanda tangan webhook AirPay tidak valid." }, 401);
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, error: "Payload webhook tidak valid." }, 400);
    }

    const data = event.data || event;
    const eventKey = "airpay-event:" + await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody)).then(hex);
    if (await this.ctx.storage.get(eventKey)) return json({ ok: true, duplicate: true });
    const orderId = String(data.external_id || data.externalId || "").trim();
    const order = orderId ? await this.ctx.storage.get("order:" + orderId) : null;
    if (!order) return json({ ok: false, error: "Pesanan ARYANZZ tidak ditemukan." }, 404);

    const transactionId = String(data.transaction_id || data.id || "").trim();
    if (transactionId && order.transactionId && transactionId !== order.transactionId) {
      return json({ ok: false, error: "ID transaksi webhook tidak cocok." }, 409);
    }

    const status = normalizedPaymentStatus(data.status || request.headers.get("X-AirPay-Event"));
    if (status === "paid") {
      const amount = Number(data.base_amount || data.amount || 0);
      const totalAmount = Number(data.total_amount || 0);
      if (amount && amount !== Number(order.amount)) {
        return json({ ok: false, error: "Nominal dasar webhook tidak cocok dengan pesanan." }, 409);
      }
      if (totalAmount && totalAmount !== Number(order.totalAmount)) {
        return json({ ok: false, error: "Total pembayaran webhook tidak cocok dengan pesanan." }, 409);
      }
      try {
        await this.checkOrderStatus(order);
      } catch (error) {
        return json({ ok: false, error: "Webhook diterima, tetapi verifikasi status AirPay belum berhasil: " + String(error && error.message || error).slice(0, 140) }, 503);
      }
      const verifiedOrder = await this.ctx.storage.get("order:" + orderId);
      if (!verifiedOrder || verifiedOrder.status !== "paid") {
        return json({ ok: false, error: "Status AirPay belum terkonfirmasi lunas. Webhook akan dicoba kembali." }, 503);
      }
    } else if (status === "expired" || status === "failed") {
      order.status = status;
      order.note = "Status invoice diperbarui melalui webhook AirPay.";
      await this.ctx.storage.put("order:" + order.id, order);
      await this.saveOrderList(order.userId, order);
    }

    await this.ctx.storage.put(eventKey, { receivedAt: Date.now(), orderId });
    return json({ ok: true, status });
  }
}
