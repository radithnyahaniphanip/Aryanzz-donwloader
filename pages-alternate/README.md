# ARYANZZ emergency Pages access (free)

The project `aryanzz-access-alternate` is **not** another source of truth.
It deploys the same versioned `public/` static site to
`aryanzz-access-alternate.pages.dev`, and forwards **only** `/api/*`
through an internal Cloudflare Service Binding named `ARYANZZ_BACKEND`
to the existing `aryanzz-donwloader` Worker.

No private API key, D1 database, membership data, or account signing secret
is duplicated in Cloudflare Pages. The Worker remains the backend.

**Do not advertise the alternate address until the deployment smoke test
confirms both the static HTML and `/api/auth/config` work.**

The Cloudflare API token used by GitHub Actions must have permission to
manage **Cloudflare Pages** deployments (in addition to current Worker
permissions). Lack of Pages permissions fails only the separate Pages job
and does not affect the main Worker deployment.

Limitations:
- This is a separate browser origin; local-only Pustaka / browser sessions
  and previously saved local data do **not** migrate automatically.
- The Cloudflare Turnstile widget must permit the new Pages hostname, or
  user CAPTCHA/login may fail despite `loginReady: true`.
- Email verification links, QRIS return URLs, and official SEO canonical
  addresses currently use the original Worker origin; reconcile these
  before adopting Pages as the primary production domain.
- Some mobile networks could filter `pages.dev` too. The owner must test
  from their device and ISP. Do not ignore TLS/HTTPS warnings.
- No payment is initiated by deploying or verifying the alternate route.
