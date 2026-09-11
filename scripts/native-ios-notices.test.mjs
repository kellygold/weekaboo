import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {collectNativeIosNotices, writeNativeIosNotices} from './native-ios-notices.mjs';
const git=(dir,...args)=>execFileSync('git',['-C',dir,...args],{stdio:['ignore','pipe','pipe']}).toString().trim();
async function fixture(t, files = {'LICENSE':'Example license\n','vendor/COPYING.txt':'Nested license\n'}) {
  const root=await mkdtemp(join(tmpdir(),'weekaboo-ios-notices-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const checkoutRoots=[join(root,'checkouts')],repo=join(checkoutRoots[0],'test-sdk');await mkdir(repo,{recursive:true});
  git(repo,'init');git(repo,'config','user.name','Synthetic test');git(repo,'config','user.email','test@example.invalid');
  for(const [path,body] of Object.entries(files)){await mkdir(join(repo,path,'..'),{recursive:true});await writeFile(join(repo,path),body);}
  git(repo,'add','.');git(repo,'commit','-m','fixture');const revision=git(repo,'rev-parse','HEAD');
  const lockPath=join(root,'Package.resolved');const pin={identity:'test-sdk',location:'https://example.invalid/sdk',state:{version:'1.0.0',revision}};
  const writeLock=async()=>writeFile(lockPath,JSON.stringify({pins:[pin]}));await writeLock();
  return {root,repo,checkoutRoots,lockPath,pin,writeLock};
}
test('preserves exact nested texts and deterministic output',async t=>{
 const f=await fixture(t);const one=await collectNativeIosNotices(f),two=await collectNativeIosNotices(f);
 assert.deepEqual(one,two);assert.equal(one.files.get('test-sdk@1.0.0/vendor/COPYING.txt').toString(),'Nested license\n');
 const outputPath=join(f.root,'out');await writeNativeIosNotices({...f,outputPath});assert.deepEqual(await readFile(join(outputPath,'inventory.json')),one.files.get('inventory.json'));
});
test('fails missing revision and preserves previously generated notices',async t=>{
 const f=await fixture(t);const outputPath=join(f.root,'out');await writeNativeIosNotices({...f,outputPath});const before=await readFile(join(outputPath,'inventory.json'));
 f.pin.state.revision='0'.repeat(40);await f.writeLock();await assert.rejects(writeNativeIosNotices({...f,outputPath}),/Missing local checkout/);assert.deepEqual(await readFile(join(outputPath,'inventory.json')),before);
});
test('fails missing or empty upstream license text',async t=>{
 const f=await fixture(t,{'README.md':'SDK without notices'});await assert.rejects(collectNativeIosNotices(f),/Missing upstream license/);
 await writeFile(join(f.repo,'LICENSE'),'\n');git(f.repo,'add','.');git(f.repo,'commit','-m','empty');f.pin.state.revision=git(f.repo,'rev-parse','HEAD');await f.writeLock();await assert.rejects(collectNativeIosNotices(f),/Empty or binary/);
});
test('fails locally modified package instead of mismatching built source',async t=>{
 const f=await fixture(t);await writeFile(join(f.repo,'LICENSE'),'Modified');await assert.rejects(collectNativeIosNotices(f),/modified tracked files/);
});
test('includes notices from exact pinned submodule and rejects a changed submodule',async t=>{
 const f=await fixture(t);const nested=join(f.root,'nested');await mkdir(nested);git(nested,'init');git(nested,'config','user.name','Synthetic test');git(nested,'config','user.email','test@example.invalid');
 await writeFile(join(nested,'LICENSE'),'Nested submodule license\n');git(nested,'add','.');git(nested,'commit','-m','submodule');
 git(f.repo,'-c','protocol.file.allow=always','submodule','add',nested,'vendor/core');git(f.repo,'commit','-am','pin submodule');f.pin.state.revision=git(f.repo,'rev-parse','HEAD');await f.writeLock();
 const result=await collectNativeIosNotices(f);assert.equal(result.files.get('test-sdk@1.0.0/vendor/core/LICENSE').toString(),'Nested submodule license\n');assert.equal(result.inventory.packages[0].submodules.length,1);
 await writeFile(join(f.repo,'vendor/core/LICENSE'),'Changed submodule');await assert.rejects(collectNativeIosNotices(f),/modified tracked files/);
});
