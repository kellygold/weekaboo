export type CalendarScope = string;
export interface Calendar {
  id: string;
  accountId: string;
  accountEmail?: string;
  name: string;
  provider: 'google' | 'microsoft' | 'icloud' | 'local';
  scope: CalendarScope;
  color: string;
  syncError?: string;
  enabled?: boolean;
  writable?: boolean;
}
// All-day dates remain dates; timed events use ISO instants. Provider adapters
// must expand recurrence and preserve source identifiers before returning data.
export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  timezone?: string;
  location?: string;
  sourceUrl?: string;
  meetingUrl?: string;
  attendees?: { email?: string; name?: string; status: string; organizer?: boolean }[];
  recurrenceText?: string;
  taskId?: string;
  /** Opaque command identity, distinct from a rendered occurrence's identity. */
  commandId?: string;
  revision?: string;
  description?: string;
  editableDescription?: string;
  editable?: boolean;
  recurring?: boolean;
  recurrenceRule?: string;
  syncState?: string;
}
export interface CalendarProvider {
  listCalendars(): Promise<Calendar[]>;
  listEvents(range: { start: Date; end: Date }): Promise<CalendarEvent[]>;
}
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  rank: number;
  notes?: string;
  sectionOrListId?: string;
  assigneeId?: string;
  dueAt?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  recurrence?: string;
  source?: string;
  externalId?: string;
  focusDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedOn?: string;
}
export type TaskChanges = Partial<Pick<Task, 'title' | 'completed' | 'notes' | 'dueAt' | 'focusDate' | 'scheduledStart' | 'scheduledEnd'>>;
export interface TaskRepository {
  list(): Promise<Task[]>;
  create(title: string, options?: Pick<TaskChanges, 'focusDate'>): Promise<void>;
  update(id: string, changes: TaskChanges): Promise<void>;
  reorder(ids: string[]): Promise<void>;
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
export function weekStart(date: Date): Date {
  const result = addDays(date, -((date.getDay() + 6) % 7));
  result.setHours(0, 0, 0, 0);
  return result;
}

export function taskOnDay(task: Task, day: Date, _today: string): boolean {
  if (task.completed) {
    const completedDate = task.completedOn || (task.completedAt ? dateKey(new Date(task.completedAt)) : undefined);
    return completedDate === dateKey(day);
  }
  return task.focusDate === dateKey(day);
}

/** A synchronous task transform commits atomically or not at all. */
export interface TaskStore {
  list(): Promise<Task[]>;
  transact(transform: (tasks: Task[]) => Task[]): Promise<void>;
}
