// Native accessibility proof on an explicitly disposable emulator. No CDP,
// debug flag, credential copying, physical-device reset or provider mutation.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
const serial='emulator-5554',adbPath=join(homedir(),'Library/Android/sdk/platform-tools/adb');
const adb=(...args)=>execFileSync(adbPath,['-s',serial,...args],{encoding:'utf8',timeout:30000});
if(adb('shell','getprop','ro.kernel.qemu').trim()!=='1'||!adb('emu','avd','name').includes('Weekaboo_API_36'))throw Error('Expected disposable Weekaboo emulator');
const title='ReleasePersistenceFixture';const checks=[];
const osType=adb('shell','getprop','ro.build.type').trim();
const osDebuggable=adb('shell','getprop','ro.debuggable').trim()==='1';
const security={osType,osDebuggable,inspectionDisabled:'not-checked'};
const dump=()=>{
 adb('shell','uiautomator','dump','/sdcard/weekaboo-release-ui.xml');
 const xml=adb('shell','cat','/sdcard/weekaboo-release-ui.xml');
 return JSON.parse(execFileSync('python3',['-c','import sys,json,xml.etree.ElementTree as E; print(json.dumps([n.attrib for n in E.fromstring(sys.stdin.read()).iter("node")]))'],{input:xml,encoding:'utf8'}));
};
const wait=async selector=>{
 const deadline=Date.now()+30000;
 do {
  const node=dump().find(n=>Object.entries(selector).every(([k,v])=>n[k]===v));
  if(node)return node;
  await new Promise(r=>setTimeout(r,500));
 }while(Date.now()<deadline);
 throw Error('Native UI did not expose '+JSON.stringify(selector));
};
const tap=async text=>{
 const node=await wait({text});const [x1,y1,x2,y2]=node.bounds.match(/\d+/g).map(Number);
 adb('shell','input','tap',String(Math.round((x1+x2)/2)),String(Math.round((y1+y2)/2)));
};
const receipt={at:new Date().toISOString(),emulator:serial,security,checks,cleanup:false,liveConsent:false,physicalDevice:false,passed:false};
try{
 await wait({text:'Add task'});
 const pid=adb('shell','pidof','app.weekaboo.calendar').trim();
 const inspectionSocket=adb('shell','cat','/proc/net/unix').includes('webview_devtools_remote_'+pid);
 security.inspectionSocket=inspectionSocket;
 const packageInfo=adb('shell','dumpsys','package','app.weekaboo.calendar');
 assert(!/(?:pkgFlags|flags)=\[[^\]]*DEBUGGABLE/.test(packageInfo),'Installed app is debuggable');
 if(osDebuggable && ['userdebug','eng'].includes(osType)) {
   // Chromium SharedStatics ignores disable requests on debug Android OSes.
   security.inspectionDisabled='unvalidated-debug-OS-forces-inspection';
 } else {
   assert(!inspectionSocket,'Release app exposes WebView inspection on a user OS');
   security.inspectionDisabled='passed';
 }
 checks.push('Installed app is non-debuggable; inspection status recorded separately');
 await wait({text:'Make a little headspace.'}); // Dedicated clean fixture profile.
 const input=await wait({class:'android.widget.EditText'});
 const [x1,y1,x2,y2]=input.bounds.match(/\d+/g).map(Number);
 adb('shell','input','tap',String(Math.round((x1+x2)/2)),String(Math.round((y1+y2)/2)));
 adb('shell','input','text',title);
 await tap('Add task');
 await wait({text:'Edit '+title});
 adb('shell','am','force-stop','app.weekaboo.calendar');adb('shell','am','start','-n','app.weekaboo.calendar/.MainActivity');
 await wait({text:'Edit '+title});checks.push('Native SQLite task survives full release-app restart');
 // The AAB-derived APK uses the same permanent signer. In-place replacement.
 adb('install','-r','output/production-validation/weekaboo-from-bundle.apk');
 adb('shell','am','start','-n','app.weekaboo.calendar/.MainActivity');
 await wait({text:'Edit '+title});checks.push('AAB-derived signed APK replaces release APK without losing task');
 await tap('Complete '+title);await tap('Done');
 await wait({text:'Edit '+title});await tap('Edit '+title);
 await tap('Delete task');await tap('Delete permanently');
 await tap('Backlog');await wait({text:'Make a little headspace.'});
 checks.push('Task completion/history/delete work through release native accessibility; fixture removed');
 receipt.cleanup=true;
 await tap('Settings');await wait({text:'Comfort & readability'});
 writeFileSync('output/production-validation/android-release-emulator.png',execFileSync(adbPath,['-s',serial,'exec-out','screencap','-p']));
 await tap('Close settings');checks.push('Release settings open and dismiss');
 receipt.installedFromBundleSha256=createHash('sha256').update(readFileSync('output/production-validation/weekaboo-from-bundle.apk')).digest('hex');
 receipt.passed=true;
 console.log(checks.join('\n'));
}catch(error){receipt.error=String(error);throw error;}
finally{
 adb('shell','rm','-f','/sdcard/weekaboo-release-ui.xml');
 writeFileSync('output/production-validation/android-release-emulator.json',JSON.stringify(receipt,null,2));
}
