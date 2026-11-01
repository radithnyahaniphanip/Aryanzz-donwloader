# ARYANZZ V15 — All-in-One Web Tools

Dark, mobile-first web utility workspace. The production app remains deployed from the **existing GitHub `main` branch** to **Cloudflare Workers**.

**Production URL:** https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/

## What is actually implemented (V7–V15)

| Milestone | Shipped capability |
| --- | --- |
| V7 | Four selectable accent themes with persistent browser settings |
| V8 | Searchable tool hub and category filters |
| V9 | Downloader UX refresh: file metadata, original-format selection, progress, cancellation, favorites |
| V10 | Local image studio: PNG/JPEG/WebP conversion, resize, original-dimension option |
| V11 | QR input character counter and improved tool organization (QR generation still depends on its CDN library) |
| V12 | Live text statistics and JSON format/minify tools |
| V13 | Searchable local library, history/favorites counters and safe source links |
| V14 | Motion toggle, share website, local profile preferences |
| V15 | Mobile navigation, keyboard shortcuts, PWA shell caching, accessibility and responsive polish |

Additional existing V2–V6 functions are retained: direct-media file downloading, queued downloads, favorites, history, local profile/photos, backup/restore, browser-local image compression, PDF print workflow, QR, text tools, password generator, internet speed estimate, URL checker, and experimental camera lab.

### Real downloader scope

The Cloudflare Worker handles publicly accessible **direct-file links** ending in supported extensions: MP4, WebM, MOV, M4V, MP3, M4A, AAC, WAV, OGG, OGA, and FLAC. It checks remote metadata where permitted, streams files up to a configured 100 MB cap, and may fail when the source host denies access or redirects incompatibly. The frontend does **not** claim to transcode direct files.

A YouTube/TikTok/Instagram/Facebook/Pinterest *page link* is **not** equivalent to a direct media file. Platform-page extraction depends on the separate **Node.js + yt-dlp + FFmpeg** backend in `server/index.js`, deployed elsewhere with `PLATFORM_API_ORIGIN` and `PLATFORM_API_TOKEN` configured as Cloudflare Worker secrets. **That backend is not presently deployed**. The Worker health endpoint reports whether the environment is configured, but configuration alone does not prove the extraction service works. No free 24/7 backend is promised.

Only download media you own or are authorized to download. Some services prohibit extraction and DRM-protected media are unsupported.

### Privacy and persistence

User profile/photo, theme preferences, downloaded-link history, favorites, and app backups are browser-local. They are **not cross-device accounts**. Browser storage may be cleared. Backup/restore exports JSON for manual transfer. Image conversion, text formatting, and password generation are browser-local. QR generation loads a script from cdnjs when first requested, so first-time offline QR generation is not assured.

### Deployment

The repo already includes `.github/workflows/deploy-cloudflare.yml` and `wrangler.toml`. GitHub Actions deploys pushes on `main` using repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. **Do not commit secrets**. The server remains unchanged on Cloudflare Worker-only hosting.

```sh
npm install -g wrangler
wrangler deploy
```

Local UI can also be served from `public/` with a static file server, but /api/ endpoints require the Cloudflare Worker runtime. The optional Node extraction backend uses `npm start` and Dockerfile dependencies.

## Verification

GitHub Actions runs `node --check` for all JavaScript and `node tests/smoke.mjs` for static UI checks and Worker API safety checks. A successful CI/deployment result confirms code publication; individual third-party media downloads still depend on the source and should be tested separately.
