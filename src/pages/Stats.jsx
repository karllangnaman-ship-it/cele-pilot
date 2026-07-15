import React, { useState, useEffect } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Clock, BookOpen, Target, Flame, Calendar, Award } from 'lucide-react';
import { format, subDays } from 'date-fns';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export default function Stats() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [timerHistory, setTimerHistory] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const [t, th, a] = await Promise.all([
        firebaseApi.entities.StudyTask.filter({ user_id: u.id }),
        firebaseApi.entities.TimerHistory.filter({ user_id: u.id }),
        firebaseApi.entities.Achievement.filter({ user_id: u.id }),
      ]);
      setTasks(t);
      setTimerHistory(th);
      setAchievements(a);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const completedTasks = tasks.filter(t => t.completed);
  const totalStudyMinutes = timerHistory.reduce((sum, h) => sum + (h.duration_minutes || 0), 0);

  // Weekly data
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const dayTasks = tasks.filter(t => t.date === date && t.completed);
    const dayMinutes = timerHistory.filter(h => h.date === date).reduce((sum, h) => sum + (h.duration_minutes || 0), 0);
    return { day: format(subDays(new Date(), 6 - i), 'EEE'), tasks: dayTasks.length, minutes: dayMinutes };
  });

  // Subject distribution
  const subjectData = ['MSTE', 'HGE', 'PSAD'].map(s => ({
    name: s,
    value: timerHistory.filter(h => h.subject === s).reduce((sum, h) => sum + (h.duration_minutes || 0), 0),
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