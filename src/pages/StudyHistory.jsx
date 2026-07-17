import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { firebaseApi } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, eachDayOfInterval, format, isSameDay, isValid, isWithinInterval, parseISO, startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { CalendarDays, Search, SlidersHorizontal } from 'lucide-react';

const SUBJECTS = ['All', 'PSAD', 'MSTE', 'HGE'];
const COLORS = { PSAD: '#8b5cf6', MSTE: '#3b82f6', HGE: '#10b981' };
const minutes = (record) => Math.max(0, Number(record?.durationMinutes ?? record?.duration_minutes ?? 0) || 0);
const duration = (value) => { const safe = Math.round(Number(value) || 0); return safe >= 60 ? `${Math.floor(safe / 60)}h${safe % 60 ? ` ${safe % 60}m` : ''}` : `${safe}m`; };
const recordDate = (record) => {
  const value = record?.startTime || record?.endTime || (record?.date ? `${record.date}T12:00:00` : null);
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : typeof value === 'string' ? parseISO(value) : null;
  return date && isValid(date) ? date : null;
};
const dateText = (record, pattern) => { const date = recordDate(record); return date ? format(date, pattern) : '—'; };
const rangeFor = (period, from, to) => {
  const now = new Date();
  if (period === 'today') return { start: startOfDay(now), end: now };
  if (period === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
  if (period === 'month') return { start: startOfMonth(now), end: now };
  const first = from ? parseISO(from) : null; const last = to ? parseISO(to) : null;
  return period === 'custom' && first && last && isValid(first) && isValid(last) ? { start: startOfDay(first), end: addDays(startOfDay(last), 1) } : null;
};

function calculateStats(records) {
  const completed = records.filter((item) => item?.completed && item.sessionType !== 'Break' && item.sessionType !== 'Long Break' && recordDate(item));
  const total = completed.reduce((sum, item) => sum + minutes(item), 0); const now = new Date();
  const after = (start) => completed.filter((item) => recordDate(item) >= start).reduce((sum, item) => sum + minutes(item), 0);
  const dates = new Set(completed.map((item) => format(recordDate(item), 'yyyy-MM-dd'))); let current = 0;
  for (let day = startOfDay(now); dates.has(format(day, 'yyyy-MM-dd')); day = subDays(day, 1)) current += 1;
  let best = 0; let run = 0; let previous = null;
  [...dates].sort().forEach((key) => { const day = parseISO(key); run = previous && Math.round((day - previous) / 86400000) === 1 ? run + 1 : 1; best = Math.max(best, run); previous = day; });
  return { completed, today: after(startOfDay(now)), week: after(startOfWeek(now, { weekStartsOn: 1 })), month: after(startOfMonth(now)), total, average: completed.length ? Math.round(total / completed.length) : 0, longest: Math.max(0, ...completed.map(minutes)), current, best };
}

const LoadingState = () => <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /><p className="text-sm text-muted-foreground">Loading study history…</p></div>;
const EmptyState = () => <div className="glass-card p-10 text-center"><CalendarDays className="w-10 h-10 text-primary mx-auto mb-3" /><h2 className="font-semibold">No study sessions yet.</h2><p className="text-sm text-muted-foreground mt-1 mb-5">Start a timer to build your study history.</p><Button asChild><Link to="/timer">Start Studying</Link></Button></div>;

export default function StudyHistory() {
  const { user, isAuthenticated } = useAuth();
  const [records, setRecords] = useState([]); const [cursor, setCursor] = useState(null); const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [subject, setSubject] = useState('All'); const [period, setPeriod] = useState('all'); const [sort, setSort] = useState('newest'); const [search, setSearch] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [selected, setSelected] = useState(null); const sentinel = useRef(null);
  const load = useCallback(async (nextCursor = null) => {
    if (!user?.id) { setError('Please sign in to view your study history.'); setLoading(false); return; }
    try {
      const page = await firebaseApi.studyHistory.getPage({ cursor: nextCursor, pageSize: 25 });
      const items = Array.isArray(page?.records) ? page.records.filter(Boolean) : [];
      setRecords((old) => nextCursor ? [...old, ...items.filter((item) => !old.some((existing) => existing.id === item.id))] : items);
      setCursor(page?.cursor || null); setHasMore(Boolean(page?.hasMore)); setError('');
    } catch (loadError) { console.error('Unable to load study history.', loadError); setError('We could not load your study history. Please try again.'); }
    finally { setLoading(false); }
  }, [user?.id]);
  useEffect(() => {
    if (!isAuthenticated || !user?.id) { setLoading(false); setError('Please sign in to view your study history.'); return undefined; }
    let active = true; setLoading(true); load();
    let unsubscribe = () => {};
    try { unsubscribe = firebaseApi.studyHistory.subscribe((live) => { if (!active) return; const safe = Array.isArray(live) ? live.filter(Boolean) : []; setRecords((old) => [...safe, ...old.filter((item) => !safe.some((latest) => latest.id === item.id))]); }); }
    catch (subscribeError) { console.error('Unable to subscribe to study history.', subscribeError); setError('Live updates are unavailable.'); }
    return () => { active = false; try { unsubscribe(); } catch (unsubscribeError) { console.error('Unable to stop study history subscription.', unsubscribeError); } };
  }, [isAuthenticated, user?.id, load]);
  useEffect(() => {
    if (!sentinel.current || !hasMore || loading) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) load(cursor); }); observer.observe(sentinel.current); return () => observer.disconnect();
  }, [cursor, hasMore, loading, load]);
  const filtered = useMemo(() => { const range = rangeFor(period, from, to); const needle = search.trim().toLowerCase(); return records.filter((item) => { const date = recordDate(item); return (subject === 'All' || item?.subject === subject) && (!range || (date && isWithinInterval(date, range))) && (!needle || [item?.subject, item?.topic, item?.date].filter(Boolean).join(' ').toLowerCase().includes(needle)); }).sort((a, b) => sort === 'longest' ? minutes(b) - minutes(a) : sort === 'oldest' ? (recordDate(a)?.getTime() || 0) - (recordDate(b)?.getTime() || 0) : (recordDate(b)?.getTime() || 0) - (recordDate(a)?.getTime() || 0)); }, [records, subject, period, from, to, search, sort]);
  const stats = useMemo(() => calculateStats(records), [records]);
  const pie = useMemo(() => ['PSAD', 'MSTE', 'HGE'].map((name) => ({ name, value: stats.completed.filter((item) => item.subject === name).reduce((sum, item) => sum + minutes(item), 0) })), [stats]);
  const daily = useMemo(() => eachDayOfInterval({ start: subDays(startOfDay(new Date()), 6), end: startOfDay(new Date()) }).map((day) => ({ name: format(day, 'EEE'), hours: +(stats.completed.filter((item) => { const date = recordDate(item); return date && isSameDay(date, day); }).reduce((sum, item) => sum + minutes(item), 0) / 60).toFixed(1) })), [stats]);
  if (loading) return <LoadingState />;
  if (error) return <div className="space-y-4"><div className="glass-card p-6 text-center"><h1 className="text-xl font-bold">Study History</h1><p className="text-destructive mt-3">{error}</p><Button className="mt-4" onClick={() => { setError(''); setLoading(true); load(); }}>Try Again</Button></div></div>;
  if (!records.length) return <div className="space-y-5"><h1 className="text-2xl font-bold">Study History</h1><EmptyState /></div>;
  return <div className="space-y-5"><div className="flex items-center gap-3"><div className="flex-1"><h1 className="text-2xl font-bold">Study History</h1><p className="text-sm text-muted-foreground">Your synced study sessions</p></div><CalendarDays className="text-primary" /></div>
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['Today', stats.today], ['This week', stats.week], ['This month', stats.month], ['Total', stats.total]].map(([label, value]) => <div className="glass-card p-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{duration(value)}</p></div>)}</section>
    <section className="glass-card p-4 space-y-3"><div className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /><h2 className="font-semibold">Filters</h2></div><div className="flex gap-2 overflow-x-auto">{SUBJECTS.map((name) => <Button key={name} size="sm" variant={subject === name ? 'default' : 'outline'} onClick={() => setSubject(name)}>{name}</Button>)}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-2"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom dates</option></select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="longest">Longest session</option></select>{period === 'custom' && <><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></>}<div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="Subject, topic, date" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div></section>
    <section className="grid md:grid-cols-2 gap-4"><div className="glass-card p-4"><h2 className="font-semibold">Sessions per subject</h2><div className="h-48"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={70}>{pie.map((item) => <Cell key={item.name} fill={COLORS[item.name]} />)}</Pie><Tooltip formatter={duration} /></PieChart></ResponsiveContainer></div></div><div className="glass-card p-4"><h2 className="font-semibold">Daily study hours</h2><div className="h-52"><ResponsiveContainer><BarChart data={daily}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div></section>
    <section className="space-y-3"><div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Sessions</h2><span className="text-sm text-muted-foreground">{filtered.length} shown</span></div>{filtered.length ? filtered.map((item) => <motion.button layout key={item.id} onClick={() => setSelected(item)} className="w-full text-left glass-card p-4 hover:ring-1 hover:ring-primary/40"><div className="flex justify-between gap-3"><div><p className="font-semibold">📘 {item.subject || 'General'}</p>{item.topic && <p className="text-sm text-muted-foreground">{item.topic}</p>}<p className="mt-2 text-sm">🕒 {dateText(item, 'h:mm a')} - {item.endTime ? dateText({ endTime: item.endTime }, 'h:mm a') : '—'}</p></div><div className="text-right"><p className="font-semibold">⏱ {duration(minutes(item))}</p><p className="text-xs text-muted-foreground mt-2">{dateText(item, 'MMM d, yyyy')}</p></div></div></motion.button>) : <div className="glass-card p-6 text-center text-muted-foreground">No sessions match these filters.</div>}<div ref={sentinel} className="h-8 text-center text-xs text-muted-foreground">{hasMore ? 'Load more as you scroll' : 'End of history'}</div></section>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent>{selected && <><DialogHeader><DialogTitle>{selected.subject || 'Study'} session</DialogTitle></DialogHeader><dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">Topic</dt><dd>{selected.topic || '—'}</dd><dt className="text-muted-foreground">Start</dt><dd>{dateText(selected, 'PPp')}</dd><dt className="text-muted-foreground">End</dt><dd>{selected.endTime ? dateText({ endTime: selected.endTime }, 'PPp') : '—'}</dd><dt className="text-muted-foreground">Duration</dt><dd>{duration(minutes(selected))}</dd><dt className="text-muted-foreground">Break count</dt><dd>{selected.interruptionCount || 0}</dd><dt className="text-muted-foreground">Pause count</dt><dd>{selected.pausedCount || 0}</dd><dt className="text-muted-foreground">Status</dt><dd>{selected.completed ? 'Completed' : 'Ended early'}</dd><dt className="text-muted-foreground">AI Notes</dt><dd>{selected.notes || 'Coming soon'}</dd></dl></>}</DialogContent></Dialog>
  </div>;
}
