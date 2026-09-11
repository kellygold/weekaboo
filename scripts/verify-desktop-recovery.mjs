// Inject a provider outage in the signed app, not the machine's network. No
// credentials are returned to this harness and all event writes are blocked.
import { _electron, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, realpathSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
if(!process.argv.includes('--live-connected-mac'))throw Error('Explicit connected Mac validation flag required');
const bundle=resolve('output/standalone-desktop/package-signed/Weekaboo-darwin-arm64/Weekaboo.app');
const out=resolve('output/production-validation/mac-recovery');mkdirSync(out,{recursive:true,mode:0o700});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const receipt={at:new Date().toISOString(),appArchiveSha256:createHash('sha256').update(readFileSync(join(bundle,'Contents/Resources/app.asar'))).digest('hex'),passed:false,realNetworkDisabled:false,providerOutageInjected:true,mutationsBlocked:true};
let app,page,preferences;
const wait=async()=>{await expect(page.getByRole('button',{name:'Refresh calendars',exact:true})).toBeEnabled({timeout:120000});};
const labels=()=>page.locator('.schedule-item:not(.schedule-task)').allTextContents();
const digest=async()=>page.evaluate(async()=>{const result=await window.weekabooNative.readTasks();if(!result.ok)throw Error('Task read failed');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(result.value))))].map(n=>n.toString(16).padStart(2,'0')).join('');});
try{
 execFileSync('osascript',['-e','tell application "Weekaboo" to quit']);
 app=await _electron.launch({executablePath:join(bundle,'Contents/MacOS/Weekaboo'),env,timeout:30000});
 expect(realpathSync(await app.evaluate(({app})=>app.getPath('userData')))).toBe(realpathSync(join(homedir(),'Library/Application Support/Weekaboo')));
 page=await app.firstWindow();page.setDefaultTimeout(30000);await expect(page.getByRole('button',{name:'New event',exact:true})).toBeVisible();await wait();
 preferences=await page.evaluate(()=>Object.fromEntries(['weekaboo-schedule','weekydinky-view'].map(k=>[k,localStorage.getItem(k)])));
 const originalTasks=await digest();
 await page.getByRole('button',{name:'Today',exact:true}).click();await page.getByRole('button',{name:'Week',exact:true}).click();
 if(await page.getByRole('button',{name:'Schedule',exact:true}).getAttribute('aria-pressed')!=='true')await page.getByRole('button',{name:'Schedule',exact:true}).click();
 await wait();const before=await labels();expect(before.length).toBeGreaterThan(0);receipt.cachedVisibleEvents=before.length;
 await app.evaluate(({ipcMain})=>{
   const channel='weekaboo:operation',original=ipcMain._invokeHandlers.get(channel);if(typeof original!=='function')throw Error('IPC missing');
   let offline=true;const calls=[];
   ipcMain.removeHandler(channel);ipcMain.handle(channel,async(event,method,input)=>{
     if(method==='authAcquire'){
       calls.push({auth:input.provider,interactive:input.interactive,offline});
       if(input.interactive)throw Error('No interactive authorization during recovery check');
     }
     if(method==='request'&&!['GET','PROPFIND','REPORT'].includes(input.method))throw Error('Event writes forbidden');
     if(offline&&['request','authAcquire'].includes(method))return{ok:false,error:{code:'unavailable',message:'Provider unavailable'}};
     return original(event,method,input);
   });
   globalThis.weekabooRecovery={calls,online(){offline=false;},restore(){ipcMain.removeHandler(channel);ipcMain.handle(channel,original);delete globalThis.weekabooRecovery;}};
 });
 await page.reload();await wait();await expect.poll(labels).toEqual(before);
 receipt.rendererRestartRetainsCachedEvents=true;
 await page.getByRole('button',{name:'Refresh calendars',exact:true}).click();await wait();await expect.poll(labels).toEqual(before);
 receipt.failedRefreshRetainsCachedEvents=true;
 receipt.offlineStatus=await page.locator('.calendar-refresh [role=status]').innerText();
 await page.screenshot({path:join(out,'outage.png')});
 await app.evaluate(()=>globalThis.weekabooRecovery.online());
 await page.getByRole('button',{name:'Refresh calendars',exact:true}).click();await wait();
 const state=await page.evaluate(async()=>{const r=await window.weekabooNative.readDocument({key:'calendar-state'});return JSON.parse(r.value.value).accounts.map(a=>({provider:a.provider,status:a.status,needsAttention:a.needsAttention}));});
 expect(state.every(a=>a.status==='active'&&!a.needsAttention)).toBe(true);
 const calls=await app.evaluate(()=>globalThis.weekabooRecovery.calls);
 expect(calls.filter(c=>!c.offline).map(c=>c.auth)).toEqual(expect.arrayContaining(['google','microsoft']));
 expect(calls.every(c=>!c.interactive)).toBe(true);
 expect(await digest()).toBe(originalTasks);
 receipt.recoveredAccounts=state;receipt.silentAcquisitionAfterRecovery=true;receipt.originalTasksUnchanged=true;receipt.passed=true;
 await app.evaluate(()=>globalThis.weekabooRecovery.restore());
}finally{
 if(app)await app.evaluate(()=>globalThis.weekabooRecovery?.restore()).catch(()=>{});
 if(page&&!page.isClosed()&&preferences)await page.evaluate(preferences=>{for(const[k,v]of Object.entries(preferences)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}},preferences).catch(()=>{});
 await app?.close();execFileSync('open',[bundle]);receipt.finished=new Date().toISOString();writeFileSync(join(out,'receipt.json'),JSON.stringify(receipt,null,2),{mode:0o600});
}
console.log('Mac cached events survive injected provider outage; refresh recovers without consent; user tasks unchanged.');
