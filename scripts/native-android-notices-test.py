import importlib.util,io,json,tempfile,unittest,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('notices',Path(__file__).with_name('native-android-notices.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def archive(entries):
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w') as z:
  for k,v in entries.items():z.writestr(k,v)
 return out.getvalue()
class Notices(unittest.TestCase):
 def supplemental_fixture(self,tmp):
  root=Path(tmp);artifact=root/'example.jar';artifact.write_bytes(archive({'README':'compiled artifact'}))
  directory=root/'supplements';directory.mkdir();body=b'Original full license\n';(directory/'LICENSE').write_bytes(body)
  graph={'configuration':'releaseRuntimeClasspath','projects':[],'artifacts':[{'group':'example','name':'sdk','version':'1.0','extension':'jar','classifier':None,'file':str(artifact)}]}
  data={'schemaVersion':1,'entries':[{'coordinate':'example:sdk:1.0','artifactSha256':[m.sha(artifact.read_bytes())],'kind':'open-source','licenseId':'MIT','reviewedAt':'2026-09-11','rationale':'Exact-version upstream review','files':[{'file':'LICENSE','sha256':m.sha(body),'sourceUrl':'https://example.test/v1/LICENSE','role':'license'}]}]}
  (directory/'supplements.json').write_text(json.dumps(data));return graph,directory,data
 def test_reviewed_exact_artifact_supplies_missing_license(self):
  with tempfile.TemporaryDirectory() as tmp:
   graph,directory,data=self.supplemental_fixture(tmp)
   manifest,files=m.collect(graph,Path(tmp),directory)
   self.assertTrue(manifest['complete']);self.assertEqual(files['supplemental/LICENSE'],b'Original full license\n')
 def test_changed_artifact_requires_fresh_review(self):
  with tempfile.TemporaryDirectory() as tmp:
   graph,directory,data=self.supplemental_fixture(tmp)
   Path(graph['artifacts'][0]['file']).write_bytes(archive({'README':'new artifact bytes'}))
   with self.assertRaisesRegex(ValueError,'Artifact differs'):m.collect(graph,Path(tmp),directory)
 def test_modified_or_traversing_supplement_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   graph,directory,data=self.supplemental_fixture(tmp)
   (directory/'LICENSE').write_text('tampered')
   with self.assertRaisesRegex(ValueError,'digest/content mismatch'):m.collect(graph,Path(tmp),directory)
   data['entries'][0]['files'][0]['file']='../LICENSE'
   (directory/'supplements.json').write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'Unsafe supplemental'):m.collect(graph,Path(tmp),directory)
 def test_new_version_does_not_inherit_old_review(self):
  with tempfile.TemporaryDirectory() as tmp:
   graph,directory,data=self.supplemental_fixture(tmp);graph['artifacts'][0]['version']='1.1'
   manifest,_=m.collect(graph,Path(tmp),directory)
   self.assertFalse(manifest['complete'])
 def test_notice_only_cannot_replace_full_license(self):
  with tempfile.TemporaryDirectory() as tmp:
   graph,directory,data=self.supplemental_fixture(tmp);data['entries'][0]['files'][0]['role']='notice'
   (directory/'supplements.json').write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'Missing supplemental license'):m.collect(graph,Path(tmp),directory)
 def test_verbatim_nested_notices(self):
  body=archive({'classes.jar':archive({'META-INF/LICENSE':'original\n'}),'third_party_licenses.txt':'third party\n','third_party_licenses.json':'{}'})
  files=m.collect_zip(body);self.assertEqual(files['classes.jar/META-INF/LICENSE'],b'original\n');self.assertEqual(files['third_party_licenses.txt'],b'third party\n');self.assertEqual(len(files),3)
 def test_rejects_empty_notice(self):
  with self.assertRaisesRegex(ValueError,'Empty'):m.collect_zip(archive({'LICENSE':'\n'}))
 def test_rejects_traversal(self):
  with self.assertRaisesRegex(ValueError,'Unsafe'):m.collect_zip(archive({'../LICENSE':'bad'}))
 def test_missing_text_is_explicit_blocker_and_deterministic(self):
  with tempfile.TemporaryDirectory() as tmp:
   artifact=Path(tmp)/'example.jar';artifact.write_bytes(archive({'README':'not a license'}))
   graph={'configuration':'releaseRuntimeClasspath','projects':['project :app'],'artifacts':[{'group':'example','name':'sdk','version':'1.0','extension':'jar','classifier':None,'file':str(artifact)}]}
   one=m.collect(graph,Path(tmp),Path(tmp)/"supplements");two=m.collect(graph,Path(tmp),Path(tmp)/"supplements");self.assertEqual(one,two);self.assertFalse(one[0]['complete']);self.assertEqual(one[0]['unresolved'][0]['coordinate'],'example:sdk:1.0')
 def test_google_third_party_text_does_not_silently_clear_sdk_terms(self):
  with tempfile.TemporaryDirectory() as tmp:
   artifact=Path(tmp)/'auth.aar';artifact.write_bytes(archive({'third_party_licenses.txt':'Original licenses\n','third_party_licenses.json':'{}'}))
   graph={'configuration':'releaseRuntimeClasspath','projects':[],'artifacts':[{'group':'com.google.android.gms','name':'play-services-auth','version':'22.0.0','extension':'aar','classifier':None,'file':str(artifact)}]}
   manifest,files=m.collect(graph,Path(tmp),Path(tmp)/"supplements");self.assertTrue(any('SDK distribution terms' in reason for reason in manifest['unresolved'][0]['reasons']));self.assertEqual(files['com.google.android.gms/play-services-auth/22.0.0/aar/third_party_licenses.txt'],b'Original licenses\n')
if __name__=='__main__':unittest.main()
