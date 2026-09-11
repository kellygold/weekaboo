import type { Task } from '../domain';
import { ServiceError } from './errors';

export const TASK_BACKUP_LIMIT = 4_000_000;
export interface TaskImportSummary { added: number; unchanged: number; conflicts: number }
const required = ['id', 'title', 'createdAt', 'updatedAt'] as const;
const optional = ['notes', 'sectionOrListId', 'assigneeId', 'dueAt', 'scheduledStart', 'scheduledEnd', 'recurrence', 'source', 'externalId', 'focusDate', 'completedAt', 'completedOn'] as const;
function invalid(): never { throw new ServiceError('validation', 'This is not a supported Weekaboo task backup. Your tasks have not changed.'); }
function civil(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value; }
function instant(value: string) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)); }
/** Allowlisted task fields only: never serialize arbitrary store/document metadata. */
export function backupTask(value: unknown): Task {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (required.some(key => typeof row[key] !== 'string' || !row[key]) || typeof row.completed !== 'boolean' || !Number.isSafeInteger(row.rank) || Number(row.rank) < 0) return invalid();
  if (String(row.id).length > 250 || String(row.title).length > 250 || !String(row.title).trim() || !instant(String(row.createdAt)) || !instant(String(row.updatedAt))) return invalid();
  const task: Task = { id: row.id as string, title: row.title as string, createdAt: row.createdAt as string, updatedAt: row.updatedAt as string, completed: row.completed, rank: row.rank as number };
  for (const key of optional) {
    const value = row[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > (key === 'notes' ? 5000 : 1000)) return invalid();
    task[key] = value;
  }
  for (const key of ['focusDate', 'dueAt', 'completedOn'] as const) if (task[key] && !civil(task[key]!)) return invalid();
  for (const key of ['scheduledStart', 'scheduledEnd', 'completedAt'] as const) if (task[key] && !instant(task[key]!)) return invalid();
  if (Boolean(task.scheduledStart) !== Boolean(task.scheduledEnd) || (task.scheduledStart && Date.parse(task.scheduledEnd!) <= Date.parse(task.scheduledStart))) return invalid();
  if (task.completed && !task.completedAt && !task.completedOn) return invalid();
  return task;
}
export function decodeTaskBackup(text: string): Task[] {
  if (new TextEncoder().encode(text).length > TASK_BACKUP_LIMIT) return invalid();
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { return invalid(); }
  const data = value as { format?: string; version?: number; tasks?: unknown[] } | null;
  if (!data || data.format !== 'weekaboo.tasks' || data.version !== 1 || !Array.isArray(data.tasks) || data.tasks.length > 10000) return invalid();
  const tasks = data.tasks.map(backupTask);
  if (new Set(tasks.map(task => task.id)).size !== tasks.length) return invalid();
  return tasks;
}
export function encodeTaskBackup(tasks: Task[], now: Date) {
  const text = JSON.stringify({ format: 'weekaboo.tasks', version: 1, exportedAt: now.toISOString(), tasks: tasks.map(backupTask) }, null, 2);
  if (new TextEncoder().encode(text).length > TASK_BACKUP_LIMIT) throw new ServiceError('validation', 'These tasks exceed the backup size limit. Nothing has been removed.');
  return text;
}
/** Re-evaluate inside the transaction: a preview is never authority to overwrite. */
export function mergeTaskBackup(local: Task[], incoming: Task[]): { tasks: Task[]; summary: TaskImportSummary } {
  const existing = new Map(local.map(task => [task.id, task]));
  const summary = { added: 0, unchanged: 0, conflicts: 0 };
  const additions: Task[] = [];
  let rank = Math.max(-1, ...local.map(task => task.rank)) + 1;
  for (const task of [...incoming].sort((a, b) => a.rank - b.rank)) {
    const match = existing.get(task.id);
    if (!match) { additions.push({ ...task, rank: rank++ }); summary.added++; }
    // Rank is per-device list order; importing the same records must stay idempotent.
    else if (JSON.stringify({ ...backupTask(match), rank: 0 }) === JSON.stringify({ ...task, rank: 0 })) summary.unchanged++;
    else summary.conflicts++;
  }
  return { tasks: [...local, ...additions], summary };
}
