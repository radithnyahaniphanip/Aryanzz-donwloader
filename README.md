# ARYANZZ V5 — All in One

Dark, mobile-first downloader and utility website with a Node.js API powered by yt-dlp and FFmpeg.

## Deploy on Render
1. In Render choose **New → Blueprint** and connect this repository.
2. Render reads `render.yaml` and builds the Dockerfile.
3. Wait until deploy completes.
4. Test `https://YOUR-SERVICE.onrender.com/api/health`.
5. Open the service root URL to use ARYANZZ.

## API
- `GET /api/health`
- `POST /api/info` with JSON `{"url":"https://..." }`
- `POST /api/download` with JSON `{"url":"https://...","mode":"video"}` or mode audio.

## Important
Only download content you own, have permission to download, or that is explicitly permitted. Platform restrictions may prevent extraction. This starter does not support account cookies or login-only content. The free Render plan is for testing and may sleep when idle; heavy media processing may exceed free resource limits. Before a public launch, add user authentication, quotas, stronger SSRF/network controls, file-size limits, and abuse monitoring. The heart camera is a demo only and does not provide validated BPM measurement.

## Deploy the website on Cloudflare Pages (static frontend)
This repository also contains a static frontend in `public/`. To deploy the website without a paid server:

1. Open the Cloudflare dashboard and go to **Workers & Pages**.
2. Choose **Create application → Pages → Connect to Git**.
3. Authorize GitHub and select `Aryanzz-donwloader`.
4. Set production branch to `main`.
5. Leave the build command blank (or use `exit 0`).
6. Set the build output directory to `public`.
7. Save and deploy. Cloudflare will provide a `*.pages.dev` address.

The Pages website is static and can stay available independently of a laptop. This does **not** run the Node/yt-dlp Docker backend. Platform extraction endpoints require a separate server runtime; the frontend now explains this rather than pretending extraction is available. Direct media URLs (for example a public MP4/MP3 URL) can be opened/downloaded when the source host permits it.

Cloudflare Pages Git integration docs: https://developers.cloudflare.com/pages/get-started/git-integration/


## Cloudflare Worker runtime
The Cloudflare Worker entrypoint is `src/index.js`, configured by `wrangler.toml`. The Worker serves the static app from `public/` and exposes:
- `GET /api/health` — service health.
- `POST /api/download` — streams a public, direct media-file URL through the Worker to avoid browser CORS restrictions.

The direct-download endpoint accepts file URLs ending in common media extensions (MP4, WebM, MOV, MP3, M4A, AAC, WAV, OGG, FLAC), rejects local/private network destinations and non-media page URLs, validates redirects, and applies a 100 MB declared-size limit. It streams rather than buffering the media.

**Platform-page extraction is not included in the Cloudflare Worker.** Links to TikTok, Instagram, YouTube, Facebook, etc. are web pages rather than direct media files and require a separate extraction backend/runtime. The UI must not claim those downloads work until such a backend is deployed and tested. Download only content you own or have permission to save.


## V2–V5 release status
- V2 foundation: direct-media metadata endpoint, streamed download with a 100 MB cap, platform metadata/MP4/MP3 quality selection in the Node + yt-dlp backend.
- V3 foundation: local history, favorites, sequential batch queue and download progress in the browser.
- V4 foundation: browser-local image compression, text conversion, password generation and print-to-PDF.
- V5 foundation: local profile with optional photo and JSON backup/restore. Cloud account authentication and cross-device sync are intentionally not enabled until a database/auth provider is configured.
- Cloudflare Worker currently handles public direct-media file URLs. Platform-page extraction (TikTok, Instagram, YouTube, Facebook) is NOT active on the Worker-only deployment because no separate Node + yt-dlp backend is configured. The health endpoint reports this honestly as `platformExtraction: false`.



### Backend connection
The platform extractor is implemented in `server/index.js` and packaged by the existing Dockerfile (Node 20, yt-dlp, FFmpeg). Deploy that service on a Node/Docker host, then set the Cloudflare Worker environment variable `PLATFORM_API_ORIGIN` to the backend's HTTPS origin. The Worker proxies only allow-listed platform URLs to this backend. Without that environment variable, platform-page extraction correctly returns a not-connected message; do not represent it as live.

### Local account scope
The profile, favorites, history, and backup/restore currently use browser local storage. They are device-local, not cloud accounts and do not sync across browsers. Cross-device accounts require a configured auth/database service and explicit credentials/bindings.


## ARYANZZ V5 deployment (Cloudflare Worker)
- Production Worker name: `aryanzz-donwloader`.
- Expected public address: `https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/` (confirm in Cloudflare > Worker > Overview before sharing).
- The Worker serves `public/` through the `ASSETS` binding and exposes direct-media download endpoints.
- V2–V5 browser features are included in the static app: direct media download, local queue/history/favorites, image compression, text/PDF/QR/password tools, local profile/photo, and JSON backup/restore.
- Profile, history, and favorites remain local to each browser; no cloud account or cross-device sync is configured.
- Platform-page extraction is disabled until a compatible backend is hosted and its URL/token are configured. No paid host or card is assumed.
- After updating files on GitHub, deploy the latest `main` revision to the existing Cloudflare Worker to publish the new site at the same URL.
