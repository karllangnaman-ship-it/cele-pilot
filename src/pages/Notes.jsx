import React, { useState, useEffect } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Plus, Search, Trash2, Edit2, X } from 'lucide-react';
import ReactQuill from 'react-quill';

export default function Notes() {
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', subject: '' });

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const items = await firebaseApi.entities.StudyNote.filter({ user_id: u.id });
      setNotes(items);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(search.toLowerCase())
  );

  const saveNote = async () => {
    if (selectedNote) {
      const updated = await firebaseApi.entities.StudyNote.update(selectedNote.id, form);
      setNotes(prev => prev.map(n => n.id === selectedNote.id ? updated : n));
    } else {
      const created = await firebaseApi.entities.StudyNote.create({ ...form, user_id: user.id });
      setNotes(prev => [...prev, created]);
    }
    setDialogOpen(false);
    setSelectedNote(null);
    setForm({ title: '', content: '', subject: '' });
  };

  const deleteNote = async (id) => {
    await firebaseApi.entities.StudyNote.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const openEdit = (note) => {
    setSelectedNote(note);
    setForm({ title: note.title, content: note.content || '', subject: note.subject || '' });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notes</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSelectedNote(null); setForm({ title: '', content: '', subject: '' }); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />New Note</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{selectedNote ? 'Edit Note' : 'New Note'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div>
                <Label>Subject</Label>
                <Select value={form.subject} onValueChange={v => setForm(p => ({ ...p, subject: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HPGE">HPGE</SelectItem>
                    <SelectItem value="PSAD">PSAD</SelectItem>
                    <SelectItem value="MSTE">MSTE</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Content</Label>
                <ReactQuill value={form.content} onChange={v => setForm(p => ({ ...p, content: v }))} className="mt-1" />
              </div>
              <Button onClick={saveNote} disabled={!form.title} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">No notes yet. Start taking notes!</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((note, i) => (
            <motion.div key={note.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="glass-card p-4 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{note.title}</h3>
                  {note.subject && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{note.subject}</span>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(note)} className="p-1 rounded hover:bg-muted"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteNote(note.id)} className="p-1 rounded hover:bg-muted"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground mt-2 line-clamp-3" dangerouslySetInnerHTML={{ __html: note.content || '' }} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}