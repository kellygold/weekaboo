#!/usr/bin/env python3
"""Exercise publication audit failure modes in a disposable synthetic Git repo."""
from pathlib import Path
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
scanner = str(Path(sys.argv[1]).resolve())
output = root / 'output/publication-audit'
output.mkdir(parents=True, exist_ok=True)
passed = []
with tempfile.TemporaryDirectory(prefix='audit-fixture-', dir=output) as temp:
    fixture = Path(temp)
    def run(*args):
        return subprocess.run(args, cwd=fixture, capture_output=True)
    def git(*args):
        result = run('git', '-c', 'user.name=Publication Test', '-c', 'user.email=validation@example.invalid', *args)
        assert result.returncode == 0, 'Synthetic Git operation failed'
    def audit():
        return run(sys.executable, 'scripts/audit-public-source.py', '--gitleaks', scanner)
    git('init', '-q')
    for name in ['README.md','LICENSE','backend/.env.example','android/native-auth.properties.example','ios/native-auth.xcconfig.example','desktop/native-auth.example.json']:
        p=fixture/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('')
    (fixture/'.gitignore').write_text('output/\n.env\n')
    (fixture/'scripts').mkdir()
    shutil.copy2(root/'scripts/audit-public-source.py',fixture/'scripts/audit-public-source.py')
    assert audit().returncode == 0, 'Clean fixture must pass'
    passed.append('clean candidate passes without history')
    # Synthetic random token: never valid at a provider, never sent to a network.
    token='ghp_' + secrets.token_hex(18)
    (fixture/'leak.txt').write_text('api_key = "' + token + '"\n')
    result=audit();assert result.returncode == 1
    receipt=json.loads((fixture/'output/publication-audit/receipt.json').read_text())
    assert receipt['sourceSecretFindings'] > 0
    assert token.encode() not in result.stdout + result.stderr
    passed.append('synthetic source token rejected without console disclosure')
    git('add','leak.txt');git('commit','-qm','Synthetic leak fixture')
    (fixture/'leak.txt').unlink();git('add','-u');git('commit','-qm','Remove synthetic fixture')
    result=audit();assert result.returncode == 1
    receipt=json.loads((fixture/'output/publication-audit/receipt.json').read_text())
    assert receipt['sourceSecretFindings']==0 and receipt['historySecretFindings']>0
    assert token.encode() not in result.stdout + result.stderr
    passed.append('deleted synthetic token still detected in full history')
    (fixture/'.env').write_text('PRIVATE_CONFIG=synthetic\n');git('add','-f','.env')
    result=audit();assert result.returncode != 0 and b'prohibited source paths' in result.stderr
    passed.append('force-staged ignored private file rejected')
(output/'audit-self-tests.json').write_text(json.dumps({'passed':True,'checks':passed,'fixtureRemoved':True},indent=2))
print(str(len(passed))+' publication audit checks passed; disposable fixture removed.')
