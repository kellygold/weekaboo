// Physical iPad read-only calendar checks, native synthetic vault and mascot.
// No provider writes; temporary preferences and native hooks are restored.
import {chromium,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9223',{timeout:15000});
let page, soundPreference;const receipt={at:new Date().toISOString(),checks:[],cleanup:false};
try{
 const pages=browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url()==='capacitor://localhost');
 if(pages.length!==1)throw Error('Ambiguous target');page=pages[0];page.setDefaultTimeout(20000);
 await expect.poll(async()=>({title:(await page.title()).startsWith('Weekaboo'),platform:await page.evaluate(()=>window.Capacitor?.getPlatform())})).toEqual({title:true,platform:'ios'});
 const refresh=page.getByRole('button',{name:'Refresh calendars',exact:true});await expect(refresh).toBeEnabled({timeout:120000});
 const state=await page.evaluate(async()=>{
  const native=window.Capacitor.Plugins.WeekabooStorage;
  const state=JSON.parse((await native.readDocument({key:'calendar-state'})).value);
  return {providers:state.accounts.filter(a=>a.status==='active').map(a=>a.provider).sort(),calendars:state.calendars.length,tasks:(await native.readTasks()).tasks.length};
 });expect(state.providers).toEqual(['google','icloud','microsoft']);expect(state.calendars).toBeGreaterThanOrEqual(3);
 receipt.checks.push({connectedAfterUpgradeAndRestart:state});
 const vault=await page.evaluate(async()=>{
  const native=window.Capacitor.Plugins.WeekabooStorage,reference='proof-'+crypto.randomUUID(),value='disposable-vault-proof';
  try{await native.vaultPut({reference,value});return {roundTrip:(await native.vaultGet({reference})).value===value};}
  finally{await native.vaultRemove({reference});if((await native.vaultGet({reference})).value!==null)throw Error('Synthetic vault cleanup failed');}
 });expect(vault.roundTrip).toBe(true);receipt.checks.push({physicalKeychainRoundTripAndCleanup:true});
 soundPreference=await page.evaluate(()=>localStorage.getItem('weekaboo-mascot-sound'));
 await page.evaluate(()=>{
  const original=HTMLMediaElement.prototype.play;
  window.audioProof={original,sources:[],outcomes:[]};
  HTMLMediaElement.prototype.play=function(){const state=window.audioProof;state.sources.push(new URL(this.src).pathname);const result=original.call(this);result.then(()=>state.outcomes.push('played'),error=>state.outcomes.push(error.name));return result;};
 });
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const sound=page.getByRole('switch',{name:'Mascot sound',exact:true});const enabled=await sound.isChecked();
 if(!enabled)await sound.click();await page.getByRole('button',{name:'Close settings',exact:true}).click();
 const mascot=page.getByRole('button',{name:'Replay Weekaboo animation',exact:true});
 await mascot.click();await expect.poll(()=>page.evaluate(()=>window.audioProof.outcomes.length)).toBe(1);await mascot.click();
 await expect.poll(()=>page.evaluate(()=>window.audioProof.outcomes.length)).toBe(2);
 const audio=await page.evaluate(()=>({sources:window.audioProof.sources,outcomes:window.audioProof.outcomes}));
 expect(audio.outcomes).toEqual(['played','played']);expect(audio.sources[0]).not.toBe(audio.sources[1]);expect(audio.sources.every(s=>s.startsWith('/brand/audio/')&&s.endsWith('.mp3'))).toBe(true);
 expect(await mascot.evaluate(e=>getComputedStyle(e).webkitTapHighlightColor)).toBe('rgba(0, 0, 0, 0)');
 receipt.checks.push({nativeAudioPlayed:true,consecutiveSoundsDiffer:true,tapHighlightTransparent:true});
 if(!enabled){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('switch',{name:'Mascot sound',exact:true}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click();}
 await page.evaluate(()=>{HTMLMediaElement.prototype.play=window.audioProof.original;delete window.audioProof;});
 // Native HTTP simulation, rather than browser offline emulation (which would
 // not affect URLSession). Keep credentials inside native engine memory.
 const before=await page.locator('.schedule-item:not(.schedule-task),.calendar-event').count();expect(before).toBeGreaterThan(0);
 await page.evaluate(()=>{window.restoreProofHttp=window.Capacitor.nativePromise.bind(window.Capacitor);window.Capacitor.nativePromise=(plugin,method,args)=>plugin==='WeekabooHttp'&&method==='request'?Promise.reject({code:'unavailable',message:'Connection unavailable'}):window.restoreProofHttp(plugin,method,args);});
 await refresh.click();await expect(refresh).toBeEnabled({timeout:120000});
 expect(await page.locator('.schedule-item:not(.schedule-task),.calendar-event').count()).toBe(before);
 receipt.checks.push({simulatedNativeNetworkFailureRetainsCachedEvents:true});
 await page.evaluate(()=>{window.Capacitor.nativePromise=window.restoreProofHttp;delete window.restoreProofHttp;});
 await refresh.click();await expect(refresh).toBeEnabled({timeout:120000});
 writeFileSync('output/production-validation/ipad-physical/parity.png',await page.screenshot());
 receipt.cleanup=true;
 console.log('Physical iPad parity checks passed.');
}finally{
 if(page)await page.evaluate(soundPreference=>{if(soundPreference!==undefined){if(soundPreference===null)localStorage.removeItem('weekaboo-mascot-sound');else localStorage.setItem('weekaboo-mascot-sound',soundPreference);}if(window.audioProof){HTMLMediaElement.prototype.play=window.audioProof.original;delete window.audioProof;}if(window.restoreProofHttp){window.Capacitor.nativePromise=window.restoreProofHttp;delete window.restoreProofHttp;}},soundPreference).catch(()=>{});
 writeFileSync('output/production-validation/ipad-physical/parity.json',JSON.stringify(receipt,null,2));
 await browser.close();
}
