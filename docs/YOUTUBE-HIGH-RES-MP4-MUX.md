# ARYANZZ YouTube high-resolution MP4 mux

## What this adds

- Native YouTube source choices from 144p through 4320p (8K), only when the source actually offers them.
- Direct progressive MP4 streams are passed through Cloudflare Workers as streams, with a 14 GiB safety cap. The Worker does not buffer the complete video in memory.
- Adaptive YouTube MP4 video-only streams are paired with M4A/AAC audio and remuxed with FFmpeg stream-copy.
- High-resolution WebM VP9/AV1 video-only streams can also be packaged as MP4. The original video is stream-copied without re-encoding; WebM Opus/Vorbis audio is converted to AAC for MP4 compatibility.
- FFprobe checks that both tracks exist and that the returned video height matches the selected resolution before a download ticket is issued.
- The FFmpeg process writes fragmented MP4 to stdout. Cloudflare streams it to the browser; the phone does not hold a multi-gigabyte video or audio buffer in RAM.

## Required Cloudflare plan

The adaptive high-resolution mux service uses Cloudflare Containers. Containers are available on the **Workers Paid** plan, not Workers Free. Container compute and network egress are metered. The service uses a standard-3 instance (2 vCPU, 8 GiB memory, 16 GB disk) and allows at most two instances.

Do not run the deployment workflow unless the account owner approves the Workers Paid plan and its usage charges. The ordinary ARYANZZ Worker deployment does not enable or start this container.

## One-time activation

1. Merge the high-resolution mux changes into main.
2. Confirm the Cloudflare account is on Workers Paid and the repository secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID have the required Workers/Containers deployment permissions.
3. Open GitHub Actions → Deploy ARYANZZ YouTube 2K-8K MP4 Mux → Run workflow.
4. Tick the confirmation that the account owner approves Workers Paid and metered usage, then run it.
5. The workflow deploys the isolated mux Worker, generates a random private token, and installs the token and mux URL as Cloudflare secrets on both Workers. The token is never committed to the repository.

The main Worker reports serverMuxReady: true at /api/youtube/status after activation.

## Limits and honest behavior

- The mux service accepts YouTube GoogleVideo MP4 + M4A/AAC or WebM VP9/AV1 + Opus/Vorbis pairs. WebM audio is converted to AAC; video remains untouched. Other containers/codecs use the existing supported path.
- 1440p, 2160p, and 4320p are never fabricated. If the requested height is absent, the app must show only a real available source quality.
- If YouTube blocks a stream, expires its signed URL, or withholds audio/video, the download can still fail. The app reports the provider error rather than returning a renamed or upscaled file.
- Direct streaming is capped at 14 GiB. The adaptive mux response is streamed and capped at 14 GiB by the container.
- Fragmented MP4 is used for streaming output; it remains an MP4 container and avoids loading the entire result into RAM.

## Local validation

Run the following commands:

    node --check src/index.js
    node --check src/youtube-mux-worker.js
    node --check mux-container/server.mjs
    node tests/youtube-mux-service-smoke.mjs
    node tests/media-quality-selection.mjs

The smoke test uses a fake FFmpeg process. It validates routing, URL allowlists, source-height checks, stream-copy arguments, and streamed response handling; it does not contact YouTube or prove that a particular private/restricted video is downloadable.
