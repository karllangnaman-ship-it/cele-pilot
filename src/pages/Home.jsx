import React, { useState, useEffect } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Link } from 'react-router-dom';
import { Calendar, Clock, BookOpen, Brain, TrendingUp, Flame, ArrowRight } from 'lucide-react';
import CountdownCard from '@/components/CountdownCard';
import { motion } from 'framer-motion';
import { differenceInDays, format, parseISO } from 'date-fns';

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [todayTasks, setTodayTasks] = useState([]);
  const [stats, setStats] = useState({ completed: 0, total: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const profiles = await firebaseApi.entities.SurveyProfile.filter({ user_id: u.id });
      if (profiles.length > 0) setProfile(profiles[0]);
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const tasks = await firebaseApi.entities.StudyTask.filter({ user_id: u.id, date: today });
      setTodayTasks(tasks);
      
      const allTasks = await firebaseApi.entities.StudyTask.filter({ user_id: u.id });
      const completed = allTasks.filter(t => t.completed).length;
      
      // Calculate streak
      let streak = 0;
      const dates = [...new Set(allTasks.filter(t => t.completed).map(t => t.date))].sort().reverse();
      for (let i = 0; i < dates.length; i++) {
        const expected = new Date();
        expected.setDate(expected.getDate() - i);
        if (dates[i] === format(expected, 'yyyy-MM-dd')) {
          streak++;
        } else break;
      }
      
      setStats({ completed, total: allTasks.length, streak });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const daysRemaining = profile?.exam_date
    ? Math.max(0, differenceInDays(parseISO(profile.exam_date), new Date()))
    : null;
  const totalDays = profile?.review_start_date && profile?.exam_date
    ? differenceInDays(parseISO(profile.exam_date), parseISO(profile.review_start_date))
    : null;
  const progressPct = totalDays ? Math.round(((totalDays - (daysRemaining || 0)) / totalDays) * 100) : 0;

  const completedToday = todayTasks.filter(t => t.completed).length;
  const todayPct = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold">
          {greeting()}, {profile?.nickname || user?.full_name?.split(' ')[0] || 'Student'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          {!profile?.completed ? "Let's set up your study plan" : "Let's make today count"}
        </p>
      </motion.div>

      {/* Setup prompt */}
      {!profile?.completed && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Link to="/survey" className="block glass-card p-6 hover:shadow-xl transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Complete Your Profile</h2>
                <p className="text-sm text-muted-foreground mt-1">Answer a few questions so the AI can create your personalized study plan</p>
              </div>
              <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </motion.div>
      )}

      {/* Countdown Card */}
      {daysRemaining !== null && (
        <CountdownCard examDate={profile.exam_date} reviewStartDate={profile.review_start_date} progressPct={progressPct} />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Flame, label: 'Streak', value: `${stats.streak} days`, color: 'from-orange-500 to-red-500' },
          { icon: TrendingUp, label: 'Completed', value: stats.completed, color: 'from-green-500 to-emerald-500' },
          { icon: Calendar, label: 'Today', value: `${todayPct}%`, color: 'from-blue-500 to-cyan-500' },
          { icon: BookOpen, label: 'Total Tasks', value: stats.total, color: 'from-purple-500 to-pink-500' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
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

      {/* Today's Tasks */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Today's Schedule</h2>
          <Link to="/schedule" className="text-sm text-primary font-medium hover:underline">View All</Link>
        </div>
        {todayTasks.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No tasks for today</p>
            <Link to="/schedule" className="text-sm text-primary font-medium mt-2 inline-block">Generate Schedule</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.slice(0, 5).map(task => (
              <div key={task.id} className={`glass-card p-3 flex items-center gap-3 ${task.completed ? 'opacity-60' : ''}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  task.subject === 'MSTE' ? 'bg-blue-500' :
                  task.subject === 'HGE' ? 'bg-green-500' :
                  task.subject === 'PSAD' ? 'bg-purple-500' : 'bg-muted-foreground'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${task.completed ? 'line-through' : ''}`}>{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.time_start} – {task.time_end}</p>
                </div>
                {task.subject && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{task.subject}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { to: '/timer', icon: Clock, label: 'Start Timer', color: 'from-blue-500 to-cyan-500' },
            { to: '/flashcards', icon: Brain, label: 'Flashcards', color: 'from-purple-500 to-pink-500' },
          ].map(action => (
            <Link key={action.to} to={action.to} className="glass-card p-4 hover:shadow-lg transition-all group">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-2`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-medium">{action.label}</p>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}