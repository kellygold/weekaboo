import type { Calendar, CalendarEvent } from '../domain';
import type { Account } from '../services/contracts';
import type { ProviderId } from '../services/contracts';
import { ServiceError } from '../services/errors';
export interface ProviderAccount extends Account {
  provider: ProviderId;
  subject: string;
  authorizationRef: string;
  sharedWorkCalendars: boolean;
}
export interface StoredCalendar { calendar: Calendar; remoteId: string }
export interface CalendarState {
  version: 1;
  accounts: ProviderAccount[];
  calendars: StoredCalendar[];
}
export interface DocumentStore {
  read(key: string): Promise<{ revision: number; value: string | null }>;
  compareAndSet(key: string, revision: number, value: string): Promise<boolean>;
}
const key = 'calendar-state';
export class CalendarStateStore {
  constructor(private readonly documents: DocumentStore) {}
  private decode(value: string | null): CalendarState {
    if (value === null) return { version: 1, accounts: [], calendars: [] };
    const state = JSON.parse(value) as CalendarState;
    if (state.version !== 1 || !Array.isArray(state.accounts) || !Array.isArray(state.calendars)) throw new ServiceError('unsupported', 'This calendar data needs a newer version of Weekaboo.');
    return state;
  }
  async read() { return this.decode((await this.documents.read(key)).value); }
  async change(transform: (state: CalendarState) => CalendarState) {
    const snapshot = await this.documents.read(key);
    const state = transform(this.decode(snapshot.value));
    if (!await this.documents.compareAndSet(key, snapshot.revision, JSON.stringify(state))) throw new ServiceError('conflict', 'Calendar connections changed. Refresh and try again.');
  }
}
export const identity = (...parts: string[]) => parts.map(encodeURIComponent).join(':');
export interface ProviderReader {
  identity(token: string): Promise<{ subject: string; email: string }>;
  calendars(token: string, account: ProviderAccount): Promise<StoredCalendar[]>;
  events(token: string, calendar: StoredCalendar, range: { start: Date; end: Date }): Promise<CalendarEvent[]>;
}
