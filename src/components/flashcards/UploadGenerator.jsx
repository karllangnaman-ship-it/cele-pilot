import React, { useState, useRef } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadCloud, FileText, Loader2, Check, X, Sparkles, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ACCEPTED = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.json,.txt,.md,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.zip';
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'oga', 'ogg', 'webm', 'flac'];
const STRUCTURED_EXT = ['csv', 'json', 'xlsx', 'xls'];

const PROGRESS_STEPS = ['Uploading', 'Reading Document', 'Analyzing Content', 'Extracting Questions', 'Generating Flashcards', 'Almost Done'];

const EXTRACTION_PROMPT = `You are an expert Civil Engineering educator creating flashcards for the CELE (Civil Engineering Licensure Examination). Analyze the uploaded document and generate high-quality flashcards.

RULES:
- Read all text. Perform OCR on images and scanned PDFs.
- Detect headings, subtopics, questions, answers, definitions, formulas, and important concepts.
- Intelligently determine the best Question and Answer even if not already formatted as flashcards.
- Rewrite long paragraphs into concise flashcards. Never copy entire paragraphs.
- Keep answers short (1-3 sentences). Prefer bullet points when appropriate. Highlight keywords in **bold** (markdown).
- Preserve equations and mathematical symbols exactly.
- Ignore headers, footers, page numbers, watermarks, and duplicate text.
- Avoid duplicate cards. Merge similar concepts.
- Assign card_type: "qa", "definition", "formula", "fill_blank", "true_false", "multiple_choice", "identification", or "calculation".
- Assign subject: "MSTE", "HGE", or "PSAD". Assign difficulty: "easy", "medium", or "hard".

EXAMPLES:
Input: "Hooke's Law states that stress is directly proportional to strain within the elastic limit."
→ question: "What is Hooke's Law?", answer: "Stress is **directly proportional** to strain within the elastic limit.", card_type: "definition"

Input: "The modulus of elasticity of steel is approximately 200 GPa."
→ question: "What is the modulus of elasticity of steel?", answer: "**200 GPa**", card_type: "qa"

Input: "Concrete gains strength through hydration."
→ question: "Why does concrete gain strength?", answer: "Because of cement **hydration**.", card_type: "qa"

Generate up to 20 flashcards from this document. Return JSON with a "cards" array.`;

const FLASHCARD_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          explanation: { type: "string" },
          subject: { type: "string" },
          card_type: { type: "string" },
          difficulty: { type: "string" },
        }
      }
    }
  }
};

export default function UploadGenerator({ user, onSaved }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [generated, setGenerated] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();

  const handleFiles = (fileList) => {
    setFiles(Array.from(fileList));
    setGenerated([]);
    setSelected(new Set());
  };

  const processFiles = async () => {
    setProcessing(true);
    setProgressStep(0);
    const allCards = [];

    for (const file of files) {
      setProgressStep(0);
      try {
        const { file_url } = await firebaseApi.integrations.Core.UploadFile({ file, folder: 'Flashcards' });
        setProgressStep(1);

        const ext = file.name.split('.').pop().toLowerCase();
        let cards = [];

        if (STRUCTURED_EXT.includes(ext)) {
          setProgressStep(2);
          const extracted = await firebaseApi.integrations.Core.ExtractDataFromUploadedFile({
            file_url,
            json_schema: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
                subject: { type: "string" },
              }
            }
          });
          setProgressStep(4);
          const out = Array.isArray(extracted.output) ? extracted.output : (extracted.output ? [extracted.output] : []);
          cards = out.map(row => ({
            question: row.question || row.Question || row.Q || '',
            answer: row.answer || row.Answer || row.A || '',
            subject: (row.subject || row.Category || row.Subject || 'MSTE').toUpperCase().includes('HGE') ? 'HGE' : (row.subject || '').toUpperCase().includes('PSAD') ? 'PSAD' : 'MSTE',
            card_type: 'qa',
            difficulty: 'medium',
          })).filter(c => c.question && c.answer);
        } else if (AUDIO_EXT.includes(ext)) {
          setProgressStep(2);
          const transcript = await firebaseApi.integrations.Core.TranscribeAudio({ audio_url: file_url });
          setProgressStep(3);
          const result = await firebaseApi.integrations.Core.InvokeLLM({
            prompt: `${EXTRACTION_PROMPT}\n\nTRANSCRIPT:\n${transcript}`,
            response_json_schema: FLASHCARD_SCHEMA
          });
          cards = result.cards || [];
        } else {
          setProgressStep(2);
          const result = await firebaseApi.integrations.Core.InvokeLLM({
            prompt: EXTRACTION_PROMPT,
            file_urls: [file_url],
            response_json_schema: FLASHCARD_SCHEMA
          });
          cards = result.cards || [];
        }

        setProgressStep(5);
        cards.forEach((c, idx) => {
          allCards.push({ ...c, _id: `${file.name}_${idx}` });
        });
      } catch (err) {
        toast({ title: `Failed to process ${file.name}`, variant: 'destructive' });
      }
    }

    setGenerated(allCards);
    setSelected(new Set(allCards.map(c => c._id)));
    setProcessing(false);
    setProgressStep(5);
    if (allCards.length === 0) {
      toast({ title: 'No flashcards could be extracted', variant: 'destructive' });
    }
  };

  const saveSelected = async () => {
    const toSave = generated.filter(c => selected.has(c._id)).map(({ _id, ...c }) => ({
      ...c,
      user_id: user.id,
      is_ai_generated: true,
      subject: ['MSTE', 'HGE', 'PSAD'].includes(c.subject) ? c.subject : 'MSTE',
      card_type: c.card_type || 'qa',
      difficulty: c.difficulty || 'medium',
    }));
    if (toSave.length === 0) return;
    const created = await firebaseApi.entities.Flashcard.bulkCreate(toSave);
    onSaved(created);
    toast({ title: `${created.length} flashcards saved!` });
    setFiles([]);
    setGenerated([]);
    setSelected(new Set());
    setOpen(false);
  };

  const toggleSelect = (id) => {
    setSelected(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)}>
        <UploadCloud className="w-4 h-4 mr-1" /> Upload & Extract
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>AI Flashcard Generator</DialogTitle></DialogHeader>

          {generated.length === 0 ? (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              >
                <UploadCloud className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Drag & drop files or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, Word, PPT, Excel, CSV, JSON, TXT, Images, Audio</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      {!processing && <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}><X className="w-4 h-4 text-muted-foreground" /></button>}
                    </div>
                  ))}
                </div>
              )}

              {processing && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">{PROGRESS_STEPS[progressStep]}...</span>
                  </div>
                  <div className="flex gap-1">
                    {PROGRESS_STEPS.map((_, i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= progressStep ? 'bg-primary' : 'bg-muted'}`} />
                    ))}
                  </div>
                </div>
              )}

              {files.length > 0 && !processing && (
                <Button onClick={processFiles} className="w-full">
                  <Sparkles className="w-4 h-4 mr-2" /> Extract Flashcards with AI
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selected.size} / {generated.length} selected</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set(generated.map(c => c._id)))}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {generated.map((card) => (
                  <div
                    key={card._id}
                    className={`glass-card p-3 cursor-pointer transition-all ${selected.has(card._id) ? 'ring-2 ring-primary' : 'opacity-60'}`}
                    onClick={() => toggleSelect(card._id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${selected.has(card._id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                        {selected.has(card._id) && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-1.5 mb-1">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{card.subject}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{card.card_type}</span>
                        </div>
                        <p className="text-sm font-medium">{card.question}</p>
                        <p className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: (card.answer || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={saveSelected} className="w-full" disabled={selected.size === 0}>
                <Save className="w-4 h-4 mr-2" /> Save {selected.size} Flashcards
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
