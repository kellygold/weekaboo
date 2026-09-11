import { choose, editTaskDetails } from './helpers';
import { test, expect, type Page } from '@playwright/test';

async function addTask(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'New task' }).fill(title);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('button', { name: `Edit ${title}`, exact: true })).toBeVisible();
}

test('undated capture, focus, deadline, completion and restore survive reload', async ({ page }) => {
  await page.goto('/?demo=1');
  await addTask(page, 'Buy Brita filters');
  await page.getByRole('button', { name: 'Edit Buy Brita filters' }).click();
  await editTaskDetails(page);
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('');
  await page.getByLabel('Pick for today').check();
  await page.getByRole('button', { name: 'Save task' }).click();
  await page.getByRole('button', { name: 'For today', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Buy Brita filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Buy Brita filters' }).click();
  await editTaskDetails(page);
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('');
  await page.getByLabel('Due date', { exact: true }).fill('2026-12-15');
  await page.getByLabel('Task', { exact: true }).fill('Buy replacement filters');
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByRole('complementary', { name: 'Task editor' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit Buy replacement filters' })).toContainText('Due 15 Dec');
  await page.getByRole('button', { name: 'Complete Buy replacement filters' }).click();
  await expect(page.getByRole('button', { name: 'Edit Buy replacement filters' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Buy replacement filters' }).click();
  await page.getByRole('button', { name: 'Backlog', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Complete Buy replacement filters' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Complete Buy replacement filters' })).toBeVisible();
});

test('pointer drag ranks tasks and keeps that order after reload', async ({ page }) => {
  await page.goto('/?demo=1');
  for (const title of ['Buy filters', 'Book a haircut', 'Choose dinner']) await addTask(page, title);
  const handle = await page.getByRole('button', { name: 'Reorder Choose dinner' }).boundingBox();
  const target = await page.getByRole('button', { name: 'Reorder Buy filters' }).boundingBox();
  await page.mouse.move(handle!.x + 20, handle!.y + 20);
  await page.mouse.down();
  await page.mouse.move(target!.x + 20, target!.y + 20, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.task-content > span')).toHaveText(['Choose dinner', 'Buy filters', 'Book a haircut']);
  await page.reload();
  await expect(page.locator('.task-content > span')).toHaveText(['Choose dinner', 'Buy filters', 'Book a haircut']);
});

test('personal default, work opt-in, calendar toggles and week navigation', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page).toHaveTitle('Weekaboo — Your week, with a wink');
  await page.getByRole('combobox', { name: 'Calendar group', exact: true }).click();
  await expect(page.getByRole('option')).toHaveText(['All calendars', 'Personal', 'Work']);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Weekly planning' })).toHaveCount(0);
  await choose(page, 'Calendar group', 'Work');
  await expect(page.getByRole('button', { name: 'Weekly planning' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dinner together' })).toHaveCount(0);
  await choose(page, 'Calendar group', 'All calendars');
  await expect(page.getByRole('button', { name: 'Dinner together' })).toBeVisible();
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Work Work', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Close calendars' }).click();
  await expect(page.getByRole('button', { name: 'Weekly planning' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.locator('.event')).toHaveCount(0);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dinner together' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Calendar group', exact: true })).toHaveText('Personal');
});

test('today capture shares a single undated task with the calendar', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'For today', exact: true }).click();
  await addTask(page, 'Get a plant pot');
  const chip = page.getByRole('button', { name: 'Open task Get a plant pot on calendar' });
  await expect(chip).toBeVisible();
  await page.getByRole('button', { name: 'Hide tasks' }).click();
  await chip.click();
  await editTaskDetails(page);
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Pick for today')).toBeChecked();
  await page.getByLabel('Task', { exact: true }).fill('Get a blue plant pot');
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByRole('complementary', { name: 'Task editor' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show tasks' }).click();
  await expect(page.getByRole('button', { name: 'Edit Get a blue plant pot' })).toBeVisible();
  await page.reload();
  const renamedChip = page.getByRole('button', { name: 'Open task Get a blue plant pot on calendar' });
  await expect(renamedChip).toBeVisible();
  await expect(page.locator('.task-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Complete Get a blue plant pot' }).click();
  await expect(renamedChip).toHaveClass(/is-done/);
  await expect(renamedChip).toContainText('Done');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Get a blue plant pot' }).click();
  await expect(renamedChip).toBeVisible();
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(renamedChip).toHaveCount(0);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await renamedChip.click();
  await editTaskDetails(page);
  await page.getByLabel('Pick for today').uncheck();
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(renamedChip).toHaveCount(0);
  await page.getByRole('button', { name: 'Backlog', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Get a blue plant pot' })).toBeVisible();
});

test('hide/show expands calendar, retains draft and view, and works on phones with reduced motion', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'For today', exact: true }).click();
  await page.getByRole('textbox', { name: 'New task' }).fill('An unfinished thought');
  const calendar = page.getByRole('region', { name: 'Week calendar', exact: true });
  const initialWidth = (await calendar.boundingBox())!.width;
  await page.getByRole('button', { name: 'Hide tasks' }).click();
  await expect(page.getByRole('complementary', { name: 'Tasks', exact: true })).toHaveCount(0);
  await expect(page.locator('#task-panel')).toHaveAttribute('inert', '');
  await expect.poll(async () => (await calendar.boundingBox())!.width).toBeGreaterThan(initialWidth + 300);
  await page.getByRole('button', { name: 'Show tasks' }).click();
  await expect(page.getByRole('textbox', { name: 'New task' })).toHaveValue('An unfinished thought');
  await expect(page.getByRole('button', { name: 'For today', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Hide tasks' }).click();
  await expect(page.locator('#task-panel')).toBeHidden();
  expect(await page.locator('.dashboard').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Show tasks' }).click();
  await expect(page.getByRole('textbox', { name: 'New task' })).toHaveValue('An unfinished thought');
});

test('touch handle reorders tasks without changing their dates', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5188/?demo=1');
  await addTask(page, 'First thing');
  await addTask(page, 'Important thing');
  const handle = await page.getByRole('button', { name: 'Reorder Important thing' }).boundingBox();
  const target = await page.getByRole('button', { name: 'Reorder First thing' }).boundingBox();
  const session = await context.newCDPSession(page);
  const x = handle!.x + 20;
  const startY = handle!.y + 20;
  const endY = target!.y + 20;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let step = 1; step <= 10; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * step / 10 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.task-content > span')).toHaveText(['Important thing', 'First thing']);
  await page.getByRole('button', { name: 'Edit Important thing' }).tap();
  await editTaskDetails(page);
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('');
  await context.close();
});

test('tablet overview and narrow layout render without page horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?demo=1');
  for (const title of ['Buy Brita filters', 'Schedule a barber appointment', 'Plan a weekend away', 'Find a home for the tablets']) await addTask(page, title);
  await page.getByRole('button', { name: 'Edit Buy Brita filters' }).click();
  await editTaskDetails(page);
  await page.getByLabel('Pick for today').check();
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByRole('complementary', { name: 'Task editor' })).toHaveCount(0);
  await page.screenshot({ path: 'docs/prototype-landscape.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: 'test-results/tablet-small.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/phone.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
