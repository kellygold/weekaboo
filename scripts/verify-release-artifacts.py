#!/usr/bin/env python3
"""Inspect locally built artifacts, public metadata and packaging boundaries.
Does not upload, install, read user vaults or export signing keys.
"""
import hashlib,json,os,plistlib,subprocess,tempfile,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
os.chdir(root)
out=root/'output/production-validation';out.mkdir(parents=True,exist_ok=True)
meta=json.loads(Path('package.json').read_text());version=meta['version'];build=meta['weekabooBuild']
env=dict(os.environ)
jdk=Path('/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home')
if jdk.exists():env.setdefault('JAVA_HOME',str(jdk))
def run(*args):return subprocess.run(args,env=env,check=True,capture_output=True).stdout
sdk=Path.home()/'Library/Android/sdk'
apk=Path('android/app/build/outputs/apk/release/app-release.apk');aab=Path('android/app/build/outputs/bundle/release/app-release.aab')
assert apk.is_file() and aab.is_file()
signer=sorted((sdk/'build-tools').glob('*/apksigner'))[-1]
run(str(signer),'verify','--verbose',str(apk))
manifest=run(str(sdk/'cmdline-tools/latest/bin/apkanalyzer'),'manifest','print',str(apk))
(out/'android-current-manifest.xml').write_bytes(manifest)
import xml.etree.ElementTree as E
xml=E.fromstring(manifest);ns='{http://schemas.android.com/apk/res/android}';app=xml.find('application')
assert xml.get(ns+'versionName')==version and int(xml.get(ns+'versionCode'))==build
assert app.get(ns+'debuggable','false')=='false' and app.get(ns+'allowBackup')=='false'
def check_config(config):
 assert config.get('loggingBehavior')=='none'
 assert not config.get('server',{}).get('url')
 for platform in ['ios','android']:assert not config.get(platform,{}).get('webContentsDebuggingEnabled')
def private(path):return path.endswith(('.env','.db','.sqlite','.p12','.password','.jks','.keystore'))
with zipfile.ZipFile(apk) as z:
 check_config(json.loads(z.read('assets/capacitor.config.json')))
 assert not any(private(p) for p in z.namelist())
android={'version':version,'build':build,'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'aabSha256':hashlib.sha256(aab.read_bytes()).hexdigest(),'signatureVerified':True,'debuggable':False,'backupAllowed':False,'remoteServerUrl':False,'pluginArgumentLogging':False,'privatePathsAbsent':True,'installedOnPhysicalAndroid':False}
(out/'android-current-candidate.json').write_text(json.dumps(android,indent=2))
ios=Path('output/production-validation/Weekaboo.xcarchive/Products/Applications/App.app')
info=plistlib.loads((ios/'Info.plist').read_bytes());assert info['CFBundleShortVersionString']==version and int(info['CFBundleVersion'])==build
assert info['CFBundleIdentifier']=='app.weekaboo.calendar' and info.get('CAPACITOR_DEBUG') not in ['true',True]
check_config(json.loads((ios/'capacitor.config.json').read_text()))
run('codesign','--verify','--deep','--strict',str(ios))
provision=plistlib.loads(run('security','cms','-D','-i',str(ios/'embedded.mobileprovision')))
assert not any(private(str(p)) for p in ios.rglob('*'))
assert (ios/'Assets.car').is_file()
receipt={'releaseArchive':True,'signatureVerified':True,'version':version,'build':build,'debugFlag':False,'nativeLogging':False,'serverUrl':False,'developmentProvisioned':provision['Entitlements'].get('get-task-allow',False),'storeExported':False,'uploaded':False,'privatePathsAbsent':True,'appBinarySha256':hashlib.sha256((ios/info['CFBundleExecutable']).read_bytes()).hexdigest()}
(out/'ios-release-archive.json').write_text(json.dumps(receipt,indent=2))
# Verify the actual exported IPA, independently of its source archive.
ipa=Path('output/production-validation/ios-development-export/App.ipa')
with tempfile.TemporaryDirectory(prefix='weekaboo-ipa-check-') as temporary:
 run('ditto','-xk',str(ipa),temporary)
 exported=Path(temporary)/'Payload/App.app'
 run('codesign','--verify','--deep','--strict',str(exported))
 exported_info=plistlib.loads((exported/'Info.plist').read_bytes())
 assert exported_info['CFBundleShortVersionString']==version and int(exported_info['CFBundleVersion'])==build
 assert exported_info['CFBundleIdentifier']=='app.weekaboo.calendar'
 assert exported_info.get('CAPACITOR_DEBUG') not in ['true',True]
 check_config(json.loads((exported/'capacitor.config.json').read_text()))
 profile=plistlib.loads(run('security','cms','-D','-i',str(exported/'embedded.mobileprovision')))
 assert not any(private(str(p)) for p in exported.rglob('*'))
 (out/'ios-development-export-proof.json').write_text(json.dumps(dict(version=version,build=build,sha256=hashlib.sha256(ipa.read_bytes()).hexdigest(),signatureVerified=True,developmentProvisioned=profile['Entitlements'].get('get-task-allow',False),provisionedDeviceCount=len(profile.get('ProvisionedDevices',[])),privatePathsAbsent=True,uploaded=False),indent=2))
mac=Path('output/standalone-desktop/package-signed/Weekaboo-darwin-arm64/Weekaboo.app')
info=plistlib.loads((mac/'Contents/Info.plist').read_bytes());assert info['CFBundleShortVersionString']==version and int(info['CFBundleVersion'])==build
assert (mac/'Contents/Resources'/info['CFBundleIconFile']).is_file()
run('codesign','--verify','--deep','--strict',str(mac))
print(f'Android, iOS and macOS artifacts agree on {version} / {build}; signatures and packaging checks passed. iOS archive is development-provisioned, not a store export.')
