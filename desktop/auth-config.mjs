import { readFileSync } from 'node:fs';
const googleId = value => /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(value || '');
const uuid = value => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value || '');
export function loadAuthConfig(path) {
  let input; try { input = JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
  // These are desktop-public client registrations, never the browser server credentials.
  return {
    google: googleId(input.google?.clientId) && typeof input.google?.clientSecret === 'string' && input.google.clientSecret.length < 500
      ? { clientId: input.google.clientId, clientSecret: input.google.clientSecret } : undefined,
    microsoft: uuid(input.microsoft?.clientId) ? { clientId: input.microsoft.clientId } : undefined,
  };
}
