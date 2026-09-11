import type { Account, ConnectAccount } from '../services/contracts';
import { ServiceError } from '../services/errors';
import type { AuthorizationPort, OAuthProvider } from '../platform/authorization';
import type { CredentialVault } from '../platform/ports';
import { identity, type ProviderAccount, type ProviderReader, type StoredCalendar } from './state';
import { ICloudCalDav } from './providers/caldav';
import { calendarColor } from './providers/http';
export interface PreparedConnection {
  account: ProviderAccount;
  calendars: StoredCalendar[];
  rollback?(): Promise<void>;
}
export interface ProviderConnection {
  writer?: import('./writes').ProviderWriter;
  reader: ProviderReader;
  prepare(request: ConnectAccount, existingAccounts?: readonly ProviderAccount[]): Promise<PreparedConnection>;
  access(account: ProviderAccount): Promise<string>;
  forget(account: ProviderAccount): Promise<void>;
}
export function oauthConnection(provider: OAuthProvider, authorization: AuthorizationPort, reader: ProviderReader): ProviderConnection {
  return {
    reader,
    async prepare(request, existingAccounts = []) {
      if (request.provider !== provider) throw new ServiceError('validation', 'Wrong calendar provider.');
      const sharedWorkCalendars = request.provider === 'microsoft' && request.sharedWorkCalendars;
      const grant = await authorization.acquire({ provider, interactive: true, sharedWorkCalendars });
      if (!grant.accountRef) throw new ServiceError('authentication', 'The provider did not identify the authorized account.');
      // SDK references are runtime-owned (email on Android Google, MSAL ID, etc.).
      // Never delete an existing connection's cache when a reconnect fails.
      let existing = existingAccounts.some(account => account.provider === provider && account.authorizationRef === grant.accountRef);
      const rollback = async () => { if (!existing) await authorization.forget(provider, grant.accountRef!); };
      try {
        const user = await reader.identity(grant.accessToken);
        existing ||= existingAccounts.some(account => account.provider === provider && account.subject === user.subject);
        const account: ProviderAccount = { id: identity(provider, user.subject), provider, subject: user.subject, email: user.email, authorizationRef: grant.accountRef, sharedWorkCalendars, status: 'active', needsAttention: false };
        return { account, calendars: await reader.calendars(grant.accessToken, account), rollback };
      } catch (error) { await rollback(); throw error; }
    },
    async access(account) {
      const request = { provider, accountRef: account.authorizationRef, interactive: false, sharedWorkCalendars: account.sharedWorkCalendars };
      let grant = await authorization.acquire(request);
      let user;
      try { user = await reader.identity(grant.accessToken); }
      catch (error) {
        if (!(error instanceof ServiceError) || error.status !== 401) throw error;
        // Exactly one SDK renewal after a rejected cached token, never a loop.
        grant = await authorization.acquire({ ...request, rejectedAccessToken: grant.accessToken });
        user = await reader.identity(grant.accessToken);
      }
      if (user.subject !== account.subject) throw new ServiceError('authentication', 'The provider returned a different account. Reconnect this account.');
      return grant.accessToken;
    },
    async forget(account) { await authorization.forget(provider, account.authorizationRef); },
  };
}
function basic(email: string, password: string) {
  return 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(`${email}:${password}`)));
}
export function icloudConnection(dav: ICloudCalDav, vault: CredentialVault): ProviderConnection {
  const reader: ProviderReader = {
    async identity(token) { return { ...(await dav.discover(token)), email: '' }; },
    async calendars(token, account) {
      const discovered = await dav.discover(token);
      if (discovered.subject !== account.subject) throw new ServiceError('authentication', 'iCloud returned a different account. Reconnect.');
      return (await dav.calendars(token, discovered.home)).map(row => {
        // Partition hosts can change; account/calendar identity uses the collection path.
        const id = identity(account.id, new URL(row.remoteId).pathname);
        return { remoteId: row.remoteId, calendar: { id, accountId: account.id, accountEmail: account.email, provider: 'icloud', name: row.name, writable: row.writable, scope: 'personal', enabled: true, color: /^#[0-9a-f]{6}$/i.test(row.color) ? row.color : calendarColor(id) } };
      });
    },
    async events(token, calendar, range) { return dav.events(token, calendar.calendar.id, calendar.remoteId, range); },
  };
  return {
    reader,
    async prepare(request) {
      if (request.provider !== 'icloud') throw new ServiceError('validation', 'Wrong calendar provider.');
      const email = request.email.trim(), password = request.appPassword.trim();
      if (!email || email.includes(':') || email.length > 320 || !password || password.length > 128) throw new ServiceError('validation', 'Enter your Apple ID and app-specific password.');
      const credential = basic(email, password), discovered = await dav.discover(credential);
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(discovered.subject)))].map(n => n.toString(16).padStart(2, '0')).join('');
      const reference = `icloud.${hash}`;
      const account: ProviderAccount = { id: identity('icloud', discovered.subject), provider: 'icloud', subject: discovered.subject, email, authorizationRef: reference, sharedWorkCalendars: false, status: 'active', needsAttention: false };
      const calendars = await reader.calendars(credential, account);
      const previous = await vault.get(reference);
      await vault.put(reference, JSON.stringify({ email, password }));
      return { account, calendars, async rollback() { if (previous === null) await vault.remove(reference); else await vault.put(reference, previous); } };
    },
    async access(account) {
      const stored = await vault.get(account.authorizationRef);
      if (!stored) throw new ServiceError('authentication', 'Reconnect iCloud with its app-specific password.');
      const value = JSON.parse(stored);
      if (typeof value.email !== 'string' || typeof value.password !== 'string') throw new ServiceError('authentication', 'Reconnect iCloud to restore its credentials.');
      const credential = basic(value.email, value.password);
      if ((await dav.discover(credential)).subject !== account.subject) throw new ServiceError('authentication', 'iCloud returned a different account. Reconnect.');
      return credential;
    },
    async forget(account) { await vault.remove(account.authorizationRef); },
  };
}
