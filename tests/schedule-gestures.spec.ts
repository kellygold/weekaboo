import {test,expect} from '@playwright/test';
import {fakeService} from './service-fixture';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00'));});

test('Schedule shares ranges and filters; heading picker jumps while Today returns home',async({page})=>{
  const api=await fakeService(page);api.addEvents([{id:98,calendar_id:7,title:'A long event title that should always wrap fully in the schedule',start_at:'2026-09-11T11:00:00+10:00',end_at:'2026-09-11T11:15:00+10:00',editable:true}]);
  await page.goto('/');await page.getByRole('button',{name:'Schedule',exact:true}).click();
  const schedule=page.getByRole('region',{name:'Schedule',exact:true});await expect(schedule.locator('.schedule-day')).toHaveCount(7);
  await page.getByRole('button',{name:'Day',exact:true}).click();await expect(schedule.locator('.schedule-day')).toHaveCount(1);await expect(schedule).toContainText('Coffee catch-up');
  await page.getByRole('button',{name:'Month',exact:true}).click();await expect(schedule.locator('.schedule-day')).toHaveCount(30);
  await page.getByRole('button',{name:'Choose date',exact:true}).click();const picker=page.getByRole('dialog',{name:'Choose date',exact:true});
  await picker.getByRole('button',{name:'Next month',exact:true}).click();await picker.getByRole('button',{name:'Saturday 10 October 2026',exact:true}).click();
  await expect(schedule.locator('.schedule-day')).toHaveCount(31);await expect(page.locator('.month-jump')).toContainText('October 2026');
  await page.getByRole('button',{name:'Today',exact:true}).click();await expect(page.locator('.month-jump')).toContainText('September 2026');
  await page.getByRole('button',{name:'4 days',exact:true}).click();await expect(schedule.locator('.schedule-day')).toHaveCount(4);
  await schedule.getByRole('button',{name:/A long event title/}).click();await expect(page.getByRole('complementary',{name:'Event editor'})).toContainText('A long event title');
  await page.getByRole('button',{name:'Close event editor'}).click();await expect(page.getByRole('complementary',{name:'Event editor'})).toHaveCount(0);
  await page.reload();await expect(page.getByRole('button',{name:'Schedule',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Schedule',exact:true}).click();await expect(page.locator('.time-grid')).toBeVisible();
});

test('short cards retain exact duration rails and complete text lines',async({page})=>{
  const api=await fakeService(page);api.addEvents([{id:98,calendar_id:7,title:'Engineering standup',start_at:'2026-09-09T08:00:00+10:00',end_at:'2026-09-09T08:15:00+10:00',editable:true}]);
  await page.setViewportSize({width:1280,height:800});await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('slider',{name:'Calendar spacing'}).press('Home');await page.getByRole('button',{name:'Close settings'}).click();
  const card=page.getByRole('button',{name:/Engineering standup/});await expect(card).toContainText('15m');
  expect(await card.evaluate(e=>{const title=e.querySelector('.event-card-title')!, rail=e.querySelector('.event-duration-rail')!;return title.clientHeight>=parseFloat(getComputedStyle(title).lineHeight) && rail.clientHeight < e.clientHeight;})).toBe(true);
  await expect(card.locator('.event-card-title')).toHaveCSS('white-space','nowrap');
  const spacing=await card.evaluate(e=>{const title=e.querySelector('.event-card-title')!.getBoundingClientRect(),duration=e.querySelector('.event-duration-label')!.getBoundingClientRect();return duration.left-title.right;});
  expect(spacing).toBeCloseTo(4,0);
  const fills=await page.locator('.event[data-calendar-id="7"]').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).backgroundColor));
  expect(new Set(fills).size).toBe(1);
});

test('mouse hover stays clear; hold reveals handles and resizing previews before saving',async({page})=>{
  const api=await fakeService(page);await page.goto('/');await page.getByRole('button',{name:'4 days',exact:true}).click();
  const card=page.getByRole('button',{name:/^Coffee catch-up/});await card.hover();
  await expect(page.locator('.event-time-end').first()).toBeHidden();
  const initial=(await card.boundingBox())!;
  await card.click({position:{x:initial.width/2,y:initial.height-2}});
  await expect(page.getByRole('complementary',{name:'Event editor'})).toBeVisible();
  await page.getByRole('button',{name:'Close event editor'}).click();
  await card.hover();await page.mouse.down();
  await expect(page.getByRole('button',{name:'Adjust end of Coffee catch-up'})).toBeVisible();await page.mouse.up();
  await page.screenshot({path:'output/mouse-event-handles.png',animations:'disabled'});
  const hour=(await page.locator('.time-grid').boundingBox())!.height/15;
  const handle=page.getByRole('button',{name:'Adjust end of Coffee catch-up'});const h=(await handle.boundingBox())!;
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2,h.y+h.height/2+hour*.5,{steps:10});await page.mouse.up();
  const confirm=page.getByRole('complementary',{name:'Change event time'});await expect(confirm).toContainText('10:00 am');expect(api.writes.filter(w=>w.path==='events/31')).toHaveLength(0);
  await confirm.getByRole('button',{name:'Save time',exact:true}).click();await expect(confirm).toHaveCount(0);
  expect(api.writes.find(w=>w.path==='events/31')?.body).toEqual({start_at:'2026-09-08T23:00:00.000Z',end_at:'2026-09-09T00:00:00.000Z'});
  const moved=page.getByRole('button',{name:/^Coffee catch-up/});
  const m=(await moved.boundingBox())!,target=(await page.locator('.day-column[data-date="2026-09-10"]').boundingBox())!;
  await page.mouse.move(m.x+m.width/2,m.y+m.height/2);await page.mouse.down();await expect(page.locator('.event-card-shell.is-adjusting')).toHaveCount(1);await page.mouse.move(target.x+target.width/2,m.y+m.height/2+hour,{steps:15});await page.mouse.up();
  await expect(confirm).toContainText('Thu, 10 Sept');await confirm.getByRole('button',{name:'Cancel',exact:true}).click();await expect(confirm).toHaveCount(0);
  expect(api.writes.filter(w=>w.path==='events/31')).toHaveLength(1);
});

test('series adjustments preserve the anchor and read-only events cannot be armed',async({page})=>{
 const api=await fakeService(page);
 const series={id:98,calendar_id:7,title:'Repeating review',start_at:'2026-09-09T11:00:00+10:00',end_at:'2026-09-09T12:00:00+10:00',editable:true,recurring:true,recurrence_rule:'FREQ=WEEKLY'};
 api.addEvents([series,{id:99,calendar_id:7,title:'Read only',start_at:'2026-09-09T13:00:00+10:00',end_at:'2026-09-09T14:00:00+10:00',editable:false}]);
 await page.route('**/api/events/98',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{...series,start_at:'2026-08-05T10:00:00+10:00',end_at:'2026-08-05T11:00:00+10:00'}});await route.fallback();});
 await page.goto('/');const readOnly=page.getByRole('button',{name:/^Read only/});await readOnly.focus();await page.keyboard.press('e');await expect(page.getByRole('button',{name:'Adjust start of Read only'})).toHaveCount(0);
 await page.getByRole('button',{name:/^Repeating review/}).focus();await page.keyboard.press('e');await page.getByRole('button',{name:'Adjust start of Repeating review'}).press('ArrowDown');
 const confirm=page.getByRole('complementary',{name:'Change event time'});await expect(confirm).toContainText('whole repeating series');await confirm.getByRole('button',{name:'Save series time'}).click();await expect(confirm).toHaveCount(0);
 expect(api.writes.find(w=>w.path==='events/98')?.body).toEqual({start_at:'2026-08-05T00:15:00.000Z',end_at:'2026-08-05T01:00:00.000Z'});
});

test('touch hold arms the event and touch handles snap without changing page zoom',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,viewport:{width:1280,height:800},timezoneId:'Australia/Sydney'});const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00'));const api=await fakeService(page);await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:'4 days',exact:true}).click();
 const cdp=await context.newCDPSession(page),card=page.getByRole('button',{name:/^Coffee catch-up/}),box=(await card.boundingBox())!;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
 await expect(page.getByRole('button',{name:'Adjust start of Coffee catch-up'})).toBeVisible();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const handle=(await page.getByRole('button',{name:'Adjust start of Coffee catch-up'}).boundingBox())!,hour=(await page.locator('.time-grid').boundingBox())!.height/15;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:handle.x+handle.width/2,y:handle.y+handle.height/2,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:handle.x+handle.width/2,y:handle.y+handle.height/2-hour*.25,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const confirm=page.getByRole('complementary',{name:'Change event time'});await expect(confirm).toContainText('8:45 am');expect(api.writes.filter(w=>w.path==='events/31')).toHaveLength(0);expect(await page.evaluate(()=>visualViewport!.scale)).toBe(1);
 await context.close();
});

test('mouse hold continues into a drag without releasing, and ordinary clicks still open details',async({page})=>{
 const api=await fakeService(page);await page.goto('/');await page.getByRole('button',{name:'4 days',exact:true}).click();
 const card=page.getByRole('button',{name:/^Coffee catch-up/});await card.click();await expect(page.getByRole('complementary',{name:'Event editor'})).toBeVisible();await page.getByRole('button',{name:'Close event editor'}).click();await expect(page.getByRole('complementary',{name:'Event editor'})).toHaveCount(0);
 const box=(await card.boundingBox())!,hour=(await page.locator('.time-grid').boundingBox())!.height/15;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await expect(page.locator('.event-card-shell.is-adjusting')).toHaveCount(1);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2+hour,{steps:12});await expect(page.locator('.event-adjust-preview')).toContainText('10:00 am');await page.mouse.up();
 await expect(page.getByRole('complementary',{name:'Change event time'})).toContainText('10:30 am');expect(api.writes.filter(w=>w.path==='events/31')).toHaveLength(0);
});

test('touch hold continues to move without lifting, while an ordinary swipe scrolls',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,viewport:{width:1280,height:800},timezoneId:'Australia/Sydney'});const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00'));const api=await fakeService(page);await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:'4 days',exact:true}).click();
 const cdp=await context.newCDPSession(page),card=page.getByRole('button',{name:/^Coffee catch-up/}),box=(await card.boundingBox())!,hour=(await page.locator('.time-grid').boundingBox())!.height/15;
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await expect(page.locator('.event-card-shell.is-adjusting')).toHaveCount(1);
 for(let delta=5;delta<=hour;delta+=5) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+delta,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const confirm=page.getByRole('complementary',{name:'Change event time'});await expect(confirm).toContainText('10:00 am');await confirm.getByRole('button',{name:'Cancel',exact:true}).click();await expect(confirm).toHaveCount(0);
 // Reset the selected state. A fresh touch should scroll rather than edit.
 await page.reload();const fresh=(await card.boundingBox())!;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fresh.x+fresh.width/2,y:fresh.y+fresh.height/2,id:1}]});
 for(let delta=10;delta<=90;delta+=10)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:fresh.x+fresh.width/2,y:fresh.y+fresh.height/2-delta,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>page.locator('.calendar-scroll').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);await expect(confirm).toHaveCount(0);await expect(page.locator('.event-card-shell.is-adjusting')).toHaveCount(0);expect(api.writes.filter(w=>w.path==='events/31')).toHaveLength(0);
 // A second finger cancels adjustment and hands the gesture to calendar zoom.
 await page.reload();const pinchBox=(await card.boundingBox())!,px=pinchBox.x+pinchBox.width/2,py=pinchBox.y+pinchBox.height/2;
 const before=(await page.locator('.time-grid').boundingBox())!.height;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:px-30,y:py,id:1}]});await expect(page.locator('.event-card-shell.is-adjusting')).toHaveCount(1);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:px-30,y:py,id:1},{x:px+30,y:py,id:2}]});
 for(let distance=40;distance<=60;distance+=5)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px-distance,y:py,id:1},{x:px+distance,y:py,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(confirm).toHaveCount(0);await expect(page.locator('.event-card-shell.is-adjusting')).toHaveCount(0);
 await expect.poll(async()=>(await page.locator('.time-grid').boundingBox())!.height).toBeGreaterThan(before*1.5);
 expect(await page.evaluate(()=>visualViewport!.scale)).toBe(1);
 await context.close();
});
