import { version } from './release-version.mjs';
// Copy from the signed DMG into an isolated Applications directory, exercise
// the installed app, replace the bundle, and verify the existing profile survives.
import { _electron, expect } from '@playwright/test';
import {mkdtempSync,rmSync,mkdirSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'weekaboo-install-proof-'));
const profile=join(root,'profile'),application=join(root,'Applications/Weekaboo.app');
mkdirSync(profile);mkdirSync(join(root,'Applications'));
const image=resolve(`output/standalone-desktop/Weekaboo-${version}-arm64-signed-preview.dmg`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
let app,volume;const checks=[];
const launch=async()=>{
 app=await _electron.launch({executablePath:join(application,'Contents/MacOS/Weekaboo'),args:['--user-data-dir='+profile],env,timeout:30000});
 expect(await app.evaluate(({app})=>app.isPackaged)).toBe(true);
 expect(realpathSync(await app.evaluate(({app})=>app.getPath('userData')))).toBe(realpathSync(profile));
 const p=await app.firstWindow();p.setDefaultTimeout(15000);return p;
};
try{
 const plist=execFileSync('hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-plist',image]);
 const mounted=JSON.parse(execFileSync('plutil',['-convert','json','-o','-','-'],{input:plist}));
 volume=mounted['system-entities'].find(e=>e['mount-point'])['mount-point'];
 const copy=()=>execFileSync('ditto',[join(volume,'Weekaboo.app'),application]);copy();
 execFileSync('codesign',['--verify','--deep','--strict',application],{stdio:'pipe'});checks.push('Signed DMG app copied into isolated Applications directory and signature retained');
 let page=await launch();
 await page.getByPlaceholder('Something to get done…').fill('Mac install lifecycle fixture');
 await page.getByRole('button',{name:'Add task',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit Mac install lifecycle fixture',exact:true})).toBeVisible();
 for(const name of ['Day','4 days','Week','Month']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');}
 await page.getByRole('button',{name:'Schedule',exact:true}).click();
 await expect(page.getByRole('button',{name:'Schedule',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('Calendar views and schedule render without page overflow');
 const backup=join(root,'tasks.json');
 await app.evaluate(({dialog},backup)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:backup});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[backup]});},backup);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Export tasks',exact:true}).click();
 await expect.poll(()=>{try{return JSON.parse(readFileSync(backup,'utf8')).tasks.length}catch{return 0}}).toBe(1);
 const exported=JSON.parse(readFileSync(backup,'utf8'));expect(exported.tasks[0].title).toBe('Mac install lifecycle fixture');
 await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await app.close();app=null;checks.push('Native UI export saved complete task backup (chooser selection automated)');
 rmSync(application,{recursive:true});copy();page=await launch();
 await expect(page.getByRole('button',{name:'Edit Mac install lifecycle fixture',exact:true})).toBeVisible();
 checks.push('Bundle replacement and full process restart retained existing SQLite task');
 await page.getByRole('button',{name:'Complete Mac install lifecycle fixture',exact:true}).click();
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.getByRole('button',{name:'Edit Mac install lifecycle fixture',exact:true}).click();
 await page.getByRole('button',{name:'Delete task',exact:true}).click();
 await page.getByRole('button',{name:'Delete permanently',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit Mac install lifecycle fixture',exact:true})).toHaveCount(0);
 checks.push('Completed task visible in Done and removable with explicit confirmation');
 await app.evaluate(({dialog},backup)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[backup]});},backup);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Import tasks',exact:true}).click();
 await expect(page.getByText('1 tasks to add')).toBeVisible();
 await page.getByRole('button',{name:'Add tasks',exact:true}).click();
 await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await page.getByRole('button',{name:'Backlog',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit Mac install lifecycle fixture',exact:true})).toBeVisible();
 const stored=await page.evaluate(()=>window.weekabooNative.readTasks());expect(stored.value.tasks[0].id).toBe(exported.tasks[0].id);
 checks.push('Native import restored original task identity through UI');
 writeFileSync('output/standalone-desktop/install-lifecycle.png',await page.screenshot());
 writeFileSync('output/standalone-desktop/install-lifecycle.json',JSON.stringify({at:new Date().toISOString(),checks,publicGatekeeperAcceptance:false,notarized:false,liveConsent:false},null,2));
 console.log(checks.join('\n'));
}finally{
 await app?.close();if(volume)execFileSync('hdiutil',['detach',volume],{stdio:'pipe'});
 rmSync(root,{recursive:true,force:true});
}
