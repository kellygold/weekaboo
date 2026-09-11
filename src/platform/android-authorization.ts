import { registerPlugin } from '@capacitor/core';
import { NativeSdkAuthorization, type NativeAuthorizationBridge } from './native-authorization';
import type { AuthorizationRequest } from './authorization';
export interface AndroidAuthorizationSetup {
  googleAvailable: boolean;
  microsoftConfigured: boolean;
  packageName: string;
  sha1: string;
  signatureHash: string;
  microsoftRedirectUri: string;
}
const bridge = registerPlugin<NativeAuthorizationBridge<AndroidAuthorizationSetup>>('WeekabooAuthorization');
export class AndroidAuthorization extends NativeSdkAuthorization<AndroidAuthorizationSetup> {
  constructor(private readonly identifyGoogle: (accessToken: string) => Promise<{ email: string }>, native = bridge) { super(native); }
  async acquire(request: AuthorizationRequest) {
    const grant = await super.acquire(request);
    if (request.provider !== 'google') return grant;
    // Android AuthorizationClient returns a token without an account reference.
    // Resolve the first selection through verified provider identity; future SDK
    // requests use that email with android.accounts.Account. The engine still
    // verifies the stable provider subject before accepting every acquired token.
    const accountRef = request.accountRef || (await this.identifyGoogle(grant.accessToken)).email;
    return { ...grant, accountRef };
  }
}
