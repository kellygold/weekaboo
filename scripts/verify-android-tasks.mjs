// Disposable emulator; real system file picker + shared task UI. No provider mocks needed.
import { _android, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const serial = process.env.WEEKABOO_TEST_SERIAL || 'emulator-5554';
if (!serial.startsWith('emulator-')) throw new Error('Use a disposable emulator.');
const out='output/standalone-tasks'; mkdirSync(out,{recursive:true});
const adb=(...args)=>execFileSync(process.env.WEEKABOO_ADB || join(process.env.ANDROID_HOME || join(homedir(), 'Library/Android/sdk'), 'platform-tools/adb'),['-s',serial,...args],{encoding:'utf8',timeout:20000});
const d=(await _android.devices()).find(d=>d.serial()===serial); if(!d)throw new Error('Start emulator first.');
const p=await(await d.webView({pkg:'app.weekaboo.calendar'})).page();
const receipt={apkSha256:createHash('sha256').update(readFileSync('android/app/build/outputs/apk/debug/app-debug.apk')).digest('hex'),checks:[],cleanup:false};
const before=await p.evaluate(()=>window.Capacitor.Plugins.WeekabooStorage.readTasks());
const name=`weekaboo-proof-${Date.now()}.json`;
try {
  if(await p.getByRole('button',{name:'Close settings'}).count()) await p.getByRole('button',{name:'Close settings'}).click();
  await p.getByRole('textbox',{name:'New task',exact:true}).fill('WB portable task fixture');
  await p.getByRole('button',{name:'Add task',exact:true}).click();
  await expect(p.getByRole('button',{name:'Edit WB portable task fixture',exact:true})).toBeVisible();
  await p.getByRole('button',{name:'Settings',exact:true}).click();
  await p.getByRole('button',{name:'Export tasks',exact:true}).click();
  await d.fill({clazz:'android.widget.EditText'},name);
  await d.tap({text:'SAVE',exact:true});
  await expect(p.getByText('Backup sent to your file destination.')).toBeVisible();
  const exported=JSON.parse(adb('shell','cat',`/sdcard/Download/${name}`));
  expect(exported.format).toBe('weekaboo.tasks'); expect(exported.tasks.some(t=>t.title==='WB portable task fixture')).toBe(true);
  receipt.checks.push('real native save picker writes a readable versioned backup');
  await p.getByRole('button',{name:'Export tasks',exact:true}).click();
  await d.wait({clazz:'android.widget.EditText'}); adb('shell','input','keyevent','4');
  await expect(p.getByRole('button',{name:'Export tasks',exact:true})).toBeEnabled();
  receipt.checks.push('native save cancellation releases pending operation');
  await p.getByRole('button',{name:'Close settings'}).click();
  await p.getByRole('button',{name:'Edit WB portable task fixture',exact:true}).click();
  await p.getByRole('button',{name:'Delete task',exact:true}).click();
  await p.getByRole('button',{name:'Delete permanently'}).click();
  await expect(p.getByRole('button',{name:'Edit WB portable task fixture',exact:true})).toHaveCount(0);
  await p.getByRole('button',{name:'Settings',exact:true}).click();
  await p.getByRole('button',{name:'Import tasks',exact:true}).click();
  await d.tap({text:name,exact:true});
  await expect(p.getByText('1 tasks to add')).toBeVisible();
  await p.getByRole('button',{name:'Add tasks',exact:true}).click();
  await expect(p.getByText('Added 1 tasks.',{exact:false})).toBeVisible();
  receipt.checks.push('real native open picker imports deleted task through preview and shared atomic store');
  await p.getByRole('button',{name:'Import tasks',exact:true}).click(); await d.tap({text:name,exact:true});
  await expect(p.getByText('0 tasks to add')).toBeVisible(); await expect(p.getByRole('button',{name:'Add tasks',exact:true})).toBeDisabled();
  receipt.checks.push('reimport is idempotent without duplicate tasks');
  await p.getByRole('button',{name:'Cancel import'}).click();
  await p.getByRole('button',{name:'Import tasks',exact:true}).click();
  await d.wait({text:name,exact:true}); adb('shell','input','keyevent','4');
  await expect(p.getByRole('button',{name:'Import tasks',exact:true})).toBeEnabled();
  receipt.checks.push('native open cancellation releases pending operation');
  await expect.poll(() => adb('shell','dumpsys','activity','activities')).toMatch(/(?:mResumedActivity:|topResumedActivity=).*app\.weekaboo\.calendar/);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for system return animation before visual capture.
  writeFileSync(`${out}/native-settings.png`,await d.screenshot());
} finally {
  try {
    const result=await p.evaluate(async before=>{const storage=window.Capacitor.Plugins.WeekabooStorage;const current=await storage.readTasks();const result=await storage.writeTasks({revision:current.revision,tasks:before.tasks});return result.committed && JSON.stringify((await storage.readTasks()).tasks)===JSON.stringify(before.tasks);},before);
    receipt.cleanup=result;
    adb('shell','rm','-f',`/sdcard/Download/${name}`);
  } finally {writeFileSync(`${out}/native-tasks.json`,JSON.stringify(receipt,null,2));await d.close();}
}
console.log(JSON.stringify(receipt,null,2));
