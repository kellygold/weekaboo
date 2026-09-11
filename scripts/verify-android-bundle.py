#!/usr/bin/env python3
"""Validate and derive a locally signed universal APK. No download, install or upload.
Uses the already verified official bundletool and existing release signing files.
"""
import hashlib,json,os,subprocess,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];os.chdir(root)
out=root/'output/production-validation'
tools=root/'output/android-tools'
version='1.18.3';jar=tools/f'bundletool-all-{version}.jar'
expected='a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(jar)==expected,'Unexpected bundletool binary'
java='/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java'
signing=Path.home()/'.config/weekaboo/signing'
key=signing/'android-release.p12';password=signing/'android-release.password'
assert key.is_file() and password.is_file()
assert password.stat().st_mode & 0o077 == 0,'Signing password must be owner-only'
aab=root/'android/app/build/outputs/bundle/release/app-release.aab'
archive=out/'weekaboo-universal.apks';apk=out/'weekaboo-from-bundle.apk'
def run(*args):subprocess.run(args,check=True,capture_output=True)
run(java,'-jar',str(jar),'validate','--bundle='+str(aab))
run(java,'-jar',str(jar),'build-apks','--bundle='+str(aab),'--output='+str(archive),'--mode=universal','--overwrite','--ks='+str(key),'--ks-key-alias=weekaboo-release','--ks-pass=file:'+str(password),'--key-pass=file:'+str(password))
with zipfile.ZipFile(archive) as z:apk.write_bytes(z.read('universal.apk'))
signer=sorted((Path.home()/'Library/Android/sdk/build-tools').glob('*/apksigner'))[-1]
env=dict(os.environ,JAVA_HOME=str(Path(java).parents[1]))
subprocess.run([str(signer),'verify','--verbose',str(apk)],env=env,check=True,capture_output=True)
with zipfile.ZipFile(apk) as z:
 inventory=json.loads(z.read('assets/public/licenses/shared/inventory.json'))
 assert inventory['packages']
 for package in inventory['packages']:
  assert package['noticeFiles']
  for file in package['noticeFiles']:
   path='assets/public/licenses/shared/'+package['name'].replace('/','__')+'@'+package['version']+'/'+file
   assert z.read(path)==(root/'dist-native'/path.removeprefix('assets/public/')).read_bytes()
receipt=dict(bundletool=version,aabSha256=sha(aab),validated=True,generatedUniversalAPK=True,generatedAPKSignatureVerified=True,generatedAPKSha256=sha(apk),sharedNoticePackages=len(inventory['packages']),installed=False,uploaded=False)
(out/'android-bundletool-proof.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('AAB validated; signed universal APK generated and all shared notices verified. No installation or upload.')
