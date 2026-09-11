import { createElement, useLayoutEffect, useRef, type ReactNode, type TextareaHTMLAttributes } from 'react';

export function safeUrl(value?: string | null): string | undefined {
  if (!value) return;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return; }
}

function linkedText(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s<>"']+)/g).map((part, i) => {
    const url = /^https?:\/\//.test(part) ? safeUrl(part.replace(/[.,;!?]+$/, '')) : undefined;
    return url ? <a key={i} href={url} target="_blank" rel="noopener noreferrer">{part}</a> : part;
  });
}

// Provider descriptions may contain HTML. Reconstruct a small formatting subset;
// never mount provider HTML, images, styles, handlers or executable URL schemes.
export function RichText({ text, plain = false }: { text: string; plain?: boolean }) {
  if (plain) return <div className="detail-rich-text">{linkedText(text)}</div>;
  const doc = new DOMParser().parseFromString(text, 'text/html');
  function render(node: Node, key: number): ReactNode {
    if (node.nodeType === Node.TEXT_NODE) return <span key={key}>{linkedText(node.textContent || '')}</span>;
    if (!(node instanceof Element)) return null;
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'img', 'form', 'input'].includes(tag)) return null;
    const children = [...node.childNodes].map(render);
    if (tag === 'a') { const href = safeUrl(node.getAttribute('href')); return href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{node.textContent || href}</a> : <span key={key}>{children}</span>; }
    if (tag === 'br') return <br key={key} />;
    return createElement(['p', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h3', 'h4'].includes(tag) ? tag : 'span', { key }, children);
  }
  return <div className="detail-rich-text">{[...doc.body.childNodes].map(render)}</div>;
}

export function descriptionLinks(...texts: (string | undefined)[]) {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const doc = new DOMParser().parseFromString(text, 'text/html');
    for (const link of doc.querySelectorAll('a[href]')) { const url = safeUrl(link.getAttribute('href')); if (url) found.add(url); }
    for (const match of (doc.body.textContent || '').matchAll(/https?:\/\/[^\s<>"']+/g)) { const url = safeUrl(match[0].replace(/[.,;!?]+$/, '')); if (url) found.add(url); }
  }
  return [...found];
}
export function meetingName(url: string) {
  const host = new URL(url).hostname;
  const matches = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  return matches('meet.google.com') ? 'Google Meet' : matches('zoom.us') || matches('zoom.com') ? 'Zoom' : matches('teams.microsoft.com') || matches('teams.live.com') ? 'Microsoft Teams' : matches('webex.com') ? 'Webex' : undefined;
}

// Teams descriptions also link to meeting settings and help. Those links stay
// readable in the description, but only call-entry routes become Join buttons.
export function isMeetingJoinLink(value: string): boolean {
  const url = safeUrl(value);
  if (!url) return false;
  const provider = meetingName(url);
  if (provider !== 'Microsoft Teams') return Boolean(provider);
  const path = new URL(url).pathname;
  return /^\/meet\/[^/]+\/?$/i.test(path) || /^\/l\/meetup-join\/[^/]+(?:\/.*)?$/i.test(path);
}

export function GrowingTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = ref.current!;
    const fit = () => { node.style.height = 'auto'; node.style.height = `${node.scrollHeight + 2}px`; };
    fit();
    let width = node.clientWidth;
    const observer = new ResizeObserver(() => { if (node.clientWidth !== width) { width = node.clientWidth; fit(); } });
    observer.observe(node); return () => observer.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={ref} className={`growing-textarea ${props.className || ''}`} rows={1} />;
}
