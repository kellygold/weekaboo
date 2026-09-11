import { AuthorizationError, type AuthorizationErrorCode, type AuthorizationPort } from './authorization';
export interface NativeAuthorizationBridge<Setup> {
  setup(): Promise<Setup>;
  acquire: AuthorizationPort['acquire'];
  forget(input: { provider: string; accountRef: string }): Promise<void>;
}
// One SDK operation at a time across all adapter instances. A view change or
// browser-return focus event waits for consent rather than reporting auth failure.
let pending: Promise<unknown> = Promise.resolve();
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation, operation);
  pending = next.catch(() => undefined);
  return next;
}
const messages: Record<AuthorizationErrorCode, string> = {
  cancelled: 'Sign-in was cancelled. Your existing accounts are unchanged.',
  timeout: 'Sign-in timed out. If the browser showed an error, check it before trying again.',
  'interaction-required': 'Reconnect this account to restore calendar access.',
  configuration: 'Native sign-in needs its app registration. Check the setup details for this installation.',
  busy: 'Finish the current sign-in before starting another.',
  unavailable: 'Sign-in is unavailable right now. Check your connection and try again.',
  denied: 'Calendar access was not granted. Allow calendar access when reconnecting.',
};
export class NativeSdkAuthorization<Setup> implements AuthorizationPort {
  private interactiveGeneration = 0;
  protected cancelQueuedInteractive() { this.interactiveGeneration++; }
  constructor(private readonly native: NativeAuthorizationBridge<Setup>) {}
  setup() { return this.native.setup(); }
  async acquire(request: Parameters<AuthorizationPort['acquire']>[0]) {
    const generation = this.interactiveGeneration;
    try { return await serialized(() => {
      if (request.interactive && generation !== this.interactiveGeneration) throw new AuthorizationError('cancelled', messages.cancelled);
      return this.native.acquire(request);
    }); } catch (error) { throw this.translate(error); }
  }
  async forget(provider: Parameters<AuthorizationPort['forget']>[0], accountRef: string) {
    // Capacitor accepts one structured argument, unlike our platform-independent port.
    try { await serialized(() => this.native.forget({ provider, accountRef })); }
    catch (error) { throw this.translate(error); }
  }
  private translate(error: unknown) {
    const code = (error as { code?: string })?.code;
    const known = code && Object.hasOwn(messages, code) ? code as AuthorizationErrorCode : 'unavailable';
    return new AuthorizationError(known, messages[known]);
  }
}
