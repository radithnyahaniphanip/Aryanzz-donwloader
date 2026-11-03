# ARYANZZ Security Policy — V88.12

## Active Worker protections

The Worker applies a shared security wrapper to API and static-asset responses:

- Same-origin validation for browser requests that carry an Origin header.
- API method allowlist: GET, HEAD, POST and OPTIONS.
- API content-type allowlist for JSON, octet-stream and multipart form uploads.
- Content-Length guard: 2 MiB for JSON and 105 MiB for binary/form uploads.
- Per-IP, per-endpoint in-memory rate limits: 18/minute for search routes, 90/minute for other API routes and media file routes.
- Response headers: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy and COOP.
- Request IDs and generic client errors; server exceptions are logged without request bodies or credentials.
- Sanitized status endpoint: GET /api/security/status.

## Important limitations

This is defense-in-depth, not a guarantee that the website is unhackable.

The in-memory rate limiter is isolate-local and can reset when Workers instances restart or scale. It is a useful abuse throttle, not a substitute for Cloudflare network-level DDoS protection or persistent rate limiting. Security event counters are also isolate-local and are not an incident log.

The origin check protects browser-based cross-site requests. It is not authentication: non-browser clients can forge or omit Origin. Endpoints that expose public downloading/searching remain public.

The current CSP intentionally allows HTTPS resources and inline scripts/styles for compatibility with the existing UI. Tighten it gradually after inventorying every required script, style, media, image, frame and API host. Do not add unsafe-eval unless a verified dependency requires it.

## Cloudflare dashboard hardening checklist

1. Keep the Worker deployed only from the trusted GitHub repository and protect the main branch.
2. Store provider credentials only as Cloudflare Worker Secrets. Never place API tokens in HTML, JavaScript, Git commits, screenshots or logs.
3. Rotate any credential that has ever been committed or exposed; deleting it from the latest file does not revoke it.
4. Enable Cloudflare's available DDoS protections and managed security rules for any custom domain/zone attached to the Worker.
5. Add edge rate-limiting rules for API search, extraction and file-proxy routes. Start with conservative thresholds, monitor false positives, then tune.
6. If the site remains on a workers.dev hostname, use the Worker middleware here and check which zone-level WAF features are available; attach a controlled custom domain if zone-level rules are required.
7. Enable GitHub secret scanning and push protection where available; require review for changes to Worker code and deployment workflows.
8. Review Worker logs and Cloudflare analytics for repeated 403/413/429/5xx responses and unexpected outbound destinations.
9. Keep dependencies updated and run npm test before deployment.
10. Create an incident response contact and a recovery plan. Keep a known-good deployment revision for rollback.

## Threat categories covered by the policy

- Automated scanning, spam and abusive request floods.
- Cross-site browser requests and unsupported API methods.
- Oversized requests and unexpected content types.
- Clickjacking, MIME sniffing, referrer leakage and some script-injection paths.
- Repeated requests to search and media endpoints.

## Threats that still need dedicated controls

- Account takeover requires authentication, MFA/passkeys and secure session management if accounts are introduced.
- Persistent distributed rate limiting requires a Cloudflare rate-limiting product/binding or another shared store; isolate-local counters are not global.
- Advanced bot detection, credential stuffing and high-volume DDoS need edge-level Cloudflare controls.
- Database injection controls are needed only if/when a database is introduced; use parameterized queries and least-privilege credentials.
- SSRF protection must be applied to every URL-fetching proxy. Maintain strict HTTPS, hostname allowlists where feasible, private-network/IP blocking after DNS resolution, redirect re-validation and response-size/time limits.
- Supply-chain attacks need dependency review, lockfile discipline, secret scanning and protected deployment workflows.

## Responsible testing

Only test systems you own or are explicitly authorized to assess. Do not run destructive scans, credential attacks, malware, persistence tests or denial-of-service attempts against third-party platforms.
