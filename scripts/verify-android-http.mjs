// Uses only synthetic XML/headers; no account credentials or event data.
import { _android, expect } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const d = (await _android.devices()).find(d => d.serial() === 'emulator-5554');
if (!d) throw new Error('Start the disposable Weekaboo emulator first.');
try {
  const p = await (await d.webView({ pkg: 'app.weekaboo.calendar' })).page();
  const result = await p.evaluate(async () => {
    const request = options => window.Capacitor.Plugins.WeekabooHttp.request({ ...options, timeoutMs: 10000 });
    const echo = await request({ url: 'https://postman-echo.com/post', method: 'POST', headers: { 'Content-Type': 'application/xml', 'If-Match': '"synthetic-etag"' }, body: '<proof>Weekaboo</proof>' });
    const data = JSON.parse(echo.body);
    const dav = await request({ url: 'https://caldav.icloud.com/', method: 'PROPFIND', headers: { Depth: '0', 'Content-Type': 'application/xml' }, body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>' });
    const redirect = await request({ url: 'https://httpbin.org/redirect-to?url=https%3A%2F%2Fexample.com', method: 'GET' });
    const invalid = await request({ url: 'http://example.com', method: 'GET' }).then(() => false, e => e.code === 'validation');
    return { xmlPostStatus: echo.status, xmlPreserved: data.data === '<proof>Weekaboo</proof>', conditionalHeaderPreserved: data.headers['if-match'] === '"synthetic-etag"', caldavUnauthenticatedStatus: dav.status, redirectStatus: redirect.status, redirectNotFollowed: redirect.status >= 300 && redirect.status < 400, insecureRequestRejected: invalid };
  });
  writeFileSync('output/standalone-stage1/android-http.json', JSON.stringify({ apkSha256: createHash('sha256').update(readFileSync('android/app/build/outputs/apk/debug/app-debug.apk')).digest('hex'), ...result }, null, 2));
  expect(result.xmlPostStatus).toBe(200); expect(result.xmlPreserved).toBe(true); expect(result.conditionalHeaderPreserved).toBe(true);
  expect(result.caldavUnauthenticatedStatus).toBe(401); expect(result.redirectNotFollowed).toBe(true); expect(result.insecureRequestRejected).toBe(true);
  console.log(result);
} finally { await d.close(); }
