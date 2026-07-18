import React, { useState, useEffect } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { useStudyHistory } from '@/hooks/useStudyHistory';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Clock, BookOpen, Target, Flame, Calendar, Award } from 'lucide-react';
import { format, subDays } from 'date-fns';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export default function Stats() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { records: studyHistory, loading: loadingStudyHistory } = useStudyHistory(user?.id);

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const [t, a, exams] = await Promise.all([
        firebaseApi.entities.StudyTask.filter({ user_id: u.id }),
        firebaseApi.entities.Achievement.filter({ user_id: u.id }),
        firebaseApi.entities.ExamHistory.filter({ user_id: u.id }),
      ]);
      setTasks(t);
      setAchievements(a);
      setExamHistory(exams);
      setLoading(false);
    }
    load();
  }, []);

  if (loading || loadingStudyHistory) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const completedTasks = tasks.filter(t => t.completed);
  const examQuestions = examHistory.flatMap((exam) => exam.questions || []);
  const accuracy = (items) => items.length ? Math.round((items.filter((item) => item.result === 'correct').length / items.length) * 100) : 0;
  const by = (key) => Object.entries(examQuestions.reduce((groups, question) => { const name = question[key] || 'Uncategorized'; (groups[name] ||= []).push(question); return groups; }, {})).map(([name, items]) => ({ name, value: accuracy(items), count: items.length })).sort((a, b) => a.value - b.value);
  const subjectAccuracy = by('subject');
  const topicAccuracy = by('topic');
  const subtopicAccuracy = by('subtopic');
  const averageExamScore = examHistory.length ? Math.round(examHistory.reduce((sum, exam) => sum + Number(exam.percentage || 0), 0) / examHistory.length) : 0;
  const bestExamScore = Math.max(0, ...examHistory.map((exam) => Number(exam.percentage || 0)));
  const totalStudyMinutes = studyHistory.reduce((sum, h) => sum + (h.durationMinutes ?? h.duration_minutes ?? 0), 0);

  // Weekly data
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const dayTasks = tasks.filter(t => t.date === date && t.completed);
    const dayMinutes = studyHistory.filter(h => h.date === date).reduce((sum, h) => sum + (h.durationMinutes ?? h.duration_minutes ?? 0), 0);
    return { day: format(subDays(new Date(), 6 - i), 'EEE'), tasks: dayTasks.length, minutes: dayMinutes };
  });

  // Subject distribution
  const subjectData = ['MSTE', 'HGE', 'PSAD'].map(s => ({
    name: s,
    value: studyHistory.filter(h => h.subject === s).reduce((sum, h) => sum + (h.durationMinutes ?? h.duration_minutes ?? 0), 0),
  })).filter(d => d.value > 0);

  // Streak
  let streak = 0;
  const dates = [...new Set(completedTasks.map(t => t.date))].sort().reverse();
  for (let i = 0; i < dates.length; i++) {
    const expected = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (dates[i] === expected) streak++;
    else break;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Statistics</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { icon: BookOpen, label: 'Tasks Completed', value: completedTasks.length, color: 'from-blue-500 to-cyan-500' },
          { icon: Clock, label: 'Study Hours', value: `${Math.round(totalStudyMinutes / 60)}h`, color: 'from-purple-500 to-pink-500' },
          { icon: Flame, label: 'Current Streak', value: `${streak} days`, color: 'from-orange-500 to-red-500' },
          { icon: Target, label: 'Completion Rate', value: tasks.length > 0 ? `${Math.round((completedTasks.length / tasks.length) * 100)}%` : '0%', color: 'from-green-500 to-emerald-500' },
          { icon: Calendar, label: 'Active Days', value: new Set(completedTasks.map(t => t.date)).size, color: 'from-indigo-500 to-blue-500' },
          { icon: Award, label: 'Achievements', value: achievements.length, color: 'from-yellow-500 to-orange-500' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card p-4"
          >
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {examHistory.length > 0 && (
        <div className="glass-card p-4 space-y-4">
          <div className="flex justify-between"><div><h2 className="font-semibold">Exam Analytics</h2><p className="text-xs text-muted-foreground">Based on completed Practice and Mock Board exams.</p></div><div className="text-right text-sm"><p>Average: <b>{averageExamScore}%</b></p><p>Best: <b>{bestExamScore}%</b></p></div></div>
          <div className="grid gap-3 md:grid-cols-3">
            {[["Accuracy by Subject", subjectAccuracy], ["Accuracy by Topic", topicAccuracy], ["Accuracy by Sub Topic", subtopicAccuracy]].map(([title, groups]) => <div key={title} className="rounded border p-3"><h3 className="text-sm font-medium">{title}</h3><div className="mt-2 space-y-1 text-xs">{groups.slice(0, 5).map((group) => <div className="flex justify-between gap-2" key={group.name}><span className="truncate">{group.name}</span><b>{group.value}%</b></div>)}</div></div>)}
          </div>
          <div className="grid gap-3 md:grid-cols-2 text-sm"><p><span className="text-muted-foreground">Weakest topics:</span> {topicAccuracy.slice(0, 3).map((item) => item.name).join(', ') || '—'}</p><p><span className="text-muted-foreground">Strongest topics:</span> {topicAccuracy.slice(-3).reverse().map((item) => item.name).join(', ') || '—'}</p></div>
        </div>
      )}

      {/* Weekly chart */}
      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold mb-4">This Week</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData}>
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Minutes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Subject distribution */}
      {subjectData.length > 0 && (
        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold mb-4">Subject Distribution</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={subjectData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                  {subjectData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {subjectData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-sm">{d.name}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(d.value / 60)}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent achievements */}
      {achievements.length > 0 && (
        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold mb-3">Recent Achievements</h2>
          <div className="space-y-2">
            {achievements.slice(-5).reverse().map(a => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/50">
                <span className="text-xl">🏆</span>
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
