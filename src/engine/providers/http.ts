import type { HttpTransport } from '../../platform/ports';
import { ServiceError } from '../../services/errors';
export function malformed(): never { throw new ServiceError('unavailable', 'The provider returned incomplete calendar data. Sync was not applied.'); }
export function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return malformed(); return value as Record<string, unknown>; }
export function string(value: unknown): string { if (typeof value !== 'string' || !value) return malformed(); return value; }
export function optionalString(value: unknown): string | undefined { return typeof value === 'string' && value ? value : undefined; }
export function array(value: unknown): unknown[] { if (!Array.isArray(value)) return malformed(); return value; }

/** Validate EVERY pagination URL before attaching a token. Transport never follows redirects. */
export class ProviderHttp {
  constructor(private readonly transport: HttpTransport, private readonly root: string, private readonly headers: Record<string, string> = {}) {}
  async get(token: string, url: string): Promise<Record<string, unknown>> { return this.request(token, url, 'GET'); }
  async request(token: string, url: string, method: Parameters<HttpTransport['request']>[0]['method'], body?: unknown, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const expected = new URL(this.root), actual = new URL(url);
    if (actual.origin !== expected.origin || !actual.pathname.startsWith(expected.pathname) || actual.username || actual.password || actual.hash) throw new ServiceError('unavailable', 'The provider returned an unsafe pagination address.');
    const result = await this.transport.request({ url: actual.href, method, headers: { ...this.headers, ...headers, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), timeoutMs: 30000 });
    if (result.status < 200 || result.status >= 300) {
      const code = [400, 422].includes(result.status) ? 'validation' : result.status === 401 ? 'authentication' : result.status === 403 ? 'forbidden' : result.status === 404 ? 'not-found' : [409, 412].includes(result.status) ? 'conflict' : result.status === 429 ? 'rate-limit' : result.status >= 500 && method !== 'GET' ? 'uncertain' : 'unavailable';
      throw new ServiceError(code, code === 'authentication' ? 'Reconnect this account to restore access.' : code === 'rate-limit' ? 'The provider asked us to wait before syncing again.' : 'The calendar provider could not complete this request.', result.status);
    }
    if (result.status === 204) return {};
    try { return object(JSON.parse(result.body)); }
    catch {
      if (method !== 'GET') throw new ServiceError('uncertain', 'The provider accepted the request but its result could not be read. Refresh before retrying.');
      return malformed();
    }
  }
  async pages(token: string, initial: string, rowsKey: string, next: (body: Record<string, unknown>, current: string) => string | undefined, emptyWhenAbsent = false) {
    const rows: unknown[] = [], seen = new Set<string>();
    let url: string | undefined = initial;
    while (url) {
      if (seen.has(url) || seen.size >= 200) throw new ServiceError('unavailable', 'The provider repeated or exceeded calendar pages. Sync was not applied.');
      seen.add(url);
      const body = await this.get(token, url);
      rows.push(...(emptyWhenAbsent && body[rowsKey] === undefined ? [] : array(body[rowsKey])));
      url = next(body, url);
    }
    return rows.map(object);
  }
}
export function calendarColor(seed: string) {
  let hash = 0; for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return ['#658257', '#A9556D', '#5B58AD', '#499C9D', '#A88A43', '#9C6B9E'][hash % 6];
}
