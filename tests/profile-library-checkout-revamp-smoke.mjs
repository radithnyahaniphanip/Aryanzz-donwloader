import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL("../"+file, import.meta.url),"utf8");
const html=read("public/index.html");
const profile=read("public/v25.js");
const pCss=read("public/auth-profile-v1.css");
const library=read("public/workspace-library.js");
const lCss=read("public/workspace-library.css");
const membership=read("public/membership-ui.js");
const backend=read("src/membership-store.js");
for(const id of ["aryAccountOpen","accountLogout","profileName","profileBio","deviceGetLocation","deviceMapPanel","deviceMapFrame","deviceSpecGrid","deviceHistoryList","aryLibraryMediaFilter","aryLibrarySort","aryLibraryClearSearch","aryLibraryExport","aryLibraryImport"]){
  assert.ok(html.includes('id="'+id+'"'),"The responsive UI must preserve "+id);
}
const profileStart=html.indexOf('id="profile">');
const profileEnd=html.indexOf('id="owner">',profileStart);
assert.ok(profileStart>=0 && profileEnd>profileStart);
const profileView=html.slice(profileStart,profileEnd);
assert.doesNotMatch(profileView,/AKUN & IDENTITAS|Foto, akun, koleksi, dan privasi dalam satu tempat|ary-profile-shortcuts|ary-profile-data-status|Pustaka saya|Lihat Pustaka & Cadangan|Lokasi hanya diminta/i);
assert.ok(profileView.indexOf('id="aryAccountOpen"')>profileView.indexOf('id="deviceGetLocation"'),"Sign-in action must be placed below the location scanner");
assert.match(html,/class="ary-profile-device-details"/);
assert.match(html,/class="ary-library-advanced-backup"/);
assert.doesNotMatch(html,/Your library\s*[•·]\s*05/i);
const legacyFeatureJs=read("public/v677.js");
assert.doesNotMatch(legacyFeatureJs,/YOUR LIBRARY\s*[•·]\s*05|Riwayat & Favorit/,
  "Legacy V67 decorator must never inject the unwanted second Pustaka heading");
assert.doesNotMatch(legacyFeatureJs,/"queue","history","imageTools"/,
  "Pustaka should not be included in the legacy panel decorator");
assert.match(pCss,/#history\.ary-library-panel > \.v677-feature-hero\{display:none!important\}/,
  "Old PWA script leftovers cannot display the duplicate library banner");

assert.ok(profile.includes('navigator.permissions.query({name:"geolocation"})')&&profile.includes('permission.state!=="granted"')&&profile.includes('requestDeviceLocation()'),"Map must auto-load only when geolocation has been granted");
assert.ok(profile.includes('getCurrentPosition')&&profile.includes('renderLocationMap(item)'),"Manual scan and embedded map must still work");
assert.ok(library.includes('"aryLibraryMediaFilter"')&&library.includes('"aryLibrarySort"')&&library.includes('"aryLibraryClearSearch"'),"Library filters must remain functional");
assert.ok(library.includes('function mediaCategory(item)')&&library.includes('sort === "oldest"')&&library.includes('sort === "name"'),"All library filters and sort modes must remain functional");
assert.ok(library.includes('copyMediaLink')&&library.includes('Hapus satu riwayat')&&library.includes('Tambah atau hapus favorit'),"Library item actions must remain available");
assert.ok(lCss.includes(".ary-library-filter-row")&&lCss.includes(".ary-library-item-actions"),"Library filters must retain responsive styles");
assert.ok(pCss.includes(".ary-profile-signin-row")&&pCss.includes("max-width:1180px")&&pCss.includes('button[data-nav="history"] .nav-icon'),"Wide layout, login row and compact history icon must be styled");
assert.ok(html.lastIndexOf('/auth-profile-v1.css')>html.lastIndexOf('/arya-v2-refresh.css'),"Profile responsive overrides must load after legacy visual layers");
const navMarkup=html.match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||"";
assert.equal((navMarkup.match(/data-nav="/g)||[]).length,6,"There must be exactly six navigation buttons");
assert.match(pCss, /body nav\.nav\s*\{[\s\S]*?grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/,"The final mobile stylesheet must override five-column !important theme layouts");
assert.match(pCss, /@media\(max-width:899px\)/,"Six-item navigation should not override the desktop left rail");
assert.match(pCss, /@media\(min-width:900px\)/,"Desktop navigation must retain the vertical rail after mobile CSS");
assert.match(pCss, /body nav\.nav\s*\{[\s\S]*?display:flex!important/,"Desktop must use a vertical flex navigation");

assert.match(html, /id="membershipCheckoutSupport"/,"Merchant recovery link must be present in checkout");
assert.match(membership, /supportLink\.hidden = !\(merchantBlocked \|\| apiForbidden\)/,"Merchant support link should be visible for explicit blocks and generic 403 API denial");
assert.match(html, /href="https:\/\/airpaygateway\.site\/masuk"/,"Merchant recovery action must point to the official AirPay sign-in");

assert.ok(membership.includes("membershipCheckoutError")&&membership.includes("membershipQrLoading")&&membership.includes("membershipPaymentCountdown"),"Payment must retain genuine QR loading and a 10-minute checkout countdown");
assert.ok(backend.includes("AIRPAY_INVALID_API_KEY"),"Invalid AirPay credentials must remain blocked");
assert.ok(html.includes('id="membershipReceipt"'),"Verified receipts must remain available");
const wrangler=read("wrangler.toml");
const deployWorkflow=read(".github/workflows/deploy-cloudflare.yml");
assert.match(wrangler,/\[\[d1_databases\]\][\s\S]*?binding = "AUTH_DB"[\s\S]*?database_name = "aryanzz-auth-db"[\s\S]*?database_id = "[0-9a-f-]{36}"/i,
  "The existing Cloudflare D1 database must be declared as AUTH_DB in wrangler.toml");
assert.ok(deployWorkflow.includes('Using existing AUTH_DB binding from wrangler.toml.'),
  "Cloudflare deployment must reuse the declared binding instead of demanding a redundant GitHub Secret");

assert.match(pCss, /body #home>\.v89-welcome \.ary-v1-hero-title \.ary-v1-hero-line/,
  "Final stylesheet must prevent awkward word fragments in desktop hero");
assert.match(pCss, /white-space:nowrap!important/,
  "Desktop hero lines must remain whole words, rather than breaking inside 'berawal'");
assert.match(pCss, /body #home \.v674-download #aryWorkspaceHeadline/,
  "The 'Tempel tautan, mulai berkarya' headline must get desktop-specific typography");
assert.match(pCss, /repeat\(auto-fit,minmax\(104px,1fr\)\)/,
  "Platform icons and names must have balanced desktop card widths");
assert.match(pCss, /word-break:normal!important/,
  "Platform captions must avoid being broken into arbitrary character fragments");

assert.match(pCss,/body #profile \.ary-profile2-header\{[\s\S]*?padding:0 4px 0!important/,
  "Mobile Profil Saya title must have dedicated inset and vertical breathing room");
assert.match(pCss,/body #history\.ary-library-panel::before/,
  "Legacy injected Pustaka decoration must not duplicate the visible heading");
assert.match(pCss,/body #history \.ary-library-filter-row\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,
  "Pustaka filters must fit a mobile screen without overflowing");
assert.match(pCss,/body nav\.nav>button\{[\s\S]*?min-height:52px!important/,
  "All six mobile nav actions must keep consistent accessible tap targets");
// Desktop-site mode on Android retains the sidebar, but must not clip the
// Membership card rail; the same controls apply to all billing periods.
const desktopCss=read("public/desktop-workspace.css");
assert.ok(desktopCss.includes('body.arya-v2-enhanced .app-shell.wrap {') &&
  desktopCss.includes('width: calc(100% - var(--ary-desktop-rail) - 72px) !important;'),
  "Desktop-site mode must reserve enough viewport width for the left sidebar");
assert.ok(desktopCss.includes('body #membership #membershipPlans.ary-membership-plan-grid') &&
  desktopCss.includes('grid-auto-flow: column !important;') &&
  desktopCss.includes('grid-template-columns: none !important;') &&
  desktopCss.includes('overflow-x: auto !important;') &&
  desktopCss.includes('touch-action: pan-x pan-y;') &&
  desktopCss.includes('scroll-snap-type: x proximity;'),
  "Desktop membership plans must be horizontally scrollable by touch");
assert.ok(desktopCss.includes('@media (max-width: 899px)') &&
  desktopCss.includes('#membership .ary-membership-rail-controls { display: none !important; }'),
  "Default phone layout must not show irrelevant desktop rail buttons");
for (const id of ["membershipPlanNavigation","membershipPlanPrev","membershipPlanNext","membershipPlans"]) {
  assert.ok(html.includes('id="'+id+'"'), "Membership rail must keep "+id);
}
assert.match(html,/id="membershipPlans" tabindex="0" role="region"/,
  "The horizontal plan rail must be keyboard-focusable");
assert.ok(membership.includes('function syncPlanNavigation()') &&
  membership.includes('function movePlanRail(direction)') &&
  membership.includes('new ResizeObserver(syncPlanNavigation)') &&
  membership.includes('byId("membershipPlanPrev").addEventListener("click"') &&
  membership.includes('byId("membershipPlanNext").addEventListener("click"') &&
  membership.includes('byId("membershipPlans").scrollLeft = 0;'),
  "The arrows and rail must update on scroll, resize, and billing-period changes");
console.log("ARYANZZ Profile, Pustaka, geolocation and Membership responsive smoke test passed.");
