import type { ActivityLifecycle } from '../platform/ports';
import type { TaskImportSummary } from './task-backup';
import type { FileExchange } from '../platform/ports';
import type { Calendar, CalendarEvent, CalendarProvider, TaskRepository } from '../domain';

export type ProviderId = 'google' | 'microsoft' | 'icloud';
export interface Account {
  id: string;
  email: string;
  provider: ProviderId;
  status: string;
  needsAttention: boolean;
}
export type ConnectAccount =
  | { provider: 'google' }
  | { provider: 'microsoft'; sharedWorkCalendars: boolean }
  | { provider: 'icloud'; email: string; appPassword: string };
export interface AccountSetupInfo { summary: string; fields: { label: string; value: string }[] }
export interface AccountService {
  setupInfo?(): Promise<AccountSetupInfo>;
  list(): Promise<Account[]>;
  availability(): Promise<Record<ProviderId, boolean>>;
  /** Credentials are transient input; never returned in account metadata. */
  connect(request: ConnectAccount): Promise<void | 'redirecting'>;
  /** Present only where the runtime can stop system-browser sign-in. */
  cancelConnection?(): Promise<void>;
  disconnect(id: string): Promise<void>;
}

export type EventScope = 'event' | 'occurrence' | 'series';
export interface EventTarget {
  id: string;
  scope: EventScope;
  /** Opaque base revision. Adapters must reject unsupported preconditions. */
  revision?: string;
}
export interface EventFields {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  timezone?: string;
  location: string | null;
  description: string | null;
  recurrenceRule: string | null;
}
export interface EventCreate extends EventFields { calendarId: string }
export type EventChanges = Partial<EventFields>;
export interface WriteReceipt { syncState: string }
export interface CalendarSettings { color?: string; scope?: string; enabled?: boolean }
export interface PendingCalendarWrite { id: string; accountId: string; kind: 'create' | 'update' | 'delete'; title: string; sent: boolean; createdAt: string }
export interface CalendarService extends CalendarProvider {
  /** Native durable changes; absent for adapters without this recovery facility. */
  pendingWrites?(): Promise<PendingCalendarWrite[]>;
  resolveWrite?(id: string, action: 'check' | 'dismiss'): Promise<void>;
  getEvent(target: EventTarget): Promise<CalendarEvent>;
  createEvent(event: EventCreate): Promise<WriteReceipt>;
  updateEvent(target: EventTarget, changes: EventChanges): Promise<WriteReceipt>;
  deleteEvent(target: EventTarget): Promise<void>;
  configure(id: Calendar['id'], settings: CalendarSettings): Promise<void>;
  refresh(): Promise<void>;
}

export interface TaskService extends TaskRepository {
  complete(id: string): Promise<void>;
  reopen(id: string): Promise<void>;
  remove(id: string, expectedUpdatedAt: string): Promise<void>;
  exportBackup(): Promise<string>;
  previewImport(contents: string): Promise<TaskImportSummary>;
  importBackup(contents: string): Promise<TaskImportSummary>;
}
export interface AppServices {
  accounts: AccountService;
  calendars: CalendarService;
  tasks: TaskService;
  files: FileExchange;
  lifecycle: ActivityLifecycle;
}

export function eventTarget(event: CalendarEvent): EventTarget {
  if (!event.editable || !event.commandId) throw new Error('This calendar is read-only.');
  return { id: event.commandId, scope: event.recurrenceRule ? 'series' : event.recurring ? 'occurrence' : 'event', revision: event.revision };
}
