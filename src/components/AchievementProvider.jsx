import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { getAchievementConfig, getRandomQuote } from '@/lib/achievements';
import AchievementPopup from '@/components/AchievementPopup';

const AchievementContext = createContext(null);
export const useAchievement = () => useContext(AchievementContext);

export function AchievementProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);

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

      setQueue(prev => [...prev, ach]);
    } catch (e) {
      // Achievements are non-critical — silently skip
    }
  }, []);

  const handleDismiss = useCallback(async () => {
    if (!current) return;
    try {
      await firebaseApi.entities.Achievement.update(current.id, { read: true, dismissed: true });
    } catch (e) {}
    setCurrent(null);
  }, [current]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      const next = queue[0];
      setQueue(prev => prev.slice(1));
      const timer = setTimeout(() => setCurrent(next), 400);
      return () => clearTimeout(timer);
    }
  }, [current, queue]);

  return (
    <AchievementContext.Provider value={{ triggerAchievement }}>
      {children}
      {current && <AchievementPopup achievement={current} onDismiss={handleDismiss} />}
    </AchievementContext.Provider>
  );
}