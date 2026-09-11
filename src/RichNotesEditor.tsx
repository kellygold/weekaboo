import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Underline, List, ListOrdered, Link, Undo2, Redo2 } from 'lucide-react';
import { safeUrl } from './DetailContent';

// Rebuild allowed markup before it enters the editor; pasted content takes the
// same path. Provider styles, images, event handlers and executable links never
// become live DOM. Untouched notes are still saved in their original form.
export function editorHtml(source: string, plain = false): string {
  if (plain || !/<\/?[a-z][^>]*>/i.test(source)) {
    const p = document.createElement('p');
    p.textContent = source;
    return p.innerHTML.replace(/\r\n?|\n/g, '<br>');
  }
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const allowed = new Set(['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'hr', 'a']);
  const blocked = new Set(['head', 'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'img', 'form', 'input', 'template']);
  function clean(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    const fragment = document.createDocumentFragment();
    if (!(node instanceof Element) || blocked.has(node.tagName.toLowerCase())) return fragment;
    const tag = node.tagName.toLowerCase();
    const target = allowed.has(tag) ? document.createElement(tag) : fragment;
    if (tag === 'a' && target instanceof Element) {
      const href = safeUrl(node.getAttribute('href'));
      if (href) { target.setAttribute('href', href); target.setAttribute('rel', 'noopener noreferrer'); }
    }
    for (const child of node.childNodes) target.appendChild(clean(child));
    return target;
  }
  const output = document.createElement('div');
  for (const node of doc.body.childNodes) output.appendChild(clean(node));
  return output.innerHTML;
}

export function RichNotesEditor({ initialValue, disabled, plain = false, onChange }: {
  initialValue: string; disabled: boolean; plain?: boolean; onChange: (value: string) => void;
}) {
  const initial = useRef(initialValue).current;
  const previousPlain = useRef(plain);
  const normalized = useRef('');
  const change = useRef(onChange); change.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({
      link: { openOnClick: false, autolink: false, protocols: ['http', 'https'], isAllowedUri: url => Boolean(safeUrl(url)) },
      heading: { levels: [1, 2, 3, 4] },
    })],
    content: editorHtml(initial, plain),
    editable: !disabled,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': 'Notes', 'aria-multiline': 'true', 'data-placeholder': 'Anything worth remembering…' },
      transformPastedHTML: html => editorHtml(html),
    },
    onCreate: ({ editor }) => { normalized.current = editor.getHTML(); },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      change.current(html === normalized.current ? initial : plain ? editor.getText({ blockSeparator: '\n' }) : editor.isEmpty ? '' : html);
    },
  });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => {
    if (editor && previousPlain.current !== plain) {
      previousPlain.current = plain;
      change.current(plain ? editor.getText({ blockSeparator: '\n' }) : editor.isEmpty ? '' : editor.getHTML());
    }
  }, [editor, plain]);
  if (!editor) return null;
  const format = (name: string, active: boolean, icon: React.ReactNode, action: () => void, unavailable = false) =>
    <button type="button" aria-label={name} aria-pressed={active} title={name} disabled={disabled || unavailable} onMouseDown={e => e.preventDefault()} onClick={action}>{icon}</button>;
  function applyLink() {
    const url = safeUrl(linkUrl);
    if (!url) { setLinkError('Enter a complete https:// or http:// link.'); return; }
    if (editor!.state.selection.empty && !editor!.isActive('link')) {
      editor!.chain().focus().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
    } else editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  }
  return <section className="rich-notes" aria-label="Notes editor">
    <span className="rich-notes-label">Notes</span>
    <div className="rich-notes-surface">
      <div className="rich-notes-toolbar" role="toolbar" aria-label="Notes formatting">
        {!plain && <>
          {format('Bold', editor.isActive('bold'), <Bold size={16} />, () => { editor.chain().focus().toggleBold().run(); })}
          {format('Italic', editor.isActive('italic'), <Italic size={16} />, () => { editor.chain().focus().toggleItalic().run(); })}
          {format('Underline', editor.isActive('underline'), <Underline size={16} />, () => { editor.chain().focus().toggleUnderline().run(); })}
          {format('Bulleted list', editor.isActive('bulletList'), <List size={16} />, () => { editor.chain().focus().toggleBulletList().run(); })}
          {format('Numbered list', editor.isActive('orderedList'), <ListOrdered size={16} />, () => { editor.chain().focus().toggleOrderedList().run(); })}
          {format('Add or edit link', editor.isActive('link'), <Link size={16} />, () => { setLinkUrl(editor.getAttributes('link').href || ''); setLinkError(''); setLinkOpen(!linkOpen); })}
        </>}
        {format('Undo notes', false, <Undo2 size={16} />, () => { editor.chain().focus().undo().run(); }, !editor.can().undo())}
        {format('Redo notes', false, <Redo2 size={16} />, () => { editor.chain().focus().redo().run(); }, !editor.can().redo())}
      </div>
      {linkOpen && <div className="rich-notes-link" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setLinkOpen(false); editor.commands.focus(); } }}>
        <input aria-label="Link address" type="url" autoFocus value={linkUrl} placeholder="https://…" onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }} />
        <button type="button" disabled={disabled} onClick={applyLink}>Apply link</button>
        {editor.isActive('link') && <button type="button" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}>Remove link</button>}
        {linkError && <p role="alert">{linkError}</p>}
      </div>}
      <EditorContent editor={editor} />
    </div>
  </section>;
}
