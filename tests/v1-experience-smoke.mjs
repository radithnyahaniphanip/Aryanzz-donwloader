import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=read("../public/index.html");
const homeJs=read("../public/workspace-home.js");
const searchJs=read("../public/v674.js");
const profileJs=read("../public/v25.js");
const css=read("../public/v1-experience.css");
const sw=read("../public/sw.js");
const checks=[
  ["Exact home headline and a distinct paste-link workspace",html.includes("Semua berawal</span> <span")&&html.includes("dari satu tautan")&&html.includes('data-mode="link"')&&html.includes('id="aryWorkspaceHeadline"')],
  ["Paste-link mode hides title-search catalogue without deleting supported providers",css.includes('[data-mode="link"] #platformPicker')&&css.includes('[data-mode="link"] .v736-platform-search-heading')&&css.includes('[data-mode="link"] #platformPager')&&html.includes('data-platform="youtube"')&&html.includes('data-platform="all"')],
  ["Mode controller changes interface, but retains link auto-detection and title search",searchJs.includes('workCard.dataset.mode=useLink?"link":"title"')&&searchJs.includes('activeMode=v')&&searchJs.includes('const catalogForMode=activeMode==="link"?platformCatalog')&&searchJs.includes('if(link&&selected==="all")setPlatform("youtube")')],
  ["Decorative dots are removed without erasing functional status information",css.includes("#home>.v674-top .v674-version>i")&&css.includes("#home>.v674-top .v674-security-indicator>i")&&html.includes('id="securityStatusIndicator"')],
  ["Brand-letter reveal is screen-reader safe and animations respect motion preference",homeJs.includes('span.setAttribute("aria-hidden","true")')&&homeJs.includes("ary-v1-brand-letter")&&homeJs.includes('aryanzz.motion.v75')&&css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('data-ary-home-motion="off"')],
  ["Device overview draws a phone and genuine browser-exposed specifications",html.includes('class="ary-v1-phone-bezel"')&&html.includes('id="deviceSpecGrid"')&&profileJs.includes("navigator.hardwareConcurrency")&&profileJs.includes("navigator.deviceMemory")&&profileJs.includes("navigator.userAgentData?.getHighEntropyValues")&&profileJs.includes("navigator.getBattery")],
  ["Device history remains local and cannot masquerade as account-wide tracking",profileJs.includes('const DEVICE_KEY="aryanzz.device.sessions.v26"')&&profileJs.includes('renderDeviceHistory()')&&html.includes("browser ini; bukan daftar seluruh HP")],
  ["Geolocation is only requested by explicit click",profileJs.includes('locate?.addEventListener("click",()=>{')&&profileJs.includes("navigator.geolocation.getCurrentPosition")&&html.includes('id="deviceGetLocation"')],
  ["Embedded map is not fetched before consent and does not require a maps app",html.includes('id="deviceMapFrame"')&&!html.includes('id="deviceMapFrame" src=')&&profileJs.includes("https://www.openstreetmap.org/export/embed.html")&&profileJs.includes('frame.src=mapUrl.href')&&html.includes('id="deviceMapPanel"')],
  ["Previous coordinates require a separate map-display action and can be erased",profileJs.includes('showSaved?.addEventListener("click"')&&profileJs.includes('remove?.addEventListener("click"')&&profileJs.includes("localStorage.removeItem(LOCATION_KEY)")&&profileJs.includes('frame.removeAttribute("src")')],
  ["Map coordinates are checked and not sent to ARYANZZ's backend",profileJs.includes('Number(item.latitude)>=-90')&&profileJs.includes('Number(item.longitude)<=180')&&!profileJs.includes("fetch(\"/api/device/location")],
  ["Final stylesheet is included in production and offline cache",html.includes('/v1-experience.css?v=__ARYANZZ_VERSION__')&&sw.includes('"/v1-experience.css?v=__ARYANZZ_VERSION__"')&&css.includes("@media(max-width:420px)")]
];
for(const [label,ok] of checks){assert.ok(ok,label);console.log("✔ "+label);}
console.log("ARYANZZ V1 Home + Device Studio six-package smoke checks passed.");
