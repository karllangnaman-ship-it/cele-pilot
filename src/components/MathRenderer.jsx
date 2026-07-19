import React, { memo, useMemo } from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { normalizeEngineeringNotation } from '@/lib/engineeringNotation';

const mathToken = /\\[a-zA-Z]+(?:\s*(?:\{[^{}]*\}|[_^](?:\{[^{}]*\}|[a-zA-Z0-9])))*|\b(?:alpha|beta|gamma|delta|Delta|epsilon|varepsilon|zeta|eta|theta|Theta|lambda|Lambda|mu|nu|xi|pi|Pi|rho|sigma|Sigma|tau|phi|Phi|chi|psi|Psi|omega|Omega)(?:\s*=\s*[A-Za-z0-9/]+)?\b|\b(?:sqrt|vec)\([^)]*\)|\b[A-Za-z]+(?:\/[A-Za-z]+)?\^(?:\{[^{}]*\}|[A-Za-z0-9]+)|\b(?:[FMVPNTEI][xyz12]|(?:sigma|tau)[xyz]{1,2})\b|[αβγδΔεθΘλΛμνξπΠρσΣτφΦχψΨωΩ×÷≠≈≤≥±∓∞∝∂∇∫∬∭∮∑∏√∛∜°∠⊥∥⇒⇔→←↔]/g;
const delimiters = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;

const renderMath = (latex, displayMode) => {
  try {
    const normalized = normalizeEngineeringNotation(latex)
      .replace(/\\begin\{(?:align\*?|split|gather\*?|equation\*?)\}/g, '\\begin{aligned}')
      .replace(/\\end\{(?:align\*?|split|gather\*?|equation\*?)\}/g, '\\end{aligned}');
    return katex.renderToString(normalized, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
      trust: false,
    });
  } catch {
    return null;
  }
};

function MathRenderer({ value, className = '' }) {
  const parts = useMemo(() => String(value ?? '').split(delimiters), [value]);
  if (value === null || value === undefined || value === '') return null;
  const renderBareMath = (text, partIndex) => {
    const fragments = text.split(mathToken);
    const matches = text.match(mathToken) || [];
    if (!matches.length) return text;
    return fragments.flatMap((fragment, index) => {
      const expression = matches[index];
      const html = expression && renderMath(expression, false);
      return [<React.Fragment key={`${partIndex}-text-${index}`}>{fragment}</React.Fragment>, html ? <span key={`${partIndex}-math-${index}`} className="inline-block align-middle" dangerouslySetInnerHTML={{ __html: html }} /> : expression ? <React.Fragment key={`${partIndex}-raw-${index}`}>{expression}</React.Fragment> : null];
    });
  };
  return <span className={`math-renderer whitespace-pre-wrap ${className}`}>{parts.map((part, index) => {
    const match = part.match(/^\$\$([\s\S]+)\$\$$|^\\\[([\s\S]+)\\\]$|^\\\(([\s\S]+)\\\)$|^\$([^$\n]+)\$$/);
    if (!match) return <React.Fragment key={index}>{renderBareMath(part, index)}</React.Fragment>;
    const display = Boolean(match[1] || match[2]);
    const source = match[1] ?? match[2] ?? match[3] ?? match[4];
    const html = renderMath(source, display);
    return html ? <span key={index} className={display ? 'my-3 block overflow-x-auto' : 'inline-block align-middle'} dangerouslySetInnerHTML={{ __html: html }} /> : <React.Fragment key={index}>{part}</React.Fragment>;
  })}</span>;
}

export default memo(MathRenderer);
