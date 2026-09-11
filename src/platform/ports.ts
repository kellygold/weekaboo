/** Private runtime ports: UI services expose identities and statuses, never secrets. */
export interface CredentialVault {
  get(reference: string): Promise<string | null>;
  put(reference: string, value: string): Promise<void>;
  remove(reference: string): Promise<void>;
}
export interface HttpTransport {
  request(input: { url: string; method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'PROPFIND' | 'REPORT'; headers?: Record<string, string>; body?: string; timeoutMs?: number }): Promise<{ status: number; headers: Record<string, string>; body: string }>;
}

/** User-chosen JSON files only. The service owns format and data validation. */
export interface FileExchange {
  pick(): Promise<string | null>;
  save(input: { name: string; contents: string }): Promise<boolean>;
}

export interface ActivityLifecycle {
  isActive(): boolean;
  subscribe(listener: (active: boolean) => void): () => void;
}
