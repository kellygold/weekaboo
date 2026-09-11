import { openDB, type DBSchema } from 'idb';
import type { Task, TaskStore } from './domain';
interface WallDatabase extends DBSchema {
  tasks: { key: string; value: Task };
}
/** Original database name/version/store preserved: existing tasks need no migration. */
export class IndexedDBTaskStore implements TaskStore {
  private db = openDB<WallDatabase>('wall-calendar', 1, {
    upgrade(db) { db.createObjectStore('tasks', { keyPath: 'id' }); },
  });
  async list() {
    return (await (await this.db).getAll('tasks')).sort((a, b) => a.rank - b.rank);
  }
  async transact(transform: (tasks: Task[]) => Task[]) {
    const tx = (await this.db).transaction('tasks', 'readwrite');
    try {
      const before = await tx.store.getAll();
      const after = transform(before);
      const retained = new Set(after.map(task => task.id));
      if (retained.size !== after.length) throw new Error('Task identities must be unique.');
      for (const task of before) if (!retained.has(task.id)) await tx.store.delete(task.id);
      for (const task of after) await tx.store.put(task);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* Already aborted on a storage failure. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }
}
