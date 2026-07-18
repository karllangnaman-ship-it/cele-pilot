import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Pause, RotateCcw, Square, Plus, Minus, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStudyTimer } from '@/lib/StudyTimerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const displayType = (type) => ({ study: 'Study', short_break: 'Break', long_break: 'Long Break', practice: 'Practice', flashcards: 'Flashcards' }[type] || 'Study');

export default function Timer() {
  const [params] = useSearchParams();
  const defaultDuration = (Number(params.get('duration')) || 50) * 60;
  const defaultSubject = params.get('subject') || '';
  const topic = params.get('topic') || '';
  const taskId = params.get('taskId') || '';
  const { timer, remaining, isRunning, start, pause, reset, finish, completionNotice, dismissCompletion } = useStudyTimer();
  const [draft, setDraft] = useState({ totalSeconds: defaultDuration, subject: defaultSubject, timerType: 'study' });
  const [customMinutes, setCustomMinutes] = useState('');
  const active = timer || { ...draft, remaining_seconds: draft.totalSeconds, subject: draft.subject, timer_type: draft.timerType };
  const totalSeconds = active.total_seconds || active.totalSeconds;
  const shownRemaining = timer ? remaining : draft.totalSeconds;
  const pct = totalSeconds ? ((totalSeconds - shownRemaining) / totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 120;
  const setPreset = (minutes, timerType) => {
    if (isRunning) return;
    const next = { totalSeconds: minutes * 60, subject: active.subject || defaultSubject, timerType };
    setDraft(next);
    reset(next);
  };
  const adjust = (minutes) => {
    if (isRunning) return;
    const total = Math.max(60, totalSeconds + minutes * 60);
    const next = { totalSeconds: total, subject: active.subject || defaultSubject, timerType: active.timer_type || active.timerType || 'study' };
    setDraft(next); reset(next);
  };
  const toggle = () => {
    if (isRunning) pause();
    else start({ totalSeconds, subject: active.subject || defaultSubject, timerType: active.timer_type || active.timerType || 'study', topic, taskId });
  };
  const changeSubject = (subject) => {
    const next = { totalSeconds, subject, timerType: active.timer_type || active.timerType || 'study' };
    setDraft(next); if (!isRunning) reset(next);
  };

  return <div className="space-y-6">
    <Dialog open={completionNotice} onOpenChange={(open) => !open && dismissCompletion()}><DialogContent><DialogHeader><DialogTitle>Session complete!</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Your study session has been saved and your dashboard statistics are updating.</p></DialogContent></Dialog>
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Study Timer</h1><Button asChild variant="outline" size="sm"><Link to="/study-history"><History className="w-4 h-4 mr-2" />History</Link></Button></div>
    {active.subject && <div className="text-center"><span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm">{active.subject}</span></div>}
    <div className="flex justify-center py-4"><div className="relative w-64 h-64"><svg className="w-full h-full -rotate-90" viewBox="0 0 260 260"><circle cx="130" cy="130" r="120" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" /><circle cx="130" cy="130" r="120" fill="none" stroke="url(#gradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - pct / 100 * circumference} className="transition-all duration-1000" /><defs><linearGradient id="gradient"><stop stopColor="#8B5CF6" /><stop offset="100%" stopColor="#3B82F6" /></linearGradient></defs></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-5xl font-bold font-mono tabular-nums">{String(Math.floor(shownRemaining / 60)).padStart(2, '0')}:{String(shownRemaining % 60).padStart(2, '0')}</span><span className="text-sm text-muted-foreground mt-1">{displayType(active.timer_type || active.timerType)} · {isRunning ? 'Running' : 'Paused'}</span></div></div></div>
    <div className="flex justify-center gap-4"><Button variant="outline" size="icon" onClick={() => reset({ totalSeconds, subject: active.subject, timerType: active.timer_type || active.timerType })} className="w-12 h-12 rounded-full"><RotateCcw className="w-5 h-5" /></Button><motion.div whileTap={{ scale: .95 }}><Button onClick={toggle} className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-blue-600">{isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}</Button></motion.div><Button variant="outline" size="icon" onClick={() => finish(false)} disabled={!timer?.session_start} className="w-12 h-12 rounded-full"><Square className="w-5 h-5" /></Button></div>
    <p className="text-center text-xs text-muted-foreground">{isRunning ? 'Running and synced across your devices.' : 'Play starts immediately and restores from timestamps.'}</p>
    <div className="flex justify-center gap-3"><Button variant="outline" size="sm" disabled={isRunning} onClick={() => adjust(-5)}><Minus className="w-3 h-3 mr-1" />5m</Button><Button variant="outline" size="sm" disabled={isRunning} onClick={() => adjust(5)}><Plus className="w-3 h-3 mr-1" />5m</Button><Button variant="outline" size="sm" disabled={isRunning} onClick={() => adjust(10)}><Plus className="w-3 h-3 mr-1" />10m</Button></div>
    <div className="glass-card p-4"><h3 className="text-sm font-semibold mb-3">Quick Presets</h3><div className="grid grid-cols-3 gap-2">{[[25,'study','25m Study'],[50,'study','50m Study'],[90,'study','90m Study'],[5,'short_break','5m Break'],[15,'short_break','15m Break'],[30,'long_break','30m Long Break']].map(([m,t,l]) => <Button key={l} disabled={isRunning} variant="outline" size="sm" onClick={() => setPreset(m,t)}>{l}</Button>)}</div><div className="flex gap-2 mt-3"><Input type="number" placeholder="Custom minutes" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} /><Button variant="outline" disabled={isRunning} onClick={() => { const minutes = Number(customMinutes); if (minutes > 0) { setPreset(minutes, 'study'); setCustomMinutes(''); } }}>Set</Button></div></div>
    <div className="glass-card p-4"><h3 className="text-sm font-semibold mb-3">Subject</h3><div className="flex gap-2">{['MSTE','HGE','PSAD'].map(subject => <Button key={subject} disabled={isRunning} variant={active.subject === subject ? 'default' : 'outline'} size="sm" onClick={() => changeSubject(subject)} className="flex-1">{subject}</Button>)}</div></div>
  </div>;
}
