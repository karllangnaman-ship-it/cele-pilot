import React, { useState, useEffect, useMemo } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Sparkles, Loader2, Star, Layers, BookOpen, BarChart3, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import FlashcardCard from '@/components/flashcards/FlashcardCard';
import FlashcardEditor from '@/components/flashcards/FlashcardEditor';
import FlashcardStats from '@/components/flashcards/FlashcardStats';
import UploadGenerator from '@/components/flashcards/UploadGenerator';
import ImportExport from '@/components/flashcards/ImportExport';
import StudySession from '@/components/flashcards/StudySession';
import SearchBar from '@/components/content/SearchBar';
import SubjectFilter from '@/components/content/SubjectFilter';
import { flashcardSchema, generateWithGemini } from '@/lib/aiGeneration';
import { LatexText } from '@/components/LatexFormula';

const SUBJECTS = ['all', 'MSTE', 'HGE', 'PSAD'];
const FILTERS = ['all', 'favorite', 'ai', 'manual', 'mastered', 'due'];

export default function Flashcards() {
  const [user, setUser] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('deck');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editCard, setEditCard] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false); const [aiPreview, setAiPreview] = useState([]); const [aiStatus, setAiStatus] = useState(''); const [aiConfig, setAiConfig] = useState({ subject: 'PSAD', quantity: '10', difficulty: 'medium', topic: '' }); const [aiController, setAiController] = useState(null);
  const [newCard, setNewCard] = useState({ question: '', answer: '', subject: 'MSTE', difficulty: 'medium', card_type: 'qa' });
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const items = await firebaseApi.entities.Flashcard.filter({ user_id: u.id });
      setCards(items);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = [...cards];
    if (subjectFilter !== 'all') result = result.filter(c => c.subject === subjectFilter);
    if (typeFilter === 'favorite') result = result.filter(c => c.is_favorite);
    else if (typeFilter === 'ai') result = result.filter(c => c.is_ai_generated);
    else if (typeFilter === 'manual') result = result.filter(c => !c.is_ai_generated);
    else if (typeFilter === 'mastered') result = result.filter(c => c.mastered);
    else if (typeFilter === 'due') result = result.filter(c => !c.due_date || c.due_date <= new Date().toISOString().split('T')[0]);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
    }
    return result.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  }, [cards, subjectFilter, typeFilter, search]);

  const addCard = async () => {
    const card = await firebaseApi.entities.Flashcard.create({ ...newCard, user_id: user.id });
    setCards(prev => [card, ...prev]);
    setNewCard({ question: '', answer: '', subject: 'MSTE', difficulty: 'medium', card_type: 'qa' });
    setAddOpen(false);
    toast({ title: 'Flashcard added' });
  };

  const updateCard = async (id, data) => {
    const updated = await firebaseApi.entities.Flashcard.update(id, data);
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    return { ...cards.find(c => c.id === id), ...updated };
  };

  const handleSaveEdit = async (data) => {
    const updated = await firebaseApi.entities.Flashcard.update(data.id, data);
    setCards(prev => prev.map(c => c.id === data.id ? { ...c, ...updated } : c));
  };

  const deleteCard = async (card) => {
    await firebaseApi.entities.Flashcard.delete(card.id);
    setCards(prev => prev.filter(c => c.id !== card.id));
    setEditorOpen(false);
    toast({ title: 'Card deleted' });
  };

  const duplicateCard = async (card) => {
    const { id, created_date, updated_date, ...rest } = card;
    const dup = await firebaseApi.entities.Flashcard.create({ ...rest, user_id: user.id, is_ai_generated: false });
    setCards(prev => [dup, ...prev]);
    toast({ title: 'Card duplicated' });
  };

  const toggleFavorite = async (card) => {
    await updateCard(card.id, { is_favorite: !card.is_favorite });
  };

  const togglePin = async (card) => {
    await updateCard(card.id, { is_pinned: !card.is_pinned });
  };

  const generateFromTopics = async () => {
    const controller = new AbortController(); setAiController(controller); setGenerating(true); setAiStatus('Generating with Gemini…');
    setGenerating(true);
    try {
      const result = await generateWithGemini({ signal: controller.signal, onProgress: setAiStatus, schema: flashcardSchema, prompt: `Generate exactly ${aiConfig.quantity} non-duplicate, technically correct flashcards for the Philippine Civil Engineering Licensure Examination (CELE). Subject: ${aiConfig.subject}. Difficulty: ${aiConfig.difficulty}. ${aiConfig.topic ? `Topic: ${aiConfig.topic}.` : 'Choose a balanced topic appropriate to the subject.'} Return JSON only with a cards array. Every card must include subject, topic, question, answer, optional explanation, tags array, and difficulty. Keep answers concise and exam-relevant.` });
      setAiPreview((result.cards || []).map((card) => ({ ...card, subject: ['PSAD', 'MSTE', 'HGE'].includes(card.subject) ? card.subject : aiConfig.subject, difficulty: card.difficulty || aiConfig.difficulty, tags: Array.isArray(card.tags) ? card.tags : [] }))); setAiOpen(false);
    } catch (error) {
      toast({ title: 'Gemini generation failed', description: error.message, variant: 'destructive' });
    }
    finally { setGenerating(false); setAiController(null); setAiStatus(''); }
  };
  const saveAiPreview = async () => { const valid = aiPreview.filter((card) => card.question?.trim() && card.answer?.trim()); const created = await firebaseApi.entities.Flashcard.bulkCreate(valid.map((card) => ({ ...card, user_id: user.id, card_type: 'qa', is_ai_generated: true }))); setCards((current) => [...created, ...current]); setAiPreview([]); toast({ title: `${created.length} flashcards saved` }); };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setAiOpen(true)} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} AI Generate
          </Button>
          <UploadGenerator user={user} onSaved={(created) => setCards(prev => [...created, ...prev])} />
          <ImportExport user={user} cards={cards} onImported={(created) => setCards(prev => [...created, ...prev])} />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add</Button>
            <DialogContent>
              <DialogHeader><DialogTitle>New Flashcard</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Question</Label><Textarea value={newCard.question} onChange={e => setNewCard(p => ({ ...p, question: e.target.value }))} rows={2} />{newCard.question && <div className="mt-1 rounded bg-muted/40 p-2 text-sm"><LatexText value={newCard.question} /></div>}</div>
                <div><Label>Answer</Label><Textarea value={newCard.answer} onChange={e => setNewCard(p => ({ ...p, answer: e.target.value }))} rows={3} />{newCard.answer && <div className="mt-1 rounded bg-muted/40 p-2 text-sm"><LatexText value={newCard.answer} /></div>}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Subject</Label>
                    <Select value={newCard.subject} onValueChange={v => setNewCard(p => ({ ...p, subject: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SUBJECTS.filter(s => s !== 'all').map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Difficulty</Label>
                    <Select value={newCard.difficulty} onValueChange={v => setNewCard(p => ({ ...p, difficulty: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Type</Label>
                    <Select value={newCard.card_type} onValueChange={v => setNewCard(p => ({ ...p, card_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="qa">Q&A</SelectItem><SelectItem value="definition">Definition</SelectItem><SelectItem value="formula">Formula</SelectItem><SelectItem value="fill_blank">Fill Blank</SelectItem><SelectItem value="true_false">True/False</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={addCard} disabled={!newCard.question || !newCard.answer} className="w-full">Add Card</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="deck"><Layers className="w-3.5 h-3.5" /></TabsTrigger>
          <TabsTrigger value="study"><BookOpen className="w-3.5 h-3.5" /></TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="w-3.5 h-3.5" /></TabsTrigger>
        </TabsList>

        {tab === 'deck' && (
          <div className="space-y-4 mt-4">
            <div className="flex gap-2 flex-wrap items-center">
              <SearchBar placeholder="Search cards..." value={search} onChange={setSearch} />
              <SubjectFilter value={subjectFilter} onChange={setSubjectFilter} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map(f => (
                <Button key={f} variant={typeFilter === f ? 'secondary' : 'ghost'} size="sm" onClick={() => setTypeFilter(f)} className="text-xs capitalize">
                  {f === 'ai' ? <><Sparkles className="w-3 h-3 mr-1" />AI</> : f === 'favorite' ? <><Star className="w-3 h-3 mr-1" />Favorite</> : f === 'manual' ? 'Manual' : f === 'mastered' ? 'Mastered' : f === 'due' ? 'Due' : 'All'}
                </Button>
              ))}
              <span className="text-sm text-muted-foreground ml-auto self-center">{filtered.length} cards</span>
            </div>

            {filtered.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p className="text-muted-foreground">{cards.length === 0 ? 'No flashcards yet. Upload a file or generate some!' : 'No cards match your filters.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(card => (
                  <FlashcardCard key={card.id} card={card} onEdit={(c) => { setEditCard(c); setEditorOpen(true); }} onToggleFavorite={toggleFavorite} onTogglePin={togglePin} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'study' && (
          <div className="mt-4">
            <StudySession cards={cards} user={user} onUpdate={updateCard} onExit={() => setTab('deck')} />
          </div>
        )}

        {tab === 'stats' && (
          <div className="mt-4 space-y-4">
            <FlashcardStats cards={cards} />
          </div>
        )}
      </Tabs>

      <FlashcardEditor card={editCard} open={editorOpen} onClose={() => setEditorOpen(false)} onSave={handleSaveEdit} onDelete={deleteCard} onDuplicate={duplicateCard} />
      <Dialog open={aiOpen} onOpenChange={(open) => !generating && setAiOpen(open)}><DialogContent><DialogHeader><DialogTitle>Generate Flashcards with Gemini</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Subject</Label><Select value={aiConfig.subject} onValueChange={(value) => setAiConfig((current) => ({ ...current, subject: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['PSAD', 'MSTE', 'HGE'].map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select></div><div><Label>Number of Flashcards</Label><Input type="number" min="1" max="100" value={aiConfig.quantity} onChange={(event) => setAiConfig((current) => ({ ...current, quantity: event.target.value }))} /><p className="text-xs text-muted-foreground">Examples: 10, 20, 30, 50, 100 — or any custom amount.</p></div><div><Label>Difficulty</Label><Select value={aiConfig.difficulty} onValueChange={(value) => setAiConfig((current) => ({ ...current, difficulty: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['easy', 'medium', 'hard', 'mixed'].map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select></div><div><Label>Topic (optional)</Label><Input value={aiConfig.topic} onChange={(event) => setAiConfig((current) => ({ ...current, topic: event.target.value }))} placeholder="Stress, Beams, Hydraulics…" /></div>{generating && <><p className="text-sm">{aiStatus} Current batch: {aiConfig.quantity} items.</p><Progress value={50} /></>}<Button className="w-full" onClick={generateFromTopics} disabled={generating}>{generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : 'Generate Preview'}</Button>{generating && <Button className="w-full" variant="outline" onClick={() => aiController?.abort()}>Cancel</Button>}</div></DialogContent></Dialog>
      <Dialog open={aiPreview.length > 0} onOpenChange={(open) => !open && setAiPreview([])}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Review Generated Flashcards ({aiPreview.length})</DialogTitle></DialogHeader><div className="space-y-3">{aiPreview.map((card, index) => <div className="rounded border p-3 space-y-2" key={index}><div className="flex justify-between"><b><LatexText value={`${card.subject} · ${card.topic || ''}`} /></b><Button variant="ghost" size="icon" onClick={() => setAiPreview((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div><div className="rounded bg-muted/40 p-2 text-sm"><LatexText value={card.question} /></div><Textarea value={card.question || ''} onChange={(event) => setAiPreview((current) => current.map((item, i) => i === index ? { ...item, question: event.target.value } : item))} /><div className="rounded bg-muted/40 p-2 text-sm"><LatexText value={card.answer} /></div><Textarea value={card.answer || ''} onChange={(event) => setAiPreview((current) => current.map((item, i) => i === index ? { ...item, answer: event.target.value } : item))} /></div>)}</div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setAiPreview([])}>Discard</Button><Button className="flex-1" onClick={saveAiPreview}>Save All</Button></div></DialogContent></Dialog>
    </div>
  );
}
