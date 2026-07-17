import React from 'react';
import LatexFormula, { LatexText } from '@/components/LatexFormula';

const parseVariables = (variables) => Array.isArray(variables) ? variables : String(variables || '').split(/\n|;/).filter(Boolean).map((value) => { const [symbol, meaning, unit] = value.split(/\s*[|=]\s*/); return { symbol, meaning, unit }; });

export default function FormulaCard({ formula, actions }) {
  const variables = parseVariables(formula.variables);
  return <article className="glass-card p-3"><div className="flex justify-between gap-2"><div><h2 className="font-semibold"><LatexText value={formula.name} /></h2><p className="text-xs text-muted-foreground">{formula.subject}{formula.topic ? ` · ${formula.topic}` : ''}</p></div>{actions}</div><LatexFormula value={formula.formula} className="mt-2 text-lg" />{formula.description && <div className="text-sm"><LatexText value={formula.description} /></div>}{variables.length > 0 && <div className="mt-2 border-t pt-2 text-sm"><p className="font-medium">Where:</p><dl className="mt-1 space-y-1">{variables.map((item, index) => <div className="grid grid-cols-[auto_1fr_auto] gap-2" key={index}><dt><LatexText value={item.symbol} /></dt><dd><LatexText value={item.meaning || ''} /></dd><dd className="text-muted-foreground"><LatexText value={item.unit || ''} /></dd></div>)}</dl></div>}</article>;
}
