// Read-only proof that emitted upstream notices survive native packaging verbatim.
import assert from 'node:assert/strict';
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {extractFile} from '@electron/asar';
import {createHash} from 'node:crypto';
import {collectModuleNotices} from './module-notices.mjs';
const root=resolve(import.meta.dirname,'..');
const read=path=>readFile(join(root,path));
const sha=data=>createHash('sha256').update(data).digest('hex');
const zipRead=(archive,path)=>execFileSync('unzip',['-p',join(root,archive),path],{maxBuffer:32*1024*1024});
const proof={at:new Date().toISOString(),renderers:{},artifacts:{},scope:'Bundled JavaScript and Electron notices only. Native mobile SDK and project/asset rights remain separate gates.'};
const sourceFiles=new Map();
for(const dir of ['dist','dist-native','dist-desktop']) {
  const inventory=JSON.parse(await read(dir+'/licenses/shared/inventory.json'));
  assert(inventory.packages.length>0);
  let count=0;
  for(const pkg of inventory.packages) {
    assert(pkg.noticeFiles.length>0,pkg.name+' has no notices');
    const source=join('node_modules',pkg.name);
    const installed=JSON.parse(await read(source+'/package.json'));
    assert.equal(installed.version,pkg.version,'Installed source changed since build: '+pkg.name);
    for(const file of pkg.noticeFiles) {
      const relative='shared/'+pkg.name.replaceAll('/','__')+'@'+pkg.version+'/'+file;
      const expected=await read(source+'/'+file);
      assert(expected.length>0);
      assert.deepEqual(await read(dir+'/licenses/'+relative),expected,dir+'/'+relative);
      if(dir==='dist-native')sourceFiles.set(relative,expected);
      count++;
    }
  }
  proof.renderers[dir]={packages:inventory.packages.length,verbatimNoticeFiles:count,inventorySha256:sha(await read(dir+'/licenses/shared/inventory.json'))};
}
// Include source, font and data notices plus generated inventory/readme.
for(const name of await readdir(join(root,'dist-native/licenses'))) {
  if(name.endsWith('.txt'))sourceFiles.set(name,await read('dist-native/licenses/'+name));
}
sourceFiles.set('shared/inventory.json',await read('dist-native/licenses/shared/inventory.json'));
const targets=[
 ['apk','android/app/build/outputs/apk/release/app-release.apk','assets/public/licenses/'],
 ['aab','android/app/build/outputs/bundle/release/app-release.aab','base/assets/public/licenses/'],
 ['ipa','output/production-validation/ios-development-export/App.ipa','Payload/App.app/public/licenses/'],
];
for(const [label,archive,prefix] of targets) {
  for(const [file,bytes] of sourceFiles)assert.deepEqual(zipRead(archive,prefix+file),bytes,label+'/'+file);
  proof.artifacts[label]={sha256:sha(await read(archive)),verifiedFiles:sourceFiles.size};
}
const app='output/production-validation/Weekaboo.xcarchive/Products/Applications/App.app';
for(const [file,bytes] of sourceFiles)assert.deepEqual(await read(app+'/public/licenses/'+file),bytes,'iOS archive/'+file);
proof.artifacts.iosArchive={verifiedFiles:sourceFiles.size};
const asar=join(root,'output/standalone-desktop/package-signed/Weekaboo-darwin-arm64/Weekaboo.app/Contents/Resources/app.asar');
const desktopInventory=JSON.parse(await read('dist-desktop/licenses/shared/inventory.json'));
for(const pkg of desktopInventory.packages)for(const file of pkg.noticeFiles) {
 const path='dist-desktop/licenses/shared/'+pkg.name.replaceAll('/','__')+'@'+pkg.version+'/'+file;
 assert.deepEqual(extractFile(asar,path),await read(path),'mac/'+path);
}
const graph=JSON.parse(await read('output/standalone-desktop/bundle-inputs.json'));
const main=await collectModuleNotices(root,Object.keys(graph.inputs));
assert(main.inventory.every(pkg=>pkg.noticeFiles.length));
for(const [file,bytes] of main.assets)assert.deepEqual(extractFile(asar,'licenses/desktop/'+file),bytes,'mac/main/'+file);
for(const file of ['LICENSE','LICENSES.chromium.html'])assert.deepEqual(extractFile(asar,'licenses/desktop/electron/'+file),await read('node_modules/electron/dist/'+file));
proof.artifacts.mac={asarSha256:sha(await readFile(asar)),rendererPackages:desktopInventory.packages.length,mainPackages:main.inventory.length,electronNotices:2};
await writeFile(join(root,'output/production-validation/bundled-notices-proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
