import type { ActivityLifecycle } from './ports';
export class BrowserLifecycle implements ActivityLifecycle {
  isActive() { return !document.hidden; }
  subscribe(listener: (active: boolean) => void) {
    const change = () => listener(this.isActive());
    document.addEventListener('visibilitychange', change); window.addEventListener('focus', change);
    return () => { document.removeEventListener('visibilitychange', change); window.removeEventListener('focus', change); };
  }
}
