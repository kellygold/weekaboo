import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { CalendarEvent } from './domain';
import { calendarColor } from './CalendarControls';
import type { EventTimeDraft } from './EventTimeChange';

type Gesture = { y: number; x: number; edge: 'start'|'end'|'move'; scroll: number; pointer: number; node: HTMLElement; active: boolean };
export function CalendarEventCard({ event, color, calendarName, calendarId, top, height, actualHeight, left, width, fontSize, hourHeight, open, adjust }: {
  event: CalendarEvent; color: string; calendarName: string; calendarId: string; top: number; height: number; actualHeight: number; left: number; width: number; fontSize: number; hourHeight: number;
  open: (anchor: HTMLElement) => void; adjust?: (draft: EventTimeDraft) => void;
}) {
  const root=useRef<HTMLDivElement>(null), hold=useRef<ReturnType<typeof setTimeout> | undefined>(undefined), gesture=useRef<Gesture | undefined>(undefined), suppressed=useRef(false);
  const [offsetX,setOffsetX]=useState(0);
  const [armed,setArmed]=useState(false), [preview,setPreview]=useState<{start:string;end:string}>();
  useEffect(() => {
    const node = root.current!;
    const dismiss = (e: globalThis.PointerEvent) => { if (!node.contains(e.target as Node)) { stop(); setArmed(false); } };
    const multipleTouches = (e: TouchEvent) => { if (e.touches.length > 1) { stop(); setArmed(false); } };
    // A hold can become a drag without lifting. Suppress scrolling only after
    // activation; ordinary swipes and two-finger calendar zoom remain available.
    const touchMove = (e: TouchEvent) => { if (gesture.current?.active && e.touches.length === 1) e.preventDefault(); };
    node.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('touchstart', multipleTouches, { capture: true, passive: true });
    document.addEventListener('pointerdown', dismiss);
    return () => { clearTimeout(hold.current); node.removeEventListener('touchmove', touchMove); document.removeEventListener('touchstart', multipleTouches, true); document.removeEventListener('pointerdown', dismiss); };
  }, []);
  const clock=(value:string)=>new Date(value).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});
  const shown=preview || event;
  const minutes=Math.round((+new Date(shown.end)-+new Date(shown.start))/60000);
  const deltaStart=preview ? (new Date(preview.start).getHours()*60+new Date(preview.start).getMinutes() - new Date(event.start).getHours()*60-new Date(event.start).getMinutes())/60*hourHeight : 0;
  const trueHeight=preview ? minutes/60*hourHeight-2 : actualHeight;
  const displayHeight=preview ? Math.max(Math.ceil(fontSize*1.2+8),trueHeight) : height;
  const enlarged=displayHeight>trueHeight+1, lines=Math.max(1,Math.floor((displayHeight-4-(displayHeight>=60?14:0))/(fontSize*1.15)));
  function stop() {
    clearTimeout(hold.current); hold.current=undefined;
    const previous=gesture.current; gesture.current=undefined;
    if(previous?.node.hasPointerCapture(previous.pointer)) previous.node.releasePointerCapture(previous.pointer);
    setPreview(undefined); setOffsetX(0);
  }
  function activate(g: Gesture) {
    if(gesture.current !== g) return;
    clearTimeout(hold.current); hold.current=undefined;
    g.active=true; suppressed.current=true; setArmed(true);
    if(g.node.isConnected) g.node.setPointerCapture(g.pointer);
  }
  function begin(e: PointerEvent<HTMLElement>, edge: Gesture['edge']) {
    if(!adjust || e.button !== 0) return;
    if(!e.isPrimary) { stop(); setArmed(false); return; }
    e.stopPropagation(); suppressed.current=false;
    const g: Gesture={x:e.clientX,y:e.clientY,edge,scroll:root.current?.closest('.calendar-scroll')?.scrollTop || 0,pointer:e.pointerId,node:e.currentTarget,active:false};
    gesture.current=g;
    if(edge!=='move' || armed) { e.preventDefault(); activate(g); return; }
    if(e.pointerType !== 'touch') e.currentTarget.setPointerCapture(e.pointerId);
    hold.current=setTimeout(()=>activate(g),450);
  }
  function move(e: PointerEvent<HTMLElement>) {
    const g=gesture.current;
    if(!g || g.pointer!==e.pointerId) return;
    if(!g.active) {
      if(Math.hypot(e.clientX-g.x,e.clientY-g.y)<6) return;
      suppressed.current=true; stop(); return;
    }
    e.preventDefault();
    const scroll=root.current?.closest('.calendar-scroll')?.scrollTop || 0;
    const delta=Math.round(((e.clientY-g.y+scroll-g.scroll)/hourHeight*60)/15)*15;
    let start=+new Date(event.start),end=+new Date(event.end);
    if(g.edge==='start')start=Math.min(end-15*60000,start+delta*60000);
    else if(g.edge==='end')end=Math.max(start+15*60000,end+delta*60000);
    else {
      start+=delta*60000;end+=delta*60000;
      const column=[...document.querySelectorAll<HTMLElement>('.day-column')].find(node=>{const rect=node.getBoundingClientRect();return e.clientX>=rect.left && e.clientX<rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom;});
      if(column?.dataset.date){setOffsetX(column.getBoundingClientRect().left-(root.current?.parentElement?.getBoundingClientRect().left || 0));const next=new Date(`${column.dataset.date}T00:00:00`), shifted=new Date(start);next.setHours(shifted.getHours(),shifted.getMinutes());end=+next+(end-start);start=+next;}
    }
    setPreview({start:new Date(start).toISOString(),end:new Date(end).toISOString()});
  }
  function finish(e: PointerEvent<HTMLElement>) {
    if(gesture.current && gesture.current.pointer!==e.pointerId) return;
    clearTimeout(hold.current);hold.current=undefined;
    gesture.current=undefined;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(preview && (preview.start!==new Date(event.start).toISOString() || preview.end!==new Date(event.end).toISOString()))adjust?.({event,...preview,anchor:root.current!});
    gesture.current=undefined;setPreview(undefined);setOffsetX(0);
  }
  return <div ref={root} className={`event-card-shell ${adjust?'is-editable':''} ${armed?'is-adjusting':''}`} style={{transform:`translateX(${offsetX}px)`,top:top+deltaStart,height:displayHeight,left:`calc(${left}% + 2px)`,width:`calc(${width}% - 4px)`,'--card-color':calendarColor(color),'--actual-height':`${Math.max(0,trueHeight)}px`,'--title-lines':lines,fontSize} as CSSProperties} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();stop();setArmed(false);} if(e.key.toLowerCase()==='e' && adjust){e.preventDefault();setArmed(true);}}}>
    <button className={`event readable-event ${color}`} data-calendar-id={calendarId} data-enlarged={enlarged} data-single-line={lines === 1} title={`${event.title} · ${clock(shown.start)} – ${clock(shown.end)} · ${calendarName}${adjust?' · Hold to move or resize':''}`} aria-label={`${event.title} · ${clock(event.start)} – ${clock(event.end)}`} onContextMenu={e=>{if(adjust)e.preventDefault();}} onPointerDown={e=>begin(e,'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{stop();setArmed(false);}} onLostPointerCapture={()=>{if(gesture.current)stop();}} onClick={e=>{if(suppressed.current){suppressed.current=false;return;}setArmed(false);open(e.currentTarget);}}>
      <i className="event-duration-rail" aria-hidden="true"/><span className="event-card-title">{event.title}</span>{displayHeight>=60 && <small className="event-card-time">{clock(shown.start)} – {clock(shown.end)}</small>}{enlarged && <small className="event-duration-label">{minutes}m</small>}
    </button>
    {adjust && <>{(['start','end'] as const).map(edge=><button key={edge} tabIndex={armed?0:-1} className={`event-time-handle event-time-${edge}`} aria-label={`Adjust ${edge} of ${event.title}`} onPointerDown={e=>begin(e,edge)} onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{stop();setArmed(false);}} onLostPointerCapture={()=>{if(gesture.current)stop();}} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const delta=(e.key==='ArrowUp'?-15:15)*60000;const start=+new Date(event.start),end=+new Date(event.end);adjust({event,start:new Date(edge==='start'?Math.min(end-900000,start+delta):start).toISOString(),end:new Date(edge==='end'?Math.max(start+900000,end+delta):end).toISOString(),anchor:root.current!});}}}><i/></button>)}{armed && <output className="event-adjust-preview">{clock(shown.start)} – {clock(shown.end)}{preview && <small>{new Date(shown.start).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})}</small>}</output>}</>}
  </div>;
}
