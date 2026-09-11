import { test, expect } from '@playwright/test';
import { choose, editTaskDetails } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00'));
  await page.goto('/?demo=1');
});

test('completed backlog tasks remain on their completion date across reload and later days', async ({ page }) => {
  await page.getByRole('textbox', { name: 'New task' }).fill('Buy filters');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByRole('button', { name: 'Complete Buy filters' }).click();
  const chip = page.getByRole('button', { name: 'Open task Buy filters on calendar' });
  await expect(chip).toHaveClass(/is-done/);
  await expect(page.locator('.untimed-day[data-date="2026-09-09"]')).toContainText('Buy filters');
  await page.reload();
  await expect(chip).toHaveClass(/is-done/);
  await page.clock.setFixedTime(new Date('2026-09-11T12:00:00+10:00'));
  await page.reload();
  await expect(page.locator('.untimed-day[data-date="2026-09-09"]')).toContainText('Buy filters');
  await expect(page.locator('.untimed-day[data-date="2026-09-11"]')).not.toContainText('Buy filters');
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(page.locator('.month-day[data-date="2026-09-09"] .calendar-task')).toHaveClass(/is-done/);
  await chip.click();
  await expect(page.getByText('Done Wed, 9 Sept', { exact: true })).toBeVisible();
  await editTaskDetails(page);
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Close task editor' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Buy filters' }).click();
  await expect(chip).toHaveCount(0);
});

test('day, rolling four days, week and month navigate with correct boundaries', async ({ page }) => {
  await expect(page.locator('.day-heading')).toHaveCount(7);
  await page.getByRole('button', { name: '4 days', exact: true }).click();
  await expect(page.locator('.day-heading strong')).toHaveText(['9', '10', '11', '12']);
  await page.getByRole('button', { name: 'Next 4 days', exact: true }).click();
  await expect(page.locator('.day-heading strong')).toHaveText(['13', '14', '15', '16']);
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await expect(page.locator('.day-heading strong')).toHaveText(['13']);
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(page.locator('.day-heading strong')).toHaveText(['12']);
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(page.locator('.month-day')).toHaveCount(35);
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.locator('.month-jump > span')).toHaveText('October 2026');
  await page.getByRole('button', { name: 'Open 2026-10-15', exact: true }).click();
  await expect(page.locator('.day-heading strong')).toHaveText(['15']);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.locator('.day-heading strong')).toHaveText(['9']);
  await page.getByRole('button', { name: '4 days', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '4 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('divider drag resizes panels, persists and restores after collapse', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const panel = page.getByRole('complementary', { name: 'Tasks', exact: true });
  const divider = page.getByRole('separator', { name: 'Resize calendar and tasks' });
  const initial = (await panel.boundingBox())!.width;
  const handle = (await divider.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
  await page.mouse.down();
  await page.mouse.move(handle.x - 140, handle.y + 100, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(initial + 100);
  const wide = (await panel.boundingBox())!.width;
  await page.getByRole('button', { name: 'Hide tasks' }).click();
  await expect(divider).toHaveCount(0);
  await page.getByRole('button', { name: 'Show tasks' }).click();
  await expect.poll(async () => Math.abs((await panel.boundingBox())!.width - wide)).toBeLessThan(2);
  await page.reload();
  await expect.poll(async () => Math.abs((await panel.boundingBox())!.width - wide)).toBeLessThan(2);
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeLessThan(wide - 20);
  await expect(page.getByRole('slider')).toHaveCount(0);
});

test('calendar drawer groups accounts and custom groups survive reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  await expect(page.locator('.calendar-account')).toHaveCount(3);
  await page.getByRole('textbox', { name: 'New calendar group' }).fill('Family');
  await page.getByRole('button', { name: 'Add calendar group', exact: true }).click();
  await page.getByRole('button', { name: 'Options for Together (together)' }).click();
  await choose(page, 'Group for Together (together)', 'Family');
  await page.getByRole('button', { name: 'Close calendars' }).click();
  await choose(page, 'Calendar group', 'Family');
  await expect(page.getByRole('button', { name: 'Dinner together', exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Morning walk', exact: false })).toHaveCount(0);
  await page.reload();
  await choose(page, 'Calendar group', 'Family');
  await expect(page.getByRole('button', { name: 'Dinner together', exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Connected calendars', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
