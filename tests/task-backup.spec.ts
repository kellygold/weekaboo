import { test, expect } from '@playwright/test';
import type { Task, TaskStore } from '../src/domain';
import { LocalTaskService } from '../src/services/tasks';
import { encodeTaskBackup } from '../src/services/task-backup';
const now = new Date('2026-09-11T12:00:00Z');
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: `Task ${id}`, completed: false, rank: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...extra });
function memory(initial: Task[] = []) {
  let rows = structuredClone(initial);
  const store: TaskStore = { async list() { return structuredClone(rows); }, async transact(fn) { rows = fn(structuredClone(rows)); } };
  return new LocalTaskService(store, () => now);
}
test('backup allowlists task fields and preserves completion, schedule, date and ordered history', async () => {
  const tasks = [task('a', { rank: 1, completed: true, completedAt: now.toISOString(), completedOn: '2026-09-12', notes: 'Keep this', dueAt: '2026-09-15' }), task('b', { rank: 0, focusDate: '2026-10-04', scheduledStart: '2026-10-03T23:00:00Z', scheduledEnd: '2026-10-03T23:30:00Z' })];
  Object.assign(tasks[0], { accessToken: 'NEVER_EXPORT', accounts: ['secret'] });
  const backup = await memory(tasks).exportBackup(); expect(backup).not.toContain('NEVER_EXPORT'); expect(backup).not.toContain('accounts');
  const target = memory(); expect(await target.importBackup(backup)).toEqual({ added: 2, unchanged: 0, conflicts: 0 });
  expect((await target.list()).map(t => t.id)).toEqual(['b', 'a']);
  expect((await target.list())[1]).toMatchObject({ completedOn: '2026-09-12', notes: 'Keep this', dueAt: '2026-09-15' });
  expect(await target.importBackup(backup)).toEqual({ added: 0, unchanged: 2, conflicts: 0 });
});
test('import rechecks conflicts after preview, preserving newer local edits and existing order', async () => {
  const original = task('a'); const service = memory([original]);
  const backup = encodeTaskBackup([original, task('b')], now);
  expect(await service.previewImport(backup)).toEqual({ added: 1, unchanged: 1, conflicts: 0 });
  await service.update('a', { title: 'Changed after preview' });
  expect(await service.importBackup(backup)).toEqual({ added: 1, unchanged: 0, conflicts: 1 });
  expect((await service.list()).map(t => t.title)).toEqual(['Changed after preview', 'Task b']);
});
test('invalid and future backups never partially import or overwrite existing data', async () => {
  const service = memory([task('existing')]); const before = await service.list();
  const envelope = (tasks: unknown[], version = 1) => JSON.stringify({ format: 'weekaboo.tasks', version, tasks });
  for (const value of ['{', envelope([task('a')], 2), envelope([task('a'), task('a')]), envelope([task('a'), task('bad', { dueAt: '2026-02-30' })]), envelope([task('a', { rank: NaN })]), envelope([task('a', { scheduledStart: now.toISOString() })]), envelope([task('a', { completed: true })]), ' '.repeat(4_000_001)]) {
    await expect(service.importBackup(value)).rejects.toThrow(); expect(await service.list()).toEqual(before);
  }
});
test('delete rejects stale task revisions and only removes the selected task', async () => {
  const service = memory([task('a', { updatedAt: '2026-09-10T12:00:00Z' }), task('b')]);
  const old = (await service.list())[0]; await service.update('a', { title: 'New title' });
  await expect(service.remove('a', old.updatedAt)).rejects.toMatchObject({ code: 'conflict' });
  await service.remove('a', (await service.list())[0].updatedAt); expect((await service.list()).map(t => t.id)).toEqual(['b']);
});
test('browser file import/export preview and delete confirmation use the shared commands', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Import tasks', exact: true }).click();
  await (await chooser).setFiles({ name: 'weekaboo-tasks.json', mimeType: 'application/json', buffer: Buffer.from(encodeTaskBackup([task('portable', { title: 'Portable task' })], now)) });
  await expect(page.getByText('1 tasks to add')).toBeVisible();
  await page.getByRole('button', { name: 'Add tasks', exact: true }).click();
  await expect(page.getByText('Added 1 tasks.', { exact: false })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export tasks', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^weekaboo-tasks-.*\.json$/);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByText('Portable task', { exact: true }).click();
  await page.getByRole('button', { name: 'Delete task', exact: true }).click();
  await page.getByRole('button', { name: 'Keep task' }).click();
  await page.getByRole('button', { name: 'Delete task', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByText('Portable task', { exact: true })).toHaveCount(0);
});

test('UTF-8 BOM backups import consistently after native and browser file reads', async () => {
  const service = memory();
  expect(await service.importBackup('\uFEFF' + encodeTaskBackup([task('bom')], now))).toEqual({ added: 1, unchanged: 0, conflicts: 0 });
});

test('returning to the foreground reloads tasks changed while the app was away', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.evaluate(async () => {
    const { IndexedDBTaskStore } = await (new Function('return import("/src/repository.ts")'))();
    const { LocalTaskService } = await (new Function('return import("/src/services/tasks.ts")'))();
    await new LocalTaskService(new IndexedDBTaskStore()).create('Added while away');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Edit Added while away', exact: true })).toBeVisible();
});
