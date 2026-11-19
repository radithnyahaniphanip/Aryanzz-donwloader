import { DurableObject } from "cloudflare:workers";

const PORT = 8080;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function tokenMatches(request, expected) {
  if (!expected) return false;
  const received = String(request.headers.get("authorization") || "");
  const wanted = "Bearer " + expected;
  if (received.length !== wanted.length) return false;
  let difference = 0;
  for (let i = 0; i < wanted.length; i++) difference |= received.charCodeAt(i) ^ wanted.charCodeAt(i);
  return difference === 0;
}

export class YouTubeMuxContainer extends DurableObject {
  starting;

  async fetch(request) {
    this.starting ??= this.startAndWaitForPort().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");
    forwarded.headers.delete("authorization");
    return this.ctx.container.getTcpPort(PORT).fetch(forwarded);
  }

  async startAndWaitForPort() {
    const container = this.ctx.container;
    if (!container.running) {
      container.start({
        image: container.images.base,
        enableInternet: true
      });
    }
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
    const port = container.getTcpPort(PORT);
    let lastError;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await port.fetch("http://container/health", {
          signal: AbortSignal.timeout(1000)
        });
        await response.body?.cancel();
        if (response.ok) return;
        lastError = new Error("Health check HTTP " + response.status);
      } catch (error) {
        lastError = error;
      }
      await scheduler.wait(200);
    }
    throw new Error("FFmpeg container belum siap.", { cause: lastError });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "aryanzz-youtube-mp4-mux" });
    }
    if (request.method !== "POST" || !/^\/(?:mux|probe)\/[0-9a-f-]{36}$/i.test(url.pathname)) {
      return json({ ok: false, error: "Endpoint tidak ditemukan." }, 404);
    }
    if (!tokenMatches(request, env.MUX_TOKEN)) {
      return json({ ok: false, error: "Akses mesin mux tidak diizinkan." }, 401);
    }
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 64 * 1024) return json({ ok: false, error: "Permintaan mux terlalu besar." }, 413);
    let payload;
    try {
      payload = await request.clone().json();
    } catch {
      return json({ ok: false, error: "Data mux tidak valid." }, 400);
    }
    const id = url.pathname.split("/").pop();
    if (!payload || payload.id !== id) return json({ ok: false, error: "ID proses tidak cocok." }, 400);
    return env.YOUTUBE_MUX.getByName(id).fetch(request);
  }
};
