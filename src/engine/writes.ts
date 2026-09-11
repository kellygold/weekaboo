import type { CalendarEvent } from '../domain';
import type { EventChanges, EventCreate, EventTarget } from '../services/contracts';
import type { StoredCalendar } from './state';
import { ServiceError } from '../services/errors';
export interface ProviderWriter {
  canEdit?(event: CalendarEvent): boolean;
  findCreated?(token: string, calendar: StoredCalendar, createId: string): Promise<CalendarEvent | null>;
  get(token: string, calendar: StoredCalendar, remoteId: string): Promise<CalendarEvent | null>;
  create(token: string, calendar: StoredCalendar, createId: string, event: EventCreate): Promise<void>;
  update(token: string, calendar: StoredCalendar, remoteId: string, target: EventTarget, changes: EventChanges): Promise<void>;
  remove(token: string, calendar: StoredCalendar, remoteId: string, target: EventTarget): Promise<void>;
}
export function splitEventTarget(target: EventTarget): { calendarId: string; remoteId: string } {
  const pieces = target.id.split(':');
  if (pieces.length !== 2) throw new ServiceError('validation', 'Invalid event identity.');
  try {
    const [calendarId, remoteId] = pieces.map(decodeURIComponent);
    if (!calendarId || !remoteId) throw new Error();
    return { calendarId, remoteId };
  } catch { throw new ServiceError('validation', 'Invalid event identity.'); }
}
