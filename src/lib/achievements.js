export const ACHIEVEMENT_TYPES = {
  schedule_generated: { icon: '🎉', title: 'Schedule Generated!', subtitle: 'Your personalized CELE study plan is ready!' },
  daily_goal: { icon: '📚', title: 'Daily Goal Completed!', subtitle: "You finished all your tasks for today!" },
  study_streak: { icon: '🔥', title: 'Study Streak!', subtitle: "You're on fire! Keep the momentum going!" },
  quiz_completed: { icon: '📝', title: 'Quiz Completed!', subtitle: 'Great job testing your knowledge!' },
  weak_topic_mastered: { icon: '🎯', title: 'Weak Topic Mastered!', subtitle: 'You turned a weakness into a strength!' },
  mock_exam: { icon: '🏅', title: 'Mock Exam Completed!', subtitle: 'One step closer to exam readiness!' },
  achievement_unlocked: { icon: '⭐', title: 'Achievement Unlocked!', subtitle: 'A new milestone reached!' },
  cloud_sync: { icon: '☁️', title: 'Cloud Sync Complete!', subtitle: 'Your data is synced across all devices!' },
  backup_successful: { icon: '💾', title: 'Backup Successful!', subtitle: 'Your data is safely backed up!' },
  welcome_back: { icon: '🚀', title: 'Welcome Back!', subtitle: "Let's continue your CELE journey!" },
};

export const MOTIVATIONAL_QUOTES = [
  "Success is the sum of small efforts repeated every day.",
  "Discipline beats motivation.",
  "Every solved problem brings you closer to your license.",
  "Small progress each day adds up to big results.",
  "Your future as a Civil Engineer starts with today's study session.",
  "Stay consistent. Success is built one day at a time.",
  "The expert in anything was once a beginner.",
  "Don't watch the clock; do what it does — keep going.",
  "Your only limit is the amount of effort you put in.",
  "Dream big, study hard, and never give up on your goals.",
];

export const COUNTDOWN_QUOTES = [
  "Every study session brings you closer to becoming a Civil Engineer.",
  "Stay consistent. Success is built one day at a time.",
  "Your future license starts with today's effort.",
  "The harder you work, the closer you get to your dream.",
  "Preparation is the key to success. Keep going!",
];

export function getRandomQuote() {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
}

export function getAchievementConfig(key) {
  return ACHIEVEMENT_TYPES[key] || ACHIEVEMENT_TYPES.achievement_unlocked;
}