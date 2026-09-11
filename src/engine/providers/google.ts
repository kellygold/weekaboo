import type { HttpTransport } from '../../platform/ports';
import type { ProviderReader } from '../state';
import { identity } from '../state';
import { ProviderHttp, array, object, string, optionalString, malformed, calendarColor } from './http';
const root = 'https://www.googleapis.com/calendar/v3/';
export function googleReader(transport: HttpTransport): ProviderReader {
  const http = new ProviderHttp(transport, root);
  const pages = (token: string, url: string) => http.pages(token, url, 'items', (body, current) => {
    if (body.nextPageToken === undefined) return undefined;
    const next = new URL(current); next.searchParams.set('pageToken', string(body.nextPageToken)); return next.href;
  }, true);
  return {
    async identity(token) {
      const info = await new ProviderHttp(transport, 'https://www.googleapis.com/oauth2/v3/').get(token, 'https://www.googleapis.com/oauth2/v3/userinfo');
      if (info.email_verified !== true) return malformed();
      return { subject: string(info.sub), email: string(info.email) };
    },
    async calendars(token, account) {
      return (await pages(token, `${root}users/me/calendarList?maxResults=250`)).filter(row => !row.deleted).map(row => {
        const remoteId = string(row.id), id = identity(account.id, remoteId);
        return { remoteId, calendar: { id, accountId: account.id, accountEmail: account.email, name: optionalString(row.summaryOverride) || optionalString(row.summary) || account.email, provider: 'google', scope: 'personal', color: optionalString(row.backgroundColor) || calendarColor(id), enabled: true, writable: row.accessRole === 'owner' || row.accessRole === 'writer' } };
      });
    },
    async events(token, { calendar, remoteId }, range) {
      const url = new URL(`${root}calendars/${encodeURIComponent(remoteId)}/events`);
      url.search = new URLSearchParams({ singleEvents: 'true', showDeleted: 'false', maxResults: '2500', timeMin: range.start.toISOString(), timeMax: range.end.toISOString() }).toString();
      return (await pages(token, url.href)).filter(row => row.status !== 'cancelled').map(row => {
        return googleEvent(row, calendar.id);
      });
    },
  };
}

export function googleEvent(row: Record<string, unknown>, calendarId: string) {
  const calendar = { id: calendarId };
        const start = object(row.start), end = object(row.end), allDay = Boolean(start.date);
        const from = string(allDay ? start.date : start.dateTime), to = string(allDay ? end.date : end.dateTime);
        if (!Number.isFinite(Date.parse(from)) || Date.parse(to) < Date.parse(from)) return malformed();
        const remoteEventId = string(row.id);
        const original = row.originalStartTime ? object(row.originalStartTime) : undefined;
        // Original recurrence identity survives moving an occurrence to another time.
        const id = identity(calendar.id, optionalString(row.recurringEventId) || remoteEventId, original ? string(original.date || original.dateTime) : 'single');
        return { id, commandId: identity(calendar.id, remoteEventId), calendarId: calendar.id, title: optionalString(row.summary) || '(no title)', start: from, end: to, allDay, timezone: optionalString(start.timeZone), revision: optionalString(row.etag), location: optionalString(row.location), description: optionalString(row.description), sourceUrl: optionalString(row.htmlLink), meetingUrl: optionalString(row.hangoutLink), recurring: Boolean(row.recurringEventId), editable: false, syncState: 'synced', attendees: row.attendees === undefined ? [] : array(row.attendees).map(item => {
          const guest = object(item); return { email: optionalString(guest.email), name: optionalString(guest.displayName), status: optionalString(guest.responseStatus) || 'needsAction', organizer: guest.organizer === true };
        }) };
}
