import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const server=read("../src/index.js");
const downloader=read("../public/downloader.js");
const search=read("../public/v674.js");
const network=read("../public/network-mode.js");
const html=read("../public/index.html");
const checks=[
 ["Fast link inspection is opt-in at the backend and deep fallback remains available",server.includes('fast:body?.fast===true')&&server.includes('const fast=options.fast===true')&&server.includes('fast?5500:')],
 ["Fast social-link provider success skips slow enrichment, but full mode retains the old fallback",server.includes('if(key==="instagram"&&!fast)')&&server.includes('if(key==="tiktok"&&!fast)')&&server.includes('tikwmFallbackMediaInfo')],
 ["Direct 200-platform link detection remains source-based",html.includes('data-platform="all"')&&downloader.includes('window.aryanzzPlatformForUrl?.(url.href)')&&downloader.includes('window.aryanzzAutoSelectPlatform(detectedKey)')],
 ["Fast inspection is the default with an explicit full-check retry button",downloader.includes('async function checkLink(url, button, options={})')&&downloader.includes('const fast=options.deep!==true')&&downloader.includes('slowSocialSource?(fast?28000:41000)')&&downloader.includes("Coba pemeriksaan lengkap")&&downloader.includes('checkLink(url,button,{deep:true})')],
 ["Image link inspection still runs and uses a separate timeout",downloader.includes("imageExtractionPromise")&&downloader.includes("isTikTokPhotoPost")&&downloader.includes("imageCheckTimeout=slowSocialSource?")],
 ["Worker title search runs six independent lookups concurrently and bounds provider waits",server.includes("async function boundedLookup(inputs,task,parallel=6)")&&server.includes("AbortSignal.timeout(4600)")],
 ["Title search skips redundant engines when results already meet relevance threshold",server.includes("const enoughFirstPass=")&&server.includes("const enoughSecondPass=")&&server.includes("enoughFirstPass?[]")&&server.includes("enoughSecondPass?[]")],
 ["YouTube search providers launch concurrently, without eight download probes",server.includes("const [hybridPages,directYoutube]=await Promise.all(")&&server.includes("const [youtubePages,directYoutube]=await Promise.all(")&&!server.includes("const fallbackChecked=await Promise.all(youtubeFallbackCandidates.slice(0,8)")],
 ["Title search never mislabels an unchecked result as a verified download",server.includes("verified:false,downloadable:false,searchOnly:true")&&server.includes("const verificationLimit=0")],
 ["Image title discovery preserves platform filters and signature verification",server.includes("const pending=targetedAllPlatforms.filter(")&&server.includes("verifySocialImageSearchResult(item,request.url)")&&server.includes("verifiedImages=(await Promise.all(")],
 ["Network cache writes no longer delay API responses to phones",network.includes("void storeApiCache(key,data,response.status)")&&network.includes("void storeLibrary(body,data)")],
 ["Recent identical in-session title searches reuse response data",search.includes("const recentTitleSearch=new Map()")&&search.includes("Date.now()-saved.at<45000")&&search.includes("AbortSignal.timeout(34000)")],
 ["All earlier public features retain their endpoints",html.includes('id="platformPicker"')&&html.includes('id="titleSearchBtn"')&&server.includes('async function searchSocial(request)')&&server.includes('async function socialImageSearch(request)')]
];
for(const [label,ok] of checks){assert.ok(ok,label);console.log("✔ "+label);}
console.log("ARYANZZ V1 speed optimizations regression checks passed.");
