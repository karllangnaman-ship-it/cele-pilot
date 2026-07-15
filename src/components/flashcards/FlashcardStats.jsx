import React, { useMemo } from 'react';
import { Layers, CheckCircle2, Brain, Clock, Flame, Target } from 'lucide-react';

export default function FlashcardStats({ cards }) {
  const today = new Date().toISOString().split('T')[0];

  const stats = useMemo(() => {
    const total = cards.length;
    const studiedToday = cards.filter(c => c.last_reviewed === today).length;
    const mastered = cards.filter(c => c.mastered).length;
    const dueToday = cards.filter(c => {
      if (!c.due_date) return c.times_reviewed === 0;
      return c.due_date <= today;
    }).length;
    const avgEase = total > 0 ? (cards.reduce((sum, c) => sum + (c.ease_factor || 2.5), 0) / total).toFixed(1) : '—';
    const learning = total - mastered;

    const reviewedDates = [...new Set(cards.filter(c => c.last_reviewed).map(c => c.last_reviewed))].sort().reverse();
    let streak = 0;
    let checkDate = new Date();
    const dateSet = new Set(reviewedDates);
    for (let i = 0; i < 365; i++) {
      const dStr = checkDate.toISOString().split('T')[0];
      if (dateSet.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return { total, studiedToday, mastered, dueToday, avgEase, learning, streak };
  }, [cards, today]);

  const items = [
    { icon: Layers, label: 'Total Cards', value: stats.total, color: 'text-primary' },
    { icon: Clock, label: 'Due Today', value: stats.dueToday, color: 'text-red-500' },
    { icon: CheckCircle2, label: 'Studied Today', value: stats.studiedToday, color: 'text-blue-500' },
    { icon: Brain, label: 'Mastered', value: stats.mastered, color: 'text-green-500' },
    { icon: Target, label: 'Learning', value: stats.learning, color: 'text-amber-500' },
    { icon: Flame, label: 'Study Streak', value: `${stats.streak}d`, color: 'text-orange-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((item, i) => (
        <div key={i} className="glass-card p-4 flex flex-col items-center text-center">
          <item.icon className={`w-6 h-6 mb-2 ${item.color}`} />
          <span className="text-2xl font-bold">{item.value}</span>
          <span className="text-xs text-muted-foreground mt-1">{item.label}</span>
        </div>
      ))}
    </div>
  );
}