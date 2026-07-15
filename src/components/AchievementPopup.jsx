import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function AchievementPopup({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(true);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(), 350);
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed top-4 left-3 right-3 md:left-auto md:right-4 md:w-96 z-[100]">
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(e, info) => { if (Math.abs(info.offset.x) > 100) dismiss(); }}
            className="relative glass-card-strong p-4 pr-10 cursor-grab active:cursor-grabbing overflow-hidden"
          >
            {/* Gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-transparent pointer-events-none" />

            <button
              onClick={dismiss}
              className="absolute top-2.5 right-2.5 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="flex items-start gap-3 relative">
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="text-3xl flex-shrink-0 leading-none mt-0.5"
              >
                {achievement?.icon || '🎉'}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">{achievement?.title || 'Achievement Unlocked!'}</p>
                <p className="text-xs text-muted-foreground mt-1">{achievement?.description || 'Keep going!'}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">Swipe to dismiss</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}