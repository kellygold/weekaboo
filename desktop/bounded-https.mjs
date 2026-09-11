import https from 'node:https';
import { DesktopFailure, validate } from './storage.mjs';
export async function boundedRequest(input, { allowsHost, maxBytes = 16_777_216, signal } ) {
  let url; try { url = new URL(input.url); } catch { throw new DesktopFailure('validation'); }
  validate(url.protocol === 'https:' && !url.username && !url.password && !url.port &&
    allowsHost(url.hostname));
  validate(['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'PROPFIND', 'REPORT'].includes(input.method));
  const headers = input.headers || {};
  validate(typeof headers === 'object' && !Array.isArray(headers) && Object.keys(headers).length <= 50 &&
    Object.entries(headers).every(([key, value]) => key.length <= 256 && /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key) && !['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase()) && typeof value === 'string' && !/[\r\n]/.test(value) && value.length <= 16384));
  validate(input.body === undefined || typeof input.body === 'string' && Buffer.byteLength(input.body) <= maxBytes);
  const code = ['GET', 'PROPFIND', 'REPORT'].includes(input.method) ? 'unavailable' : 'uncertain';
  return new Promise((resolve, reject) => {
    let completed = false, timer;
    const abort = () => { finish(true); call.destroy(); }; 
    const finish = (error, result) => { if (completed) return; completed = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); if (error) reject(new DesktopFailure(code)); else resolve(result); };
    // Node HTTPS follows no redirects and owns no browser cookie/credential store.
    const call = https.request(url, { method: input.method, headers, agent: false }, response => {
      let length = 0; const chunks = [];
      response.on('data', chunk => { length += chunk.length; if (length > maxBytes) { finish(true); call.destroy(); } else chunks.push(chunk); });
      response.on('error', () => finish(true));
      response.on('end', () => {
        try {
          const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
          const values = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value || '')]));
          finish(false, { status: response.statusCode, headers: values, body });
        } catch { finish(true); }
      });
    });
    call.on('error', () => finish(true));
    const timeout = Number.isFinite(input.timeoutMs) ? Math.min(120000, Math.max(1000, input.timeoutMs)) : 30000;
    timer = setTimeout(() => { finish(true); call.destroy(); }, timeout);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort(); else call.end(input.body);
  });
}
