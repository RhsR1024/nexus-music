"""Probe private local scripts in separate native processes; no network/secret output."""
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
folder = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'resource/V261008'
binary = root / 'build/lx-probe'
report = []
for path in sorted(folder.glob('*.js')):
    try:
        run = subprocess.run([str(binary), str(root / 'modules/nexus-native/ios/bootstrap.js'), str(path)],
                             capture_output=True, text=True, timeout=10)
        status = json.loads(run.stdout.strip()) if run.returncode == 0 else {'nativeProcessFailed': True}
    except subprocess.TimeoutExpired:
        status = {'timedOut': True}
    report.append({'file': path.name, **status})
target = root / 'build/logs/lx-initialization.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(json.dumps({'scripts': len(report), 'initializedOffline': sum(x.get('initialized', False) for x in report),
                  'report': str(target)}, ensure_ascii=False))
