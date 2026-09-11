import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function Select({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  function close() { setOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    ref.current?.querySelector<HTMLButtonElement>('[aria-selected=true]')?.focus();
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return <div className="select-control" ref={ref} onKeyDown={e => {
    if (e.key === 'Escape' && open) { e.stopPropagation(); close(); }
    if (e.key === 'Tab') setOpen(false);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const nodes = [...ref.current!.querySelectorAll<HTMLButtonElement>('[role=option]')];
      const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
      nodes[e.key === 'Home' ? 0 : e.key === 'End' ? nodes.length - 1 : (index + (e.key === 'ArrowUp' ? -1 : 1) + nodes.length) % nodes.length]?.focus();
    }
  }}>
    <button type="button" ref={trigger} className="select-trigger" role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" disabled={disabled} onClick={() => setOpen(!open)}><span>{options.find(o => o.value === value)?.label || 'Choose…'}</span><ChevronDown size={14} /></button>
    {open && <div className="select-options" id={id} role="listbox" aria-label={label}>{options.map(option => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); close(); }}><span>{option.label}</span>{option.value === value && <Check size={14} />}</button>)}</div>}
  </div>;
}

export function ColorPicker({ label, color, onChange }: { label: string; color: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const palette = ['#819b73', '#527c67', '#7c9cb6', '#526bb0', '#aa91b5', '#c689a0', '#cb977b', '#e0b965', '#8c9b9d', '#68715f'];
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return <div className="color-control" ref={ref} onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}>
    <button type="button" className="color-trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}><i style={{ background: color }} /></button>
    {open && <div className="color-options" role="group" aria-label={label}>{palette.map(c => <button key={c} type="button" style={{ background: c }} aria-label={`Use ${c}`} aria-pressed={c === color} onClick={() => { onChange(c); setOpen(false); }}>{c === color && <Check size={16} />}</button>)}<label className="custom-color">Custom color<input type="color" aria-label={`Custom ${label}`} value={color} onChange={e => onChange(e.target.value)} /></label></div>}
  </div>;
}
