import { addDays, weekStart } from './domain';

export type CalendarView = 'day' | '4days' | 'week' | 'month';
export const viewLabels: Record<CalendarView, string> = { day: 'Day', '4days': '4 days', week: 'Week', month: 'Month' };

export function calendarDays(focus: Date, view: CalendarView): Date[] {
  let start = new Date(focus);
  start.setHours(0, 0, 0, 0);
  let count = view === 'day' ? 1 : view === '4days' ? 4 : 7;
  if (view === 'week') start = weekStart(start);
  if (view === 'month') {
    start = weekStart(new Date(focus.getFullYear(), focus.getMonth(), 1));
    const last = new Date(focus.getFullYear(), focus.getMonth() + 1, 0);
    count = 28;
    while (addDays(start, count) <= last) count += 7;
  }
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function navigateDate(focus: Date, view: CalendarView, direction: number): Date {
  if (view === 'month') return new Date(focus.getFullYear(), focus.getMonth() + direction, 1);
  return addDays(focus, direction * (view === 'week' ? 7 : view === '4days' ? 4 : 1));
}
