import { useMascotSound } from './useMascotSound';
import { createId } from './id';
import { mascotSounds } from './mascotSounds';
import { EventTimeChange, type EventTimeDraft } from './EventTimeChange';
import { ScheduleView } from './ScheduleView';
import { CalendarEventCard } from './CalendarEventCard';
import { TimeColumn } from './TimeColumn';
import { TaskEditor } from './TaskEditor';
import { TimedTask } from './TimedTask';
import { scheduledTaskEvent, taskDrop, taskTimeRange } from './task-scheduling';
import { MonthView, DayAgenda, AnytimeDay } from './CalendarViews';
import React, { useEffect, useRef, useState } from 'react';
import { DndContext, DragOverlay, pointerWithin, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Circle, GripVertical, Plus, Settings, Star, X } from 'lucide-react';
import { addDays, dateKey, type Calendar, type CalendarEvent, type Task, type TaskChanges } from './domain';
import { useServices } from './services/context';
import { layoutDay, visibleHours } from './event-layout';
import { calendarDays, navigateDate, viewLabels, type CalendarView } from './calendar-range';
import { CalendarToolbar, CalendarDrawer, AppearanceSettings, PanelDivider, defaultGroups, type CalendarGroup, type DisplayCalendar } from './CalendarControls';
import { AccountSetup } from './AccountSetup';
import { CalendarRefresh } from './CalendarRefresh';
import { useCalendarZoom, useCalendarFit } from './CalendarInteractions';
import { EventComposer } from './EventComposer';
import './style.css';
import './event-composer.css';
import './calendar-controls.css';
import './app-shell.css';

// Keep the legacy storage key so existing calendar visibility and groups survive upgrades.
const preferencesKey = (demo: boolean) => demo ? 'weekydinky-demo-calendars' : 'weekydinky-mantel-calendars';
type CalendarPreferences = Record<string, { color?: string; scope?: string; hidden?: boolean }>;
function readPreferences(demo: boolean): CalendarPreferences {
  try { return JSON.parse(localStorage.getItem(preferencesKey(demo)) || '{}') || {}; } catch { return {}; }
}
const time = (date: Date) => date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
const shortDate = (date: Date) => date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

function TaskRow({ task, index, update, edit, today, disabled }: { task: Task; index: number; update: (id: string, changes: TaskChanges) => void; edit: (anchor: HTMLElement) => void; today: string; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: disabled || task.completed });
  return <li ref={setNodeRef} className={`task-row ${isDragging ? 'dragging' : ''} ${task.completed ? 'completed' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }} data-task-id={task.id}>
    <button className="check-task icon" aria-label={`${task.completed ? 'Restore' : 'Complete'} ${task.title}`} onClick={() => update(task.id, { completed: !task.completed })} disabled={disabled}>{task.completed ? <Check /> : <Circle />}</button>
    <button className="task-content" onClick={e => edit(e.currentTarget)} aria-label={`Edit ${task.title}`}><span>{task.title}</span><small>{task.focusDate === today && <Star size={11} fill="currentColor" />}{task.scheduledStart && !task.completed ? `${shortDate(new Date(task.scheduledStart))} · ${taskTimeRange(task)}` : task.dueAt ? `Due ${shortDate(new Date(task.dueAt + 'T12:00:00'))}` : task.focusDate === today ? 'Picked for today' : task.focusDate ? `Planned ${shortDate(new Date(task.focusDate + 'T12:00:00'))}` : `No date · #${index + 1}`}</small></button>
    {!task.completed && <button className="drag-handle icon" aria-label={`Reorder ${task.title}`} {...attributes} {...listeners} disabled={disabled}><GripVertical size={19} /></button>}
  </li>;
}

export function App({ demo }: { demo: boolean }) {
  const { calendars: provider, lifecycle, tasks: repository } = useServices();
  const mascotSound = useMascotSound(mascotSounds);
  const [timeDraft, setTimeDraft] = useState<EventTimeDraft>();
  const [schedule, setSchedule] = useState(() => localStorage.getItem('weekaboo-schedule') === 'true');
  function toggleSchedule() { setSchedule(value => { localStorage.setItem('weekaboo-schedule', String(!value)); return !value; }); }
  const [eventDraft, setEventDraft] = useState<{ start: Date; end: Date }>();
  const [brandReplay, setBrandReplay] = useState(0);
  const [now, setNow] = useState(new Date());
  const [focusDate, setFocusDate] = useState<Date>();
  const [calendarView, setCalendarView] = useState<CalendarView>(() => {
    try { const saved = localStorage.getItem('weekydinky-view'); return saved && saved in viewLabels ? saved as CalendarView : 'week'; } catch { return 'week'; }
  });
  const [taskWidth, setTaskWidth] = useState(() => {
    try { return Math.min(45, Math.max(20, Number(localStorage.getItem('weekydinky-task-width')) || 29)); } catch { return 29; }
  });
  const [scope, setScope] = useState('personal');
  const [removeAccountId, setRemoveAccountId] = useState<string>();
  const [accountSetup, setAccountSetup] = useState(new URLSearchParams(location.search).has('accounts'));
  const [fontSize, setFontSize] = useState(() => Math.max(11, Math.min(18, Number(localStorage.getItem('weekaboo-font-size')) || 13)));
  const [preferredHourHeight, setHourHeight] = useState(() => Math.max(12, Math.min(180, Number(localStorage.getItem('weekaboo-hour-height')) || 48)));
  const [draggedTask, setDraggedTask] = useState<string>();
  const dropPointer = useRef<{ x: number; y: number } | null>(null);
  const [dropPreview, setDropPreview] = useState<{ date: string; start: number; title: string }>();
  const scrollRef = useRef<HTMLDivElement>(null);
  function changeFontSize(value: number) { setFontSize(value); localStorage.setItem('weekaboo-font-size', String(value)); }
  function changeHourHeight(value: number) { setHourHeight(value); localStorage.setItem('weekaboo-hour-height', String(value)); }
  const [drawer, setDrawer] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [groups, setGroups] = useState<CalendarGroup[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem('weekydinky-groups') || 'null'); return Array.isArray(saved) && saved.length ? saved : defaultGroups; } catch { return defaultGroups; }
  });
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState('Loading calendars…');
  const [calendarLoading, setCalendarLoading] = useState(true);
  const refreshCalendars = useRef<() => void>(() => {});
  const [refreshVersion, setRefreshVersion] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const [preferences, setPreferences] = useState<CalendarPreferences>(() => readPreferences(demo));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'backlog' | 'today' | 'done'>('backlog');
  const [tasksVisible, setTasksVisible] = useState(true);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<string>();
  const [taskAnchor, setTaskAnchor] = useState<HTMLElement>();
  const [editorSession, setEditorSession] = useState(0);
  function openTask(id: string, anchor: HTMLElement) { setEditorSession(v => v + 1); setTaskAnchor(anchor); setEditing(id); }
  const [agenda, setAgenda] = useState<{ day: Date; anchor: HTMLElement }>();
  function openDay(day: Date) { setFocusDate(day); changeCalendarView('day'); }
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent>();
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventAnchor, setEventAnchor] = useState<HTMLElement>();
  function openEvent(event: CalendarEvent, anchor: HTMLElement) {
    setEditorSession(v => v + 1); setCreatingEvent(false); setEventAnchor(anchor); setSelectedEvent(event);
  }
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const today = dateKey(now);
  const focus = focusDate || now;
  const days = calendarDays(focus, calendarView);
  const shownDays = schedule && calendarView === 'month' ? days.filter(day => day.getMonth() === focus.getMonth()) : days;
  const start = days[0];
  const rangeEnd = addDays(days[days.length - 1], 1);
  const rangeKey = `${dateKey(start)}:${dateKey(rangeEnd)}`;
  function changeCalendarView(next: CalendarView) {
    setCalendarView(next);
    try { localStorage.setItem('weekydinky-view', next); } catch { /* View still works without storage. */ }
  }
  function resizeTasks(width: number) {
    setTaskWidth(width);
    try { localStorage.setItem('weekydinky-task-width', String(width)); } catch { /* Resizing still works without storage. */ }
  }

  useEffect(() => { const interval = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(interval); }, []);
  useEffect(() => {
    repository.list().then(data => { setTasks(data); setReady(true); }).catch(() => setError('Task storage could not be opened. Check browser storage permissions and reload.'));
    const refresh = () => { repository.list().then(setTasks).catch(() => setError('Tasks could not be refreshed.')); };
    const unsubscribe = lifecycle.subscribe(active => { if (active) { setNow(new Date()); refresh(); } });
    return unsubscribe;
  }, []);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    // Retain already-fetched events while loading. Each view still filters by
    // date, so overlapping days remain useful without showing a blank flash.
    const refresh = async (force = false) => {
      if (cancelled || inFlight) return;
      inFlight = true;
      setCalendarLoading(true);
      try {
        if (force && !demo) await provider.refresh();
        const nextEvents = await provider.listEvents({ start, end: rangeEnd });
        // Native reads can update account health; show metadata from that same
        // completed read instead of racing a pre-sync status snapshot.
        const nextCalendars = await provider.listCalendars();
        if (!cancelled) {
          setCalendars(nextCalendars); setEvents(nextEvents);
          setCalendarStatus(demo ? 'Sample calendars' : nextEvents.some(event => event.syncState === 'cached')
            ? 'Showing saved events · Calendar sync needs attention'
            : nextCalendars.some(calendar => calendar.syncError)
            ? 'Calendar sync needs attention · Open account settings'
            : `Calendar data refreshed ${time(new Date())}`);
        }
      } catch {
        if (!cancelled) setCalendarStatus('Calendar service unavailable · Display may be out of date');
      } finally {
        inFlight = false;
        if (!cancelled) setCalendarLoading(false);
      }
    };
    refreshCalendars.current = () => { void refresh(true); };
    void refresh();
    const interval = setInterval(() => { if (lifecycle.isActive()) void refresh(); }, 60000);
    const unsubscribe = lifecycle.subscribe(active => { if (active) void refresh(); });
    return () => { cancelled = true; clearInterval(interval); unsubscribe(); };
  }, [rangeKey, refreshVersion]);
  function savePreference(id: string, change: CalendarPreferences[string]) {
    if (!demo && (change.color || change.scope)) void provider.configure(id, { color: change.color, scope: change.scope }).catch(() => setError('Calendar settings could not be saved to the service.'));

    const next = { ...preferences, [id]: { ...preferences[id], ...change } };
    try { localStorage.setItem(preferencesKey(demo), JSON.stringify(next)); setPreferences(next); }
    catch { setError('Calendar preferences could not be saved in this browser.'); }
  }

  function addGroup(name: string) {
    const clean = name.trim();
    if (!clean || groups.some(group => group.name.toLowerCase() === clean.toLowerCase())) {
      setError('Choose a unique group name.'); return false;
    }
    const next = [...groups, { id: createId(), name: clean }];
    try { localStorage.setItem('weekydinky-groups', JSON.stringify(next)); setGroups(next); return true; }
    catch { setError('Groups could not be saved in this browser.'); return false; }
  }
  async function syncCalendar(calendar: DisplayCalendar, enabled: boolean) {
    try {
      if (!demo) await provider.configure(calendar.id, { enabled });
      setCalendars(rows => rows.map(row => row.id === calendar.id ? { ...row, enabled } : row));
      setRefreshVersion(v => v + 1);
      return true;
    } catch { setError('The calendar sync setting could not be saved. Please try again.'); return false; }
  }
  async function toggleCalendar(calendar: DisplayCalendar, visible: boolean) {
    if (visible && calendar.enabled === false && !await syncCalendar(calendar, true)) return;
    savePreference(calendar.id, { hidden: !visible });
  }

  async function mutate(action: () => Promise<void>) {
    if (mutationLock.current) return false;
    mutationLock.current = true; setBusy(true); setError('');
    try { await action(); setTasks(await repository.list()); return true; }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save the change. Please try again.'); return false; }
    finally { mutationLock.current = false; setBusy(false); }
  }
  function update(id: string, changes: TaskChanges) {
    void mutate(() => repository.update(id, changes)).then(success => { if (success) setNotice(changes.completed ? 'Task completed. Kept on the calendar for today.' : 'Task saved.'); });
  }
  const active = tasks.filter(task => !task.completed);
  const completedDay = (task: Task) => task.completedOn || (task.completedAt ? dateKey(new Date(task.completedAt)) : '');
  const doneSince = dateKey(addDays(now, -6));
  const visibleTasks = tasks.filter(task => view === 'done' ? task.completed && completedDay(task) >= doneSince && completedDay(task) <= today : view === 'today' ? task.completed ? completedDay(task) === today : task.focusDate === today : !task.completed)
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.completed && b.completed ? (b.completedAt || '').localeCompare(a.completedAt || '') : a.rank - b.rank));
  const shownTasks = visibleTasks;
  const displayCalendars = calendars.map(calendar => ({ ...calendar, ...preferences[calendar.id] }));
  const visibleCalendars = displayCalendars.filter(calendar => !calendar.hidden && calendar.enabled !== false && (scope === 'all' || calendar.scope === scope));
  const visibleEvents = events.filter(event => visibleCalendars.some(calendar => calendar.id === event.calendarId));
  const taskBlocks = tasks.map(scheduledTaskEvent).filter((event): event is CalendarEvent => Boolean(event));
  const layoutEvents = [...visibleEvents, ...taskBlocks];
  const hours = visibleHours(layoutEvents, days);
  const minimumHourHeight = useCalendarFit(scrollRef, gridRef, hours.end - hours.start, `${calendarView}:${schedule}`);
  const hourHeight = Math.max(minimumHourHeight, preferredHourHeight);
  const gridHeight = (hours.end - hours.start) * hourHeight;
  useCalendarZoom(scrollRef, gridRef, hourHeight, changeHourHeight, `${calendarView}:${schedule}`, minimumHourHeight);
  const editingTask = tasks.find(task => task.id === editing);
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');

  function dropTime(over: { rect: { top: number; height: number }; data: { current?: Record<string, any> } }, fallbackY?: number) {
    if (over.data.current?.zone !== 'timed') return;
    const y = dropPointer.current?.y ?? fallbackY;
    if (y === undefined) return;
    return Math.round((hours.start * 60 + (y - over.rect.top) / over.rect.height * (hours.end - hours.start) * 60) / 15) * 15;
  }
  function showDrop({ active, over }: any) {
    if (!over?.data.current?.date || over.data.current.zone !== 'timed') { setDropPreview(undefined); return; }
    const task = tasks.find(t => t.id === (active.data.current?.taskId || String(active.id)));
    const changes = taskDrop(over.data.current.date, dropTime(over, active.rect.current.translated?.top), task);
    const starts = new Date(changes.scheduledStart!);
    setDropPreview({ date: over.data.current.date, start: starts.getHours() + starts.getMinutes() / 60, title: taskTimeRange(changes) });
  }
  return <DndContext sensors={sensors} collisionDetection={args => { dropPointer.current = args.pointerCoordinates; const hits = pointerWithin(args); return args.pointerCoordinates ? hits : closestCenter(args); }} onDragStart={({ active }) => setDraggedTask(active.data.current?.taskId || String(active.id))} onDragMove={showDrop} onDragOver={showDrop} onDragCancel={() => { setDraggedTask(undefined); setDropPreview(undefined); }} onDragEnd={({ active, over }) => {
    setDraggedTask(undefined); setDropPreview(undefined);
    if (!over || active.id === over.id) return;
    const taskId = active.data.current?.taskId || String(active.id);
    if (over.data.current?.date) { update(taskId, taskDrop(over.data.current.date, dropTime(over, active.rect.current.translated?.top), tasks.find(t => t.id === taskId))); return; }
    const ids = visibleTasks.filter(task => !task.completed).map(task => task.id);
    const from = ids.indexOf(taskId), to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) void mutate(() => repository.reorder(arrayMove(ids, from, to)));
  }}><main className="app-shell" style={{ '--event-font-size': `${fontSize}px`, '--chip-height': `${Math.max(20, Math.min(30, hourHeight * .5))}px` } as React.CSSProperties}>
    <header className="app-header">
      <div className="brand"><div className="brand-icon"><img key={brandReplay} src={`/brand/weekaboo-mark.svg?replay=${brandReplay}`} alt="" /></div><div><h1>Weeka<span>boo</span></h1><p>Your week, with a wink.</p></div><button type="button" className="brand-replay" aria-label="Replay Weekaboo animation" title="One more peek" onClick={() => { setBrandReplay(value => value + 1); mascotSound.play(); }} /></div>
      <div className="header-right">{!demo && <button className="new-event-button" onClick={() => { setEventDraft(undefined); setEventAnchor(undefined); setEditorSession(v => v + 1); setSelectedEvent(undefined); setCreatingEvent(true); }}><Plus size={18} /> New event</button>}<button className="demo-tag connected-calendars" aria-label="Connected calendars" onClick={() => { setSettings(false); setDrawer(true); }}>{demo ? 'Sample calendars' : 'Connected calendars'}</button><div className="clock"><strong>{time(now)}</strong><small>{now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</small></div><button className="icon settings-button" aria-label="Settings" onClick={() => setSettings(true)}><Settings size={21} /></button></div>
    </header>
    <div className={`dashboard ${tasksVisible ? '' : 'tasks-hidden'} ${resizing ? 'is-resizing' : ''}`} style={{ '--task-width': `${taskWidth}%` } as React.CSSProperties}>
      <section className="calendar-panel" aria-label={`${viewLabels[calendarView]} calendar`}>
        <CalendarToolbar schedule={schedule} toggleSchedule={toggleSchedule} focusDate={dateKey(focus)} jump={date => setFocusDate(new Date(`${date}T12:00:00`))} title={(calendarView === 'month' ? focus : start).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })} range={`${shortDate(shownDays[0])} – ${shortDate(shownDays[shownDays.length - 1])}`} view={calendarView} setView={changeCalendarView} navigate={direction => setFocusDate(navigateDate(focus, calendarView, direction))} today={() => setFocusDate(undefined)} scope={scope} groups={groups} setScope={setScope} tasksVisible={tasksVisible} toggleTasks={() => setTasksVisible(!tasksVisible)} />
        {schedule ? <ScheduleView days={shownDays} today={today} tasks={tasks} events={visibleEvents} calendars={displayCalendars} openTask={openTask} openEvent={openEvent} openDay={openDay} /> : calendarView === 'month' ? <MonthView days={days} focus={focus} today={today} tasks={tasks} events={visibleEvents} calendars={displayCalendars} openDay={openDay} more={(day, anchor) => setAgenda({ day, anchor })} openTask={openTask} openEvent={openEvent} /> : <div className="calendar-scroll" ref={scrollRef}>
          <div className="week-grid" data-view={calendarView} style={{ '--day-count': days.length } as React.CSSProperties}>
            <div className="day-headers"><div className="timezone-label">{now.toLocaleDateString('en-AU', { timeZoneName: 'short' }).split(', ').pop()?.split(' ').pop()}</div>{days.map(day => <button aria-label={`Open ${dateKey(day)}`} onClick={() => openDay(day)} key={dateKey(day)} className={`day-heading ${dateKey(day) === today ? 'is-today' : ''}`}><span>{day.toLocaleDateString('en-AU', { weekday: 'short' })}</span><strong>{day.getDate()}</strong></button>)}</div>
            <div className="untimed-tasks" role="region" aria-label="Tasks and all-day events">
              <div className="untimed-label">Anytime</div>
              {days.map(day => <AnytimeDay key={dateKey(day)} day={day} today={today} tasks={tasks} events={visibleEvents} calendars={displayCalendars} openTask={openTask} openEvent={openEvent} />)}
            </div>
            <div className="time-grid" ref={gridRef} style={{ '--hour-count': hours.end - hours.start, height: (hours.end - hours.start) * hourHeight } as React.CSSProperties}><div className="time-labels">{Array.from({ length: hours.end - hours.start }, (_, i) => <span key={i} style={{ top: `${i / (hours.end - hours.start) * 100}%` }}>{(i + hours.start) % 12 || 12}<small>{i + hours.start >= 12 ? 'pm' : 'am'}</small></span>)}</div>
              {days.map(day => <TimeColumn date={dateKey(day)} from={hours.start} to={hours.end} hourHeight={hourHeight} today={dateKey(day) === today} key={dateKey(day)} create={demo ? undefined : (start, end, anchor) => { setEventDraft({ start, end }); setEventAnchor(anchor); setSelectedEvent(undefined); setEditorSession(v => v + 1); setCreatingEvent(true); }}>
                {layoutDay(layoutEvents, day, hours.start, hours.end, gridHeight, event => event.taskId ? 0 : Math.ceil(fontSize * 1.2 + 8)).map(({ event, top, height, actualHeight, left, width }) => {
                  if (event.taskId) { const task = tasks.find(t => t.id === event.taskId)!; return <TimedTask key={event.id} task={task} hourHeight={hourHeight} style={{ top, height, left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)` }} open={anchor => openTask(task.id, anchor)} update={changes => update(task.id, changes)} />; }
                  const calendar = displayCalendars.find(calendar => calendar.id === event.calendarId)!;
                  return <CalendarEventCard key={event.id} event={event} color={calendar.color} calendarName={calendar.name} calendarId={calendar.id} top={top} height={height} actualHeight={actualHeight} left={left} width={width} fontSize={fontSize} hourHeight={hourHeight} adjust={!demo && event.editable ? setTimeDraft : undefined} open={anchor => openEvent(event, anchor)} />;
                })}
                {dropPreview?.date === dateKey(day) && <div className="task-drop-time" style={{ top: (dropPreview.start - hours.start) * hourHeight }}>{dropPreview.title}</div>}
                {dateKey(day) === today && currentHour >= hours.start && currentHour < hours.end && <div className="now-line" style={{ top: `${(currentHour - hours.start) / (hours.end - hours.start) * 100}%` }}><i /></div>}
              </TimeColumn>)}
            </div>
          </div>
        </div>}
        <footer className="calendar-footer"><CalendarRefresh loading={calendarLoading} status={calendarStatus} refresh={() => refreshCalendars.current()} /><span>{timezone}</span></footer>
      </section>
      {tasksVisible && <PanelDivider width={taskWidth} resize={resizeTasks} dragging={resizing} setDragging={setResizing} />}
      <div className="tasks-shell" id="task-panel" inert={!tasksVisible} aria-hidden={!tasksVisible}><aside className="tasks-panel" aria-label="Tasks">
        <div className="tasks-heading"><p className="eyebrow">MAKE SPACE FOR THE IMPORTANT</p><div><h2>Your things</h2><span className="count">{active.length}</span></div><p>No need to give everything a date.</p></div>
        <div className="task-tabs">{(['backlog', 'today', 'done'] as const).map(tab => <button key={tab} aria-pressed={view === tab} className={view === tab ? 'active' : ''} onClick={() => { setView(tab); }}>{tab === 'backlog' ? 'Backlog' : tab === 'today' ? 'For today' : 'Done'}</button>)}</div>
        <form className="quick-add" onSubmit={async event => { event.preventDefault(); const forToday = view === 'today'; if (await mutate(() => repository.create(title, forToday ? { focusDate: today } : undefined))) { setTitle(current => current === title ? '' : current); setView(forToday ? 'today' : 'backlog'); setNotice(forToday ? 'Task picked for today. No deadline added.' : 'Task added to your backlog.'); } }}><input aria-label="New task" placeholder={view === 'today' ? 'A little thing for today…' : 'Something to get done…'} maxLength={250} value={title} disabled={!ready} onChange={event => setTitle(event.target.value)} /><button className="icon" aria-label="Add task" disabled={!title.trim() || !ready || busy}><Plus size={22} /></button></form>
        <div className="task-list-wrap">
          {view === 'backlog' && visibleTasks.length > 0 && <p className="list-hint">Most important at the top <span>↕</span></p>}
<SortableContext items={shownTasks.filter(task => !task.completed).map(task => task.id)} strategy={verticalListSortingStrategy}><ol className="task-list">{shownTasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} update={update} edit={anchor => openTask(task.id, anchor)} today={today} disabled={busy} />)}</ol></SortableContext>
          {!visibleTasks.length && <div className="empty-tasks"><div><Star size={28} strokeWidth={1.2} /></div><h3>{!ready ? 'Opening your things…' : view === 'done' ? 'Small wins live here.' : view === 'today' ? 'What matters today?' : 'Make a little headspace.'}</h3><p>{view === 'done' ? 'Your last seven days of completed tasks appear here. Older wins stay on the calendar.' : view === 'today' ? 'Open a task and pick it for today. Its deadline stays exactly as it was.' : 'Capture a thing, big or small. Then move the important ones to the top.'}</p>{view === 'backlog' && ready && <span>Try “buy Brita filters”</span>}</div>}

        </div>
        <div className="task-note"><span>ONE THING AT A TIME</span><p>A place for “someday”,<br />and a little focus for today.</p></div>
        <footer className="tasks-footer">Saved on this device · Personal prototype</footer>
      </aside></div>
    </div>
    {error && <div className="error" role="alert">{error}<button className="icon" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
    <span className="sr-only" role="status">{notice}</span>
    {timeDraft && <EventTimeChange draft={timeDraft} close={() => setTimeDraft(undefined)} saved={() => { setNotice('Event time saved · Calendar sync pending.'); setRefreshVersion(v => v + 1); }} />}
    {agenda && <DayAgenda {...agenda} tasks={tasks} events={visibleEvents} calendars={displayCalendars} close={() => setAgenda(undefined)} openDay={openDay} openTask={openTask} openEvent={openEvent} />}
    {editingTask && <TaskEditor anchor={taskAnchor} key={`${editingTask.id}:${editorSession}`} task={editingTask} remove={() => mutate(() => repository.remove(editingTask.id, editingTask.updatedAt))} close={() => setEditing(undefined)} today={today} save={changes => mutate(() => repository.update(editingTask.id, changes))} />}
    {(selectedEvent || creatingEvent) && <EventComposer key={`${selectedEvent?.id || 'new'}:${editorSession}`} event={selectedEvent} anchor={eventAnchor} calendars={displayCalendars} start={creatingEvent && eventDraft ? eventDraft.start : focus} end={creatingEvent ? eventDraft?.end : undefined} demo={demo} close={() => { setSelectedEvent(undefined); setCreatingEvent(false); }} saved={message => { setNotice(message); setRefreshVersion(value => value + 1); }} />}

    {accountSetup && <AccountSetup removeId={removeAccountId} close={() => { setRemoveAccountId(undefined); setAccountSetup(false); setRefreshVersion(v => v + 1); history.replaceState(null, '', location.pathname); }} calendars={() => { setRemoveAccountId(undefined); setAccountSetup(false); setSettings(false); setDrawer(true); setRefreshVersion(v => v + 1); history.replaceState(null, '', location.pathname); }} />}
    {settings && <AppearanceSettings tasksChanged={async () => setTasks(await repository.list())} soundEnabled={mascotSound.enabled} setSoundEnabled={mascotSound.toggle} close={() => setSettings(false)} fontSize={fontSize} setFontSize={changeFontSize} hourHeight={hourHeight} minimumHourHeight={minimumHourHeight} setHourHeight={changeHourHeight} />}
    {drawer && <CalendarDrawer loading={calendarLoading} removeAccount={id => { setRemoveAccountId(id); setDrawer(false); setAccountSetup(true); }} openAccounts={() => { setRemoveAccountId(undefined); setDrawer(false); setAccountSetup(true); }} sync={(c, enabled) => void syncCalendar(c, enabled)} calendars={displayCalendars} groups={groups} scope={scope} close={() => setDrawer(false)} save={savePreference} addGroup={addGroup} toggle={(calendar, visible) => void toggleCalendar(calendar, visible)} demo={demo} />}
  </main><DragOverlay>{draggedTask && <div className="task-drag-preview"><Star size={15} />{tasks.find(t => t.id === draggedTask)?.title}</div>}</DragOverlay></DndContext>;
}
