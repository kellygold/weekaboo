import type { Calendar, CalendarEvent } from './domain';
import type { Account, AccountService, ConnectAccount, CalendarService, CalendarSettings, EventChanges, EventCreate, EventTarget, WriteReceipt } from './services/contracts';
import { ServiceError } from './services/errors';

interface RemoteCalendar {
  id: number; name: string; account_id: number | null;
  account_email: string | null; account_provider: 'google' | 'icloud' | 'microsoft' | null;
  sync_enabled: boolean; sync_error: string | null;
  writable: boolean; color?: string; group_id?: string;
}
interface RemoteEvent {
  id: number; calendar_id: number; title: string; start_at: string;
  end_at: string; all_day: boolean; location: string | null;
  editable_description?: string | null;
  description: string | null; editable: boolean; recurring: boolean;
  recurrence_rule: string | null; sync_state: string;
  attendees?: CalendarEvent['attendees'];
  meeting_url?: string; source_url?: string; recurrence_text?: string;
}

function calendarColor(id: number): string {
  // Stable per-calendar hue, independent of account ownership and list order.
  const hue = (id * 137.508) % 360;
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = .48 - .16 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * value).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export type CalendarRequest = <T>(path: string, method?: string, body?: unknown, timeoutMs?: number) => Promise<T>;
export async function calendarRequest<T>(path: string, method = 'GET', body?: unknown, timeoutMs = 15000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ServiceError(method === 'GET' ? 'unavailable' : 'uncertain', method === 'GET' ? 'Calendar service could not be reached.' : 'The result could not be confirmed. Refresh before retrying this change.');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const code = response.status === 401 ? 'authentication' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'not-found' : [409, 412].includes(response.status) ? 'conflict' : response.status === 429 ? 'rate-limit' : response.status < 500 ? 'validation' : 'unavailable';
    throw new ServiceError(code, error?.error?.message || `Calendar service returned ${response.status}.`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function calendarEvent(row: RemoteEvent): CalendarEvent {
  return {
    // The legacy service lacks original recurrence IDs. Preserve its occurrence
    // identity until native mapping supplies one; command IDs never include time.
    id: `${row.id}:${row.start_at}`, commandId: String(row.id),
    calendarId: String(row.calendar_id), title: row.title,
    start: row.all_day ? row.start_at.slice(0, 10) : row.start_at,
    end: row.all_day ? row.end_at.slice(0, 10) : row.end_at,
    allDay: row.all_day, location: row.location ?? undefined,
    description: row.description ?? undefined, editableDescription: row.editable_description ?? undefined, editable: row.editable,
    recurring: row.recurring, recurrenceRule: row.recurrence_rule ?? undefined,
    syncState: row.sync_state, meetingUrl: row.meeting_url, attendees: row.attendees, sourceUrl: row.source_url, recurrenceText: row.recurrence_text,
  };
}

function legacyId(id: string): string {
  if (!/^[1-9]\d*$/.test(id)) throw new ServiceError('validation', 'Invalid calendar service identity.');
  return id;
}

function targetId(target: EventTarget): string {
  // This baseline API does not accept editor-base revisions. Never silently
  // drop a precondition supplied by a future native caller.
  if (target.revision !== undefined) throw new ServiceError('unsupported', 'This calendar service cannot apply an editor revision.');
  return legacyId(target.id);
}

function eventBody(fields: EventChanges): Record<string, unknown> {
  const names = { title: 'title', start: 'start_at', end: 'end_at', allDay: 'all_day', timezone: 'timezone', location: 'location', description: 'description', recurrenceRule: 'recurrence_rule' } as const;
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(names) as (keyof EventChanges)[]) {
    if (fields[key] !== undefined) body[names[key]] = fields[key];
  }
  return body;
}

/** Temporary browser/development adapter. No backend DTOs escape this module. */
export class HttpCalendarService implements CalendarService {
  constructor(private readonly request: CalendarRequest = calendarRequest) {}
  async getEvent(target: EventTarget) {
    return calendarEvent(await this.request<RemoteEvent>(`events/${targetId(target)}`));
  }
  async createEvent(event: EventCreate): Promise<WriteReceipt> {
    const row = await this.request<RemoteEvent>('events', 'POST', { ...eventBody(event), calendar_id: Number(legacyId(event.calendarId)) });
    return { syncState: row.sync_state };
  }
  async updateEvent(target: EventTarget, changes: EventChanges): Promise<WriteReceipt> {
    const row = await this.request<RemoteEvent>(`events/${targetId(target)}`, 'PATCH', eventBody(changes));
    return { syncState: row.sync_state };
  }
  async deleteEvent(target: EventTarget) { await this.request(`events/${targetId(target)}`, 'DELETE'); }
  async configure(id: string, settings: CalendarSettings) {
    await this.request(`calendars/${legacyId(id)}`, 'PATCH', {
      ...(settings.color !== undefined ? { color_override: settings.color } : {}),
      ...(settings.scope !== undefined ? { group_id: settings.scope } : {}),
      ...(settings.enabled !== undefined ? { sync_enabled: settings.enabled } : {}),
    });
  }
  async refresh() { await this.request('sync/run', 'POST'); }
  async listCalendars(): Promise<Calendar[]> {
    const rows = await this.request<RemoteCalendar[]>('calendars');
    return rows
      .sort((a, b) => a.id - b.id)
      .map(row => ({
        id: String(row.id), accountId: String(row.account_id),
        accountEmail: row.account_email ?? undefined, name: row.name,
        provider: row.account_provider!, scope: row.group_id || 'personal',
        color: row.color || calendarColor(row.id),
        syncError: row.sync_error ?? undefined, enabled: row.sync_enabled,
        writable: row.writable,
      }));
  }

  async listEvents({ start, end }: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    // All-day boundaries are dates. Pad the query across UTC/local midnight,
    // then let the date-aware renderer select the actual visible days.
    const query = new URLSearchParams({
      start: new Date(+start - 86400000).toISOString(),
      end: new Date(+end + 86400000).toISOString(),
    });
    const rows = await this.request<RemoteEvent[]>(`events?${query}`);
    return rows.map(calendarEvent);
  }
}

export class HttpAccountService implements AccountService {
  constructor(private readonly request: CalendarRequest, private readonly navigate: (url: string) => void) {}
  async list(): Promise<Account[]> {
    const rows = await this.request<{ id: number; email: string; provider: Account['provider']; status: string; last_error?: string }[]>('accounts');
    return rows.map(row => ({ id: String(row.id), email: row.email, provider: row.provider, status: row.status, needsAttention: Boolean(row.last_error) }));
  }
  async availability() {
    const setup = await this.request<{ google_configured: boolean; microsoft_configured?: boolean }>('setup');
    return { google: setup.google_configured, microsoft: Boolean(setup.microsoft_configured), icloud: true };
  }
  async connect(input: ConnectAccount) {
    if (input.provider === 'icloud') {
      await this.request('accounts/icloud', 'POST', { apple_id: input.email, app_password: input.appPassword }, 90000);
    } else {
      const body = input.provider === 'microsoft' ? { shared_work_calendars: input.sharedWorkCalendars } : undefined;
      const { url } = await this.request<{ url: string }>(`accounts/${input.provider}/auth-url`, 'POST', body);
      this.navigate(url);
      return 'redirecting' as const;
    }
  }
  async disconnect(id: string) { await this.request(`accounts/${legacyId(id)}`, 'DELETE'); }
}
