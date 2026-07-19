import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { Check, Copy, FileText, FolderPlus, Maximize2, MoreHorizontal, Paperclip, PanelLeft, Pencil, Plus, Search, Send, Sparkles, Square, Trash2, X } from 'lucide-react';
import { LatexText } from '@/components/LatexFormula';
import { askAiStore, streamAskAi, streamAskAiVision } from '@/services/askAi';
import { supabaseStorage } from '@/services/supabaseStorage';

const MODELS = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
];
const newId = () => crypto.randomUUID();
const time = (value) => value?.toDate?.() ? value.toDate().toLocaleDateString() : '';
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ACCEPTED_ATTACHMENTS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);
const formatSize = (size) => `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 1 : 0)} MB`;

/** Convert every supported Gemini response shape into one safe Markdown string. */
export function normalizeGeminiResponse(response) {
  const seen = new WeakSet();
  const extract = (value, allowText = false) => {
    if (typeof value === 'string') return allowText ? value : '';
    if (typeof value === 'number' || typeof value === 'boolean') return allowText ? `${value}` : '';
    if (!value || typeof value !== 'object') return '';
    if (seen.has(value)) return '';
    seen.add(value);
    if (Array.isArray(value)) return value.map((entry) => extract(entry, allowText)).join('');

    const chunks = [];
    if (Object.prototype.hasOwnProperty.call(value, 'text')) chunks.push(extract(value.text, true));
    // These are Gemini's text-bearing containers. Traversing them recursively
    // covers response.parts, candidate.content.parts, and nested Part arrays
    // while ignoring metadata such as roles, IDs, usage, and inline binary data.
    for (const key of ['parts', 'content', 'candidates', 'candidate', 'response', 'data', 'result', 'output', 'message', 'inlineData']) {
      if (Object.prototype.hasOwnProperty.call(value, key)) chunks.push(extract(value[key], key === 'content'));
    }
    // Some SDK versions wrap parts in unnamed nested objects. Search those
    // objects for a `text` field but never append arbitrary metadata strings.
    for (const child of Object.values(value)) if (child && typeof child === 'object') chunks.push(extract(child, false));
    return chunks.join('');
  };

  // Gemini sometimes returns LaTex with \(...\) or \[...\] delimiters. Convert
  // only non-code regions so remark-math can render it without altering code.
  return extract(response, true).split(/(```[\s\S]*?```)/g).map((segment, index) => index % 2 ? segment : segment
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([^\n]*?)\\\)/g, '$$$1$')).join('');
}

const safeHtmlSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'u'],
  attributes: { ...defaultSchema.attributes, '*': [...(defaultSchema.attributes?.['*'] || []), 'className'], a: [...(defaultSchema.attributes?.a || []), 'target', 'rel'] },
};

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const code = normalizeGeminiResponse(children).replace(/\n$/, '');
  const language = /language-([\w+-]+)/.exec(className || '')?.[1];
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  if (!language) return <code className={`${className || ''} rounded bg-muted px-1 py-0.5 text-xs`}>{children}</code>;
  return <div className="not-prose relative my-3 overflow-hidden rounded-lg"><button type="button" aria-label="Copy code" onClick={copy} className="absolute right-2 top-2 z-10 rounded bg-background/20 p-1.5 text-white hover:bg-background/35">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button><SyntaxHighlighter language={language} style={oneDark} PreTag="div" customStyle={{ margin: 0, padding: '1rem', fontSize: '0.75rem' }}>{code}</SyntaxHighlighter></div>;
}

function Attachment({ attachment, compact = false, onRemove, onReplace }) {
  if (!attachment) return null;
  const image = attachment.mimeType?.startsWith('image/');
  const url = attachment.url || attachment.previewUrl || attachment.attachmentUrl || attachment.attachmentStorageUrl;
  return <div className={`mb-3 flex items-center gap-2 rounded-xl border border-border/70 bg-background/50 p-2 ${compact ? 'max-w-sm' : ''}`}>
    {image && url ? <a href={url} target="_blank" rel="noreferrer" title="Open full-size preview"><img src={url} alt={attachment.attachmentName || attachment.name || 'Attachment'} className="h-14 w-14 rounded-lg object-cover" /></a> : <div className="grid h-14 w-14 place-items-center rounded-lg bg-muted text-muted-foreground"><FileText className="h-6 w-6" /></div>}
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{attachment.attachmentName || attachment.name}</p><p className="text-[11px] text-muted-foreground">{formatSize(attachment.attachmentSize || attachment.size || 0)}</p></div>
    {url && <a href={url} target="_blank" rel="noreferrer" aria-label={image ? 'Open full-size preview' : 'Open PDF'} className="rounded p-1.5 hover:bg-muted">{image ? <Maximize2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</a>}
    {onReplace && <button type="button" onClick={onReplace} aria-label="Replace attachment" className="rounded p-1.5 text-xs hover:bg-muted">Replace</button>}
    {onRemove && <button type="button" onClick={onRemove} aria-label="Remove attachment" className="rounded p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>}
  </div>;
}

function Message({ item, onDelete, onRegenerate, onRetry, onEdit }) {
  const [copied, setCopied] = useState(false);
  const content = normalizeGeminiResponse(item.content);
  const copy = async () => { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  const markdown = {
    code: CodeBlock,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
  };
  return <article className={`group flex gap-3 ${item.role === 'user' ? 'justify-end' : ''}`}>
    {item.role === 'assistant' && <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white"><Sparkles className="h-4 w-4" /></div>}
    <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${item.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border/60 bg-card'}`}>
      <Attachment attachment={item} compact />
      {item.role === 'assistant' ? <div className="ask-ai-markdown prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, [rehypeSanitize, safeHtmlSchema], [rehypeKatex, { throwOnError: false, strict: 'ignore' }]]} components={markdown}>{content || (item.pending ? '…' : 'No response.')}</ReactMarkdown></div> : <LatexText value={content} />}
      {!item.pending && <div className="mt-2 flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <button aria-label="Copy message" onClick={copy} className="rounded p-1 hover:bg-muted">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
        {item.role === 'assistant' ? <button aria-label="Regenerate" onClick={onRegenerate} className="rounded p-1 hover:bg-muted"><Sparkles className="h-3.5 w-3.5" /></button> : <><button aria-label="Edit message" onClick={() => onEdit(item)} className="rounded p-1 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button><button aria-label="Retry" onClick={onRetry} className="rounded p-1 hover:bg-muted"><Sparkles className="h-3.5 w-3.5" /></button></>}
        <button aria-label="Delete message" onClick={() => onDelete(item)} className="rounded p-1 hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>}
    </div>
  </article>;
}

export default function AskAI() {
  const [chats, setChats] = useState([]); const [folders, setFolders] = useState([]); const [chat, setChat] = useState(null); const [items, setItems] = useState([]);
  const [model, setModel] = useState(() => localStorage.getItem('cele-ask-ai-model') || MODELS[0].id); const [prompt, setPrompt] = useState(''); const [query, setQuery] = useState(''); const [attachment, setAttachment] = useState(null); const [attachmentError, setAttachmentError] = useState(''); const [busy, setBusy] = useState(false); const [sidebar, setSidebar] = useState(true);
  const abort = useRef(null); const bottom = useRef(null); const attachmentInput = useRef(null);
  const load = async () => { const [savedChats, savedFolders] = await Promise.all([askAiStore.listChats(), askAiStore.listFolders()]); setChats(savedChats); setFolders(savedFolders); if (!chat && savedChats[0]) setChat(savedChats[0]); };
  useEffect(() => { load().catch(console.error); }, []);
  useEffect(() => { if (!chat?.id) { setItems([]); return; } askAiStore.messages(chat.id).then(async (saved) => setItems(await Promise.all(saved.map(async (message) => { if (!message.attachmentStoragePath) return message; try { const signed = await supabaseStorage.signUrl(message.attachmentStoragePath); return { ...message, attachmentUrl: signed.url }; } catch { return message; } })))).catch(console.error); }, [chat?.id]);
  useEffect(() => { localStorage.setItem('cele-ask-ai-model', model); }, [model]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [items, busy]);
  const filtered = useMemo(() => chats.filter((item) => `${item.title} ${time(item.updatedAt)}`.toLowerCase().includes(query.toLowerCase())), [chats, query]);
  const chooseChat = (next) => { setChat(next); setModel(next.model || model); };
  const createChat = async () => { const next = await askAiStore.createChat(model); setChats((old) => [next, ...old]); setChat(next); setItems([]); };
  const updateChat = async (current, changes) => { await askAiStore.updateChat(current.id, changes); const next = { ...current, ...changes }; setChats((old) => old.map((item) => item.id === current.id ? next : item)); if (chat?.id === current.id) setChat(next); };
  const selectAttachment = (file) => {
    setAttachmentError('');
    if (!file) return;
    if (!ACCEPTED_ATTACHMENTS.has(file.type)) return setAttachmentError('Please select a PNG, JPG, WEBP, GIF, or PDF file.');
    if (file.size > MAX_ATTACHMENT_BYTES) return setAttachmentError('Attachments must be 20 MB or smaller.');
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment({ file, name: file.name, size: file.size, mimeType: file.type, previewUrl: URL.createObjectURL(file) });
  };
  const removeAttachment = () => { if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl); setAttachment(null); setAttachmentError(''); if (attachmentInput.current) attachmentInput.current.value = ''; };
  const send = async (override) => {
    const typedText = (override ?? prompt).trim(); const selectedAttachment = attachment; if ((!typedText && !selectedAttachment) || busy) return;
    const text = typedText || 'Please analyze the attached file.'; setAttachmentError(''); setBusy(true);
    let uploaded;
    if (selectedAttachment) {
      try { uploaded = await supabaseStorage.upload({ file: selectedAttachment.file, folder: 'Ask AI' }); }
      catch { setAttachmentError('Upload failed. Please try again.'); setBusy(false); return; }
    }
    let active = chat; if (!active) { active = await askAiStore.createChat(model); setChats((old) => [active, ...old]); setChat(active); }
    const attachmentData = uploaded && { attachmentType: selectedAttachment.mimeType.startsWith('image/') ? 'image' : 'pdf', attachmentName: selectedAttachment.name, attachmentSize: selectedAttachment.size, attachmentStorageUrl: uploaded.file_url, attachmentStoragePath: uploaded.path, mimeType: selectedAttachment.mimeType, attachmentUrl: uploaded.file_url };
    const user = { id: newId(), chatId: active.id, role: 'user', content: text, model, ...attachmentData };
    const assistant = { id: newId(), chatId: active.id, role: 'assistant', content: '', model, pending: true };
    const history = [...items, user].map(({ role, content }) => ({ role, content })); setItems((old) => [...old, user, assistant]); setPrompt(''); removeAttachment();
    try {
      await askAiStore.saveMessage(active.id, user);
      if (active.title === 'New chat') { const title = text.slice(0, 64); await askAiStore.updateChat(active.id, { title, model }); active = { ...active, title, model }; setChat(active); setChats((old) => old.map((item) => item.id === active.id ? active : item)); }
      abort.current = new AbortController(); const streaming = selectedAttachment ? streamAskAiVision({ messages: history, model, attachment: { storageUrl: uploaded.file_url, mimeType: selectedAttachment.mimeType, size: selectedAttachment.size }, signal: abort.current.signal, onChunk: (content) => setItems((old) => old.map((item) => item.id === assistant.id ? { ...item, content } : item)) }) : streamAskAi({ messages: history, model, signal: abort.current.signal, onChunk: (content) => setItems((old) => old.map((item) => item.id === assistant.id ? { ...item, content } : item)) }); const answer = await streaming;
      const saved = { ...assistant, content: answer, pending: false }; setItems((old) => old.map((item) => item.id === assistant.id ? saved : item)); await askAiStore.saveMessage(active.id, saved); await askAiStore.updateChat(active.id, { model });
    } catch (error) { const content = error.name === 'AbortError' ? 'Generation stopped.' : `Sorry, ${error.message}`; setItems((old) => old.map((item) => item.id === assistant.id ? { ...item, content: item.content || content, pending: false } : item)); }
    finally { setBusy(false); abort.current = null; }
  };
  const deleteMessage = async (item) => { await askAiStore.deleteMessage(item.chatId, item.id); setItems((old) => old.filter((message) => message.id !== item.id)); };
  const renameChat = async (current) => { const title = window.prompt('Rename chat', current.title)?.trim(); if (title) await updateChat(current, { title }); };
  const manageChat = async (current) => {
    const choice = window.prompt('Choose: rename, favorite, pin, move, or delete');
    if (choice === 'rename') return renameChat(current);
    if (choice === 'favorite') return updateChat(current, { favorite: !current.favorite });
    if (choice === 'pin') return updateChat(current, { pinned: !current.pinned });
    if (choice === 'move') { const folderName = window.prompt(`Folder name (blank for no folder):\n${folders.map((folder) => folder.name).join(', ')}`); const folder = folders.find((item) => item.name.toLowerCase() === folderName?.trim().toLowerCase()); return updateChat(current, { folderId: folder?.id || null }); }
    if (choice === 'delete' && window.confirm(`Delete “${current.title}”?`)) { await askAiStore.deleteChat(current.id); setChats((old) => old.filter((item) => item.id !== current.id)); if (chat?.id === current.id) { setChat(null); setItems([]); } }
  };
  const newFolder = async () => { const name = window.prompt('Folder name')?.trim(); if (!name) return; const folder = await askAiStore.createFolder(name); setFolders((old) => [...old, folder]); };
  const manageFolder = async (folder) => { const choice = window.prompt(`Choose: rename or delete “${folder.name}”`); if (choice === 'rename') { const name = window.prompt('Folder name', folder.name)?.trim(); if (name) { await askAiStore.updateFolder(folder.id, { name }); setFolders((old) => old.map((item) => item.id === folder.id ? { ...item, name } : item)); } } if (choice === 'delete' && window.confirm(`Delete folder “${folder.name}”? Chats will remain unfiled.`)) { await askAiStore.deleteFolder(folder.id); setFolders((old) => old.filter((item) => item.id !== folder.id)); const affected = chats.filter((item) => item.folderId === folder.id); await Promise.all(affected.map((item) => updateChat(item, { folderId: null }))); } };
  const chatList = (folderId) => filtered.filter((item) => (folderId ? item.folderId === folderId : !item.folderId));
  const renderChats = (list) => list.map((item) => <div key={item.id} className={`group flex items-center rounded-xl ${chat?.id === item.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}><button onClick={() => chooseChat(item)} className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm">{item.pinned && '📌 '}{item.favorite && '★ '}{item.title}</button><button aria-label={`Manage ${item.title}`} onClick={() => manageChat(item)} className="p-2"><MoreHorizontal className="h-4 w-4" /></button></div>);
  return <div className="-mx-4 -my-4 flex h-[calc(100vh-8.4rem)] min-h-[560px] overflow-hidden bg-background md:rounded-2xl md:border md:border-border/60">
    {sidebar && <aside className="w-72 shrink-0 overflow-y-auto border-r border-border/60 bg-card/60 p-3 max-md:absolute max-md:z-20 max-md:h-full"><div className="mb-3 flex gap-2"><button onClick={createChat} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />New chat</button><button onClick={newFolder} aria-label="New folder" className="rounded-xl border border-border p-2"><FolderPlus className="h-4 w-4" /></button></div><label className="relative mb-3 block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm" /></label><div className="space-y-1">{renderChats(chatList(null))}{folders.map((folder) => <div key={folder.id} className="pt-2"><div className="flex items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>{folder.name}</span><button aria-label={`Manage ${folder.name}`} onClick={() => manageFolder(folder)}><MoreHorizontal className="h-3.5 w-3.5" /></button></div>{renderChats(chatList(folder.id))}</div>)}</div></aside>}
    <section className="flex min-w-0 flex-1 flex-col"><header className="flex items-center justify-between border-b border-border/60 px-4 py-3"><div className="flex items-center gap-2"><button onClick={() => setSidebar((value) => !value)} className="rounded-lg p-2 hover:bg-muted"><PanelLeft className="h-4 w-4" /></button><div><h2 className="font-semibold">{chat?.title || 'Ask AI'}</h2><p className="text-xs text-muted-foreground">Your conversations sync privately across devices</p></div></div><select value={model} onChange={(event) => setModel(event.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">{MODELS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></header><main className="flex-1 space-y-5 overflow-y-auto px-4 py-6 md:px-8">{!items.length && <div className="mx-auto mt-16 max-w-lg text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 text-white"><Sparkles /></div><h1 className="text-2xl font-bold">What can I help you study?</h1><p className="mt-2 text-sm text-muted-foreground">Ask about CE board problems, equations, and concepts.</p></div>}{items.map((item) => <Message key={item.id} item={item} onDelete={deleteMessage} onRegenerate={() => send(items[items.indexOf(item) - 1]?.content)} onRetry={() => send(item.content)} onEdit={(message) => setPrompt(message.content)} />)}<div ref={bottom} /></main><div className="border-t border-border/60 bg-card/50 p-3 md:p-4"><input ref={attachmentInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="hidden" onChange={(event) => selectAttachment(event.target.files?.[0])} />{attachment && <Attachment attachment={attachment} onRemove={removeAttachment} onReplace={() => attachmentInput.current?.click()} />}{attachmentError && <p className="mb-2 text-sm text-destructive">{attachmentError}</p>}<div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectAttachment(event.dataTransfer.files?.[0]); }} className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm"><button type="button" onClick={() => attachmentInput.current?.click()} aria-label="Attach image or PDF" className="rounded-xl p-2 hover:bg-muted"><Paperclip className="h-5 w-5" /></button><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Message Ask AI…" rows={1} className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none" />{busy ? <button onClick={() => abort.current?.abort()} className="rounded-xl bg-destructive p-2 text-destructive-foreground" aria-label="Stop generating"><Square className="h-4 w-4 fill-current" /></button> : <button onClick={() => send()} className="rounded-xl bg-primary p-2 text-primary-foreground" aria-label="Send"><Send className="h-4 w-4" /></button>}</div><p className="mt-2 text-center text-[11px] text-muted-foreground">Drop one PNG, JPG, WEBP, GIF, or PDF (up to 20 MB). Ask AI can make mistakes.</p></div></section>
  </div>;
}
