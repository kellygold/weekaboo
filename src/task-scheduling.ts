import { dateKey, type CalendarEvent, type Task, type TaskChanges } from './domain';

export function scheduledTaskEvent(task: Task): CalendarEvent | undefined {
  if (!task.scheduledStart || !task.scheduledEnd) return;
  const start = new Date(task.scheduledStart), end = new Date(task.scheduledEnd);
  if (!Number.isFinite(+start) || +end <= +start) return;
  // Completion history belongs to the actual completion day. If completed on
  // another day, show its history in that day's Anytime row instead.
  if (task.completed && (task.completedOn || (task.completedAt && dateKey(new Date(task.completedAt)))) !== dateKey(start)) return;
  return { id: `task:${task.id}`, taskId: task.id, calendarId: 'task', title: task.title, start: start.toISOString(), end: end.toISOString(), allDay: false };
}

export function taskDrop(date: string, minutes?: number, task?: Task): TaskChanges {
  if (minutes === undefined) return { focusDate: date, scheduledStart: undefined, scheduledEnd: undefined };
  const existing = task?.scheduledStart && task.scheduledEnd ? (+new Date(task.scheduledEnd) - +new Date(task.scheduledStart)) / 60000 : 30;
  const duration = Math.max(15, Math.min(1440, Math.round(existing / 15) * 15));
  const snapped = Math.max(0, Math.min(1440 - duration, Math.round(minutes / 15) * 15));
  const start = new Date(`${date}T00:00:00`); start.setMinutes(snapped);
  const end = new Date(+start + duration * 60000);
  return { focusDate: dateKey(start), scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() };
}

export function resizeTask(task: Task, edge: 'start' | 'end', minutes: number): TaskChanges {
  const start = new Date(task.scheduledStart!), end = new Date(task.scheduledEnd!);
  const midnight = new Date(start); midnight.setHours(0, 0, 0, 0);
  const tomorrow = new Date(midnight); tomorrow.setDate(tomorrow.getDate() + 1);
  const delta = Math.round(minutes / 15) * 15 * 60000;
  if (edge === 'start') start.setTime(Math.max(+midnight, Math.min(+end - 15 * 60000, +start + delta)));
  else end.setTime(Math.min(+tomorrow, Math.max(+start + 15 * 60000, +end + delta)));
  return { focusDate: dateKey(start), scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() };
}
export function taskTimeRange(task: Pick<Task, 'scheduledStart' | 'scheduledEnd'>) {
  const time = (value?: string) => value ? new Date(value).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '';
  return `${time(task.scheduledStart)} – ${time(task.scheduledEnd)}`;
}
