"""Initialize local LX scripts using real native HTTP/timers. Private report only."""
import concurrent.futures
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
folder = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'resource/V261008'

def probe(path):
    try:
        run = subprocess.run([
            str(root / 'build/tests/native-runtime'),
            str(root / 'modules/nexus-native/ios/bootstrap.js'), str(path), '--init'
        ], capture_output=True, text=True, timeout=25)
        result = json.loads(run.stdout) if run.returncode == 0 else {'nativeProcessFailed': True}
    except subprocess.TimeoutExpired:
        result = {'timedOut': True}
    except (ValueError, OSError):
        result = {'probeFailed': True}
    return {'file': path.name, **result}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    report = list(pool.map(probe, sorted(folder.glob('*.js'))))
target = root / 'build/logs/lx-native-initialization.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(json.dumps({'scripts': len(report), 'initializedNative': sum(x.get('initialized', False) for x in report),
                  'report': str(target)}, ensure_ascii=False))
