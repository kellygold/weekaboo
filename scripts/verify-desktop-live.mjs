// Explicit live Mac validation. Only titled, attendee-free synthetic events may be
// written; the guard and cleanup retain credentials inside the app main process.
import { _electron, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { installLiveGuard } from './desktop-live-guard.mjs';
if (!process.argv.includes('--live-connected-mac')) throw Error('Explicit connected Mac validation flag required');
const out=resolve('output/production-validation/mac-live-'+Date.now());mkdirSync(out,{recursive:true,mode:0o700});
const bundle=resolve('output/standalone-desktop/package-signed/Weekaboo-darwin-arm64/Weekaboo.app');
const profile=join(homedir(),'Library/Application Support/Weekaboo');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
let app,page,preferences,baselineTasks,baselineSettings;
const receipt={started:new Date().toISOString(),appArchiveSha256:createHash('sha256').update(readFileSync(join(bundle,'Contents/Resources/app.asar'))).digest('hex'),results:[],cleanup:false,passed:false};
const save=()=>writeFileSync(join(out,'receipt.json'),JSON.stringify(receipt,null,2),{mode:0o600});
const launch=async()=>{app=await _electron.launch({executablePath:join(bundle,'Contents/MacOS/Weekaboo'),env,timeout:30000});expect(realpathSync(await app.evaluate(({app})=>app.getPath('userData')))).toBe(realpathSync(profile));page=await app.firstWindow();page.setDefaultTimeout(30000);await expect(page.getByRole('button',{name:'New event',exact:true})).toBeVisible();};
const state=()=>page.evaluate(async()=>{const r=await window.weekabooNative.readDocument({key:'calendar-state'});if(!r.ok)throw Error('Cannot read account metadata');return JSON.parse(r.value.value);});
const digest=key=>page.evaluate(async key=>{const r=await window.weekabooNative.readDocument({key});if(!r.ok)throw Error('Cannot read baseline');let value=r.value.value||'';if(key==='calendar-state'){const s=JSON.parse(value);value=JSON.stringify({accounts:s.accounts.map(a=>({id:a.id,provider:a.provider})),calendars:s.calendars.map(c=>c.calendar)});}return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');},key);
const refresh=async()=>{const button=page.getByRole('button',{name:'Refresh calendars',exact:true});await expect(button).toBeEnabled({timeout:120000});await button.click();await expect(page.locator('.calendar-refresh [role=status]')).toHaveText('Refreshing calendars…');await expect(button).toBeEnabled({timeout:120000});};
try {
 execFileSync('osascript',['-e','tell application "Weekaboo" to quit']);await launch();
 if(await page.locator('dialog[open], .event-composer').count())throw Error('Unexpected unfinished interaction');
 preferences=await page.evaluate(()=>Object.fromEntries(['weekaboo-schedule','weekydinky-view'].map(k=>[k,localStorage.getItem(k)])));
 baselineTasks=await digest('task-snapshot');
 baselineSettings=await digest('calendar-state');
 const before=await state();expect(new Set(before.accounts.filter(a=>a.status==='active').map(a=>a.provider))).toEqual(new Set(['google','microsoft','icloud']));
 receipt.accountsRetainedOnInitialRestart=true;
 await page.getByRole('button',{name:'Today',exact:true}).click();
 await page.getByRole('button',{name:'Day',exact:true}).click();
 if(await page.getByRole('button',{name:'Schedule',exact:true}).getAttribute('aria-pressed')!=='true')await page.getByRole('button',{name:'Schedule',exact:true}).click();
 await refresh();receipt.refreshIndicator=true;
 for(const provider of ['google','microsoft','icloud']){
  const title='Weekaboo Mac validation '+provider+' '+Date.now();
  const s=await state(),account=s.accounts.find(a=>a.provider===provider&&a.status==='active');
  const choices=s.calendars.filter(c=>c.calendar.accountId===account.id&&c.calendar.writable&&c.calendar.enabled!==false);
  const selected=choices.find(c=>c.remoteId===account.email)||choices[0];if(!selected)throw Error('No writable '+provider+' calendar');
  const label=selected.calendar.name+(selected.calendar.accountEmail?' · '+selected.calendar.accountEmail:'');
  const result={provider,title,cleanup:false};receipt.results.push(result);save();console.log('Starting '+provider+' live UI validation');
  await app.evaluate(installLiveGuard,{provider,title,collection:selected.remoteId});
  try{
   await page.getByRole('button',{name:'New event',exact:true}).click();
   await page.getByRole('textbox',{name:'Event title',exact:true}).fill(title);
   await page.getByRole('combobox',{name:'Event calendar',exact:true}).click();await page.getByRole('option',{name:label,exact:true}).click();
   await page.getByRole('textbox',{name:'Notes',exact:true}).fill('Synthetic Weekaboo Mac validation');
   await page.getByRole('button',{name:'Save event',exact:true}).click();
   await expect(page.getByRole('textbox',{name:'Event title',exact:true})).toHaveCount(0,{timeout:60000});
   result.created=await app.evaluate(()=>globalThis.weekabooLiveProof.read());expect(result.created).toMatchObject({status:200,titleMatches:true,attendeeCount:0});
   await refresh();
   const card=()=>page.getByRole('button',{name:new RegExp(title)});
   await expect(card()).toHaveCount(1,{timeout:60000});await card().click();await page.getByRole('button',{name:'Edit event',exact:true}).click();
   await page.getByRole('textbox',{name:'Notes',exact:true}).fill('Verified edit from standalone macOS');
   await page.getByRole('textbox',{name:'Location',exact:true}).fill('Weekaboo test location');
   await page.getByRole('button',{name:'Save event',exact:true}).click();
   await expect(page.getByRole('textbox',{name:'Event title',exact:true})).toHaveCount(0,{timeout:60000});
   result.edited=await app.evaluate(()=>globalThis.weekabooLiveProof.read());expect(result.edited.notes).toContain('Verified edit from standalone macOS');expect(result.edited.location).toBe('Weekaboo test location');
   await refresh();await expect(card()).toHaveCount(1);await card().click();
   await page.locator('.event-composer').screenshot({path:join(out,provider+'-edited.png')});
   await page.getByRole('button',{name:'Delete event',exact:true}).click();await page.getByRole('button',{name:'Delete event',exact:true}).click();
   await expect(card()).toHaveCount(0,{timeout:60000});result.deleted=await app.evaluate(()=>globalThis.weekabooLiveProof.read());expect(result.deleted.deleted).toBe(true);result.passed=true;
  }catch(error){result.failure=String(error).slice(0,500);await page.screenshot({path:join(out,provider+'-failure.png')});throw error;}
  finally{result.requests=await app.evaluate(()=>globalThis.weekabooLiveProof.observations);try{result.cleanup=await app.evaluate(()=>globalThis.weekabooLiveProof.cleanup());}finally{await app.evaluate(()=>globalThis.weekabooLiveProof.restore());save();}if(!result.cleanup)throw Error('Synthetic cleanup incomplete');console.log(provider+' cleanup confirmed');}
 }
 receipt.cleanup=receipt.results.every(r=>r.cleanup);
 await app.close();app=null;await launch();await refresh();
 const after=await state();expect(after.accounts.map(a=>({id:a.id,provider:a.provider,status:a.status}))).toEqual(before.accounts.map(a=>({id:a.id,provider:a.provider,status:a.status})));
 expect(await digest('task-snapshot')).toBe(baselineTasks);expect(await digest('calendar-state')).toBe(baselineSettings);
 receipt.finalRestartAccountsRetained=true;receipt.originalTasksUnchanged=true;receipt.calendarSettingsUnchanged=true;receipt.passed=true;
}finally{
 if(page&&!page.isClosed()&&preferences)await page.evaluate(preferences=>{for(const [k,v]of Object.entries(preferences)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}},preferences).catch(()=>{});
 receipt.cleanup=receipt.results.length>0&&receipt.results.every(r=>r.cleanup);receipt.finished=new Date().toISOString();save();
 await app?.close();execFileSync('open',[bundle]);console.log('Evidence: '+out);
}
