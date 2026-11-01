# ARYANZZ V25 — Premium All-in-One

Production website: https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/

ARYANZZ is a dark, mobile-first media downloader and browser utility workspace. The existing GitHub `main` branch deploys to Cloudflare Workers with static assets.

## V16–V25 release scope

| Version | Improvements |
| --- | --- |
| V16 | Profile studio refresh: avatar, banner, editable bio and member overview |
| V17 | Personal background presets: Aurora, Ocean, Nebula and Midnight |
| V18 | Membership catalog with Basic, Pro and Elite tiers |
| V19 | Local profile dashboard: history, favorites and member-since summary |
| V20 | Profile image processing: resize/compress avatar, banner and background in browser |
| V21 | Backup/restore extended to include profile design, selected plan and theme |
| V22 | Motion design: animated ambient background, cover shine and reveal effects |
| V23 | Membership comparison, benefit summaries and local plan selection |
| V24 | Responsive layouts, keyboard/focus states and reduced-motion support |
| V25 | PWA cache refresh, version metadata and production health endpoint |

## Membership catalog

- **Basic — Rp36.000**: core tools, direct media downloader, speed test, local history/favorites, profile and local backup.
- **Pro — Rp88.000**: Basic benefits plus broader personalization, banner/background options, visual presets and early access to new tools.
- **Elite — Rp479.000**: Pro benefits plus Elite identity, exclusive visual presets and selected beta access.

**Payment status:** these prices and benefits are currently presented as a membership catalog. No payment gateway, subscription activation, recurring billing, or server-side entitlement enforcement is connected. Selecting a plan only stores the user's choice locally and does not charge them. Do not treat a selected plan as an active subscription.

## Profile and data

Profile text, images, selected visual preset, membership selection, history and favorites are stored in the current browser's local storage. Browser data is not automatically synchronized between devices. The backup file can be exported and restored manually.

Profile images are resized/compressed in the browser before saving. Large source images are limited to 15 MB.

## Downloader status

- Direct media-file URLs in supported formats are handled by the Cloudflare Worker.
- YouTube links are handled by the dedicated `/api/youtube/download` and `/api/youtube/progress` routes using the `SAVENOW_API_KEY` Worker secret.
- TikTok, Instagram, Facebook and other platform-page extraction still requires a separately hosted extraction backend configured with `PLATFORM_API_ORIGIN` and `PLATFORM_API_TOKEN`.
- The site does not bypass login walls, private content, DRM, or platform access restrictions. Only download content you own or are authorized to save.

## Development

- Frontend: `public/index.html`, `public/v15.css`, `public/v15.js`, `public/v25.css`, `public/v25.js`
- Profile/local utility integration: `public/advanced.js`
- Cloudflare Worker: `src/index.js`
- PWA cache: `public/sw.js`
- Deploy config: `wrangler.toml`
- Smoke tests: `tests/smoke.mjs`

The deployment workflow uses the existing GitHub repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
