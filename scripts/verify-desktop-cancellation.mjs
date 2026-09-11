// Exercise packaged IPC + real loopback cancellation without account consent.
// Only external-browser opening is stubbed; no URL/state/token is written to disk.
import {_electron, expect} from '@playwright/test';
import {mkdtempSync,rmSync,realpathSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const profile=mkdtempSync(join(tmpdir(),'weekaboo-cancel-proof-'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
 app=await _electron.launch({executablePath:resolve('output/standalone-desktop/package-signed/Weekaboo-darwin-arm64/Weekaboo.app/Contents/MacOS/Weekaboo'),args:['--user-data-dir='+profile],env});
 expect(realpathSync(await app.evaluate(({app})=>app.getPath('userData')))).toBe(realpathSync(profile));
 await app.evaluate(({shell})=>{globalThis.__weekabooBrowserProof=[];shell.openExternal=async url=>{globalThis.__weekabooBrowserProof.push(url);};});
 const page=await app.firstWindow();
 await page.getByRole('button',{name:'Connected calendars',exact:true}).click();
 await page.getByRole('button',{name:'Manage accounts',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Connected accounts'});
 const checks=[];
 for(const provider of ['Google','Microsoft','Google']) {
  await page.getByRole('button',{name:'Connect '+provider,exact:true}).click();
  if(provider==='Microsoft')await page.getByRole('button',{name:'Continue to Microsoft'}).click();
  await expect(dialog.getByRole('status')).toContainText(provider+' is connecting');
  await expect.poll(()=>app.evaluate(()=>globalThis.__weekabooBrowserProof.length),{timeout:30000}).toBe(checks.length+1);
  if(provider==='Microsoft')await page.screenshot({path:'output/production-validation/desktop-signin-cancel.png'});
  const redirect=await app.evaluate(()=>new URL(globalThis.__weekabooBrowserProof.at(-1)).searchParams.get('redirect_uri'));
  expect(['127.0.0.1','localhost']).toContain(new URL(redirect).hostname);
  await page.getByRole('button',{name:'Cancel sign-in',exact:true}).click();
  await expect(dialog.getByRole('status')).toBeEmpty();
  await expect(dialog.getByRole('alert')).toContainText('cancelled');
  await expect(page.getByRole('button',{name:'Close accounts'})).toBeEnabled();
  await expect(fetch(redirect)).rejects.toThrow();
  await expect(page.locator('.connected-account')).toHaveCount(0);
  if(provider==='Microsoft')await page.screenshot({path:'output/production-validation/desktop-signin-cancelled.png'});
  checks.push(provider+' cancellation cleared status, closed loopback listener and retained no account');
 }
 writeFileSync('output/production-validation/desktop-cancellation.json',JSON.stringify({at:new Date().toISOString(),checks,packaged:true,isolatedProfile:true,externalBrowserStubbed:true,liveConsent:false},null,2));
 console.log('Packaged Google/Microsoft cancellation and Google retry passed through real IPC and loopback.');
} finally {await app?.close();rmSync(profile,{recursive:true,force:true});}
