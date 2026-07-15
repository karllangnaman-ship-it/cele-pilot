import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Target } from 'lucide-react';
import { COUNTDOWN_QUOTES } from '@/lib/achievements';

function getTimeRemaining(examDate) {
  if (!examDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, isComplete: false, hasDate: false };
  const target = new Date(examDate);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  const diff = target - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isComplete: true, hasDate: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isComplete: false, hasDate: true };
}

export default function CountdownCard({ examDate, reviewStartDate, progressPct }) {
  const [time, setTime] = useState(getTimeRemaining(examDate));
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    setTime(getTimeRemaining(examDate));
    const interval = setInterval(() => setTime(getTimeRemaining(examDate)), 1000);
    return () => clearInterval(interval);
  }, [examDate]);

  useEffect(() => {
    const interval = setInterval(() => setQuoteIndex(prev => (prev + 1) % COUNTDOWN_QUOTES.length), 6000);
    return () => clearInterval(interval);
  }, []);

  if (!time.hasDate) return null;

  if (time.isComplete) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
          <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }} className="text-5xl mb-3">🎉</motion.p>
          <h2 className="text-lg font-bold">Congratulations!</h2>
          <p className="text-sm mt-2 opacity-90 leading-relaxed">
            Today is your Civil Engineering Licensure Examination. Give it your best—you've prepared for this!
          </p>
        </div>
      </motion.div>
    );
  }

  const units = [
    { label: 'Days', value: time.days },
    { label: 'Hours', value: time.hours },
    { label: 'Minutes', value: time.minutes },
    { label: 'Seconds', value: time.seconds },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium opacity-80">Days Until CELE Exam</p>
          <Target className="w-7 h-7 opacity-40" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {units.map(unit => (
            <div key={unit.label} className="text-center">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-1 min-h-[3.5rem] flex items-center justify-center">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={unit.value}
                    initial={{ y: -12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-2xl md:text-3xl font-bold tabular-nums block"
                  >
                    {String(unit.value).padStart(2, '0')}
                  </motion.span>
                </AnimatePresence>
              </div>
              <p className="text-[10px] md:text-xs opacity-70 mt-1.5 font-medium">{unit.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-4 text-sm">
          <div>
            <p className="opacity-60 text-[10px] uppercase tracking-wide">Review Start</p>
            <p className="font-semibold">{reviewStartDate ? format(parseISO(reviewStartDate), 'MMM d') : '—'}</p>
          </div>
          <div>
            <p className="opacity-60 text-[10px] uppercase tracking-wide">Exam Date</p>
            <p className="font-semibold">{examDate ? format(parseISO(examDate), 'MMM d') : '—'}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="opacity-60 text-[10px] uppercase tracking-wide">Progress</p>
            <p className="font-semibold">{progressPct}%</p>
          </div>
        </div>

        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white/80 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={quoteIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.85, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
            className="text-xs italic mt-4 text-center leading-relaxed"
          >
            "{COUNTDOWN_QUOTES[quoteIndex]}"
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}