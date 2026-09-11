/** Runtime-private credentials. Never return grants from UI AccountService methods. */
export type OAuthProvider = 'google' | 'microsoft';
export interface AuthorizationRequest {
  provider: OAuthProvider;
  interactive: boolean;
  /** Opaque platform SDK account reference; not a calendar/domain ID. */
  accountRef?: string;
  sharedWorkCalendars?: boolean;
  /** Private rejected token; asks the SDK to bypass/clear that cached grant once. */
  rejectedAccessToken?: string;
}
export interface AccessGrant {
  accessToken: string;
  scopes: string[];
  accountRef?: string;
  expiresAt?: string;
}
export type AuthorizationErrorCode = 'cancelled' | 'timeout' | 'interaction-required' | 'configuration' | 'busy' | 'unavailable' | 'denied';
export class AuthorizationError extends Error {
  constructor(public readonly code: AuthorizationErrorCode, message: string) { super(message); this.name = 'AuthorizationError'; }
}
export interface AuthorizationPort {
  /** Optional immediate cancellation of a system-browser authorization wait. */
  cancel?(): Promise<void>;
  acquire(request: AuthorizationRequest): Promise<AccessGrant>;
  /** Removes this app's account cache only. Does not globally revoke the user's grant. */
  forget(provider: OAuthProvider, accountRef: string): Promise<void>;
}
