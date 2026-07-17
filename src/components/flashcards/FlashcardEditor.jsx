import React, { useState, useEffect } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sparkles, Wand2, Minimize2, Lightbulb, TrendingUp, TrendingDown, Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { LatexText } from '@/components/LatexFormula';

const CARD_TYPES = [
  { value: 'qa', label: 'Question & Answer' },
  { value: 'definition', label: 'Definition' },
  { value: 'formula', label: 'Formula' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True or False' },
  { value: 'identification', label: 'Identification' },
  { value: 'calculation', label: 'Calculation' },
];

const AI_ENHANCEMENTS = [
  { key: 'improve', label: 'Improve Answer', icon: Sparkles, prompt: 'Improve this flashcard answer to be more accurate and clear. Keep it concise (1-3 sentences). Highlight keywords in **bold**.' },
  { key: 'simplify', label: 'Simplify Answer', icon: Minimize2, prompt: 'Simplify this flashcard answer to be easier to understand. Keep it very short.' },
  { key: 'shorten', label: 'Shorten Answer', icon: Minimize2, prompt: 'Shorten this flashcard answer to one concise sentence max.' },
  { key: 'explain', label: 'Add Explanation', icon: Lightbulb, prompt: 'Add a brief explanation to help understand this flashcard. Put it in the explanation field.' },
  { key: 'harder', label: 'Harder Question', icon: TrendingUp, prompt: 'Rewrite the question to be more challenging and analytical for CELE exam level.' },
  { key: 'easier', label: 'Easier Question', icon: TrendingDown, prompt: 'Rewrite the question to be simpler and more direct.' },
];

export default function FlashcardEditor({ card, open, onClose, onSave, onDelete, onDuplicate }) {
  const [draft, setDraft] = useState(card || {});
  const [aiLoading, setAiLoading] = useState(null);
  const { toast } = useToast();

  useEffect(() => { setDraft(card || {}); }, [card]);

  if (!card) return null;

  const runAI = async (enhancement) => {
    setAiLoading(enhancement.key);
    try {
      const result = await firebaseApi.integrations.Core.InvokeLLM({
        prompt: `${enhancement.prompt}\n\nQuestion: ${draft.question}\nAnswer: ${draft.answer}`,
        response_json_schema: {
          type: "object",
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
            explanation: { type: "string" },
          }
        }
      });
      setDraft(prev => ({
        ...prev,
        question: enhancement.key === 'harder' || enhancement.key === 'easier' ? (result.question || prev.question) : prev.question,
        answer: ['improve', 'simplify', 'shorten'].includes(enhancement.key) ? (result.answer || prev.answer) : prev.answer,
        explanation: enhancement.key === 'explain' ? (result.explanation || prev.explanation) : prev.explanation,
      }));
      toast({ title: `${enhancement.label} applied` });
    } catch {
      toast({ title: 'AI enhancement failed', variant: 'destructive' });
    }
    setAiLoading(null);
  };

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Flashcard</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Question</Label>
            <Textarea value={draft.question || ''} onChange={e => setDraft(p => ({ ...p, question: e.target.value }))} rows={2} />
            {draft.question && <div className="mt-1 rounded bg-muted/40 p-2 text-sm"><LatexText value={draft.question} /></div>}
          </div>
          <div>
            <Label>Answer</Label>
            <Textarea value={draft.answer || ''} onChange={e => setDraft(p => ({ ...p, answer: e.target.value }))} rows={3} />
            {draft.answer && <div className="mt-1 rounded bg-muted/40 p-2 text-sm"><LatexText value={draft.answer} /></div>}
          </div>
          <div>
            <Label>Explanation (optional)</Label>
            <Textarea value={draft.explanation || ''} onChange={e => setDraft(p => ({ ...p, explanation: e.target.value }))} rows={2} />
            {draft.explanation && <div className="mt-1 rounded bg-muted/40 p-2 text-sm"><LatexText value={draft.explanation} /></div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Subject</Label>
              <Select value={draft.subject || 'MSTE'} onValueChange={v => setDraft(p => ({ ...p, subject: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MSTE">MSTE</SelectItem>
                  <SelectItem value="HGE">HGE</SelectItem>
                  <SelectItem value="PSAD">PSAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={draft.difficulty || 'medium'} onValueChange={v => setDraft(p => ({ ...p, difficulty: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Card Type</Label>
            <Select value={draft.card_type || 'qa'} onValueChange={v => setDraft(p => ({ ...p, card_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">AI Enhancement</Label>
            <div className="flex flex-wrap gap-2">
              {AI_ENHANCEMENTS.map(a => (
                <Button key={a.key} variant="outline" size="sm" onClick={() => runAI(a)} disabled={aiLoading !== null}>
                  {aiLoading === a.key ? <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <a.icon className="w-3.5 h-3.5" />}
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 mr-auto">
            <Button variant="outline" size="sm" onClick={() => onDuplicate(card)}><Copy className="w-4 h-4" /> Duplicate</Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(card)} className="text-destructive"><Trash2 className="w-4 h-4" /> Delete</Button>
          </div>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}><Wand2 className="w-4 h-4" /> Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
