// Emulator-only synthetic iCloud flow. Provider XML is intercepted; SQLite/vault/UI are real.
import { _android, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const device = (await _android.devices()).find(d => d.serial() === 'emulator-5554');
if (!device) throw new Error('Start the disposable Weekaboo emulator first.');
let page, snapshots, cleanup = false;
try {
  page = await (await device.webView({ pkg: 'app.weekaboo.calendar' })).page();
  page.setDefaultTimeout(12000);
  snapshots = await page.evaluate(async () => {
    const store = window.Capacitor.Plugins.WeekabooStorage;
    const state = await store.readDocument({ key: 'calendar-state' });
    if (state.value && JSON.parse(state.value).accounts.length) throw new Error('Use an emulator without real connected accounts.');
    return { state, cache: await store.readDocument({ key: 'event-cache' }) };
  });
  await page.evaluate(() => {
    const original = window.Capacitor.nativePromise.bind(window.Capacitor);
    window.restoreNativeProof = () => { window.Capacitor.nativePromise = original; };
    window.icloudProofRequests = 0;
    const connectionGate = new Promise(resolve => { window.finishIcloudConnectionProof = resolve; });
    const wrap = (href, props) => `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>${href}</d:href><d:propstat><d:prop>${props}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`;
    window.Capacitor.nativePromise = (plugin, method, options) => {
      if (plugin !== 'WeekabooHttp') return original(plugin, method, options);
      if (!options.url.includes('caldav.icloud.com')) throw new Error('Unexpected provider request in isolated proof');
      window.icloudProofRequests++;
      let body;
      if (options.body.includes('current-user-principal')) body = wrap('/', '<d:current-user-principal><d:href>/weekaboo-proof/principal/</d:href></d:current-user-principal>');
      else if (options.body.includes('calendar-home-set')) body = wrap('/weekaboo-proof/principal/', '<c:calendar-home-set><d:href>/weekaboo-proof/calendars/</d:href></c:calendar-home-set>');
      else if (options.method === 'PROPFIND') body = wrap('/weekaboo-proof/calendars/home/', '<d:displayname>Native iCloud proof</d:displayname><d:resourcetype><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>');
      else {
        const local = new Date();
        const day = `${local.getFullYear()}${String(local.getMonth()+1).padStart(2,'0')}${String(local.getDate()).padStart(2,'0')}`;
        const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Weekaboo Proof//EN\r\nBEGIN:VEVENT\r\nUID:native-proof\r\nDTSTART:${day}T090000Z\r\nDTEND:${day}T100000Z\r\nSUMMARY:Native iCloud read proof\r\nEND:VEVENT\r\nEND:VCALENDAR`;
        body = wrap('/weekaboo-proof/calendars/home/proof.ics', `<d:getetag>"proof-v1"</d:getetag><c:calendar-data><![CDATA[${ics}]]></c:calendar-data>`);
      }
      return connectionGate.then(() => ({ status: 207, headers: {}, body }));
    };
  });
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  await page.getByRole('button', { name: 'Manage accounts' }).click();
  await page.getByRole('button', { name: 'Connect iCloud', exact: true }).click();
  await page.getByLabel('Apple ID', { exact: true }).fill('proof@example.test');
  await page.getByLabel('App-specific password', { exact: true }).fill('synthetic-weekaboo-password');
  await page.getByRole('button', { name: 'Connect iCloud account', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'iCloud is connecting' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close accounts' })).toBeDisabled();
  await page.screenshot({ path: 'output/production-validation/account-feedback/android-connecting.png' });
  await page.evaluate(() => window.finishIcloudConnectionProof());
  await expect(page.getByRole('status').filter({ hasText: 'iCloud connected' })).toBeVisible();
  await page.screenshot({ path: 'output/production-validation/account-feedback/android-connected.png' });
  await page.getByRole('button', { name: 'Choose calendars →' }).click();
  await expect(page.getByRole('checkbox', { name: 'Native iCloud proof Personal', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  // Closing calendar settings triggers a refresh; switching view guarantees a fresh query.
  await page.getByRole('button', { name: '4 days', exact: true }).click();
  await expect(page.getByText('Native iCloud read proof', { exact: true })).toBeVisible();
  const state = await page.evaluate(async () => {
    const store = window.Capacitor.Plugins.WeekabooStorage;
    const state = await store.readDocument({ key: 'calendar-state' });
    const account = JSON.parse(state.value).accounts[0];
    const vault = await store.vaultGet({ reference: account.authorizationRef });
    return { provider: account.provider, tokenAbsentFromMetadata: !state.value.includes('synthetic-weekaboo-password'), passwordInVault: JSON.parse(vault.value).password === 'synthetic-weekaboo-password', requests: window.icloudProofRequests };
  });
  expect(state).toMatchObject({ provider: 'icloud', tokenAbsentFromMetadata: true, passwordInVault: true });
  await page.screenshot({ path: 'output/standalone-auth/native-icloud-fixture.png' });
  writeFileSync('output/standalone-auth/native-icloud-fixture.json', JSON.stringify({ ...state, realProviderTransport: false, liveConsent: false }, null, 2));
  console.log('iCloud account UI, shared discovery/ICS mapping, Android vault and SQLite cache verified with synthetic transport.');
} finally {
  if (page && snapshots) {
    await page.evaluate(async snapshots => {
      const store = window.Capacitor.Plugins.WeekabooStorage;
      const state = await store.readDocument({ key: 'calendar-state' });
      for (const account of JSON.parse(state.value || '{"accounts":[]}').accounts) {
        if (account.email === 'proof@example.test') await store.vaultRemove({ reference: account.authorizationRef });
      }
      const cache = await store.readDocument({ key: 'event-cache' });
      await store.writeDocument({ key: 'calendar-state', revision: state.revision, value: snapshots.state.value || '{"version":1,"accounts":[],"calendars":[]}' });
      await store.writeDocument({ key: 'event-cache', revision: cache.revision, value: snapshots.cache.value || '{"version":1,"entries":[]}' });
      window.restoreNativeProof?.();
    }, snapshots);
    cleanup = true;
    await page.reload();
  }
  writeFileSync('output/standalone-auth/native-icloud-cleanup.json', JSON.stringify({ cleanup }));
  await device.close();
}
