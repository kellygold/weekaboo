#!/usr/bin/env python3
"""Read-only exact-byte check of native acknowledgment resources in an APK/AAB."""
import argparse,hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('artifact',type=Path);args=p.parse_args()
generated=root/'android/app/src/main/assets/public/licenses/native-android';manifest=json.loads((generated/'inventory.json').read_text())
expected={'README.txt','inventory.json'}|{notice['file'] for package in manifest['packages'] for notice in package['notices']}
assert {str(f.relative_to(generated)) for f in generated.rglob('*') if f.is_file()}==expected,'Generated file set differs from manifest'
prefix=('base/' if args.artifact.suffix=='.aab' else '')+'assets/public/licenses/native-android/'
with zipfile.ZipFile(args.artifact) as archive:
 actual={name[len(prefix):] for name in archive.namelist() if name.startswith(prefix) and not name.endswith('/')}
 assert actual==expected,'Artifact native acknowledgment file set differs'
 for name in sorted(expected):assert archive.read(prefix+name)==(generated/name).read_bytes(),'Artifact acknowledgment mismatch: '+name
 for package in manifest['packages']:
  for notice in package['notices']:assert hashlib.sha256(archive.read(prefix+notice['file'])).hexdigest()==notice['sha256']
 google=next(package for package in manifest['packages'] if package['coordinate'].startswith('com.google.android.gms:play-services-auth:'))
 assert {'third_party_licenses.txt','third_party_licenses.json'}<={notice['sourceEntry'] for notice in google['notices']}
print(json.dumps({'artifact':str(args.artifact.resolve()),'sha256':hashlib.sha256(args.artifact.read_bytes()).hexdigest(),'components':len(manifest['packages']),'originalNoticeFiles':len(expected)-2,'exactBytes':True,'googleAuthThirdPartyFilesPreserved':True,'complete':manifest['complete'],'unresolvedComponents':len(manifest['unresolved']),'scope':manifest['scope']},indent=2))
