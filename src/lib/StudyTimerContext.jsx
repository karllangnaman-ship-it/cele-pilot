import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { firebaseApi } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';

const StudyTimerContext = createContext(null);
const cacheKey = (uid) => `cele-study-timer:${uid}`;
const readCache = (uid) => { try { return JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null'); } catch { return null; } };
const writeCache = (uid, state) => { try { localStorage.setItem(cacheKey(uid), JSON.stringify(state)); } catch { /* unavailable */ } };
const remainingFor = (state, now = Date.now()) => {
  if (!state) return 0;
  if (!state.is_running) return Math.max(0, Number(state.remaining_seconds || 0));
  return Math.max(0, Math.ceil((new Date(state.expected_finish_at).getTime() - now) / 1000));
};

export function StudyTimerProvider({ children }) {
  const { user } = useAuth();
  const [timer, setTimer] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [completionNotice, setCompletionNotice] = useState(false);
  const finishing = useRef(false);

  const apply = useCallback((next) => {
    setTimer(next);
    if (user?.id && next) writeCache(user.id, next);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) { setTimer(null); return undefined; }
    const cached = readCache(user.id);
    if (cached) apply(cached); // instant recovery; Firestore remains authoritative.
    const unsubscribe = firebaseApi.studyTimer.subscribe((remote) => {
      if (remote) apply(remote);
    });
    firebaseApi.studyTimer.get().then((remote) => { if (remote) apply(remote); }).catch(() => {});
    return unsubscribe;
  }, [user?.id, apply]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    window.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(interval); window.removeEventListener('visibilitychange', tick); };
  }, []);

  const persist = useCallback((next) => {
    apply(next); // UI never waits for network/Firestore acknowledgement.
    return firebaseApi.studyTimer.save(next).catch((error) => {
      console.error('Timer state was saved locally and will retry through Firestore persistence.', error);
    });
  }, [apply]);

  const start = useCallback(({ totalSeconds, subject = '', timerType = 'study', topic = '', taskId = '' }) => {
    if (!user?.id) return;
    if (timer?.session_id && !timer.is_running && timer.session_start) {
      const remaining = remainingFor(timer);
      persist({ ...timer, is_running: true, remaining_seconds: remaining, expected_finish_at: new Date(Date.now() + remaining * 1000).toISOString() });
      return;
    }
    const startedAt = new Date().toISOString();
    const state = {
      user_id: user.id, total_seconds: totalSeconds, remaining_seconds: totalSeconds,
      is_running: true, started_at: startedAt,
      expected_finish_at: new Date(Date.now() + totalSeconds * 1000).toISOString(),
      session_start: startedAt, paused_count: 0, subject, timer_type: timerType, topic, task_id: taskId,
      session_id: crypto.randomUUID(), completion_saved: false,
    };
    persist(state);
    if (Notification.permission === 'default') Notification.requestPermission();
  }, [persist, timer, user?.id]);

  const pause = useCallback(() => {
    if (!timer?.is_running) return;
    persist({ ...timer, is_running: false, expected_finish_at: null, remaining_seconds: remainingFor(timer), paused_count: Number(timer.paused_count || 0) + 1 });
  }, [persist, timer]);

  const reset = useCallback((overrides = {}) => {
    const total = overrides.totalSeconds || timer?.total_seconds || 50 * 60;
    persist({ ...timer, user_id: user.id, total_seconds: total, remaining_seconds: total, subject: overrides.subject ?? timer?.subject ?? '', timer_type: overrides.timerType ?? timer?.timer_type ?? 'study', is_running: false, expected_finish_at: null, session_start: null, session_id: null, completion_saved: false, paused_count: 0 });
  }, [persist, timer, user?.id]);

  const finish = useCallback(async (completed) => {
    if (!timer || finishing.current) return;
    finishing.current = true;
    const end = new Date();
    const claimed = completed ? await firebaseApi.studyTimer.claimCompletion(timer.session_id) : true;
    if (claimed && timer.session_start) {
      await firebaseApi.studyHistory.save({
        id: timer.session_id, userId: user.id, subject: timer.subject || 'General', topic: timer.topic || '',
        sessionType: timer.timer_type || 'Study', startTime: timer.session_start, endTime: end.toISOString(),
        durationMinutes: Math.max(1, Math.round((timer.total_seconds - remainingFor(timer, end.getTime())) / 60)),
        completed, pausedCount: timer.paused_count || 0, interruptionCount: timer.paused_count || 0, notes: '', date: format(end, 'yyyy-MM-dd'),
      });
      if (completed && timer.task_id) await firebaseApi.entities.StudyTask.update(timer.task_id, { completed: true });
      if (completed) setCompletionNotice(true);
    }
    if (!completed) persist({ ...timer, is_running: false, expected_finish_at: null, remaining_seconds: remainingFor(timer), session_start: null, session_id: null });
    finishing.current = false;
  }, [persist, timer, user?.id]);

  useEffect(() => {
    if (!timer?.is_running || remainingFor(timer, now) > 0) return;
    finish(true).then(() => {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator(); const gain = context.createGain();
        oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = 800; gain.gain.value = 0.3;
        oscillator.start(); window.setTimeout(() => { oscillator.stop(); context.close(); }, 1200);
      } catch { /* audio is optional */ }
    }).catch(() => { finishing.current = false; });
  }, [finish, now, timer]);

  const value = { timer, remaining: remainingFor(timer, now), start, pause, reset, finish, isRunning: Boolean(timer?.is_running), completionNotice, dismissCompletion: () => setCompletionNotice(false) };
  return <StudyTimerContext.Provider value={value}>{children}</StudyTimerContext.Provider>;
}

export const useStudyTimer = () => {
  const context = useContext(StudyTimerContext);
  if (!context) throw new Error('useStudyTimer must be used within StudyTimerProvider');
  return context;
};
