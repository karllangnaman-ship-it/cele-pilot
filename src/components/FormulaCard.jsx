import React, { useEffect } from "react";
import { GripVertical } from "lucide-react";
import LatexFormula, { LatexInline, LatexText } from "@/components/LatexFormula";
import FigureViewer from "@/components/FigureViewer";
import EngineeringIllustration from '@/components/EngineeringIllustration';

const parseVariables = (formula) => {
  const defined = Array.from({ length: 5 }, (_, index) => {
    const n = index + 1;
    return {
      symbol: formula[`variableSymbol${n}`],
      meaning: formula[`variableMeaning${n}`],
      unit: formula[`variableUnit${n}`],
    };
  }).filter((item) => item.symbol && item.meaning && item.unit);
  if (defined.length) return defined;
  return Array.isArray(formula.variables)
    ? formula.variables
    : String(formula.variables || "")
        .split(/\n|;/)
        .filter(Boolean)
        .map((value) => {
          const [symbol, meaning, unit] = value.split(/\s*[|=]\s*/);
          return { symbol, meaning, unit };
        })
        .filter((item) => item.symbol && item.meaning && item.unit);
};

<<<<<<< HEAD
export default function FormulaCard({ formula, actions, onRegenerateIllustration, illustrating, dragHandleProps, draggableProps, innerRef, isDragging = false }) {
=======
export default function FormulaCard({ formula, actions, onRegenerateIllustration, illustrating, dragHandleProps, draggableProps, innerRef, isDragging }) {
>>>>>>> 71bc133 (stresss)
  const variables = parseVariables(formula);
  const folder = formula.folder || formula.topic;
  const subFolder = formula.subFolder || formula.subtopic;
  const figureUrl = formula.figureUrl || formula.imageUrl || null;
  useEffect(() => {
    if (figureUrl)
      console.info("[Formula] image URL used", {
        formulaId: formula.id,
        formulaName: formula.name,
        figureUrl,
      });
  }, [figureUrl, formula.id, formula.name]);
  return (
<<<<<<< HEAD
    <article ref={innerRef} {...draggableProps} className={`glass-card p-3 transition-shadow duration-200 ${isDragging ? "scale-[1.015] shadow-2xl ring-1 ring-primary/30" : ""}`}>
      <div className="flex justify-between gap-2">
        <div className="flex min-w-0 gap-1">
          {dragHandleProps && <button type="button" aria-label={`Reorder ${formula.name}`} title="Drag to reorder" {...dragHandleProps} className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"><GripVertical className="h-5 w-5" /></button>}
          <div>
=======
    <article ref={innerRef} {...draggableProps} className={`glass-card p-3 transition-all ${isDragging ? 'scale-[1.02] opacity-90 shadow-2xl' : ''}`}>
      <div className="flex justify-between gap-2">
        <div className="flex min-w-0 gap-2"><button type="button" {...dragHandleProps} aria-label={`Drag ${formula.name} to reorder`} title="Drag to reorder" className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"><GripVertical className="h-5 w-5" /></button><div>
>>>>>>> 71bc133 (stresss)
          <h2 className="font-semibold">
            <LatexText value={formula.name} />
          </h2>
          <p className="text-xs text-muted-foreground">
            <LatexText value={formula.subject} />
            {folder && <> · <LatexText value={folder} /></>}
            {subFolder && <> · <LatexText value={subFolder} /></>}
          </p>
<<<<<<< HEAD
          </div>
        </div>
=======
        </div></div>
>>>>>>> 71bc133 (stresss)
        {actions}
      </div>
      {figureUrl && (
        <div className="mt-3">
          <FigureViewer url={figureUrl} label={`${formula.name} figure`} />
        </div>
      )}
      <LatexFormula value={formula.formula} className="mt-3 text-lg" />
      {formula.description && (
        <div className="mt-2 text-sm">
          <p className="font-medium">Description</p>
          <LatexText value={formula.description} />
        </div>
      )}
      {(formula.engineeringIllustrationUrl || illustrating) && <EngineeringIllustration imageUrl={formula.engineeringIllustrationUrl} caption={formula.engineeringIllustrationCaption || `Textbook-style engineering illustration for ${formula.name}.`} generating={illustrating} onRegenerate={onRegenerateIllustration} />}
      {variables.length > 0 && (
        <div className="mt-3 border-t pt-2 text-sm">
          <p className="font-medium">Where:</p>
          <dl className="mt-1 space-y-1">
            {variables.map((item, index) => (
              <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-baseline gap-2" key={index}>
                <dt className="min-w-5">
                  <LatexInline value={item.symbol} />
                </dt>
                <span aria-hidden="true">-</span>
                <dd>
                  <LatexText value={item.meaning} />
                </dd>
                <dd className="justify-self-end whitespace-nowrap text-muted-foreground">
                  (<LatexInline value={item.unit} />)
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {formula.references && (
        <div className="mt-3 text-sm">
          <span className="font-medium">Reference: </span>
          <LatexText value={formula.references} />
        </div>
      )}
      {formula.remarks && (
        <div className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Remarks: </span>
          <LatexText value={formula.remarks} />
        </div>
      )}
      {formula.tags?.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          Tags: <LatexText value={Array.isArray(formula.tags) ? formula.tags.join(", ") : formula.tags} />
        </div>
      )}
    </article>
  );
}
