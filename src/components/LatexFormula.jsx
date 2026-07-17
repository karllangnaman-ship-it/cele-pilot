import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { normalizeEngineeringNotation } from '@/lib/engineeringNotation';

const render = (latex, displayMode) => {
  try { return katex.renderToString(normalizeEngineeringNotation(latex), { displayMode, throwOnError: true, strict: 'ignore' }); }
  catch (error) { console.warn('[LaTeX] Render failed; showing plain text.', { latex, error }); return null; }
};
// Recognizes both raw LaTeX commands and common engineering exponents when
// they appear inside otherwise normal prose (for example, `\\sigma` or `m^2`).
const bareLatex = /\\[a-zA-Z]+(?:\s*(?:\{[^{}]*\}|[_^](?:\{[^{}]*\}|[a-zA-Z0-9])))*|\b(?:alpha|beta|gamma|delta|Delta|epsilon|varepsilon|zeta|eta|theta|Theta|lambda|Lambda|mu|nu|xi|pi|Pi|rho|sigma|Sigma|tau|phi|Phi|chi|psi|Psi|omega|Omega)(?:\s*=\s*[A-Za-z0-9/]+)?\b|\b(?:sqrt|vec)\([^)]*\)|\b[A-Za-z]+(?:\/[A-Za-z]+)?\^(?:\{[^{}]*\}|[A-Za-z0-9]+)|\b(?:[FMVP][xyz12]|(?:sigma|tau)[xyz]{1,2})\b|[αβγδΔεθΘλΛμνξπΠρσΣτφΦχψΨωΩ×÷≠≈≤≥±∓∞∝∂∇∫∬∭∮∑∏√∛∜°∠⊥∥⇒⇔→←↔]/g;

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
export function LatexText({ value, className = '' }) {
  const parts = useMemo(() => String(value || '').split(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g), [value]);
  if (!value) return null;
  const renderBareLatex = (text, key) => {
    const fragments = text.split(bareLatex);
    const matches = text.match(bareLatex) || [];
    if (!matches.length) return text;
    return fragments.flatMap((fragment, index) => {
      const latex = matches[index];
      const html = latex && render(latex, false);
      return [<React.Fragment key={`${key}-text-${index}`}>{fragment}</React.Fragment>, html ? <span key={`${key}-latex-${index}`} className="inline-block align-middle" dangerouslySetInnerHTML={{ __html: html }} /> : latex ? <React.Fragment key={`${key}-raw-${index}`}>{latex}</React.Fragment> : null];
    });
  };
  return <span className={`whitespace-pre-wrap ${className}`}>{parts.map((part, index) => {
    const match = part.match(/^\$\$([\s\S]+)\$\$$|^\\\[([\s\S]+)\\\]$|^\\\(([\s\S]+)\\\)$|^\$([^$\n]+)\$$/);
    if (!match) return <React.Fragment key={index}>{renderBareLatex(part, index)}</React.Fragment>;
    const display = Boolean(match[1] || match[2]); const latex = match[1] ?? match[2] ?? match[3] ?? match[4]; const html = render(latex, display);
    return html ? <span key={index} className={display ? 'my-2 block overflow-x-auto' : 'inline-block align-middle'} dangerouslySetInnerHTML={{ __html: html }} /> : <React.Fragment key={index}>{part}</React.Fragment>;
  })}</span>;
}
