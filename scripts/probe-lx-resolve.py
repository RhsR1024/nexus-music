"""Resolve a private sample track. Never print URLs, keys, titles, IDs or raw errors."""
import concurrent.futures
import json
import pathlib
import subprocess
import time
import ssl
import urllib.parse
import urllib.request
import urllib.error

root = pathlib.Path(__file__).resolve().parent.parent
backup = json.loads((root / 'resource/wayfarer_music-backup.json').read_text())
track = next(t for p in backup['playlists'] for t in p['tracks'] if t['providerId'] == 'lx:wy')
song_id = track['id'].split(':')[-1]
payload = {'source': 'wy', 'action': 'musicUrl', 'info': {'type': '128k', 'musicInfo': {
    'id': song_id, 'source': 'wy', 'name': track['title'], 'singer': track['artist'], 'interval': None,
    'meta': {'songId': song_id, 'albumName': track.get('album', '')}}}}
initialization = json.loads((root / 'build/logs/lx-native-initialization.json').read_text())
candidates = [item['file'] for item in initialization if item.get('initialized') and 'wy' in item.get('platforms', [])][:6]

def probe(filename):
    started = time.monotonic()
    result = {'file': filename, 'platform': 'wy', 'requestedQuality': '128k'}
    try:
        run = subprocess.run([str(root / 'build/tests/native-runtime'), str(root / 'modules/nexus-native/ios/bootstrap.js'),
                              str(root / 'resource/V261008' / filename), json.dumps(payload)],
                             capture_output=True, text=True, timeout=40)
        value = json.loads(run.stdout) if run.returncode == 0 else None
        url = value if isinstance(value, str) else value.get('url') if isinstance(value, dict) else None
        valid = isinstance(url, str) and urllib.parse.urlsplit(url).scheme in ['https', 'http'] and bool(urllib.parse.urlsplit(url).hostname)
        result['resolvedHTTPURL'] = valid
        if valid:
            try:
                request = urllib.request.Request(url, headers={'Range': 'bytes=0-1023', 'User-Agent': track.get('sourceUserAgent') or 'Mozilla/5.0', 'Referer': 'https://music.163.com/'})
                context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
                with urllib.request.urlopen(request, timeout=10, context=context) as response:
                    data = response.read(1024)
                    audio = data.startswith((b'ID3', b'fLaC', b'RIFF', b'OggS')) or (len(data) > 1 and data[0] == 255 and data[1] & 224 == 224)
                    result['audioHeaderRecognized'] = audio
                    result['httpStatus'] = response.status
                    result['contentKind'] = 'audio' if 'audio/' in response.headers.get('Content-Type', '') else 'other'
            except urllib.error.HTTPError as error:
                result['httpStatus'] = error.code
                result['audioHeaderRecognized'] = False
            except Exception as error:
                result['audioHeaderRecognized'] = False
                result['networkErrorType'] = type(error).__name__
    except Exception:
        result['resolvedHTTPURL'] = False
    result['seconds'] = round(time.monotonic() - started, 2)
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(probe, candidates))
target = root / 'build/logs/lx-native-resolve.json'
target.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps({'tested': len(results), 'resolvedHTTPURL': sum(bool(x.get('resolvedHTTPURL')) for x in results),
                  'audioHeaderRecognized': sum(bool(x.get('audioHeaderRecognized')) for x in results)}, ensure_ascii=False))
