import React, { useRef, useState } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Download, FileSpreadsheet, FileText, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { batchWriteItems, isSpreadsheetFile, normalizeSpreadsheetRow, readSpreadsheetRows } from '@/lib/spreadsheetImport';
import { mapSpreadsheetRow, spreadsheetValidationReasons } from '@/lib/importEngine';

const configs = {
  flashcard: {
    title: 'Flashcards', entity: firebaseApi.entities.Flashcard, filename: 'flashcards',
    columns: ['Question', 'Answer', 'Subject'],
    sample: [{ Question: "What is Hooke's Law?", Answer: 'Stress is directly proportional to strain.', Subject: 'PSAD' }, { Question: "What is Darcy's Law?", Answer: 'Flow through porous media.', Subject: 'HGE' }],
    description: 'Import question-and-answer study cards.',
    map: (row) => { const value = normalizeSpreadsheetRow(row); return { question: value.question || '', answer: value.answer || '', subject: value.subject || value.category || 'MSTE', card_type: 'qa', difficulty: 'medium' }; },
    validate: (item) => ['question', 'answer'].filter((key) => !String(item[key] || '').trim()).map((key) => `Missing required field: ${key}`),
    export: (item) => ({ Question: item.question || '', Answer: item.answer || '', Subject: item.subject || '' }),
    preview: ['Subject', 'Question', 'Answer'],
  },
  formula: {
    title: 'Formula Library', entity: firebaseApi.entities.Formula, filename: 'formula-library',
    columns: ['Subject', 'Category', 'Formula Name', 'Formula', 'Description', 'Tags'],
    sample: [{ Subject: 'PSAD', Category: 'Mechanics of Materials', 'Formula Name': 'Stress', Formula: 'σ=P/A', Description: 'Normal stress.', Tags: 'stress, mechanics' }, { Subject: 'MSTE', Category: 'Geometry', 'Formula Name': 'Area', Formula: 'A=πr²', Description: 'Area of a circle.', Tags: 'area, geometry' }],
    description: 'Import formulas with their subject, category, and tags.',
    map: (row) => mapSpreadsheetRow(row, 'formula'), validate: (item) => spreadsheetValidationReasons(item, 'formula'),
    export: (item) => ({ Subject: item.subject || '', Category: item.topic || '', 'Formula Name': item.name || '', Formula: item.formula || '', Description: item.description || '', Tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '' }),
    preview: ['Subject', 'Formula Name', 'Formula'],
  },
  question: {
    title: 'Question Bank', entity: firebaseApi.entities.Question, filename: 'question-bank',
    columns: ['Subject', 'Topic', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Explanation', 'Difficulty', 'Tags'],
    sample: [{ Subject: 'PSAD', Topic: 'Mechanics of Materials', Question: 'What is stress?', 'Option A': 'Force per unit area', 'Option B': 'Change in length', 'Option C': 'Mass per unit volume', 'Option D': 'Moment per unit length', 'Correct Answer': 'A', Explanation: 'Stress is force divided by area.', Difficulty: 'medium', Tags: 'stress' }],
    description: 'Import multiple-choice questions and explanations.',
    map: (row) => mapSpreadsheetRow(row, 'question'), validate: (item) => spreadsheetValidationReasons(item, 'question'),
    export: (item) => ({ Subject: item.subject || '', Topic: item.topic || '', Question: item.question || '', 'Option A': item.choices?.[0] || '', 'Option B': item.choices?.[1] || '', 'Option C': item.choices?.[2] || '', 'Option D': item.choices?.[3] || '', 'Correct Answer': item.correctAnswer || '', Explanation: item.explanation || '', Difficulty: item.difficulty || '', Tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '' }),
    preview: ['Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'],
  },
};

const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const downloadBlob = (name, blob) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); };

export default function ImportExport({ user, cards = [], onImported, type = 'flashcard' }) {
  const config = configs[type]; const [open, setOpen] = useState(false); const [preview, setPreview] = useState([]); const [status, setStatus] = useState(null); const inputRef = useRef(null); const { toast } = useToast();
  const rowsFor = (items) => items.map(config.export);
  const downloadFile = async (format, template = false) => {
    const rows = template ? config.sample : rowsFor(cards);
    if (format === 'csv') { const csv = [config.columns.map(quote).join(','), ...rows.map((row) => config.columns.map((column) => quote(row[column])).join(','))].join('\n'); downloadBlob(`${template ? `${config.filename}-template` : config.filename}.csv`, new Blob([csv], { type: 'text/csv' })); return; }
    const XLSX = await import('xlsx'); const sheet = XLSX.utils.json_to_sheet(rows, { header: config.columns }); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, config.title); XLSX.writeFile(book, `${template ? `${config.filename}-template` : config.filename}.xlsx`);
  };
  const selectFile = async (event) => {
    const file = event.target.files?.[0]; if (!file) return; if (!isSpreadsheetFile(file)) { toast({ title: 'Unsupported format. Use CSV, XLS, or XLSX.', variant: 'destructive' }); return; }
    setStatus({ phase: 'Parsing file', progress: 5 });
    try { const rawRows = await readSpreadsheetRows(file, setStatus); const entries = []; const skipped = [];
      rawRows.forEach((raw, index) => { const item = config.map(raw); const reasons = config.validate(item); const entry = { row: index + 2, item, parsedRow: raw, reasons }; if (reasons.length) skipped.push(entry); else entries.push(entry); });
      setPreview(entries); setStatus({ phase: 'Validated', progress: 45, total: rawRows.length, skipped: skipped.length });
      if (!entries.length) toast({ title: 'No valid rows found', description: skipped[0]?.reasons.join(', '), variant: 'destructive' });
    } catch (error) { setStatus(null); toast({ title: error.message || 'Failed to parse file', variant: 'destructive' }); }
    finally { event.target.value = ''; }
  };
  const confirmImport = async () => { if (!preview.length || !user) return; setStatus({ phase: 'Saving to Firestore', progress: 50, total: preview.length });
    try { const { created, failedRows } = await batchWriteItems({ entries: preview, entity: config.entity, userId: user.id, total: preview.length, onProgress: setStatus }); onImported(created); toast({ title: `${created.length} ${config.title.toLowerCase()} imported!`, description: failedRows.length ? `${failedRows.length} rows could not be saved.` : 'Saved directly to Firestore.' }); setPreview([]); setOpen(false); setStatus(null); }
    catch (error) { toast({ title: error.message || `Unable to import ${config.title.toLowerCase()}.`, variant: 'destructive' }); }
  };
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}><Upload className="w-4 h-4 mr-1" /> Import / Export</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Import & Export {config.title}</DialogTitle></DialogHeader><Tabs defaultValue="import"><TabsList className="grid grid-cols-2"><TabsTrigger value="import"><Upload className="w-4 h-4 mr-1" /> Import</TabsTrigger><TabsTrigger value="export"><Download className="w-4 h-4 mr-1" /> Export</TabsTrigger></TabsList><TabsContent value="import" className="space-y-4 mt-4">{!preview.length ? <><section><p className="text-sm font-medium mb-2">Templates</p><div className="grid gap-2 sm:grid-cols-2">{['csv', 'xlsx'].map((format) => <div className="rounded-lg border p-3" key={format}><div className="flex items-center gap-2 font-medium">{format === 'csv' ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}{config.title.replace('Library', '')} {format === 'csv' ? 'CSV' : 'Excel'} Template</div><p className="text-xs text-muted-foreground mt-2">{format.toUpperCase()} · {config.columns.length} columns</p><p className="text-xs text-muted-foreground">{config.description}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => downloadFile(format, true)}><Download className="w-3.5 h-3.5 mr-1" /> Download</Button></div>)}</div></section><section className="rounded-lg bg-muted/40 p-3 overflow-x-auto"><p className="text-xs font-medium mb-2">Template preview</p><table className="text-xs min-w-full"><thead><tr>{config.preview.map((column) => <th className="text-left pr-4 pb-1" key={column}>{column.replace('Option ', '')}</th>)}</tr></thead><tbody>{config.sample.slice(0, 2).map((row, index) => <tr key={index}>{config.preview.map((column) => <td className="pr-4 py-1 text-muted-foreground" key={column}>{row[column]}</td>)}</tr>)}</tbody></table></section><section><p className="text-sm font-medium mb-2">Choose File</p><Button onClick={() => inputRef.current?.click()} className="w-full"><Upload className="w-4 h-4 mr-2" /> Choose CSV / Excel</Button><input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={selectFile} /><p className="text-xs text-muted-foreground mt-2">Files are read locally and are never uploaded.</p></section></> : <div className="space-y-3"><p className="text-sm font-medium">{preview.length} {config.title.toLowerCase()} ready to import</p><div className="max-h-60 overflow-auto rounded border"><table className="w-full text-xs"><thead className="sticky top-0 bg-muted"><tr>{config.preview.map((column) => <th className="text-left p-2" key={column}>{column.replace('Option ', '')}</th>)}</tr></thead><tbody>{preview.map(({ item }, index) => { const row = config.export(item); return <tr className="border-t" key={index}>{config.preview.map((column) => <td className="p-2" key={column}>{row[column]}</td>)}</tr>; })}</tbody></table></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setPreview([]); setStatus(null); }}>Cancel</Button><Button className="flex-1" onClick={confirmImport}><Check className="w-4 h-4 mr-2" /> Import {preview.length}</Button></div></div>}{status && <div className="space-y-1"><div className="flex justify-between text-xs"><span>{status.phase}</span><span>{status.progress || 0}%</span></div><Progress value={status.progress || 0} /></div>}</TabsContent><TabsContent value="export" className="space-y-4 mt-4"><p className="text-sm text-muted-foreground">Export your {cards.length} {config.title.toLowerCase()} for backup or sharing.</p><div className="grid grid-cols-2 gap-3"><Button variant="outline" disabled={!cards.length} onClick={() => downloadFile('csv')}><FileText className="w-4 h-4 mr-2" /> Export CSV</Button><Button variant="outline" disabled={!cards.length} onClick={() => downloadFile('xlsx')}><FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel</Button></div></TabsContent></Tabs></DialogContent></Dialog></>;
}
