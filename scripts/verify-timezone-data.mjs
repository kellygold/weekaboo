// No network: verify bundled timezone data against installed ICU for current test instants.
import ICAL from 'ical.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const bytes=readFileSync('src/engine/data/vtimezones.json');const data=JSON.parse(bytes);
const errors=[],differences=[],unsupported=[];let comparisons=0;
for(const [id,ics]of Object.entries(data.zones)){
 try{
  const root=new ICAL.Component(ICAL.parse(ics)),zone=root.getTimeZoneByID(id);if(!zone)throw new Error('No matching VTIMEZONE');
  let formatter;try{formatter=new Intl.DateTimeFormat('en-GB',{timeZone:id,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}catch{unsupported.push(id);continue;}
  for(const day of ['2026-01-15','2026-03-29','2026-04-05','2026-07-15','2026-10-04','2026-11-01','2040-01-15','2040-07-15']){
   const instant=new Date(day+'T12:00:00Z'),value=ICAL.Time.fromJSDate(instant,true).convertToZone(zone);
   const parts=Object.fromEntries(formatter.formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
   const actual=[value.year,value.month,value.day,value.hour,value.minute,value.second],expected=[parts.year,parts.month,parts.day,parts.hour,parts.minute,parts.second];comparisons++;
   if(JSON.stringify(actual)!==JSON.stringify(expected))differences.push({id,day,ical:actual,icu:expected});
  }
 }catch(e){errors.push({id,error:String(e)});}
}
const receipt={version:data.version,sha256:createHash('sha256').update(bytes).digest('hex'),zones:Object.keys(data.zones).length,comparisons,errors,differences,unsupported,icu:process.versions.icu,tz:process.versions.tz};
mkdirSync('output/standalone-icloud',{recursive:true});writeFileSync('output/standalone-icloud/timezone-verification.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify({...receipt,differences:differences.slice(0,12)},null,2));
if(errors.length)process.exitCode=1;
