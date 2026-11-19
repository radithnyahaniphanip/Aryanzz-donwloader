# ARYANZZ Universal MP4 Mux — external Docker host

The FFmpeg service does **not** have to run on Cloudflare Workers or Cloudflare Containers. It is a small Node.js + FFmpeg HTTP service and can run on any Docker-capable VPS or container host. The ARYANZZ Worker remains the public API gateway; it sends a short-lived signed job to this private mux service and streams the MP4 response back to the browser.

## What this service does

- Joins separate video and audio tracks into one MP4.
- Keeps the source video codec and resolution when the codec is MP4-compatible; it does not upscale 360p into fake 2K/8K.
- Converts audio to AAC when the source audio codec cannot be stored in a broadly compatible MP4.
- Streams the MP4 response instead of saving multi-gigabyte media files to disk or loading them into a phone's RAM.
- Validates the source CDN hostname, media extensions, stream codecs, and actual source resolution before creating a download.
- Allows one active mux job at a time to avoid overloading a small VPS.

This service only processes public media URLs returned by ARYANZZ's extractors. It cannot guarantee access to private posts, login-only media, DRM-protected streams, expired links, deleted posts, or streams blocked by a platform or region. A platform is supported only when its public extractor returns a usable direct media URL and the CDN hostname is allowed.

## Recommended host

Use a Docker-capable Linux VPS with a public IP, a domain name, HTTPS, and enough CPU/RAM for FFmpeg. For high-resolution sources, start with at least 2 vCPU and 4 GB RAM. Video stream-copy is preferred; a codec that requires video transcoding can take considerably longer, especially at 4K/8K. The service intentionally processes one job at a time.

You can use a VPS provider of your choice. Cloudflare Containers are optional, not required. A generic managed Docker host also works if it provides a stable HTTPS URL and permits long-running streaming responses.

## Deploy on a VPS with Docker Compose

1. Point a subdomain such as `mux.example.com` to the VPS public IP (A/AAAA record).
2. Install Docker Engine and the Docker Compose plugin.
3. Copy this repository's `mux-container` directory to the server.
4. In that directory, create the environment file:

   ```bash
   cp .env.example .env
   openssl rand -hex 32
   ```

5. Edit `.env`:
   - Set `MUX_DOMAIN` to the subdomain pointing to the VPS.
   - Set `MUX_TOKEN` to the random 64-character hex secret generated above.
   - Leave `MUX_ALLOWED_HOSTS` empty unless a verified provider CDN is missing from the built-in allowlist.

6. Start the service:

   ```bash
   docker compose up -d --build
   docker compose logs -f media-mux
   ```

7. Confirm the public health endpoint returns JSON with `ok: true`, `ffmpeg: true`, and `authConfigured: true`:

   ```bash
   curl https://mux.example.com/health
   ```

Caddy automatically obtains and renews the HTTPS certificate. Keep ports 80 and 443 open. Do not expose port 8080 publicly; Compose only exposes it to the private Docker network.

## Connect the mux host to ARYANZZ

In the GitHub repository settings, add these **Actions secrets**:

- `MEDIA_MUX_URL`: the HTTPS origin only, for example `https://mux.example.com` (no path, port, query, or trailing endpoint).
- `MEDIA_MUX_TOKEN`: exactly the same secret as `MUX_TOKEN` on the VPS.

Then run the normal ARYANZZ production deployment workflow. Its optional mux-secret sync step writes these values to the Cloudflare Worker. The Worker code accepts `MEDIA_MUX_URL`/`MEDIA_MUX_TOKEN`; legacy `YOUTUBE_MUX_URL`/`YOUTUBE_MUX_TOKEN` values remain supported.

The browser never receives the mux token. Only the Worker talks to the mux host using the Bearer token and a signed, short-lived job ticket.

## Optional extra CDN domains

The Worker and the mux server each validate CDN hosts. If a verified public media CDN is not already in the built-in allowlist, add the exact parent domain suffix to both:

- GitHub Actions variable `MEDIA_MUX_ALLOWED_HOSTS` for the Worker, comma-separated.
- `MUX_ALLOWED_HOSTS` in the mux host's `.env`, comma-separated.

Do not add broad domains such as `com`, `net`, or `cloudfront.net`. Only add a specific provider CDN domain after checking that it serves the media URL expected by the extractor.

## Security and operational notes

- Keep `.env` private and never commit it.
- Rotate `MUX_TOKEN` on both sides together if it is exposed.
- Keep the mux host behind HTTPS. Do not disable host validation or Bearer authentication.
- Monitor CPU, memory, network egress, and provider rate limits.
- A 14 GB output safety cap is enforced. Provider source URLs may expire; the mux ticket is short-lived.
- Large downloads still depend on the user's connection and available device storage. A weak connection can be slow, but the server avoids the browser-side multi-GB memory merge.
