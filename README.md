# ARYANZZ V71.0 — Piped + Invidious Hybrid Downloader

Production website: https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/

ARYANZZ is a mobile-first creator workspace hosted on Cloudflare Workers. V71.0 uses a zero-private-server hybrid for YouTube: it queries public Piped and Invidious community APIs, then streams only supported progressive media formats through a validated Cloudflare Worker attachment endpoint. Direct media URLs remain supported. No Cobalt, SaveNow, Docker Desktop, private server, or paid extractor is used.

## V65.0 release scope

| Release stage | Scope |
| --- | --- |
| V30–V34 | Premium visual refresh, animated Tools Hub banner, responsive navigation and status indicators |
| V35–V39 | Unified downloader flow, self-hosted extraction route, expanded platform allowlist and download progress |
| V40–V44 | Local Video Editor: import, preview, trim start/end, crop ratios, rotation and playback speed |
| V45–V49 | Video filters, brightness/contrast/saturation, text overlays, mute and export controls |
| V50–V54 | Creator workspace integration, mobile layout, local-only editing and clearer feature states |
| V55–V59.5 | Backend health status, PWA cache refresh, expanded smoke tests and deployment configuration |
| V60.0 | Multi-clip timeline, split/reorder/trim, audio track, caption styling, fade transition, undo/redo, project JSON and local export |
| V65.0 | Premium wide editor workspace, three mixed audio tracks, per-clip zoom keyframes and pan, live/export chroma key, animated captions, SRT subtitle import and project restore |
| V66.0 | Music Finder: single-track recognition from local video/audio and microphone, plus local search history |
| V67.0 | AudD Enterprise multi-track DJ/video recognition |
| V67.1 | AudD provider error-code diagnostics |
| V67.2 | external backend for platform extraction; ShazamIO fallback for single-song recognition and multi-segment DJ scans when AudD quota/authentication fails |
| V67.4 | Premium mobile UI refresh, simplified downloader home, searchable Tools Center and Color Studio |
| V67.6 | Backend health cleanup, title-based YouTube search routed through yt-dlp, clearer AudD/Shazam status, and DJ scan fallback fixes |


## V67.6 — Title search and recognition reliability

- The downloader's **Cari judul** tab now queries YouTube through the configured external yt-dlp backend, displays up to eight results, and lets the user select a result to inspect downloadable formats. It does not use an extra search API key.
- Search accepts plain text only (2–160 characters), runs a fixed `ytsearch8` extractor query, and returns a limited metadata response. It does not fetch arbitrary user-supplied URLs through the search route.
- Music Finder status distinguishes an installed AudD token from the configured Shazam fallback. A configured token does not imply remaining AudD quota; AudD usage is still controlled by the provider.
- Shazam DJ fallback samples now honor the consecutive-sample setting and remain capped at 30 segments per scan to limit server load. AudD Enterprise can process up to 100 segments where the account permits it.
- Removed the duplicate Express health route so the backend reports one current version and a consistent feature list.

## V71.0 — Public API hybrid (current)

- YouTube metadata and stream discovery tries the current official Piped public-instance list first, then the official Invidious public-instance list.
- Piped endpoints return audio and video stream URLs; ARYANZZ only offers muxed MP4 video streams (videoOnly=false) and supported audio source formats. It does not advertise video-only DASH streams because that would require a media merger such as FFmpeg.
- Invidious fallback uses progressive MP4 formatStreams and audio-only MP4/WebM adaptiveFormats. No transcoding is performed, so MP3 and arbitrary bitrates are not promised.
- The Worker validates the provider/instance and stream host, forwards HTTP Range requests, and returns the media as an attachment for Chrome's download manager. The stream proxy rejects arbitrary external URLs.
- Provider instances are public community infrastructure. Their availability, rate limits, YouTube access, CORS-independent stream behavior, and geographic reach can change; ARYANZZ fails over and shows a clear unavailable state rather than claiming a successful download.
- TikTok extraction is intentionally disabled. Direct public media-file URLs continue to work.
- No API key, private extractor server, Cobalt, SaveNow, Docker Desktop, or paid hosting is required by this path.

## V70.1 — Initial zero-server release (historical)

V70.1 established the no-private-extractor hosting direction. Its original social-link handoff was superseded by the V71.0 YouTube hybrid described above. The current YouTube flow no longer uses the old Cobalt/SaveNow routes.

## V68.1 — External extraction server

The downloader now uses a separate Docker backend instead of Cloudflare Containers. Cloudflare Worker handles the website, URL validation and secure API proxy. The external server runs yt-dlp, FFmpeg and ShazamIO. The backend token stays in Cloudflare Worker secrets and is never sent to the browser.

This setup is intended for a Docker host such as Render. The repository already includes `Dockerfile` and `render.yaml`. Render's free service may sleep while idle and can have execution, bandwidth and resource limits; a paid always-on service may be needed for frequent or large downloads. Do not assume every platform URL will work.

### Music recognition fallback

- AudD remains the first provider when its token and quota are available.
- If AudD returns authentication/quota errors, the Worker can send the audio sample to the external server's ShazamIO endpoint.
- DJ/video multi-segment scans use AudD Enterprise first, then the external ShazamIO service as a fallback.
- ShazamIO is an open-source, reverse-engineered client for Shazam's recognition endpoint, not an official Shazam API. Availability and rate limits are controlled by the upstream service.

### Deployment

The GitHub Actions workflow deploys the Worker and static assets, then checks the external backend when its secrets are configured. It no longer builds or provisions Cloudflare Containers. If the backend secrets are missing, the website can deploy but platform extraction remains unavailable until the backend is connected.

`PLATFORM_API_ORIGIN` and `PLATFORM_API_TOKEN` must be configured as GitHub Actions repository secrets. The workflow syncs them to the Cloudflare Worker during deployment.

## Downloader — V71.0

- **YouTube:** query public Piped instances first and Invidious instances as fallback. The list is based on the projects' published public-instance directories.
- **Video:** only progressive/muxed MP4 streams are offered. Video-only DASH streams are intentionally omitted because combining them with audio requires a media merger.
- **Audio:** only source formats actually returned by the provider (currently M4A/WebM/OGG where available) are shown. ARYANZZ does not transcode to MP3 or invent bitrate options.
- **Download:** Cloudflare Worker validates the selected provider and stream host, forwards Range requests, and returns an attachment so Chrome can manage the file.
- **Direct media:** supported direct MP4, WebM, MOV, MP3, M4A and other allowlisted links continue to download through the Worker.
- **TikTok:** paused for this release; no external TikTok extractor is configured.

Public community instances are independently operated. A working metadata endpoint does not guarantee a downloadable stream. Instances can be unavailable, rate-limited, blocked from Cloudflare egress, or return no progressive format. The UI therefore disables download when no valid stream URL is found. This is a best-effort zero-cost path, not a guaranteed 24/7 download service.

## Self-hosted extraction backend setup (legacy; not used by V71.0)

The repository includes `Dockerfile` and `render.yaml` for a Docker host such as Render.

1. Create a Web Service from this repository and deploy the Docker runtime using `render.yaml`.
2. In the backend service environment, set `PLATFORM_API_TOKEN` to a long random secret. Keep it private.
3. After the service deploys, copy its HTTPS service URL, for example `https://your-service.onrender.com`.
4. In GitHub repository Settings → Secrets and variables → Actions, add:
   - `PLATFORM_API_ORIGIN`: the backend HTTPS origin from step 3.
   - `PLATFORM_API_TOKEN`: exactly the same secret configured in the backend.
5. Keep the existing `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` GitHub secrets. A push to `main` will sync the platform values to the Worker and deploy the site.

The Render service's `/api/health` endpoint is public for hosting health checks. Extraction routes require the bearer token. The Cloudflare Worker keeps that token server-side and does not expose it to the browser.

Until both platform secrets are configured and the backend is reachable, `/api/platform/status` reports that platform extraction is not connected. Direct media-file URLs still work.

The Render free plan may sleep when idle and may have CPU, memory, bandwidth and execution limits. A production service with frequent or large downloads may need a paid always-on host.

## Video Editor — Ultimate Creative Studio V65.0

The editor runs locally in the browser. Source media is not uploaded to ARYANZZ servers. The editor UI uses the ARYANZZ dark navy, blue, cyan and violet design system with a wider preview/timeline workspace and a sticky inspector on desktop.

### Video timeline
- Import up to 8 local video clips, each up to 300 MB.
- Preview, scrub, trim, split, reorder and delete clips.
- Undo/redo for timeline and editing settings.
- Export clips sequentially in timeline order.
- 16:9, 9:16, 1:1 and 4:5 canvas ratios; 720p or 1080p output canvas.
- 0.5× to 2× playback speed, rotation, color presets, brightness, contrast and saturation.

### Motion keyframes
- Per-clip start and end zoom values (100–200%).
- Per-clip horizontal and vertical pan offsets.
- Linear or smooth-ease interpolation between the two zoom keyframes.
- Motion settings are stored in the project JSON and rendered in preview/export.

### Audio layers
- Mix up to 3 local audio files (music, voice-over or sound effects).
- Independent volume slider and remove control for each audio track.
- Audio tracks loop to cover the exported timeline; original video audio can be muted.
- Audio mixing uses the browser Web Audio API. If a browser does not support it, multi-track audio is not included in export.

### Chroma key and text
- Green-screen/chroma key with a selectable key color, tolerance and solid replacement background color.
- Live chroma preview and export compositing use a canvas pixel-keying pass; this can be CPU-intensive, especially at 1080p on mobile devices.
- Caption text supports editable color, size, position and fade, slide-up or pop animation.
- Import SRT subtitles; cues are displayed according to their timestamps on the combined timeline and included in export.

### Export and project files
- Cut or fade-to-black clip transitions.
- Low/standard/high bitrate presets and browser-based MediaRecorder export.
- Chrome Android commonly exports WebM. MP4 is offered only when the browser supports it; the app does not transcode WebM to MP4.
- Save project JSON containing clip order, trim points, motion settings, editing settings, audio track names/volumes and subtitle cues.
- Reopen a project by selecting its JSON file together with the original video and audio files. Subtitle cues are embedded in the JSON.
- Project files do not embed the source video/audio media. Keep the original files and select them again when reopening.

### Current limitations
V65.0 is a lightweight local browser editor, not a full replacement for CapCut or Alight Motion. It still uses one sequential video track and up to three audio tracks. Motion editing currently provides two zoom keyframes plus a fixed pan offset per clip; it is not a general-purpose multi-property keyframe graph. Chroma key replaces the keyed area with a solid color, not a background image/video. Advanced multi-layer compositing, animated stickers, motion tracking, waveform editing, cloud project sync and guaranteed MP4 export are not included. Browser codec support, available memory and device performance determine practical file sizes and export speed.

## Music Finder — V67.0

Music Finder uses the AudD music-recognition API through the Cloudflare Worker. The browser never receives the provider token.

### Enable song recognition

1. Create an AudD account and obtain an API token from its dashboard.
2. In Cloudflare Dashboard → Workers & Pages → aryanzz-donwloader → Settings → Variables and Secrets, add a secret named `AUDD_API_TOKEN` with the token value. The secret must be attached to the production Worker that serves the ARYANZZ website.
3. Alternatively, add `AUDD_API_TOKEN` as a GitHub Actions repository secret. The deploy workflow syncs it to the Worker on the next deployment.
4. Refresh ARYANZZ. The `/api/music/status` endpoint should report `configured: true`.

### Standard Shazam-style recognition

- **Local video/audio:** upload a file and select the timestamp. The browser extracts a 12-second audio sample and sends only that sample to the standard AudD endpoint.
- **Microphone:** records up to 12 seconds after the visitor grants microphone permission.
- **Results:** title, artist, album, cover artwork where available, streaming links, and local search history.

### Remix and DJ recognition

AudD's fingerprinting can match altered recordings such as remixes, slowed/reverb, pitch shifts and edits, but a match is not guaranteed. For one song, use the 12-second standard mode. For a full DJ mix or video with multiple songs, use the Enterprise scan below.
### V67.1 — AudD authentication and quota diagnostics

The Worker now preserves AudD's numeric `error_code` in API responses without exposing the API token. Codes 901, 902, 900, 903, 904 and 905 receive separate user-facing explanations. In particular, 901 indicates that AudD did not receive/accept an API token or the no-token free limit was reached; 902 indicates that the account's token quota was exceeded. A present Cloudflare Secret only proves the Worker has a value; it does not prove AudD accepts that value.

The standard microphone recognition sends one short sample and costs one standard request. It does not use the Enterprise multi-segment scanner. Do not retry repeatedly after an authorization/quota error; check the AudD dashboard's token and Usage/Billing details first.

### Full video and DJ mix scanning — V67.0### Full video and DJ mix scanning — V67.0

The **Pindai seluruh video / DJ mix** actions use AudD Enterprise directly. Public video-page URLs are sent to AudD; the browser does not need the separate yt-dlp extractor for this recognition mode. Uploaded video/audio files are sent to the Worker and forwarded to AudD Enterprise (maximum 50 MB).

The enterprise endpoint returns multiple track matches with the offset in the submitted video/mix. The UI shows each detected track, artist, album, confidence score where available, and links to streaming/search services.

The scan density is configurable:
- **Hemat:** one 12-second sample every 120 seconds (`skip=9`, `every=1`).
- **Seimbang:** one 12-second sample every 60 seconds (`skip=4`, `every=1`).
- **Rapat:** one 12-second sample every 24 seconds (`skip=1`, `every=1`).
- **Detail:** one 12-second sample every 12 seconds (`skip=0`, `every=1`).

The scan is capped at 30, 60, or 100 sample chunks per request. AudD counts one Enterprise request per 12 seconds scanned; its docs currently advertise 300 free requests and plans starting at US$2 per 1,000 requests. A dense scan of a long DJ set can consume credits quickly. Review the current AudD dashboard pricing before using Detail mode. See [AudD Enterprise documentation](https://docs.audd.io/enterprise/).

The standard single-song and microphone modes still use the standard AudD endpoint and send only a short sample. The Worker keeps `AUDD_API_TOKEN` server-side; never put it in browser JavaScript or commit it to GitHub.

### Limits and privacy### Limits and privacy

- Maximum uploaded audio sample: 10 MB.
- Recognition sample: up to 12 seconds per request.
- The Worker keeps AUDD_API_TOKEN server-side and applies a best-effort per-IP limit of 8 recognition requests per minute per Worker isolate.
- ARYANZZ does not save uploaded or recorded audio. Audio samples are sent to AudD for recognition; review the provider's privacy and pricing terms before enabling the feature.
- AudD currently advertises 300 free signup requests; after that, its standard plan starts at US$5/month for 1,000 requests (pricing may change). Cloudflare hosting does not make the external recognition API free.
- Video URL recognition depends on the self-hosted yt-dlp/FFmpeg backend being online. Local uploads and microphone recognition do not require that extractor backend.
## Tools Hub

The home banner links to:
- Internet Speed Test (Wi-Fi and mobile data use the currently active device connection; browser APIs cannot reliably identify every network type).
- Website Checker.
- Smart Queue.
- All Tools, including library/history, image compressor, PDF/text tools, QR generator and password generator.

## Existing profile and privacy behavior

Profile details, profile images, visual presets, history and favorites remain stored in the current browser's local storage. They do not automatically synchronize between devices. Export a backup before clearing browser data.

## Development and deployment

- Frontend: `public/index.html`, `public/v15.css`, `public/v25.css`, `public/v59.css`
- Frontend logic: `public/v15.js`, `public/v25.js`, `public/v59.js`, `public/editor.js` and `public/editor-pro.css`, `public/downloader.js`
- Existing local tools/profile: `public/advanced.js`, `public/owner.js`
- Cloudflare Worker: `src/index.js`
- Self-hosted extraction service: `server/index.js`
- Docker image: `Dockerfile`
- Render blueprint: `render.yaml`
- PWA cache: `public/sw.js`
- Smoke tests: `tests/smoke.mjs`

Run the local backend with Node.js 20+, yt-dlp and FFmpeg installed:

```bash
npm install
PLATFORM_API_TOKEN="replace-with-a-long-random-secret" npm start
```

The API listens on port 3000 by default. Set `ALLOWED_ORIGINS` if browser clients need direct CORS access. When accessed through the Cloudflare Worker proxy, the backend token remains server-side.

## Legacy API note

V71.0 removes the old Cobalt and SaveNow YouTube endpoints. The active YouTube routes are `/api/youtube/info`, `/api/youtube/status`, and `/api/youtube/stream`. No provider key or private extractor is needed.

## V71.0 — Hybrid YouTube download

- Piped primary, Invidious fallback.
- Real available quality choices only; no fake 4K/MP3 selections.
- Chrome attachment download with HTTP Range forwarding.
- Public instance failover and clear unavailable state.
- TikTok remains disabled.
- No Cobalt, SaveNow, Docker Desktop, API key, private server, or paid hosting.

