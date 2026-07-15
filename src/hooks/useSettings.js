import { useState, useEffect, useCallback } from 'react';
import { firebaseApi } from '@/api/firebaseClient';

export function useSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    firebaseApi.auth.me().then(u => {
      setUser(u);
      firebaseApi.entities.UserSettings.filter({ user_id: u.id }).then(items => {
        if (items.length > 0) {
          setSettings(items[0]);
        } else {
          firebaseApi.entities.UserSettings.create({ user_id: u.id, dark_mode: true }).then(s => setSettings(s));
        }
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  }, []);

  const updateSettings = useCallback(async (updates) => {
    if (!settings) return;
    const updated = await firebaseApi.entities.UserSettings.update(settings.id, updates);
    setSettings(updated);
    return updated;
  }, [settings]);

  return { settings, loading, updateSettings, user };
}