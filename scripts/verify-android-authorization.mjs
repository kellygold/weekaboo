// Disposable emulator only. No password input, real consent, token output or account writes.
import { _android, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const d = (await _android.devices()).find(d => d.serial() === 'emulator-5554');
if (!d) throw new Error('Start the disposable Weekaboo emulator first.');
try {
  const page = await (await d.webView({ pkg: 'app.weekaboo.calendar' })).page();
  const setup = await page.evaluate(() => window.Capacitor.Plugins.WeekabooAuthorization.setup());
  expect(setup.packageName).toBe('app.weekaboo.calendar');
  expect(setup.sha1).toMatch(/^([0-9A-F]{2}:){19}[0-9A-F]{2}$/);
  expect(setup.microsoftRedirectUri).toBe(`msauth://${setup.packageName}/${encodeURIComponent(setup.signatureHash)}`);
  const cases = await page.evaluate(async () => {
    const auth = window.Capacitor.Plugins.WeekabooAuthorization;
    const failure = input => auth.acquire(input).then(() => 'UNEXPECTED_SUCCESS', e => e.code);
    return {
      invalidProvider: await failure({ provider: 'other', interactive: true }),
      noSilentIdentity: await failure({ provider: 'google', interactive: false }),
      absentMicrosoftAccount: await failure({ provider: 'microsoft', interactive: false, accountRef: 'weekaboo-absent-test-account' }),
    };
  });
  expect(cases.invalidProvider).toBe('configuration');
  expect(cases.noSilentIdentity).toBe('configuration');
  expect(cases.absentMicrosoftAccount).toBe('interaction-required');
  // Launch native Google UI, then cancel it. The emulator has no Google account.
  await page.evaluate(() => {
    window.authProof = null;
    window.Capacitor.Plugins.WeekabooAuthorization.acquire({ provider: 'google', interactive: true })
      .then(() => { window.authProof = 'UNEXPECTED_SUCCESS'; }, e => { window.authProof = e.code; });
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  const concurrent = await page.evaluate(() => window.Capacitor.Plugins.WeekabooAuthorization.acquire({ provider: 'microsoft', interactive: true }).then(() => 'UNEXPECTED_SUCCESS', e => e.code));
  expect(concurrent).toBe('busy');
  await d.shell('input keyevent 4');
  await expect.poll(() => page.evaluate(() => window.authProof), { timeout: 15000 }).toBe('cancelled');
  const reusable = await page.evaluate(() => window.Capacitor.Plugins.WeekabooAuthorization.acquire({ provider: 'microsoft', interactive: false, accountRef: 'weekaboo-absent-test-account' }).then(() => false, e => e.code === 'interaction-required'));
  expect(reusable).toBe(true);
  writeFileSync('output/standalone-auth/emulator-auth.json', JSON.stringify({ setup, cases, concurrent, googleCancelled: true, lockReusable: reusable, liveConsentProven: false }, null, 2));
  console.log('Native setup, rejected invalid/silent requests, Google cancellation and reusable operation lock verified. Live consent remains untested.');
} finally { await d.close(); }
