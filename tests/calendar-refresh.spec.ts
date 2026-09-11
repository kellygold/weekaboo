import { test, expect, type Route } from '@playwright/test';

const calendars = [{ id: 1, name: 'Home', account_id: 1, account_email: 'fixture@example.test', account_provider: 'google', sync_enabled: true, sync_error: null, writable: true }];
const events = [{ id: 1, title: 'Saved appointment', start_at: '2026-09-11T09:00:00+10:00', end_at: '2026-09-11T10:00:00+10:00', calendar_id: 1, all_day: false, location: null }];
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T12:00:00+10:00'));
  await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
  await page.route('**/api/calendars', route => route.fulfill({ json: calendars }));
});

test('initial and manual fetch show progress, keep saved events and settle after failure', async ({ page }) => {
  const reads: Route[] = [], syncs: Route[] = [];
  await page.route('**/api/events?*', route => { reads.push(route); });
  await page.route('**/api/sync/run', route => { syncs.push(route); });
  await page.goto('/');
  const status = page.locator('.calendar-refresh [role=status]');
  const refresh = page.getByRole('button', { name: 'Refresh calendars', exact: true });
  await expect(status).toHaveText('Refreshing calendars…');
  await expect(refresh).toBeDisabled();
  await expect(refresh.locator('svg')).toHaveCSS('animation-name', 'calendar-refresh-spin');
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Connected calendars', exact: true });
  await expect(drawer.getByRole('status')).toHaveText('Loading calendars…');
  await expect(drawer.getByText('No calendars yet. Connect an account to get started.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close calendars', exact: true }).click();
  await expect.poll(() => reads.length).toBe(1);
  await reads.shift()!.fulfill({ json: events });
  await expect(refresh).toBeEnabled();
  await expect(status).toContainText('Calendar data refreshed');
  await refresh.click();
  await expect.poll(() => syncs.length).toBe(1);
  await expect(refresh).toBeDisabled();
  await expect(status).toHaveText('Refreshing calendars…');
  await expect(page.getByRole('button', { name: 'Saved appointment', exact: false })).toBeVisible();
  await syncs.shift()!.fulfill({ json: {} });
  await expect.poll(() => reads.length).toBe(1);
  await expect(status).toHaveText('Refreshing calendars…');
  await reads.shift()!.fulfill({ status: 503 });
  await expect(refresh).toBeEnabled();
  await expect(status).toContainText('service unavailable');
  await expect(page.getByRole('button', { name: 'Saved appointment', exact: false })).toBeVisible();
  await expect(refresh.locator('svg')).toHaveCSS('animation-name', 'none');
  // Failure in the explicit refresh command must settle the same indicator too.
  await refresh.click();
  await expect.poll(() => syncs.length).toBe(1);
  await syncs.shift()!.fulfill({ status: 503 });
  await expect(refresh).toBeEnabled();
  expect(reads).toHaveLength(0);
});

test('a superseded view response cannot clear progress for the new view', async ({ page }) => {
  const reads: Route[] = [];
  await page.route('**/api/events?*', route => { reads.push(route); });
  await page.goto('/');
  await expect.poll(() => reads.length).toBe(1);
  await reads.shift()!.fulfill({ json: events });
  const status = page.locator('.calendar-refresh [role=status]');
  await expect(status).toContainText('Calendar data refreshed');
  await page.getByRole('button', { name: '4 days', exact: true }).click();
  await expect.poll(() => reads.length).toBe(1);
  await expect(status).toHaveText('Refreshing calendars…');
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await expect.poll(() => reads.length).toBe(2);
  await reads[0].fulfill({ json: [{ ...events[0], title: 'Obsolete response' }] });
  await expect(status).toHaveText('Refreshing calendars…');
  await reads[1].fulfill({ json: events });
  await expect(status).toContainText('Calendar data refreshed');
  await expect(page.getByRole('button', { name: /Obsolete response/ })).toHaveCount(0);
});

test('reduced motion retains readable refresh status without spinning', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let held: Route | undefined;
  await page.route('**/api/events?*', route => { held = route; });
  await page.goto('/');
  await expect(page.locator('.calendar-refresh [role=status]')).toHaveText('Refreshing calendars…');
  await expect(page.locator('.refresh-calendars svg')).toHaveCSS('animation-name', 'none');
  await expect.poll(() => Boolean(held)).toBe(true);
  await held!.fulfill({ json: [] });
  await expect(page.getByRole('button', { name: 'Refresh calendars', exact: true })).toBeEnabled();
});
