import { microsoftNotes } from './microsoft-body';
import type { HttpTransport } from '../../platform/ports';
import type { ProviderReader } from '../state';
import { identity } from '../state';
import { ProviderHttp, array, object, string, optionalString, malformed, calendarColor } from './http';
// Unicode CLDR, same attributed mapping as the existing Python provider.
import windowsZones from './windows-zones.json' with { type: 'json' };
const root = 'https://graph.microsoft.com/v1.0/';
const zones: Record<string, string> = windowsZones;
function instant(value: unknown) {
  const clock = object(value), text = string(clock.dateTime);
  // Every Graph read asks for UTC. Reject an unexpected zone instead of shifting silently.
  if (!/[zZ]$|[+-]\d\d:\d\d$/.test(text) && clock.timeZone !== 'UTC' && clock.timeZone !== 'Etc/UTC') return malformed();
  const date = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(text) ? text : text + 'Z');
  if (!Number.isFinite(date.getTime())) return malformed();
  return date;
}
function civilDate(date: Date, zone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zones[zone] || zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch { return malformed(); }
}
export function microsoftReader(transport: HttpTransport): ProviderReader {
  const http = new ProviderHttp(transport, root, { Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"' });
  const pages = (token: string, url: string) => http.pages(token, url, 'value', body => body['@odata.nextLink'] === undefined ? undefined : string(body['@odata.nextLink']));
  return {
    async identity(token) {
      const info = await http.get(token, root + 'me?$select=id,mail,userPrincipalName');
      return { subject: string(info.id), email: string(info.mail || info.userPrincipalName) };
    },
    async calendars(token, account) {
      return (await pages(token, root + 'me/calendars?$top=100')).map(row => {
        const remoteId = string(row.id), id = identity(account.id, remoteId);
        const color = optionalString(row.hexColor);
        return { remoteId, calendar: { id, accountId: account.id, accountEmail: account.email, name: string(row.name), provider: 'microsoft', scope: 'personal', color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : calendarColor(id), enabled: true, writable: row.canEdit === true } };
      });
    },
    async events(token, { calendar, remoteId }, range) {
      const url = new URL(`${root}me/calendars/${encodeURIComponent(remoteId)}/calendarView`);
      url.search = new URLSearchParams({ startDateTime: range.start.toISOString(), endDateTime: range.end.toISOString(), '$top': '250' }).toString();
      return (await pages(token, url.href)).filter(row => !row.isCancelled && !row['@removed']).map(row => {
        return microsoftEvent(row, calendar.id);
      });
    },
  };
}

export function microsoftEvent(row: Record<string, unknown>, calendarId: string) {
        const from = instant(row.start), to = instant(row.end), allDay = row.isAllDay === true;
        if (to < from) return malformed();
        const zone = optionalString(row.originalStartTimeZone) || 'UTC';
        const id = identity(calendarId, string(row.id));
        const description = row.body ? optionalString(object(row.body).content) : undefined;
        const notes = microsoftNotes(description || '');
        const meeting = row.onlineMeeting ? optionalString(object(row.onlineMeeting).joinUrl) : undefined;
        const organizer = row.organizer ? object(object(row.organizer).emailAddress) : {};
        const statuses: Record<string, string> = { accepted: 'accepted', declined: 'declined', tentativelyAccepted: 'tentative', organizer: 'accepted' };
        return { id, commandId: id, calendarId: calendarId, title: optionalString(row.subject) || '(no title)', start: allDay ? civilDate(from, zone) : from.toISOString(), end: allDay ? civilDate(to, zone) : to.toISOString(), allDay, timezone: zones[zone] || zone, revision: optionalString(row['@odata.etag']), location: row.location ? optionalString(object(row.location).displayName) : undefined, description, editableDescription: notes.editable, sourceUrl: optionalString(row.webLink), meetingUrl: meeting || optionalString(row.onlineMeetingUrl) || notes.meetingUrl, recurring: Boolean(row.seriesMasterId), editable: false, syncState: 'synced', attendees: row.attendees === undefined ? [] : array(row.attendees).map(item => {
          const guest = object(item), address = object(guest.emailAddress), status = object(guest.status);
          return { email: optionalString(address.address), name: optionalString(address.name), status: statuses[String(status.response)] || 'needsAction', organizer: typeof address.address === 'string' && typeof organizer.address === 'string' && address.address.toLowerCase() === organizer.address.toLowerCase() };
        }) };
}
