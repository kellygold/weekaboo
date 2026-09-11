import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useServices } from './services/context';
import type { TaskImportSummary } from './services/task-backup';
import { dateKey } from './domain';

export function TaskBackupSettings({ changed }: { changed: () => Promise<void> }) {
  const { tasks, files } = useServices();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [pending, setPending] = useState<{ contents: string; summary: TaskImportSummary }>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setStatus('');
    try { await work(); } catch (error) { setError(error instanceof Error ? error.message : 'The file operation could not be completed.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="task-backup-settings" aria-label="Task backups"><h3>Your tasks, on your devices</h3>
    <p className="muted">Save a backup or bring tasks from another device. This transfers a copy; changes do not sync automatically. Accounts and passwords are never included.</p>
    <div className="task-backup-actions"><button disabled={busy} onClick={() => void run(async () => {
      if (await files.save({ name: `weekaboo-tasks-${dateKey(new Date())}.json`, contents: await tasks.exportBackup() })) setStatus('Backup sent to your file destination.');
    })}><Download size={16} /> Export tasks</button><button disabled={busy} onClick={() => void run(async () => {
      setPending(undefined); const contents = await files.pick();
      if (contents !== null) setPending({ contents, summary: await tasks.previewImport(contents) });
    })}><Upload size={16} /> Import tasks</button></div>
    {pending && <div className="task-backup-preview"><p><strong>{pending.summary.added} tasks to add</strong> · {pending.summary.unchanged} already here · {pending.summary.conflicts} different versions</p><p className="muted">Existing tasks stay as they are, including any different versions. Imported tasks are added after your current list, with their dates and completion history.</p><div className="task-backup-actions"><button disabled={busy} onClick={() => setPending(undefined)}>Cancel import</button><button className="primary" disabled={busy || pending.summary.added === 0} onClick={() => void run(async () => {
      const result = await tasks.importBackup(pending.contents); setPending(undefined);
      await changed(); setStatus(`Added ${result.added} tasks. Kept ${result.conflicts} different existing versions.`);
    })}>Add tasks</button></div></div>}
    {status && <p role="status">{status}</p>}{error && <p className="composer-error" role="alert">{error}</p>}
  </section>;
}
