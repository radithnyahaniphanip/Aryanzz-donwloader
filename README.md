# ARYANZZ V71.1 — Piped + Invidious Hybrid Downloader

Production website: https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/

ARYANZZ is a mobile-first creator workspace hosted on Cloudflare Workers. V71.1 adds browser-first access to a zero-server design: direct media links are streamed by the Worker, while YouTube formats are discovered through public Piped and Invidious community instances. No Cobalt, Docker Desktop, private extraction server, or paid downloader provider is required.

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


## V71.2 — Invidious progressive MP4 format fix

- Fixes the browser parser to recognize Invidious progressive `formatStreams` MP4 records, including `type`/`mime_type`/`mime`, `qualityLabel`/`resolution`, and relative media URLs.
- Allows HTTPS media URLs on the exact active Piped/Invidious instance origin, while retaining the Googlevideo and community media-host allowlists. Download validation uses the selected provider instance.
- Video format controls are enabled only when actual progressive video streams are returned; MP3/M4A remains available independently.
- This does not convert adaptive video-only streams into MP4. Only already-muxed progressive MP4 is offered so audio and video remain together without a paid transcoding backend.

## V71.1 — Browser-first hybrid provider access

- The YouTube metadata lookup now tries official Piped community API instances directly from the user's browser first, then official Invidious public instances, before falling back to the Cloudflare Worker route. This provides an alternative path when the Worker network receives 401/403/5xx responses from community operators.
- Piped API origins are refreshed at runtime from the official TeamPiped public-instance directory (with a vetted snapshot fallback); Invidious origins use the currently listed official public instances.
- Instance checks run in small batches with request timeouts. Only actual progressive MP4 video streams (audio+video already muxed) and source audio formats returned by the instance are offered.
- The selected stream is fetched directly by the browser and saved as a Blob download with visible byte/progress feedback. This browser-side route is limited to 250 MB to avoid excessive mobile memory use. If CORS or network policy blocks the stream, ARYANZZ reports the failure rather than claiming a successful download.
- The existing Cloudflare attachment-stream endpoint remains as a fallback attempt. It still depends on the Worker being able to reach the selected media host.
- This remains a best-effort zero-cost design using third-party community instances. They may block requests, change domains, rate-limit, or stop operating. No guaranteed availability is claimed; the live CI probe must report whether the supplied test video currently returns formats.
- TikTok extraction remains disabled. No Cobalt, Docker Desktop, paid extraction API, or private server is introduced.

## V71.0 — Zero-cost Piped + Invidious hybrid YouTube

- Replaces Cobalt and SaveNow extraction routes with a no-key, no-paid-provider hybrid lookup using public Piped API instances first and the official Invidious public-instance list as fallback.
- Piped uses `GET /streams/:videoId`; Invidious uses `GET /api/v1/videos/:id`. The instance list is a curated snapshot of the upstream public directories and must be refreshed as instances change.
- Only progressive/muxed MP4 video streams are offered for video downloads. Video-only DASH streams are intentionally excluded because this Worker does not merge separate video/audio tracks.
- Audio streams are exposed only in their actual source container (for example M4A/WEBM/OPUS where returned); no transcoding or fabricated MP3 quality options are shown.
- The UI displays only formats actually returned by the working instance, and routes downloads through `/api/youtube/hybrid/file` as an attachment so Chrome can handle the file.
- The Worker validates stream hostnames against Googlevideo and the curated Piped proxy domains, follows only validated HTTPS redirects, forwards Range requests, and preserves partial-content responses.
- Piped is tried first; if no compatible formats are available from the configured public candidates, Invidious candidates are tried. If both fail, the app shows a preview/availability message and does not call a paid provider.
- TikTok extraction remains disabled in this release. Direct media file links continue to use the existing direct-download route.
- Public instances are third-party community services; availability, rate limits, privacy practices and quality can change. No uptime or download success is guaranteed.
- Use only content you own or are authorized to download. This implementation does not bypass DRM, access controls or private videos.

## V67.6 — Title search and recognition reliability

- The downloader's **Cari judul** tab now queries YouTube through the configured external yt-dlp backend, displays up to eight results, and lets the user select a result to inspect downloadable formats. It does not use an extra search API key.
- Search accepts plain text only (2–160 characters), runs a fixed `ytsearch8` extractor query, and returns a limited metadata response. It does not fetch arbitrary user-supplied URLs through the search route.
- Music Finder status distinguishes an installed AudD token from the configured Shazam fallback. A configured token does not imply remaining AudD quota; AudD usage is still controlled by the provider.
- Shazam DJ fallback samples now honor the consecutive-sample setting and remain capped at 30 segments per scan to limit server load. AudD Enterprise can process up to 100 segments where the account permits it.
- Removed the duplicate Express health route so the backend reports one current version and a consistent feature list.

## V70.0 — YouTube flow and TikTok diagnostics

- YouTube URLs now use the dedicated `/api/youtube/info`, `/api/youtube/download`, `/api/youtube/progress`, and `/api/youtube/file` endpoints rather than the generic direct-file endpoint.
- If no downloader provider key is configured, the Worker attempts a public YouTube oEmbed preview and clearly marks downloading as unavailable. It does not silently configure or charge a third-party provider.
- If a provider key is explicitly configured by the owner, the UI can start a job, poll progress, and stream the completed file through the Worker.
- TikTok short URLs remain on the community-provider handoff path in the zero-server edition. A post URL is not the same as a direct MP4 file URL.
- The supplied test links could not be fetched by the web inspection tool in this environment, so no claim is made that either real-world download succeeded. Automated tests use mocked provider responses and validate routing only.

## V70.1 — Zero-server Free Edition

ARYANZZ V70.1 removes the requirement for a self-hosted extraction server. Cloudflare Workers continues to host the website and handles direct media URLs only. No Render, Railway, VPS, Docker host, paid extractor, or private server is required.

### Download behavior

- **Direct media URLs:** supported media file links (for example MP4, WebM, MP3, M4A, WAV and other allowlisted formats) can be inspected and streamed through the Cloudflare Worker to the browser. Source host CORS does not apply to the server-side Worker fetch, but source host access controls, redirects, and anti-hotlink rules can still prevent a download.
- **Social-media URLs:** ARYANZZ detects the platform and provides a handoff to the Cobalt community-instance directory. The user selects a currently active community frontend and pastes the same link there. ARYANZZ does not proxy community APIs or pretend those services are guaranteed. Instance owners control availability, supported platforms, rate limits, and privacy policies.
- **Search by title:** works without an extractor by opening YouTube's own search results. The user copies the chosen video URL back into the Link URL tab.
- **History and favorites:** remain local in the user's browser.

### Important limitations

There is no reliable, permissionless, permanently free public API that ARYANZZ can use to extract every social-media platform from inside its own interface. Cobalt's public API documentation says there is no generally available pre-hosted API and hosted instances should only be used with permission. Community instances are independently operated and can go offline, require a challenge, or limit usage. Therefore social-media downloads are a community-provider handoff, not native one-click downloads inside ARYANZZ.

Cloudflare Workers Free currently provides 100,000 requests/day, 10 ms CPU time per invocation, and 50 external subrequests per invocation. It is suitable for lightweight URL validation and proxying direct media streams, not running yt-dlp/FFmpeg extraction itself.

### Privacy and safety

- ARYANZZ does not store downloaded media on its own server.
- Do not paste private links, login cookies, or account credentials into third-party community providers.
- Download only content you own or are authorized to save.
- Provider availability and supported formats can change at any time.

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

## Downloader

The current frontend uses the self-hosted API routes `/api/info` and `/api/download`. It no longer uses the SaveNow wallet flow for the main downloader UI.

The backend is powered by yt-dlp and FFmpeg. The current allowlist includes YouTube, TikTok, Instagram, Threads, Facebook, Pinterest, X/Twitter, Reddit, Vimeo, Dailymotion, SoundCloud, Twitch, Streamable, Tumblr, Bilibili, VK, OK.ru, Rutube, Likee, Snapchat, Imgur, Bandcamp, Mixcloud, TED, Internet Archive, Loom, Rumble, Odysee, Weibo and Xiaohongshu.

**This is broad platform support, not a promise that every URL will work.** Availability depends on the platform's current extractor, public access, region, age/login restrictions and source changes. Private pages, DRM, login walls and access controls are not bypassed. Only download media you own or are authorized to save.

Direct media URLs remain supported by the Cloudflare Worker without the extraction server when the URL points to a supported media file extension.

## Self-hosted extraction backend setup

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

The older `/api/youtube/*` SaveNow endpoints remain in the Worker for backward compatibility with older clients. The V59.5 downloader page does not call those endpoints; the primary downloader uses the self-hosted yt-dlp backend. The editor UI is V60.0.


## V70.1 — Native Chrome Download Studio

- Direct media URLs now use a GET attachment endpoint so Chrome/Android receives a normal browser download instead of buffering the entire file in page JavaScript.
- Completed YouTube jobs, when an explicitly enabled provider is available, are handed to Chrome through the attachment endpoint; the browser handles download progress.
- Paid SaveNow extraction is disabled by default. It requires the explicit Worker flag `ALLOW_PAID_YOUTUBE_PROVIDER=true`; the deployment does not set this flag. This prevents accidental balance use.
- YouTube metadata preview remains available via oEmbed. When no free extractor is configured, format choices are visible but the Download button is disabled with an honest explanation.
- TikTok extraction/community routing is paused in this release to focus on YouTube and direct media files.
- Formats offered by the UI are not a guarantee of source availability; actual resolutions depend on the extractor and source.
