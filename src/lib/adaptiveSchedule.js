import { format, parseISO, subDays } from 'date-fns';

const SUBJECTS = ['MSTE', 'HGE', 'PSAD'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const unique = (values) => [...new Set(values.filter(Boolean))];

export function buildLearningAnalytics({ profile, tasks = [], timerHistory = [], flashcardSessions = [], notes = [], reviews = [], selectedDate }) {
  const yesterday = format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd');
  const yesterdayTasks = tasks.filter((task) => task.date === yesterday && !task.is_manual);
  const completed = yesterdayTasks.filter((task) => task.completed);
  const missed = yesterdayTasks.filter((task) => task.skipped || (!task.completed && new Date(`${yesterday}T23:59:59`) < new Date()));
  const plannedMinutes = yesterdayTasks.filter((task) => task.type === 'study').reduce((sum, task) => sum + Number(task.duration_minutes || 0), 0);
  const actualMinutes = timerHistory.filter((entry) => entry.date === yesterday && entry.completed)
    .reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0);
  const finishedTasks = tasks.filter((task) => task.completed || task.skipped);
  const completionRate = finishedTasks.length ? Math.round(tasks.filter((task) => task.completed).length / finishedTasks.length * 100) : 0;
  const studySessions = timerHistory.filter((entry) => entry.completed && entry.timer_type === 'study');
  const averageStudyDuration = studySessions.length ? Math.round(studySessions.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0) / studySessions.length) : Number(profile.session_duration || 50);
  const cards = flashcardSessions.reduce((total, session) => total + Number(session.cards_reviewed || 0), 0);
  const flashcardSuccessRate = cards ? Math.round(flashcardSessions.reduce((total, session) => total + Number(session.correct || 0), 0) / cards * 100) : 0;

  const subjectMinutes = Object.fromEntries(SUBJECTS.map((subject) => [subject, 0]));
  SUBJECTS.forEach((subject) => {
    subjectMinutes[subject] = studySessions.filter((entry) => entry.subject === subject)
      .reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0);
  });
  const confidence = Object.fromEntries(SUBJECTS.map((subject) => [subject, Number(profile[`${subject.toLowerCase()}_confidence`] || 5)]));
  const weakestSubject = [...SUBJECTS].sort((a, b) => confidence[a] - confidence[b] || subjectMinutes[a] - subjectMinutes[b])[0];
  const strongestSubject = [...SUBJECTS].sort((a, b) => confidence[b] - confidence[a] || subjectMinutes[b] - subjectMinutes[a])[0];
  const weakTopics = unique([
    ...(profile.weak_topics_mste || []), ...(profile.weak_topics_hge || []), ...(profile.weak_topics_psad || []),
    ...reviews.flatMap((review) => review.weak_topics || []),
  ]).slice(0, 8);
  const strongTopics = unique([
    ...(profile.strong_topics_mste || []), ...(profile.strong_topics_hge || []), ...(profile.strong_topics_psad || []),
    ...reviews.flatMap((review) => review.strong_topics || []),
  ]).slice(0, 8);
  const noteCountYesterday = notes.filter((note) => (note.date || note.created_at || '').slice(0, 10) === yesterday).length;
  const dates = new Set(tasks.filter((task) => task.completed).map((task) => task.date));
  let reviewStreak = 0;
  for (let i = 0; i < 365; i += 1) { const date = format(subDays(parseISO(selectedDate), i + 1), 'yyyy-MM-dd'); if (!dates.has(date)) break; reviewStreak += 1; }
  const yesterdayReview = reviews.filter((review) => review.date === yesterday).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];

  return {
    yesterday, yesterdaySummary: { plannedMinutes, actualMinutes, completionRate: yesterdayTasks.length ? Math.round(completed.length / yesterdayTasks.length * 100) : 0, completedTasks: completed.length, missedTasks: missed.length, subjects: unique(completed.map((task) => task.subject)), noteCount: noteCountYesterday, mood: yesterdayReview?.mood || null, reflection: yesterdayReview?.reflection || null },
    completionRate, reviewStreak, weakestSubject, strongestSubject, averageStudyDuration, flashcardSuccessRate, subjectMinutes, weakTopics, strongTopics,
  };
}

export function buildAdaptiveFallback(profile, selectedDate, manualSlots, analytics, variant = 0, targetStudyMinutes = null) {
  const timeToMinutes = (value) => { const [hour, minute] = (value || '06:00').split(':').map(Number); return hour * 60 + minute; };
  const time = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const overlaps = (start, end, slot) => start < slot.end && end > slot.start;
  const manual = manualSlots.map((task) => ({ start: timeToMinutes(task.time_start), end: timeToMinutes(task.time_end) }));
  const start = timeToMinutes(profile.wake_up_time); const end = timeToMinutes(profile.bed_time);
  const session = clamp(Number(profile.session_duration || 50), 25, 90); const pause = Number(profile.break_duration || 15);
  const total = targetStudyMinutes || Math.min(Number(profile.available_hours || 6) * 60, Math.max(0, end - start - 150));
  const order = [...SUBJECTS]; const weakIndex = order.indexOf(analytics.weakestSubject);
  order.splice(weakIndex, 1); order.unshift(analytics.weakestSubject);
  const rotation = (new Date(`${selectedDate}T12:00:00`).getDay() + variant) % order.length;
  const subjects = [...order.slice(rotation), ...order.slice(0, rotation)];
  const tasks = []; const add = (title, subject, type, from, to, topic = '') => { if (to <= end && !manual.some((slot) => overlaps(from, to, slot))) tasks.push({ title, subject, type, time_start: time(from), time_end: time(to), duration_minutes: to - from, topic }); };
  add('Wake up', '', 'wake_up', start, start + 20);
  let cursor = start + 35; let remaining = total; let index = 0;
  while (remaining >= 25 && cursor + 25 <= end - 40) {
    const duration = Math.min(session, remaining); const subject = subjects[index % subjects.length]; const topic = subject === analytics.weakestSubject ? analytics.weakTopics[0] || 'targeted weak-topic practice' : analytics.strongTopics[0] || 'mixed review';
    add(index % 3 === 2 ? `${subject} timed practice` : `${subject} ${topic}`, subject, 'study', cursor, cursor + duration, topic);
    cursor += duration; remaining -= duration; index += 1;
    if (remaining >= 20) { const isReview = index % 2 === 0; add(isReview ? 'Spaced repetition flashcards' : 'Recovery break', '', isReview ? 'flashcard' : 'break', cursor, cursor + (isReview ? 20 : pause)); cursor += isReview ? 20 : pause; }
  }
  add('Daily reflection', '', 'reflection', Math.max(cursor + 10, end - 55), end - 30);
  add('Sleep routine', '', 'sleep', end - 30, end);
  return tasks.sort((a, b) => a.time_start.localeCompare(b.time_start));
}
