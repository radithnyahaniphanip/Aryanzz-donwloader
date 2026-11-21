// ARYANZZ same-origin API gateway for the free Pages hostname.
// Cloudflare Service Bindings call the original Worker privately: the user's
// browser never needs to open a blocked *.workers.dev address for /api/*.
export async function onRequest(context) {
  if (!context.env.ARYANZZ_BACKEND || typeof context.env.ARYANZZ_BACKEND.fetch !== "function") {
    return new Response(JSON.stringify({
      ok: false,
      code: "PAGES_BACKEND_UNAVAILABLE",
      error: "Backend ARYANZZ belum terhubung ke alamat alternatif."
    }), {
      status: 503,
      headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}
    });
  }
  // Preserve original host, method, cookies, body, and Origin. The backend
  // already requires Origin == request.url.origin for browser API mutations;
  // replacing the host would break this safeguard and account cookies.
  const response = await context.env.ARYANZZ_BACKEND.fetch(context.request);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
