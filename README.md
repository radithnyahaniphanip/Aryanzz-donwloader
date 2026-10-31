# ARYANZZ Downloader

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
