import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Pause, RotateCcw, Square, Plus, Minus, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

const displayType = (type) => ({ study: 'Study', short_break: 'Break', long_break: 'Long Break', practice: 'Practice', flashcards: 'Flashcards' }[type] || 'Study');

export default function Timer() {
  const urlParams = new URLSearchParams(window.location.search);
  const subjectParam = urlParams.get('subject') || '';
  const topicParam = urlParams.get('topic') || '';
  const durationParam = Number(urlParams.get('duration')) || 50;
  const taskIdParam = urlParams.get('taskId') || '';
  const [user, setUser] = useState(null);
  const [timerState, setTimerState] = useState(null);
  const [remaining, setRemaining] = useState(durationParam * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [subject, setSubject] = useState(subjectParam);
  const [totalSeconds, setTotalSeconds] = useState(durationParam * 60);
  const [timerType, setTimerType] = useState('study');
  const [customMinutes, setCustomMinutes] = useState('');
  const [sessionStart, setSessionStart] = useState(null);
  const [pausedCount, setPausedCount] = useState(0);
  const intervalRef = useRef(null);
  const savingRef = useRef(false);
  const interactedRef = useRef(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me(); setUser(u);
      firebaseApi.studyHistory.flushPending().catch(() => {});
      const states = await firebaseApi.entities.TimerState.filter({ user_id: u.id });
      if (!states.length) { hydratedRef.current = true; return; }
      const s = states[0]; setTimerState(s);
      if (interactedRef.current) { hydratedRef.current = true; return; }
      const elapsed = s.is_running && s.last_tick_at ? Math.floor((Date.now() - new Date(s.last_tick_at).getTime()) / 1000) : 0;
      const nextRemaining = Math.max(0, (s.remaining_seconds ?? durationParam * 60) - elapsed);
      setRemaining(nextRemaining); setTotalSeconds(s.total_seconds || durationParam * 60);
      setSubject(s.subject || subjectParam); setTimerType(s.timer_type || 'study');
      setSessionStart(s.session_start || null); setPausedCount(s.paused_count || 0);
      if (s.is_running && nextRemaining > 0) setIsRunning(true);
      hydratedRef.current = true;
    }
    load().catch(() => {});
    const sync = () => firebaseApi.studyHistory.flushPending().catch(() => {});
    window.addEventListener('online', sync); return () => window.removeEventListener('online', sync);
  }, []);

  const persistState = useCallback(async (rem, running, overrides = {}) => {
    if (!user) return;
    const data = { user_id: user.id, subject, total_seconds: totalSeconds, remaining_seconds: rem, is_running: running, last_tick_at: new Date().toISOString(), timer_type: timerType, session_start: sessionStart, paused_count: pausedCount, ...overrides };
    const result = timerState ? await firebaseApi.entities.TimerState.update(timerState.id, data) : await firebaseApi.entities.TimerState.create(data);
    setTimerState(result);
  }, [user, subject, totalSeconds, timerType, timerState, sessionStart, pausedCount]);

  const saveSession = useCallback(async (completed) => {
    if (!user || !sessionStart || savingRef.current) return;
    savingRef.current = true;
    try {
      const end = new Date();
      const elapsedSeconds = Math.max(0, totalSeconds - remaining);
      // A manually ended timer can be very short; retain it so a user never loses
      // an intentional session, but do not report it as completed.
      await firebaseApi.studyHistory.save({
        id: crypto.randomUUID(), userId: user.id, subject: subject || 'General', topic: topicParam || '',
        sessionType: displayType(timerType), startTime: sessionStart, endTime: end.toISOString(),
        durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)), completed,
        pausedCount, interruptionCount: pausedCount, notes: '', date: format(end, 'yyyy-MM-dd'),
      });
      if (completed && taskIdParam) await firebaseApi.entities.StudyTask.update(taskIdParam, { completed: true });
      setSessionStart(null); setPausedCount(0);
    } finally { savingRef.current = false; }
  }, [user, sessionStart, totalSeconds, remaining, subject, topicParam, timerType, pausedCount, taskIdParam]);

  const completeTimer = useCallback(async () => {
    setIsRunning(false); clearInterval(intervalRef.current);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 800; gain.gain.value = 0.3; osc.start(); setTimeout(() => { osc.stop(); ctx.close(); }, 1200);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch { /* optional alarm */ }
    await saveSession(true); await persistState(0, false, { session_start: null, paused_count: 0 });
  }, [saveSession, persistState]);

  useEffect(() => {
    if (!isRunning || remaining <= 0) return undefined;
    intervalRef.current = setInterval(() => setRemaining((previous) => {
      if (previous <= 1) { completeTimer(); return 0; }
      return previous - 1;
    }), 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, remaining, completeTimer]);

  useEffect(() => { if (isRunning && remaining % 10 === 0) persistState(remaining, true).catch(() => {}); }, [remaining, isRunning, persistState]);

  const toggleTimer = () => {
    interactedRef.current = true;
    const next = !isRunning;
    const nextStart = next && !sessionStart ? new Date().toISOString() : sessionStart;
    const nextPauses = !next && sessionStart ? pausedCount + 1 : pausedCount;
    setSessionStart(nextStart); setPausedCount(nextPauses); setIsRunning(next);
    persistState(remaining, next, { session_start: nextStart, paused_count: nextPauses }).catch(() => {});
    if (next && Notification.permission === 'default') Notification.requestPermission();
  };
  const endSession = async () => { interactedRef.current = true; setIsRunning(false); await saveSession(false); await persistState(remaining, false, { session_start: null, paused_count: 0 }); };
  const resetTimer = () => { interactedRef.current = true; setIsRunning(false); setRemaining(totalSeconds); setSessionStart(null); setPausedCount(0); persistState(totalSeconds, false, { session_start: null, paused_count: 0 }).catch(() => {}); };
  const adjustTime = (minutes) => { interactedRef.current = true; const total = Math.max(60, totalSeconds + minutes * 60); const rem = Math.max(0, remaining + minutes * 60); setTotalSeconds(total); setRemaining(rem); };
  const setPreset = (mins, type) => { interactedRef.current = true; setIsRunning(false); setTotalSeconds(mins * 60); setRemaining(mins * 60); setTimerType(type); setSessionStart(null); setPausedCount(0); };
  const setCustom = () => { const mins = Number(customMinutes); if (mins > 0) { setPreset(mins, 'study'); setCustomMinutes(''); } };
  const pct = totalSeconds ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 120;

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Study Timer</h1><Button asChild variant="outline" size="sm"><Link to="/study-history"><History className="w-4 h-4 mr-2" />History</Link></Button></div>
    {subject && <div className="text-center"><span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm">{subject}</span></div>}
    <div className="flex justify-center py-4"><div className="relative w-64 h-64"><svg className="w-full h-full -rotate-90" viewBox="0 0 260 260"><circle cx="130" cy="130" r="120" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" /><circle cx="130" cy="130" r="120" fill="none" stroke="url(#gradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - pct / 100 * circumference} className="transition-all duration-1000" /><defs><linearGradient id="gradient"><stop stopColor="#8B5CF6" /><stop offset="100%" stopColor="#3B82F6" /></linearGradient></defs></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-5xl font-bold font-mono tabular-nums">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span><span className="text-sm text-muted-foreground mt-1">{displayType(timerType)}</span></div></div></div>
    <div className="flex justify-center gap-4"><Button variant="outline" size="icon" onClick={resetTimer} className="w-12 h-12 rounded-full"><RotateCcw className="w-5 h-5" /></Button><motion.div whileTap={{ scale: .95 }}><Button onClick={toggleTimer} className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-blue-600">{isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}</Button></motion.div><Button variant="outline" size="icon" onClick={endSession} disabled={!sessionStart} className="w-12 h-12 rounded-full"><Square className="w-5 h-5" /></Button></div>
    <p className="text-center text-xs text-muted-foreground">Square ends and saves this session. Reset discards an unstarted timer.</p>
    <div className="flex justify-center gap-3"><Button variant="outline" size="sm" onClick={() => adjustTime(-5)}><Minus className="w-3 h-3 mr-1" />5m</Button><Button variant="outline" size="sm" onClick={() => adjustTime(5)}><Plus className="w-3 h-3 mr-1" />5m</Button><Button variant="outline" size="sm" onClick={() => adjustTime(10)}><Plus className="w-3 h-3 mr-1" />10m</Button></div>
    <div className="glass-card p-4"><h3 className="text-sm font-semibold mb-3">Quick Presets</h3><div className="grid grid-cols-3 gap-2">{[[25,'study','25m Study'],[50,'study','50m Study'],[90,'study','90m Study'],[5,'short_break','5m Break'],[15,'short_break','15m Break'],[30,'long_break','30m Long Break']].map(([m,t,l]) => <Button key={l} variant="outline" size="sm" onClick={() => setPreset(m,t)}>{l}</Button>)}</div><div className="flex gap-2 mt-3"><Input type="number" placeholder="Custom minutes" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} /><Button variant="outline" onClick={setCustom}>Set</Button></div></div>
    <div className="glass-card p-4"><h3 className="text-sm font-semibold mb-3">Subject</h3><div className="flex gap-2">{['MSTE','HGE','PSAD'].map(s => <Button key={s} variant={subject === s ? 'default' : 'outline'} size="sm" onClick={() => setSubject(s)} className="flex-1">{s}</Button>)}</div></div>
  </div>;
}
