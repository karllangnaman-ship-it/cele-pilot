import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScheduleCalendar({ tasks, selectedDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(parseISO(selectedDate));

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const tasksByDate = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [tasks]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{format(viewMonth, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="w-8 h-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewMonth(new Date())} className="h-8">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="w-8 h-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateStr] || [];
          const completed = dayTasks.filter(t => t.completed).length;
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, parseISO(selectedDate));
          const inMonth = isSameMonth(day, viewMonth);
          const hasTasks = dayTasks.length > 0;
          const allDone = hasTasks && completed === dayTasks.length;
          const partial = hasTasks && completed > 0 && completed < dayTasks.length;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`
                relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-all
                ${inMonth ? 'text-foreground' : 'text-muted-foreground/40'}
                ${isSelected ? 'bg-primary text-primary-foreground font-bold' : isToday ? 'bg-primary/10 font-semibold' : 'hover:bg-muted'}
              `}
            >
              <span>{format(day, 'd')}</span>
              {hasTasks && (
                <div className="absolute bottom-1 flex gap-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-primary-foreground' :
                    allDone ? 'bg-green-500' :
                    partial ? 'bg-yellow-500' : 'bg-primary/50'
                  }`} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> All done</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> In progress</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/50" /> Scheduled</span>
      </div>
    </div>
  );
}