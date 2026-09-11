import { boundedRequest } from './bounded-https.mjs';
const policy = signal => ({ allowsHost: host => ['login.microsoftonline.com', 'oauth2.googleapis.com'].includes(host), maxBytes: 2_000_000, signal });
// SDK network adapter: bounded, no redirect, fixed public-cloud endpoints, no diagnostics.
export function microsoftNetwork(signal) {
  const send = async (url, options, method) => {
    const response = await boundedRequest({ url, method, headers: options?.headers, body: options?.body, timeoutMs: 30000 }, policy(signal));
    return { status: response.status, headers: response.headers, body: JSON.parse(response.body) };
  };
  return { sendGetRequestAsync: (url, options) => send(url, options, 'GET'), sendPostRequestAsync: (url, options) => send(url, options, 'POST') };
}
export function googleFetch(signal) {
  return async (url, options = {}) => {
    const headers = new Headers(options.headers);
    // Fetch supplies this header for URLSearchParams. Preserve that behavior
    // when adapting the SDK's form body to our bounded Node HTTPS transport.
    const form = options.body instanceof URLSearchParams;
    if (form && !headers.has('content-type')) headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
    const body = form ? options.body.toString() : options.body;
    const response = await boundedRequest({ url: String(url), method: options.method || 'GET', headers: Object.fromEntries(headers), body, timeoutMs: 30000 }, policy(signal));
    return new Response(response.body, { status: response.status, headers: response.headers });
  };
}
