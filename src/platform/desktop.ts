import type { TaskStore, Task } from '../domain';
import type { HttpTransport, CredentialVault, FileExchange, ActivityLifecycle } from './ports';
import type { DocumentStore } from '../engine/state';
import { NativeSdkAuthorization } from './native-authorization';
import type { AuthorizationPort } from './authorization';
import { ServiceError } from '../services/errors';
interface DesktopBridge {
  readTasks(): Promise<{ revision: number; tasks: Task[] }>;
  writeTasks(input: { revision: number; tasks: Task[] }): Promise<{ committed: boolean }>;
  readDocument(input: { key: string }): ReturnType<DocumentStore['read']>;
  writeDocument(input: { key: string; revision: number; value: string }): Promise<{ committed: boolean }>;
  vaultGet(input: { reference: string }): Promise<{ value: string | null }>;
  vaultPut(input: { reference: string; value: string }): Promise<void>;
  vaultRemove(input: { reference: string }): Promise<void>;
  request: HttpTransport['request'];
  pickFile(): Promise<string | null>;
  saveFile(input: { name: string; contents: string }): Promise<boolean>;
  onActivity(listener: (active: boolean) => void): () => void;
}
type OperationName = Exclude<keyof DesktopBridge, 'onActivity'>;
type Envelope<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
type RawDesktopBridge = { [K in OperationName]: (...args: Parameters<DesktopBridge[K]>) => Promise<Envelope<Awaited<ReturnType<DesktopBridge[K]>>>> } & Pick<DesktopBridge, 'onActivity'>;
export interface DesktopAuthSetup { googleConfigured: boolean; microsoftConfigured: boolean; microsoftRedirect: string; googleClientType: string; callback: string }
declare global { interface Window { weekabooNative: RawDesktopBridge & {
  authSetup(): Promise<Envelope<DesktopAuthSetup>>;
  authCancel(): Promise<Envelope<void>>;
  authAcquire(input: Parameters<AuthorizationPort['acquire']>[0]): Promise<Envelope<Awaited<ReturnType<AuthorizationPort['acquire']>>>>;
  authForget(input: { provider: string; accountRef: string }): Promise<Envelope<void>>;
} } }
const operations: OperationName[] = ['readTasks', 'writeTasks', 'readDocument', 'writeDocument', 'vaultGet', 'vaultPut', 'vaultRemove', 'request', 'pickFile', 'saveFile'];
let wrapped: DesktopBridge | undefined;
const bridge = (): DesktopBridge => {
  const raw = window.weekabooNative;
  if (!raw) throw new ServiceError('unavailable', 'Open this build in the Weekaboo desktop application.');
  if (!wrapped) wrapped = {
    ...Object.fromEntries(operations.map(name => [name, async (...args: unknown[]) => {
      const result = await (raw[name] as (...values: unknown[]) => Promise<Envelope<unknown>>)(...args);
      if (!result.ok) {
        const code = result.error.code;
        throw new ServiceError(code === 'validation' || code === 'conflict' || code === 'uncertain' ? code : 'unavailable', result.error.message);
      }
      return result.value;
    }])),
    onActivity: listener => raw.onActivity(listener),
  } as DesktopBridge;
  return wrapped;
};
export class DesktopDocuments implements DocumentStore {
  read(key: string) { return bridge().readDocument({ key }); }
  async compareAndSet(key: string, revision: number, value: string) { return (await bridge().writeDocument({ key, revision, value })).committed; }
}
export class DesktopTasks implements TaskStore {
  async list() { return (await bridge().readTasks()).tasks.sort((a, b) => a.rank - b.rank); }
  async transact(transform: (tasks: Task[]) => Task[]) {
    const snapshot = await bridge().readTasks(); const tasks = transform(snapshot.tasks);
    if (!(await bridge().writeTasks({ revision: snapshot.revision, tasks })).committed) throw new ServiceError('conflict', 'Tasks changed while saving. Refresh and try again.');
  }
}
export class DesktopCredentials implements CredentialVault {
  async get(reference: string) { return (await bridge().vaultGet({ reference })).value; }
  put(reference: string, value: string) { return bridge().vaultPut({ reference, value }); }
  remove(reference: string) { return bridge().vaultRemove({ reference }); }
}
export class DesktopHttp implements HttpTransport {
  async request(input: Parameters<HttpTransport['request']>[0]) {
    try { return await bridge().request(input); }
    catch (error) {
      const code = (error as { code?: string })?.code;
      throw new ServiceError(code === 'validation' ? 'validation' : ['GET', 'PROPFIND', 'REPORT'].includes(input.method) ? 'unavailable' : 'uncertain', 'The provider request could not be confirmed.');
    }
  }
}
export class DesktopFiles implements FileExchange {
  pick() { return bridge().pickFile(); }
  save(input: { name: string; contents: string }) { return bridge().saveFile(input); }
}
export class DesktopLifecycle implements ActivityLifecycle {
  private active = true;
  private listeners = new Set<(active: boolean) => void>();
  constructor() { bridge().onActivity(active => { this.active = active; this.listeners.forEach(listener => listener(active)); }); }
  isActive() { return this.active && document.visibilityState !== 'hidden'; }
  subscribe(listener: (active: boolean) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}

async function authResult<T>(promise: Promise<Envelope<T>>): Promise<T> { const result = await promise; if (!result.ok) throw result.error; return result.value; }
export class DesktopAuth extends NativeSdkAuthorization<DesktopAuthSetup> {
  // Cancellation must bypass the queue waiting for the pending acquire call.
  cancel() { this.cancelQueuedInteractive(); return authResult(window.weekabooNative.authCancel()); }
  constructor() { super({
    setup: () => authResult(window.weekabooNative.authSetup()),
    acquire: input => authResult(window.weekabooNative.authAcquire(input)),
    forget: input => authResult(window.weekabooNative.authForget(input)),
  }); }
}
