import { test, expect } from '@playwright/test';
import ICAL from 'ical.js';
import { ICloudCalDav } from '../src/engine/providers/caldav';
import { icloudWriter } from '../src/engine/providers/icloud-writes';
import { expandCalendarResource } from '../src/engine/providers/ical';
import { splitEventTarget } from '../src/engine/writes';
import { eventTarget } from '../src/services/contracts';
const calendar = { remoteId: 'https://p47-caldav.icloud.com/123/home/', calendar: { id: 'c', writable: true } } as any;
const href='/123/home/series.ics';
const timezone=`BEGIN:VTIMEZONE
TZID:Australia/Sydney
BEGIN:STANDARD
DTSTART:20200405T030000
TZOFFSETFROM:+1100
TZOFFSETTO:+1000
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20201004T020000
TZOFFSETFROM:+1000
TZOFFSETTO:+1100
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU
END:DAYLIGHT
END:VTIMEZONE`;
const master=`BEGIN:VEVENT
UID:series
DTSTART;TZID=Australia/Sydney:20260928T090000
DTEND;TZID=Australia/Sydney:20260928T100000
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Weekly
ATTENDEE;PARTSTAT=ACCEPTED:mailto:guest@example.test
X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-PT15M
DESCRIPTION:Reminder
END:VALARM
END:VEVENT`;
function fixture(events=master,zones=timezone, from='2026-09-20', to='2026-11-20') {
 let body=`BEGIN:VCALENDAR\nVERSION:2.0\n${zones}\n${events}\nEND:VCALENDAR`.replaceAll('\n','\r\n'),etag='v1';const calls:any[]=[];
 const reader=()=>expandCalendarResource({calendarId:'c',href,etag,ics:body,range:{start:new Date(from),end:new Date(to)}}).map(event=>({...event,editable:true}));
 const writer=icloudWriter(new ICloudCalDav({async request(request){calls.push(request);if(request.method==='GET')return {status:200,headers:{etag},body};expect(request.method).toBe('PUT');expect(request.headers?.['If-Match']).toBe(etag);body=request.body!;etag='v'+(Number(etag.slice(1))+1);return {status:204,headers:{etag},body:''};}}));
 return {reader,writer,calls,body:()=>body};
}
test('editing one iCloud occurrence detaches it, preserves master/alarms/guests, and keeps original identity across DST',async()=>{
 const f=fixture(),before=f.reader(),chosen=before[1],target=eventTarget(chosen),remoteId=splitEventTarget(target).remoteId;
 expect(target.scope).toBe('occurrence');expect(f.writer.canEdit!(chosen)).toBe(true);
 const originalRoot=new ICAL.Component(ICAL.parse(f.body()));
 const originalMaster=originalRoot.getFirstSubcomponent('vevent')!.toString();
 await f.writer.update('synthetic',calendar,remoteId,target,{start:'2026-10-06T00:00:00Z',end:'2026-10-06T01:00:00Z',title:'Moved'});
 const after=f.reader();expect(after.map(e=>e.start)).toEqual(['2026-09-27T23:00:00.000Z','2026-10-06T00:00:00.000Z','2026-10-11T22:00:00.000Z']);
 expect(after[1].commandId).toBe(chosen.commandId);expect(after[1].id).toBe(chosen.id);
 const root=new ICAL.Component(ICAL.parse(f.body()));expect(root.getFirstSubcomponent('vevent')!.toString()).toBe(originalMaster);
 const exception=root.getAllSubcomponents('vevent')[1];expect(exception.getAllSubcomponents('valarm')).toHaveLength(1);expect(exception.getAllProperties('attendee')).toHaveLength(1);expect(exception.getFirstProperty('recurrence-id')!.getParameter('tzid')).toBe('Australia/Sydney');
 expect((await f.writer.get('synthetic',calendar,remoteId))?.title).toBe('Moved');
});
test('deleting an occurrence writes a cancellation, never DELETEs the series; lookup confirms absent',async()=>{
 const f=fixture(),chosen=f.reader()[1],target=eventTarget(chosen),id=splitEventTarget(target).remoteId;
 await f.writer.remove('synthetic',calendar,id,target);
 expect(f.reader().map(e=>e.start)).toEqual(['2026-09-27T23:00:00.000Z','2026-10-11T22:00:00.000Z']);
 expect(await f.writer.get('synthetic',calendar,id)).toBeNull();expect(f.calls.every(c=>c.method!=='DELETE')).toBe(true);
});
test('a moved detached UTC recurrence ID is updated in place and not duplicated',async()=>{
 const exception=`BEGIN:VEVENT\nUID:series\nRECURRENCE-ID:20261004T220000Z\nDTSTART;TZID=Australia/Sydney:20261006T110000\nDTEND;TZID=Australia/Sydney:20261006T120000\nSUMMARY:Moved\nEND:VEVENT`;
 const f=fixture(master+'\n'+exception),chosen=f.reader().find(e=>e.title==='Moved')!,target=eventTarget(chosen);
 await f.writer.update('synthetic',calendar,splitEventTarget(target).remoteId,target,{description:'Updated only this occurrence'});
 expect(new ICAL.Component(ICAL.parse(f.body())).getAllSubcomponents('vevent')).toHaveLength(2);
 expect(f.reader().find(e=>e.id===chosen.id)?.description).toBe('Updated only this occurrence');
});
test('all-day recurring exceptions preserve exclusive civil dates and other days',async()=>{
 const f=fixture(master.replace('DTSTART;TZID=Australia/Sydney:20260928T090000','DTSTART;VALUE=DATE:20260928').replace('DTEND;TZID=Australia/Sydney:20260928T100000','DTEND;VALUE=DATE:20260929'),'');
 const chosen=f.reader()[1],target=eventTarget(chosen);
 await f.writer.update('synthetic',calendar,splitEventTarget(target).remoteId,target,{start:'2026-10-06',end:'2026-10-08',allDay:true});
 const changed=f.reader().find(e=>e.id===chosen.id)!;expect(changed).toMatchObject({start:'2026-10-06',end:'2026-10-08',allDay:true});
});
test('excluded and forged occurrences do not mutate; stale whole-resource revisions reject',async()=>{
 const f=fixture(master.replace('SUMMARY:Weekly','EXDATE;TZID=Australia/Sydney:20261005T090000\nSUMMARY:Weekly'));
 const chosen=fixture().reader()[1],target=eventTarget(chosen),id=splitEventTarget(target).remoteId;
 await expect(f.writer.update('synthetic',calendar,id,target,{title:'No'})).rejects.toMatchObject({code:'not-found'});
 await expect(f.writer.remove('synthetic',calendar,id,{...target,revision:'stale'})).rejects.toMatchObject({code:'conflict'});
 expect(f.calls.every(c=>c.method==='GET')).toBe(true);
});

test('an occurrence edit across autumn DST retains the local weekly anchor and time zone', async () => {
 const f=fixture(master.replaceAll('20260928','20260330'),timezone,'2026-03-20','2026-04-20');
 const chosen=f.reader()[1],target=eventTarget(chosen);
 await f.writer.update('synthetic',calendar,splitEventTarget(target).remoteId,target,{end:'2026-04-06T01:00:00Z'});
 expect(f.reader().map(e=>e.start)).toEqual(['2026-03-29T22:00:00.000Z','2026-04-05T23:00:00.000Z','2026-04-12T23:00:00.000Z']);
 expect(f.reader()[1].end).toBe('2026-04-06T01:00:00.000Z');
});
