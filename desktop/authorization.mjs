import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-node';
import { createHash } from 'node:crypto';
import { authorizeInBrowser, DesktopAuthError, checkActive } from './loopback.mjs';
import { googleFetch, microsoftNetwork } from './auth-network.mjs';
const googleScopes = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar'];
const microsoftScopes = shared => ['User.Read', 'Calendars.ReadWrite', ...(shared ? ['Calendars.ReadWrite.Shared'] : [])];
const hash = value => createHash('sha256').update(value).digest('hex');
const reference = (provider, clientId, subject) => `${provider}.${hash(clientId + ':' + subject)}`;
const validRef = value => typeof value === 'string' && value.length > 0 && value.length <= 500;
const classify = error => {
  if (error instanceof DesktopAuthError) return error;
  const code = error?.errorCode || error?.response?.data?.error;
  if (error instanceof InteractionRequiredAuthError || ['invalid_grant', 'no_tokens_found', 'no_account_in_silent_request', 'interaction_required', 'login_required', 'consent_required'].includes(code)) return new DesktopAuthError('interaction-required');
  if (['unauthorized_client', 'invalid_client', 'invalid_request', 'redirect_uri_mismatch'].includes(code)) return new DesktopAuthError('configuration');
  if (code === 'access_denied') return new DesktopAuthError('denied');
  return new DesktopAuthError('unavailable');
};
// Auth tokens remain in the main process except for short-lived access grants passed to the shared engine.
// Each provider SDK operation gets a fresh in-memory client hydrated from encrypted, app-private storage.
export class DesktopAuthorization {
  constructor(config, vault, openBrowser, factories = {}) {
    this.config = config; this.vault = vault; this.openBrowser = openBrowser;
    this.googleClient = factories.google || (options => new OAuth2Client(options));
    this.microsoftClient = factories.microsoft || (options => new PublicClientApplication(options));
    this.authorize = factories.authorize || authorizeInBrowser;
    this.active = null;
  }
  setup() { return { googleConfigured: Boolean(this.config.google), microsoftConfigured: Boolean(this.config.microsoft), microsoftRedirect: 'http://localhost', googleClientType: 'Desktop app', callback: 'Temporary loopback receiver on this Mac only' }; }
  cancel() { this.active?.abort(); }
  cancelInteractive() { if (this.activeInteractive) this.cancel(); }
  async run(operation, interactive = false) {
    if (this.active) throw new DesktopAuthError('busy');
    const controller = new AbortController(); this.active = controller; this.activeInteractive = interactive;
    try { return await operation(controller.signal); }
    catch (error) { if (controller.signal.aborted) throw new DesktopAuthError('cancelled'); throw classify(error); }
    finally { this.active = null; this.activeInteractive = false; }
  }
  async acquire(input) {
    if (!input || !['google', 'microsoft'].includes(input.provider) || typeof input.interactive !== 'boolean' || input.accountRef !== undefined && !validRef(input.accountRef) || input.sharedWorkCalendars !== undefined && typeof input.sharedWorkCalendars !== 'boolean' || input.rejectedAccessToken !== undefined && (typeof input.rejectedAccessToken !== 'string' || input.rejectedAccessToken.length > 65536)) throw new DesktopAuthError('configuration');
    if (!this.config[input.provider]) throw new DesktopAuthError('configuration');
    if (!input.interactive && !input.accountRef) throw new DesktopAuthError('interaction-required');
    return this.run(signal => input.provider === 'google' ? this.acquireGoogle(input, signal) : this.acquireMicrosoft(input, signal), input.interactive);
  }
  async acquireGoogle(input, signal) {
    const config = this.config.google;
    const client = this.googleClient({ ...config, transporterOptions: { fetchImplementation: googleFetch(signal), retry: false, maxRedirects: 0, timeout: 30000, maxContentLength: 2_000_000 } });
    // SDK requests set their own retry options; bound every request at the interceptor too.
    client.transporter?.interceptors.request.add({ resolved: options => { options.retry = false; options.maxRedirects = 0; options.timeout = 30000; return options; } });
    let credentials, subject, stored;
    if (input.interactive) {
      const result = await this.authorize({ signal, openBrowser: this.openBrowser, buildUrl: ({ redirectUri, state, challenge }) => client.generateAuthUrl({ scope: googleScopes, access_type: 'offline', prompt: 'consent select_account', state, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: CodeChallengeMethod.S256 }) });
      checkActive(signal);
      credentials = (await client.getToken({ code: result.code, codeVerifier: result.verifier, redirect_uri: result.redirectUri })).tokens;
    } else {
      if (!/^google\.[a-f0-9]{64}$/.test(input.accountRef)) throw new DesktopAuthError('interaction-required');
      const value = this.vault.vaultGet({ reference: input.accountRef }).value;
      if (!value) throw new DesktopAuthError('interaction-required');
      stored = JSON.parse(value);
      if (stored.clientId !== config.clientId || reference('google', config.clientId, stored.subject) !== input.accountRef) throw new DesktopAuthError('interaction-required');
      subject = stored.subject; credentials = stored.credentials; client.setCredentials(credentials);
      if (!credentials.access_token || !Number.isFinite(credentials.expiry_date) || credentials.expiry_date <= Date.now() + 60000 || input.rejectedAccessToken) credentials = { ...credentials, ...(await client.refreshAccessToken()).credentials };
    }
    checkActive(signal);
    if (typeof credentials?.access_token !== 'string') throw new DesktopAuthError('denied');
    const info = await client.getTokenInfo(credentials.access_token);
    if (!Number.isFinite(info.expiry_date) || info.expiry_date <= Date.now() || !Array.isArray(info.scopes)) throw new DesktopAuthError('unavailable');
    if (info.aud !== config.clientId || typeof info.sub !== 'string' || !info.sub || subject && info.sub !== subject) throw new DesktopAuthError('interaction-required');
    if (!googleScopes.filter(scope => scope !== 'openid').every(scope => info.scopes.includes(scope))) throw new DesktopAuthError('denied');
    subject = info.sub;
    const accountRef = reference('google', config.clientId, subject);
    if (input.accountRef && input.accountRef !== accountRef) throw new DesktopAuthError('interaction-required');
    if (!credentials.refresh_token) {
      const previous = this.vault.vaultGet({ reference: accountRef }).value;
      const retained = previous ? JSON.parse(previous) : null;
      if (retained?.clientId === config.clientId && retained.subject === subject) credentials.refresh_token = retained.credentials.refresh_token;
    }
    if (typeof credentials.refresh_token !== 'string' || !credentials.refresh_token) throw new DesktopAuthError('interaction-required');
    checkActive(signal);
    // No persistent write occurs until account/scopes have been checked. Failed reconnect keeps its prior grant.
    this.vault.vaultPut({ reference: accountRef, value: JSON.stringify({ clientId: config.clientId, subject, credentials }) });
    return { accessToken: credentials.access_token, scopes: info.scopes, accountRef, expiresAt: new Date(info.expiry_date).toISOString() };
  }
  async microsoft(signal) {
    const clientId = this.config.microsoft.clientId;
    const client = this.microsoftClient({ auth: { clientId, authority: 'https://login.microsoftonline.com/common' }, system: { disableInternalRetries: true, networkClient: microsoftNetwork(signal), loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} } } });
    const cache = client.getTokenCache(), key = reference('microsoft-cache', clientId, 'all');
    const saved = this.vault.vaultGet({ reference: key }).value;
    if (saved) cache.deserialize(saved);
    return { client, cache, key };
  }
  async acquireMicrosoft(input, signal) {
    const { client, cache, key } = await this.microsoft(signal);
    const scopes = microsoftScopes(input.sharedWorkCalendars);
    let result;
    if (input.interactive) {
      const reply = await this.authorize({ hostname: 'localhost', signal, openBrowser: this.openBrowser,
        buildUrl: ({ redirectUri, state, challenge }) => client.getAuthCodeUrl({ scopes, redirectUri, state, codeChallenge: challenge, codeChallengeMethod: 'S256', prompt: 'select_account' }) });
      checkActive(signal);
      result = await client.acquireTokenByCode({ scopes, code: reply.code, redirectUri: reply.redirectUri, codeVerifier: reply.verifier });
    } else {
      const account = await cache.getAccountByHomeId(input.accountRef);
      if (!account) throw new DesktopAuthError('interaction-required');
      result = await client.acquireTokenSilent({ scopes, account, forceRefresh: Boolean(input.rejectedAccessToken) });
    }
    const accountRef = result?.account?.homeAccountId;
    if (!validRef(accountRef) || typeof result.accessToken !== 'string' || !result.accessToken || input.accountRef && input.accountRef !== accountRef) throw new DesktopAuthError('interaction-required');
    if (!scopes.every(scope => result.scopes.some(granted => granted.toLowerCase().replace('https://graph.microsoft.com/', '') === scope.toLowerCase()))) throw new DesktopAuthError('denied');
    const expiresAt = result.expiresOn?.toISOString();
    checkActive(signal); this.vault.vaultPut({ reference: key, value: cache.serialize() });
    return { accessToken: result.accessToken, scopes: result.scopes, accountRef, expiresAt };
  }
  async forget(input) {
    if (!['google', 'microsoft'].includes(input?.provider) || !validRef(input?.accountRef) || !this.config[input.provider]) throw new DesktopAuthError('configuration');
    return this.run(async signal => {
      if (input.provider === 'google') {
        if (!/^google\.[a-f0-9]{64}$/.test(input.accountRef)) throw new DesktopAuthError('configuration');
        this.vault.vaultRemove({ reference: input.accountRef });
      } else {
        const { cache, key } = await this.microsoft(signal);
        const account = await cache.getAccountByHomeId(input.accountRef);
        if (account) { await cache.removeAccount(account); checkActive(signal); this.vault.vaultPut({ reference: key, value: cache.serialize() }); }
      }
      return {};
    });
  }
}
