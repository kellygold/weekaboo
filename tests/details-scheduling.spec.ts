import { test, expect, type Page } from '@playwright/test';
import { fakeService } from './service-fixture';
import { editTaskDetails } from './helpers';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00')); });
async function add(page: Page, title: string) { await page.getByRole('textbox', { name: 'New task' }).fill(title); await page.getByRole('button', { name: 'Add task', exact: true }).click(); }
async function drag(page: Page, source: ReturnType<Page['locator']>, x: number, y: number) { const box = (await source.boundingBox())!; await page.mouse.move(box.x + box.width/2, box.y + box.height/2); await page.mouse.down(); await page.mouse.move(x,y,{steps:20}); await page.mouse.up(); }

test('event preview reads full content, safe links and expandable RSVP list before editing', async ({ page }) => {
  const api = await fakeService(page);
  api.calendars[0].name = 'one@example.test';
  api.addEvents([{ id: 42, calendar_id: 7, title: 'A thoughtful preview', start_at: '2026-09-09T12:00:00+10:00', end_at: '2026-09-09T13:00:00+10:00', all_day: false, editable: true, location: 'A very long address '.repeat(16), description: '<p>First paragraph</p><a href="javascript:alert(1)">Bad link</a><img src="https://tracker.invalid/pixel">' + '<p>A useful paragraph with all the detail.</p>'.repeat(25) + '<p>Final paragraph</p>', meeting_url: 'https://meet.google.com/abc-defg-hij', attendees: [{ email: 'other@example.test', name: 'Other', status: 'declined' }, { email: 'guest@example.test', name: 'Guest', status: 'accepted' }, { email: 'waiting@example.test', name: 'Waiting', status: 'needsAction' }, { email: 'maybe@example.test', name: 'Maybe guest', status: 'tentative' }] }]);
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('/');
  await page.getByRole('button', { name: /A thoughtful preview/ }).click();
  const card = page.getByRole('complementary', { name: 'Event editor' });
  await expect(card.getByRole('textbox')).toHaveCount(0);
  await expect(card.locator('.detail-calendar')).toHaveText('one@example.test');
  await expect(card.getByRole('link', { name: /Join Google Meet/ })).toHaveAttribute('href','https://meet.google.com/abc-defg-hij');
  await expect(card.locator('a[href^="javascript:"], img, script')).toHaveCount(0);
  await expect(card.locator('.guest-groups')).toBeHidden();
  await card.locator('.detail-attendees summary').click();
  await expect(card.getByText('guest@example.test', { exact: true })).toBeVisible();
  await expect(card.getByRole('region', { name: 'Declined', exact: true })).toContainText('Other');
  await expect(card.locator('.guest-group-heading')).toHaveText(['Going1', 'Maybe1', 'Awaiting reply1', 'Declined1']);
  await expect(card.locator('.detail-attendees li strong')).toHaveText(['Guest', 'Maybe guest', 'Waiting', 'Other']);
  await card.getByText('Final paragraph', { exact: true }).scrollIntoViewIfNeeded();
  await expect(card.getByText('Final paragraph', { exact: true })).toBeInViewport();
  expect(await card.locator('.composer-body').evaluate(e=>e.scrollWidth <= e.clientWidth)).toBe(true);
  await card.getByRole('button',{ name:'Edit event',exact:true }).click();
  const notes = page.getByLabel('Notes', { exact:true });
  await notes.scrollIntoViewIfNeeded();
  expect(await notes.evaluate(e=>e.scrollHeight <= e.clientHeight+2)).toBe(true);
});

test('task grid drop schedules, both resize edges snap, and anytime removes only the time', async ({ page }) => {
  const api=await fakeService(page); await page.goto('/'); await page.getByRole('button',{name:'4 days',exact:true}).click();
  await add(page,'Buy a plant pot');
  const column=page.locator('.day-column[data-date="2026-09-11"]'); const box=(await column.boundingBox())!;
  const hour=box.height/15; const x=box.x+box.width/2;
  await drag(page,page.getByRole('button',{name:'Reorder Buy a plant pot'}),x,box.y+4.25*hour);
  const block=page.locator('.scheduled-task'); await expect(block).toHaveCount(1);
  await expect(page.locator('.untimed-day[data-date="2026-09-11"]')).not.toContainText('Buy a plant pot');
  await page.reload();
  await page.getByRole('button',{name:'Open scheduled task Buy a plant pot'}).click();
  await expect(page.getByRole('complementary',{name:'Task editor'}).getByText('11:15 am – 11:45 am',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close task editor'}).click(); await expect(page.getByRole('complementary',{name:'Task editor'})).toHaveCount(0);
  const handle=page.getByRole('button',{name:'Resize end of Buy a plant pot'}); let h=(await handle.boundingBox())!;
  await drag(page,handle,h.x+h.width/2,h.y+h.height/2+hour*.75);
  const top=page.getByRole('button',{name:'Resize start of Buy a plant pot'}); h=(await top.boundingBox())!;
  await drag(page,top,h.x+h.width/2,h.y+h.height/2-hour*.25);
  await page.getByRole('button',{name:'Open scheduled task Buy a plant pot'}).click();
  await expect(page.getByRole('complementary',{name:'Task editor'}).getByText('11:00 am – 12:30 pm',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Anytime',exact:true}).click();
  await expect(block).toHaveCount(0);
  await expect(page.locator('.untimed-day[data-date="2026-09-11"]')).toContainText('Buy a plant pot');
  await page.getByRole('button',{name:'Edit Buy a plant pot',exact:true}).click(); await editTaskDetails(page);
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('');
  expect(api.writes.filter(w=>w.path.startsWith('events'))).toEqual([]);
});

test('Today retains completed tasks; Done is seven days while calendar history remains', async ({ page }) => {
  await page.goto('/?demo=1'); await page.getByRole('button',{name:'For today',exact:true}).click(); await add(page,'Water the plant');
  await page.getByRole('button',{name:'Complete Water the plant'}).click();
  await expect(page.getByRole('button',{name:'Restore Water the plant'})).toBeVisible();
  await page.getByRole('button',{name:'Done',exact:true}).click(); await expect(page.getByRole('button',{name:'Restore Water the plant'})).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-09-15T12:00:00+10:00')); await page.reload(); await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.getByRole('button',{name:'Restore Water the plant'})).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-09-16T12:00:00+10:00')); await page.reload(); await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.getByRole('button',{name:'Restore Water the plant'})).toHaveCount(0);
  await page.getByRole('button',{name:'Previous week'}).click();
  await expect(page.getByRole('button',{name:'Open task Water the plant on calendar'})).toHaveClass(/is-done/);
});

test('account header removal asks first and removes only that account', async ({ page }) => {
  const api=await fakeService(page); await page.goto('/'); await page.getByRole('button',{name:'Connected calendars',exact:true}).click();
  await page.getByRole('button',{name:'Remove Google account one@example.test'}).click();
  await expect(page.getByText('Remove this account and its cached calendars from Weekaboo? Events stay in the original calendar service.')).toBeVisible();
  expect(api.writes.filter(w=>w.method==='DELETE')).toHaveLength(0);
  await page.getByRole('button',{name:'Disconnect account',exact:true}).click();
  await expect(page.locator('.connected-account h3')).toHaveText(['two@example.test','apple@example.test']);
  expect(api.writes.filter(w=>w.method==='DELETE').map(w=>w.path)).toEqual(['accounts/2']);
});

test('shared date picker selects days, preserves task identity and guards invalid dates', async ({ page }) => {
  await page.goto('/?demo=1');await add(page,'Plan a weekend');await page.getByRole('button',{name:'Edit Plan a weekend'}).click();await editTaskDetails(page);
  await page.getByRole('button',{name:'Choose due date',exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Choose due date',exact:true});await expect(picker).toBeVisible();
  await picker.getByRole('button',{name:'Friday 11 September 2026',exact:true}).click();
  await expect(page.getByLabel('Due date',{exact:true})).toHaveValue('2026-09-11');await expect(picker).toBeHidden();
  await page.getByRole('button',{name:'Save task',exact:true}).click();await expect(page.getByRole('complementary',{name:'Task editor'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Edit Plan a weekend'})).toContainText('Due 11 Sept');
  await page.getByRole('button',{name:'Edit Plan a weekend'}).click();await editTaskDetails(page);
  await page.getByLabel('Due date',{exact:true}).fill('2026-02-31');await page.getByRole('button',{name:'Save task',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Task editor'})).toBeVisible();
  expect(await page.getByLabel('Due date',{exact:true}).evaluate(e=>(e as HTMLInputElement).validity.valid)).toBe(false);
});

test('Anytime promotes unfinished tasks and expands overflow inline without the day agenda', async ({page}) => {
  await page.goto('/?demo=1'); await page.getByRole('button',{name:'For today',exact:true}).click();
  for (const name of ['One','Two','Three','Four','Five']) await add(page,name);
  await page.getByRole('button',{name:'Complete One',exact:true}).click();
  await page.getByRole('button',{name:'Complete Two',exact:true}).click();
  const day=page.locator('.untimed-day[data-date="2026-09-09"]');
  await expect(day.getByRole('button',{name:/Open task/})).toHaveText(['Three','Four','Five']);
  await day.getByRole('button',{name:'Show 2 more on 2026-09-09'}).click();
  await expect(day.getByRole('button',{name:/Open task/})).toHaveText(['Three','Four','Five','OneDone','TwoDone']);
  await expect(page.getByRole('complementary',{name:'Day overview'})).toHaveCount(0);
  await expect(day.getByRole('button',{name:'Open task One on calendar'})).toBeInViewport();
  await day.getByRole('button',{name:'Collapse anytime on 2026-09-09'}).click();
  await expect(day.getByRole('button',{name:/Open task/})).toHaveCount(3);
  await page.getByRole('button',{name:'Restore One',exact:true}).click();
  await expect(day.getByRole('button',{name:/Open task/})).toHaveText(['One','Three','Four']);
});

test('Today reordering leaves completed ranks intact when tasks are restored', async ({page}) => {
  await page.goto('/?demo=1'); await page.getByRole('button',{name:'For today',exact:true}).click();
  for (const name of ['First','Finished','Last']) await add(page,name);
  await page.getByRole('button',{name:'Complete Finished',exact:true}).click();
  await expect(page.getByRole('button',{name:'Restore Finished',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reorder First'}).hover();
  const first=(await page.getByRole('button',{name:'Reorder First'}).boundingBox())!;
  await drag(page,page.getByRole('button',{name:'Reorder Last'}),first.x+first.width/2,first.y+first.height/2);
  await expect(page.locator('.task-row .task-content > span')).toHaveText(['Last','First','Finished']);
  await page.reload();
  await page.getByRole('button',{name:'For today',exact:true}).click();
  await page.getByRole('button',{name:'Restore Finished',exact:true}).click();
  await expect(page.locator('.task-row .task-content > span')).toHaveText(['Last','Finished','First']);
});


for (const join of ['https://teams.live.com/meet/123456789?p=fake-passcode', 'https://teams.microsoft.com/l/meetup-join/fake-thread/0?context=fake', 'https://teams.microsoft.com/meet/123456789?p=fake-passcode']) {
  test(`Teams preview separates the join link from meeting options: ${new URL(join).hostname}${new URL(join).pathname}`, async ({ page }) => {
    const api = await fakeService(page);
    const host = new URL(join).origin;
    const options = `${host}/meetingOptions/meetings/fake-id/view?localeCode=en-US`;
    const otherMeeting = `${host}/meet/987654321?p=another-passcode`;
    api.addEvents([{ id: 43, calendar_id: 7, title: 'Teams options test', start_at: '2026-09-09T12:00:00+10:00', end_at: '2026-09-09T13:00:00+10:00', all_day: false, editable: true, meeting_url: join, description: `<p>Notes</p><a href="${join}">Join the meeting</a><a href="${options}">Meeting options</a><a href="${host}/help">Teams help</a>` }]);
    await page.goto('/');
    await page.getByRole('button', { name: /Teams options test/ }).click();
    const card = page.getByRole('complementary', { name: 'Event editor' });
    await expect(card.locator('.meeting-actions a')).toHaveCount(1);
    await expect(card.getByRole('link', { name: /Join Microsoft Teams/ })).toHaveAttribute('href', join);
    await expect(card.getByRole('link', { name: 'Meeting options', exact: true })).toHaveAttribute('href', options);
    // Two real meetings on the same host must not be collapsed into one.
    await page.getByRole('button', { name: 'Close event editor' }).click();
    api.addEvents([{ id: 44, calendar_id: 7, title: 'Two actual Teams meetings', start_at: '2026-09-09T14:00:00+10:00', end_at: '2026-09-09T15:00:00+10:00', all_day: false, editable: true, meeting_url: join, description: `<a href="${otherMeeting}">Alternative call</a>` }]);
    await page.reload();
    await page.getByRole('button', { name: /Two actual Teams meetings/ }).click();
    await expect(card.locator('.meeting-actions a')).toHaveCount(2);
  });
}
