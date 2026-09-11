import { boundedRequest } from './bounded-https.mjs';
export const request = input => boundedRequest(input, { allowsHost: host => ['www.googleapis.com', 'graph.microsoft.com', 'caldav.icloud.com'].includes(host) || /^p\d+-caldav\.icloud\.com$/.test(host) });
