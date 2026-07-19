import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy, FolderPlus, MoreHorizontal, PanelLeft, Pencil, Plus, Search, Send, Sparkles, Square, Trash2 } from 'lucide-react';
import { LatexText } from '@/components/LatexFormula';
import { askAiStore, streamAskAi } from '@/services/askAi';

const MODELS = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
];
const newId = () => crypto.randomUUID();
const time = (value) => value?.toDate?.() ? value.toDate().toLocaleDateString() : '';

function Message({ item, onDelete, onRegenerate, onRetry, onEdit }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(item.content); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  const markdown = {
    p: ({ children }) => <p><LatexText value={String(children)} /></p>,
    li: ({ children }) => <li><LatexText value={String(children)} /></li>,
    h1: ({ children }) => <h1><LatexText value={String(children)} /></h1>,
    h2: ({ children }) => <h2><LatexText value={String(children)} /></h2>,
    h3: ({ children }) => <h3><LatexText value={String(children)} /></h3>,
    code: ({ children, className }) => <code className={`${className || ''} rounded bg-muted px-1 py-0.5 text-xs`}>{children}<button aria-label="Copy code" className="ml-1 text-muted-foreground" onClick={() => navigator.clipboard.writeText(String(children))}><Copy className="inline h-3 w-3" /></button></code>,
  };
  return <article className={`group flex gap-3 ${item.role === 'user' ? 'justify-end' : ''}`}>
    {item.role === 'assistant' && <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white"><Sparkles className="h-4 w-4" /></div>}
    <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${item.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border/60 bg-card'}`}>
      {item.role === 'assistant' ? <div className="ask-ai-markdown prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown components={markdown}>{item.content || '…'}</ReactMarkdown></div> : <LatexText value={item.content} />}
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
  const [model, setModel] = useState(() => localStorage.getItem('cele-ask-ai-model') || MODELS[0].id); const [prompt, setPrompt] = useState(''); const [query, setQuery] = useState(''); const [busy, setBusy] = useState(false); const [sidebar, setSidebar] = useState(true);
  const abort = useRef(null); const bottom = useRef(null);
  const load = async () => { const [savedChats, savedFolders] = await Promise.all([askAiStore.listChats(), askAiStore.listFolders()]); setChats(savedChats); setFolders(savedFolders); if (!chat && savedChats[0]) setChat(savedChats[0]); };
  useEffect(() => { load().catch(console.error); }, []);
  useEffect(() => { if (!chat?.id) { setItems([]); return; } askAiStore.messages(chat.id).then(setItems).catch(console.error); }, [chat?.id]);
  useEffect(() => { localStorage.setItem('cele-ask-ai-model', model); }, [model]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [items, busy]);
  const filtered = useMemo(() => chats.filter((item) => `${item.title} ${time(item.updatedAt)}`.toLowerCase().includes(query.toLowerCase())), [chats, query]);
  const chooseChat = (next) => { setChat(next); setModel(next.model || model); };
  const createChat = async () => { const next = await askAiStore.createChat(model); setChats((old) => [next, ...old]); setChat(next); setItems([]); };
  const updateChat = async (current, changes) => { await askAiStore.updateChat(current.id, changes); const next = { ...current, ...changes }; setChats((old) => old.map((item) => item.id === current.id ? next : item)); if (chat?.id === current.id) setChat(next); };
  const send = async (override) => {
    const text = (override ?? prompt).trim(); if (!text || busy) return;
    let active = chat; if (!active) { active = await askAiStore.createChat(model); setChats((old) => [active, ...old]); setChat(active); }
    const user = { id: newId(), chatId: active.id, role: 'user', content: text, model };
    const assistant = { id: newId(), chatId: active.id, role: 'assistant', content: '', model, pending: true };
    const history = [...items, user].map(({ role, content }) => ({ role, content })); setItems((old) => [...old, user, assistant]); setPrompt(''); setBusy(true);
    try {
      await askAiStore.saveMessage(active.id, user);
      if (active.title === 'New chat') { const title = text.slice(0, 64); await askAiStore.updateChat(active.id, { title, model }); active = { ...active, title, model }; setChat(active); setChats((old) => old.map((item) => item.id === active.id ? active : item)); }
      abort.current = new AbortController(); const answer = await streamAskAi({ messages: history, model, signal: abort.current.signal, onChunk: (content) => setItems((old) => old.map((item) => item.id === assistant.id ? { ...item, content } : item)) });
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
    <section className="flex min-w-0 flex-1 flex-col"><header className="flex items-center justify-between border-b border-border/60 px-4 py-3"><div className="flex items-center gap-2"><button onClick={() => setSidebar((value) => !value)} className="rounded-lg p-2 hover:bg-muted"><PanelLeft className="h-4 w-4" /></button><div><h2 className="font-semibold">{chat?.title || 'Ask AI'}</h2><p className="text-xs text-muted-foreground">Your conversations sync privately across devices</p></div></div><select value={model} onChange={(event) => setModel(event.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">{MODELS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></header><main className="flex-1 space-y-5 overflow-y-auto px-4 py-6 md:px-8">{!items.length && <div className="mx-auto mt-16 max-w-lg text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 text-white"><Sparkles /></div><h1 className="text-2xl font-bold">What can I help you study?</h1><p className="mt-2 text-sm text-muted-foreground">Ask about CE board problems, equations, and concepts.</p></div>}{items.map((item) => <Message key={item.id} item={item} onDelete={deleteMessage} onRegenerate={() => send(items[items.indexOf(item) - 1]?.content)} onRetry={() => send(item.content)} onEdit={(message) => setPrompt(message.content)} />)}<div ref={bottom} /></main><div className="border-t border-border/60 bg-card/50 p-3 md:p-4"><div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Message Ask AI…" rows={1} className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none" />{busy ? <button onClick={() => abort.current?.abort()} className="rounded-xl bg-destructive p-2 text-destructive-foreground" aria-label="Stop generating"><Square className="h-4 w-4 fill-current" /></button> : <button onClick={() => send()} className="rounded-xl bg-primary p-2 text-primary-foreground" aria-label="Send"><Send className="h-4 w-4" /></button>}</div><p className="mt-2 text-center text-[11px] text-muted-foreground">Ask AI can make mistakes. Verify calculations and code.</p></div></section>
  </div>;
}
