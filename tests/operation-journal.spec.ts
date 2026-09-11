import { test, expect } from '@playwright/test';
import { OperationJournal, type EventOperationInput } from '../src/engine/operations';
import type { DocumentStore } from '../src/engine/state';
function fixture() {
  let revision = 0, value: string | null = null, count = 0;
  const documents: DocumentStore = { async read() { return { revision, value }; }, async compareAndSet(_key, expected, next) { if (expected !== revision) return false; value = next; revision++; return true; } };
  return { documents, journal: new OperationJournal(documents, () => `11111111-1111-4111-8111-${String(++count).padStart(12, '0')}`) };
}
const input: EventOperationInput = { kind: 'create', accountId: 'google:one', event: { calendarId: 'calendar:one', title: 'Proof', start: '2026-10-03T09:00:00Z', end: '2026-10-03T10:00:00Z', allDay: false, location: null, description: null, recurrenceRule: null } };
test('lost create result retains its identity after a process restart and cannot be resent blindly', async () => {
  const { documents, journal } = fixture();
  const operation = await journal.prepare(input);
  expect(operation.remoteCreateId).toMatch(/^[0-9a-v]{32}$/);
  await journal.transition(operation.id, 'sent'); await journal.transition(operation.id, 'uncertain');
  const restarted = new OperationJournal(documents);
  expect((await restarted.prepare(input)).id).toBe(operation.id);
  await expect(restarted.transition(operation.id, 'sent')).rejects.toMatchObject({ code: 'conflict' });
  await restarted.transition(operation.id, 'confirmed');
  expect(await restarted.unresolved('google:one')).toEqual([]);
  expect((await restarted.prepare(input)).id).not.toBe(operation.id); // explicit later duplicate is a new intent
});
test('journal preflight cannot succeed when its durable write fails', async () => {
  const documents: DocumentStore = { async read() { return { revision: 0, value: null }; }, async compareAndSet() { return false; } };
  await expect(new OperationJournal(documents).prepare(input)).rejects.toMatchObject({ code: 'conflict' });
});
test('partial patch fields and base revisions survive serialization without converting null to omission', async () => {
  const { journal } = fixture();
  const operation = await journal.prepare({ kind: 'update', accountId: 'icloud:one', calendarId: 'calendar', target: { id: 'resource', scope: 'occurrence', revision: '"v1"' }, changes: { description: null, allDay: false } });
  expect((await journal.list())[0].input).toEqual(operation.input);
  await journal.transition(operation.id, 'sent'); await journal.transition(operation.id, 'rejected', 'conflict');
  await expect(journal.transition(operation.id, 'confirmed')).rejects.toMatchObject({ code: 'conflict' });
});
