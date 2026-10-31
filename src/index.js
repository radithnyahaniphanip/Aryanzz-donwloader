const MEDIA_EXT = new Set(["mp4","webm","mov","m4v","mp3","m4a","aac","wav","ogg","oga","flac"]);
const MAX_BYTES = 100 * 1024 * 1024;

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
}
function mediaUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("URL tidak valid."); }
  if (!["http:","https:"].includes(u.protocol)) throw new Error("Hanya URL HTTP/HTTPS yang diizinkan.");
  if (u.username || u.password) throw new Error("URL dengan kredensial tidak diizinkan.");
  const host=u.hostname.toLowerCase();
  if (host==="localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host==="0.0.0.0" || host==="::1") {
    throw new Error("Alamat jaringan lokal tidak diizinkan.");
  }
  const ext=(u.pathname.split(".").pop()||"").toLowerCase();
  if (!MEDIA_EXT.has(ext)) throw new Error("Untuk saat ini, endpoint ini menerima URL file media langsung (MP4, WebM, MP3, dan format sejenis), bukan halaman platform.");
  return {url:u,ext};
}
function filenameFrom(url, ext) {
  let name;
  try { name=decodeURIComponent(url.pathname.split("/").pop()||""); } catch { name=""; }
  name=(name||"aryanzz-media."+ext).replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,100);
  if (!name.includes(".")) name += "."+ext;
  return name;
}
async function download(request) {
  let body;
  try { body=await request.json(); } catch { return json({error:"Body JSON tidak valid."},400); }
  let parsed;
  try { parsed=mediaUrl(body?.url); } catch(e) { return json({error:e.message},400); }
  let upstream;
  try {
    upstream=await fetch(parsed.url.toString(),{method:"GET",redirect:"manual",headers:{"user-agent":"ARYANZZ/1.0 media fetch"}});
    // Validate redirects rather than blindly following them.
    for(let i=0;i<4 && [301,302,303,307,308].includes(upstream.status);i++){
      const location=upstream.headers.get("location");
      if(!location) break;
      let next;
      try { next=mediaUrl(new URL(location,parsed.url).toString()); } catch(e) { return json({error:"Redirect ke tujuan yang tidak diizinkan: "+e.message},400); }
      parsed=next;
      upstream=await fetch(parsed.url.toString(),{method:"GET",redirect:"manual",headers:{"user-agent":"ARYANZZ/1.0 media fetch"}});
    }
  } catch { return json({error:"Tidak dapat menghubungi server sumber. Link mungkin dibatasi atau server sedang bermasalah."},502); }
  if(!upstream.ok || !upstream.body) return json({error:"Server sumber tidak menyediakan file (HTTP "+upstream.status+")."},502);
  const size=Number(upstream.headers.get("content-length")||0);
  if(size>MAX_BYTES) return json({error:"Ukuran file melebihi batas 100 MB untuk layanan gratis."},413);
  const name=filenameFrom(parsed.url,parsed.ext);
  const headers=new Headers({
    "content-type":upstream.headers.get("content-type")||"application/octet-stream",
    "content-disposition":'attachment; filename="'+name+'"',
    "cache-control":"no-store",
    "x-content-type-options":"nosniff"
  });
  if(size) headers.set("content-length",String(size));
  // Stream the upstream response; do not buffer media in Worker memory.
  return new Response(upstream.body,{status:200,headers});
}
export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname==="/api/health" && request.method==="GET") return json({ok:true,service:"ARYANZZ",mode:"cloudflare-worker",directMediaDownload:true});
    if(url.pathname==="/api/download" && request.method==="POST") return download(request);
    if(url.pathname.startsWith("/api/")) return json({error:"Endpoint tidak ditemukan."},404);
    return env.ASSETS.fetch(request);
  }
};