// Notice inventory for packages actually present in a bundler's module graph.
// Upstream texts are copied verbatim; this is not a project-license decision.
import {readFile, readdir} from 'node:fs/promises';
import {dirname, join, resolve, sep} from 'node:path';
export async function collectModuleNotices(root, moduleIds) {
  const modulesRoot=join(resolve(root),'node_modules');
  const packages=new Map();
  for(const id of moduleIds) {
    const clean=id.replace(/^\0/,'').split('?')[0];
    if(!clean.includes('node_modules/'))continue;
    let folder=dirname(resolve(root,clean));
    while(folder.startsWith(modulesRoot+sep)) {
      try {
        const pkg=JSON.parse(await readFile(join(folder,'package.json'),'utf8'));
        if(pkg.name && pkg.version){packages.set(folder,pkg);break;}
      }catch(error){if(error.code!=='ENOENT' && error.code!=='ENOTDIR')throw error;}
      folder=dirname(folder);
    }
  }
  const assets=new Map(),inventory=[];
  for(const [folder,pkg] of packages) {
    const entries=await readdir(folder,{withFileTypes:true});
    const files=entries.filter(e=>e.isFile() && /^(licen[sc]e|notice|copying)([.-]|$)/i.test(e.name)).map(e=>e.name).sort();
    if(!files.length) {
      const readme=entries.find(e=>e.isFile() && /^readme\.md$/i.test(e.name));
      if(readme && /License[\s\S]*Copyright[\s\S]*Permission is hereby granted/i.test(await readFile(join(folder,readme.name),'utf8')))files.push(readme.name);
    }
    const prefix=pkg.name.replaceAll('/','__')+'@'+pkg.version;
    for(const file of files)assets.set(prefix+'/'+file,await readFile(join(folder,file)));
    inventory.push({name:pkg.name,version:pkg.version,license:pkg.license || null,repository:typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url || null,noticeFiles:files});
  }
  return {assets,inventory:inventory.sort((a,b)=>a.name.localeCompare(b.name))};
}
