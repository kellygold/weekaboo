// Physical Android/iOS, real SDK and provider traffic. Only newly-created, uniquely
// named events without guests are mutated. Tokens remain inside the WebView.
import { _android, chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
const platform = process.env.WEEKABOO_TEST_PLATFORM || 'android';
if (!['android','ios'].includes(platform)) throw new Error('Unsupported live test platform');
const out = platform === 'ios' ? 'output/production-validation/ipad-physical/live' : 'output/production-validation';
mkdirSync(out, { recursive: true });
let devices = [], device, browser;
const receipt = { platform, started: new Date().toISOString(), results: [], cleanup: false };
if (platform === 'android') {
  const serial = process.env.WEEKABOO_TEST_SERIAL;
  if (!serial || serial.startsWith('emulator-')) throw new Error('Specify the authorized physical tablet serial.');
  devices = await _android.devices(); device = devices.find(d => d.serial() === serial);
  if (!device) throw new Error('Authorized tablet unavailable.');
  const adb = (...args) => execFileSync(join(homedir(), 'Library/Android/sdk/platform-tools/adb'), ['-s', serial, ...args], {encoding:'utf8'}).trim();
  const installed = adb('shell','pm','path','app.weekaboo.calendar').split('\n')[0].replace(/^package:/,'');
  receipt.apkSha256 = adb('shell','sha256sum',installed).split(/\s/)[0];
}
let page;
try {
  if (platform === 'ios') {
    const endpoint = new URL(process.env.WEEKABOO_IOS_CDP || 'http://127.0.0.1:9223');
    if (endpoint.hostname !== '127.0.0.1') throw new Error('iPad inspector must be loopback-only');
    browser = await chromium.connectOverCDP(endpoint.href, {timeout:15000});
    const targets = browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url()==='capacitor://localhost');
    if (targets.length !== 1) throw new Error('Expected exactly one Weekaboo WebView');
    page = targets[0];
    await expect.poll(async()=>({title:(await page.title()).startsWith('Weekaboo'),platform:await page.evaluate(()=>window.Capacitor?.getPlatform())}),{timeout:15000}).toEqual({title:true,platform:'ios'});
    device = { screenshot: ()=>page.screenshot() };
  } else page = await (await device.webView({ pkg: 'app.weekaboo.calendar' })).page();
  page.setDefaultTimeout(60000);
  if (await page.locator('dialog[open], .event-composer').count()) throw new Error('Finish the current user interaction before running live validation.');
  const refreshButton = page.getByRole('button', {name:'Refresh calendars',exact:true});
  await expect(refreshButton).toBeEnabled({timeout:120000});
  await refreshButton.click();
  await expect(refreshButton).toBeDisabled();
  await expect(page.locator('.calendar-refresh [role=status]')).toHaveText('Refreshing calendars…');
  writeFileSync(`${out}/physical-refresh.png`,await device.screenshot());
  await expect(refreshButton).toBeEnabled({timeout:120000});
  receipt.refreshIndicator = true;
  const selectedProviders = process.env.WEEKABOO_TEST_PROVIDER ? [process.env.WEEKABOO_TEST_PROVIDER] : ['microsoft', 'google', 'icloud'];
  if (selectedProviders.some(p => !['microsoft','google','icloud'].includes(p))) throw new Error('Unknown test provider');
  for (const provider of selectedProviders) {
    console.log(`Starting ${platform} ${provider} live proof`);
    const title = `Weekaboo validation ${provider} ${Date.now()}`;
    const calendar = await page.evaluate(async provider => {
      const state = JSON.parse((await window.Capacitor.Plugins.WeekabooStorage.readDocument({ key: 'calendar-state' })).value);
      const account = state.accounts.find(a => a.provider === provider && a.status === 'active');
      const choices = state.calendars.filter(c => c.calendar.accountId === account?.id && c.calendar.writable && c.calendar.enabled !== false);
      const label = c => c.calendar.name + (c.calendar.accountEmail ? ' · ' + c.calendar.accountEmail : '');
      const unique = choices.filter(c => state.calendars.filter(other => other.calendar.writable && other.calendar.enabled !== false && label(other) === label(c)).length === 1);
      const selected = unique.find(c => c.remoteId === account.email) || unique[0];
      if (!selected) throw new Error('No connected writable test calendar');
      return { label: selected.calendar.name + (selected.calendar.accountEmail ? ' · ' + selected.calendar.accountEmail : ''), provider, collection: selected.remoteId };
    }, provider);
    await page.evaluate(({ provider, title, collection }) => {
      const original = window.Capacitor.nativePromise.bind(window.Capacitor);
      const host = provider === 'google' ? 'www.googleapis.com' : 'graph.microsoft.com';
      let created, credential;
      const parseIcs = text => {
        const unfolded = text.replace(/\r?\n[ \t]/g, '');
        const value = name => new RegExp('^' + name + '(?:;[^:\r\n]*)?:(.*)$', 'mi').exec(unfolded)?.[1]?.replace(/\r$/, '').replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1');
        return { summary: value('SUMMARY'), description: value('DESCRIPTION'), uid: value('UID'), attendees: [...unfolded.matchAll(/^ATTENDEE[;:]/gmi)], recurring: /^(?:RRULE|RDATE|RECURRENCE-ID)[;:]/mi.test(unfolded), eventCount: [...unfolded.matchAll(/^BEGIN:VEVENT\r?$/gmi)].length };
      };
      const decode = response => provider === 'icloud' ? parseIcs(response.body) : JSON.parse(response.body);
      const readHeaders = () => ({ Authorization: credential, ...(provider === 'microsoft' ? {Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"'} : {}) });
      const observations = [];
      let sent = false;
      const observe = (response, method, url) => {
        try { const body = JSON.parse(response.body); for (const row of (body.value || body.items || [body])) {
          if ((row.summary || row.subject) === title) observations.push({ method, shape: new URL(url).search ? 'query' : 'item', revision: row.etag || row['@odata.etag'], changeKey: row.changeKey, status: response.status });
        }} catch {}
      };
      window.liveProof = { observations, restored: false };
      window.Capacitor.nativePromise = async (plugin, method, options) => {
        if (plugin !== 'WeekabooHttp' || method !== 'request') return original(plugin, method, options);
        if (['GET', 'REPORT', 'PROPFIND'].includes(options.method)) { const response = await original(plugin, method, options); observations.push({method:options.method,status:response.status}); observe(response, options.method, options.url); return response; }
        const url = new URL(options.url), body = options.body ? (provider === 'icloud' ? parseIcs(options.body) : JSON.parse(options.body)) : {};
        if (!(provider === 'icloud' ? /^p\d+-caldav\.icloud\.com$/.test(url.hostname) && url.protocol === 'https:' : url.hostname === host) || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(options.method)) throw new Error('Test guard blocked an unexpected mutation');
        const creating = options.method === 'POST' || provider === 'icloud' && options.method === 'PUT' && options.headers['If-None-Match'] === '*';
        if (creating) {
          if (created || (body.summary || body.subject) !== title || body.attendees?.length || (Array.isArray(body.recurrence) ? body.recurrence.length : body.recurrence) || body.recurrenceRule) throw new Error('Test guard blocked an unrelated event create');
          if (provider === 'icloud') {
            const base = new URL(collection), leaf = url.pathname.slice(base.pathname.length);
            if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || !/^[a-f0-9]{32}\.ics$/.test(leaf) || url.search || body.uid !== leaf.slice(0,-4) || body.eventCount !== 1 || body.recurring) throw new Error('Test guard blocked an unexpected iCloud resource');
            created = { url: options.url };
          }
        } else if (!created || options.url !== created.url) throw new Error('Test guard blocked an unrelated event mutation');
        if (provider === 'icloud' && options.method === 'PUT' && (body.summary !== title || body.attendees.length || body.recurring || body.eventCount !== 1)) throw new Error('Test guard blocked unrelated iCloud data');
        credential = options.headers.Authorization;
        if (creating) sent = true;
        const response = await original(plugin, method, options);
        if (options.method === 'POST' && response.status >= 200 && response.status < 300) {
          const row = JSON.parse(response.body); if (!row.id) throw new Error('Create returned no ID');
          created = { url: options.url + '/' + encodeURIComponent(row.id) };
        }
        observe(response, options.method, options.url);
        observations.push({ method: options.method, status: response.status });
        return response;
      };
      window.liveProof.read = async () => {
        if (!created) throw new Error('No created test event');
        const response = await original('WeekabooHttp', 'request', { url: created.url, method: 'GET', headers: readHeaders(), timeoutMs: 30000 });
        observe(response, 'readback', created.url);
        if (response.status === 404) return { status: 404 };
        if (response.status !== 200) throw new Error('Remote readback failed: ' + response.status);
        const row = decode(response);
        if (provider === 'google' && row.status === 'cancelled') return { status: 200, deleted: true };
        if ((row.summary || row.subject) !== title) throw new Error('Remote identity does not match this test');
        return { status: response.status, titleMatches: true, notes: row.description || row.body?.content || '', attendeeCount: row.attendees?.length || 0 };
      };
      window.liveProof.cleanup = async () => {
        if (!created) return !sent;
        const headers = readHeaders();
        const response = await original('WeekabooHttp', 'request', { url: created.url, method: 'GET', headers, timeoutMs: 30000 });
        if (response.status === 404) return true;
        if (response.status !== 200) return false;
        const row = decode(response);
        if (provider === 'google' && row.status === 'cancelled') return true;
        if ((row.summary || row.subject) !== title || row.attendees?.length) return false;
        const revision = response.headers.etag || row.etag || row['@odata.etag']; if (!revision) return false;
        await original('WeekabooHttp', 'request', { url: created.url, method: 'DELETE', headers: { ...headers, 'If-Match': revision }, timeoutMs: 30000 });
        const final = await original('WeekabooHttp', 'request', { url: created.url, method: 'GET', headers, timeoutMs: 30000 });
        return final.status === 404 || provider === 'google' && final.status === 200 && JSON.parse(final.body).status === 'cancelled';
      };
      window.liveProof.restore = () => { window.Capacitor.nativePromise = original; credential = undefined; };
    }, { provider, title, collection: calendar.collection });
    let cleaned = false;
    await page.evaluate(()=>{ window.proofUiEvents=[]; window.proofUiListener=e=>window.proofUiEvents.push({type:e.type,tag:e.target.tagName,label:e.target.closest('button')?.getAttribute('aria-label'),text:e.target.closest('button')?.textContent?.slice(0,50)}); document.addEventListener('click',window.proofUiListener,true); document.addEventListener('submit',window.proofUiListener,true); });
    try {
      await page.getByRole('button', { name: 'New event', exact: true }).click();
      await page.getByRole('textbox', { name: 'Event title', exact: true }).fill(title);
      await page.getByRole('combobox', { name: 'Event calendar', exact: true }).click();
      await page.getByRole('option', { name: calendar.label, exact: true }).click();
      await page.getByRole('button', { name: 'Save event', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Event title', exact: true })).toHaveCount(0, { timeout: 60000 });
      expect(await page.evaluate(() => window.liveProof.read())).toMatchObject({ status: 200, titleMatches: true, attendeeCount: 0 });
      if (await page.getByRole('button', { name: 'Schedule', exact: true }).getAttribute('aria-pressed') !== 'true') await page.getByRole('button', { name: 'Schedule', exact: true }).click();
      await expect(refreshButton).toBeEnabled({timeout:120000});
      await page.getByRole('button', { name: new RegExp(title) }).first().click();
      await page.getByRole('button', { name: 'Edit event', exact: true }).click();
      await page.getByRole('textbox', { name: 'Notes', exact: true }).fill(`Verified edit from standalone ${platform}`);
      await page.getByRole('button', { name: 'Save event', exact: true }).click();
      await expect.poll(async () => !(await page.getByRole('textbox', { name: 'Event title', exact: true }).count()) || await page.getByRole('alert').filter({hasText:'changed elsewhere'}).count(), {timeout:60000}).toBeTruthy();
      if (await page.getByRole('alert').filter({hasText:'changed elsewhere'}).count()) {
        // The real provider revised our new event after creation. Exercise the
        // explicit user refresh path; never substitute a fresh ETag into a write.
        receipt.results.push({provider, staleEditRejected: true});
        await page.getByRole('button',{name:'Close event editor',exact:true}).click();
        await page.getByRole('button',{name:'Discard',exact:true}).click();
        const before = await page.evaluate(() => window.liveProof.observations.length);
        await page.getByRole('button',{name:'Refresh calendars',exact:true}).click();
        await expect(refreshButton).toBeEnabled({timeout:120000});
        await expect.poll(() => page.evaluate(({before,provider}) => window.liveProof.observations.slice(before).some(x=>provider === 'icloud' ? x.method === 'REPORT' && x.status === 207 : x.method==='GET' && x.shape==='query' && x.revision),{before,provider}), {timeout:60000}).toBe(true);
        await page.getByRole('button',{name:new RegExp(title)}).first().click();
        await page.getByRole('button',{name:'Edit event',exact:true}).click();
        await page.getByRole('textbox',{name:'Notes',exact:true}).fill(`Verified edit from standalone ${platform}`);
        await page.getByRole('button',{name:'Save event',exact:true}).click();
      }
      await expect(page.getByRole('textbox', { name: 'Event title', exact: true })).toHaveCount(0, { timeout: 60000 });
      expect((await page.evaluate(() => window.liveProof.read())).notes).toContain(`Verified edit from standalone ${platform}`);
      writeFileSync(`${out}/physical-${provider}-edited.png`, await device.screenshot());
      await expect(refreshButton).toBeEnabled({timeout:120000});
      await page.getByRole('button', { name: new RegExp(title) }).first().click();
      await page.getByRole('button', { name: 'Delete event', exact: true }).click();
      await page.getByRole('button', { name: 'Delete event', exact: true }).click();
      await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0, { timeout: 60000 });
      const deleted = await page.evaluate(() => window.liveProof.read());
      expect(deleted.status === 404 || deleted.deleted === true).toBe(true);
      const journal = await page.evaluate(async title => {
        const data = JSON.parse((await window.Capacitor.Plugins.WeekabooStorage.readDocument({ key: 'event-operations' })).value);
        return data.operations.filter(op => JSON.stringify(op).includes(title)).map(op => ({ state: op.state, kind: op.input.kind }));
      }, title);
      receipt.results.push({ provider, title, createReadback: true, editedNotesReadback: true, deleteReadback: deleted, requests: await page.evaluate(() => window.liveProof.observations), journal });
    } catch (error) {
      receipt.results.push({provider, title, failure: error.message.slice(0,300), uiEvents:await page.evaluate(()=>window.proofUiEvents)}); writeFileSync(`${out}/physical-${provider}-failure.png`,await device.screenshot()); throw error;
    } finally {
      receipt.results.push({ provider, title, observations: await page.evaluate(() => window.liveProof.observations) });
      try { cleaned = await page.evaluate(() => window.liveProof.cleanup()); }
      finally {
        receipt.results.push({ provider, cleanup: cleaned });
        await page.evaluate(() => { window.liveProof.restore(); delete window.liveProof; document.removeEventListener('click',window.proofUiListener,true); document.removeEventListener('submit',window.proofUiListener,true); delete window.proofUiListener; delete window.proofUiEvents; });
      }
      writeFileSync(`${out}/physical-live.json`, JSON.stringify(receipt, null, 2));
      console.log(`${provider}: synthetic cleanup ${cleaned ? 'confirmed' : 'FAILED'}`);
      if (!cleaned) throw new Error('Synthetic event cleanup requires attention; stopped further tests.');
    }
  }
  receipt.cleanup = true; receipt.passed = true;
} finally {
  receipt.cleanup = receipt.results.some(x=>x.cleanup === true) && !receipt.results.some(x=>x.cleanup === false);
  writeFileSync(`${out}/physical-live.json`, JSON.stringify(receipt, null, 2));
  await Promise.all(devices.map(d => d.close()));
  if(browser) await browser.close();
}
console.log('Selected provider UI CRUD and provider readback passed; synthetic events removed.');
