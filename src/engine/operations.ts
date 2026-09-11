import type { EventChanges, EventCreate, EventTarget } from '../services/contracts';
import { ServiceError } from '../services/errors';
import type { DocumentStore } from './state';

export type EventOperationInput =
  | { kind: 'create'; accountId: string; event: EventCreate }
  | { kind: 'update'; accountId: string; calendarId: string; target: EventTarget; changes: EventChanges }
  | { kind: 'delete'; accountId: string; calendarId: string; target: EventTarget };
export interface EventOperation {
  id: string;
  /** One identity per intent, retained through ambiguous network outcomes/restarts. */
  remoteCreateId: string;
  input: EventOperationInput;
  state: 'prepared' | 'sent' | 'uncertain' | 'confirmed' | 'rejected';
  createdAt: string;
  updatedAt: string;
  failureCode?: string;
}
const key = 'event-operations';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => `${JSON.stringify(name)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Durable intent log, not an automatic retry loop. Transport ambiguity is never success. */
export class OperationJournal {
  constructor(private readonly documents: DocumentStore, private readonly newId = () => crypto.randomUUID(), private readonly now = () => new Date().toISOString()) {}
  private async snapshot() {
    const snapshot = await this.documents.read(key);
    if (snapshot.value === null) return { ...snapshot, operations: [] as EventOperation[] };
    const decoded = JSON.parse(snapshot.value);
    if (decoded.version !== 1 || !Array.isArray(decoded.operations)) throw new ServiceError('unsupported', 'This operation journal requires a newer Weekaboo version.');
    return { ...snapshot, operations: decoded.operations as EventOperation[] };
  }
  async list() { return (await this.snapshot()).operations; }
  async unresolved(accountId: string) { return (await this.list()).filter(op => op.input.accountId === accountId && !['confirmed', 'rejected'].includes(op.state)); }
  async prepare(input: EventOperationInput): Promise<EventOperation> {
    const snapshot = await this.snapshot();
    const existing = snapshot.operations.find(op => !['confirmed', 'rejected'].includes(op.state) && canonical(op.input) === canonical(input));
    if (existing) return existing;
    const id = this.newId(), time = this.now();
    // UUID hex is legal Google base32hex; Microsoft accepts UUID transactionId;
    // iCloud can use the same UUID as its resource name. Never regenerate on retry.
    const operation: EventOperation = { id, remoteCreateId: id.replaceAll('-', '').toLowerCase(), input: structuredClone(input), state: 'prepared', createdAt: time, updatedAt: time };
    await this.commit(snapshot.revision, [...snapshot.operations, operation]);
    return operation;
  }
  async transition(id: string, state: EventOperation['state'], failureCode?: string): Promise<EventOperation> {
    const snapshot = await this.snapshot(), existing = snapshot.operations.find(op => op.id === id);
    if (!existing) throw new ServiceError('not-found', 'The saved calendar operation could not be found.');
    const allowed: Record<EventOperation['state'], EventOperation['state'][]> = {
      prepared: ['sent', 'rejected'], sent: ['confirmed', 'uncertain', 'rejected'],
      // Uncertain creates must first be looked up by their stable remote ID. A
      // reconciler can confirm or reject; resending needs explicit evidence.
      uncertain: ['confirmed', 'rejected'], confirmed: [], rejected: [],
    };
    if (!allowed[existing.state].includes(state)) throw new ServiceError('conflict', 'This calendar operation cannot be retried in its current state.');
    const next = { ...existing, state, failureCode, updatedAt: this.now() };
    await this.commit(snapshot.revision, snapshot.operations.map(op => op.id === id ? next : op));
    return next;
  }
  private async commit(revision: number, operations: EventOperation[]) {
    const terminal = operations.filter(op => ['confirmed', 'rejected'].includes(op.state));
    const removable = terminal.slice(0, Math.max(0, terminal.length - 100));
    operations = operations.filter(op => !removable.includes(op));
    let value = JSON.stringify({ version: 1, operations });
    while (value.length > 6000000) {
      const index = operations.findIndex(op => ['confirmed', 'rejected'].includes(op.state));
      if (index < 0) throw new ServiceError('unavailable', 'Saved calendar changes are full. Resolve pending changes before adding more.');
      operations.splice(index, 1); value = JSON.stringify({ version: 1, operations });
    }
    if (!await this.documents.compareAndSet(key, revision, value)) throw new ServiceError('conflict', 'Calendar changes were updated elsewhere. Refresh before retrying.');
  }
}
