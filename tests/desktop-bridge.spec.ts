import { test, expect } from '@playwright/test';
import { DesktopDocuments, DesktopAuth, DesktopHttp } from '../src/platform/desktop';
test('desktop plain IPC envelopes preserve service/auth error codes and do not surface private SDK diagnostics', async () => {
  const previous = (globalThis as any).window;
  try {
    (globalThis as any).window = { weekabooNative: {
      readDocument: async () => ({ ok: false, error: { code: 'conflict', message: 'Local state changed.' } }),
      request: async () => ({ ok: false, error: { code: 'validation', message: 'Invalid destination.' } }),
      authSetup: async () => ({ ok: true, value: { googleConfigured: true, microsoftConfigured: false } }),
      authAcquire: async () => ({ ok: false, error: { code: 'interaction-required', message: 'private SDK diagnostic' } }),
      authForget: async () => ({ ok: false, error: { code: 'alien-error', message: 'private SDK diagnostic' } }),
    } };
    await expect(new DesktopDocuments().read('calendar-state')).rejects.toMatchObject({ code: 'conflict' });
    await expect(new DesktopHttp().request({ url: 'http://unsafe/', method: 'POST' })).rejects.toMatchObject({ code: 'validation' });
    const auth = new DesktopAuth(); expect(await auth.setup()).toMatchObject({ googleConfigured: true });
    await expect(auth.acquire({ provider: 'google', interactive: false })).rejects.toMatchObject({ code: 'interaction-required', message: 'Reconnect this account to restore calendar access.' });
    await expect(auth.forget('google', 'fixture')).rejects.toMatchObject({ code: 'unavailable', message: 'Sign-in is unavailable right now. Check your connection and try again.' });
  } finally { (globalThis as any).window = previous; }
});
