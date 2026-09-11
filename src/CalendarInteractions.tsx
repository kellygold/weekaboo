import { useEffect, useLayoutEffect, useState, useRef, type ReactNode, type RefObject } from 'react';
import { useDroppable } from '@dnd-kit/core';

export function DropDay({ date, zone, className, children }: { date: string; zone: string; className: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${zone}:${date}`, data: { date, zone } });
  return <div ref={setNodeRef} data-date={date} className={`${className} ${isOver ? 'task-drop-target' : ''}`}>{children}</div>;
}

export function useCalendarZoom(scroll: RefObject<HTMLDivElement | null>, grid: RefObject<HTMLDivElement | null>, height: number, change: (height: number) => void, view: string, minimum: number) {
  const current = useRef({ height, change, minimum });
  current.current = { height, change, minimum };
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    let pinch: { distance: number; height: number } | undefined;
    let frame = 0;
    function zoom(next: number, y: number) {
      const old = current.current.height;
      next = Math.max(current.current.minimum, Math.min(Math.max(180, current.current.minimum), next));
      const offset = y - (grid.current?.getBoundingClientRect().top || y);
      current.current.change(next);
      current.current.height = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { node!.scrollTop += offset * (next / old - 1); });
    }
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) { e.preventDefault(); pinch = { distance: distance(e.touches), height: current.current.height }; }
    };
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      zoom(pinch.height * distance(e.touches) / Math.max(1, pinch.distance), (e.touches[0].clientY + e.touches[1].clientY) / 2);
    };
    const end = () => { pinch = undefined; };
    const wheel = (e: WheelEvent) => { if (e.ctrlKey) { e.preventDefault(); zoom(current.current.height * Math.exp(-e.deltaY * .008), e.clientY); } };
    node.addEventListener('touchstart', start, { passive: false });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);
    node.addEventListener('wheel', wheel, { passive: false });
    return () => { cancelAnimationFrame(frame); node.removeEventListener('touchstart', start); node.removeEventListener('touchmove', move); node.removeEventListener('touchend', end); node.removeEventListener('touchcancel', end); node.removeEventListener('wheel', wheel); };
  }, [view]);
}

// Measure only the viewport and bands above the grid; the grid uses this exact scale.
export function useCalendarFit(scroll: RefObject<HTMLDivElement | null>, grid: RefObject<HTMLDivElement | null>, count: number, view: string) {
  const [minimum, setMinimum] = useState(12);
  useLayoutEffect(() => {
    const node = scroll.current, timeline = grid.current;
    if (!node || !timeline) return;
    const measure = () => {
      const before = timeline.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop;
      setMinimum(Math.max(1, (node.clientHeight - before) / count));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    node.querySelectorAll('.day-headers, .untimed-tasks').forEach(band => observer.observe(band));
    measure();
    return () => observer.disconnect();
  }, [view, count]);
  return minimum;
}
