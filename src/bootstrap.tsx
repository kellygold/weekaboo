import { BrowserLifecycle } from './platform/lifecycle';
import { BrowserFileExchange } from './platform/browser-files';
import { createRoot } from 'react-dom/client';
import { App } from './main';
import { IndexedDBTaskStore } from './repository';
import { HttpAccountService, HttpCalendarService, calendarRequest } from './calendar-api';
import { DemoCalendarService, demoAccounts } from './services/demo';
import { LocalTaskService } from './services/tasks';
import { ServiceProvider } from './services/context';

// This entry point deliberately retains the working browser/dev adapters.
// Native composition will supply direct providers, never this /api adapter.
const demo = new URLSearchParams(location.search).get('demo') === '1';
const services = {
  lifecycle: new BrowserLifecycle(), files: new BrowserFileExchange(),
  calendars: demo ? new DemoCalendarService() : new HttpCalendarService(),
  accounts: demo ? demoAccounts : new HttpAccountService(calendarRequest, url => window.location.assign(url)),
  tasks: new LocalTaskService(new IndexedDBTaskStore()),
};
createRoot(document.getElementById('root')!).render(<ServiceProvider services={services}><App demo={demo} /></ServiceProvider>);
