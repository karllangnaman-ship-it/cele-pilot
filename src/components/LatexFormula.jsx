import React, { useMemo } from 'react';
import katex from 'katex';
import { normalizeEngineeringNotation } from '@/lib/engineeringNotation';
export { default as MathRenderer } from '@/components/MathRenderer';
import MathRenderer from '@/components/MathRenderer';

const render = (latex, displayMode) => {
  try { return katex.renderToString(normalizeEngineeringNotation(latex), { displayMode, throwOnError: true, strict: 'ignore' }); }
  catch (error) { console.warn('[LaTeX] Render failed; showing plain text.', { latex, error }); return null; }
};

/** Renders a field whose entire raw value is LaTeX, such as a formula. */
export default function LatexFormula({ value, className = '' }) {
  const html = useMemo(() => render(String(value || ''), true), [value]);
  if (!value) return null;
  if (!html) return <div className={`whitespace-pre-wrap ${className}`}>{value}</div>;
  return <div className={`overflow-x-auto py-1 ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Renders a field whose entire raw value is inline LaTeX, such as a variable symbol or unit. */
export function LatexInline({ value, className = '' }) {
  const html = useMemo(() => render(String(value || ''), false), [value]);
  if (!value) return null;
  if (!html) return <span className={className}>{value}</span>;
  return <span className={`inline-block align-middle ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Renders prose containing $...$, $$...$$, \(...\), or \[...\] math delimiters. */
/** @deprecated Compatibility alias for the shared MathRenderer. */
export const LatexText = MathRenderer;
