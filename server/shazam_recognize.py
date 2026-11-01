import asyncio
import base64
import json
import sys


def normalize_track(track):
    if not isinstance(track, dict):
        return None
    title = str(track.get("title") or "").strip()
    artist = str(track.get("subtitle") or "").strip()
    if not title:
        return None
    images = track.get("images") or {}
    hub = track.get("hub") or {}
    apple_url = None
    for action in hub.get("actions") or []:
        candidate = action.get("uri") or action.get("url")
        if isinstance(candidate, str) and candidate.startswith("https://"):
            apple_url = candidate
            if "apple.com" in candidate:
                break
    share = track.get("share") or {}
    return {
        "title": title[:300],
        "artist": artist[:300] or "Unknown artist",
        "album": "",
        "release_date": "",
        "timecode": "",
        "song_link": track.get("url") or share.get("href"),
        "apple_music": {"url": apple_url} if apple_url else None,
        "spotify": None,
        "artwork_url": images.get("coverarthq") or images.get("coverart"),
        "provider": "Shazam",
    }


async def main():
    from shazamio import Shazam
    payload = json.load(sys.stdin)
    async with Shazam(language="id-ID", endpoint_country="ID") as shazam:
        if "audio" in payload:
            audio = base64.b64decode(payload["audio"], validate=True)
            result = await shazam.recognize(audio)
            track = normalize_track((result or {}).get("track"))
            print(json.dumps({"ok": True, "match": bool(track), "provider": "Shazam", "result": track,
                              "message": "Lagu ditemukan." if track else "Shazam belum menemukan lagu pada cuplikan ini."}))
            return
        tracks = {}
        samples = payload.get("samples") or []
        for sample in samples:
            audio = base64.b64decode(sample.get("audio", ""), validate=True)
            result = await shazam.recognize(audio)
            track = normalize_track((result or {}).get("track"))
            if not track:
                continue
            key = (track["title"].casefold(), track["artist"].casefold())
            offset = str(sample.get("offset") or "")
            if key not in tracks:
                tracks[key] = {**track, "offset": offset, "offsets": [offset] if offset else [], "score": None}
            elif offset and offset not in tracks[key]["offsets"]:
                tracks[key]["offsets"].append(offset)
        found = list(tracks.values())
        print(json.dumps({"ok": True, "match": bool(found), "provider": "Shazam", "scannedChunks": len(samples),
                          "tracks": found[:100], "message": "Pemindaian selesai." if found else "Belum ada lagu yang cocok pada segmen yang dipindai."}))
try:
    asyncio.run(main())
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc)[:500]}))
    sys.exit(0)
