import { addDays, weekStart, type Calendar, type CalendarEvent, type CalendarProvider } from './domain';

const calendars: Calendar[] = [
  { id: 'personal', accountId: 'demo-google', name: 'Personal', provider: 'google', scope: 'personal', color: 'sage' },
  { id: 'together', accountId: 'demo-icloud', name: 'Together', provider: 'icloud', scope: 'personal', color: 'clay' },
  { id: 'work', accountId: 'demo-microsoft', name: 'Work', provider: 'microsoft', scope: 'work', color: 'blue' },
];

export class MockCalendarProvider implements CalendarProvider {
  private anchor = weekStart(new Date());
  async listCalendars() { return calendars; }
  async listEvents({ start, end }: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    const event = (id: string, day: number, hour: number, duration: number, title: string, calendarId: string, location?: string): CalendarEvent => {
      const begins = addDays(this.anchor, day);
      begins.setHours(hour, 0, 0, 0);
      return { id, calendarId, title, start: begins.toISOString(), end: new Date(+begins + duration * 3600000).toISOString(), allDay: false, location };
    };
    return [
      event('walk', 0, 7, 1, 'Morning walk', 'personal', 'A little fresh air'),
      event('groceries', 0, 17, 1, 'Groceries', 'together'),
      event('gym', 1, 8, 1, 'Pilates', 'personal'),
      event('dinner', 1, 18, 1.5, 'Dinner together', 'together', 'Try somewhere new'),
      event('coffee', 2, 10, 1, 'Coffee with a friend', 'personal'),
      event('market', 3, 16, 1, 'Pick up a few things', 'together'),
      event('walk2', 4, 7, 1, 'Morning walk', 'personal'),
      event('date', 4, 18, 2, 'Date night', 'together'),
      event('brunch', 5, 10, 1.5, 'Slow Saturday brunch', 'together'),
      event('outside', 6, 9, 2, 'Get outside', 'personal'),
      event('planning', 0, 10, 1, 'Weekly planning', 'work'),
      event('project', 2, 14, 1.5, 'Project catch-up', 'work'),
      event('review', 4, 11, 1, 'Team review', 'work'),
    ].filter(event => new Date(event.start) < end && new Date(event.end) > start);
  }
}
