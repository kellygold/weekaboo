#!/usr/bin/env python3
"""Verify packaged privacy manifests against reviewed, locked SDK declarations.

This is a packaging/change-detection gate, not an App Store disclosure decision
or an audit of every API the app calls. Never regenerate the baseline implicitly.
"""
import argparse
import hashlib
import json
from pathlib import Path
import plistlib

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / 'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved'
BASELINE = ROOT / 'ios/privacy-baseline.json'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def verify(app, baseline_path=BASELINE, lock_path=LOCK):
    app = Path(app).resolve()
    if not app.is_dir() or app.suffix != '.app':
        raise ValueError('Expected an existing packaged .app directory')
    baseline = json.loads(Path(baseline_path).read_text())
    if baseline.get('schemaVersion') != 1:
        raise ValueError('Unsupported privacy baseline schema')
    pins = json.loads(Path(lock_path).read_text())['pins']
    locked = {pin['identity']: pin['state']['revision'] for pin in pins}
    reviewed = {pin['identity']: pin['revision'] for pin in baseline['packages']}
    if locked != reviewed:
        raise ValueError('SDK lock changed: review privacy declarations before updating the baseline')
    expected = baseline['manifests']
    found = {p.relative_to(app).as_posix(): p for p in app.rglob('*.xcprivacy')}
    if not expected or set(found) != set(expected):
        raise ValueError('Privacy manifest set changed: missing=' + str(sorted(set(expected) - set(found)))
                         + ', added=' + str(sorted(set(found) - set(expected))))
    declarations = []
    for name, path in sorted(found.items()):
        if path.is_symlink() or not path.resolve().is_relative_to(app):
            raise ValueError('Privacy manifest must be a contained regular resource: ' + name)
        manifest = plistlib.loads(path.read_bytes())
        if not isinstance(manifest, dict) or digest(manifest) != expected[name]:
            raise ValueError('Privacy declaration changed: ' + name)
        declarations.append({'path': name, 'semanticSha256': digest(manifest), 'declaration': manifest})
    return {'status': 'reviewed-manifests-retained', 'manifestCount': len(found),
            'lockedPackages': len(locked), 'manifests': declarations,
            'scope': 'Exact reviewed declarations and locked SDK revisions; not store-label approval or complete API coverage.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('app')
    args = parser.parse_args()
    print(json.dumps(verify(args.app), indent=2))
