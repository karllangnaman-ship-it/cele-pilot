import React from 'react';
import FigureViewer from '@/components/FigureViewer';
import { LatexText } from '@/components/LatexFormula';

/** Canonical situation header used by the bank, practice, exams, and review. */
export default function SituationViewer({ situation, children, className = 'glass-card space-y-3 p-4' }) {
  if (!situation) return null;
  const title = situation.title || situation.externalId || 'Situation';
  const figureUrl = situation.imageUrl || situation.figureUrl;
  return <section className={className}><div><h2 className="font-semibold"><LatexText value={title} /></h2>{situation.figureLabel && <p className="mt-2 text-sm font-medium"><LatexText value={situation.figureLabel} /></p>}{figureUrl && <FigureViewer url={figureUrl} label={situation.figureLabel || title || 'Situation figure'} />}{situation.description && <div className="mt-2 text-sm"><LatexText value={situation.description} /></div>}</div>{children}</section>;
}
