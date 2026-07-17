import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const render = (latex, displayMode) => {
  try { return katex.renderToString(latex, { displayMode, throwOnError: true, strict: 'ignore' }); }
  catch (error) { console.warn('[LaTeX] Render failed; showing plain text.', { latex, error }); return null; }
};

/** Renders a field whose entire raw value is LaTeX, such as a formula. */
export default function LatexFormula({ value, className = '' }) {
  const html = useMemo(() => render(String(value || ''), true), [value]);
  if (!value) return null;
  if (!html) return <div className={`whitespace-pre-wrap ${className}`}>{value}</div>;
  return <div className={`overflow-x-auto py-1 ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Renders prose containing $...$, $$...$$, \(...\), or \[...\] math delimiters. */
export function LatexText({ value, className = '' }) {
  const parts = useMemo(() => String(value || '').split(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g), [value]);
  if (!value) return null;
  return <span className={`whitespace-pre-wrap ${className}`}>{parts.map((part, index) => {
    const match = part.match(/^\$\$([\s\S]+)\$\$$|^\\\[([\s\S]+)\\\]$|^\\\(([\s\S]+)\\\)$|^\$([^$\n]+)\$$/);
    if (!match) return <React.Fragment key={index}>{part}</React.Fragment>;
    const display = Boolean(match[1] || match[2]); const latex = match[1] ?? match[2] ?? match[3] ?? match[4]; const html = render(latex, display);
    return html ? <span key={index} className={display ? 'my-2 block overflow-x-auto' : 'inline-block align-middle'} dangerouslySetInnerHTML={{ __html: html }} /> : <React.Fragment key={index}>{part}</React.Fragment>;
  })}</span>;
}
