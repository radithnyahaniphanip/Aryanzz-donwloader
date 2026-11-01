# ARYANZZ V60.0 — Creator Studio Pro

Production website: https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/

ARYANZZ is a mobile-first creator workspace. The Cloudflare Worker serves the website and safely proxies supported platform requests to a separate Docker backend running yt-dlp and FFmpeg.

## V60.0 release scope

| Release stage | Scope |
| --- | --- |
| V30–V34 | Premium visual refresh, animated Tools Hub banner, responsive navigation and status indicators |
| V35–V39 | Unified downloader flow, self-hosted extraction route, expanded platform allowlist and download progress |
| V40–V44 | Local Video Editor: import, preview, trim start/end, crop ratios, rotation and playback speed |
| V45–V49 | Video filters, brightness/contrast/saturation, text overlays, mute and export controls |
| V50–V54 | Creator workspace integration, mobile layout, local-only editing and clearer feature states |
| V55–V59.5 | Backend health status, PWA cache refresh, expanded smoke tests and deployment configuration |
| V60.0 | Multi-clip timeline, split/reorder/trim, music track, caption styling, fade transition, undo/redo, project JSON and local export |

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

## Video Editor — Creative Studio Pro V60.0

The editor runs locally in the browser. Source media is not uploaded to ARYANZZ servers.

### Timeline and clips
- Import up to 8 local video clips, each up to 300 MB.
- Preview the selected clip and scrub its playhead.
- Trim the in/out points of each clip independently.
- Split the selected clip at the preview playhead.
- Reorder clips, remove clips, and undo/redo timeline changes.
- Export plays clips sequentially in timeline order.

### Audio and captions
- Add one local background music file (up to 300 MB).
- Adjust background music volume.
- Optionally mute the original audio from the video clips.
- Add a caption overlay with editable text, color, size and placement.

### Image treatment and export
- 16:9, 9:16, 1:1 and 4:5 canvas ratios.
- 90°, 180° and 270° rotation.
- 0.5× to 2× playback speed.
- Original, vivid, cinematic, monochrome, warm and cool presets.
- Brightness, contrast and saturation adjustments.
- Cut or fade-to-black transition between clips.
- 720p or 1080p canvas and low/standard/high bitrate presets.
- Browser-based MediaRecorder export, usually WebM in Chrome Android; MP4 is offered only when supported by the browser.

### Project files
- Save a project as JSON with clip order, trim points and editing settings.
- Reopen a project by selecting the project JSON together with its original source videos (and optional music file).
- The project JSON does not contain the video/audio media itself; keep the original source files.

### Current limitations
V60.0 is a lightweight local editor, not a complete replacement for CapCut or Alight Motion. It currently has one video track arranged as sequential clips and one background music track. It does not yet include keyframes, multi-layer overlays, multiple audio tracks, animated stickers, motion tracking, advanced transitions, cloud project sync or guaranteed MP4 export. Browser memory, codec support and device performance determine practical file sizes and export speed.

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
