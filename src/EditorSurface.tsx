import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, X } from 'lucide-react';

export function useAnchoredPosition(panel: RefObject<HTMLElement | null>, anchor: HTMLElement | undefined, expanded: boolean) {
  const [position, setPosition] = useState<{ left: number; top: number }>();
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    const place = () => {
      if (!anchor || expanded || innerWidth <= 760) { setPosition(undefined); return; }
      const target = anchor.getBoundingClientRect();
      const width = node.offsetWidth, height = node.offsetHeight;
      let left = target.right + 12;
      if (left + width > innerWidth - 12) left = target.left - width - 12;
      setPosition({ left: Math.max(12, Math.min(left, innerWidth - width - 12)), top: Math.max(12, Math.min(target.top, innerHeight - height - 12)) });
    };
    place();
    const observer = new ResizeObserver(place); observer.observe(node); if (anchor) observer.observe(anchor);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor, expanded]);
  return !expanded && position ? { ...position, right: 'auto', bottom: 'auto' } : undefined;
}

export function EditorSurface({ label, title, anchor, dirty, save, close, children, closeLabel = 'Close task editor' }: {
  label: string; title: string; anchor?: HTMLElement; dirty: boolean; close: () => void; save: () => Promise<boolean>;
  children: (state: { expanded: boolean; busy: boolean; submit: () => Promise<void> }) => ReactNode; closeLabel?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const position = useAnchoredPosition(panel, anchor, expanded);
  function dismiss() { setLeaving(true); timer.current = setTimeout(close, 160); }
  function requestClose() { if (!busy) { if (dirty) setConfirm(true); else dismiss(); } }
  async function submit() { if (busy || panel.current?.querySelector("form")?.reportValidity() === false) return; setBusy(true); if (await save()) dismiss(); setBusy(false); }
  useEffect(() => { panel.current?.focus(); return () => { if (timer.current) clearTimeout(timer.current); anchor?.focus(); }; }, []);
  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (panel.current?.contains(e.target as Node) || busy || leaving) return;
      if (dirty) { e.preventDefault(); e.stopImmediatePropagation(); }
      requestClose();
    };
    document.addEventListener('pointerdown', outside, true);
    const blockDirtyClick = (event: MouseEvent) => { if (dirty && !panel.current?.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    document.addEventListener('click', blockDirtyClick, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('click', blockDirtyClick, true); };
  }, [dirty, busy, leaving]);
  return createPortal(<aside ref={panel} className={`event-composer task-composer ${expanded ? 'is-expanded' : ''} ${leaving ? 'is-leaving' : ''}`} tabIndex={-1} aria-label={label} style={position} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); requestClose(); } }}>
    <header className="composer-header"><span>{title}</span><div><button className="icon" aria-label={expanded ? 'Collapse editor' : 'Expand editor'} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button><button className="icon" aria-label={closeLabel} disabled={busy} onClick={requestClose}><X size={19} /></button></div></header>
    {children({ expanded, busy, submit })}
    {confirm && <footer className="composer-footer"><span>You have unsaved changes.</span><button onClick={() => setConfirm(false)}>Keep editing</button><button disabled={busy} onClick={dismiss}>Discard</button><button className="primary" disabled={busy} onClick={() => void submit()}>Save changes</button></footer>}
  </aside>, document.body);
}
