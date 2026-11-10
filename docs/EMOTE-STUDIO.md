# ARYANZZ Emote Studio

## Local-only operation

Emote Studio does not use OpenAI, external image-generation APIs, API keys, or paid AI services. There is no AI generation endpoint.

- Manual image upload, canvas drawing, erasing, text, emoji, outline, PNG/WebP export, and sticker editing run in the visitor's browser.
- The local sticker library uses IndexedDB on the current browser/device. Clearing site data may remove saved stickers.
- GIF and MP4 encoding use FFmpeg WebAssembly loaded from jsDelivr with an unpkg fallback. The first encoder load therefore needs an internet connection.
- Video overlay and export run locally on the device; uploaded videos are not sent to an AI image service.

## Local limits

- Manual image input: 20 MB.
- Video overlay input: 35 MB and 60 seconds maximum.
- MP4 export records the composed video/sticker canvas where MediaRecorder capture is available; browsers without that capability use a direct FFmpeg overlay fallback.
- If the browser/encoder does not expose a compatible audio track, the fallback MP4 may be silent; the UI reports that condition.
- Low-memory phones may take longer to encode GIF/MP4. Shorter clips and smaller source videos are recommended.
