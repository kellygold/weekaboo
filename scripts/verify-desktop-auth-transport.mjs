// SDK transport smoke: no login/browser, no account data and only an intentionally invalid token.
import { OAuth2Client } from 'google-auth-library';
import { PublicClientApplication } from '@azure/msal-node';
import { googleFetch, microsoftNetwork } from '../desktop/auth-network.mjs';
import { loadAuthConfig } from '../desktop/auth-config.mjs';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const client = new OAuth2Client({ transporterOptions: { fetchImplementation: googleFetch(), retry: false, maxRedirects: 0 } });
client.transporter.interceptors.request.add({ resolved: options => { options.retry = false; return options; } });
let googleStatus;
try { await client.getTokenInfo('weekaboo-synthetic-invalid-token'); throw new Error('Unexpected valid token'); }
catch (error) { googleStatus = error.response?.status; assert.equal(googleStatus, 400); }
const config = loadAuthConfig('desktop/native-auth.json');
let microsoftDiscovery = false;
if (config.microsoft) {
  const msal = new PublicClientApplication({ auth: { clientId: config.microsoft.clientId, authority: 'https://login.microsoftonline.com/common' }, system: { networkClient: microsoftNetwork(), disableInternalRetries: true, loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} } } });
  const url = new URL(await msal.getAuthCodeUrl({ scopes: ['User.Read', 'Calendars.ReadWrite'], redirectUri: 'http://localhost:45000/', state: 'synthetic-state', codeChallenge: 'synthetic-challenge', codeChallengeMethod: 'S256' }));
  assert.equal(url.hostname, 'login.microsoftonline.com'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); microsoftDiscovery = true;
}
writeFileSync('output/standalone-desktop/auth-transport.json', JSON.stringify({ googleSyntheticInvalidTokenStatus: googleStatus, microsoftDiscoveryAndPkceUrl: microsoftDiscovery, browserOpened: false, liveConsent: false }, null, 2));
console.log('Desktop SDKs work through bounded native authorization transport; no consent attempted.');
