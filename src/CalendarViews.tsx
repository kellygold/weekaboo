import { useLayoutEffect, useRef, useState } from 'react';
import { Check, Star, ChevronUp } from 'lucide-react';
import { dateKey, taskOnDay, type Calendar, type CalendarEvent, type Task } from './domain';
import { scheduledTaskEvent, taskTimeRange } from './task-scheduling';
import { occursOn } from './event-layout';
import { DropDay } from './CalendarInteractions';
import { EditorSurface } from './EditorSurface';
import { calendarColor } from './CalendarControls';

type Item = { key: string; task?: Task; event?: CalendarEvent; calendar?: Calendar };
type Actions = { openTask: (id: string, anchor: HTMLElement) => void; openEvent: (event: CalendarEvent, anchor: HTMLElement) => void };

export function dayItems(day: Date, tasks: Task[], events: CalendarEvent[], calendars: Calendar[], untimed = false): Item[] {
  return [
    ...tasks.filter(t => taskOnDay(t, day, '') && (!untimed || !scheduledTaskEvent(t))).map(task => ({ key: `task:${task.id}`, task })),
    ...events.filter(e => occursOn(e, day) && (!untimed || e.allDay)).sort((a,b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)).map(event => ({ key: event.id, event, calendar: calendars.find(c => c.id === event.calendarId) })),
  ].sort((a: Item, b: Item) => {
    const section = (item: Item) => item.task ? scheduledTaskEvent(item.task) ? 2 : item.task.completed ? 3 : 0 : item.event?.allDay ? 1 : 2;
    const group = section(a) - section(b);
    if (group) return group;
    if (section(a) === 2) return +new Date(a.task?.scheduledStart || a.event!.start) - +new Date(b.task?.scheduledStart || b.event!.start);
    return a.task && b.task ? a.task.rank - b.task.rank : (a.event?.title || '').localeCompare(b.event?.title || '');
  });
}

export function CompactItem({ item, mode, openTask, openEvent }: { item: Item; mode: 'month' | 'untimed' | 'agenda' } & Actions) {
  if (item.task) {
    const task = item.task;
    return <button className={`calendar-task compact-item ${task.completed ? 'is-done' : ''}`} title={task.title} aria-label={`Open task ${task.title} on calendar`} onClick={e => openTask(task.id, e.currentTarget)}>{task.completed ? <Check size={12} /> : <Star size={12} />}{mode !== 'untimed' && scheduledTaskEvent(task) && <small>{taskTimeRange(task)}</small>}<span>{task.title}</span>{task.completed && <small>Done</small>}</button>;
  }
  const event = item.event!;
  const color = calendarColor(item.calendar?.color || '#819b73');
  return <button className={`${event.allDay ? 'all-day-event' : 'month-event'} compact-item`} style={{ background: `${color}25`, borderColor: color }} title={`${event.title} · ${item.calendar?.name || ''}`} onClick={e => openEvent(event, e.currentTarget)}>{!event.allDay && <small>{new Date(event.start).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</small>}<span>{event.title}</span>{mode === 'agenda' && <small>{item.calendar?.name}</small>}</button>;
}

export function MonthView({ days, focus, today, tasks, events, calendars, openDay, more, ...actions }: {
  days: Date[]; focus: Date; today: string; tasks: Task[]; events: CalendarEvent[]; calendars: Calendar[];
  openDay: (day: Date) => void; more: (day: Date, anchor: HTMLElement) => void;
} & Actions) {
  const outer = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(500);
  useLayoutEffect(() => {
    const node = outer.current!;
    const observer = new ResizeObserver(() => setHeight(node.clientHeight)); observer.observe(node);
    setHeight(node.clientHeight);
    return () => observer.disconnect();
  }, []);
  const rowHeight = Math.max(80, (height - 28) / (days.length / 7));
  const capacity = Math.max(1, Math.floor((rowHeight - 51) / 24));
  return <div className="month-viewport" ref={outer} role="region" aria-label="Month overview"><div className="month-grid" style={{ gridTemplateRows: `28px repeat(${days.length / 7}, ${rowHeight}px)` }}>
    {days.slice(0, 7).map(day => <div className="month-weekday" key={dateKey(day)}>{day.toLocaleDateString('en-AU', { weekday: 'short' })}</div>)}
    {days.map(day => {
      const items = dayItems(day, tasks, events, calendars);
      const shown = items.slice(0, capacity);
      return <DropDay date={dateKey(day)} zone="month" key={dateKey(day)} className={`month-day ${dateKey(day) === today ? 'is-today' : ''} ${day.getMonth() !== focus.getMonth() ? 'outside-month' : ''}`}>
        <button className="month-date" aria-label={`Open ${dateKey(day)}`} onClick={() => openDay(day)}>{day.getDate()}</button>
        <div className="month-items">{shown.map(item => <CompactItem key={item.key} item={item} mode="month" {...actions} />)}</div>
        {items.length > capacity && <button className="day-more" aria-label={`Show ${items.length - capacity} more on ${dateKey(day)}`} onClick={e => more(day, e.currentTarget)}>+{items.length - capacity} more</button>}
      </DropDay>;
    })}
  </div></div>;
}

export function DayAgenda({ day, anchor, tasks, events, calendars, close, openDay, ...actions }: {
  day: Date; anchor: HTMLElement; tasks: Task[]; events: CalendarEvent[]; calendars: Calendar[];
  close: () => void; openDay: (day: Date) => void;
} & Actions) {
  return <EditorSurface label="Day overview" title={day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} anchor={anchor} dirty={false} close={close} save={async () => false} closeLabel="Close day overview">{() => <><div className="composer-body day-agenda">{dayItems(day, tasks, events, calendars).map(item => <CompactItem key={item.key} item={item} mode="agenda" openTask={id => { close(); actions.openTask(id, anchor); }} openEvent={event => { close(); actions.openEvent(event, anchor); }} />)}</div><footer className="composer-footer"><button onClick={() => { close(); openDay(day); }}>Open day view</button></footer></>}</EditorSurface>;
}

export function AnytimeDay({ day, today, tasks, events, calendars, ...actions }: { day: Date; today: string; tasks: Task[]; events: CalendarEvent[]; calendars: Calendar[] } & Actions) {
  const [expanded, setExpanded] = useState(false);
  const items = dayItems(day, tasks, events, calendars, true);
  const hidden = items.length - 3;
  return <DropDay date={dateKey(day)} zone="untimed" className={`untimed-day ${dateKey(day) === today ? 'is-today' : ''}`}>
    {items.slice(0,3).map(item => <CompactItem key={item.key} item={item} mode="untimed" {...actions} />)}
    {hidden > 0 && <div className={`anytime-extra ${expanded ? 'is-expanded' : ''}`} inert={!expanded} aria-hidden={!expanded}><div>{items.slice(3).map(item => <CompactItem key={item.key} item={item} mode="untimed" {...actions} />)}</div></div>}
    {hidden > 0 && <button className="day-more" aria-label={expanded ? `Collapse anytime on ${dateKey(day)}` : `Show ${hidden} more on ${dateKey(day)}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <><ChevronUp size={12}/> Show less</> : `+${hidden} more`}</button>}
    {dateKey(day) === today && !items.length && <span className="untimed-empty">Drag a task here</span>}
  </DropDay>;
}
