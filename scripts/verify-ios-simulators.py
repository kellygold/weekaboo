#!/usr/bin/env python3
"""Installed-app XCUITests on isolated iPhone, iPad Mini and iPad simulators.
No real accounts. Only Weekaboo Validation simulators may be reset.
Run npm run ios:sync first. Requires full Xcode and iOS simulator runtime.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--only-testing', help='Optional Xcode test identifier')
parser.add_argument('--device', choices=['iphone','ipad-mini','ipad'], help='Run one form factor while isolating a failure')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
out = root / 'output' / 'production-validation' / ('ios-' + stamp)
out.mkdir(parents=True)
env = dict(os.environ, DEVELOPER_DIR='/Applications/Xcode.app/Contents/Developer')
env['PATH'] = env['DEVELOPER_DIR'] + '/usr/bin:' + env.get('PATH', '')
def sim(*arguments, **kwargs):
    return subprocess.run(['xcrun', 'simctl', *arguments], env=env, check=True, **kwargs)
inventory = json.loads(sim('list', '--json', capture_output=True, text=True).stdout)
runtimes = [r for r in inventory['runtimes'] if r.get('isAvailable') and r['identifier'].startswith('com.apple.CoreSimulator.SimRuntime.iOS-')]
if not runtimes:
    raise SystemExit('Install an iOS simulator runtime in Xcode first.')
runtime = max(runtimes, key=lambda r: tuple(int(n) for n in r['version'].split('.')))
matrix = [('iphone', 'iPhone', 'iPhone-17-Pro'), ('ipad-mini', 'iPad Mini', 'iPad-mini-A17-Pro'), ('ipad', 'iPad', 'iPad-A16')]
results = []
for slug, label, kind in matrix:
    if args.device and args.device != slug:
        continue
    name = 'Weekaboo Validation ' + label
    existing = next((d for d in inventory['devices'].get(runtime['identifier'], []) if d['name'] == name and d.get('isAvailable')), None)
    device = existing['udid'] if existing else sim('create', name, 'com.apple.CoreSimulator.SimDeviceType.' + kind, runtime['identifier'], capture_output=True, text=True).stdout.strip()
    start = time.monotonic()
    result = dict(name=slug, id=device, runtime=runtime['version'])
    log_path = out / (slug + '.log')
    bundle = out / (slug + '.xcresult')
    with log_path.open('w') as log:
        try:
            if not existing or existing['state'] != 'Booted':
                sim('boot', device, stdout=log, stderr=log)
            sim('bootstatus', device, '-b', stdout=log, stderr=log, timeout=180)
            # No non-test device can enter this branch. Remove only synthetic residue.
            subprocess.run(['xcrun', 'simctl', 'uninstall', device, 'app.weekaboo.calendar'], env=env, stdout=log, stderr=log)
            command = ['xcodebuild', '-project', 'ios/App/App.xcodeproj', '-scheme', 'WeekabooValidation', '-configuration', 'Debug', '-destination', 'platform=iOS Simulator,id=' + device, '-derivedDataPath', 'output/ios-build', '-resultBundlePath', str(bundle), 'CODE_SIGN_IDENTITY=-', 'CODE_SIGNING_ALLOWED=YES']
            if args.only_testing:
                command.append('-only-testing:' + args.only_testing)
            command.append('test')
            run = subprocess.run(command, cwd=root, env=env, stdout=log, stderr=log, timeout=360)
            result['exitCode'] = run.returncode
            if bundle.exists():
                subprocess.run(['xcrun', 'xcresulttool', 'export', 'attachments', '--path', str(bundle), '--output-path', str(out / (slug + '-screenshots'))], env=env, stdout=log, stderr=log)
        except subprocess.TimeoutExpired:
            result['timeout'] = True
        finally:
            subprocess.run(['xcrun', 'simctl', 'shutdown', device], env=env, stdout=log, stderr=log)
            result['elapsed'] = round(time.monotonic() - start, 2)
            results.append(result)
            (out / 'matrix.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(result), flush=True)
print('Evidence: ' + str(out), flush=True)
raise SystemExit(0 if all(r.get('exitCode') == 0 for r in results) else 1)
