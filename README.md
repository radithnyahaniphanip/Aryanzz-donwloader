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