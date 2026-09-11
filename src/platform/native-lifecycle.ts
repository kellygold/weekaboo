import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { ActivityLifecycle } from './ports';
import { BrowserLifecycle } from './lifecycle';
const native = registerPlugin<{ addListener(event: 'activity', listener: (event: { active: boolean }) => void): Promise<PluginListenerHandle> }>('WeekabooLifecycle');
/** OS activity callbacks supplement WebView visibility, which varies by platform. */
export class NativeLifecycle implements ActivityLifecycle {
  private active = true;
  isActive() { return this.active && !document.hidden; }
  subscribe(listener: (active: boolean) => void) {
    let disposed = false;
    const pending = native.addListener('activity', event => { this.active = event.active; if (!disposed) listener(this.isActive()); }).catch(() => null); // DOM visibility remains usable if OS notifications are unavailable.
    const removeBrowser = new BrowserLifecycle().subscribe(() => { if (!disposed) listener(this.isActive()); });
    return () => { disposed = true; removeBrowser(); void pending.then(handle => handle?.remove()).catch(() => undefined); };
  }
}
