import type { Page } from '@playwright/test';
export async function fakeService(page: Page) {
  const calendars = [
    { id: 7, account_id: 2, name: 'Personal', account_email: 'one@example.test', account_provider: 'google', sync_enabled: true, writable: true },
    { id: 13, account_id: 3, name: 'Work', account_email: 'two@example.test', account_provider: 'google', sync_enabled: true, writable: true },
    { id: 4, account_id: 1, name: 'Home', account_email: 'apple@example.test', account_provider: 'icloud', sync_enabled: true, writable: true },
  ];
  let events: any[] = [{ id: 31, calendar_id: 7, title: 'Coffee catch-up', start_at: '2026-09-09T09:00:00+10:00', end_at: '2026-09-09T09:30:00+10:00', all_day: false, editable: true, sync_state: 'synced' }];
  const writes: { path: string; method: string; body: any }[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/', ''), method = request.method();
    const body = request.postDataJSON();
    if (method !== 'GET') writes.push({ path, method, body });
    if (path === 'calendars') return route.fulfill({ json: calendars });
    if (path.startsWith('calendars/')) { Object.assign(calendars.find(c => c.id === Number(path.split('/')[1]))!, body); return route.fulfill({ json: {} }); }
    if (path === 'setup') return route.fulfill({ json: { google_configured: true } });
    if (path.startsWith('accounts/') && method === 'DELETE') { const id = Number(path.split('/')[1]); for (let i = calendars.length-1; i >= 0; i--) if (calendars[i].account_id === id) calendars.splice(i,1); return route.fulfill({ status: 204 }); }
    if (path === 'accounts') return route.fulfill({ json: calendars.map(c => ({ id: c.account_id, provider: c.account_provider, email: c.account_email, status: 'active' })) });
    if (path === 'events' && method === 'GET') return route.fulfill({ json: events });
    if (path === 'events' && method === 'POST') { const event = { ...body, id: 40, editable: true, sync_state: 'pending_create' }; events.push(event); return route.fulfill({ status: 201, json: event }); }
    if (path.startsWith('events/')) {
      const event = events.find(e => e.id === Number(path.split('/')[1]));
      if (method === 'DELETE') { events = events.filter(e => e !== event); return route.fulfill({ status: 204 }); }
      if (method === 'PATCH') Object.assign(event, body);
      return route.fulfill({ json: event });
    }
    return route.fulfill({ json: {} });
  });
  return { writes, calendars, addEvents: (items: any[]) => { events.push(...items); } };
}

