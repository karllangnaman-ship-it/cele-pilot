import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Shuffle, RotateCcw, Check, Brain, Clock } from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];

function calculateNextReview(quality, easeFactor, intervalDays) {
  let newEase = easeFactor || 2.5;
  let newInterval;
  switch (quality) {
    case 'again':
      newEase = Math.max(1.3, newEase - 0.3);
      newInterval = 0;
      break;
    case 'hard':
      newEase = Math.max(1.3, newEase - 0.15);
      newInterval = Math.max(1, Math.round((intervalDays || 0) * 1.2));
      break;
    case 'good':
      newInterval = intervalDays === 0 ? 1 : Math.round(intervalDays * newEase);
      break;
    case 'easy':
      newEase = newEase + 0.15;
      newInterval = intervalDays === 0 ? 2 : Math.round(intervalDays * newEase * 1.3);
      break;
  }
  const due = new Date();
  due.setDate(due.getDate() + newInterval);
  return { ease_factor: newEase, interval_days: newInterval, due_date: due.toISOString().split('T')[0], mastered: quality === 'easy' && newInterval >= 21 };
}

const MODES = [
  { key: 'flip', label: 'Flip Cards', icon: RotateCcw, desc: 'Review sequentially' },
  { key: 'shuffle', label: 'Shuffle', icon: Shuffle, desc: 'Random order review' },
  { key: 'spaced', label: 'Spaced Repetition', icon: Brain, desc: 'Cards due for review' },
];

export default function StudySession({ cards, onUpdate, onExit }) {
  const [mode, setMode] = useState(null);
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [results, setResults] = useState(null);
  const today = todayStr();

  const dueCards = useMemo(() => {
    return cards.filter(c => !c.due_date || c.due_date <= today);
  }, [cards, today]);

  const startSession = (selectedMode) => {
    let sessionDeck;
    if (selectedMode === 'spaced') {
      sessionDeck = [...dueCards];
    } else {
      sessionDeck = [...cards];
    }
    if (selectedMode === 'shuffle') {
      sessionDeck = sessionDeck.sort(() => Math.random() - 0.5);
    }
    if (sessionDeck.length === 0) {
      return;
    }
    setMode(selectedMode);
    setDeck(sessionDeck);
    setIndex(0);
    setFlipped(false);
    setCompleted(0);
    setResults(null);
  };

  const currentCard = deck[index];

  const reviewCard = async (quality) => {
    if (!currentCard) return;
    const next = calculateNextReview(quality, currentCard.ease_factor, currentCard.interval_days);
    const updated = await onUpdate(currentCard.id, {
      ...next,
      times_reviewed: (currentCard.times_reviewed || 0) + 1,
      last_reviewed: today,
    });
    setCompleted(completed + 1);
    if (index < deck.length - 1) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      setResults({ total: deck.length, completed: completed + 1 });
      setMode(null);
    }
  };

  const next = () => {
    if (index < deck.length - 1) { setIndex(index + 1); setFlipped(false); }
    else { setResults({ total: deck.length, completed: completed + 1 }); setMode(null); }
  };

  const prev = () => {
    if (index > 0) { setIndex(index - 1); setFlipped(false); }
  };

  if (results) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold mb-1">Session Complete!</h3>
        <p className="text-muted-foreground mb-4">You reviewed {results.completed} flashcards</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => { setResults(null); setMode(null); }}>Back to Modes</Button>
          <Button variant="outline" onClick={onExit}>Exit Study</Button>
        </div>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MODES.map(m => {
            const count = m.key === 'spaced' ? dueCards.length : cards.length;
            return (
              <button
                key={m.key}
                onClick={() => startSession(m.key)}
                disabled={count === 0}
                className="glass-card p-6 text-center hover:shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <m.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-1">{m.label}</h3>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
                <p className="text-xs font-medium mt-2 text-primary">{count} cards</p>
              </button>
            );
          })}
        </div>
        {dueCards.length > 0 && (
          <div className="glass-card p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <p className="text-sm"><span className="font-semibold">{dueCards.length}</span> cards due for review today</p>
          </div>
        )}
        {cards.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">No flashcards yet. Create or upload some first!</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMode(null)}>← Exit</Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{index + 1} / {deck.length}</span>
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${((index + 1) / deck.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="flex justify-center" style={{ perspective: '1000px' }}>
        <motion.div
          className="w-full max-w-md h-64 cursor-pointer relative"
          onClick={() => setFlipped(!flipped)}
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="absolute inset-0 glass-card p-6 flex flex-col items-center justify-center text-center" style={{ backfaceVisibility: 'hidden' }}>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-3">{currentCard?.subject}</span>
            <p className="text-lg font-medium" dangerouslySetInnerHTML={{ __html: (currentCard?.question || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            <p className="text-xs text-muted-foreground mt-auto pt-4">Tap to flip</p>
          </div>
          <div className="absolute inset-0 glass-card p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary/10 to-blue-500/10" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <p className="text-sm font-medium overflow-y-auto" dangerouslySetInnerHTML={{ __html: (currentCard?.answer || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            {currentCard?.explanation && <p className="text-xs text-muted-foreground mt-3 italic">{currentCard.explanation}</p>}
          </div>
        </motion.div>
      </div>

      {mode === 'spaced' && flipped ? (
        <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
          <Button variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => reviewCard('again')}>
            <span className="text-2xl">⚫</span><span className="text-xs">Again</span>
          </Button>
          <Button variant="outline" className="border-orange-500/30 text-orange-500 hover:bg-orange-500/10" onClick={() => reviewCard('hard')}>
            <span className="text-2xl">🔴</span><span className="text-xs">Hard</span>
          </Button>
          <Button variant="outline" className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10" onClick={() => reviewCard('good')}>
            <span className="text-2xl">🟡</span><span className="text-xs">Good</span>
          </Button>
          <Button variant="outline" className="border-green-500/30 text-green-500 hover:bg-green-500/10" onClick={() => reviewCard('easy')}>
            <span className="text-2xl">🟢</span><span className="text-xs">Easy</span>
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={prev} disabled={index === 0}><ChevronLeft className="w-4 h-4" /></Button>
          {!flipped ? (
            <Button onClick={() => setFlipped(true)} size="sm">Show Answer</Button>
          ) : (
            <Button onClick={next} size="sm">{index < deck.length - 1 ? 'Next Card' : 'Finish'} <ChevronRight className="w-4 h-4" /></Button>
          )}
          <Button variant="outline" size="icon" onClick={next} disabled={index === deck.length - 1}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}