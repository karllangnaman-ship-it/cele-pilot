import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CELE_SUBJECTS, COLOR_OPTIONS, COLOR_CLASSES } from '@/lib/cele-subjects';

export default function ManualTaskDialog({ open, onOpenChange, selectedDate, editingTask, onSave }) {
  const [form, setForm] = useState({
    title: '', description: '', subject: '', topic: '', date: selectedDate,
    time_start: '', time_end: '', priority: 'medium', color_label: 'blue',
    repeat: 'none', notes: '', reminder: false,
  });

  useEffect(() => {
    if (editingTask) {
      setForm({
        title: editingTask.title || '',
        description: editingTask.description || '',
        subject: editingTask.subject || '',
        topic: editingTask.topic || '',
        date: editingTask.date || selectedDate,
        time_start: editingTask.time_start || '',
        time_end: editingTask.time_end || '',
        priority: editingTask.priority || 'medium',
        color_label: editingTask.color_label || 'blue',
        repeat: editingTask.repeat || 'none',
        notes: editingTask.notes || '',
        reminder: editingTask.reminder || false,
      });
    } else {
      setForm({
        title: '', description: '', subject: '', topic: '', date: selectedDate,
        time_start: '', time_end: '', priority: 'medium', color_label: 'blue',
        repeat: 'none', notes: '', reminder: false,
      });
    }
  }, [editingTask, selectedDate, open]);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.title || !form.date) return;
    let duration = 0;
    if (form.time_start && form.time_end) {
      const [sh, sm] = form.time_start.split(':').map(Number);
      const [eh, em] = form.time_end.split(':').map(Number);
      duration = (eh * 60 + em) - (sh * 60 + sm);
    }
    onSave({ ...form, type: 'other', duration_minutes: duration > 0 ? duration : 30 });
  };

  const availableTopics = form.subject ? Object.values(CELE_SUBJECTS[form.subject] || {}).flat() : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTask ? 'Edit Task' : 'Add Manual Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Task Title *</Label>
            <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Practice set on Fluid Mechanics" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Optional details" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Subject</Label>
              <Select value={form.subject || 'none'} onValueChange={v => { update('subject', v === 'none' ? '' : v); update('topic', ''); }}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="MSTE">MSTE</SelectItem>
                  <SelectItem value="HGE">HGE</SelectItem>
                  <SelectItem value="PSAD">PSAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Topic</Label>
              <Select value={form.topic || 'none'} onValueChange={v => update('topic', v === 'none' ? '' : v)} disabled={!form.subject}>
                <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableTopics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={e => update('date', e.target.value)} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Start Time</Label>
              <Input type="time" value={form.time_start} onChange={e => update('time_start', e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>End Time</Label>
              <Input type="time" value={form.time_end} onChange={e => update('time_end', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => update('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Repeat</Label>
              <Select value={form.repeat} onValueChange={v => update('repeat', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Color Label</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  onClick={() => update('color_label', c.value)}
                  className={`w-8 h-8 rounded-lg ${c.class} ${form.color_label === c.value ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Optional notes" />
          </div>
          <div className="flex items-center justify-between glass-card p-3">
            <Label>Set Reminder</Label>
            <Switch checked={form.reminder} onCheckedChange={v => update('reminder', v)} />
          </div>
          <Button onClick={handleSave} disabled={!form.title} className="w-full">
            {editingTask ? 'Update Task' : 'Add Task'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}