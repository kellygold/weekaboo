import { _android, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const d=(await _android.devices()).find(d=>d.serial()==='emulator-5554');if(!d)throw new Error('Disposable emulator required.');
const adb=(...args)=>execFileSync(join(process.env.ANDROID_HOME||join(homedir(),'Library/Android/sdk'),'platform-tools/adb'),['-s','emulator-5554',...args],{encoding:'utf8',timeout:15000});
const p=await(await d.webView({pkg:'app.weekaboo.calendar'})).page();
const snapshot=await p.evaluate(()=>window.Capacitor.Plugins.WeekabooStorage.readTasks());
const receipt={apkSha256:createHash('sha256').update(readFileSync('android/app/build/outputs/apk/debug/app-debug.apk')).digest('hex'),checks:[],cleanup:false};
try {
 await p.evaluate(async()=>{window.lifecycleProof=[];window.lifecycleHandle=await window.Capacitor.Plugins.WeekabooLifecycle.addListener('activity',event=>window.lifecycleProof.push(event.active));});
 adb('shell','input','keyevent','3');
 await expect.poll(()=>p.evaluate(()=>window.lifecycleProof.includes(false))).toBe(true);
 await p.evaluate(async()=>{const s=window.Capacitor.Plugins.WeekabooStorage;const before=await s.readTasks();const now=new Date().toISOString();await s.writeTasks({revision:before.revision,tasks:[...before.tasks,{id:'native-resume-proof',title:'Native resume task',completed:false,rank:999,createdAt:now,updatedAt:now}]});});
 adb('shell','am','start','-n','app.weekaboo.calendar/.MainActivity');
 await expect.poll(()=>p.evaluate(()=>window.lifecycleProof.at(-1))).toBe(true);
 await expect(p.getByRole('button',{name:'Edit Native resume task',exact:true})).toBeVisible();
 receipt.checks.push('real OS pause/resume reaches native activity adapter');
 receipt.checks.push('foreground reload renders SQLite task added while backgrounded');
}finally{
 try {receipt.cleanup=await p.evaluate(async snapshot=>{await window.lifecycleHandle?.remove();const s=window.Capacitor.Plugins.WeekabooStorage;const current=await s.readTasks();return (await s.writeTasks({revision:current.revision,tasks:snapshot.tasks})).committed;},snapshot);await p.reload();}
 finally{writeFileSync('output/standalone-recovery/native-lifecycle.json',JSON.stringify(receipt,null,2));await d.close();}
}
console.log(JSON.stringify(receipt,null,2));
