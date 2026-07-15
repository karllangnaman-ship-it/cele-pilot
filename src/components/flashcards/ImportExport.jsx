import React, { useState, useRef } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Upload, FileJson, FileText, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CSV_TEMPLATE = `Question,Answer,Category
What is Hooke's Law?,Stress is directly proportional to strain.,PSAD
What is Darcy's Law?,Flow through porous media.,HGE`;

const JSON_TEMPLATE = JSON.stringify([
  { question: "What is Hooke's Law?", answer: "Stress is directly proportional to strain.", category: "PSAD" },
  { question: "What is Darcy's Law?", answer: "Flow through porous media.", category: "HGE" }
], null, 2);

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i]; });
    return row;
  }).filter(r => r.question || r.question === '');
}

function mapSubject(s) {
  const up = (s || '').toUpperCase();
  if (up.includes('HGE')) return 'HGE';
  if (up.includes('PSAD')) return 'PSAD';
  return 'MSTE';
}

export default function ImportExport({ user, cards, onImported }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let rows = [];

      if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        rows = (Array.isArray(data) ? data : data.cards || []).map(r => ({
          question: r.question || r.Question || '',
          answer: r.answer || r.Answer || '',
          subject: mapSubject(r.category || r.subject || r.Category || r.Subject),
        }));
      } else if (ext === 'csv') {
        const text = await file.text();
        rows = parseCSV(text).map(r => ({
          question: r.question || r.question || '',
          answer: r.answer || r.answer || '',
          subject: mapSubject(r.category || r.subject),
        }));
      } else if (['xlsx', 'xls'].includes(ext)) {
        const { file_url } = await firebaseApi.integrations.Core.UploadFile({ file });
        const extracted = await firebaseApi.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: { question: { type: "string" }, answer: { type: "string" }, category: { type: "string" } }
          }
        });
        const out = Array.isArray(extracted.output) ? extracted.output : (extracted.output ? [extracted.output] : []);
        rows = out.map(r => ({
          question: r.question || '',
          answer: r.answer || '',
          subject: mapSubject(r.category || r.subject),
        }));
      } else {
        toast({ title: 'Unsupported format. Use CSV, JSON, or Excel.', variant: 'destructive' });
        setImporting(false);
        return;
      }

      const valid = rows.filter(r => r.question && r.answer);
      setPreview(valid);
    } catch {
      toast({ title: 'Failed to parse file', variant: 'destructive' });
    }
    setImporting(false);
  };

  const confirmImport = async () => {
    const toCreate = preview.map(r => ({ ...r, user_id: user.id, card_type: 'qa', difficulty: 'medium' }));
    if (toCreate.length === 0) return;
    const created = await firebaseApi.entities.Flashcard.bulkCreate(toCreate);
    onImported(created);
    toast({ title: `${created.length} flashcards imported!` });
    setPreview([]);
    setOpen(false);
  };

  const exportCSV = () => {
    const header = 'Question,Answer,Category\n';
    const rows = cards.map(c => `"${(c.question || '').replace(/"/g, '""')}","${(c.answer || '').replace(/"/g, '""')}","${c.subject || ''}"`).join('\n');
    download('flashcards.csv', header + rows, 'text/csv');
  };

  const exportJSON = () => {
    const data = cards.map(c => ({ question: c.question, answer: c.answer, category: c.subject, card_type: c.card_type, difficulty: c.difficulty }));
    download('flashcards.json', JSON.stringify(data, null, 2), 'application/json');
  };

  const downloadTemplate = (name, content, type) => {
    download(name, content, type);
  };

  const download = (name, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-1" /> Import / Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import & Export Flashcards</DialogTitle></DialogHeader>

          <Tabs defaultValue="import">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="import"><Upload className="w-4 h-4 mr-1" /> Import</TabsTrigger>
              <TabsTrigger value="export"><Download className="w-4 h-4 mr-1" /> Export</TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4 mt-4">
              {preview.length === 0 ? (
                <>
                  <div>
                    <p className="text-sm font-medium mb-2">Step 1: Download a template</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => downloadTemplate('flashcard_template.csv', CSV_TEMPLATE, 'text/csv')}>
                        <FileText className="w-4 h-4" /> CSV Template
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => downloadTemplate('flashcard_template.json', JSON_TEMPLATE, 'application/json')}>
                        <FileJson className="w-4 h-4" /> JSON Template
                      </Button>
                    </div>
                  </div>

                  <div className="glass-card p-3 bg-muted/30">
                    <p className="text-xs font-medium mb-1">CSV Format:</p>
                    <pre className="text-[10px] text-muted-foreground overflow-x-auto">{CSV_TEMPLATE}</pre>
                    <p className="text-xs font-medium mt-2 mb-1">JSON Format:</p>
                    <pre className="text-[10px] text-muted-foreground overflow-x-auto">{JSON_TEMPLATE}</pre>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Step 2: Upload your file</p>
                    <Button onClick={() => inputRef.current?.click()} disabled={importing} className="w-full">
                      {importing ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      Choose CSV / JSON / Excel
                    </Button>
                    <input ref={inputRef} type="file" accept=".csv,.json,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{preview.length} flashcards ready to import</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {preview.map((c, i) => (
                      <div key={i} className="glass-card p-2 text-xs">
                        <span className="font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary mr-2">{c.subject}</span>
                        <span className="font-medium">{c.question}</span>
                        <p className="text-muted-foreground mt-1">{c.answer}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setPreview([])}>Cancel</Button>
                    <Button className="flex-1" onClick={confirmImport}><Check className="w-4 h-4 mr-2" /> Import {preview.length} Cards</Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="export" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">Export your {cards.length} flashcards to a file for backup or sharing.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={exportCSV} disabled={cards.length === 0}>
                  <FileText className="w-4 h-4 mr-2" /> Export CSV
                </Button>
                <Button variant="outline" onClick={exportJSON} disabled={cards.length === 0}>
                  <FileJson className="w-4 h-4 mr-2" /> Export JSON
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}