// Validation-only interception in the packaged Electron main process. Credentials
// remain inside its closure; only synthetic-event results cross back to the harness.
export function installLiveGuard({ ipcMain }, { provider, title, collection }) {
  const channel = 'weekaboo:operation';
  const original = ipcMain._invokeHandlers.get(channel);
  if (typeof original !== 'function' || globalThis.weekabooLiveProof) throw Error('Unexpected IPC validation state');
  const observations = []; let created, credential, sender, sent = false;
  const ics = text => {
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const value = name => new RegExp('^' + name + '(?:;[^:\r\n]*)?:(.*)$', 'mi').exec(unfolded)?.[1]?.replace(/\r$/, '').replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1');
    return { summary: value('SUMMARY'), description: value('DESCRIPTION'), uid: value('UID'), end: value('DTEND'), location: value('LOCATION'), attendees: [...unfolded.matchAll(/^ATTENDEE[;:]/gmi)], recurring: /^(?:RRULE|RDATE|RECURRENCE-ID)[;:]/mi.test(unfolded), eventCount: [...unfolded.matchAll(/^BEGIN:VEVENT\r?$/gmi)].length };
  };
  const decode = response => provider === 'icloud' ? ics(response.body) : JSON.parse(response.body);
  const headers = () => ({ Authorization: credential, ...(provider === 'microsoft' ? { Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"' } : {}) });
  const unwrap = result => { if (!result.ok) throw Error('Native fixture request failed'); return result.value; };
  const request = async (method, extra = {}) => unwrap(await original(sender, 'request', { url: created.url, method, headers: headers(), timeoutMs: 30000, ...extra }));
  const deleted = response => response.status === 404 || provider === 'google' && response.status === 200 && JSON.parse(response.body).status === 'cancelled';
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, method, input) => {
    if (method === 'authAcquire') observations.push({ auth: input.provider, interactive: input.interactive });
    if (method !== 'request') return original(event, method, input);
    if (['GET', 'REPORT', 'PROPFIND'].includes(input.method)) {
      const result = await original(event, method, input);
      if (result.ok) observations.push({ method: input.method, status: result.value.status });
      return result;
    }
    const url = new URL(input.url), body = input.body ? (provider === 'icloud' ? ics(input.body) : JSON.parse(input.body)) : {};
    const expectedHost = provider === 'google' ? 'www.googleapis.com' : 'graph.microsoft.com';
    if (url.protocol !== 'https:' || !(provider === 'icloud' ? /^p\d+-caldav\.icloud\.com$/.test(url.hostname) : url.hostname === expectedHost)) throw Error('Guard blocked foreign mutation');
    const creating = input.method === 'POST' || provider === 'icloud' && input.method === 'PUT' && input.headers['If-None-Match'] === '*';
    if (creating) {
      if (created || (body.summary || body.subject) !== title || body.attendees?.length || body.recurrence?.length || body.recurrence && !Array.isArray(body.recurrence) || body.recurring) throw Error('Guard blocked unrelated create');
      if (provider === 'icloud') {
        const base = new URL(collection), leaf = url.pathname.slice(base.pathname.length);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || !/^[a-f0-9]{32}\.ics$/.test(leaf) || url.search || body.uid !== leaf.slice(0, -4) || body.eventCount !== 1) throw Error('Guard blocked unknown CalDAV resource');
        created = { url: input.url };
      } else {
        const expected = provider === 'google' ? 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(collection) + '/events' : 'https://graph.microsoft.com/v1.0/me/calendars/' + encodeURIComponent(collection) + '/events';
        if (input.url !== expected) throw Error('Guard blocked wrong calendar');
        if (provider === 'google') created = { url: expected + '/' + encodeURIComponent(body.id) };
      }
      sent = true;
    } else if (!created || input.url !== created.url || !['PATCH', 'PUT', 'DELETE'].includes(input.method)) throw Error('Guard blocked unrelated mutation');
    if (provider === 'icloud' && input.method === 'PUT' && (body.summary !== title || body.attendees.length || body.recurring || body.eventCount !== 1)) throw Error('Guard blocked unrelated CalDAV data');
    credential = input.headers.Authorization; sender = event;
    const result = await original(event, method, input);
    if (result.ok) {
      observations.push({ method: input.method, status: result.value.status });
      if (creating && provider === 'microsoft' && result.value.status >= 200 && result.value.status < 300) {
        const row = JSON.parse(result.value.body); if (!row.id) throw Error('Create omitted identity');
        created = { url: input.url + '/' + encodeURIComponent(row.id) };
      }
    }
    return result;
  });
  globalThis.weekabooLiveProof = {
    observations,
    async read() {
      if (!created) throw Error('Fixture identity missing');
      const response = await request('GET');
      if (deleted(response)) return { deleted: true, status: response.status };
      if (response.status !== 200) throw Error('Fixture readback status ' + response.status);
      const row = decode(response);
      if ((row.summary || row.subject) !== title) throw Error('Fixture identity differs');
      return { status: 200, titleMatches: true, attendeeCount: row.attendees?.length || 0, notes: row.description || row.body?.content || '', location: typeof row.location === 'string' ? row.location : row.location?.displayName || '', end: row.end || null };
    },
    async cleanup() {
      if (!created) return !sent;
      const response = await request('GET'); if (deleted(response)) return true;
      if (response.status !== 200) return false;
      const row = decode(response);
      if ((row.summary || row.subject) !== title || row.attendees?.length || row.recurring || row.recurrence?.length) return false;
      const revision = response.headers.etag || row.etag || row['@odata.etag']; if (!revision) return false;
      await request('DELETE', { headers: { ...headers(), 'If-Match': revision } });
      return deleted(await request('GET'));
    },
    restore() { ipcMain.removeHandler(channel); ipcMain.handle(channel, original); credential = undefined; sender = undefined; delete globalThis.weekabooLiveProof; },
  };
}
