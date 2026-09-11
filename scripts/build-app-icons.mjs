// Render the existing vector mascot into platform icon formats; no generated imagery or remote assets.
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mascot=await readFile(path.join(root,'public/brand/weekaboo-mark.svg'),'utf8');
const inner=mascot.replace(/<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
const paper='#f7f6ee';
function svg(kind){
 const foreground=kind==='foreground', mac=kind==='mac', round=kind==='round';
 const width=foreground?470:660, height=width*406/350;
 const background=foreground?'':round?`<circle cx="512" cy="512" r="512" fill="${paper}"/>`:`<rect x="${mac?52:0}" y="${mac?52:0}" width="${mac?920:1024}" height="${mac?920:1024}" rx="${mac?190:0}" fill="${paper}"/>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background}<svg x="${(1024-width)/2}" y="${(1024-height)/2}" width="${width}" height="${height}" viewBox="78 38 350 406">${inner}</svg></svg>`;
}
const stage=await mkdtemp(path.join(tmpdir(),'weekaboo-icons-'));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1,reducedMotion:'reduce'});
 for(const kind of ['square','round','foreground','mac']){
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(kind)}</body></html>`);
  await page.screenshot({path:path.join(stage,`${kind}.png`),omitBackground:true});
 }
 const resize=(source,size,destination)=>execFileSync('sips',['-z',String(size),String(size),source,'--out',destination],{stdio:'pipe'});
 const ios=path.join(root,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
 await writeFile(ios,await readFile(path.join(stage,'square.png')));
 for(const [density,size,foreground] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]){
  const folder=path.join(root,`android/app/src/main/res/mipmap-${density}`);await mkdir(folder,{recursive:true});
  for(const [name,kind,pixels] of [['ic_launcher','square',size],['ic_launcher_round','round',size],['ic_launcher_foreground','foreground',foreground]]) resize(path.join(stage,kind+'.png'),pixels,path.join(folder,name+'.png'));
 }
 await writeFile(path.join(root,'android/app/src/main/res/values/ic_launcher_background.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">${paper}</color></resources>\n`);
 const iconset=path.join(stage,'Weekaboo.iconset');await mkdir(iconset);
 for(const size of [16,32,128,256,512]) for(const scale of [1,2]) resize(path.join(stage,'mac.png'),size*scale,path.join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`));
 const mac=path.join(root,'native/branding');await mkdir(mac,{recursive:true});
 execFileSync('iconutil',['-c','icns',iconset,'-o',path.join(mac,'Weekaboo.icns')],{stdio:'pipe'});
 await writeFile(path.join(mac,'app-icon-preview.png'),await readFile(path.join(stage,'square.png')));
 console.log('Weekaboo icons rendered for iOS, Android and macOS from the approved SVG.');
}finally{await browser.close();await rm(stage,{recursive:true,force:true});}
