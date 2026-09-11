import { MockCalendarProvider } from '../calendar';
import type { AccountService, CalendarService } from './contracts';
import { ServiceError } from './errors';

const unsupported = async (): Promise<never> => { throw new ServiceError('unsupported', 'Sample calendars cannot be changed.'); };
export class DemoCalendarService extends MockCalendarProvider implements CalendarService {
  getEvent = unsupported;
  createEvent = unsupported;
  updateEvent = unsupported;
  deleteEvent = unsupported;
  async configure() {}
  async refresh() {}
}
export const demoAccounts: AccountService = {
  async list() { return []; },
  async availability() { return { google: false, microsoft: false, icloud: false }; },
  connect: unsupported,
  disconnect: unsupported,
};
