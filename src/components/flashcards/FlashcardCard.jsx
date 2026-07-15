import React, { useMemo } from 'react';
import { Star, Pin } from 'lucide-react';

const SUBJECT_COLORS = {
  MSTE: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  HGE: 'bg-green-500/15 text-green-600 dark:text-green-400',
  PSAD: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
};

const TYPE_LABELS = {
  qa: 'Q&A', definition: 'Def', formula: 'Formula', fill_blank: 'Fill',
  multiple_choice: 'MC', true_false: 'T/F', identification: 'ID', calculation: 'Calc',
};

export default function FlashcardCard({ card, onEdit, onToggleFavorite, onTogglePin }) {
  const isDue = useMemo(() => {
    if (!card.due_date) return false;
    return card.due_date <= new Date().toISOString().split('T')[0];
  }, [card.due_date]);

  return (
    <div
      className="glass-card p-4 cursor-pointer hover:shadow-lg transition-shadow group"
      onClick={() => onEdit(card)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SUBJECT_COLORS[card.subject] || 'bg-muted text-muted-foreground'}`}>
            {card.subject}
          </span>
          {card.card_type && card.card_type !== 'qa' && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {TYPE_LABELS[card.card_type] || card.card_type}
            </span>
          )}
          {card.is_ai_generated && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              AI
            </span>
          )}
          {isDue && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
              Due
            </span>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(card); }}
            className={`p-1 rounded hover:bg-muted ${card.is_pinned ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Pin className="w-3.5 h-3.5" fill={card.is_pinned ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(card); }}
            className={`p-1 rounded hover:bg-muted ${card.is_favorite ? 'text-amber-500' : 'text-muted-foreground'}`}
          >
            <Star className="w-3.5 h-3.5" fill={card.is_favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      <p className="text-sm font-medium line-clamp-2 mb-1">{card.question}</p>
      <p className="text-xs text-muted-foreground line-clamp-2">{card.answer}</p>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground">Reviewed {card.times_reviewed || 0}×</span>
        {card.mastered && <span className="text-[10px] text-green-500 font-medium">Mastered</span>}
      </div>
    </div>
  );
}