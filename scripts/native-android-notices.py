#!/usr/bin/env python3
"""Collect native Android notices offline from artifacts and reviewed supplements.
Exact artifact and notice digests bind supplements to the reviewed dependency.
Incomplete debug manifests are explicit; release packaging fails closed.
"""
import argparse,hashlib,io,json,os,re,shutil,subprocess,tempfile,zipfile,xml.etree.ElementTree as E
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SCOPE='Resolved Android runtime artifacts, original embedded notices and exact-version reviewed supplements. Completion refers to this acknowledgment inventory, not overall release, store or legal approval.'
def sha(data):return hashlib.sha256(data).hexdigest()
def collect_zip(data,prefix='',depth=0):
 if depth>3:raise ValueError('Nested dependency archive depth exceeds supported limit')
 result={}
 with zipfile.ZipFile(io.BytesIO(data)) as archive:
  for entry in sorted(archive.namelist()):
   if entry.endswith('/'):continue
   if '..' in Path(entry).parts or entry.startswith('/'):raise ValueError('Unsafe dependency archive path')
   base=Path(entry).name
   if re.fullmatch(r'(?:licen[sc]e|notice|copying)(?:[._-].*)?|third_party_licenses\.(?:txt|json)',base,re.I):
    body=archive.read(entry)
    if not body.strip() or b'\0' in body:raise ValueError('Empty or binary notice: '+entry)
    result[prefix+entry]=body
   elif base.endswith('.jar'):
    result.update(collect_zip(archive.read(entry),prefix+entry+'/',depth+1))
 return result

def load_supplements(directory):
 manifest=directory/'supplements.json'
 if not manifest.exists():return {}
 data=json.loads(manifest.read_text())
 if data.get('schemaVersion')!=1:raise ValueError('Unsupported Android supplemental notice schema')
 result={}
 for item in data['entries']:
  coordinate=item['coordinate']
  if coordinate in result:raise ValueError('Duplicate supplemental coordinate: '+coordinate)
  if item.get('kind') not in ('open-source','vendor-sdk') or not item.get('rationale') or not item.get('reviewedAt'):raise ValueError('Incomplete supplemental review: '+coordinate)
  if not item.get('artifactSha256') or not all(re.fullmatch(r'[a-f0-9]{64}',digest) for digest in item['artifactSha256']):raise ValueError('Missing reviewed artifact digests: '+coordinate)
  required='license' if item['kind']=='open-source' else 'vendor-terms'
  if not any(file.get('role')==required for file in item['files']):raise ValueError('Missing supplemental license or vendor terms: '+coordinate)
  for file in item['files']:
   path=Path(file['file'])
   if path.is_absolute() or '..' in path.parts or not path.parts:raise ValueError('Unsafe supplemental notice path')
   source=directory/path
   if not source.resolve().is_relative_to(directory.resolve()):raise ValueError('Supplemental notice escapes its directory')
   body=source.read_bytes()
   if not body.strip() or b'\0' in body or sha(body)!=file['sha256']:raise ValueError('Supplemental notice digest/content mismatch: '+file['file'])
   if not file.get('sourceUrl','').startswith('https://'):raise ValueError('Missing upstream notice provenance: '+file['file'])
  result[coordinate]=item
 return result

def collect(graph,cache,supplement_directory=None):
 supplement_directory=supplement_directory or ROOT/'licenses/android'
 supplements=load_supplements(supplement_directory)
 packages=[];files={};unresolved=[]
 for item in graph['artifacts']:
  coordinate=':'.join(item[k] for k in ('group','name','version'))
  if not re.fullmatch(r'[A-Za-z0-9_.:+-]+',coordinate):raise ValueError('Unsafe dependency coordinate')
  source=Path(item['file']);raw=source.read_bytes();key=coordinate.replace(':','/')
  suffix=item['extension']+(('-'+item['classifier']) if item.get('classifier') else '')
  texts=collect_zip(raw) if source.suffix in ('.aar','.jar') else {}
  pomlicenses=[];pomhashes=[]
  for pom in sorted((cache/item['group']/item['name']/item['version']).glob('*/*.pom')):
   body=pom.read_bytes();doc=E.fromstring(body);ns={'m':'http://maven.apache.org/POM/4.0.0'};pomhashes.append(sha(body))
   for license in doc.findall('.//m:licenses/m:license',ns):pomlicenses.append({'name':license.findtext('m:name',namespaces=ns),'url':license.findtext('m:url',namespaces=ns)})
  notices=[]
  for path,body in sorted(texts.items()):
   name=key+'/'+suffix+'/'+path
   if name in files and files[name]!=body:raise ValueError('Conflicting native notice output')
   files[name]=body;notices.append({'sourceEntry':path,'file':name,'sha256':sha(body)})
  review=supplements.get(coordinate)
  if review:
   if sha(raw) not in review['artifactSha256']:raise ValueError('Artifact differs from reviewed supplemental notices: '+coordinate)
   for notice in review['files']:
    body=(supplement_directory/notice['file']).read_bytes();name='supplemental/'+notice['file']
    if name in files and files[name]!=body:raise ValueError('Conflicting supplemental notice output')
    files[name]=body;notices.append(dict(notice,file=name,sourceEntry='supplemental/'+notice['file']))
  reasons=[]
  if not any(notice['file'].lower().endswith(('.txt','license','notice','copying','.md')) for notice in notices):reasons.append('Full upstream license/notice text not found in locally resolved artifact; POM declarations are metadata only')
  if (item['group'].startswith('com.google.android.gms') or item['group']=='com.google.android.libraries.identity.googleid') and (not review or review['kind']!='vendor-sdk'):reasons.append('Third-party text retained; Google SDK distribution terms still require explicit review')
  if reasons:unresolved.append({'coordinate':coordinate,'reasons':reasons})
  packages.append({'coordinate':coordinate,'artifactType':suffix,'artifactSha256':sha(raw),'pomSha256':sorted(set(pomhashes)),'declaredLicenses':pomlicenses,'notices':notices,'review':{k:review[k] for k in ('kind','licenseId','reviewedAt','rationale')} if review else None,'status':'unresolved' if reasons else 'notice_text_preserved'})
 # Capacitor's native project is an installed npm dependency, absent from Maven artifacts.
 capacitor=ROOT/'node_modules/@capacitor/android';metadata=json.loads((capacitor/'package.json').read_text());locked=json.loads((ROOT/'package-lock.json').read_text())['packages']['node_modules/@capacitor/android']['version']
 if metadata['version']!=locked:raise ValueError('Capacitor native dependency differs from npm lock')
 body=(capacitor/'LICENSE').read_bytes()
 if not body.strip():raise ValueError('Missing Capacitor native LICENSE')
 name='capacitor-android/'+locked+'/LICENSE';files[name]=body
 packages.append({'coordinate':'@capacitor/android:'+locked,'notices':[{'sourceEntry':'LICENSE','file':name,'sha256':sha(body)}],'status':'local_notice_text_preserved'})
 known={'project :app','project :capacitor-android','project :capacitor-cordova-android-plugins'}
 for project in graph.get('projects',[]):
  if project not in known:unresolved.append({'coordinate':project,'reasons':['Unrecognized local Gradle dependency project requires notice review']})
 lock=ROOT/'android/app/gradle.lockfile'
 manifest={'schemaVersion':1,'scope':SCOPE,'configuration':graph['configuration'],'packages':packages,'localProjects':graph.get('projects',[]),'dependencyLockSha256':sha(lock.read_bytes()) if lock.exists() else None,'complete':not unresolved,'unresolved':unresolved,'remainingReview':['Final binary linkage, project licensing, generated asset rights, provider terms, and store distribution remain separate reviews']}
 files['inventory.json']=(json.dumps(manifest,indent=2,sort_keys=True)+'\n').encode()
 files['README.txt']=('Weekaboo Android native dependency acknowledgments\n\nOriginal LICENSE, NOTICE, COPYING and third-party license files are preserved verbatim, including nested dependency archive entries. Reviewed supplemental texts supply separately published licenses and notices. inventory.json identifies exact artifact versions/digests, source provenance and any unresolved items. POM license names/URLs alone are not substitutes for full license texts. Vendor SDK terms remain separate from Weekaboo\'s MIT license. This collection is not release approval. JavaScript notices are in ../shared.\n').encode()
 return manifest,files

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--allow-incomplete',action='store_true',help='For debug/sync only; retain explicit blockers without approving release');parser.add_argument('--graph',type=Path,help='Use existing offline Gradle graph evidence');args=parser.parse_args()
 env=dict(os.environ);env.pop('WEEKABOO_SIGNING_DIRECTORY',None)
 jdk=Path('/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home')
 if jdk.exists():env.setdefault('JAVA_HOME',str(jdk))
 with tempfile.TemporaryDirectory(prefix='weekaboo-native-notice-graph-') as tmp:
  graphpath=args.graph or Path(tmp)/'graph.json'
  if not args.graph:
   proc=subprocess.run([str(ROOT/'android/gradlew'),'--offline','--console=plain','-p',str(ROOT/'android'),'-I',str(ROOT/'scripts/native-android-notices.gradle'),':app:weekabooNativeNoticeGraph','-PweekabooNoticesGraphOutput='+str(graphpath)],env=env,capture_output=True,text=True)
   if proc.returncode:raise RuntimeError('Offline native dependency inventory failed. Run sh scripts/android.sh resolve once to resolve the project dependencies (requires network), then retry. No dependency downloads are performed by this collector.\n'+proc.stderr[-2000:])
  graph=json.loads(graphpath.read_text());manifest,files=collect(graph,Path(env.get('GRADLE_USER_HOME',str(Path.home()/'.gradle')))/'caches/modules-2/files-2.1')
  output=ROOT/'android/app/src/main/assets/public/licenses/native-android';output.parent.mkdir(parents=True,exist_ok=True)
  staging=Path(tempfile.mkdtemp(prefix='.native-android-',dir=output.parent))
  try:
   for path,body in files.items():target=staging/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body)
   if output.exists():shutil.rmtree(output)
   staging.rename(output)
  finally:
   if staging.exists():shutil.rmtree(staging)
  print(f"Android native notices: {len(manifest['packages'])} resolved components, {len(files)-2} notice files; {len(manifest['unresolved'])} unresolved components. Inventory {'complete' if manifest['complete'] else 'incomplete'}.")
  if not args.allow_incomplete and not manifest['complete']:raise SystemExit('Release blocked: native Android acknowledgment review is incomplete; see generated inventory.json. --allow-incomplete is for debug/sync evidence only.')
if __name__=='__main__':main()
