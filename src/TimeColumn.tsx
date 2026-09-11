import { useRef, useState, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

export function TimeColumn({ date, from, to, hourHeight, today, children, create }: {
  date: string; from: number; to: number; hourHeight: number; today: boolean; children: ReactNode;
  create?: (start: Date, end: Date, anchor: HTMLElement) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:timed:${date}`, data: { date, zone: 'timed' } });
  const drag = useRef<{ start: number; pointer: number } | undefined>(undefined);
  const [selection, setSelection] = useState<{ start: number; end: number }>();
  const minute = (y: number, node: HTMLElement) => Math.max(from*60, Math.min(to*60, Math.round((from*60+(y-node.getBoundingClientRect().top)/hourHeight*60)/15)*15));
  const range = (first: number, last: number) => ({ start: Math.min(first,last,to*60-15), end: Math.min(to*60,Math.max(Math.min(first,last)+15,first,last)) });
  const at = (minutes: number) => { const day=new Date(`${date}T00:00:00`); day.setMinutes(minutes); return day; };
  const time = (minutes: number) => at(minutes).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});
  return <div ref={setNodeRef} data-date={date} className={`day-column ${today?'is-today':''} ${isOver?'task-drop-target':''}`} onPointerDown={e => {
    // Touch remains available for scrolling/pinching; existing events own their gestures.
    if (!create || e.pointerType === 'touch' || e.button !== 0 || e.target !== e.currentTarget) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const start=minute(e.clientY,e.currentTarget); drag.current={start,pointer:e.pointerId}; setSelection(range(start,start));
  }} onPointerMove={e => { if(drag.current?.pointer===e.pointerId) setSelection(range(drag.current.start,minute(e.clientY,e.currentTarget))); }} onPointerUp={e => {
    if(drag.current?.pointer!==e.pointerId) return;
    const picked=range(drag.current.start,minute(e.clientY,e.currentTarget)); drag.current=undefined; setSelection(undefined); e.currentTarget.releasePointerCapture(e.pointerId); create?.(at(picked.start),at(picked.end),e.currentTarget);
  }} onPointerCancel={() => {drag.current=undefined;setSelection(undefined);}} onLostPointerCapture={() => {drag.current=undefined;setSelection(undefined);}}>
    {children}
    {selection && <div className="event-draft-range" style={{top:(selection.start/60-from)*hourHeight,height:(selection.end-selection.start)/60*hourHeight}}><span>{time(selection.start)} – {time(selection.end)}</span></div>}
  </div>;
}
