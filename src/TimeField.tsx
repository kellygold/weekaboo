import { useLayoutEffect, useRef, useState } from 'react';
import { Clock, Check } from 'lucide-react';

const times = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String(index % 4 * 15).padStart(2, '0')}`);
const valid = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const display = (value: string) => { const [h,m] = value.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'pm' : 'am'}`; };

export function TimeField({ label, value, onChange, disabled, required }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean }) {
  const field = useRef<HTMLDivElement>(null), popup = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const node = popup.current!; node.showPopover();
    const place = () => { const rect = field.current!.getBoundingClientRect(); node.style.left = `${Math.max(8, Math.min(rect.right - node.offsetWidth, innerWidth - node.offsetWidth - 8))}px`; node.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - node.offsetHeight - 8))}px`; };
    place(); node.querySelector<HTMLButtonElement>('[aria-selected=true]')?.focus();
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  const options = valid(value) && !times.includes(value) ? [...times, value].sort() : times;
  return <div className="time-field date-input-wrap" ref={field}>
    <input ref={input} aria-label={label} type="text" inputMode="numeric" placeholder="HH:mm" maxLength={5} value={value} disabled={disabled} required={required} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" title="24-hour time, e.g. 09:30 or 17:45" onChange={e => onChange(e.target.value)} />
    <button type="button" className="date-trigger" aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} disabled={disabled} onClick={() => { if (open) { popup.current?.hidePopover(); setOpen(false); } else setOpen(true); }}><Clock size={16}/></button>
    <div popover="auto" ref={popup} className="time-picker" role="listbox" aria-label={`Choose ${label.toLowerCase()}`} onToggle={e => { if ((e.nativeEvent as ToggleEvent).newState === 'closed') setOpen(false); }} onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); popup.current?.hidePopover(); setOpen(false); input.current?.focus(); }
      if (['ArrowUp','ArrowDown','Home','End'].includes(e.key)) { e.preventDefault(); const nodes = [...popup.current!.querySelectorAll<HTMLButtonElement>('button')]; const index = nodes.indexOf(document.activeElement as HTMLButtonElement); nodes[e.key === 'Home' ? 0 : e.key === 'End' ? nodes.length - 1 : Math.max(0,Math.min(nodes.length-1,index+(e.key==='ArrowUp'?-1:1)))]?.focus(); }
    }}>{options.map(option => <button type="button" role="option" aria-selected={option === value} key={option} onClick={() => { onChange(option); popup.current?.hidePopover(); setOpen(false); input.current?.focus(); }}>{display(option)}{option === value && <Check size={14}/>}</button>)}</div>
  </div>;
}
