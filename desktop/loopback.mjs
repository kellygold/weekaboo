import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
export class DesktopAuthError extends Error { constructor(code) { super('Desktop sign-in could not complete.'); this.code = code; } }
export const checkActive = signal => { if (signal?.aborted) throw new DesktopAuthError('cancelled'); };
// Short-lived callback receiver only. Never binds a LAN interface or serves app/API data.
export async function authorizeInBrowser({ hostname = '127.0.0.1', buildUrl, openBrowser, signal, timeoutMs = 300000 }) {
  checkActive(signal);
  if (!['127.0.0.1', 'localhost'].includes(hostname)) throw new DesktopAuthError('configuration');
  const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  let resolveCode, rejectCode, settled = false, timer;
  const result = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  // Attach before opening browser/listening, so cancellation cannot leak an unhandled rejection.
  void result.catch(() => {});
  const finish = (code, error) => { if (settled) return; settled = true; clearTimeout(timer); error ? rejectCode(error) : resolveCode(code); };
  let redirectUri;
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 }, (request, response) => {
    const reply = (status, message) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer', Connection: 'close' }); response.end(message); };
    try {
      const expected = new URL(redirectUri);
      if (request.method !== 'GET' || request.headers.host !== expected.host || !request.url?.startsWith('/') || request.url.startsWith('//') || request.url.length > 8192) return reply(400, 'Invalid callback.');
      const url = new URL(request.url, redirectUri);
      if (url.pathname !== '/' || url.origin !== expected.origin) return reply(404, 'Not found.');
      const actual = url.searchParams.get('state') || '';
      if (url.searchParams.getAll('state').length !== 1 || Buffer.byteLength(actual) !== state.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(state))) return reply(400, 'This callback does not match the pending sign-in.');
      if (settled) return reply(410, 'This sign-in is finished.');
      const code = url.searchParams.get('code'), error = url.searchParams.get('error');
      if (url.searchParams.getAll('code').length > 1 || url.searchParams.getAll('error').length > 1 || Boolean(code) === Boolean(error)) return reply(400, 'Invalid callback.');
      if (error) { reply(200, 'Sign-in was not completed. Return to Weekaboo.'); finish(null, new DesktopAuthError(error === 'access_denied' ? 'denied' : 'configuration')); }
      else { reply(200, 'Sign-in received. Return to Weekaboo to finish connecting your calendar.'); finish(code); }
    } catch { reply(400, 'Invalid callback.'); }
  });
  const abort = () => finish(null, new DesktopAuthError('cancelled'));
  signal?.addEventListener('abort', abort, { once: true });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    checkActive(signal);
    redirectUri = `http://${hostname}:${server.address().port}/`;
    timer = setTimeout(() => finish(null, new DesktopAuthError('timeout')), timeoutMs);
    const url = await buildUrl({ redirectUri, state, verifier, challenge });
    checkActive(signal);
    await openBrowser(url);
    const code = await result; checkActive(signal);
    return { code, redirectUri, verifier };
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
