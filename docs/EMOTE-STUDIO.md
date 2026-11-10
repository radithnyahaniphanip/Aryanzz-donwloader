# ARYANZZ Emote Studio

## AI image service setup

The AI creator uses the OpenAI Images API from the Cloudflare Worker. The API key is read only from the Worker secret OPENAI_API_KEY; it is never sent to the browser or stored in source control.

Set the secret on the production Worker:

```bash
npx wrangler secret put OPENAI_API_KEY --name aryanzz-donwloader
```

Alternatively, use Cloudflare Dashboard → Workers & Pages → aryanzz-donwloader → Settings → Variables and Secrets → Add → Secret, with the name OPENAI_API_KEY.

Optional model override: ARYANZZ_EMOTE_MODEL as a Worker variable. Supported values are gpt-image-2.5-sunburst, gpt-image-2.5-flare, gpt-image-2.6-sunburst, or gpt-image-2.6-flare. Default: gpt-image-2.5-sunburst.

AI requests are paid API usage. No image is generated automatically: a visitor must explicitly press Generate Karakter. Do not expose the secret in HTML, JavaScript, public variables, or a client-side request.

## Privacy and processing

- Manual drawing, erasing, text, emoji, outline, PNG/WebP export, GIF encoding, and video overlay are processed in the visitor's browser.
- When AI is explicitly used, the selected prompt and (for photo mode) reference image are sent from the Worker to the configured image provider.
- The local sticker library uses IndexedDB on the current browser/device. Clearing site data may remove saved stickers.
- FFmpeg WebAssembly is loaded from jsDelivr with an unpkg fallback when GIF/MP4 encoding is requested. The first encoder load therefore needs an internet connection.

## Local limits

- AI reference photo: 8 MB, PNG/JPEG/WEBP.
- Manual image input: 20 MB.
- Video overlay input: 35 MB and 60 seconds maximum.
- MP4 export records the composed video/sticker canvas where MediaRecorder capture is available; browsers without that capability use a direct FFmpeg overlay fallback. If the browser/encoder does not expose a compatible audio track, the fallback MP4 may be silent; the UI reports that condition.
- Low-memory phones may take longer to encode GIF/MP4. Shorter clips and smaller source videos are recommended.
