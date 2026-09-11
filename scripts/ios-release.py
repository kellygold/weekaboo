#!/usr/bin/env python3
"""Archive and export locally; never upload. Existing Apple signing is required.

Automatic Apple profile/certificate updates are opt-in. Output must be a new
directory under output/ so previous signed candidates and receipts survive.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--team', required=True, help='Apple developer team ID, not a secret')
parser.add_argument('--output', required=True, help='New directory inside output/')
parser.add_argument('--allow-provisioning-updates', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = (root / args.output).resolve()
if not args.team.isalnum() or len(args.team) != 10:
    parser.error('Expected a ten-character Apple team ID')
if not out.is_relative_to(root / 'output') or out == root / 'output' or out.exists():
    parser.error('Output must be a new child directory of output/')
out.mkdir(parents=True)
env = dict(os.environ, DEVELOPER_DIR=os.environ.get('DEVELOPER_DIR', '/Applications/Xcode.app/Contents/Developer'))


def run(command, log=None):
    if log:
        with (out / log).open('wb') as stream:
            subprocess.run(command, cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT, check=True, timeout=600)
        return b''
    return subprocess.run(command, cwd=root, env=env, capture_output=True, check=True, timeout=600).stdout


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


receipt = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'sourceCommit': run(['git', 'rev-parse', 'HEAD']).decode().strip(),
           'trackedSourceDeltaSha256': hashlib.sha256(run(['git', 'diff', 'HEAD'])).hexdigest(),
           'managedSigningUpdatesAllowed': args.allow_provisioning_updates,
           'uploaded': False, 'productionApproved': False}
try:
    run(['npm', 'run', 'ios:sync'], 'sync.log')
    public = root / 'ios/App/App/public'
    renderer = {str(p.relative_to(public)): sha(p) for p in public.rglob('*') if p.is_file() and p.name != '.DS_Store'}
    (out / 'renderer.json').write_text(json.dumps(renderer, indent=2) + '\n')
    archive = out / 'Weekaboo.xcarchive'
    signing = ['-allowProvisioningUpdates'] if args.allow_provisioning_updates else []
    run(['xcodebuild', '-project', 'ios/App/App.xcodeproj', '-scheme', 'Weekaboo',
         '-configuration', 'Release', '-destination', 'generic/platform=iOS',
         '-archivePath', str(archive), 'DEVELOPMENT_TEAM=' + args.team,
         '-disableAutomaticPackageResolution', '-onlyUsePackageVersionsFromResolvedFile', *signing, 'archive'], 'archive.log')
    options = out / 'ExportOptions.plist'
    options.write_bytes(plistlib.dumps({'method': 'app-store-connect', 'destination': 'export',
                                       'teamID': args.team, 'signingStyle': 'automatic',
                                       'manageAppVersionAndBuildNumber': False}))
    run(['xcodebuild', '-exportArchive', '-archivePath', str(archive),
         '-exportPath', str(out / 'export'), '-exportOptionsPlist', str(options), *signing], 'export.log')
    ipas = list((out / 'export').glob('*.ipa'))
    if len(ipas) != 1:
        raise RuntimeError('Expected exactly one exported IPA')
    ipa = ipas[0]
    with tempfile.TemporaryDirectory(prefix='weekaboo-ipa-proof-') as temporary:
        run(['ditto', '-xk', str(ipa), temporary])
        apps = list((Path(temporary) / 'Payload').glob('*.app'))
        if len(apps) != 1:
            raise RuntimeError('Expected exactly one app in IPA')
        app = apps[0]
        run(['codesign', '--verify', '--deep', '--strict', str(app)])
        info = plistlib.loads((app / 'Info.plist').read_bytes())
        meta = json.loads((root / 'package.json').read_text())
        assert info['CFBundleIdentifier'] == 'app.weekaboo.calendar'
        assert info['CFBundleShortVersionString'] == meta['version']
        assert int(info['CFBundleVersion']) == meta['weekabooBuild']
        assert info.get('CAPACITOR_DEBUG') not in [True, 'true']
        config = json.loads((app / 'capacitor.config.json').read_text())
        assert config.get('loggingBehavior') == 'none' and not config.get('server', {}).get('url')
        assert not config.get('ios', {}).get('webContentsDebuggingEnabled')
        actual = {str(p.relative_to(app / 'public')): sha(p) for p in (app / 'public').rglob('*') if p.is_file() and p.name != '.DS_Store'}
        assert actual == renderer, 'Exported renderer differs from candidate'
        profile = plistlib.loads(run(['security', 'cms', '-D', '-i', str(app / 'embedded.mobileprovision')]))
        entitlements = plistlib.loads(run(['codesign', '-d', '--entitlements', ':-', str(app)]))
        assert not entitlements.get('get-task-allow', False)
        assert not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices', False)
        assert entitlements['application-identifier'] == args.team + '.app.weekaboo.calendar'
        assert profile['Entitlements']['application-identifier'] == entitlements['application-identifier']
        native = json.loads(run(['node', 'scripts/native-ios-notices-verify.mjs', str(app)]))
        receipt.update(ipaSha256=sha(ipa), exportedIpa=str(ipa.relative_to(root)),
                       strictSignatureVerified=True, appStoreDistributionProfile=True,
                       developerDebuggingDisabled=True, rendererFiles=len(renderer),
                       nativeNoticePackages=native['packages'], nativeNoticeFiles=native['verbatimNotices'],
                       privacyManifestCount=len(list(app.rglob('PrivacyInfo.xcprivacy'))))
    receipt['status'] = 'local-export-verified'
    print('Verified local App Store export: ' + str(ipa.relative_to(root)), flush=True)
except Exception as error:
    # Full tool logs stay local; do not leak signing/account diagnostics to stdout.
    receipt['status'] = 'failed'
    receipt['failureType'] = type(error).__name__
    print('Archive/export failed. Inspect the local logs in ' + str(out.relative_to(root)), flush=True)
    raise
finally:
    (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
