import { registerPlugin } from '@capacitor/core';
import { NativeSdkAuthorization, type NativeAuthorizationBridge } from './native-authorization';
export interface AppleAuthorizationSetup {
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  bundleId: string;
  googleRedirectScheme: string;
  microsoftRedirectUri: string;
}
const bridge = registerPlugin<NativeAuthorizationBridge<AppleAuthorizationSetup>>('WeekabooAuthorization');
export class AppleAuthorization extends NativeSdkAuthorization<AppleAuthorizationSetup> {
  constructor(native = bridge) { super(native); }
}
