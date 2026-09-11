import { test, expect } from '@playwright/test';
import { AppleAuthorization } from '../src/platform/apple-authorization';
import { AndroidAuthorization } from '../src/platform/android-authorization';

test('native authorization cancellation releases the shared queue and redacts SDK errors', async () => {
  let release!: () => void;
  const calls: string[] = [];
  const apple = new AppleAuthorization({ async setup() { return {} as any; }, async acquire() {
    calls.push('apple'); await new Promise<void>(resolve => { release = resolve; });
    throw { code: 'cancelled', message: 'sensitive SDK diagnostics' };
  }, async forget() {} });
  const android = new AndroidAuthorization(async () => ({ email: 'fixture@example.test' }), { async setup() { return {} as any; }, async acquire() { calls.push('android'); return { accessToken: 'fixture', scopes: [] }; }, async forget() {} });
  const first = apple.acquire({ provider: 'google', interactive: true });
  const rejection = expect(first).rejects.toMatchObject({ code: 'cancelled', message: 'Sign-in was cancelled. Your existing accounts are unchanged.' });
  await expect.poll(() => calls.length).toBe(1);
  const second = android.acquire({ provider: 'google', interactive: false });
  await new Promise(resolve => setTimeout(resolve, 10)); expect(calls).toEqual(['apple']);
  release(); await rejection; await second; expect(calls).toEqual(['apple', 'android']);
});
test('Apple adapter preserves account and forced-renewal requests and never exposes unknown native errors', async () => {
  const calls: unknown[] = [];
  const adapter = new AppleAuthorization({ async setup() { return {} as any; }, async acquire(request) { calls.push(request); throw new Error('private token detail'); }, async forget(request) { calls.push(request); } });
  const request = { provider: 'microsoft' as const, interactive: false, accountRef: 'account-2', sharedWorkCalendars: true, rejectedAccessToken: 'synthetic' };
  await expect(adapter.acquire(request)).rejects.toMatchObject({ code: 'unavailable', message: 'Sign-in is unavailable right now. Check your connection and try again.' });
  await adapter.forget('microsoft', 'account-2');
  expect(calls).toEqual([request, { provider: 'microsoft', accountRef: 'account-2' }]);
});
