import { registerPlugin } from '@capacitor/core';
import type { Task, TaskStore } from '../domain';
import type { CredentialVault, HttpTransport } from './ports';
import { ServiceError } from '../services/errors';
interface FoundationBridge {
  readTasks(): Promise<{ revision: number; tasks: Task[] }>;
  writeTasks(input: { revision: number; tasks: Task[] }): Promise<{ committed: boolean }>;
  vaultGet(input: { reference: string }): Promise<{ value: string | null }>;
  vaultPut(input: { reference: string; value: string }): Promise<void>;
  vaultRemove(input: { reference: string }): Promise<void>;
}
const bridge = registerPlugin<FoundationBridge>('WeekabooStorage');
export class NativeTaskStore implements TaskStore {
  constructor(private readonly storage = bridge) {}
  async list() { return (await this.storage.readTasks()).tasks.sort((a, b) => a.rank - b.rank); }
  async transact(transform: (tasks: Task[]) => Task[]) {
    // No lock is held across the JS/native bridge. CAS prevents lost updates.
    // Do not rerun an arbitrary transform on conflict; let the caller refresh.
    const snapshot = await this.storage.readTasks();
    const tasks = transform(snapshot.tasks);
    if (new Set(tasks.map(task => task.id)).size !== tasks.length) throw new ServiceError('validation', 'Task identities must be unique.');
    const result = await this.storage.writeTasks({ revision: snapshot.revision, tasks });
    if (!result.committed) throw new ServiceError('conflict', 'Tasks changed while saving. Refresh and try again.');
  }
}
export class NativeCredentialVault implements CredentialVault {
  async get(reference: string) { return (await bridge.vaultGet({ reference })).value; }
  async put(reference: string, value: string) { await bridge.vaultPut({ reference, value }); }
  async remove(reference: string) { await bridge.vaultRemove({ reference }); }
}
const http = registerPlugin<HttpTransport>('WeekabooHttp');
export class NativeHttpTransport implements HttpTransport {
  async request(input: Parameters<HttpTransport['request']>[0]) {
    const url = new URL(input.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new ServiceError('validation', 'Provider requests require HTTPS without URL credentials.');
    try { return await http.request(input); }
    catch (error) {
      if ((error as { code?: string }).code === 'validation') throw new ServiceError('validation', 'Invalid HTTPS provider request.');
      throw new ServiceError(input.method === 'GET' || input.method === 'PROPFIND' || input.method === 'REPORT' ? 'unavailable' : 'uncertain', 'Provider request could not be confirmed. Refresh before retrying changes.');
    }
  }
}

interface DocumentBridge {
  readDocument(input: { key: string }): Promise<{ revision: number; value: string | null }>;
  writeDocument(input: { key: string; revision: number; value: string }): Promise<{ committed: boolean }>;
}
const documents = registerPlugin<DocumentBridge>('WeekabooStorage');
export class NativeDocumentStore {
  async read(key: string) { return documents.readDocument({ key }); }
  async compareAndSet(key: string, revision: number, value: string) { return (await documents.writeDocument({ key, revision, value })).committed; }
}
