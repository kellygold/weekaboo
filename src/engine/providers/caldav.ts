import type { HttpTransport } from '../../platform/ports';
import { ServiceError } from '../../services/errors';
import { expandCalendarResource } from './ical';
const DAV = 'DAV:', CAL = 'urn:ietf:params:xml:ns:caldav';
const propfind = (props: string) => `<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:" xmlns:C="${CAL}" xmlns:A="http://apple.com/ns/ical/"><D:prop>${props}</D:prop></D:propfind>`;
function safeUrl(value: string, base?: string) {
  const url = new URL(value, base);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || !/^(?:p\d+-)?caldav\.icloud\.com$/.test(url.hostname)) throw new ServiceError('unavailable', 'iCloud returned an unsafe calendar address.');
  return url.href;
}
function children(element: Element, ns: string, name: string) { return [...element.children].filter(child => child.namespaceURI === ns && child.localName === name); }
function first(element: Element, ns: string, name: string) { return children(element, ns, name)[0]; }
function text(element?: Element) { return element?.textContent?.trim() || ''; }
function multistatus(body: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(body) || body.length > 8000000) throw new ServiceError('unavailable', 'Unsafe or oversized CalDAV response.');
  const document = new DOMParser().parseFromString(body, 'application/xml');
  if (document.getElementsByTagName('parsererror').length || document.documentElement.namespaceURI !== DAV || document.documentElement.localName !== 'multistatus') throw new ServiceError('unavailable', 'iCloud returned an invalid calendar response.');
  return children(document.documentElement, DAV, 'response').map(response => {
    const href = text(first(response, DAV, 'href'));
    if (!href) throw new ServiceError('unavailable', 'iCloud returned a calendar without an address.');
    const props = new Map<string, Element>();
    for (const status of children(response, DAV, 'propstat')) {
      if (!/^HTTP\/\S+ 200(?:\s|$)/.test(text(first(status, DAV, 'status')))) continue;
      for (const property of first(status, DAV, 'prop')?.children || []) props.set(`${property.namespaceURI}|${property.localName}`, property);
    }
    return { href, status: text(first(response, DAV, 'status')), prop: (ns: string, name: string) => props.get(`${ns}|${name}`) };
  });
}
export class ICloudCalDav {
  constructor(private readonly transport: HttpTransport) {}
  private async request(authorization: string, url: string, method: 'PROPFIND' | 'REPORT', body: string, depth: string) {
    let current = safeUrl(url);
    const seen = new Set<string>();
    for (let hop = 0; hop < 6; hop++) {
      if (seen.has(current)) break;
      seen.add(current);
      const response = await this.transport.request({ url: current, method, body, headers: { Authorization: authorization, 'Content-Type': 'application/xml; charset=utf-8', Depth: depth }, timeoutMs: 60000 });
      if ([301, 302, 307, 308].includes(response.status)) {
        if (!response.headers.location) break;
        current = safeUrl(response.headers.location, current); continue;
      }
      if (response.status !== 207) throw new ServiceError(response.status === 401 ? 'authentication' : response.status === 403 ? 'forbidden' : response.status === 429 ? 'rate-limit' : 'unavailable', response.status === 401 ? 'iCloud rejected this app-specific password.' : 'iCloud could not complete the calendar request.', response.status);
      return { url: current, rows: multistatus(response.body) };
    }
    throw new ServiceError('unavailable', 'iCloud returned a repeated or invalid redirect.');
  }
  private resourceUrl(collection: string, href: string) {
    const base = new URL(safeUrl(collection));
    if (!base.pathname.endsWith('/')) throw new ServiceError('validation', 'Invalid calendar collection.');
    const url = new URL(safeUrl(href, base.href));
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.pathname === base.pathname || url.search) throw new ServiceError('validation', 'The event address is outside this calendar.');
    return url.href;
  }
  async resource(authorization: string, collection: string, href: string, method: 'GET' | 'PUT' | 'DELETE' = 'GET', body?: string, etag?: string) {
    let current = this.resourceUrl(collection, href);
    if (method !== 'GET' && !etag) throw new ServiceError('conflict', 'Refresh the event before changing it.');
    const headers = { Authorization: authorization, ...(body === undefined ? {} : { 'Content-Type': 'text/calendar; charset=utf-8' }), ...(method === 'GET' ? {} : etag === '*' && method === 'PUT' ? { 'If-None-Match': '*' } : { 'If-Match': etag! }) };
    const seen = new Set<string>();
    for (let hop = 0; hop < 6; hop++) {
      if (seen.has(current)) break; seen.add(current);
      const result = await this.transport.request({ url: current, method, headers, ...(body === undefined ? {} : { body }), timeoutMs: 60000 });
      // Only method-preserving redirects are followed for writes. Never resend
      // after a network failure or with a newly fetched revision.
      if ([307, 308].includes(result.status) || method === 'GET' && [301, 302].includes(result.status)) {
        const next = safeUrl(result.headers.location || '', current);
        if (new URL(next).pathname !== new URL(current).pathname || new URL(next).search) throw new ServiceError('unavailable', 'iCloud redirected the event outside its original resource.');
        current = next; continue;
      }
      if (result.status < 200 || result.status >= 300) {
        const code = [400, 422].includes(result.status) ? 'validation' : result.status === 401 ? 'authentication' : result.status === 403 ? 'forbidden' : result.status === 404 ? 'not-found' : [409, 412].includes(result.status) ? 'conflict' : result.status === 429 ? 'rate-limit' : method !== 'GET' && result.status >= 500 ? 'uncertain' : 'unavailable';
        throw new ServiceError(code, code === 'conflict' ? 'This iCloud event changed elsewhere. Refresh before editing.' : 'iCloud could not confirm the calendar request.', result.status);
      }
      if (method === 'GET' && (result.status !== 200 || !result.body || result.body.length > 8000000)) throw new ServiceError('unavailable', 'iCloud returned an incomplete event resource.');
      return { ics: result.body, etag: result.headers.etag, href: new URL(current).pathname };
    }
    throw new ServiceError('unavailable', 'iCloud returned a repeated or invalid redirect.');
  }
  async discover(authorization: string) {
    const principal = await this.request(authorization, 'https://caldav.icloud.com/', 'PROPFIND', propfind('<D:current-user-principal/>'), '0');
    const principalHref = principal.rows.map(row => row.prop(DAV, 'current-user-principal')).map(prop => prop && text(first(prop, DAV, 'href'))).find(Boolean);
    if (!principalHref) throw new ServiceError('unavailable', 'iCloud did not identify the connected account.');
    const principalUrl = safeUrl(principalHref, principal.url);
    const home = await this.request(authorization, principalUrl, 'PROPFIND', propfind('<C:calendar-home-set/>'), '0');
    const homeHref = home.rows.map(row => row.prop(CAL, 'calendar-home-set')).map(prop => prop && text(first(prop, DAV, 'href'))).find(Boolean);
    if (!homeHref) throw new ServiceError('unavailable', 'iCloud did not identify the calendar home.');
    return { subject: new URL(principalUrl).pathname, home: safeUrl(homeHref, home.url) };
  }
  async calendars(authorization: string, home: string) {
    const response = await this.request(authorization, home, 'PROPFIND', propfind('<D:displayname/><D:resourcetype/><D:current-user-privilege-set/><C:supported-calendar-component-set/><A:calendar-color/>'), '1');
    return response.rows.flatMap(row => {
      const type = row.prop(DAV, 'resourcetype');
      if (!type || !first(type, CAL, 'calendar')) return [];
      const components = row.prop(CAL, 'supported-calendar-component-set');
      if (components && !children(components, CAL, 'comp').some(component => component.getAttribute('name') === 'VEVENT')) return [];
      const privileges = row.prop(DAV, 'current-user-privilege-set');
      const writable = privileges && [...privileges.getElementsByTagNameNS(DAV, 'write')].length > 0;
      return [{ remoteId: safeUrl(row.href, response.url), name: text(row.prop(DAV, 'displayname')) || 'Calendar', writable: Boolean(writable), color: text(row.prop('http://apple.com/ns/ical/', 'calendar-color')).slice(0, 7) }];
    });
  }
  async events(authorization: string, calendarId: string, collection: string, range: { start: Date; end: Date }) {
    const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const body = `<?xml version="1.0"?><C:calendar-query xmlns:D="DAV:" xmlns:C="${CAL}"><D:prop><D:getetag/><C:calendar-data/></D:prop><C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"><C:time-range start="${format(range.start)}" end="${format(range.end)}"/></C:comp-filter></C:comp-filter></C:filter></C:calendar-query>`;
    const response = await this.request(authorization, collection, 'REPORT', body, '1');
    return response.rows.flatMap(row => {
      const href = safeUrl(row.href, response.url);
      if (!new URL(href).pathname.startsWith(new URL(response.url).pathname)) throw new ServiceError('unavailable', 'iCloud returned an event outside this calendar.');
      const ics = row.prop(CAL, 'calendar-data')?.textContent;
      if (!ics) throw new ServiceError('unavailable', 'iCloud returned an incomplete event. The previous cache was retained.');
      return expandCalendarResource({ calendarId, href: new URL(href).pathname, etag: text(row.prop(DAV, 'getetag')), ics, range });
    });
  }
}
