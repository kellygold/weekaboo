import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';

let fixture: string;
test.beforeAll(async () => {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {App} from './src/main';
    import {ServiceProvider} from './src/services/context';
    let rows=[{id:'event',commandId:'calendar:event',calendarId:'calendar',title:'Revision fixture',start:'2026-09-12T09:00:00+10:00',end:'2026-09-12T10:00:00+10:00',allDay:false,editable:true,revision:'v1',description:'Original notes'}];
    if(location.search.includes('series'))rows[0].recurrenceRule='FREQ=DAILY';
    let hold=false, finish, fail;
    const writes=[];
    window.proof={writes, release:()=>{hold=false;finish(structuredClone(rows));},fail:()=>{hold=false;fail(Error('Offline'));},external:()=>{rows=[{...rows[0],description:'Changed elsewhere',revision:'v3'}]},remove:()=>{rows=[]},hold:()=>{hold=true}};
    const services={
      lifecycle:{isActive:()=>true,subscribe:()=>()=>{}},files:{},
      tasks:{list:async()=>[]},accounts:{list:async()=>[],availability:async()=>({google:true,microsoft:false,icloud:false})},
      calendars:{
        getEvent:async()=>structuredClone(rows[0]),
        listCalendars:async()=>[{id:'calendar',name:'Home',scope:'personal',color:'#819b73',writable:true,enabled:true,provider:'google'}],
        listEvents:async()=>hold?new Promise((resolve,reject)=>{finish=resolve;fail=reject}):structuredClone(rows),refresh:async()=>{},
        updateEvent:async(target,changes)=>{writes.push({kind:'update',target});if(target.revision!==rows[0].revision)throw Error('This event changed elsewhere. Refresh before editing.');rows=[{...rows[0],...changes,revision:'v2'}];hold=true;return{syncState:'synced'}},
        deleteEvent:async target=>{writes.push({kind:'delete',target});if(target.revision!==rows[0].revision)throw Error('This event changed elsewhere.');rows=[];},
      }
    };
    createRoot(document.getElementById('proof')).render(<ServiceProvider services={services}><App demo={false}/></ServiceProvider>);
  ` }, bundle: true, write: false, format: 'iife', loader: {'.css':'empty'}, define: {'process.env.NODE_ENV':'"production"'} });
  fixture = bundle.outputFiles[0].text;
});
async function open(page: Page, series=false) {
  await page.clock.setFixedTime(new Date('2026-09-12T12:00:00+10:00'));
  await page.route('**/preview-proof*', r => r.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/event-composer.css"><link rel="stylesheet" href="/src/calendar-controls.css"><link rel="stylesheet" href="/src/app-shell.css"></head><body><div id="proof"></div></body></html>'}));
  await page.goto('/preview-proof'+(series?'?series=1':''));await page.addScriptTag({content:fixture});
  await expect(page.getByRole('button',{name:'Refresh calendars',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:/Revision fixture/}).click();
}
async function edit(page: Page) {
  await page.getByRole('button',{name:'Edit event',exact:true}).click();
  await page.getByRole('textbox',{name:'Notes',exact:true}).fill('Updated notes');
  await page.getByRole('button',{name:'Save event',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Event title'})).toHaveCount(0);
}
test('immediate reopen waits for refresh and deletes with the saved revision',async({page})=>{
  await open(page);await edit(page);
  await page.getByRole('button',{name:/Revision fixture/}).click();
  await expect(page.getByRole('button',{name:'Edit event',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Delete event',exact:true})).toBeDisabled();
  await page.evaluate(()=> (window as any).proof.release());
  await expect(page.locator('.detail-notes')).toContainText('Updated notes');
  await page.getByRole('button',{name:'Delete event',exact:true}).click();
  await page.getByRole('button',{name:'Delete event',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).proof.writes)).toEqual([{kind:'update',target:{id:'calendar:event',scope:'event',revision:'v1'}},{kind:'delete',target:{id:'calendar:event',scope:'event',revision:'v2'}}]);
});
for(const series of [false,true]) test(`an open ${series?'series':'event'} draft keeps its original revision after a background refresh`,async({page})=>{
  await open(page,series);await page.getByRole('button',{name:'Edit event',exact:true}).click();
  await page.getByRole('textbox',{name:'Notes',exact:true}).fill('My pending draft');
  await page.evaluate(()=>(window as any).proof.external());
  await page.getByRole('button',{name:'Refresh calendars',exact:true}).evaluate(button => button.click());
  await expect(page.getByRole('button',{name:'Refresh calendars',exact:true})).toBeEnabled();
  await expect(page.getByRole('textbox',{name:'Notes',exact:true})).toHaveText('My pending draft');
  await page.getByRole('button',{name:'Save event',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('changed elsewhere');
  expect(await page.evaluate(()=>(window as any).proof.writes[0].target.revision)).toBe('v1');
});
test('a removed event becomes unavailable while an open preview remains readable',async({page})=>{
  await open(page);await page.evaluate(()=>(window as any).proof.remove());
  await page.getByRole('button',{name:'Refresh calendars',exact:true}).evaluate(button => button.click());
  await expect(page.getByText('This event is no longer in the calendar.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Delete event',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Edit event',exact:true})).toHaveCount(0);
});
test('failed refresh retains honest status and does not send a mutation',async({page})=>{
  await open(page);await page.evaluate(()=>(window as any).proof.hold());
  await page.getByRole('button',{name:'Refresh calendars',exact:true}).evaluate(button => button.click());
  await expect(page.getByRole('button',{name:'Delete event',exact:true})).toBeDisabled();
  await page.evaluate(()=>(window as any).proof.fail());
  await expect(page.locator('.calendar-refresh [role=status]')).toContainText('service unavailable');
  expect(await page.evaluate(()=>(window as any).proof.writes)).toEqual([]);
});
