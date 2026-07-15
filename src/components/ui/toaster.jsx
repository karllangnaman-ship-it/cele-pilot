import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { firebaseApi } from '@/api/firebaseClient';

const icons = { destructive: XCircle, warning: AlertTriangle, info: Info, default: CheckCircle2 };

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const saved = useRef(new Set());
  const records = useRef(new Map());
  useEffect(() => {
    const item = toasts[0];
    if (!item) return undefined;
    if (!saved.current.has(item.id)) {
      saved.current.add(item.id);
      firebaseApi.auth.me().then(user => firebaseApi.entities.Notification.create({ user_id: user.id, title: item.title || 'Notification', description: item.description || '', type: item.variant || 'default', read: false, event_key: item.dedupeKey || `${item.title}:${item.description || ''}` })).then(record => records.current.set(item.id, record.id)).catch(() => {});
      if (navigator.vibrate && item.vibrate !== false) navigator.vibrate(12);
    }
    const timer = setTimeout(() => dismiss(item.id), item.duration || 5000);
    return () => { clearTimeout(timer); const recordId = records.current.get(item.id); if (recordId) firebaseApi.entities.Notification.update(recordId, { read: true }).catch(() => {}); };
  }, [toasts, dismiss]);
  return <div className="fixed top-4 left-3 right-3 z-[100] md:left-auto md:right-4 md:w-96" aria-live="polite" aria-atomic="true">
    <AnimatePresence mode="wait">{toasts.map(({ id, title, description, variant = 'default' }) => {
      const Icon = icons[variant] || icons.default;
      return <motion.div key={id} role="status" initial={{ opacity: 0, y: -28, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 80, scale: .94 }} transition={{ duration: .3 }} drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 80) dismiss(id); }} className="glass-card-strong relative overflow-hidden p-4 pr-11 shadow-2xl cursor-grab active:cursor-grabbing">
        <div className={`absolute inset-y-0 left-0 w-1 ${variant === 'destructive' ? 'bg-red-500' : variant === 'warning' ? 'bg-amber-500' : 'bg-primary'}`} />
        <div className="flex gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">{title}</p>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div></div>
        <button onClick={() => dismiss(id)} className="absolute right-2 top-2 rounded-full p-2 hover:bg-muted" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
      </motion.div>;
    })}</AnimatePresence>
  </div>;
}
