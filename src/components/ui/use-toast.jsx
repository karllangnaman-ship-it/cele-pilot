import { useEffect, useState } from 'react';

let count = 0;
let state = { toasts: [], queue: [] };
const listeners = new Set();
const recentKeys = new Map();
const emit = () => listeners.forEach(listener => listener(state));

function remove(id) {
  const queue = state.queue;
  state = { toasts: queue.length ? [queue[0]] : [], queue: queue.slice(1) };
  emit();
}

export function toast(props) {
  const key = props.dedupeKey || `${props.variant || 'default'}:${props.title || ''}:${props.description || ''}`;
  const now = Date.now();
  if (recentKeys.get(key) && now - recentKeys.get(key) < 6000) return { id: null, dismiss: () => {}, update: () => {} };
  recentKeys.set(key, now);
  const item = { ...props, id: String(++count), open: true };
  state = state.toasts.length ? { ...state, queue: [...state.queue, item] } : { ...state, toasts: [item] };
  emit();
  return { id: item.id, dismiss: () => dismiss(item.id), update: () => {} };
}

export function dismiss(id) {
  if (!state.toasts.some(item => item.id === id)) return;
  remove(id);
}

export function useToast() {
  const [value, setValue] = useState(state);
  useEffect(() => { listeners.add(setValue); return () => listeners.delete(setValue); }, []);
  return { ...value, toast, dismiss };
}
