import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {collectModuleNotices} from './module-notices.mjs';
// Every browser/native/desktop renderer build carries its actual dependencies'
// license texts. Native SDK/Electron main-process notices are separate scopes.
export function sharedNotices() {
  let root;
  return {
    name:'weekaboo-shared-notices',apply:'build',
    configResolved(config){root=config.root;},
    async generateBundle(_options,bundle) {
      const ids=new Set(Object.values(bundle).filter(item=>item.type==='chunk').flatMap(chunk=>Object.keys(chunk.modules)));
      const {assets,inventory}=await collectModuleNotices(root,ids);
      const missing=inventory.filter(pkg=>!pkg.noticeFiles.length);
      if(missing.length)this.error('Missing bundled dependency notices: '+missing.map(pkg=>pkg.name).join(', '));
      for(const [file,source] of assets)this.emitFile({type:'asset',fileName:'licenses/shared/'+file,source});
      // Explicitly reviewed source/data/font notices; never sweep the repo.
      for(const entry of await readdir(resolve(root,'licenses'),{withFileTypes:true})) {
        if(entry.isFile() && entry.name.endsWith('.txt'))this.emitFile({type:'asset',fileName:'licenses/'+entry.name,source:await readFile(join(root,'licenses',entry.name))});
      }
      this.emitFile({type:'asset',fileName:'licenses/shared/inventory.json',source:JSON.stringify({scope:'JavaScript packages included in this renderer build; native SDK, project and generated asset rights require separate review.',packages:inventory},null,2)+'\n'});
      this.emitFile({type:'asset',fileName:'licenses/README.txt',source:'Third-party notices for Weekaboo\n\nshared/inventory.json lists the packages included in this JavaScript build. Each package folder retains the upstream license/notice text verbatim. Source/data/font notices are alongside this file. This inventory does not relicense dependencies or establish Weekaboo project/mascot/audio redistribution rights. Native-platform SDK notices are separate.\n\nICAL.js 2.2.1 is unmodified and licensed under MPL-2.0. Corresponding source: https://github.com/kewisch/ical.js/tree/v2.2.1\n'});
    }
  };
}
