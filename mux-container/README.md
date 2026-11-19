# ARYANZZ Universal MP4 Mux (external Docker/VPS)

This service moves FFmpeg work off the user's phone and off Cloudflare Workers. The ARYANZZ Worker remains the website/API gateway; this isolated Node.js + FFmpeg service runs on a Docker-capable VPS or container host.

## What it does

- Accepts verified public media stream URLs from ARYANZZ only.
- Supports progressive files and separate video/audio tracks.
- Accepts MP4, M4V, WebM, MOV, AVI, 3GP, FLV, MKV, TS, MPG, MPEG and WMV video sources.
- Accepts M4A, AAC, MP3, Opus, OGG, WAV and FLAC audio sources.
- Produces a real MP4 container. Compatible video codecs are stream-copied; incompatible codecs are converted to H.264. Audio is copied when AAC is already compatible or converted to AAC.
- Preserves source dimensions. It does not invent 2K/4K/8K by upscaling.
- Streams the result directly to the Worker; it does not save the finished video to disk.
- Requires a private Bearer token for both /probe and /mux. /health is public and reports only whether authentication is configured.

The browser-based FFmpeg path remains as a fallback for smaller files when this server is not configured or cannot access a particular CDN.

## Deploy on a VPS

Use Ubuntu/Debian or another host with Docker Engine and Docker Compose. A VPS is not required to be from Cloudflare; any Docker host with sufficient CPU, RAM and outbound bandwidth can run this service.

1. Copy this `mux-container` directory to the VPS.
2. Create the environment file:

   ```bash
   cp .env.example .env
   ```

3. Generate a strong token and place it in `.env` as `MUX_TOKEN`:

   ```bash
   openssl rand -hex 32
   ```

4. Start the service:

   ```bash
   docker compose up -d --build
   docker compose logs -f media-mux
   ```

5. Check the service:

   ```bash
   curl https://YOUR-MUX-DOMAIN/health
   ```

   The response must contain `"ok":true` and `"authConfigured":true`. Put the service behind HTTPS using the VPS provider's reverse proxy or a TLS proxy such as Caddy. Do not expose port 8080 directly to the public internet without HTTPS.

6. Configure the ARYANZZ Worker secrets. The URL must be the HTTPS origin only, with no path or trailing endpoint:

   ```bash
   npx wrangler secret put MEDIA_MUX_URL
   npx wrangler secret put MEDIA_MUX_TOKEN
   ```

   Set `MEDIA_MUX_URL` to `https://YOUR-MUX-DOMAIN`. Set `MEDIA_MUX_TOKEN` to the exact same secret as `MUX_TOKEN` on the VPS. Redeploy the ARYANZZ Worker after configuring secrets.

## Railway / Fly.io / other container hosts

Build from `mux-container/Dockerfile`, expose port `8080`, and set:

- `PORT=8080`
- `MUX_TOKEN` to a long random secret
- `MUX_ALLOWED_HOSTS` only if additional verified CDN domains are needed

Then configure the same `MEDIA_MUX_URL` and `MEDIA_MUX_TOKEN` Worker secrets described above. The host must allow long-lived streaming HTTP responses and enough outbound bandwidth for the selected media.

## CDN allowlist

The service uses an explicit media-host allowlist to prevent it becoming an open URL-fetching proxy. Common public CDN roots for Instagram/Facebook, TikTok, X, Reddit, Vimeo, Pinterest, Threads, Kwai/SnackVideo and CapCut are included. If a platform changes its CDN hostname, add the verified suffix to `MUX_ALLOWED_HOSTS` on the VPS **and** add it to `SOCIAL_MUX_MEDIA_ROOTS` in `src/index.js`, then redeploy both services. Do not add broad wildcards such as `com`, `net`, or arbitrary user-provided domains.

## Important limitations

- The platform must expose a public, downloadable media stream. Private posts, deleted posts, DRM-protected media, expiring links that have already expired, and platform login challenges cannot be bypassed.
- A live broadcast can only be downloaded when the platform exposes a public DVR/archive or completed recording. An active live stream without an accessible recording is not a finished MP4 file.
- A photo carousel can be rendered as a slideshow MP4 by the browser feature, but that slideshow does not automatically contain the original post's music/audio.
- High-resolution encoding needs more CPU and RAM than stream-copy. 4K/8K jobs can be resource-intensive; size the VPS and bandwidth accordingly.
- The service processes one FFmpeg job at a time to protect the host. Additional jobs receive HTTP 429 and can be retried.
