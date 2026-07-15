import React, { useState, useEffect, useRef, useCallback } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Pause, RotateCcw, SkipForward, Plus, Minus, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export default function Timer() {
  const urlParams = new URLSearchParams(window.location.search);
  const subjectParam = urlParams.get('subject') || '';
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
  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  // Load persisted state
  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const states = await firebaseApi.entities.TimerState.filter({ user_id: u.id });
      if (states.length > 0) {
        const s = states[0];
        setTimerState(s);
        if (s.is_running && s.last_tick_at) {
          const elapsed = Math.floor((Date.now() - new Date(s.last_tick_at).getTime()) / 1000);
          const newRemaining = Math.max(0, s.remaining_seconds - elapsed);
          setRemaining(newRemaining);
          setTotalSeconds(s.total_seconds);
          setSubject(s.subject || subjectParam);
          setTimerType(s.timer_type || 'study');
          if (newRemaining > 0) setIsRunning(true);
        } else {
          setRemaining(s.remaining_seconds || durationParam * 60);
          setTotalSeconds(s.total_seconds || durationParam * 60);
          setSubject(s.subject || subjectParam);
          setTimerType(s.timer_type || 'study');
        }
      } else if (subjectParam || durationParam) {
        setRemaining(durationParam * 60);
        setTotalSeconds(durationParam * 60);
      }
    }
    load();
  }, []);

  // Persist timer state
  const persistState = useCallback(async (rem, running) => {
    if (!user) return;
    const data = {
      user_id: user.id,
      subject,
      total_seconds: totalSeconds,
      remaining_seconds: rem,
      is_running: running,
      last_tick_at: new Date().toISOString(),
      timer_type: timerType,
    };
    if (timerState) {
      const updated = await firebaseApi.entities.TimerState.update(timerState.id, data);
      setTimerState(updated);
    } else {
      const created = await firebaseApi.entities.TimerState.create(data);
      setTimerState(created);
    }
  }, [user, subject, totalSeconds, timerType, timerState]);

  // Timer tick
  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            onTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // Persist every 10 seconds
  useEffect(() => {
    if (isRunning && remaining % 10 === 0) {
      persistState(remaining, true);
    }
  }, [remaining, isRunning]);

  const onTimerComplete = async () => {
    // Play alarm
    try {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczEj...');
      // Use Web Audio API for alarm
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 2000);
    } catch (e) {}

    // Try vibration
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

    // Try notification
    if (Notification.permission === 'granted') {
      new Notification('Timer Complete!', { body: `${subject || 'Study'} session finished!` });
    }

    // Save history
    if (user) {
      await firebaseApi.entities.TimerHistory.create({
        user_id: user.id,
        subject: subject || 'General',
        duration_minutes: Math.round(totalSeconds / 60),
        date: format(new Date(), 'yyyy-MM-dd'),
        timer_type: timerType,
        completed: true,
      });

      // Mark task complete if linked
      if (taskIdParam) {
        await firebaseApi.entities.StudyTask.update(taskIdParam, { completed: true });
      }
    }
    persistState(0, false);
  };

  const toggleTimer = () => {
    const next = !isRunning;
    setIsRunning(next);
    persistState(remaining, next);
    if (next && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setRemaining(totalSeconds);
    persistState(totalSeconds, false);
  };

  const adjustTime = (minutes) => {
    const newTotal = Math.max(60, totalSeconds + minutes * 60);
    const newRemaining = Math.max(0, remaining + minutes * 60);
    setTotalSeconds(newTotal);
    setRemaining(newRemaining);
    persistState(newRemaining, isRunning);
  };

  const setPreset = (mins, type) => {
    setIsRunning(false);
    setTotalSeconds(mins * 60);
    setRemaining(mins * 60);
    setTimerType(type);
    persistState(mins * 60, false);
  };

  const setCustom = () => {
    const mins = Number(customMinutes);
    if (mins > 0) {
      setPreset(mins, 'study');
      setCustomMinutes('');
    }
  };

  const pct = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Study Timer</h1>

      {/* Subject label */}
      {subject && (
        <div className="text-center">
          <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm">{subject}</span>
        </div>
      )}

      {/* Timer circle */}
      <div className="flex justify-center py-4">
        <div className="relative w-64 h-64">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
            <circle cx="130" cy="130" r="120" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="130" cy="130" r="120" fill="none"
              stroke="url(#gradient)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold font-mono tabular-nums">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
            <span className="text-sm text-muted-foreground mt-1 capitalize">{timerType.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <Button variant="outline" size="icon" onClick={resetTimer} className="w-12 h-12 rounded-full">
          <RotateCcw className="w-5 h-5" />
        </Button>
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button onClick={toggleTimer} className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
            {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </Button>
        </motion.div>
        <Button variant="outline" size="icon" onClick={() => { setIsRunning(false); onTimerComplete(); }} className="w-12 h-12 rounded-full">
          <SkipForward className="w-5 h-5" />
        </Button>
      </div>

      {/* Adjust time */}
      <div className="flex justify-center gap-3">
        <Button variant="outline" size="sm" onClick={() => adjustTime(-5)}><Minus className="w-3 h-3 mr-1" />5m</Button>
        <Button variant="outline" size="sm" onClick={() => adjustTime(5)}><Plus className="w-3 h-3 mr-1" />5m</Button>
        <Button variant="outline" size="sm" onClick={() => adjustTime(10)}><Plus className="w-3 h-3 mr-1" />10m</Button>
      </div>

      {/* Presets */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">Quick Presets</h3>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreset(25, 'study')}>25m Study</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset(50, 'study')}>50m Study</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset(90, 'study')}>90m Study</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset(5, 'short_break')}>5m Break</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset(15, 'short_break')}>15m Break</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset(30, 'long_break')}>30m Break</Button>
        </div>
        <div className="flex gap-2 mt-3">
          <Input type="number" placeholder="Custom minutes" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} className="flex-1" />
          <Button variant="outline" onClick={setCustom}>Set</Button>
        </div>
      </div>

      {/* Subject selector */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">Subject</h3>
        <div className="flex gap-2">
          {['MSTE', 'HGE', 'PSAD'].map(s => (
            <Button key={s} variant={subject === s ? 'default' : 'outline'} size="sm" onClick={() => setSubject(s)} className="flex-1">{s}</Button>
          ))}
        </div>
      </div>
    </div>
  );
}