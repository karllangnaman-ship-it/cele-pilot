import React, { useState, useEffect, useCallback } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { format, addDays, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Sparkles, ChevronLeft, ChevronRight, Check, SkipForward, Clock, Loader2, CalendarDays, List, Plus, Edit2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import ScheduleCalendar from '@/components/ScheduleCalendar';
import { useAchievement } from '@/components/AchievementProvider';
import ManualTaskDialog from '@/components/ManualTaskDialog';
import { COLOR_CLASSES, PRIORITY_COLORS } from '@/lib/cele-subjects';

const buildFallbackSchedule = (profile, selectedDate, manualSlots) => {
  const start = profile?.wake_up_time ? profile.wake_up_time : '06:00';
  const end = profile?.bed_time ? profile.bed_time : '22:00';
  const sessionMinutes = Number(profile?.session_duration || 50);
  const breakMinutes = Number(profile?.break_duration || 15);
  const availableHours = Number(profile?.available_hours || 6);

  const parseTime = (value) => {
    const [h, m] = (value || '06:00').split(':').map(Number);
    return h * 60 + m;
  };

  const toTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB;
  const slots = [];
  const dayStart = parseTime(start);
  const dayEnd = parseTime(end);
  const totalMinutes = Math.max(0, dayEnd - dayStart);
  const totalStudyMinutes = Math.min(totalMinutes - 120, availableHours * 60);
  const plannedStudySessions = Math.max(1, Math.floor(totalStudyMinutes / sessionMinutes));

  let current = dayStart + 30;
  const subjects = ['MSTE', 'HGE', 'PSAD'];
  const weakSubjects = [];
  if ((profile?.weak_topics_mste || []).length) weakSubjects.push('MSTE');
  if ((profile?.weak_topics_hge || []).length) weakSubjects.push('HGE');
  if ((profile?.weak_topics_psad || []).length) weakSubjects.push('PSAD');
  const subjectOrder = weakSubjects.length > 0 ? weakSubjects : subjects;

  const manualEntries = (manualSlots || '').split('\n').filter(Boolean).map((line) => {
    const match = line.match(/-\s*(\d{1,2}:\d{2})-(\d{1,2}:\d{2}):\s*(.+)/);
    if (!match) return null;
    return { start: parseTime(match[1]), end: parseTime(match[2]), title: match[3] };
  }).filter(Boolean);

  const isBlocked = (start, end) => manualEntries.some((entry) => overlaps(start, end, entry.start, entry.end));

  const addTask = (title, subject, type, startTime, endTime) => {
    if (isBlocked(startTime, endTime)) return false;
    slots.push({ title, subject, type, time_start: toTime(startTime), time_end: toTime(endTime), duration_minutes: endTime - startTime });
    return true;
  };

  addTask('Wake up', '', 'wake_up', dayStart, dayStart + 30);

  let idx = 0;
  for (let i = 0; i < plannedStudySessions; i += 1) {
    const subject = subjectOrder[idx % subjectOrder.length];
    const sessionStart = current;
    const sessionEnd = sessionStart + sessionMinutes;
    if (sessionEnd > dayEnd) break;
    if (!isBlocked(sessionStart, sessionEnd)) {
      addTask(`${subject} study block`, subject, 'study', sessionStart, sessionEnd);
      current = sessionEnd + breakMinutes;
      idx += 1;
    } else {
      current = sessionEnd + breakMinutes;
    }
  }

  const mealStart = dayStart + 4 * 60 + 30;
  const mealEnd = mealStart + 45;
  addTask('Lunch', '', 'meal', mealStart, mealEnd);

  const breakStart = dayStart + 6 * 60;
  const breakEnd = breakStart + breakMinutes;
  addTask('Break', '', 'break', breakStart, breakEnd);

  const flashStart = dayStart + 7 * 60 + 30;
  const flashEnd = flashStart + 20;
  addTask('Flashcards', '', 'flashcard', flashStart, flashEnd);

  const reviewStart = dayStart + 8 * 60 + 30;
  const reviewEnd = reviewStart + 30;
  addTask('Review notes', '', 'review', reviewStart, reviewEnd);

  const reflectionStart = dayEnd - 45;
  const reflectionEnd = dayEnd;
  addTask('Reflection', '', 'reflection', reflectionStart, reflectionEnd);

  const sleepStart = dayEnd - 30;
  const sleepEnd = dayEnd;
  addTask('Sleep', '', 'sleep', sleepStart, sleepEnd);

  return slots.sort((a, b) => a.time_start.localeCompare(b.time_start));
};

const typeColor = {
  study: 'bg-blue-500', break: 'bg-green-500', meal: 'bg-orange-500',
  exercise: 'bg-red-500', flashcard: 'bg-purple-500', review: 'bg-cyan-500',
  reflection: 'bg-pink-500', sleep: 'bg-indigo-500', wake_up: 'bg-yellow-500', other: 'bg-gray-500'
};

export default function Schedule() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('day');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const { toast } = useToast();
  const { triggerAchievement } = useAchievement();

  useEffect(() => {
    async function init() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const profiles = await firebaseApi.entities.SurveyProfile.filter({ user_id: u.id });
      if (profiles.length > 0) setProfile(profiles[0]);
      setLoading(false);
    }
    init();
  }, []);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    const items = await firebaseApi.entities.StudyTask.filter({ user_id: user.id, date: selectedDate });
    setTasks(items.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')));
  }, [user, selectedDate]);

  const loadAllTasks = useCallback(async () => {
    if (!user) return;
    const items = await firebaseApi.entities.StudyTask.filter({ user_id: user.id });
    setAllTasks(items);
  }, [user]);

  useEffect(() => { if (user) loadAllTasks(); }, [user, loadAllTasks]);
  useEffect(() => { if (user) loadTasks(); }, [user, selectedDate, loadTasks]);

  const generateSchedule = async () => {
    if (!profile?.completed) {
      toast({ title: 'Complete your survey first', description: 'We need your preferences to generate a personalized schedule.' });
      return;
    }
    setGenerating(true);

    const completedTasks = await firebaseApi.entities.StudyTask.filter({ user_id: user.id, completed: true });
    const skippedTasks = await firebaseApi.entities.StudyTask.filter({ user_id: user.id, skipped: true });
    const manualTasks = allTasks.filter(t => t.is_manual && t.date === selectedDate);
    const manualSlots = manualTasks.map(t => `- ${t.time_start}-${t.time_end}: ${t.title}`).join('\n') || 'None';

    const prompt = `You are a CELE (Civil Engineering Licensure Examination) review planner AI. Generate a personalized study schedule for ${selectedDate}.

Student Profile:
- Name: ${profile.name}, Age: ${profile.age}
- Wake up: ${profile.wake_up_time}, Bedtime: ${profile.bed_time}
- Available hours: ${profile.available_hours}h, Session duration: ${profile.session_duration}min, Break: ${profile.break_duration}min
- Learning style: ${profile.learning_style}, Study preference: ${profile.study_preference}
- Focus: ${profile.focus_ability}, Intensity: ${profile.review_intensity}
- MSTE confidence: ${profile.mste_confidence}/10, HGE confidence: ${profile.hge_confidence}/10, PSAD confidence: ${profile.psad_confidence}/10
- Weak MSTE topics: ${(profile.weak_topics_mste || []).join(', ') || 'None specified'}
- Weak HGE topics: ${(profile.weak_topics_hge || []).join(', ') || 'None specified'}
- Weak PSAD topics: ${(profile.weak_topics_psad || []).join(', ') || 'None specified'}
- Strong MSTE topics: ${(profile.strong_topics_mste || []).join(', ') || 'None specified'}
- Strong HGE topics: ${(profile.strong_topics_hge || []).join(', ') || 'None specified'}
- Strong PSAD topics: ${(profile.strong_topics_psad || []).join(', ') || 'None specified'}
- Target score: ${profile.target_score}%
- Exam date: ${profile.exam_date}

Manual tasks already scheduled for this day (DO NOT create study sessions that overlap these time slots):
${manualSlots}

Previously completed tasks: ${completedTasks.length}
Previously skipped tasks: ${skippedTasks.length}

Rules:
- Distribute subjects (MSTE, HGE, PSAD) based on confidence. Lower confidence = more study time.
- PRIORITIZE weak topics by allocating additional study sessions. Use lighter review for strong topics.
- Balance study sessions across MSTE, HGE, and PSAD to ensure all subjects are reviewed before the exam.
- Adapt the plan based on performance: if the user has many skipped tasks (${skippedTasks.length} skipped so far), reschedule unfinished sessions intelligently without creating conflicts.
- Consider the user's learning style (${profile.learning_style}), study preference (${profile.study_preference}), and focus ability (${profile.focus_ability}).
- Ensure weaker subjects get priority while maintaining coverage of all topics.
- Continuously improve future schedules using the user's study habits (completed: ${completedTasks.length}, skipped: ${skippedTasks.length}).
- Do NOT schedule anything during manual task time slots.
- Respect wake-up time and bedtime.
- Include wake up, meals, breaks, exercise, flashcard reviews, reflection, and sleep.
- Use ${profile.session_duration}-minute study sessions.
- Make it realistic and balanced. Do not use a fixed template.
- Each task needs: title, subject (MSTE/HGE/PSAD or empty for non-study), type (study/break/meal/exercise/flashcard/review/reflection/sleep/wake_up/other), time_start (HH:MM), time_end (HH:MM), duration_minutes.

Return a JSON object with a "tasks" array.`;

    let result;
    try {
      result = await firebaseApi.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  subject: { type: "string" },
                  type: { type: "string" },
                  time_start: { type: "string" },
                  time_end: { type: "string" },
                  duration_minutes: { type: "number" }
                }
              }
            }
          }
        }
      });
    } catch (error) {
      result = { tasks: buildFallbackSchedule(profile, selectedDate, manualSlots) };
      toast({
        title: 'Cerebras unavailable, using local plan',
        description: 'A fallback schedule was created based on your saved profile.',
      });
    }

    // Delete existing AI tasks for this date (keep manual tasks)
    const existing = await firebaseApi.entities.StudyTask.filter({ user_id: user.id, date: selectedDate });
    for (const t of existing) {
      if (!t.is_manual) await firebaseApi.entities.StudyTask.delete(t.id);
    }

    const newTasks = (result.tasks || []).map(t => ({
      user_id: user.id,
      date: selectedDate,
      title: t.title,
      subject: t.subject || '',
      type: t.type || 'other',
      time_start: t.time_start,
      time_end: t.time_end,
      duration_minutes: t.duration_minutes || 30,
      completed: false,
      skipped: false,
      is_manual: false,
    }));

    if (newTasks.length > 0) {
      await firebaseApi.entities.StudyTask.bulkCreate(newTasks);
    }

    setGenerating(false);
    loadTasks();
    loadAllTasks();
    triggerAchievement(`schedule_generated_${selectedDate}`, undefined, `Your personalized CELE study plan for ${format(parseISO(selectedDate), 'MMMM d')} is ready!`);
  };

  const toggleComplete = async (task) => {
    await firebaseApi.entities.StudyTask.update(task.id, { completed: !task.completed });
    loadTasks();
    loadAllTasks();
    if (!task.completed && task.subject) {
      triggerAchievement(`complete_${task.subject}_${selectedDate}`, undefined, `You completed today's ${task.subject} session! Keep going!`);
    }
  };

  const skipTask = async (task) => {
    await firebaseApi.entities.StudyTask.update(task.id, { skipped: true });
    loadTasks();
    loadAllTasks();
  };

  const handleSaveManualTask = async (taskData) => {
    if (editingTask) {
      await firebaseApi.entities.StudyTask.update(editingTask.id, { ...taskData, is_manual: true });
      toast({ title: 'Task updated' });
    } else {
      await firebaseApi.entities.StudyTask.create({ ...taskData, user_id: user.id, is_manual: true });
      toast({ title: 'Task added' });
    }
    setManualDialogOpen(false);
    setEditingTask(null);
    loadTasks();
    loadAllTasks();
  };

  const handleDeleteTask = async (task) => {
    await firebaseApi.entities.StudyTask.delete(task.id);
    loadTasks();
    loadAllTasks();
    toast({ title: 'Task deleted' });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!profile?.completed) {
    return (
      <div className="text-center py-20">
        <Sparkles className="w-12 h-12 mx-auto text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2">Set Up Your Profile First</h2>
        <p className="text-muted-foreground mb-4">Complete the survey so the AI can create your personalized study plan.</p>
        <Link to="/survey"><Button>Take Survey</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ManualTaskDialog
        open={manualDialogOpen}
        onOpenChange={(open) => { setManualDialogOpen(open); if (!open) setEditingTask(null); }}
        selectedDate={selectedDate}
        editingTask={editingTask}
        onSave={handleSaveManualTask}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <div className="flex gap-2">
          <div className="flex rounded-xl border border-border overflow-hidden">
            <Button variant={viewMode === 'day' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('day')} className="rounded-none">
              <List className="w-4 h-4 mr-1" />Day
            </Button>
            <Button variant={viewMode === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('month')} className="rounded-none">
              <CalendarDays className="w-4 h-4 mr-1" />Month
            </Button>
          </div>
          <Button variant="outline" onClick={() => { setEditingTask(null); setManualDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />Task
          </Button>
          <Button onClick={generateSchedule} disabled={generating} className="bg-gradient-to-r from-purple-600 to-blue-600">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {generating ? 'Generating...' : 'AI Generate'}
          </Button>
        </div>
      </div>

      {/* Month calendar view */}
      {viewMode === 'month' && (
        <>
          <ScheduleCalendar tasks={allTasks} selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setViewMode('day'); }} />
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-2">Tasks on {format(parseISO(selectedDate), 'MMMM d')}</h3>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks scheduled.</p>
            ) : (
              <p className="text-sm text-muted-foreground">{tasks.length} tasks — {tasks.filter(t => t.completed).length} completed</p>
            )}
          </div>
        </>
      )}

      {/* Day view */}
      {viewMode === 'day' && (
        <>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), -1), 'yyyy-MM-dd'))} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-lg font-semibold">{format(parseISO(selectedDate), 'EEEE')}</p>
              <p className="text-sm text-muted-foreground">{format(parseISO(selectedDate), 'MMMM d, yyyy')}</p>
            </div>
            <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Clock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No schedule for this day</p>
              <p className="text-sm text-muted-foreground mt-1">Click "AI Generate" or add a manual task</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`glass-card p-4 flex items-center gap-3 transition-all ${task.completed ? 'opacity-50' : ''} ${task.skipped ? 'opacity-30' : ''}`}
                >
                  <button onClick={() => toggleComplete(task)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${task.completed ? 'bg-primary border-primary' : 'border-muted-foreground/30 hover:border-primary'}`}>
                    {task.completed && <Check className="w-3 h-3 text-primary-foreground" />}
                  </button>
                  <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${task.is_manual ? (COLOR_CLASSES[task.color_label] || 'bg-gray-500') : (typeColor[task.type] || 'bg-gray-500')}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${task.completed ? 'line-through' : ''}`}>{task.title}</p>
                      {task.is_manual && task.priority && (
                        <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority]}`} title={`${task.priority} priority`} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{task.time_start} – {task.time_end}</span>
                      {task.subject && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">{task.subject}</span>}
                      {task.topic && <span className="text-xs text-muted-foreground">{task.topic}</span>}
                      {task.is_manual && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Manual</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!task.completed && !task.skipped && task.type === 'study' && (
                      <Link to={`/timer?subject=${task.subject}&duration=${task.duration_minutes}&taskId=${task.id}`}>
                        <button className="p-2 rounded-lg hover:bg-muted transition-colors"><Clock className="w-4 h-4 text-primary" /></button>
                      </Link>
                    )}
                    {task.is_manual && (
                      <>
                        <button onClick={() => { setEditingTask(task); setManualDialogOpen(true); }} className="p-2 rounded-lg hover:bg-muted transition-colors">
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDeleteTask(task)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </>
                    )}
                    {!task.completed && !task.skipped && !task.is_manual && (
                      <button onClick={() => skipTask(task)} className="p-2 rounded-lg hover:bg-muted transition-colors"><SkipForward className="w-4 h-4 text-muted-foreground" /></button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}