// Disposable emulator, synthetic provider responses. Real persisted journal and recovery UI.
import { _android, expect } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const out='output/standalone-recovery'; mkdirSync(out,{recursive:true});
const d=(await _android.devices()).find(d=>d.serial()==='emulator-5554'); if(!d)throw new Error('Start disposable emulator.');
const p=await(await d.webView({pkg:'app.weekaboo.calendar'})).page(); p.setDefaultTimeout(12000);
let snapshots;
const receipt={apkSha256:createHash('sha256').update(readFileSync('android/app/build/outputs/apk/debug/app-debug.apk')).digest('hex'),checks:[],cleanup:false};
const calendarId='recovery-calendar', accountId='recovery-account';
const event={calendarId,title:'WB recovery fixture',start:'2026-09-11T01:00:00Z',end:'2026-09-11T01:30:00Z',allDay:false,timezone:'Australia/Sydney',location:null,description:null,recurrenceRule:null};
const op=(id,state)=>({id,remoteCreateId:id,input:{kind:'create',accountId,event},state,createdAt:'2026-09-11T00:00:00Z',updatedAt:'2026-09-11T00:00:00Z'});
async function seedOperation(value) {
 await p.evaluate(async value=>{const s=window.Capacitor.Plugins.WeekabooStorage;const old=await s.readDocument({key:'event-operations'});const data=JSON.parse(old.value||'{"version":1,"operations":[]}');data.operations.push(value);if(!(await s.writeDocument({key:'event-operations',revision:old.revision,value:JSON.stringify(data)})).committed)throw new Error('Seed conflict');},value);
}
async function openAccounts() {
 if(await p.getByRole('button',{name:'Close settings'}).count())await p.getByRole('button',{name:'Close settings'}).click();
 await p.getByRole('button',{name:'Connected calendars',exact:true}).click();await p.getByRole('button',{name:'Manage accounts'}).click();
 await expect(p.getByRole('heading',{name:'recovery@example.test',exact:true})).toBeVisible();
}
try {
 snapshots=await p.evaluate(async()=>{const s=window.Capacitor.Plugins.WeekabooStorage,result={};for(const key of ['calendar-state','event-cache','event-operations'])result[key]=await s.readDocument({key});if(JSON.parse(result['calendar-state'].value||'{"accounts":[]}').accounts.length)throw new Error('Refusing connected accounts.');return result;});
 await p.evaluate(async({accountId,calendarId})=>{
  const s=window.Capacitor.Plugins.WeekabooStorage;const state={version:1,accounts:[{id:accountId,provider:'google',subject:'recovery',email:'recovery@example.test',authorizationRef:'recovery@example.test',sharedWorkCalendars:false,status:'active',needsAttention:false}],calendars:[{remoteId:'remote',calendar:{id:calendarId,accountId,accountEmail:'recovery@example.test',name:'Recovery calendar',provider:'google',enabled:true,writable:true,color:'#456789',scope:'personal'}}]};
  const old=await s.readDocument({key:'calendar-state'});await s.writeDocument({key:'calendar-state',revision:old.revision,value:JSON.stringify(state)});
  window.recoveryMutations=0;window.recoveryAuthFail=false;
  const original=window.Capacitor.nativePromise.bind(window.Capacitor);window.restoreRecoveryProof=()=>window.Capacitor.nativePromise=original;
  window.Capacitor.nativePromise=(plugin,method,options)=>{
   if(plugin==='WeekabooAuthorization'){
    if(method==='setup')return original(plugin,method,options);
    if(method==='acquire')return window.recoveryAuthFail?Promise.reject({code:'interaction-required'}):Promise.resolve({accessToken:'synthetic',accountRef:'recovery@example.test',scopes:['calendar']});
    if(method==='forget')return Promise.resolve({});
   }
   if(plugin!=='WeekabooHttp')return original(plugin,method,options);
   if(options.method!=='GET'){window.recoveryMutations++;throw new Error('Recovery must not write');}
   const url=new URL(options.url);let body={},status=200;
   if(url.pathname.endsWith('/userinfo'))body={sub:'recovery',email:'recovery@example.test',email_verified:true};
   else if(url.pathname.endsWith('/found'))body={id:'found',summary:'WB recovery fixture',start:{dateTime:'2026-09-11T01:00:00Z'},end:{dateTime:'2026-09-11T01:30:00Z'},etag:'v1'};
   else if(url.pathname.endsWith('/events'))body={items:[]};
   else status=404;
   return Promise.resolve({status,headers:{},body:JSON.stringify(body)});
  };
 },{accountId,calendarId});
 await seedOperation(op('found','sent'));await openAccounts();
 await expect(p.getByText('We couldn’t confirm this change was saved.',{exact:false})).toBeVisible();
 await p.getByRole('button',{name:'Check again',exact:true}).click();
 await expect(p.getByRole('button',{name:'Check again',exact:true})).toHaveCount(0);
 receipt.checks.push('persisted sent create reconciles from remote lookup with no POST');
 await p.keyboard.press('Escape');await seedOperation(op('unsent','prepared'));await p.evaluate(()=>window.recoveryAuthFail=true);await openAccounts();
 await p.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(p.getByText('Reconnect this account to restore calendar access.',{exact:true})).toBeVisible();
 await expect(p.getByText('This change hasn’t been saved to your calendar yet.',{exact:true})).toBeVisible();
 await p.getByRole('button',{name:'Discard',exact:true}).click();await p.getByRole('button',{name:'Keep',exact:true}).click();
 await expect(p.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
 await p.getByRole('button',{name:'Discard',exact:true}).click();await p.getByRole('button',{name:'Discard draft',exact:true}).click();
 await expect(p.getByRole('button',{name:'Try again',exact:true})).toHaveCount(0);
 receipt.checks.push('failed authorization leaves unsent change recoverable; explicit discard and cancel work');
 await p.keyboard.press('Escape');await seedOperation(op('missing','uncertain'));await p.evaluate(()=>window.recoveryAuthFail=false);await openAccounts();
 await p.getByRole('button',{name:'Check again',exact:true}).click();
 await expect(p.getByText('We still couldn’t confirm this change was saved.',{exact:false})).toBeVisible();
 await p.getByRole('button',{name:'Disconnect',exact:true}).click();await p.getByRole('button',{name:'Disconnect account',exact:true}).click();
 await expect(p.getByText('This account has unresolved calendar changes.',{exact:false})).toBeVisible();
 await p.getByRole('button',{name:'Keep connected',exact:true}).click();
 await p.getByRole('button',{name:'Dismiss',exact:true}).click();
 await expect(p.getByText('Anything already saved to your calendar will stay there.',{exact:false})).toBeVisible();
 await p.getByRole('button',{name:'Dismiss notice',exact:true}).click();
 await p.getByRole('button',{name:'Disconnect',exact:true}).click();await p.getByRole('button',{name:'Disconnect account',exact:true}).click();
 await expect(p.getByRole('heading',{name:'recovery@example.test',exact:true})).toHaveCount(0);
 receipt.checks.push('unconfirmed change prevents disconnect until explicit stop-tracking acknowledgment');
 const result=await p.evaluate(async()=>({writes:window.recoveryMutations,journal:JSON.parse((await window.Capacitor.Plugins.WeekabooStorage.readDocument({key:'event-operations'})).value).operations.map(op=>({id:op.id,state:op.state}))}));
 expect(result.writes).toBe(0);expect(result.journal).toEqual([{id:'found',state:'confirmed'},{id:'unsent',state:'rejected'},{id:'missing',state:'rejected'}]);
 receipt.checks.push('all outcomes persisted, zero provider mutations during recovery');
 writeFileSync(`${out}/native-recovery.png`,await d.screenshot());
} finally {
 try {
  if(snapshots)receipt.cleanup=await p.evaluate(async snapshots=>{window.restoreRecoveryProof?.();const s=window.Capacitor.Plugins.WeekabooStorage;for(const [key,old] of Object.entries(snapshots)){const current=await s.readDocument({key});const fallback=key==='calendar-state'?{version:1,accounts:[],calendars:[]}:key==='event-cache'?{version:1,entries:[]}:{version:1,operations:[]};const value=old.value||JSON.stringify(fallback);if(!(await s.writeDocument({key,revision:current.revision,value})).committed)throw new Error('Cleanup conflict');if((await s.readDocument({key})).value!==value)throw new Error('Cleanup mismatch');}return true;},snapshots);
 }finally{writeFileSync(`${out}/native-recovery.json`,JSON.stringify(receipt,null,2));await d.close();}
}
console.log(JSON.stringify(receipt,null,2));
