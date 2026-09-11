import { Check, Star, Video } from 'lucide-react';
import { dateKey, type Calendar, type CalendarEvent, type Task } from './domain';
import { dayItems } from './CalendarViews';
import { calendarColor } from './CalendarControls';
import { DropDay } from './CalendarInteractions';
import { scheduledTaskEvent } from './task-scheduling';

const clock = (value: string) => new Date(value).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
export function ScheduleView({ days, today, tasks, events, calendars, openTask, openEvent, openDay }: {
  days: Date[]; today: string; tasks: Task[]; events: CalendarEvent[]; calendars: Calendar[];
  openTask: (id: string, anchor: HTMLElement) => void; openEvent: (event: CalendarEvent, anchor: HTMLElement) => void; openDay: (date: Date) => void;
}) {
  return <div className="schedule-view" role="region" aria-label="Schedule" key={days.map(dateKey).join(':')}>
    {days.map(day => {
      const key = dateKey(day), items = dayItems(day, tasks, events, calendars);
      return <section className={`schedule-day ${key === today ? 'is-today' : ''}`} key={key} aria-label={day.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})}>
        <button className="schedule-date" aria-label={`Open ${key}`} onClick={() => openDay(day)}><strong>{day.getDate()}</strong><span>{day.toLocaleDateString('en-AU',{weekday:'short',month:'short'})}</span>{key === today && <small>Today</small>}</button>
        <DropDay date={key} zone="schedule" className="schedule-items">{items.length ? items.map(item => {
          const task = item.task, event = item.event, timed = task ? scheduledTaskEvent(task) : !event!.allDay ? event : undefined;
          const range = timed ? `${dateKey(new Date(timed.start)) < key ? 'From previous day' : clock(timed.start)} – ${dateKey(new Date(timed.end)) > key ? 'next day' : clock(timed.end)}` : task ? task.completed ? 'Done' : 'Anytime' : 'All day';
          return <button key={item.key} className={`schedule-item ${task ? 'schedule-task' : ''} ${task?.completed ? 'is-done' : ''}`} style={{'--calendar-color':calendarColor(item.calendar?.color || '#819b73')} as React.CSSProperties} onClick={e => task ? openTask(task.id,e.currentTarget) : openEvent(event!,e.currentTarget)}>
            <span className="schedule-time">{range}</span><span className="schedule-description"><strong>{task ? <>{task.completed ? <Check size={15}/> : <Star size={15}/>}<span>{task.title}</span></> : event!.title}</strong><small>{task ? 'Task' : item.calendar?.name}{event?.meetingUrl && <Video size={13} aria-label="Online meeting"/>}</small></span>
          </button>;
        }) : <p className="schedule-empty">A little breathing room.</p>}</DropDay>
      </section>;
    })}
  </div>;
}
