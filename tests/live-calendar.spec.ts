import { test, expect } from '@playwright/test';
import { choose } from './helpers';

const calendars = [
  { id: 1, name: 'Home', account_id: 1, account_email: 'person@example.test', account_provider: 'google', sync_enabled: true, sync_error: null, writable: true },
  { id: 2, name: 'Office', account_id: 2, account_email: 'work@example.test', account_provider: 'google', sync_enabled: true, sync_error: null, writable: true },
  { id: 3, name: 'Unclaimed', account_id: 2, account_email: 'work@example.test', account_provider: 'google', sync_enabled: false, sync_error: null, writable: true },
];
function event(id: number, title: string, start: string, end: string, calendar_id = 1, all_day = false) {
  return { id, title, start_at: start, end_at: end, calendar_id, all_day, location: null };
}
const events = [
  event(1, 'Solo morning', '2026-09-11T09:00:00+10:00', '2026-09-11T11:00:00+10:00'),
  event(2, 'Solo short', '2026-09-11T15:30:00+10:00', '2026-09-11T16:00:00+10:00'),
  event(3, 'Evening A', '2026-09-11T18:00:00+10:00', '2026-09-11T20:00:00+10:00'),
  event(4, 'Evening B', '2026-09-11T18:00:00+10:00', '2026-09-11T19:00:00+10:00', 2),
  event(5, 'Evening C', '2026-09-11T18:00:00+10:00', '2026-09-11T19:00:00+10:00'),
  event(6, 'After the rush', '2026-09-11T20:00:00+10:00', '2026-09-11T21:00:00+10:00'),
  event(7, 'Trip', '2026-09-10T00:00:00Z', '2026-09-12T00:00:00Z', 2, true),
  event(8, 'Overnight', '2026-09-11T23:00:00+10:00', '2026-09-12T02:00:00+10:00'),
  event(9, 'Not enabled', '2026-09-11T10:00:00+10:00', '2026-09-11T11:00:00+10:00', 3),
];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00'));
  await page.route('**/api/calendars/*', route => route.fulfill({ json: {} }));
  await page.route('**/api/calendars', route => route.fulfill({ json: calendars }));
  await page.route('**/api/events?*', route => route.fulfill({ json: events }));
});

test('real adapter gives isolated events full width and splits only overlapping groups', async ({ page }) => {
  await page.goto('/');
  const solo = page.getByRole('button', { name: 'Solo morning', exact: false });
  await expect(solo).toBeVisible();
  const column = await solo.locator('xpath=ancestor::div[contains(@class,"day-column")]').boundingBox();
  const soloBox = (await solo.boundingBox())!;
  expect(soloBox.width).toBeGreaterThan(column!.width * .95);
  const boxes = await Promise.all(['Evening A', 'Evening B', 'Evening C'].map(title => page.getByRole('button', { name: title, exact: false }).boundingBox()));
  for (const box of boxes) expect(box!.width).toBeLessThan(column!.width * .35);
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x);
  expect(boxes[1]!.x + boxes[1]!.width).toBeLessThanOrEqual(boxes[2]!.x);
  expect((await page.getByRole('button', { name: 'After the rush', exact: false }).boundingBox())!.width).toBeCloseTo(soloBox.width, 0);
  expect((await page.getByRole('button', { name: 'Solo short', exact: false }).boundingBox())!.height).toBeLessThan(soloBox.height);
  await expect(page.getByRole('button', { name: 'Not enabled', exact: false })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Tasks and all-day events' }).getByRole('button', { name: 'Trip', exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Overnight', exact: false })).toHaveCount(2);
  for (const node of await page.locator('.event').all()) {
    const box = (await node.boundingBox())!; const parent = (await node.locator('xpath=ancestor::div[contains(@class,"day-column")]').boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(parent.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(parent.y + parent.height + 1);
  }
});

test('calendar colors and work opt-in persist independently of ownership', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.event[data-calendar-id="1"]').first()).toBeVisible();
  const color1 = await page.locator('.event[data-calendar-id="1"]').first().evaluate(node => getComputedStyle(node).backgroundColor);
  const color2 = await page.locator('.event[data-calendar-id="2"]').first().evaluate(node => getComputedStyle(node).backgroundColor);
  expect(color1).not.toEqual(color2);
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  await page.getByRole('button', { name: 'Options for Home (1)' }).click();
  await page.getByRole('button', { name: 'Color for Home (1)', exact: true }).click();
  await page.getByLabel('Custom Color for Home (1)').fill('#aa4488');
  await page.getByRole('button', { name: 'Color for Home (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Options for Office (2)' }).click();
  await choose(page, 'Group for Office (2)', 'Work');
  await page.getByRole('button', { name: 'Close calendars' }).click();
  await expect(page.getByRole('button', { name: 'Evening B', exact: false })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Solo morning', exact: false }).locator('.event-duration-rail')).toHaveCSS('background-color', 'rgb(170, 68, 136)');
  await expect(page.getByRole('button', { name: 'Evening B', exact: false })).toHaveCount(0);
  await choose(page, 'Calendar group', 'All calendars');
  await expect(page.getByRole('button', { name: 'Evening B', exact: false })).toBeVisible();
});

test('backend failure is explicit and never substitutes mock events', async ({ page }) => {
  await page.route('**/api/events?*', route => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByText('Calendar service unavailable · Display may be out of date')).toBeVisible();
  await expect(page.locator('.event')).toHaveCount(0);
  await expect(page.getByText('Sample calendars', { exact: true })).toHaveCount(0);
});
