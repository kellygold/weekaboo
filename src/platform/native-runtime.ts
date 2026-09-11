import { Capacitor } from '@capacitor/core';
import { AndroidAuthorization } from './android-authorization';
import { AppleAuthorization } from './apple-authorization';
import type { AuthorizationPort } from './authorization';
import type { AccountService } from '../services/contracts';
import type { HttpTransport } from './ports';
import { googleReader } from '../engine/providers/google';
interface NativeRuntime { authorization: AuthorizationPort; availability: AccountService['availability']; setupInfo: NonNullable<AccountService['setupInfo']> }
export function nativeRuntime(transport: HttpTransport): NativeRuntime {
  if (Capacitor.getPlatform() === 'android') {
    const authorization = new AndroidAuthorization(googleReader(transport).identity);
    return {
      authorization,
      async availability() { const setup = await authorization.setup(); return { google: setup.googleAvailable, microsoft: setup.microsoftConfigured, icloud: true }; },
      async setupInfo() {
        const setup = await authorization.setup();
        return { summary: 'Android development preview. Google and Microsoft need native registration. iCloud uses an app-specific password. Event editing and new repeats are enabled. Whole-series iCloud edits are still being migrated. Keep your existing web registrations.', fields: [
          { label: 'Android package', value: setup.packageName },
          { label: 'Google Android SHA-1', value: setup.sha1 },
          { label: 'Microsoft Android signature hash', value: setup.signatureHash },
          { label: 'Microsoft redirect URI', value: setup.microsoftRedirectUri },
        ] };
      },
    };
  }
  if (Capacitor.getPlatform() === 'ios') {
    const authorization = new AppleAuthorization();
    return { authorization, async availability() { const setup = await authorization.setup(); return { google: setup.googleConfigured, microsoft: setup.microsoftConfigured, icloud: true }; }, async setupInfo() {
      const setup = await authorization.setup();
      return { summary: 'iOS development preview, not a release. Apple adapters and native sign-in require full Xcode and device validation. Google and Microsoft need separate native registrations; iCloud uses an app-specific password.', fields: [
        { label: 'Apple bundle identifier', value: setup.bundleId },
        { label: 'Microsoft iOS redirect URI', value: setup.microsoftRedirectUri },
        { label: 'Google URL scheme', value: setup.googleRedirectScheme },
      ] };
    } };
  }
  throw new Error('This native build requires its installed Android or iOS container. Use the browser build on the web.');
}
