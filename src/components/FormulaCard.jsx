import React from 'react';
import LatexFormula, { LatexText } from '@/components/LatexFormula';
import RemoteFigure from '@/components/RemoteFigure';

const parseVariables = (formula) => {
  const defined = Array.from({ length: 5 }, (_, index) => { const n = index + 1; return { symbol: formula[`variableSymbol${n}`], meaning: formula[`variableMeaning${n}`], unit: formula[`variableUnit${n}`] }; }).filter((item) => item.symbol && item.meaning && item.unit);
  if (defined.length) return defined;
  return Array.isArray(formula.variables) ? formula.variables : String(formula.variables || '').split(/\n|;/).filter(Boolean).map((value) => { const [symbol, meaning, unit] = value.split(/\s*[|=]\s*/); return { symbol, meaning, unit }; }).filter((item) => item.symbol && item.meaning && item.unit);
};

export default function FormulaCard({ formula, actions }) {
  const variables = parseVariables(formula);
  const folder = formula.folder || formula.topic;
  const subFolder = formula.subFolder || formula.subtopic;
  return <article className="glass-card p-3"><div className="flex justify-between gap-2"><div><h2 className="font-semibold"><LatexText value={formula.name} /></h2><p className="text-xs text-muted-foreground">{formula.subject}{folder ? ` · ${folder}` : ''}{subFolder ? ` · ${subFolder}` : ''}</p></div>{actions}</div>{formula.figureUrl && <div className="mt-3"><RemoteFigure url={formula.figureUrl} label={`${formula.name} figure`} /></div>}<LatexFormula value={formula.formula} className="mt-3 text-lg" />{formula.description && <div className="mt-2 text-sm"><p className="font-medium">Description</p><LatexText value={formula.description} /></div>}{variables.length > 0 && <div className="mt-3 border-t pt-2 text-sm"><p className="font-medium">Where:</p><dl className="mt-1 space-y-1">{variables.map((item, index) => <div className="grid grid-cols-[auto_1fr_auto] gap-2" key={index}><dt><LatexText value={item.symbol} /></dt><dd><LatexText value={item.meaning} /></dd><dd className="text-muted-foreground"><LatexText value={`(${item.unit})`} /></dd></div>)}</dl></div>}{formula.references && <div className="mt-3 text-sm"><span className="font-medium">Reference: </span><LatexText value={formula.references} /></div>}{formula.remarks && <div className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Remarks: </span><LatexText value={formula.remarks} /></div>}{formula.tags?.length > 0 && <div className="mt-2 text-xs text-muted-foreground">Tags: {Array.isArray(formula.tags) ? formula.tags.join(', ') : formula.tags}</div>}</article>;
}
