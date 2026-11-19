import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const downloader=read("../public/downloader.js");
const worker=read("../src/index.js");
const homeCss=read("../public/v1-experience.css");
const muxServer=read("../mux-container/server.mjs");

function functionSource(source,name,indent="  "){
  const pattern=new RegExp("(^|\\n)"+indent+"function "+name+"\\([^\\n]*\\)\\s*\\{[\\s\\S]*?\\n"+indent+"\\}","m");
  const match=source.match(pattern);
  assert.ok(match,"Expected "+name+" to exist");
  return match[0].trim();
}

const qualityOrder=new Function("return ("+functionSource(downloader,"youtubeCandidateQualityOrder")+");")();
const providerAudio=new Function("return ("+functionSource(downloader,"providerAudioForVideo")+");")();
const hasCompatibleAudio=new Function("providerAudioForVideo","return ("+functionSource(downloader,"hasCompatibleAudio")+");")(providerAudio);
const hasCompatibleProviderAudio=new Function("hasCompatibleAudio","return ("+functionSource(downloader,"hasCompatibleProviderAudio")+");")(hasCompatibleAudio);
const socialVideoCandidates=new Function("youtubeCandidateQualityOrder","hasCompatibleProviderAudio","return ("+functionSource(downloader,"socialVideoCandidates")+");")(qualityOrder,hasCompatibleProviderAudio);
const estimateFormatBytes=(item,duration)=>({
  bytes:Number(item.sizeBytes)||Math.round((Number(item.bitrate)||0)*(Number(duration)||0)/8),
  exact:Number(item.sizeBytes)>0
});
const estimateQuality=new Function("estimateFormatBytes","youtubeCandidateQualityOrder","return ("+functionSource(downloader,"youtubeQualityEstimate")+");")(estimateFormatBytes,qualityOrder);
const estimateProviderQuality=new Function("estimateFormatBytes","youtubeCandidateQualityOrder","hasCompatibleProviderAudio","providerAudioForVideo","return ("+functionSource(downloader,"providerQualityEstimate")+");")(estimateFormatBytes,qualityOrder,hasCompatibleProviderAudio,providerAudio);

const progressive1080={mode:"video",ext:"mp4",height:1080,bitrate:5_000_000,videoOnly:false,instance:"https://piped.example"};
const adaptive1440={mode:"video",ext:"mp4",height:1440,bitrate:8_000_000,videoOnly:true,instance:"https://youtube.example"};
const audio={mode:"audio",ext:"m4a",bitrate:128_000,instance:"https://youtube.example"};

const selected2k=estimateQuality({formats:[progressive1080,adaptive1440,audio],duration:60},1440);
assert.equal(selected2k.actualHeight,1440,"Selecting 2K must return a true 1440p stream");
assert.equal(selected2k.kind,"adaptive","Exact 2K adaptive stream must win over lower progressive 1080p");

const progressive1440={...progressive1080,height:1440,bitrate:10_000_000,instance:"https://piped.example"};
const selectedDirect2k=estimateQuality({formats:[adaptive1440,audio,progressive1440],duration:60},1440);
assert.equal(selectedDirect2k.actualHeight,1440);
assert.equal(selectedDirect2k.kind,"direct","A higher-bitrate direct 1440p stream should be preferred over a softer adaptive stream");

const adaptiveHigherBitrate={...adaptive1440,bitrate:18_000_000};
assert.equal(estimateQuality({formats:[progressive1440,adaptiveHigherBitrate,audio],duration:60},1440).kind,"adaptive","A materially higher-bitrate 2K stream must not lose to a softer progressive stream");

const fallbackOrder=qualityOrder([
  {...progressive1080,height:1080,bitrate:4_000_000},
  {...adaptive1440,height:2160,bitrate:9_000_000}
],1440);
assert.equal(fallbackOrder[0].height,2160,"When a requested resolution is absent, report the next higher native source resolution before a downgrade");

const adaptive8k={...adaptive1440,height:4320,bitrate:40_000_000};
assert.equal(estimateQuality({formats:[progressive1080,adaptive8k,audio],duration:60},4320).actualHeight,4320,"8K must retain the true 4320p stream");
assert.equal(estimateQuality({formats:[adaptive1440],duration:60},1440),null,"Adaptive video without a compatible audio track must not be offered as a complete video");

const publicVideo={mode:"video",ext:"mp4",height:1440,videoOnly:true,instance:"https://provider.example",bitrate:8_000_000,downloadUrl:"/api/social-file?video=1"};
const publicAudio={mode:"audio",ext:"m4a",instance:"https://provider.example",bitrate:128_000,downloadUrl:"/api/social-file?audio=1"};
assert.equal(hasCompatibleProviderAudio(publicVideo,[publicVideo,publicAudio]),true,"Social adaptive video should be selectable when a matching audio track exists");
const publicWebm={mode:"video",ext:"webm",height:2160,videoOnly:true,instance:"https://provider.example",downloadUrl:"/api/social-file?webm=1"};
const publicOpus={mode:"audio",ext:"opus",instance:"https://provider.example",downloadUrl:"/api/social-file?opus=1"};
assert.equal(providerAudio(publicWebm,[publicWebm,publicOpus]).ext,"opus","WebM video should pair with a compatible Opus audio track.");
const publicMov={mode:"video",ext:"mov",height:1080,videoOnly:false,downloadUrl:"/api/social-file?mov=1"};
const publicAvi={mode:"video",ext:"avi",height:1440,videoOnly:false,downloadUrl:"/api/social-file?avi=1"};
const publicFlv={mode:"video",ext:"flv",height:720,videoOnly:false,downloadUrl:"/api/social-file?flv=1"};
const socialCandidates=socialVideoCandidates([publicMov,publicFlv,publicAvi],1440);
assert.equal(socialCandidates[0].ext,"avi","An exact 1440p AVI source should remain selectable for MP4 conversion.");
assert.ok(socialCandidates.some(item=>item.ext==="mov"),"MOV sources must not be discarded before MP4 conversion.");
assert.ok(socialCandidates.some(item=>item.ext==="flv"),"FLV sources must not be discarded before MP4 conversion.");
const publicEstimate=estimateProviderQuality({duration:60},1440,[publicVideo,publicAudio]);
assert.equal(publicEstimate.kind,"adaptive");
assert.equal(publicEstimate.actualHeight,1440);
assert.ok(publicEstimate.bytes>0,"Adaptive size estimate must include video and audio");

assert.ok(downloader.includes("candidates=selectProviderCandidates(youtubeCandidateQualityOrder(exactFormats,wanted),2,8)"),"YouTube download must only attempt the resolution the user selected");
assert.ok(downloader.includes("async function muxSocialVideo("),"Social providers need a real video/audio mux path for adaptive formats");
assert.ok(downloader.includes("async function convertSocialVideoToMp4("),"Single-file MOV/WebM/AVI/FLV sources should be converted to a validated MP4.");
assert.ok(downloader.includes("aryanzz-social-output.mp4"),"Adaptive social video and audio tracks should be packaged as MP4.");
assert.ok(downloader.includes("socialVideoCandidates(all,Number(quality)||480)"),"Social video candidates must include supported non-MP4 source containers rather than rejecting them early.");
assert.ok(downloader.includes("Video slideshow MP4 siap"),"Photo carousel slideshow should finish as MP4 even when MediaRecorder only supports WebM.");
assert.ok(downloader.includes("hasCompatibleProviderAudio(item,info.formats)"),"Adaptive quality choices must be hidden unless a compatible audio track exists");
assert.ok(downloader.includes("Resolusi video sumber tetap"),"Muxing must preserve and report the real source resolution");
assert.ok(downloader.includes("returnOnly:true"),"Adaptive track downloads must support an intermediate mode without saving an incomplete file");
assert.ok(downloader.includes('[4320,"4320p · 8K"]'),"The quality menu must include native 8K when the provider supplies it");
assert.ok(downloader.includes("2160,4320].includes(height)"),"Browser provider parser must accept 4320p");
assert.ok(worker.includes("402:4320,571:4320"),"Worker must recognize YouTube 8K itags");
assert.ok(worker.includes("2160,4320].includes(height)"),"Worker provider parser must accept 4320p");
assert.ok(downloader.includes("downloadYoutubeServerMux"),"Adaptive MP4 streams should use the server-side streaming mux path before browser memory muxing.");
assert.ok(downloader.includes("/api/youtube/hybrid/mux-ticket"),"The browser should request a signed mux ticket before starting a large MP4 download.");
assert.ok(worker.includes("const MAX_YOUTUBE_BYTES=14*1024*1024*1024;"),"Direct YouTube MP4 streaming should allow files up to the configured 14 GB safety cap.");
assert.ok(worker.includes("hybridYoutubeMuxTicket")&&worker.includes("hybridYoutubeMuxFile"),"The Worker should expose signed ticket and streaming mux endpoints.");
assert.ok(worker.includes("serverMuxReady:!!env.YOUTUBE_MUX_URL&&!!env.YOUTUBE_MUX_TOKEN"),"YouTube status should report whether the high-resolution mux service is configured.");
assert.ok(downloader.includes('videoExt==="webm"&&["webm","opus"].includes(audioExt)'),"High-resolution WebM video plus Opus audio should use the MP4 server mux path.");
assert.ok(worker.includes('videoExt==="webm"&&["webm","opus"].includes(audioExt)'),"The Worker should accept compatible WebM plus Opus sources.");
assert.ok(muxServer.includes('payload.audioCodec === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "192k"'),"WebM audio should be converted to AAC while preserving the original video stream.");
assert.ok(muxServer.includes('["h264", "hevc", "av1", "vp9"]'),"The mux should validate native video codecs rather than upscale or re-encode the picture.");

assert.ok(homeCss.includes("margin-bottom:26px!important"),"Paste-link mode must have clear space below the mode buttons");
assert.ok(homeCss.includes("padding-top:8px!important"),"Platform search must have breathing room from the mode buttons");
assert.ok(homeCss.includes("margin-bottom:18px!important"),"Platform search field must be separated from the platform list");

console.log("ARYANZZ media quality selection regression tests passed: exact 2K/4K/8K selection, bitrate ranking, adaptive audio pairing, social mux, and home spacing.");
