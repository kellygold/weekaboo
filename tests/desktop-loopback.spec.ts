import { test, expect } from '@playwright/test';
import { authorizeInBrowser } from '../desktop/loopback.mjs';
import { createHash } from 'node:crypto';
import http from 'node:http';
const get = (url: string, headers?: Record<string, string>) => new Promise<{ status: number; body: string }>((resolve, reject) => {
  const call = http.get(url, { headers }, response => { let body = ''; response.on('data', value => body += value); response.on('end', () => resolve({ status: response.statusCode!, body })); }); call.on('error', reject);
});
test('desktop callback rejects foreign state, host, path and duplicates before accepting its single PKCE response', async () => {
  let input: any, callback = '';
  const grant = await authorizeInBrowser({ buildUrl(value: any) { input = value; return 'https://accounts.google.com/o/oauth2/v2/auth'; }, async openBrowser() {
    callback = input.redirectUri;
    expect(new URL(callback).hostname).toBe('127.0.0.1');
    expect(createHash('sha256').update(input.verifier).digest('base64url')).toBe(input.challenge);
    const valid = callback + '?state=' + input.state + '&code=fixture';
    expect((await get(callback + '?state=wrong&code=fixture')).status).toBe(400);
    expect((await get(valid, { Host: 'attacker.test' })).status).toBe(400);
    expect((await get(callback + 'wrong?state=' + input.state + '&code=fixture')).status).toBe(404);
    expect((await get(valid + '&code=second')).status).toBe(400);
    const received = await get(valid); expect(received.status).toBe(200); expect(received.body).not.toContain('fixture');
  } });
  expect(grant).toEqual({ code: 'fixture', redirectUri: callback, verifier: input.verifier });
  await expect(get(callback)).rejects.toThrow();
});
test('desktop callback denial, timeout, browser failure and cancellation close the listener', async () => {
  for (const scenario of ['denied', 'timeout', 'browser', 'cancel']) {
    let callback = '', input: any; const abort = new AbortController();
    const promise = authorizeInBrowser({ signal: abort.signal, timeoutMs: 40, buildUrl(value: any) { input = value; callback = value.redirectUri; return 'https://accounts.google.com/'; }, async openBrowser() {
      if (scenario === 'denied') await get(callback + '?state=' + input.state + '&error=access_denied');
      if (scenario === 'browser') throw new Error('synthetic browser failure');
      if (scenario === 'cancel') abort.abort();
    } });
    if (scenario === 'timeout') await expect(promise).rejects.toHaveProperty('code', 'timeout');
    else await expect(promise).rejects.toThrow();
    await expect(get(callback)).rejects.toThrow();
  }
});
