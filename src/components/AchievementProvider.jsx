import React, { createContext, useContext, useCallback } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { getAchievementConfig, getRandomQuote } from '@/lib/achievements';
import { toast } from '@/components/ui/use-toast';

const AchievementContext = createContext(null);
export const useAchievement = () => useContext(AchievementContext);

export function AchievementProvider({ children }) {
  const triggerAchievement = useCallback(async (key, customTitle, customDescription) => {
    try {
      const u = await firebaseApi.auth.me();
      const existing = await firebaseApi.entities.Achievement.filter({ user_id: u.id, achievement_key: key });
      if (existing.length > 0) return;

      const config = getAchievementConfig(key);
      const quote = getRandomQuote();
      const title = customTitle || config.title;
      const description = customDescription || quote;

      const ach = await firebaseApi.entities.Achievement.create({
        user_id: u.id,
        achievement_key: key,
        title,
        description,
        icon: config.icon,
        read: false,
        dismissed: false,
        earned_date: new Date().toISOString().split('T')[0],
      });

      toast({ title: 'Achievement unlocked', description: `${ach.icon || '🏅'} ${title}`, dedupeKey: `achievement-${key}` });
    } catch (e) {
      // Achievements are non-critical — silently skip
    }
  }, []);

  return (
    <AchievementContext.Provider value={{ triggerAchievement }}>
      {children}
    </AchievementContext.Provider>
  );
}
