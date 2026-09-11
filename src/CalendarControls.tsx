import { TaskBackupSettings } from './TaskBackupSettings';
import { providerName as serviceName } from './calendar-providers';
import { DateField } from './DateField';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, List, PanelRightClose, PanelRightOpen, Plus, Trash2, X } from 'lucide-react';
import { Select, ColorPicker } from './Select';
import type { Calendar } from './domain';
import { viewLabels, type CalendarView } from './calendar-range';

export interface CalendarGroup { id: string; name: string }
export type DisplayCalendar = Calendar & { hidden?: boolean };
export const defaultGroups: CalendarGroup[] = [{ id: 'personal', name: 'Personal' }, { id: 'work', name: 'Work' }];
export function calendarColor(color: string) {
  return ({ sage: '#819b73', clay: '#cb977b', blue: '#7c9cb6' } as Record<string, string>)[color] || color;
}

export function CalendarToolbar({ title, range, view, setView, navigate, today, scope, groups, setScope, tasksVisible, toggleTasks, focusDate, jump, schedule, toggleSchedule }: {
  focusDate: string; jump: (date: string) => void; schedule: boolean; toggleSchedule: () => void;
  title: string; range: string; view: CalendarView; setView: (view: CalendarView) => void;
  navigate: (direction: number) => void; today: () => void; scope: string;
  groups: CalendarGroup[]; setScope: (id: string) => void;
  tasksVisible: boolean; toggleTasks: () => void;
}) {
  return <div className="calendar-toolbar">
    <div className="calendar-title"><DateField label="Date" value={focusDate} onChange={jump} required trigger={<><span>{title}</span><ChevronDown size={16}/></>} /><p className="date-range">{range}</p></div>
    <div className="toolbar-actions">
      <div className="week-navigation"><button className="icon" aria-label={`Previous ${view === '4days' ? '4 days' : view}`} onClick={() => navigate(-1)}><ChevronLeft size={18} /></button><button onClick={today}>Today</button><button className="icon" aria-label={`Next ${view === '4days' ? '4 days' : view}`} onClick={() => navigate(1)}><ChevronRight size={18} /></button></div>
      <div className="calendar-view-controls"><div className="view-pills" role="group" aria-label="Calendar view">{(Object.keys(viewLabels) as CalendarView[]).map(key => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{viewLabels[key]}</button>)}</div><button className="schedule-toggle" aria-label="Schedule" title={schedule ? 'Return to calendar grid' : 'Show schedule'} aria-pressed={schedule} onClick={toggleSchedule}><List size={16}/><span>Schedule</span></button></div>
      <div className="calendar-source-control"><Select label="Calendar group" value={scope} onChange={setScope} options={[{ value: 'all', label: 'All calendars' }, ...groups.map(g => ({ value: g.id, label: g.name }))]} /></div>
      <button className="icon tasks-toggle" aria-label={tasksVisible ? 'Hide tasks' : 'Show tasks'} title={tasksVisible ? 'Hide tasks' : 'Show tasks'} aria-expanded={tasksVisible} aria-controls="task-panel" onClick={toggleTasks}>{tasksVisible ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}</button>
    </div>
  </div>;
}

export function CalendarDrawer({ calendars, loading = false, groups, scope, close, save, addGroup, toggle, demo, openAccounts, removeAccount, sync }: {
  calendars: DisplayCalendar[]; loading?: boolean; groups: CalendarGroup[]; scope: string; close: () => void;
  save: (id: string, change: { color?: string; scope?: string }) => void;
  addGroup: (name: string) => boolean; toggle: (calendar: DisplayCalendar, visible: boolean) => void;
  demo: boolean; openAccounts: () => void; removeAccount: (id: string) => void; sync: (calendar: DisplayCalendar, enabled: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [groupName, setGroupName] = useState('');
  const [editing, setEditing] = useState<string>();
  useEffect(() => { ref.current?.showModal(); }, []);
  const accounts = new Map<string, DisplayCalendar[]>();
  for (const calendar of calendars) {
    const key = `${calendar.provider}:${calendar.accountId}`;
    accounts.set(key, [...(accounts.get(key) || []), calendar]);
  }
  const providerName = (c: Calendar) => serviceName(c.provider);
  return <dialog ref={ref} className="calendar-drawer" aria-label="Connected calendars" onCancel={close} onClick={e => { if (e.target === ref.current) close(); }}>
    <div className="drawer-head"><h2>Connected calendars</h2><button className="icon" aria-label="Close calendars" onClick={close}><X size={20} /></button></div>
    <div className="drawer-body"><p className="muted">Choose what appears. Use a calendar’s options to set its group, color, or syncing.</p>
      {[...accounts.entries()].map(([id, rows]) => <section className="calendar-account" key={id} aria-label={`${providerName(rows[0])} ${rows[0].accountEmail || rows[0].accountId}`}><header><span className="account-provider">{providerName(rows[0])}</span><h3>{rows[0].accountEmail || 'Sample account'}</h3>{!demo && <button className="account-remove icon" aria-label={`Remove ${providerName(rows[0])} account ${rows[0].accountEmail}`} title="Remove account…" onClick={() => removeAccount(rows[0].accountId)}><Trash2 size={15} /></button>}</header>
        {rows.map(calendar => <div className="drawer-calendar" key={calendar.id}>
          <div className="calendar-choice"><label><input type="checkbox" style={{ accentColor: calendarColor(calendar.color) }} checked={!calendar.hidden && calendar.enabled !== false} onChange={e => toggle(calendar, e.target.checked)} /><span>{calendar.name}<small>{groups.find(g => g.id === calendar.scope)?.name}{calendar.enabled === false ? ' · Sync off' : scope !== 'all' && calendar.scope !== scope ? ' · Outside selected group' : ''}</small></span></label><button className="icon calendar-options" aria-label={`Options for ${calendar.name} (${calendar.id})`} aria-expanded={editing === calendar.id} onClick={() => setEditing(editing === calendar.id ? undefined : calendar.id)}>•••</button></div>
          {editing === calendar.id && <div className="calendar-customize"><ColorPicker label={`Color for ${calendar.name} (${calendar.id})`} color={calendarColor(calendar.color)} onChange={color => save(calendar.id, { color })} /><Select label={`Group for ${calendar.name} (${calendar.id})`} value={calendar.scope} onChange={scope => save(calendar.id, { scope })} options={groups.map(g => ({ value: g.id, label: g.name }))} /><label className="calendar-sync-toggle"><input type="checkbox" role="switch" aria-label={`Sync ${calendar.name} (${calendar.id})`} checked={calendar.enabled !== false} onChange={e => sync(calendar, e.target.checked)} /><span>{calendar.enabled === false ? 'Sync off' : 'Sync on'}</span></label><small className="sync-explanation">Turning sync off pauses updates and removes this calendar from the view. Your source calendar stays intact.</small></div>}
          {calendar.syncError && <p className="calendar-sync-error">Sync needs attention</p>}
        </div>)}
      </section>)}
      {!calendars.length && <p className="muted" role="status">{loading ? 'Loading calendars…' : 'No calendars yet. Connect an account to get started.'}</p>}
      <form className="new-calendar-group" onSubmit={e => { e.preventDefault(); if (addGroup(groupName)) setGroupName(''); }}><input aria-label="New calendar group" placeholder="Add a group, e.g. Shared" maxLength={32} value={groupName} onChange={e => setGroupName(e.target.value)} /><button aria-label="Add calendar group" disabled={!groupName.trim()}><Plus size={18} /></button></form>
    </div><footer className="drawer-footer">{!demo && <button aria-label="Manage accounts" onClick={openAccounts}>Add or remove accounts →</button>}</footer>
  </dialog>;
}

export function AppearanceSettings({ tasksChanged, close, fontSize, setFontSize, hourHeight, minimumHourHeight, setHourHeight, soundEnabled, setSoundEnabled }: {
  tasksChanged: () => Promise<void>; close: () => void; fontSize: number; setFontSize: (value: number) => void;
  hourHeight: number; minimumHourHeight: number; setHourHeight: (value: number) => void;
  soundEnabled: boolean; setSoundEnabled: (enabled: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="calendar-drawer appearance-drawer" aria-label="Settings" onCancel={close} onClick={e => { if (e.target === ref.current) close(); }}><div className="drawer-head"><h2>Make it yours</h2><button className="icon" aria-label="Close settings" onClick={close}><X size={20} /></button></div><div className="drawer-body"><section className="appearance-settings"><h3>Comfort &amp; readability</h3><label>Event text size <output>{fontSize}px</output><input aria-label="Event text size" type="range" min="11" max="18" step="1" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} /></label><label>Calendar spacing <output>{Math.round(hourHeight)}px / hour</output><input aria-label="Calendar spacing" type="range" min={minimumHourHeight} max={Math.max(180, minimumHourHeight)} step="any" value={hourHeight} onChange={e => setHourHeight(Number(e.target.value))} /></label><p className="muted">Pinch the calendar to zoom its time scale, or use Control + scroll. Event text stays readable as you zoom.</p></section><section className="mascot-sound-setting"><div><h3>Mascot giggle</h3><p className="muted">Only when you tap Weekaboo.</p></div><button type="button" className="sound-switch" role="switch" aria-label="Mascot sound" aria-checked={soundEnabled} onClick={() => setSoundEnabled(!soundEnabled)}><span /></button></section><p className="muted">Motion follows your device’s reduced-motion setting.</p><TaskBackupSettings changed={tasksChanged} /></div><footer className="drawer-footer"><p>Saved on this device.</p></footer></dialog>;
}

export function PanelDivider({ width, resize, dragging, setDragging }: { width: number; resize: (width: number) => void; dragging: boolean; setDragging: (value: boolean) => void }) {
  return <div className={`panel-divider ${dragging ? 'dragging' : ''}`} role="separator" aria-label="Resize calendar and tasks" aria-orientation="vertical" aria-controls="task-panel" aria-valuemin={20} aria-valuemax={45} aria-valuenow={Math.round(width)} tabIndex={0} title="Drag to resize · Double-click to reset"
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
    onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const bounds = event.currentTarget.parentElement!.getBoundingClientRect(); resize(Math.max(20, Math.min(45, (bounds.right - event.clientX - 10) / bounds.width * 100))); }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); }} onLostPointerCapture={() => setDragging(false)}
    onDoubleClick={() => resize(29)} onKeyDown={event => { const next = event.key === 'ArrowLeft' ? width + 2 : event.key === 'ArrowRight' ? width - 2 : event.key === 'Home' ? 20 : event.key === 'End' ? 45 : undefined; if (next !== undefined) { event.preventDefault(); resize(Math.max(20, Math.min(45, next))); } }}><span /></div>;
}
