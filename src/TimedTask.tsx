import { useRef, useState, type CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Check, Circle } from 'lucide-react';
import type { Task, TaskChanges } from './domain';
import { resizeTask, taskTimeRange } from './task-scheduling';

export function TimedTask({ task, style, hourHeight, open, update }: {
  task: Task; style: CSSProperties; hourHeight: number;
  open: (anchor: HTMLElement) => void; update: (changes: TaskChanges) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `scheduled:${task.id}`, data: { taskId: task.id }, disabled: task.completed });
  const drag = useRef<{ y: number; edge: 'start' | 'end'; changes: TaskChanges } | undefined>(undefined);
  const [preview, setPreview] = useState<TaskChanges>();
  const shown = { ...task, ...preview };
  const topDelta = preview ? (+new Date(shown.scheduledStart!) - +new Date(task.scheduledStart!)) / 3600000 * hourHeight : 0;
  const endDelta = preview ? (+new Date(shown.scheduledEnd!) - +new Date(task.scheduledEnd!)) / 3600000 * hourHeight : 0;
  return <div ref={setNodeRef} className={`event scheduled-task ${task.completed ? 'is-done' : ''} ${isDragging ? 'is-dragging' : ''} ${preview ? 'is-resizing-task' : ''}`} data-task-id={task.id} style={{ ...style, top: Number(style.top) + topDelta, height: Math.max(0, Number(style.height) + endDelta - topDelta) }}>
    <button className="scheduled-task-content" aria-label={`Open scheduled task ${task.title}`} title={`${task.title} · ${taskTimeRange(shown)}`} {...attributes} {...listeners} onClick={e => open(e.currentTarget)}>{task.completed ? <Check size={12} /> : <Circle size={12} />}<span>{task.title}</span><small>{taskTimeRange(shown)}</small></button>
    {!task.completed && (['start', 'end'] as const).map(edge => <button key={edge} className={`task-resize task-resize-${edge}`} aria-label={`Resize ${edge} of ${task.title}`} title={`Drag to change ${edge} · 15-minute steps`} onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, edge, changes: {} }; }} onPointerMove={e => { if (!drag.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return; const changes = resizeTask(task, edge, (e.clientY - drag.current.y) / hourHeight * 60); drag.current.changes = changes; setPreview(changes); }} onPointerUp={e => { if (!drag.current) return; const changes = drag.current.changes; drag.current = undefined; setPreview(undefined); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); if (changes.scheduledStart) update(changes); }} onPointerCancel={() => { drag.current = undefined; setPreview(undefined); }} onLostPointerCapture={() => { drag.current = undefined; setPreview(undefined); }} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); update(resizeTask(task, edge, e.key === 'ArrowUp' ? -15 : 15)); } }}><span /></button>)}
    {preview && <output className="task-resize-time">{taskTimeRange(shown)}</output>}
  </div>;
}
