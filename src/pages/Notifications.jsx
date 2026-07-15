import React, { useEffect, useMemo, useState } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, CheckCheck, Search, Trash2 } from 'lucide-react';

export default function Notifications() {
  const [items, setItems] = useState([]); const [query, setQuery] = useState(''); const [type, setType] = useState('all');
  useEffect(() => { firebaseApi.auth.me().then(user => firebaseApi.entities.Notification.filter({ user_id: user.id })).then(data => setItems(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))).catch(() => {}); }, []);
  const shown = useMemo(() => items.filter(item => (type === 'all' || item.type === type) && `${item.title} ${item.description || ''}`.toLowerCase().includes(query.toLowerCase())), [items, type, query]);
  const update = async (id, values) => { await firebaseApi.entities.Notification.update(id, values); setItems(old => old.map(item => item.id === id ? { ...item, ...values } : item)); };
  const deleteItem = async id => { await firebaseApi.entities.Notification.delete(id); setItems(old => old.filter(item => item.id !== id)); };
  const clear = async () => { await Promise.all(items.map(item => firebaseApi.entities.Notification.delete(item.id))); setItems([]); };
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm text-muted-foreground">Your private notification history</p></div><Button variant="outline" size="sm" onClick={clear} disabled={!items.length}><Trash2 className="mr-1 h-4 w-4" />Clear</Button></div>
    <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notifications" /></div><Select value={type} onValueChange={setType}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="default">Success</SelectItem><SelectItem value="warning">Warnings</SelectItem><SelectItem value="destructive">Errors</SelectItem><SelectItem value="info">Info</SelectItem></SelectContent></Select></div>
    <div className="space-y-2">{shown.map(item => <div key={item.id} className={`glass-card flex items-start gap-3 p-4 ${item.read ? 'opacity-70' : ''}`}><Bell className="mt-0.5 h-5 w-5 text-primary"/><div className="min-w-0 flex-1"><p className="font-medium">{item.title}</p>{item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}</div>{!item.read && <Button variant="ghost" size="icon" aria-label="Mark read" onClick={() => update(item.id, { read: true })}><CheckCheck className="h-4 w-4"/></Button>}<Button variant="ghost" size="icon" aria-label="Delete notification" onClick={() => deleteItem(item.id)}><Trash2 className="h-4 w-4"/></Button></div>)}{!shown.length && <div className="glass-card p-10 text-center text-sm text-muted-foreground">No notifications found.</div>}</div>
  </div>;
}
