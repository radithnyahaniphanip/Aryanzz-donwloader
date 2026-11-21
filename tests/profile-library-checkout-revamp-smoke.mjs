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
for(const id of ["aryProfileDeviceJump","aryProfileStorageNotice","profileName","profileBio","deviceSpecGrid","deviceHistoryList","aryLibraryMediaFilter","aryLibrarySort","aryLibraryClearSearch","aryLibraryExport","aryLibraryImport"]) {
  assert.ok(html.includes('id="'+id+'"'),"The revised UI must keep the functional control "+id);
}
assert.match(html,/class="ary-profile-device-details"/);
assert.match(html,/class="ary-library-advanced-backup"/);
assert.ok(profile.includes('"aryProfileDeviceJump"')&&profile.includes("scrollIntoView"),"Device shortcut must scroll to the profile device panel");
assert.ok(library.includes('"aryLibraryMediaFilter"')&&library.includes('"aryLibrarySort"')&&library.includes('"aryLibraryClearSearch"'),"Library filters must be wired to actual sorting and search behavior");
assert.ok(library.includes('function mediaCategory(item)')&&library.includes('sort === "oldest"')&&library.includes('sort === "name"'),"All requested media filters and sort modes must be functional");
assert.ok(library.includes('copyMediaLink')&&library.includes('Hapus satu riwayat')&&library.includes('Tambah atau hapus favorit'),"Items must support copy, removal and favorites");
assert.ok(lCss.includes(".ary-library-filter-row")&&lCss.includes(".ary-library-item-actions"),"Library controls must have responsive styling");
assert.ok(pCss.includes(".ary-profile-shortcuts")&&pCss.includes(".ary-profile-device-details"),"Profile revamp must be mobile responsive");
assert.ok(membership.includes("membershipCheckoutError")&&membership.includes("membershipQrLoading")&&membership.includes("membershipPaymentCountdown"),"Payment must expose QR loading, error and 10-minute timer");
assert.ok(backend.includes("AIRPAY_INVALID_API_KEY"),"An invalid AirPay credential must be reported with a stable error code");
assert.ok(html.includes('id="membershipReceipt"'),"Verified receipts must remain accessible");
console.log("ARYANZZ Profile, Pustaka and AirPay responsive revamp smoke test passed.");
