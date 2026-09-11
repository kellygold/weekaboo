#!/usr/bin/env python3
"""Scan the exact Git source candidate and all existing history without printing secrets.
Requires Gitleaks 8.30.1. Never stages, commits, rewrites history or uploads files.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_VERSION = '8.30.1'


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gitleaks', default='gitleaks', help='Path to the pinned local Gitleaks binary')
    args = parser.parse_args()
    scanner = shutil.which(args.gitleaks)
    if not scanner:
        parser.error('Install Gitleaks 8.30.1 from its official release, verifying its published checksum.')
    scanner = str(Path(scanner).resolve())
    version = subprocess.check_output([scanner, 'version']).decode().strip()
    if version.lstrip('v') != EXPECTED_VERSION:
        parser.error('Use Gitleaks ' + EXPECTED_VERSION + ' for a reproducible source audit.')
    os.umask(0o077)
    out = ROOT / 'output/publication-audit'
    out.mkdir(parents=True, exist_ok=True)
    # This must remain outside the publication set even if ignore rules change.
    if subprocess.run(['git', '-C', str(ROOT), 'check-ignore', '-q', str(out / 'probe')]).returncode:
        raise RuntimeError('Private audit output must be ignored by Git.')
    names = sorted(set(filter(None, git('ls-files', '--cached', '--others', '--exclude-standard', '-z').decode().split('\0'))))
    if not names:
        raise RuntimeError('No source candidate found.')
    prohibited = []
    for name in names:
        path = Path(name)
        parts = set(path.parts)
        suffix = path.suffix.lower()
        if (path.is_absolute() or '..' in parts or (ROOT / path).is_symlink()
                or parts.intersection({'node_modules', 'output', '.git', '.venv', 'DerivedData', 'xcuserdata'})
                or path.parts[0] in {'data', 'dist', 'dist-native', 'dist-desktop', 'dist-site'}
                or suffix in {'.db', '.sqlite', '.sqlite3', '.p12', '.pfx', '.jks', '.keystore', '.mobileprovision', '.provisionprofile', '.ipa', '.apk', '.aab', '.dmg'}
                or (path.name.startswith('.env') and path.name != '.env.example')
                or path.name in {'native-auth.json', 'native-auth.properties', 'native-auth.xcconfig', 'NativeAuth.plist', 'local.properties'}):
            prohibited.append(name)
    if prohibited:
        (out / 'prohibited-paths.json').write_text(json.dumps(prohibited, indent=2))
        raise RuntimeError(f'{len(prohibited)} prohibited source paths; see private audit report.')
    for required in ['backend/.env.example', 'android/native-auth.properties.example', 'ios/native-auth.xcconfig.example', 'desktop/native-auth.example.json', 'README.md', 'LICENSE']:
        if required not in names:
            raise RuntimeError('Required public setup file absent: ' + required)
    commits = int(git('rev-list', '--all', '--count').strip() or b'0')
    receipt = {'at': datetime.now(timezone.utc).isoformat(), 'scanner': 'gitleaks', 'version': version,
               'sourceFiles': len(names), 'historyCommits': commits, 'prohibitedPaths': 0,
               'historyStatus': 'no commits exist' if not commits else 'pending',
               'uploaded': False, 'passed': False}
    inventory = []
    reviews = []
    # Paths/line numbers only; no matched personal content or credentials in reports.
    review_patterns = {'personal filesystem path': re.compile(r'/Users/[a-zA-Z0-9_.-]+/'),
                       'personal email address': re.compile(r'[\w.+-]+@(?:gmail\.com|hotmail\.com|outlook\.com|kelly\.gold|golf\.ai)', re.I)}
    with tempfile.TemporaryDirectory(prefix='source-', dir=out) as tmp:
        source = Path(tmp)
        for name in names:
            data = (ROOT / name).read_bytes()
            dest = source / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            inventory.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
            try:
                lines = data.decode('utf-8').splitlines()
            except UnicodeDecodeError:
                continue
            for kind, pattern in review_patterns.items():
                hits = [n for n, line in enumerate(lines, 1) if pattern.search(line)]
                if hits:
                    reviews.append({'path': name, 'kind': kind, 'lines': hits})
        (out / 'source-manifest.json').write_text(json.dumps(inventory, indent=2))
        receipt['manifestSha256'] = hashlib.sha256(json.dumps(inventory, sort_keys=True).encode()).hexdigest()
        scopes = [('source', ['dir', str(source)])]
        if commits:
            scopes.append(('history', ['git', str(ROOT), '--log-opts=--all']))
        totals = 0
        for scope, command in scopes:
            report = out / (scope + '-gitleaks.json')
            with (out / (scope + '-gitleaks.log')).open('w') as log:
                result = subprocess.run([scanner, *command, '--redact=100', '--no-banner', '--ignore-gitleaks-allow', '--max-decode-depth=2', '--max-archive-depth=2', '--report-format=json', '--report-path=' + str(report)], stdout=log, stderr=log)
            if result.returncode not in (0, 1) or not report.exists():
                raise RuntimeError('Secret scanner failed; inspect private ' + scope + ' log.')
            findings = json.loads(report.read_text())
            if result.returncode == 1 and not findings:
                raise RuntimeError('Scanner failed without a usable finding report.')
            receipt[scope + 'SecretFindings'] = len(findings)
            totals += len(findings)
            if scope == 'history':
                receipt['historyStatus'] = 'scanned all refs'
        receipt['manualPrivacyReview'] = reviews
        # Third-party notices contain upstream authors' public attribution emails.
        unresolved = [r for r in reviews if not r['path'].startswith(('licenses/', 'website/assets/'))]
        receipt['unresolvedPrivacyPaths'] = len(unresolved)
        receipt['passed'] = totals == 0 and not unresolved
        (out / 'receipt.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps({k: v for k, v in receipt.items() if k != 'manualPrivacyReview'}, indent=2))
    return 0 if receipt['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
