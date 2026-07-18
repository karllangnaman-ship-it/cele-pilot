import React, { useEffect, useMemo, useState } from "react";
import { firebaseApi } from "@/api/firebaseClient";
import {
  blankFormula,
  blankQuestion,
  normalizeItem,
  validateItem,
} from "@/lib/importEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ChevronRight, Folder, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import ImportExport from "@/components/flashcards/ImportExport";
import FigureViewer, { hasFigureUrl } from "@/components/FigureViewer";
import SituationViewer from "@/components/SituationViewer";
import QuestionLatexRenderer from "@/components/QuestionLatexRenderer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SearchBar from "@/components/content/SearchBar";
import SubjectFilter from "@/components/content/SubjectFilter";
import FormulaLibrary from "@/components/FormulaLibrary";
import {
  generateWithGemini,
  generatedArray,
  questionSchema,
} from "@/lib/aiGeneration";

const formulaFields = [
  ["subject", "Subject"],
  ["topic", "Topic (optional)"],
  ["subtopic", "Subtopic"],
  ["name", "Formula name"],
  ["formula", "Formula (LaTeX supported)"],
  ["description", "Description"],
  ["variables", "Variables"],
  ["units", "Units"],
  ["conditions", "Conditions"],
  ["applications", "Applications"],
  ["exampleProblem", "Example problem"],
  ["solution", "Complete solution"],
  ["finalAnswer", "Final answer"],
  ["commonMistakes", "Common mistakes"],
  ["relatedFormulas", "Related formulas"],
  ["references", "References"],
  ["tags", "Tags (comma separated)"],
];
const questionFields = [
  ["subject", "Subject"],
  ["topic", "Topic (optional)"],
  ["subtopic", "Sub Topic (optional)"],
  ["difficulty", "Difficulty"],
  ["question", "Question"],
  ["choices", "Choices A-D (separate with |)"],
  ["correctAnswer", "Correct answer"],
  ["explanation", "Explanation"],
  ["solution", "Solution (optional)"],
  ["remarks", "Remarks (optional)"],
  ["questionSource", "Question Source (optional)"],
  ["figureLabel", "Figure Label (optional)"],
  ["imageUrl", "Image URL (optional, HTTP/HTTPS)"],
  ["tags", "Tags (comma separated)"],
];
const situationFields = [
  ["situationTitle", "Situation Title"],
  ["situationDescription", "Situation Description"],
  ["imageUrl", "Figure URL (optional)"],
  ["figureLabel", "Figure Label (optional)"],
  ["questionNumber", "Question Number"],
];
const textAreas = new Set([
  "question",
  "formula",
  "description",
  "explanation",
  "solution",
  "remarks",
  "solution",
  "exampleProblem",
]);

const cleanValue = (value) => String(value || "").trim();
const createQuestionGroup = () => ({ situations: new Map(), standalone: [] });
const questionTotal = (group) => group.standalone.length + [...group.situations.values()].reduce((total, situation) => total + situation.questions.length, 0);

function QuestionSections({ group, renderQuestion }) {
  return <div className="ml-5 space-y-4 border-l pl-3">
    {[...group.situations.values()].map((situation) => <SituationViewer key={situation.id} situation={situation.detail || { externalId: `Situation - ${situation.identifier}` }} className="glass-card space-y-3 p-4">
      <div className="space-y-2">{situation.questions.map(renderQuestion)}</div>
    </SituationViewer>)}
    {group.standalone.length > 0 && <section className="space-y-2"><div className="rounded-md bg-muted/50 px-3 py-2 font-medium">Standalone</div><div className="space-y-2 pl-2">{group.standalone.map(renderQuestion)}</div></section>}
  </div>;
}

function ExpandableFolder({ label, children, count, depth = 0 }) {
  const [open, setOpen] = useState(depth < 1);
  return <Collapsible open={open} onOpenChange={setOpen} className={depth ? "ml-3 border-l pl-3" : ""}>
    <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/60">
      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      <Folder className="h-4 w-4 text-primary" />
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </CollapsibleTrigger>
    <CollapsibleContent className="space-y-2 pb-2">{children}</CollapsibleContent>
  </Collapsible>;
}

export default function ContentLibrary({ type }) {
  if (type === "formula") return <FormulaLibrary />;
  const isFormula = type === "formula";
  const Entity = isFormula
    ? firebaseApi.entities.Formula
    : firebaseApi.entities.Question;
  const singular = isFormula ? "Formula" : "Question";
  const makeBlank = isFormula ? blankFormula : blankQuestion;
  const fields = isFormula ? formulaFields : questionFields;
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [situations, setSituations] = useState([]);
  const [draft, setDraft] = useState(makeBlank());
  const [editing, setEditing] = useState(null);
  const [mode, setMode] = useState("manual");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [questionTypeFilter, setQuestionTypeFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("");
  const [subTopicFilter, setSubTopicFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [questionType, setQuestionType] = useState("standalone");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState([]);
  const [ai, setAi] = useState({
    subject: "PSAD",
    topic: "",
    subTopic: "",
    difficulty: "medium",
    count: 10,
    situationType: "",
    questionSource: "AI Generated",
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [aiController, setAiController] = useState(null);
  const { toast } = useToast();
  const load = async () => {
    const me = await firebaseApi.auth.me();
    setUser(me);
    setItems(await Entity.filter({ user_id: me.id }));
    if (!isFormula)
      setSituations(
        await firebaseApi.entities.Situation.filter({ user_id: me.id }),
      );
  };
  useEffect(() => {
    load();
  }, [type]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      const situation = situations.find(
        (entry) => entry.id === item.situationId,
      );
      const matchesSubject =
        subjectFilter === "all" || item.subject === subjectFilter;
      const matchesType =
        questionTypeFilter === "all" ||
        (questionTypeFilter === "standalone"
          ? !item.situationId
          : Boolean(item.situationId));
      const matchesTopic =
        !topicFilter ||
        String(item.topic || "")
          .toLowerCase()
          .includes(topicFilter.toLowerCase());
      const matchesSubTopic =
        !subTopicFilter ||
        String(item.subtopic || "")
          .toLowerCase()
          .includes(subTopicFilter.toLowerCase());
      const matchesSource = !sourceFilter || String(item.questionSource || "").toLowerCase().includes(sourceFilter.toLowerCase());
      const matchesDifficulty = !difficultyFilter || String(item.difficulty || "").toLowerCase().includes(difficultyFilter.toLowerCase());
      const matchesTag = !tagFilter || (Array.isArray(item.tags) ? item.tags : String(item.tags || "").split(",")).some((tag) => String(tag).toLowerCase().includes(tagFilter.toLowerCase()));
      const searchable = isFormula
        ? [
            item.name,
            item.formula,
            item.description,
            item.subject,
            item.questionSource,
            item.difficulty,
            item.topic,
            item.tags,
          ]
        : [
            item.question,
            situation?.title,
            situation?.description,
            item.explanation,
            item.topic,
            item.subtopic,
            item.subject,
            item.tags,
          ];
      return (
        matchesSubject &&
        matchesTopic &&
        matchesSubTopic &&
        matchesSource &&
        matchesDifficulty &&
        matchesTag &&
        matchesType &&
        (!q || searchable.join(" ").toLowerCase().includes(q))
      );
    });
  }, [
    items,
    situations,
    search,
    subjectFilter,
    questionTypeFilter,
    topicFilter,
    subTopicFilter,
    sourceFilter,
    difficultyFilter,
    tagFilter,
    isFormula,
  ]);
  const setField = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    const validation = validateItem(draft, type);
    if (!validation.valid)
      return toast({
        title: `Complete: ${validation.missing.join(", ")}`,
        variant: "destructive",
      });
    if (draft.imageUrl && !/^https?:\/\/\S+$/i.test(draft.imageUrl))
      return toast({
        title: "Image URL must use HTTP or HTTPS.",
        variant: "destructive",
      });
    let payload = {
      ...draft,
      user_id: user.id,
      questionSource: draft.questionSource?.trim() || null,
      tags:
        typeof draft.tags === "string"
          ? draft.tags
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : draft.tags,
    };
    if (!isFormula && questionType === "situation" && !editing?.situationId) {
      if (
        !String(draft.situationTitle || "").trim() ||
        !String(draft.situationDescription || "").trim()
      )
        return toast({
          title: "Situation title and description are required.",
          variant: "destructive",
        });
      const situation = await firebaseApi.entities.Situation.create({
        user_id: user.id,
        externalId: draft.situationKey || `SIT-${Date.now()}`,
        title: draft.situationTitle,
        description: draft.situationDescription,
        imageUrl: draft.imageUrl || null,
        figureLabel: draft.figureLabel || "",
        sourceType: "manual",
      });
      setSituations((current) => [...current, situation]);
      payload = {
        ...payload,
        situationId: situation.id,
        imageUrl: null,
        figureLabel: "",
        situationTitle: "",
        situationDescription: "",
      };
    }
    if (!isFormula && questionType === "standalone")
      payload = {
        ...payload,
        situationId: null,
        situationKey: "",
        situationTitle: "",
        situationDescription: "",
        questionNumber: "",
      };
    if (editing?.id) {
      const updated = await Entity.update(editing.id, payload);
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...item, ...updated } : item,
        ),
      );
    } else {
      const created = await Entity.create(payload);
      setItems((current) => [created, ...current]);
    }
    setOpen(false);
    setEditing(null);
    setDraft(makeBlank());
    toast({ title: `${singular} saved` });
  };
  const generate = async () => {
    const controller = new AbortController();
    setAiController(controller);
    setBusy(true);
    try {
      const result = await generateWithGemini({
        signal: controller.signal,
        onProgress: setAiStatus,
        schema: questionSchema,
        prompt: `Generate exactly ${ai.count} non-duplicate, realistic Philippine Civil Engineering Licensure Examination (CELE) multiple-choice questions. Subject: ${ai.subject}. Difficulty: ${ai.difficulty}. ${ai.topic ? `Topic: ${ai.topic}.` : "Choose a balanced relevant topic."} ${ai.subTopic ? `Sub topic: ${ai.subTopic}.` : ""} ${ai.situationType ? `Situation based: ${ai.situationType}.` : "Use isolated questions unless a shared situation materially improves the question."} Return JSON only with an items array. Each item must have subject, topic, question, exactly four choices in order A-D, correctAnswer as A/B/C/D, explanation, difficulty, tags array, and optional situationTitle/situationDescription. Standalone questions may also include an optional figureLabel and direct HTTP/HTTPS imageUrl when a diagram is genuinely useful; otherwise leave them empty. Make calculations and concepts technically correct.`,
      });
      const generated = generatedArray(result, "items");
      setPreview(
        generated.map((item) =>
          normalizeItem(
            {
              ...item,
              subject: item.subject || ai.subject,
              difficulty: item.difficulty || ai.difficulty,
              questionSource: ai.questionSource || null,
            },
            type,
            "ai",
          ),
        ),
      );
      setMode("review");
      setAiOpen(false);
    } catch (error) {
      console.error("[Question Bank] Gemini generation failed", error);
      toast({
        title: "Gemini generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setAiController(null);
      setAiStatus("");
    }
  };
  const savePreview = async () => {
    const invalid = preview.filter((item) => !validateItem(item, type).valid);
    if (invalid.length)
      return toast({
        title: `${invalid.length} item(s) need required fields`,
        variant: "destructive",
      });
    setBusy(true);
    try {
      const created = await Entity.bulkCreate(
        preview.map((item) => ({ ...item, user_id: user.id })),
      );
      setItems((current) => [...created, ...current]);
      setPreview([]);
      setMode("manual");
      toast({ title: `${created.length} ${singular.toLowerCase()}s saved` });
    } finally {
      setBusy(false);
    }
  };
  const fieldInput = (value, key, change) =>
    textAreas.has(key) ? (
      <Textarea
        value={value || ""}
        onChange={(event) => change(event.target.value)}
      />
    ) : (
      <Input
        value={
          key === "choices"
            ? (value || []).join(" | ")
            : Array.isArray(value)
              ? value.join(" | ")
              : value || ""
        }
        onChange={(event) =>
          change(
            key === "choices"
              ? event.target.value
                  .split("|")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : event.target.value,
          )
        }
      />
    );
  const questionCard = (item) => {
    return (
      <article key={item.id} className="rounded-lg border p-3">
        {!item.situationId && hasFigureUrl(item.resolvedImageUrl, item.imageUrl) && (
          <div className="mb-3">
            {item.figureLabel && <p className="mb-2 text-sm font-medium"><QuestionLatexRenderer value={item.figureLabel} /></p>}
            <FigureViewer imageUrl={item.imageUrl} resolvedImageUrl={item.resolvedImageUrl} label={item.figureLabel || "Question figure"} />
          </div>
        )}
        <div className="flex justify-between gap-2">
          <div>
            <h3 className="font-semibold">
              {item.questionNumber ? `Question ${item.questionNumber}: ` : ""}
              <QuestionLatexRenderer value={item.question} />
            </h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Type: {item.situationId ? "Situation" : "Standalone"}</span>
              {item.topic && <span>Topic: {item.topic}</span>}
              {item.subtopic && <span>Sub Topic: {item.subtopic}</span>}
              {item.difficulty && <span>Difficulty: {item.difficulty}</span>}
              {item.questionSource && <span>Source: {item.questionSource}</span>}
              {Array.isArray(item.tags) ? item.tags.length > 0 && <span>Tags: {item.tags.join(", ")}</span> : item.tags && <span>Tags: {item.tags}</span>}
            </div>
          </div>
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDraft({
                  ...item,
                  tags: Array.isArray(item.tags)
                    ? item.tags.join(", ")
                    : item.tags,
                });
                setEditing(item);
                setQuestionType(item.situationId ? "situation" : "standalone");
                setOpen(true);
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await Entity.delete(item.id);
                setItems((current) =>
                  current.filter((entry) => entry.id !== item.id),
                );
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <ol className="mt-2 grid gap-1 text-sm list-[upper-alpha] pl-5">
          {(item.choices || []).map((choice, index) => (
            <li key={index}>
              <QuestionLatexRenderer value={choice} />
            </li>
          ))}
        </ol>
        {item.explanation && (
          <div className="mt-2 text-sm text-muted-foreground">
            <QuestionLatexRenderer value={item.explanation} />
          </div>
        )}
        {item.solution && <div className="mt-2 text-sm text-muted-foreground"><QuestionLatexRenderer value={item.solution} /></div>}
        {item.remarks && <div className="mt-2 text-sm text-muted-foreground"><QuestionLatexRenderer value={item.remarks} /></div>}
      </article>
    );
  };
  const questionTree = useMemo(() => {
    const root = new Map();
    filtered.forEach((question) => {
      const subject = cleanValue(question.subject) || "Uncategorized";
      let subjectNode = root.get(subject);
      if (!subjectNode) { subjectNode = { label: subject, group: createQuestionGroup(), sources: new Map() }; root.set(subject, subjectNode); }
      const source = cleanValue(question.questionSource);
      const group = source
        ? (subjectNode.sources.get(source) || (() => { const next = createQuestionGroup(); subjectNode.sources.set(source, next); return next; })())
        : subjectNode.group;
      if (question.situationId) {
        const situation = situations.find((entry) => entry.id === question.situationId);
        const id = question.situationId;
        if (!group.situations.has(id)) group.situations.set(id, { id, identifier: situation?.externalId || situation?.title || question.situationKey || id, detail: situation, questions: [] });
        group.situations.get(id).questions.push(question);
      } else {
        group.standalone.push(question);
      }
    });
    const sortGroup = (group) => {
      group.standalone.sort((a, b) => Number(a.questionNumber || 0) - Number(b.questionNumber || 0));
      group.situations.forEach((situation) => situation.questions.sort((a, b) => Number(a.questionNumber || 0) - Number(b.questionNumber || 0)));
    };
    root.forEach((subject) => { sortGroup(subject.group); subject.sources.forEach(sortGroup); });
    return [...root.values()];
  }, [filtered, situations]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <p className="text-sm text-muted-foreground">
            Create, import, or generate CELE questions with Gemini.
          </p>
        </div>
        <div className="flex gap-2">
          <ImportExport
            user={user}
            cards={items}
            relations={situations}
            type={type}
            onImported={async (created) => {
              setItems((current) => [...created, ...current]);
              if (!isFormula)
                setSituations(
                  await firebaseApi.entities.Situation.filter({
                    user_id: user.id,
                  }),
                );
            }}
          />
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="w-4 h-4 mr-1" /> AI Generate
          </Button>
          <Button
            onClick={() => {
              setDraft(makeBlank());
              setEditing(null);
              setQuestionType("standalone");
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Manual input
          </Button>
        </div>
      </div>
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="manual">Library</TabsTrigger>
          <TabsTrigger value="review">AI Preview</TabsTrigger>
        </TabsList>
        {mode === "manual" && (
          <div className="space-y-3 mt-3">
            <div className="flex gap-2 flex-wrap items-center">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search questions..."
              />
              <SubjectFilter
                value={subjectFilter}
                onChange={setSubjectFilter}
              />
              <Input
                className="w-40"
                value={topicFilter}
                onChange={(event) => setTopicFilter(event.target.value)}
                placeholder="Filter topic"
              />
              <Input
                className="w-40"
                value={subTopicFilter}
                onChange={(event) => setSubTopicFilter(event.target.value)}
                placeholder="Filter sub topic"
              />
              <Input className="w-40" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="Filter source" />
              <Input className="w-32" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} placeholder="Difficulty" />
              <Input className="w-32" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} placeholder="Filter tags" />
              <div className="flex rounded-md border p-1 text-sm">
                <Button
                  size="sm"
                  variant={questionTypeFilter === "all" ? "default" : "ghost"}
                  onClick={() => setQuestionTypeFilter("all")}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={
                    questionTypeFilter === "standalone" ? "default" : "ghost"
                  }
                  onClick={() => setQuestionTypeFilter("standalone")}
                >
                  Standalone
                </Button>
                <Button
                  size="sm"
                  variant={
                    questionTypeFilter === "situation" ? "default" : "ghost"
                  }
                  onClick={() => setQuestionTypeFilter("situation")}
                >
                  Situation
                </Button>
              </div>
            </div>
            <div className="glass-card space-y-2 p-3">
              {questionTree.map((subject) => <ExpandableFolder key={subject.label} label={subject.label} count={questionTotal(subject.group) + [...subject.sources.values()].reduce((total, group) => total + questionTotal(group), 0)}>
                {questionTotal(subject.group) > 0 && <QuestionSections group={subject.group} renderQuestion={questionCard} />}
                {[...subject.sources.entries()].map(([source, group]) => <ExpandableFolder key={source} label={source} count={questionTotal(group)} depth={1}><QuestionSections group={group} renderQuestion={questionCard} /></ExpandableFolder>)}
              </ExpandableFolder>)}
            </div>
            {!filtered.length && (
              <div className="glass-card p-12 text-center">
                <p className="text-muted-foreground">No questions found.</p>
              </div>
            )}
          </div>
        )}
        {mode === "review" && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-between">
              <p className="font-medium">
                Review generated items ({preview.length})
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreview([]);
                    setMode("manual");
                  }}
                >
                  Discard
                </Button>
                <Button
                  onClick={savePreview}
                  disabled={busy || !preview.length}
                >
                  Save All
                </Button>
              </div>
            </div>
            {preview.map((item, index) => (
              <div className="glass-card p-4 space-y-2" key={index}>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPreview((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {(item.situationTitle || item.situationDescription) && (
                  <SituationViewer
                    situation={{ title: item.situationTitle, description: item.situationDescription, imageUrl: item.imageUrl, resolvedImageUrl: item.resolvedImageUrl, figureLabel: item.figureLabel }}
                    className="rounded-lg border p-3"
                  />
                )}
                {!item.situationTitle && !item.situationDescription && hasFigureUrl(item.resolvedImageUrl, item.imageUrl) && <div>
                  {item.figureLabel && <p className="mb-2 text-sm font-medium"><QuestionLatexRenderer value={item.figureLabel} /></p>}
                  <FigureViewer imageUrl={item.imageUrl} resolvedImageUrl={item.resolvedImageUrl} label={item.figureLabel || "Question figure"} />
                </div>}
                {fields.map(([key, label]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    {fieldInput(item[key], key, (value) =>
                      setPreview((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, [key]: value } : entry,
                        ),
                      ),
                    )}
                    {item[key] && (
                      <div className="mt-1 rounded bg-muted/40 p-2 text-sm">
                        <QuestionLatexRenderer value={Array.isArray(item[key]) ? item[key].join(" | ") : item[key]} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Tabs>
      <Dialog open={aiOpen} onOpenChange={(value) => !busy && setAiOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Questions with Gemini</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={ai.subject}
              onChange={(event) =>
                setAi((value) => ({ ...value, subject: event.target.value }))
              }
              placeholder="PSAD, MSTE, or HGE"
            />
            <Input
              value={ai.count}
              onChange={(event) =>
                setAi((value) => ({ ...value, count: event.target.value }))
              }
              placeholder="10, 20, 30, 50, or 100"
            />
            <Input
              value={ai.difficulty}
              onChange={(event) =>
                setAi((value) => ({ ...value, difficulty: event.target.value }))
              }
              placeholder="easy, medium, hard, or mixed"
            />
            <Input
              value={ai.topic}
              onChange={(event) =>
                setAi((value) => ({ ...value, topic: event.target.value }))
              }
              placeholder="Topic (optional)"
            />
            <Input
              value={ai.situationType}
              onChange={(event) =>
                setAi((value) => ({
                  ...value,
                  situationType: event.target.value,
                }))
              }
              placeholder="Situation type (optional): Beam, Truss…"
            />
            <Input
              value={ai.questionSource}
              onChange={(event) =>
                setAi((value) => ({ ...value, questionSource: event.target.value }))
              }
              placeholder="Question source (optional)"
            />
            <Button className="w-full" onClick={generate} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {aiStatus}
                </>
              ) : (
                "Generate Preview"
              )}
            </Button>
            {busy && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => aiController?.abort()}
              >
                Cancel
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${singular}` : `New ${singular}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!isFormula && (
              <div>
                <Label>Question Type</Label>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant={
                      questionType === "standalone" ? "default" : "outline"
                    }
                    onClick={() => setQuestionType("standalone")}
                  >
                    Standalone Question
                  </Button>
                  <Button
                    type="button"
                    variant={
                      questionType === "situation" ? "default" : "outline"
                    }
                    onClick={() => setQuestionType("situation")}
                  >
                    Situation-based Question
                  </Button>
                </div>
              </div>
            )}
            {(!isFormula && questionType === "situation"
              ? [
                  ...situationFields,
                  ...fields.filter(
                    ([key]) => !["imageUrl", "figureLabel"].includes(key),
                  ),
                ]
              : fields
            ).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                {fieldInput(draft[key], key, (value) => setField(key, value))}
                {draft[key] && <div className="mt-1 rounded bg-muted/40 p-2 text-sm"><QuestionLatexRenderer value={Array.isArray(draft[key]) ? draft[key].join(" | ") : draft[key]} /></div>}
              </div>
            ))}
            <Button onClick={save} className="w-full">
              Save {singular}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
