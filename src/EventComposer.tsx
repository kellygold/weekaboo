import { EventGuests } from './EventGuests';
import { RichNotesEditor } from './RichNotesEditor';
import { DateField } from './DateField';
import { EditorSurface, useAnchoredPosition } from './EditorSurface';
import { GrowingTextarea, RichText, descriptionLinks, isMeetingJoinLink, meetingName, safeUrl } from './DetailContent';
import { Select } from './Select';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock, MapPin, Video, ExternalLink, Pencil, Check, Maximize2, Minimize2, Trash2, X } from 'lucide-react';
import { addDays, dateKey, type Calendar, type CalendarEvent } from './domain';
import { useServices } from './services/context';
import { eventTarget, type EventChanges, type EventCreate } from './services/contracts';

function dateInput(value: string, allDay: boolean, end = false) {
  if (allDay) return dateKey(addDays(new Date(value.slice(0, 10) + 'T12:00:00'), end ? -1 : 0));
  const d = new Date(value);
  return `${dateKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function iso(value: string, allDay: boolean, end = false) {
  if (allDay) return `${dateKey(addDays(new Date(value.slice(0, 10) + 'T12:00:00'), end ? 1 : 0))}T00:00:00Z`;
  return new Date(value).toISOString();
}

export function EventComposer(props: {
  event?: CalendarEvent; calendars: Calendar[]; start: Date; end?: Date; close: () => void;
  saved: (message: string) => void; demo: boolean; anchor?: HTMLElement;
}) {
  const [editing, setEditing] = useState(!props.event);
  return editing ? <EventEditing {...props} /> : <EventDetails {...props} event={props.event!} edit={() => setEditing(true)} />;
}

function EventDetails({ event, calendars, close, saved, demo, anchor, edit }: {
  event: CalendarEvent; calendars: Calendar[]; close: () => void; saved: (message: string) => void;
  demo: boolean; anchor?: HTMLElement; edit: () => void;
}) {
  const { calendars: service } = useServices();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const calendar = calendars.find(c => c.id === event.calendarId);
  const writable = !demo && event.editable;
  const meeting = safeUrl(event.meetingUrl);
  const links = [...new Set([...(meeting ? [meeting] : []), ...descriptionLinks(event.location, event.description, event.sourceUrl).filter(isMeetingJoinLink)])];
  const source = safeUrl(event.sourceUrl);
  const starts = new Date(event.allDay ? event.start.slice(0, 10) + 'T12:00:00' : event.start);
  const ends = new Date(event.allDay ? dateInput(event.end, true, true) + 'T12:00:00' : event.end);
  const day = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  async function remove() {
    setBusy(true); setError('');
    try { await service.deleteEvent(eventTarget(event)); saved('Event removed · Calendar sync pending.'); close(); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <EditorSurface label="Event editor" title="Your event" anchor={anchor} dirty={false} close={() => { if (!busy) close(); }} save={async () => false} closeLabel="Close event editor">{() => <>
    <div className="composer-body detail-body">
      <div className="detail-calendar"><i style={{ background: calendar?.color || '#819b73' }} />{calendar?.name || 'Calendar'}{calendar?.accountEmail && calendar.accountEmail !== calendar.name && <small>{calendar.accountEmail}</small>}</div>
      <h2 className="detail-title">{event.title}</h2>
      <div className="detail-row"><Clock size={19} /><div><strong>{day(starts)}</strong><p>{event.allDay ? 'All day' : time(starts)}{dateKey(starts) !== dateKey(ends) ? ` – ${day(ends)}${event.allDay ? '' : `, ${time(ends)}`}` : !event.allDay ? ` – ${time(ends)}` : ''}</p>{!event.allDay && <small>{Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')}</small>}{event.recurring && <p className="muted">{event.recurrenceText || 'Repeating event'}</p>}</div></div>
      {links.length > 0 && <div className="meeting-actions">{links.map(link => <a key={link} href={link} className="meeting-link" target="_blank" rel="noopener noreferrer"><Video size={19} /><span>Join {meetingName(link) || 'meeting'}<small>{new URL(link).hostname}</small></span><ExternalLink size={15} /></a>)}</div>}
      {event.location && <section className="detail-row"><MapPin size={19} /><div><h3>Location</h3><div className="detail-location"><RichText text={event.location} /></div>{!descriptionLinks(event.location).length && <a className="detail-action" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener noreferrer">Open in Maps ↗</a>}</div></section>}
      {!!event.attendees?.length && <EventGuests guests={event.attendees} />}
      {event.description && <section className="detail-notes"><h3>About this event</h3><RichText text={event.description} /></section>}
      {source && !links.includes(source) && <a className="detail-action" href={source} target="_blank" rel="noopener noreferrer"><CalendarDays size={16} /> Open original event ↗</a>}
      {!writable && <p className="detail-hint">{demo ? 'Sample calendar' : 'Read-only calendar'}</p>}
      {error && <p className="composer-error" role="alert">{error}</p>}
    </div>
    {writable && <footer className="composer-footer">{confirm ? <><span>{event.recurrenceRule ? 'Delete this whole series?' : 'Delete this event?'}</span><button disabled={busy} onClick={() => setConfirm(false)}>Keep it</button><button className="danger" disabled={busy} onClick={() => void remove()}>Delete event</button></> : <><button className="icon" aria-label="Delete event" onClick={() => setConfirm(true)}><Trash2 size={17} /></button><span className="composer-spacer" /><button className="primary" onClick={edit}><Pencil size={16} /> Edit event</button></>}</footer>}
  </>}</EditorSurface>;
}

function EventEditing({ event, calendars, start, end, close, saved, demo, anchor }: {
  event?: CalendarEvent; calendars: Calendar[]; start: Date; end?: Date; close: () => void;
  saved: (message: string) => void; demo: boolean; anchor?: HTMLElement;
}) {
  const { calendars: service } = useServices();
  const [original, setOriginal] = useState<CalendarEvent | undefined>(event?.recurrenceRule ? undefined : event);
  const [loading, setLoading] = useState(Boolean(event?.recurrenceRule));
  const [failure, setFailure] = useState('');
  useEffect(() => {
    let cancelled = false;
    // iCloud occurrences share the series id. Edit its actual anchor, not the
    // displayed occurrence date, or saving would erase the earlier series.
    if (event?.recurrenceRule && event.commandId !== undefined) {
      service.getEvent(eventTarget(event)).then(row => { if (!cancelled) { setOriginal(row); setLoading(false); } })
        .catch(error => { if (!cancelled) setFailure(error.message); });
    }
    return () => { cancelled = true; };
  }, [event]);
  if (loading) return createPortal(<aside className="event-composer composer-loading" aria-label="Event editor"><button className="icon" aria-label="Close event editor" onClick={close}><X size={18} /></button><p>{failure || 'Opening the repeating event…'}</p></aside>, document.body);
  return <EventForm event={original} calendars={calendars} start={start} end={end} close={close} saved={saved} demo={demo} anchor={anchor} />;
}

function EventForm({ event, calendars, start: defaultStart, end: defaultEnd, close, saved, demo, anchor }: {
  event?: CalendarEvent; calendars: Calendar[]; start: Date; end?: Date; close: () => void; saved: (message: string) => void; demo: boolean; anchor?: HTMLElement;
}) {
  const { calendars: service } = useServices();
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const closingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panel = useRef<HTMLElement>(null);
  const position = useAnchoredPosition(panel, anchor, expanded);
  const [title, setTitle] = useState(event?.title || '');
  const choices = calendars.filter(calendar => calendar.writable && calendar.enabled !== false);
  const [calendarId, setCalendarId] = useState(event?.calendarId || choices[0]?.id || '');
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [start, setStart] = useState(dateInput(event?.start || defaultStart.toISOString(), event?.allDay || false));
  const [end, setEnd] = useState(dateInput(event?.end || (defaultEnd || new Date(+defaultStart + 3600000)).toISOString(), event?.allDay || false, true));
  const [location, setLocation] = useState(event?.location || '');
  const [description, setDescription] = useState(event?.editableDescription ?? event?.description ?? '');
  const [rule, setRule] = useState(event?.recurrenceRule || '');
  const provider = calendars.find(calendar => calendar.id === calendarId)?.provider;

  const readOnly = demo || (event ? !event.editable : !choices.length);
  const [dirty, setDirty] = useState(false);
  const baseline = useRef({ title, calendarId, allDay, start, end, location, description, rule }).current;
  const dismiss = () => {
    if (busy) return;
    setLeaving(true);
    closingTimer.current = setTimeout(close, 160);
  };
  const requestClose = () => { if (dirty && !readOnly) setConfirmClose(true); else dismiss(); };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (!event) panel.current?.querySelector<HTMLInputElement>('input')?.focus();
    else panel.current?.focus();
    return () => { if (closingTimer.current) clearTimeout(closingTimer.current); if (previous?.isConnected) previous.focus(); };
  }, []);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (panel.current?.contains(event.target as Node) || busy || leaving) return;
      if (dirty && !readOnly) { event.preventDefault(); event.stopImmediatePropagation(); setConfirmClose(true); }
      else dismiss();
    };
    document.addEventListener('pointerdown', outside, true);
    const blockDirtyClick = (event: MouseEvent) => { if (dirty && !panel.current?.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    document.addEventListener('click', blockDirtyClick, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('click', blockDirtyClick, true); };
  }, [dirty, busy, leaving, readOnly]);

  function setTimed(next: boolean) {
    setAllDay(next);
    setStart(next ? start.slice(0, 10) : `${start.slice(0, 10)}T09:00`);
    setEnd(next ? end.slice(0, 10) : `${end.slice(0, 10)}T10:00`);
  }
  async function submit() {
    if (busy || readOnly || panel.current?.querySelector("form")?.reportValidity() === false) return;
    setError('');
    try {
      if (!title.trim()) throw new Error('Give the event a title.');
      if (!calendarId) throw new Error('Choose a writable calendar.');
      const begins = iso(start, allDay); const ends = iso(end, allDay, true);
      if (new Date(ends) <= new Date(begins)) throw new Error('The end must be after the start.');
      const body: EventChanges = {};
      if (!event) Object.assign(body, { title: title.trim(), start: begins, end: ends, allDay: allDay, location: location || null, description: description || null, recurrenceRule: rule || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      else {
        if (title !== baseline.title) body.title = title.trim();
        if (start !== baseline.start || allDay !== baseline.allDay) body.start = begins;
        if (end !== baseline.end || allDay !== baseline.allDay) body.end = ends;
        if (allDay !== baseline.allDay) body.allDay = allDay;
        if (location !== baseline.location) body.location = location || null;
        if (description !== baseline.description) body.description = description || null;
        if (rule !== baseline.rule) body.recurrenceRule = rule || null;
      }
      setBusy(true);
      const result = await (event ? service.updateEvent(eventTarget(event), body) : service.createEvent({ ...body, calendarId } as EventCreate));
      setDirty(false); saved(result.syncState === 'synced' ? 'Event saved.' : 'Event saved · Calendar sync pending.');
      setLeaving(true); closingTimer.current = setTimeout(close, 160);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save this event.'); setBusy(false); }
  }
  async function remove() {
    if (!event || busy || readOnly) return;
    setBusy(true); setError('');
    try {
      await service.deleteEvent(eventTarget(event));
      saved('Event removed · Connected calendars update when sync completes.');
      setLeaving(true); closingTimer.current = setTimeout(close, 160);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete this event.'); setBusy(false); }
  }
  const repeats = ['', 'FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY', 'FREQ=YEARLY'];
  return createPortal(<aside ref={panel} tabIndex={-1} className={`event-composer ${expanded ? 'is-expanded' : ''} ${leaving ? 'is-leaving' : ''}`} aria-label="Event editor" style={position} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); requestClose(); } }}>
    <header className="composer-header"><span>{event ? 'Your event' : 'Something to look forward to'}</span><div><button className="icon" aria-label={expanded ? 'Collapse editor' : 'Expand editor'} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button><button className="icon" aria-label="Close event editor" disabled={busy} onClick={requestClose}><X size={19} /></button></div></header>
    <form onSubmit={e => { e.preventDefault(); void submit(); }} onChange={() => setDirty(true)}>
      <div className="composer-body"><GrowingTextarea className="composer-title" aria-label="Event title" placeholder="Give it a name…" value={title} maxLength={500} onChange={e => setTitle(e.target.value)} disabled={readOnly || busy} />
        {readOnly && <p className="composer-note">{demo ? 'Sample event. Connected calendars support editing.' : 'This calendar is read-only in its source account.'}</p>}
        {event?.recurrenceRule && <p className="composer-note">Editing the whole repeating series. Dates below show its original start.</p>}
        {event?.recurring && !event.recurrenceRule && <p className="composer-note">Changes apply to this occurrence only.</p>}
        <fieldset disabled={readOnly || busy}>
          <label>Calendar<Select label="Event calendar" value={calendarId} disabled={Boolean(event)} onChange={v => { setCalendarId(v); setDirty(true); }} options={(event ? calendars.filter(c => c.id === event.calendarId) : choices).map(c => ({ value: c.id, label: `${c.name}${c.accountEmail ? ` · ${c.accountEmail}` : ''}` }))} /></label>
          <label className="composer-checkbox"><input type="checkbox" checked={allDay} onChange={e => setTimed(e.target.checked)} /> All day</label>
          <div className="composer-dates"><label>Starts<DateField label="Event starts" required timed={!allDay} value={start} onChange={value => { setStart(value); setDirty(true); }} /></label><label>Ends<DateField label="Event ends" required timed={!allDay} value={end} onChange={value => { setEnd(value); setDirty(true); }} /></label></div>
          <label>Repeats<Select label="Event repeats" value={rule} disabled={Boolean(event?.recurring && !event.recurrenceRule)} onChange={v => { setRule(v); setDirty(true); }} options={[...repeats.map((r, i) => ({ value: r, label: ['Does not repeat', 'Every day', 'Every week', 'Every month', 'Every year'][i] })), ...(rule && !repeats.includes(rule) ? [{ value: rule, label: 'Custom repeat (kept as saved)' }] : [])]} /></label>
          <label>Location<GrowingTextarea aria-label="Location" value={location} maxLength={500} onChange={e => setLocation(e.target.value)} placeholder="Add a place" /></label>
          <RichNotesEditor initialValue={baseline.description} plain={provider === 'icloud'} disabled={readOnly || busy} onChange={value => { setDescription(value); setDirty(true); }} />
        </fieldset>
        {error && <p className="composer-error" role="alert">{error}</p>}
      </div>
      <footer className="composer-footer">
        {confirmClose ? <><span>You have unsaved changes.</span><button type="button" onClick={() => setConfirmClose(false)}>Keep editing</button><button type="button" onClick={dismiss}>Discard</button><button type="button" className="primary" disabled={busy || !title.trim()} onClick={() => void submit()}>Save changes</button></> : confirmDelete ? <><span>{event?.recurrenceRule ? 'Delete this whole series?' : 'Delete this event?'}</span><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep it</button><button type="button" className="danger" disabled={busy} onClick={() => void remove()}>Delete event</button></> : <>{event && !readOnly && <button type="button" className="icon" aria-label="Delete event" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={17} /></button>}<span className="composer-spacer" />{!readOnly && <button type="submit" className="primary" disabled={busy || !title.trim()}><Check size={17} />{busy ? 'Saving…' : 'Save event'}</button>}</>}
      </footer>
    </form>
  </aside>, document.body);
}
