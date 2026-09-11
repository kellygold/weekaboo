import { DateField } from './DateField';
import { useState } from 'react';
import { Check, Circle, Pencil, Clock, CalendarDays, Trash2 } from 'lucide-react';
import { EditorSurface } from './EditorSurface';
import { GrowingTextarea, RichText } from './DetailContent';
import { dateKey, type Task, type TaskChanges } from './domain';
import { taskTimeRange, taskDrop } from './task-scheduling';

function localInput(value?: string) {
  if (!value) return '';
  const date = new Date(value); return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function TaskEditor({ task, close, save, remove, today, anchor }: {
  task: Task; remove: () => Promise<boolean>; close: () => void; save: (changes: TaskChanges) => Promise<boolean>; today: string; anchor?: HTMLElement;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || '');
  const [dueAt, setDueAt] = useState(task.dueAt || '');
  const [plannedDay, setPlannedDay] = useState(task.focusDate || '');
  const [scheduledStart, setStart] = useState(localInput(task.scheduledStart));
  const [scheduledEnd, setEnd] = useState(localInput(task.scheduledEnd));
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [working, setWorking] = useState(false);
  const dirty = title !== task.title || notes !== (task.notes || '') || dueAt !== (task.dueAt || '') || plannedDay !== (task.focusDate || '') || scheduledStart !== localInput(task.scheduledStart) || scheduledEnd !== localInput(task.scheduledEnd);
  const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  async function submitChanges() {
    setError('');
    if (scheduledStart && (!Number.isFinite(+new Date(scheduledStart)) || !Number.isFinite(+new Date(scheduledEnd)) || +new Date(scheduledEnd) - +new Date(scheduledStart) < 15 * 60000)) { setError('Give this task at least 15 minutes, with the end after the start.'); return false; }
    return save({ title, notes: notes || undefined, dueAt: dueAt || undefined, focusDate: scheduledStart ? scheduledStart.slice(0, 10) : plannedDay || undefined, scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : undefined, scheduledEnd: scheduledStart ? new Date(scheduledEnd).toISOString() : undefined });
  }
  async function quick(changes: TaskChanges) { if (working) return; setWorking(true); if (await save(changes)) close(); setWorking(false); }
  function assignDay(day: string) {
    setPlannedDay(day);
    if (scheduledStart && day) { const old = new Date(scheduledStart); const validStart = Number.isFinite(+old); const end = new Date(scheduledEnd); const block = taskDrop(day, validStart ? old.getHours() * 60 + old.getMinutes() : 9 * 60, validStart && Number.isFinite(+end) ? { ...task, scheduledStart: old.toISOString(), scheduledEnd: end.toISOString() } : undefined); setStart(localInput(block.scheduledStart)); setEnd(localInput(block.scheduledEnd)); }
    else if (!day) { setStart(''); setEnd(''); }
  }
  return <EditorSurface label="Task editor" title={task.completed ? 'A little win' : 'Your task'} anchor={anchor} dirty={dirty} close={close} save={submitChanges}>{({ busy, submit }) => editing ? <form onSubmit={e => { e.preventDefault(); void submit(); }}><div className="composer-body detail-body"><fieldset disabled={busy}>
    <label className="sr-only" htmlFor={`task-title-${task.id}`}>Task</label><GrowingTextarea id={`task-title-${task.id}`} className="composer-title" autoFocus required maxLength={250} value={title} onChange={e => setTitle(e.target.value)} />
    <label>Notes<GrowingTextarea aria-label="Notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} placeholder="A link, a thought, something to remember…" /></label>
    <details className="task-schedule-options" open={Boolean(plannedDay || scheduledStart || dueAt)}><summary><Clock size={16} /> A little time for it <small>Optional</small></summary>
      <label className="composer-checkbox"><input type="checkbox" disabled={task.completed} checked={plannedDay === today} onChange={e => assignDay(e.target.checked ? today : '')} /> Pick for today</label>
      <label>On calendar<DateField label="On calendar" disabled={task.completed} value={plannedDay} onChange={assignDay} /></label>
      <label className="composer-checkbox"><input type="checkbox" disabled={task.completed} checked={Boolean(scheduledStart)} onChange={e => { if (!e.target.checked) { setStart(''); setEnd(''); } else { const block = taskDrop(plannedDay || today, 9 * 60); setPlannedDay(plannedDay || today); setStart(localInput(block.scheduledStart)); setEnd(localInput(block.scheduledEnd)); } }} /> Set aside some time</label>
      {scheduledStart && <div className="composer-dates"><label>Task starts<DateField label="Task starts" timed required disabled={task.completed} value={scheduledStart} onChange={value => { setStart(value); setPlannedDay(value.slice(0, 10)); }} /></label><label>Task ends<DateField label="Task ends" timed required disabled={task.completed} value={scheduledEnd} onChange={setEnd} /></label></div>}
      <label>Due date <small>Only if there's a deadline</small><DateField label="Due date" value={dueAt} onChange={setDueAt} /></label>
    </details>
    {error && <p className="composer-error" role="alert">{error}</p>}
  </fieldset></div><footer className="composer-footer"><span className="composer-spacer" /><button className="primary" disabled={busy || !title.trim()}>Save task</button></footer></form> : <>
    <div className="composer-body detail-body">
      <p className="detail-eyebrow">{task.completed ? 'Completed' : 'A thing to do'}</p><h2 className={`detail-title ${task.completed ? 'task-done-title' : ''}`}>{task.title}</h2>
      {task.completed ? <p className="task-completed-summary"><Check size={18} /> Done {dayLabel(task.completedOn || dateKey(new Date(task.completedAt!)))}</p> : task.scheduledStart ? <div className="task-schedule-summary"><Clock size={18} /><div><strong>{dayLabel(dateKey(new Date(task.scheduledStart)))}</strong><p>{taskTimeRange(task)}</p><small>Time set aside · still a task</small></div><button disabled={working} onClick={() => void quick({ scheduledStart: undefined, scheduledEnd: undefined })}>Anytime</button></div> : task.focusDate ? <div className="task-schedule-summary"><CalendarDays size={18} /><span>{dayLabel(task.focusDate)} · Anytime</span><button disabled={working} onClick={() => void quick({ focusDate: undefined })}>Unplan</button></div> : <p className="detail-hint">No date needed. It's on your list.</p>}
      {task.dueAt && <p className="task-due-summary">Due {dayLabel(task.dueAt)}</p>}
      {task.notes ? <section className="detail-notes"><h3>Notes &amp; little reminders</h3><RichText text={task.notes} plain /></section> : <button className="detail-action" onClick={() => setEditing(true)}>Add a note</button>}
    </div><footer className="composer-footer"><button className="icon" aria-label="Delete task" disabled={working} onClick={() => setDeleting(true)}><Trash2 size={17} /></button><button aria-label="Edit task details" onClick={() => setEditing(true)}><Pencil size={16} /> Edit</button><span className="composer-spacer" /><button className="primary" disabled={working} onClick={() => void quick({ completed: !task.completed })}>{task.completed ? <Circle size={17} /> : <Check size={17} />}{task.completed ? 'Bring back' : 'Mark done'}</button></footer>
    {deleting && <footer className="composer-footer" role="group" aria-label="Confirm task deletion"><span>Delete this task from this device?</span><button disabled={working} onClick={() => setDeleting(false)}>Keep task</button><button disabled={working} onClick={async () => { if (working) return; setWorking(true); if (await remove()) close(); setWorking(false); }}>Delete permanently</button></footer>}
  </>}</EditorSurface>;
}
