#!/usr/bin/env python3
"""Collect local native Android notices. No network, installation or signing.
Incomplete debug manifests are explicit; release packaging fails closed.
"""
import argparse,hashlib,io,json,os,re,shutil,subprocess,tempfile,zipfile,xml.etree.ElementTree as E
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SCOPE='Resolved Android runtime artifacts and locally available original notice texts. Presence does not establish complete binary/transitive or SDK distribution compliance. Unresolved items block release packaging.'
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

def collect(graph,cache):
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
  reasons=[]
  if not any(notice['file'].lower().endswith(('.txt','license','notice','copying','.md')) for notice in notices):reasons.append('Full upstream license/notice text not found in locally resolved artifact; POM declarations are metadata only')
  if item['group'].startswith('com.google.android.gms') or item['group']=='com.google.android.libraries.identity.googleid':reasons.append('Third-party text retained; Google SDK distribution terms still require explicit review')
  if reasons:unresolved.append({'coordinate':coordinate,'reasons':reasons})
  packages.append({'coordinate':coordinate,'artifactType':suffix,'artifactSha256':sha(raw),'pomSha256':sorted(set(pomhashes)),'declaredLicenses':pomlicenses,'notices':notices,'status':'unresolved' if reasons else 'local_notice_text_preserved'})
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
 manifest={'schemaVersion':1,'scope':SCOPE,'configuration':graph['configuration'],'packages':packages,'localProjects':graph.get('projects',[]),'complete':not unresolved,'unresolved':unresolved,'remainingReview':['Resolved binary linkage, complete transitive copyright/NOTICE obligations, project licensing and generated asset rights remain separate reviews','Gradle runtime dependency lockfile is not yet committed; current versions and artifact hashes are recorded here']}
 files['inventory.json']=(json.dumps(manifest,indent=2,sort_keys=True)+'\n').encode()
 files['README.txt']=('Weekaboo Android native dependency acknowledgments\n\nOriginal locally available LICENSE, NOTICE, COPYING and third-party license files are preserved verbatim, including nested dependency archive entries. inventory.json identifies artifact versions/digests and unresolved items. POM license names/URLs are metadata, not substitutes for full license texts. This collection is explicitly incomplete and is not release approval. JavaScript notices are in ../shared.\n').encode()
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
  print(f"Android native notices: {len(manifest['packages'])} resolved components, {len(files)-2} original files; {len(manifest['unresolved'])} unresolved components. Inventory remains incomplete.")
  if not args.allow_incomplete and not manifest['complete']:raise SystemExit('Release blocked: native Android acknowledgment review is incomplete; see generated inventory.json. --allow-incomplete is for debug/sync evidence only.')
if __name__=='__main__':main()
