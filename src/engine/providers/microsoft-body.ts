import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { ServiceError } from '../../services/errors';
type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
const element = (node: Node): node is Element => 'tagName' in node;
const attribute = (node: Element, name: string) => node.attrs.find(attr => attr.name === name)?.value || '';
const children = (node: Node): Node[] => 'childNodes' in node ? node.childNodes : [];
const text = (node: Node): string => node.nodeName === '#text' ? (node as DefaultTreeAdapterTypes.TextNode).value : children(node).map(text).join('');
function inspect(source: string) {
  const root = parse(source, { sourceCodeLocationInfo: true });
  const nodes: Element[] = [];
  function visit(node: Node) { if (element(node)) nodes.push(node); children(node).forEach(visit); }
  visit(root);
  const marked = (node: Element) => attribute(node, 'class').split(/\s+/).some(name => name.replace(/^x_/, '') === 'me-email-text') || ['skypemeeting', 'teamsmeeting', 'skypemeetingcontent'].includes(attribute(node, 'id').toLowerCase().replace(/^x_/, ''));
  const separator = (node: Node) => element(node) && ['div', 'p', 'br', 'hr'].includes(node.tagName) && !nodes.some(other => ['a', 'img', 'input'].includes(other.tagName) && contains(node, other)) && /^[_—–\-\s]*$/.test(text(node));
  const contains = (outer: Element, inner: Element) => { for (let parent = inner.parentNode; parent; parent = 'parentNode' in parent ? parent.parentNode : null) if (parent === outer) return true; return false; };
  const ranges: { start: number; end: number }[] = [];
  for (const node of nodes.filter(marked)) {
    if (nodes.some(parent => parent !== node && marked(parent) && contains(parent, node))) continue;
    const location = node.sourceCodeLocation;
    // parse5 repairs malformed HTML; never turn a repaired generated block into
    // permission to overwrite Teams details. Require its actual closing tag.
    if (!location?.startTag || !location.endTag) throw new ServiceError('unsupported', 'The meeting details are incomplete. Notes have not been sent; sync and try again.');
    let start = location.startOffset, end = location.endOffset;
    const siblings = node.parentNode ? children(node.parentNode) : [];
    let index = siblings.indexOf(node) - 1;
    while (index >= 0) {
      const sibling = siblings[index--], loc = sibling.sourceCodeLocation;
      if (sibling.nodeName === '#text' && !text(sibling).trim()) continue;
      if (!loc || source.slice(loc.endOffset, start).trim() || !separator(sibling)) break;
      start = loc.startOffset;
    }
    index = siblings.indexOf(node) + 1;
    while (index < siblings.length) {
      const sibling = siblings[index++], loc = sibling.sourceCodeLocation;
      if (sibling.nodeName === '#text' && !text(sibling).trim()) continue;
      if (!loc || source.slice(end, loc.startOffset).trim() || !separator(sibling)) break;
      end = loc.endOffset;
    }
    ranges.push({ start, end });
  }
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) ranges[i].start = Math.max(ranges[i].start, ranges[i - 1].end);
  const body = nodes.find(node => node.tagName === 'body')?.sourceCodeLocation;
  const start = body?.startTag?.endOffset ?? 0, end = body?.endTag?.startOffset ?? source.length;
  let joinLink: string | undefined;
  for (const node of nodes.filter(node => node.tagName === 'a')) {
    try {
      const url = new URL(attribute(node, 'href'));
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && ['teams.live.com', 'teams.microsoft.com', 'join.skype.com'].includes(url.hostname) && (url.pathname.includes('/meet/') || url.pathname.includes('/meetup-join/') || url.hostname === 'join.skype.com')) { joinLink = url.href; break; }
    } catch { /* Not a usable absolute meeting link. */ }
  }
  return { ranges, start, end, joinLink };
}
function editable(source: string, parsed: ReturnType<typeof inspect>) {
  if (!parsed.ranges.length) return source;
  let cursor = parsed.start, result = '';
  for (const range of parsed.ranges) { result += source.slice(cursor, range.start); cursor = range.end; }
  return (result + source.slice(cursor, parsed.end)).trim();
}
export function microsoftNotes(source: string) {
  try { const parsed = inspect(source); return { editable: editable(source, parsed), meetingUrl: parsed.joinLink }; }
  catch { return { editable: source, meetingUrl: undefined }; }
}
export function mergeMicrosoftNotes(source: string, notes: string | null, online: boolean) {
  const parsed = inspect(source);
  if (online && !parsed.ranges.length && parsed.joinLink) throw new ServiceError('unsupported', 'This meeting uses an unrecognized details format. Your draft is still here; the remote meeting has not been changed.');
  const cleaned = notes ? editable(notes, inspect(notes)) : '';
  if (!parsed.ranges.length) return cleaned;
  return source.slice(0, parsed.start) + cleaned + parsed.ranges.map(range => source.slice(range.start, range.end)).join('') + source.slice(parsed.end);
}
