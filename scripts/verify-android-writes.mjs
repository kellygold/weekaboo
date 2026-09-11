// Disposable emulator proof: real React/services/SQLite, synthetic SDK + provider.
// No network writes, calendar credentials or personal accounts are used.
import { _android, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const device = (await _android.devices()).find(d => d.serial() === 'emulator-5554');
if (!device) throw new Error('Start the disposable emulator first.');
let page, snapshots;
const results = [];
try {
  page = await (await device.webView({ pkg: 'app.weekaboo.calendar' })).page();
  page.setDefaultTimeout(12000);
  snapshots = await page.evaluate(async () => {
    const store = window.Capacitor.Plugins.WeekabooStorage;
    const result = {};
    for (const key of ['calendar-state', 'event-cache', 'event-operations']) result[key] = await store.readDocument({ key });
    if (JSON.parse(result['calendar-state'].value || '{"accounts":[]}').accounts.length) throw new Error('Refusing a device with connected accounts.');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('/weekaboo-write-proof/principal/')))].map(n => n.toString(16).padStart(2, '0')).join('');
    result.vault = { reference: `icloud.${hash}`, ...(await store.vaultGet({ reference: `icloud.${hash}` })) };
    return result;
  });
  await page.evaluate(() => {
    const original = window.Capacitor.nativePromise.bind(window.Capacitor);
    window.restoreWriteProof = () => { window.Capacitor.nativePromise = original; };
    window.proofRemote = { google: {}, microsoft: {}, icloud: {} }; window.proofWrites = [];
    const today = new Date(), date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const block = '<div class="me-email-text"><a href="https://teams.live.com/meet/123?p=synthetic">Join</a></div>';
    window.proofTeamsBlock = block;
    const response = (body, status = 200) => Promise.resolve({ status, headers: {}, body: JSON.stringify(body) });
    window.Capacitor.nativePromise = (plugin, method, options) => {
      if (plugin === 'WeekabooAuthorization') {
        if (method === 'setup') return original(plugin, method, options).then(result => ({ ...result, googleAvailable: true, microsoftConfigured: true }));
        if (method === 'acquire') return Promise.resolve({ accessToken: 'synthetic-' + options.provider, scopes: ['calendar'], accountRef: options.provider + '-proof' });
        if (method === 'forget') return Promise.resolve({});
      }
      if (plugin !== 'WeekabooHttp') return original(plugin, method, options);
      if (new URL(options.url).hostname.endsWith('caldav.icloud.com')) {
        const root = '/weekaboo-write-proof/', remote = window.proofRemote.icloud;
        const path = new URL(options.url).pathname;
        const row = (href, props) => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${props}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
        const xml = rows => Promise.resolve({ status: 207, headers: {}, body: `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${rows}</d:multistatus>` });
        if (options.method === 'PROPFIND') {
          if (options.body.includes('current-user-principal')) return xml(row('/', `<d:current-user-principal><d:href>${root}principal/</d:href></d:current-user-principal>`));
          if (options.body.includes('calendar-home-set')) return xml(row(root + 'principal/', `<c:calendar-home-set><d:href>${root}calendars/</d:href></c:calendar-home-set>`));
          return xml(row(root + 'calendars/home/', '<d:displayname>iCloud proof</d:displayname><d:resourcetype><c:calendar/></d:resourcetype><d:current-user-privilege-set><d:privilege><d:write/></d:privilege></d:current-user-privilege-set>'));
        }
        if (options.method === 'REPORT') return xml(Object.entries(remote).map(([href, value]) => row(href, `<d:getetag>${value.etag}</d:getetag><c:calendar-data><![CDATA[${value.ics}]]></c:calendar-data>`)).join(''));
        if (options.method === 'GET') return Promise.resolve(remote[path] ? { status: 200, headers: { etag: remote[path].etag }, body: remote[path].ics } : { status: 404, headers: {}, body: '' });
        window.proofWrites.push({ provider: 'icloud', method: options.method, precondition: options.headers['If-Match'] || options.headers['If-None-Match'] });
        if (options.headers['If-None-Match'] === '*' ? Boolean(remote[path]) : !remote[path] || options.headers['If-Match'] !== remote[path].etag) return response({}, 412);
        if (options.method === 'PUT') { remote[path] = { ics: options.body, etag: remote[path] ? 'v2' : 'v1' }; return Promise.resolve({ status: 204, headers: { etag: remote[path].etag }, body: '' }); }
        if (options.method === 'DELETE') { delete remote[path]; return response({}, 204); }
        throw new Error('Unexpected iCloud fixture operation');
      }
      const url = new URL(options.url), google = url.hostname === 'www.googleapis.com', provider = google ? 'google' : 'microsoft';
      if (!google && url.hostname !== 'graph.microsoft.com') throw new Error('Unexpected network target in proof');
      if (url.pathname.endsWith('/userinfo')) return response({ sub: 'google-proof', email: 'google@example.test', email_verified: true });
      if (url.pathname === '/v1.0/me') return response({ id: 'microsoft-proof', mail: 'microsoft@example.test' });
      if (url.pathname.endsWith('/calendarList')) return response({ items: [{ id: 'remote', summary: 'Google proof', accessRole: 'owner' }] });
      if (url.pathname === '/v1.0/me/calendars') return response({ value: [{ id: 'remote', name: 'Microsoft proof', canEdit: true }] });
      const remote = window.proofRemote[provider], id = decodeURIComponent(url.pathname.split('/').at(-1));
      if (options.method === 'GET') {
        if (['events', 'calendarView'].includes(id)) return response(google ? { items: Object.values(remote) } : { value: Object.values(remote) });
        return remote[id] ? response(remote[id]) : response({}, 404);
      }
      const body = options.body ? JSON.parse(options.body) : undefined;
      window.proofWrites.push({ provider, method: options.method, body, precondition: options.headers['If-Match'] });
      if (options.method === 'POST') {
        const created = google ? body.id : 'ms-' + body.transactionId;
        remote[created] = google ? { ...body, id: created, etag: 'v1' } : { ...body, start: { dateTime: new Date(body.start.dateTime).toISOString(), timeZone: 'UTC' }, end: { dateTime: new Date(body.end.dateTime).toISOString(), timeZone: 'UTC' }, id: created, '@odata.etag': 'v1', originalStartTimeZone: body.start.timeZone, isOnlineMeeting: true, body: { contentType: 'HTML', content: '<p>Original notes</p>' + block }, onlineMeeting: { joinUrl: 'https://teams.live.com/meet/123?p=synthetic' } };
        return response(remote[created]);
      }
      if (!remote[id]) return response({}, 404);
      if (options.headers['If-Match'] !== (google ? remote[id].etag : remote[id]['@odata.etag'])) return response({}, 412);
      if (options.method === 'PATCH') { Object.assign(remote[id], body, google ? { etag: 'v2' } : { '@odata.etag': 'v2' }); return response(remote[id]); }
      if (options.method === 'DELETE') { delete remote[id]; return response({}, 204); }
      throw new Error('Unexpected mutation');
    };
  });
  for (const provider of ['google', 'microsoft', 'icloud']) {
    console.log(provider + ': connecting');
    await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
    await page.getByRole('button', { name: 'Manage accounts' }).click();
    await page.getByRole('button', { name: provider === 'google' ? 'Connect Google' : provider === 'microsoft' ? 'Connect Microsoft' : 'Connect iCloud', exact: true }).click();
    if (provider === 'microsoft') await page.getByRole('button', { name: 'Continue to Microsoft', exact: true }).click();
    if (provider === 'icloud') {
      await page.getByLabel('Apple ID', { exact: true }).fill('icloud@example.test');
      await page.getByLabel('App-specific password', { exact: true }).fill('synthetic-weekaboo-password');
      await page.getByRole('button', { name: 'Connect iCloud account', exact: true }).click();
      await expect(page.getByRole('checkbox', { name: 'iCloud proof Personal', exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: `${provider}@example.test`, exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Choose calendars →', exact: true }).click();
    }
    await page.keyboard.press('Escape');
    console.log(provider + ': creating');
    await page.getByRole('button', { name: 'New event', exact: true }).click();
    await page.getByRole('textbox', { name: 'Event title', exact: true }).fill(`Native ${provider} write proof`);
    await page.getByRole('combobox', { name: 'Event calendar', exact: true }).click();
    await page.getByRole('option', { name: new RegExp(provider === 'google' ? 'Google proof' : provider === 'microsoft' ? 'Microsoft proof' : 'iCloud proof') }).click();
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Event title', exact: true })).toHaveCount(0);
    if (await page.getByRole('button', { name: 'Schedule', exact: true }).getAttribute('aria-pressed') !== 'true') await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`Native ${provider} write proof`) }).first().click();
    await page.getByRole('button', { name: 'Edit event', exact: true }).click();
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Edited entirely in the native app');
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Event title', exact: true })).toHaveCount(0);
    console.log(provider + ': edit saved');
    const edited = await page.evaluate(provider => {
      const event = Object.values(window.proofRemote[provider])[0];
      return { containsNotes: (event.description || event.body?.content || event.ics).includes('Edited entirely'), protectedMeeting: provider !== 'microsoft' || event.body.content.includes(window.proofTeamsBlock) };
    }, provider);
    expect(edited).toEqual({ containsNotes: true, protectedMeeting: true });
    writeFileSync(`output/standalone-auth/native-${provider}-writes.png`, await device.screenshot());
    await page.getByRole('button', { name: new RegExp(`Native ${provider} write proof`) }).first().click();
    await page.getByRole('button', { name: 'Delete event', exact: true }).click();
    await page.getByRole('button', { name: 'Delete event', exact: true }).click();
    await expect.poll(() => page.evaluate(provider => Object.keys(window.proofRemote[provider]).length, provider)).toBe(0);
    results.push({ provider, create: true, edit: true, delete: true, ...edited });
  }
  // Imported iCloud series: edit/remove one slot without changing its siblings.
  await page.evaluate(() => {
    const now = new Date(), day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    window.proofRemote.icloud['/weekaboo-write-proof/calendars/home/series.ics'] = { etag: 'v1', ics: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:native-series\r\nDTSTART:${day}T010000Z\r\nDTEND:${day}T020000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nSUMMARY:Native recurring proof\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n` };
  });
  await page.getByRole('button', { name: 'Refresh calendars', exact: true }).click();
  await expect(page.getByRole('button', { name: /Native recurring proof/ })).toHaveCount(3);
  await page.getByRole('button', { name: /Native recurring proof/ }).first().click();
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await expect(page.getByText('Changes apply to this occurrence only.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Event title', exact: true }).fill('Edited native occurrence');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('button', { name: /Native recurring proof/ })).toHaveCount(2);
  await page.getByRole('button', { name: /Edited native occurrence/ }).first().click();
  await page.getByRole('button', { name: 'Delete event', exact: true }).click();
  await page.getByRole('button', { name: 'Delete event', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edited native occurrence/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Native recurring proof/ })).toHaveCount(2);
  const series = await page.evaluate(() => window.proofRemote.icloud['/weekaboo-write-proof/calendars/home/series.ics'].ics);
  expect(series).toContain('RRULE:FREQ=DAILY;COUNT=3'); expect(series).toContain('STATUS:CANCELLED');
  results.push({ provider: 'icloud-occurrence', edit: true, delete: true, otherOccurrencesPreserved: true });
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  await page.getByRole('textbox', { name: 'Event title', exact: true }).fill('Created native repeat');
  await page.getByRole('combobox', { name: 'Event calendar', exact: true }).click();
  await page.getByRole('option', { name: /iCloud proof/ }).click();
  await page.getByRole('combobox', { name: 'Event repeats', exact: true }).click();
  await page.getByRole('option', { name: 'Every day', exact: true }).click();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Event title', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Created native repeat/ }).first()).toBeVisible();
  const createdSeries = await page.evaluate(() => Object.values(window.proofRemote.icloud).find(row => row.ics.includes('SUMMARY:Created native repeat')).ics);
  expect(createdSeries).toContain('RRULE:FREQ=DAILY');
  expect(createdSeries).toContain('BEGIN:VTIMEZONE');
  expect(createdSeries).toContain('DTSTART;TZID=Australia/Sydney:');
  results.push({ provider: 'icloud-repeat-create', create: true, namedTimezone: true, rendered: true });
  const journal = await page.evaluate(async () => JSON.parse((await window.Capacitor.Plugins.WeekabooStorage.readDocument({ key: 'event-operations' })).value));
  expect(journal.operations).toHaveLength(12); expect(journal.operations.every(op => op.state === 'confirmed')).toBe(true);
  writeFileSync('output/standalone-auth/native-writes.json', JSON.stringify({ results, durableConfirmedOperations: journal.operations.length, liveConsent: false, realProviderTransport: false }, null, 2));
  console.log('Native Google/Microsoft/iCloud single-event create/edit/delete and persisted confirmations passed with synthetic SDK/HTTP.');
} catch (error) {
  console.error('Proof failed:', error);
  await device.screenshot().then(bytes => writeFileSync('output/standalone-auth/native-writes-failure.png', bytes)).catch(() => {});
  throw error;
} finally {
  if (page?.isClosed()) page = await (await device.webView({ pkg: 'app.weekaboo.calendar' })).page();
  if (page && snapshots) {
    await page.evaluate(async snapshots => {
      const defaults = { 'calendar-state': { version: 1, accounts: [], calendars: [] }, 'event-cache': { version: 1, entries: [] }, 'event-operations': { version: 1, operations: [] } };
      const store = window.Capacitor.Plugins.WeekabooStorage;
      const vault = snapshots.vault;
      if (vault.value === null) await store.vaultRemove({ reference: vault.reference });
      else await store.vaultPut({ reference: vault.reference, value: vault.value });
      for (const [key, snapshot] of Object.entries(snapshots).filter(([key]) => key !== 'vault')) {
        const current = await store.readDocument({ key });
        const result = await store.writeDocument({ key, revision: current.revision, value: snapshot.value || JSON.stringify(defaults[key]) });
        if (!result.committed) throw new Error('Proof cleanup conflict');
      }
      window.restoreWriteProof?.();
    }, snapshots);
    await page.reload();
    writeFileSync('output/standalone-auth/native-writes-cleanup.json', JSON.stringify({ restored: true }));
  }
  await device.close();
}
