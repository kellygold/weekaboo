import { createRoot } from 'react-dom/client';
import { App } from './main';
import { ServiceProvider } from './services/context';
import { createStandaloneApp } from './engine/app-services';
import { DesktopAuth, DesktopCredentials, DesktopDocuments, DesktopFiles, DesktopHttp, DesktopLifecycle, DesktopTasks } from './platform/desktop';
const authorization = new DesktopAuth();

const services = createStandaloneApp({
  documents: new DesktopDocuments(), credentials: new DesktopCredentials(), transport: new DesktopHttp(),
  taskStore: new DesktopTasks(), files: new DesktopFiles(), lifecycle: new DesktopLifecycle(),
  authorization,
  async availability() { const setup = await authorization.setup(); return { google: setup.googleConfigured, microsoft: setup.microsoftConfigured, icloud: true }; },
  async setupInfo() { const setup = await authorization.setup(); return {
    summary: 'Mac development preview. Calendars connect directly from this Mac; accounts and tasks are local to each installation. Native sign-in and release distribution still require validation.',
    fields: [
      { label: 'Google desktop registration', value: setup.googleConfigured ? 'Configured; live consent still needs testing' : 'Add a Desktop app client to desktop/native-auth.json and rebuild' },
      { label: 'Microsoft registration', value: setup.microsoftConfigured ? 'Configured; register the desktop redirect and test consent' : 'Add the public application client ID to desktop/native-auth.json and rebuild' },
      { label: 'Microsoft mobile/desktop redirect', value: setup.microsoftRedirect },
      { label: 'Callback', value: setup.callback },
    ],
  }; },
});
createRoot(document.getElementById('root')!).render(<ServiceProvider services={services}><App demo={false} /></ServiceProvider>);
