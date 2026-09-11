import { TimeField } from './TimeField';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, dateKey, weekStart } from './domain';

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(+date) && dateKey(date) === value ? date : undefined;
}

export function DateField({ label, value, onChange, disabled, required, timed = false, trigger }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean; timed?: boolean; trigger?: ReactNode;
}) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseDate(value.slice(0, 10)) || new Date());
  const [draft, setDraft] = useState(value.slice(0,10));
  const [focused, setFocused] = useState(value.slice(0,10) || dateKey(new Date()));
  useEffect(() => { setDraft(value.slice(0,10)); }, [value]);
  function pick(date: string) { onChange(timed && date ? `${date}T${value.slice(11,16) || '09:00'}` : date); setDraft(date); input.current?.setCustomValidity(''); popup.current?.hidePopover(); setOpen(false); (input.current || opener.current)?.focus(); }
  useLayoutEffect(() => {
    if (!open) return;
    const node = popup.current!;
    node.showPopover();
    function place() { const rect = field.current!.getBoundingClientRect(); const height = node.offsetHeight; node.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - node.offsetWidth - 8))}px`; node.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - height - 8))}px`; }
    place();
    node.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
    window.addEventListener('resize',place); window.addEventListener('scroll',place,true);
    return () => { window.removeEventListener('resize',place); window.removeEventListener('scroll',place,true); };
  }, [open]);
  function moveFocus(day: Date) { setMonth(day); setFocused(dateKey(day)); requestAnimationFrame(()=>popup.current?.querySelector<HTMLButtonElement>(`[data-date="${dateKey(day)}"]`)?.focus()); }
  const first = new Date(month.getFullYear(),month.getMonth(),1,12);
  const days = Array.from({length:42},(_,i)=>addDays(weekStart(first),i));
  return <div className={`date-field ${timed ? 'with-time' : ''}`} ref={field}>
    {trigger ? <button ref={opener} type="button" className="month-jump" aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} aria-controls={id} onClick={() => { if (open) { popup.current?.hidePopover(); setOpen(false); } else { const date=parseDate(value.slice(0,10)) || new Date(); setMonth(date); setFocused(dateKey(date)); setOpen(true); } }}>{trigger}</button> : <><div className="date-input-wrap"><input ref={input} type="text" aria-label={label} placeholder="YYYY-MM-DD" value={draft} disabled={disabled} required={required} inputMode="numeric" maxLength={10} onChange={e=>{ const next=e.target.value; setDraft(next); const valid = !next || Boolean(parseDate(next)); e.target.setCustomValidity(valid ? '' : 'Enter a valid date as YYYY-MM-DD.'); if (valid) onChange(timed && next ? `${next}T${value.slice(11,16) || '09:00'}` : next); }} /><button type="button" className="date-trigger" disabled={disabled} aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} aria-controls={id} onClick={()=>{ if(open) { popup.current?.hidePopover(); setOpen(false); } else { const date=parseDate(value.slice(0,10)) || new Date(); setMonth(date); setFocused(dateKey(date)); setOpen(true); } }}><CalendarDays size={17}/></button></div></>}

    {timed && <TimeField label={`${label} time`} required={required} disabled={disabled} value={value.slice(11)} onChange={time=>onChange(`${value.slice(0,10) || dateKey(new Date())}T${time}`)} />}
    <div ref={popup} id={id} popover="auto" className="date-picker" role="dialog" aria-label={`Choose ${label.toLowerCase()}`} onToggle={e=>{ if ((e.nativeEvent as ToggleEvent).newState === 'closed') setOpen(false); }} onKeyDown={e=>{ if(e.key==='Escape') { e.stopPropagation(); popup.current?.hidePopover();setOpen(false); (input.current || opener.current)?.focus(); } }}>
      <header><button type="button" aria-label="Previous month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1,12))}><ChevronLeft size={17}/></button><strong>{month.toLocaleDateString('en-AU',{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Next month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1,12))}><ChevronRight size={17}/></button></header>
      <div className="date-picker-grid" role="group" aria-label={month.toLocaleDateString('en-AU',{month:'long',year:'numeric'})}>
        {['M','T','W','T','F','S','S'].map((name,i)=><span className="date-weekday" key={i}>{name}</span>)}
        {days.map(day=><button type="button" key={dateKey(day)} data-date={dateKey(day)} aria-label={day.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} aria-pressed={dateKey(day)===value.slice(0,10)} aria-current={dateKey(day)===dateKey(new Date())?'date':undefined} tabIndex={dateKey(day)===focused?0:-1} className={day.getMonth()!==month.getMonth()?'outside-month':''} onClick={()=>pick(dateKey(day))} onKeyDown={e=>{ const delta = ({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7} as Record<string,number>)[e.key]; if(delta) { e.preventDefault(); e.stopPropagation(); moveFocus(addDays(day,delta)); } if(e.key==='Home'||e.key==='End') { e.preventDefault(); const start=weekStart(day);moveFocus(e.key==='Home'?start:addDays(start,6)); } }}>{day.getDate()}</button>)}
      </div><footer><button type="button" onClick={()=>pick(dateKey(new Date()))}>Today</button>{!required && <button type="button" onClick={()=>pick('')}>No date</button>}</footer>
    </div>
  </div>;
}
