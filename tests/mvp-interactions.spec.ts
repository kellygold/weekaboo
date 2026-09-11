import { test, expect } from '@playwright/test';
import { choose, editTaskDetails } from './helpers';

import { fakeService } from './service-fixture';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00')); });

test('event edits are anchored, fit, protect dirty changes and support create/delete', async ({ page }) => {
  const api = await fakeService(page);
  await page.goto('/');
  const event = page.getByRole('button', { name: /^Coffee catch-up/ });
  await event.click();
  const editor = page.getByRole('complementary', { name: 'Event editor' });
  await expect(editor).toBeVisible();
  await expect.poll(() => editor.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  expect(await editor.locator('.composer-body').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await expect.poll(async () => {
    const anchor = (await event.boundingBox())!, popout = (await editor.boundingBox())!;
    return Math.abs(popout.x + popout.width + 12 - anchor.x) < 3 || Math.abs(popout.x - anchor.x - anchor.width - 12) < 3;
  }).toBe(true);
  await page.getByRole('button', { name: 'Replay Weekaboo animation' }).click();
  await expect(editor).toHaveCount(0);
  await event.click();
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByLabel('Event title', { exact: true }).fill('Changed coffee');
  await page.getByRole('button', { name: 'Replay Weekaboo animation' }).click();
  await expect(editor.getByText('You have unsaved changes.')).toBeVisible();
  await editor.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await editor.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(api.writes.find(w => w.method === 'PATCH')?.body).toEqual({ title: 'Changed coffee' });
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  await page.getByLabel('Event title', { exact: true }).fill('A whole day');
  await page.getByLabel('All day', { exact: true }).check();
  await page.getByLabel('Event starts', { exact: true }).fill('2026-09-09');
  await page.getByLabel('Event ends', { exact: true }).fill('2026-09-09');
  await editor.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(api.writes.find(w => w.method === 'POST' && w.path === 'events')?.body.end_at).toBe('2026-09-10T00:00:00Z');
  await page.getByRole('button', { name: 'A whole day', exact: true }).click();
  await page.getByRole('button', { name: 'Delete event', exact: true }).click();
  await editor.getByRole('button', { name: 'Delete event', exact: true }).click();
  await expect(page.getByRole('button', { name: 'A whole day', exact: true })).toHaveCount(0);
});

test('calendars group by individual account; settings is appearance only; disabling reaches API', async ({ page }) => {
  const api = await fakeService(page); await page.goto('/');
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  await expect(page.locator('.calendar-account h3')).toHaveText(['apple@example.test', 'one@example.test', 'two@example.test']);
  await page.getByRole('button', { name: 'Options for Work (13)' }).click();
  await choose(page, 'Group for Work (13)', 'Work');
  await page.getByRole('switch', { name: 'Sync Work (13)' }).click();
  await expect(page.getByRole('switch', { name: 'Sync Work (13)' })).not.toBeChecked();
  await expect.poll(() => api.writes.some(w => w.path === 'calendars/13' && w.body.sync_enabled === false)).toBe(true);
  await page.getByRole('button', { name: 'Manage accounts', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Connect Google', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Connect iCloud', exact: true }).click();
  await expect(page.getByLabel('App-specific password')).toBeVisible();
  await page.getByRole('button', { name: 'Close accounts' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.calendar-account')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Event text size' })).toBeVisible();
});

test('tasks drag onto any day and use an anchored editor with unsaved protection', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('textbox', { name: 'New task' }).fill('Get a plant pot');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const handle = (await page.getByRole('button', { name: 'Reorder Get a plant pot' }).boundingBox())!;
  const target = (await page.locator('.untimed-day[data-date="2026-09-11"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 18 }); await page.mouse.up();
  await expect(page.locator('.untimed-day[data-date="2026-09-11"]')).toContainText('Get a plant pot');
  await page.reload();
  await page.getByRole('button', { name: 'Edit Get a plant pot', exact: true }).click();
  const editor = page.getByRole('complementary', { name: 'Task editor' });
  await expect(editor).toBeVisible();
  await editTaskDetails(page);
  await expect(editor.getByLabel('On calendar', { exact: true })).toHaveValue('2026-09-11');
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('');
  await page.getByLabel('Task', { exact: true }).fill('Unsaved change');
  await page.getByRole('button', { name: 'Replay Weekaboo animation' }).click();
  await expect(editor.getByText('You have unsaved changes.')).toBeVisible();
  await editor.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Get a plant pot', exact: true })).toBeVisible();
});

test('busy month cells stay contained and expose hidden items through more', async ({ page }) => {
  const api = await fakeService(page);
  api.addEvents(Array.from({ length: 12 }, (_, i) => ({ id: 100+i, calendar_id: 7, title: `Busy appointment ${i}`, start_at: '2026-09-09T09:00:00+10:00', end_at: '2026-09-09T09:30:00+10:00', all_day: false, editable: true })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  const cell = page.locator('.month-day[data-date="2026-09-09"]');
  await expect(cell.getByRole('button', { name: /Show .* more/ })).toBeVisible();
  for (const item of await page.locator('.month-day .compact-item').all()) {
    const child = (await item.boundingBox())!, parent = (await item.locator('..').locator('..').boundingBox())!;
    expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height);
  }
  await cell.getByRole('button', { name: /Show .* more/ }).click();
  const overview = page.getByRole('complementary', { name: 'Day overview' });
  await expect(overview.locator('.compact-item')).toHaveCount(13);
  await overview.getByRole('button', { name: /Coffee catch-up/ }).click();
  const editor = page.getByRole('complementary', { name: 'Event editor' });
  await expect(editor).toBeVisible();
  await expect.poll(async () => {
    const box = (await editor.boundingBox())!, source = (await cell.boundingBox())!;
    return box.x > 12 && Math.abs(box.y - source.y) < source.height;
  }).toBe(true);
});

test('viewport fits desktop and tablet ratios; wheel zoom expands then compresses time', async ({ page }) => {
  await page.goto('/?demo=1');
  for (const [width, height] of [[1920,1080],[1440,900],[1280,800],[1024,600],[800,1280],[600,960],[390,844]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual({ width, height });
    const calendar = (await page.locator('.calendar-scroll').boundingBox())!;
    expect(calendar.height).toBeGreaterThan(90);
    expect((await page.locator('.task-list-wrap').boundingBox())!.height).toBeGreaterThan(40);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const old = (await page.locator('.time-grid').boundingBox())!.height;
  await page.locator('.calendar-scroll').hover(); await page.keyboard.down('Control'); await page.mouse.wheel(0, -90); await page.keyboard.up('Control');
  await expect.poll(async () => (await page.locator('.time-grid').boundingBox())!.height).toBeGreaterThan(old * 1.5);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('slider', { name: 'Calendar spacing' }).press('Home');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect.poll(() => page.locator('.calendar-scroll').evaluate(e => e.scrollHeight <= e.clientHeight)).toBe(true);
});

test('two-finger pinch changes calendar density without zooming the page', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5188/?demo=1');
  const grid = page.locator('.time-grid');
  const old = (await grid.boundingBox())!.height;
  const area = (await page.locator('.calendar-scroll').boundingBox())!;
  const x = area.x + area.width / 2, y = area.y + area.height / 2;
  const session = await context.newCDPSession(page);
  const points = (distance: number) => [{ x: x - distance/2, y, id: 1 }, { x: x + distance/2, y, id: 2 }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(80) });
  for (let distance=90; distance<=160; distance+=10) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await grid.boundingBox())!.height).toBeGreaterThan(old * 1.7);
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
  await context.close();
});
