import { test, expect } from '@playwright/test';
import { fakeService } from './service-fixture';

async function accounts(page: import('@playwright/test').Page, configured = true) {
  const service = await fakeService(page);
  await page.route('**/api/setup', r => r.fulfill({ json: { google_configured: true, microsoft_configured: configured } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  await page.getByRole('button', { name: 'Manage accounts', exact: false }).click();
  return service;
}

test('Microsoft connects with personal or optional work-sharing scope and recoverable failures', async ({ page }) => {
  const payloads: unknown[] = [];
  await accounts(page);
  await page.route('**/api/accounts/microsoft/auth-url', r => { payloads.push(r.request().postDataJSON()); return r.fulfill({ status: 503, json: { error: { message: 'Please try again' } } }); });
  await page.getByRole('button', { name: 'Connect Microsoft', exact: true }).click();
  const shared = page.getByRole('checkbox', { name: 'Include shared work calendars' });
  await expect(shared).not.toBeChecked();
  await page.getByRole('button', { name: 'Continue to Microsoft' }).click();
  await expect(page.getByRole('alert')).toContainText('Please try again');
  expect(payloads).toEqual([{ shared_work_calendars: false }]);
  await shared.check();
  await page.getByRole('button', { name: 'Continue to Microsoft' }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toEqual({ shared_work_calendars: true });
  await page.getByRole('button', { name: 'Connect iCloud', exact: true }).click();
  await expect(page.getByLabel('App-specific password')).toBeVisible();
  await expect(shared).toHaveCount(0);
  await page.getByRole('button', { name: 'Connect Microsoft', exact: true }).click();
  await expect(page.getByLabel('App-specific password')).toHaveCount(0);
  await expect(shared).toBeVisible();
});

test('Microsoft setup explains missing configuration without blocking other providers', async ({ page }) => {
  await accounts(page, false);
  await expect(page.getByRole('button', { name: 'Connect Microsoft', exact: true })).toBeDisabled();
  await expect(page.getByText('Microsoft isn’t configured on this installation yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Google', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Connect iCloud', exact: true })).toBeEnabled();
});

test('Microsoft account grouping and disconnect preserve remote calendars', async ({ page }) => {
  const api = await fakeService(page);
  api.calendars.push({ id: 20, account_id: 4, name: 'Outlook', account_email: 'outlook@example.test', account_provider: 'microsoft', sync_enabled: true, writable: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  const group=page.locator('.calendar-account').filter({ hasText: 'outlook@example.test' });
  await expect(group).toContainText('Microsoft');
  await page.getByRole('button', { name: 'Manage accounts', exact: false }).click();
  const account=page.locator('.connected-account').filter({ hasText: 'outlook@example.test' });
  await account.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(account).toContainText('Events stay in the original calendar service.');
  await account.getByRole('button', { name: 'Disconnect account', exact: true }).click();
  await expect(account).toHaveCount(0);
  expect(api.writes.some(w => w.path === 'accounts/4' && w.method === 'DELETE')).toBe(true);
});
