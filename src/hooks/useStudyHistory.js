import { useEffect, useState } from 'react';
import { firebaseApi } from '@/api/firebaseClient';

const sortRecords = (records) => [...records].sort((a, b) => {
  const right = new Date(b.startTime || b.endTime || b.date || 0).getTime();
  const left = new Date(a.startTime || a.endTime || a.date || 0).getTime();
  return right - left;
});

// This is the sole Study History data source for dashboards, lists, filters,
// and management actions. Firestore snapshots keep every consumer current.
export function useStudyHistory(userId) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId) { setRecords([]); setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    firebaseApi.studyHistory.list().then((items) => {
      if (active) { setRecords(sortRecords(items)); setLoading(false); }
    }).catch(() => { if (active) setLoading(false); });
    const unsubscribe = firebaseApi.studyHistory.subscribe((items) => {
      if (active) { setRecords(sortRecords(items)); setLoading(false); }
    });
    return () => { active = false; unsubscribe(); };
  }, [userId]);
  return { records, loading };
}
