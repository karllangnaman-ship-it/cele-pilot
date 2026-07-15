import { useState, useEffect, useCallback } from 'react';
import { firebaseApi } from '@/api/firebaseClient';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    firebaseApi.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return { user, loading };
}

export function useUserEntity(Entity, extraFilter = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useCurrentUser();

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const items = await Entity.filter({ user_id: user.id, ...extraFilter });
    setData(items);
    setLoading(false);
  }, [user, Entity]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  return { data, loading, refresh, user };
}