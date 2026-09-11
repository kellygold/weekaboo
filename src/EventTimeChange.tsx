import { useState } from 'react';
import { EditorSurface } from './EditorSurface';
import { useServices } from './services/context';
import { eventTarget } from './services/contracts';
import type { CalendarEvent } from './domain';
export type EventTimeDraft = { event: CalendarEvent; start: string; end: string; anchor: HTMLElement };
export function EventTimeChange({ draft, close, saved }: { draft: EventTimeDraft; close: () => void; saved: () => void }) {
  const { calendars: service } = useServices();
  const [error,setError] = useState('');
  const format = (value: string) => new Date(value).toLocaleString('en-AU',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
  async function save() {
    try {
      if (!draft.event.editable || draft.event.commandId === undefined) throw new Error('This calendar is read-only.');
      let start = draft.start, end = draft.end;
      if (draft.event.recurrenceRule) {
        const original = await service.getEvent(eventTarget(draft.event));
        // Apply the wall-clock shift to the series anchor rather than replacing it
        // with a materialised occurrence date. Keep the requested duration.
        const next = new Date(original.start), oldOccurrence = new Date(draft.event.start), newOccurrence = new Date(start);
        const oldDay = Date.UTC(oldOccurrence.getFullYear(), oldOccurrence.getMonth(), oldOccurrence.getDate());
        const newDay = Date.UTC(newOccurrence.getFullYear(), newOccurrence.getMonth(), newOccurrence.getDate());
        next.setDate(next.getDate() + Math.round((newDay-oldDay)/86400000));
        next.setMinutes(next.getMinutes() + newOccurrence.getHours()*60 + newOccurrence.getMinutes() - oldOccurrence.getHours()*60 - oldOccurrence.getMinutes());
        end = new Date(+next + (+new Date(draft.end)-+new Date(draft.start))).toISOString(); start=next.toISOString();
      }
      await service.updateEvent(eventTarget(draft.event), { start, end });
      saved(); return true;
    } catch(e) {setError((e as Error).message);return false;}
  }
  return <EditorSurface label="Change event time" title="A little adjustment" anchor={draft.anchor} close={close} dirty={false} save={save}>{({busy,submit}) => <><div className="composer-body detail-body"><h2 className="detail-title">{draft.event.title}</h2><p className="muted">{format(draft.event.start)} – {format(draft.event.end)}</p><div className="event-time-proposal"><strong>{format(draft.start)}</strong><span>to {format(draft.end)}</span></div><p>{draft.event.recurrenceRule ? 'This changes the whole repeating series.' : draft.event.recurring ? 'This changes only this occurrence.' : 'Save this time to the connected calendar?'}</p>{error && <p role="alert" className="composer-error">{error}</p>}</div><footer className="composer-footer"><button disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy} onClick={()=>void submit()}>{draft.event.recurrenceRule ? 'Save series time' : 'Save time'}</button></footer></>}</EditorSurface>;
}
