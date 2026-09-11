import { addDays, dateKey, type CalendarEvent } from './domain';

export function occursOn(event: CalendarEvent, day: Date): boolean {
  if (event.allDay) return event.start.slice(0, 10) <= dateKey(day) && event.end.slice(0, 10) > dateKey(day);
  return new Date(event.start) < addDays(day, 1) && new Date(event.end) > day;
}

function clockHour(date: Date) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function daySpan(event: CalendarEvent, day: Date) {
  return {
    start: new Date(event.start) < day ? 0 : clockHour(new Date(event.start)),
    end: new Date(event.end) >= addDays(day, 1) ? 24 : clockHour(new Date(event.end)),
  };
}

export function visibleHours(events: CalendarEvent[], days: Date[]) {
  let start = 7; let end = 22;
  for (const day of days) for (const event of events) {
    if (event.allDay || !occursOn(event, day)) continue;
    const span = daySpan(event, day);
    start = Math.min(start, Math.floor(span.start));
    end = Math.max(end, Math.ceil(span.end));
  }
  return { start, end };
}

export function layoutDay(events: CalendarEvent[], day: Date, from: number, to: number, gridHeight: number, minimumHeight: number | ((event: CalendarEvent) => number) = 24) {
  const spans = events.filter(event => !event.allDay && occursOn(event, day)).map(event => {
    const span = daySpan(event, day);
    const top = Math.max(0, (span.start - from) / (to - from) * gridHeight);
    const actualHeight = Math.max(0, Math.min(gridHeight, (span.end-from)/(to-from)*gridHeight-2)-top);
    const minimum = typeof minimumHeight === 'function' ? minimumHeight(event) : minimumHeight;
    const bottom = Math.min(gridHeight, top + Math.max(minimum, actualHeight));
    return { event, top, bottom, actualHeight, col: 0 };
  }).sort((a, b) => a.top - b.top || b.bottom - a.bottom || a.event.id.localeCompare(b.event.id));

  // Each connected overlap group gets its own columns. A busy evening must
  // never reduce the width of a morning appointment.
  const groups: typeof spans[] = [];
  let groupEnd = -Infinity;
  for (const span of spans) {
    if (span.top >= groupEnd) { groups.push([]); groupEnd = -Infinity; }
    groups[groups.length - 1].push(span);
    groupEnd = Math.max(groupEnd, span.bottom);
  }
  return groups.flatMap(group => {
    const columns: typeof spans[] = [];
    for (const span of group) {
      let col = columns.findIndex(column => column[column.length - 1].bottom <= span.top);
      if (col === -1) { col = columns.length; columns.push([]); }
      span.col = col; columns[col].push(span);
    }
    return group.map(span => {
      let right = span.col + 1;
      while (right < columns.length && !columns[right].some(other => other.top < span.bottom && other.bottom > span.top)) right++;
      return { event: span.event, top: span.top, height: span.bottom - span.top, actualHeight: span.actualHeight,
        left: span.col / columns.length * 100, width: (right - span.col) / columns.length * 100 };
    });
  });
}
