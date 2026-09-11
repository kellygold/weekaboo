import { test, expect } from '@playwright/test';
import { fakeService } from './service-fixture';
import { editTaskDetails } from './helpers';
test.beforeEach(async ({page}) => { await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00')); });

test('zoom stops at the viewport and event geometry matches hour lines across views', async ({page}) => {
  await fakeService(page); await page.goto('/');
  for (const view of ['Day','4 days','Week']) {
    await page.getByRole('button',{name:view,exact:true}).click();
    for (const [width,height] of [[1280,800],[1800,1100]]) {
      await page.setViewportSize({width,height});
      await page.getByRole('button',{name:'Settings',exact:true}).click();
      await page.getByRole('slider',{name:'Calendar spacing'}).press('Home');
      await page.getByRole('button',{name:'Close settings'}).click();
      await expect.poll(() => page.locator('.calendar-scroll').evaluate(e=>Math.abs(e.scrollHeight-e.clientHeight))).toBeLessThanOrEqual(1);
      const check = async () => {
        const geometry = await page.evaluate(() => {
          const grid = document.querySelector('.time-grid')!.getBoundingClientRect();
          const element = [...document.querySelectorAll('.day-column .event')].find(e=>e.textContent!.includes('Coffee catch-up'))!;
          const event = element.getBoundingClientRect(); const duration = element.querySelector('.event-duration-rail')!.getBoundingClientRect().height;
          return { start: Math.abs(event.y-grid.y-grid.height*2/15), duration: Math.abs(duration-(grid.height*.5/15-2)) };
        });
        expect(geometry.start).toBeLessThan(1);
        expect(geometry.duration).toBeLessThan(1);
      };
      await check();
      const before=(await page.locator('.time-grid').boundingBox())!.height;
      await page.locator('.calendar-scroll').hover(); await page.keyboard.down('Control'); await page.mouse.wheel(0,900); await page.keyboard.up('Control');
      await expect.poll(async () => (await page.locator('.time-grid').boundingBox())!.height).toBeCloseTo(before,0);
      await check();
      await page.keyboard.down('Control'); await page.mouse.wheel(0,-60); await page.keyboard.up('Control');
      await expect.poll(async () => (await page.locator('.time-grid').boundingBox())!.height).toBeGreaterThan(before+50);
      await check();
    }
  }
});

test('drawing creates a draft only, styled time choices preserve exact typed minutes', async ({page}) => {
  const api=await fakeService(page); await page.goto('/'); await page.getByRole('button',{name:'4 days',exact:true}).click();
  const box=(await page.locator('.day-column[data-date="2026-09-11"]').boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height*3/15); await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height*4.25/15,{steps:10});
  await expect(page.locator('.event-draft-range')).toContainText('10:00 am – 11:15 am'); await page.mouse.up();
  await expect(page.getByLabel('Event starts',{exact:true})).toHaveValue('2026-09-11');
  await expect(page.getByLabel('Event starts time',{exact:true})).toHaveValue('10:00');
  await expect(page.getByLabel('Event ends time',{exact:true})).toHaveValue('11:15');
  expect(api.writes.filter(w=>w.path==='events')).toEqual([]);
  await page.getByRole('button',{name:'Choose event ends time',exact:true}).click();
  await page.getByRole('option',{name:'11:30 am',exact:true}).click();
  await expect(page.getByLabel('Event ends time',{exact:true})).toHaveValue('11:30');
  await page.getByLabel('Event ends time',{exact:true}).fill('11:40');
  await expect(page.getByLabel('Event ends time',{exact:true})).toHaveValue('11:40');
});

test('changing the task day after clearing its end time safely restores a valid block', async ({page}) => {
  await page.goto('/?demo=1'); await page.getByRole('textbox',{name:'New task'}).fill('Incomplete time'); await page.getByRole('button',{name:'Add task',exact:true}).click();
  await page.getByRole('button',{name:'Edit Incomplete time',exact:true}).click(); await editTaskDetails(page);
  await page.getByLabel('Set aside some time').check();
  await page.getByLabel('Task ends time',{exact:true}).fill('');
  await page.getByLabel('On calendar',{exact:true}).fill('2026-09-12');
  await expect(page.getByLabel('Task starts',{exact:true})).toHaveValue('2026-09-12');
  await expect(page.getByLabel('Task ends time',{exact:true})).toHaveValue('09:30');
  await page.getByRole('button',{name:'Save task',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Task editor'})).toHaveCount(0);
});
