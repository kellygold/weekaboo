import { dateKey, type TaskStore, type TaskChanges } from '../domain';
import { decodeTaskBackup, encodeTaskBackup, mergeTaskBackup, type TaskImportSummary } from './task-backup';
import { ServiceError } from './errors';
import { createId } from '../id';
import type { TaskService } from './contracts';

/** Task rules shared by IndexedDB and future native stores. */
export class LocalTaskService implements TaskService {
  constructor(private readonly store: TaskStore, private readonly now = () => new Date(), private readonly id = createId) {}
  list() { return this.store.list(); }
  async create(title: string, options?: Pick<TaskChanges, 'focusDate'>) {
    title = title.trim();
    if (!title) throw new Error('Give your task a name.');
    await this.store.transact(tasks => {
      const now = this.now().toISOString();
      return [...tasks, { id: this.id(), title, completed: false, rank: Math.max(-1, ...tasks.map(task => task.rank)) + 1,
        createdAt: now, updatedAt: now, ...(options?.focusDate ? { focusDate: options.focusDate } : {}) }];
    });
  }
  async update(id: string, changes: TaskChanges) {
    if (changes.title !== undefined && !changes.title.trim()) throw new Error('Give your task a name.');
    await this.store.transact(tasks => {
      if (!tasks.some(task => task.id === id)) throw new Error('This task could not be found.');
      return tasks.map(task => {
        if (task.id !== id) return task;
        const updatedAt = this.now().toISOString();
        const updated = { ...task, ...changes, updatedAt };
        updated.title = updated.title.trim();
        if (changes.completed !== undefined && changes.completed !== task.completed) {
          updated.completedAt = changes.completed ? updatedAt : undefined;
          updated.completedOn = changes.completed ? dateKey(new Date(updatedAt)) : undefined;
        }
        return updated;
      });
    });
  }
  async reorder(ids: string[]) {
    await this.store.transact(rows => {
      const tasks = [...rows].sort((a, b) => a.rank - b.rank);
      const byId = new Map(tasks.map(task => [task.id, task]));
      const members = new Set(ids);
      if (members.size !== ids.length || ids.some(id => !byId.has(id))) throw new Error('Task order changed. Please try again.');
      let next = 0;
      const updatedAt = this.now().toISOString();
      return tasks.map((task, rank) => ({ ...(members.has(task.id) ? byId.get(ids[next++])! : task), rank, updatedAt }));
    });
  }
  async remove(id: string, expectedUpdatedAt: string) {
    await this.store.transact(tasks => {
      const task = tasks.find(task => task.id === id);
      if (!task || task.updatedAt !== expectedUpdatedAt) throw new ServiceError('conflict', 'This task changed. Reopen it before deleting.');
      return tasks.filter(task => task.id !== id);
    });
  }
  async exportBackup() { return encodeTaskBackup(await this.list(), this.now()); }
  async previewImport(contents: string) { return mergeTaskBackup(await this.list(), decodeTaskBackup(contents)).summary; }
  async importBackup(contents: string) {
    const incoming = decodeTaskBackup(contents);
    let summary: TaskImportSummary = { added: 0, unchanged: 0, conflicts: 0 };
    await this.store.transact(tasks => {
      const merged = mergeTaskBackup(tasks, incoming); summary = merged.summary; return merged.tasks;
    });
    return summary;
  }
  complete(id: string) { return this.update(id, { completed: true }); }
  reopen(id: string) { return this.update(id, { completed: false }); }
}
