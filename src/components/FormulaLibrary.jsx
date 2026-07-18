import React, { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import {
  ChevronDown,
  Copy,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { firebaseApi } from "@/api/firebaseClient";
import { blankFormula, validateItem } from "@/lib/importEngine";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import FormulaCard from "@/components/FormulaCard";
import FigureViewer from "@/components/FigureViewer";
import EngineeringIllustration from '@/components/EngineeringIllustration';
import LatexFormula, { LatexText } from "@/components/LatexFormula";
import ImportExport from "@/components/flashcards/ImportExport";
import SearchBar from "@/components/content/SearchBar";
import SubjectFilter from "@/components/content/SubjectFilter";
import {
  formulaSchema,
  generateWithGemini,
  generatedArray,
} from "@/lib/aiGeneration";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formulaFields = [
  ["subject", "Subject *"],
  ["folder", "Folder (optional)"],
  ["subFolder", "Sub Folder (optional)"],
  ["name", "Formula Name *"],
  ["formula", "Formula (LaTeX supported) *"],
  ["description", "Description (optional)"],
  ["remarks", "Remarks (optional)"],
  ["figureUrl", "Figure URL (optional)"],
  ["references", "Reference (optional)"],
  ["tags", "Tags (comma separated)"],
  ["difficulty", "Difficulty (optional)"],
];
const textAreas = new Set(["formula", "description", "remarks"]);
const norm = (value) => String(value || "").trim();
const formulaFolder = (item) => norm(item.folder || item.topic);
const formulaSubFolder = (item) => norm(item.subFolder || item.subtopic);
const formulaOrder = (item) => Number.isFinite(item.order) ? item.order : Number.MAX_SAFE_INTEGER;
const orderedFormulas = (entries) => [...entries].sort((a, b) => formulaOrder(a) - formulaOrder(b) || String(a.id).localeCompare(String(b.id)));
const SYMBOLS = {
  Greek: [
    "Δ",
    "δ",
    "σ",
    "τ",
    "ε",
    "φ",
    "θ",
    "μ",
    "ρ",
    "λ",
    "ω",
    "α",
    "β",
    "γ",
    "π",
  ],
  Math: ["√", "∫", "∑", "∞", "≈", "≤", "≥", "±", "×", "÷", "°", "→", "←"],
  "Engineering Units": [
    "kN",
    "N",
    "MPa",
    "kPa",
    "Pa",
    "mm",
    "mm²",
    "mm³",
    "m²",
    "m³",
    "kg",
  ],
};

export default function FormulaLibrary() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [folderDocs, setFolderDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [draft, setDraft] = useState(blankFormula());
  const [editing, setEditing] = useState(null);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderDraft, setFolderDraft] = useState({
    subject: "",
    folder: "",
    subFolder: "",
  });
  const { toast } = useToast();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPreview, setAiPreview] = useState([]);
  const [aiStatus, setAiStatus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiController, setAiController] = useState(null);
  const [illustratingKey, setIllustratingKey] = useState("");
  const [aiConfig, setAiConfig] = useState({
    subject: "PSAD",
    quantity: "5",
    difficulty: "medium",
    topic: "",
    subTopic: "",
    formulaNames: [""],
    exactFormulas: [""],
    includeIllustration: null,
  });
  const [namesOpen, setNamesOpen] = useState(false);
  const [exactOpen, setExactOpen] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState("");
  const [expandedSubTopic, setExpandedSubTopic] = useState("");
  const formulaInputRefs = useRef([]);
  useEffect(() => {
    let unsubscribeFormulas = () => {};
    let unsubscribeFolders = () => {};
    firebaseApi.auth.me().then((me) => {
      setUser(me);
      if (!me) return;
      unsubscribeFormulas = firebaseApi.entities.Formula.subscribe(setItems);
      unsubscribeFolders = firebaseApi.entities.FormulaFolder.subscribe(setFolderDocs);
    }).catch((error) => console.error("Unable to load formula library", error));
    return () => { unsubscribeFormulas(); unsubscribeFolders(); };
  }, []);
  const folderOptions = useMemo(() => {
    const values = new Map();
    [...folderDocs, ...items].forEach((item) => {
      const subject = norm(item.subject);
      const folder = formulaFolder(item);
      if (subject && folder)
        values.set(`${subject}\u0000${folder}`, { subject, folder });
    });
    return [...values.values()].sort((a, b) =>
      `${a.subject}${a.folder}`.localeCompare(`${b.subject}${b.folder}`),
    );
  }, [items, folderDocs]);
  const subFolderOptions = useMemo(
    () =>
      items
        .map((item) => ({
          subject: norm(item.subject),
          folder: formulaFolder(item),
          subFolder: formulaSubFolder(item),
        }))
        .filter((item) => item.subject && item.folder && item.subFolder),
    [items],
  );
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return items.filter((item) => {
      const matchesSubject =
        subjectFilter === "all" || item.subject === subjectFilter;
      const variables = Array.from(
        { length: 5 },
        (_, i) => item[`variableMeaning${i + 1}`],
      );
      const searchable = [
        item.name,
        item.formula,
        formulaFolder(item),
        formulaSubFolder(item),
        item.description,
        item.references,
        item.tags,
        ...variables,
      ];
      return (
        matchesSubject &&
        (!query || searchable.join(" ").toLowerCase().includes(query))
      );
    });
  }, [items, search, subjectFilter]);
  const hierarchy = useMemo(() => {
    const subjects = new Map();
    folderDocs.forEach((entry) => {
      const subject = norm(entry.subject);
      const folder = norm(entry.folder);
      const subFolder = norm(entry.subFolder);
      if (
        !subject ||
        !folder ||
        (subjectFilter !== "all" && subject !== subjectFilter)
      )
        return;
      if (!subjects.has(subject))
        subjects.set(subject, { direct: [], folders: new Map() });
      const group = subjects.get(subject);
      if (!group.folders.has(folder))
        group.folders.set(folder, { direct: [], subs: new Map() });
      if (subFolder && !group.folders.get(folder).subs.has(subFolder))
        group.folders.get(folder).subs.set(subFolder, []);
    });
    filtered.forEach((item) => {
      const subject = norm(item.subject);
      if (!subjects.has(subject))
        subjects.set(subject, { direct: [], folders: new Map() });
      const group = subjects.get(subject);
      const folder = formulaFolder(item);
      const subFolder = formulaSubFolder(item);
      if (!folder) group.direct.push(item);
      else {
        if (!group.folders.has(folder))
          group.folders.set(folder, { direct: [], subs: new Map() });
        const node = group.folders.get(folder);
        if (!subFolder) node.direct.push(item);
        else
          node.subs.set(subFolder, [...(node.subs.get(subFolder) || []), item]);
      }
    });
    return [...subjects.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, folderDocs, subjectFilter]);
  const setField = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const prepareDraft = (item) => ({
    ...blankFormula(),
    ...item,
    folder: formulaFolder(item),
    subFolder: formulaSubFolder(item),
    tags: Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "",
  });
  const openNew = () => {
    setDraft(blankFormula());
    setEditing(null);
    setFormulaOpen(true);
  };
  const insertSymbol = (index, symbol) => {
    const input = formulaInputRefs.current[index];
    const start = input?.selectionStart ?? aiConfig.exactFormulas[index].length;
    const end = input?.selectionEnd ?? start;
    setAiConfig((current) => ({ ...current, exactFormulas: current.exactFormulas.map((value, i) => i === index ? `${value.slice(0, start)}${symbol}${value.slice(end)}` : value) }));
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + symbol.length, start + symbol.length); });
  };
  const saveFormula = async () => {
    const validation = validateItem(draft, "formula");
    if (!validation.valid)
      return toast({
        title: `Complete: ${validation.missing.join(", ")}`,
        variant: "destructive",
      });
    if (draft.figureUrl && !/^https?:\/\/\S+$/i.test(draft.figureUrl))
      return toast({
        title: "Figure URL must use HTTP or HTTPS.",
        variant: "destructive",
      });
    const folder = norm(draft.folder);
    const subFolder = folder ? norm(draft.subFolder) : "";
    const payload = {
      ...draft,
      folder,
      subFolder,
      topic: folder,
      subtopic: subFolder,
      tags:
        typeof draft.tags === "string"
          ? draft.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : draft.tags,
      user_id: user.id,
    };
    if (!editing?.id) {
      const sameSection = items.filter((item) => norm(item.subject) === norm(payload.subject) && formulaFolder(item) === folder && formulaSubFolder(item) === subFolder);
      payload.order = sameSection.length ? Math.max(...sameSection.map((item) => Number.isFinite(item.order) ? item.order : -1)) + 1 : 0;
    }
    const saved = editing?.id
      ? await firebaseApi.entities.Formula.update(editing.id, payload)
      : await firebaseApi.entities.Formula.create(payload);
    setItems((current) =>
      editing?.id
        ? current.map((item) =>
            item.id === editing.id ? { ...item, ...saved } : item,
          )
        : [...current, saved],
    );
    setFormulaOpen(false);
    toast({ title: editing ? "Formula updated" : "Formula added" });
  };
  const reorderFormulas = async (sectionItems, sourceIndex, destinationIndex) => {
    if (sourceIndex === destinationIndex) return;
    const previous = orderedFormulas(sectionItems);
    const next = [...previous];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(destinationIndex, 0, moved);
    const start = Math.min(sourceIndex, destinationIndex);
    const changed = next.slice(start).filter((item, index) => item.order !== start + index);
    // Apply every visual change first; snapshot listeners from another device will reconcile later.
    setItems((current) => current.map((item) => {
      const position = next.findIndex((candidate) => candidate.id === item.id);
      return position === -1 ? item : { ...item, order: position };
    }));
    try {
      await Promise.all(changed.map((item) => firebaseApi.entities.Formula.update(item.id, { order: next.indexOf(item) })));
    } catch (error) {
      const restore = new Map(previous.map((item, index) => [item.id, item.order ?? index]));
      setItems((current) => current.map((item) => restore.has(item.id) ? { ...item, order: restore.get(item.id) } : item));
      toast({ title: "Unable to save formula order", description: error.message || "Your previous order was restored.", variant: "destructive" });
    }
  };
  const createFolder = async () => {
    const subject = norm(folderDraft.subject);
    const folder = norm(folderDraft.folder);
    const subFolder = norm(folderDraft.subFolder);
    if (!subject || !folder)
      return toast({
        title: "Subject and folder are required.",
        variant: "destructive",
      });
    const created = await firebaseApi.entities.FormulaFolder.create({
      user_id: user.id,
      subject,
      folder,
      subFolder,
    });
    setFolderDocs((current) => [...current, created]);
    setFolderOpen(false);
    toast({ title: subFolder ? "Sub folder created" : "Folder created" });
  };
  const generateAi = async () => {
    const controller = new AbortController();
    setAiController(controller);
    setGenerating(true);
    try {
      const exact = aiConfig.exactFormulas.map(norm).filter(Boolean);
      const names = aiConfig.formulaNames.map(norm).filter(Boolean);
      const request = exact.length
        ? `Document exactly these ${exact.length} supplied formula(s), in this order: ${exact.join(" | ")}. Do not create, infer, or add any other formula. ${names.length ? `Use these names in order where they correspond: ${names.join(" | ")}. Otherwise determine the standard engineering name.` : "Determine each standard engineering formula name."}`
        : names.length
          ? `Generate exactly ${names.length} formula record(s), one for each requested formula name in this order: ${names.join(" | ")}. Determine each correct standard equation. Do not generate any formula not named in this list.`
          : `Generate exactly ${Math.max(1, Number(aiConfig.quantity) || 1)} non-duplicate, technically correct CELE engineering formula record(s).`;
      const result = await generateWithGemini({
        signal: controller.signal,
        onProgress: setAiStatus,
        schema: formulaSchema,
        prompt: `You are a precise professional civil engineering formula librarian. ${request} Subject: ${aiConfig.subject}. Difficulty: ${aiConfig.difficulty}. ${aiConfig.topic ? `Topic: ${aiConfig.topic}.` : "Choose an appropriate topic."} ${aiConfig.subTopic ? `Sub Topic: ${aiConfig.subTopic}.` : ""} Return JSON only with an items array. Every item must include subject, folder (Topic), subFolder (Sub Topic when applicable), name, formula in valid LaTeX without dollar delimiters, a concise description, reference, tags array, difficulty, an optional figure suggestion in figureUrl only when genuinely useful, engineering meaning in remarks, and up to five complete variableSymbolN, variableMeaningN, variableUnitN entries. Ensure variable definitions and units are technically correct.`,
      });
      const generated = generatedArray(result, "items");
      generated.forEach((item) => console.info('[Formula] returned figureUrl', { formulaName: item.name, figureUrl: item.figureUrl || item.imageUrl || null }));
      const previews = generated.map((item) => ({
          ...blankFormula(),
          ...item,
          subject: ["PSAD", "MSTE", "HGE"].includes(item.subject)
            ? item.subject
            : aiConfig.subject,
          folder: item.folder || aiConfig.topic,
          subFolder: item.subFolder || aiConfig.subTopic,
          figureUrl: item.figureUrl || item.imageUrl || "",
          difficulty: item.difficulty || aiConfig.difficulty,
          tags: Array.isArray(item.tags) ? item.tags : [],
          previewId: crypto.randomUUID(),
          illustrationDecision: aiConfig.includeIllustration === true ? 'requested' : 'declined',
        }));
      if (aiConfig.includeIllustration === true) {
        setAiStatus('Generating engineering illustrations...');
        const illustratedPreviews = await Promise.all(
          previews.map(async (item) => {
            try {
              const engineeringIllustrationUrl = await firebaseApi.integrations.Core.GenerateEngineeringIllustration({ prompt: illustrationPrompt(item), signal: controller.signal });
              return { ...item, engineeringIllustrationUrl, engineeringIllustrationCaption: illustrationCaption(item), illustrationDecision: 'generated' };
            } catch (error) {
              console.error('[Formula Library] Illustration generation failed', error);
              return { ...item, illustrationDecision: 'failed' };
            }
          }),
        );
        if (controller.signal.aborted) return;
        setAiPreview(illustratedPreviews);
        if (illustratedPreviews.some((item) => item.illustrationDecision === 'failed')) {
          toast({ title: 'Some illustrations could not be generated', description: 'The formula previews are still available. You can regenerate an illustration from its card.', variant: 'destructive' });
        }
      } else {
        setAiPreview(previews);
      }
      setAiOpen(false);
    } catch (error) {
      console.error("[Formula Library] Gemini generation failed", error);
      toast({
        title: "Gemini generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setAiController(null);
      setAiStatus("");
    }
  };
  const illustrationPrompt = (item) => `Create a professional Civil Engineering textbook illustration for the formula or concept "${item.name}" (${item.formula}). Subject: ${item.subject || 'Civil Engineering'}. Use a clean vector-style layout on a white background with minimal color. Include only relevant engineering elements such as a free body diagram, forces, dimensions, coordinate axes, angles, supports, beams, trusses, loads, stress/strain arrows, and clearly readable variable labels. Do not include paragraphs, decorative art, logos, watermarks, or unrelated objects.`;
  const illustrationCaption = (item) => `Engineering illustration of ${item.name}, showing its relevant elements and variable labels.`;
  const generateIllustration = async (item, preview = false) => {
    const key = item.previewId || item.id;
    setIllustratingKey(key);
    try {
      const engineeringIllustrationUrl = await firebaseApi.integrations.Core.GenerateEngineeringIllustration({ prompt: illustrationPrompt(item), signal: undefined });
      const patch = { engineeringIllustrationUrl, engineeringIllustrationCaption: illustrationCaption(item), illustrationDecision: 'generated' };
      if (preview) setAiPreview((current) => current.map((entry) => entry.previewId === key ? { ...entry, ...patch } : entry));
      else { await firebaseApi.entities.Formula.update(item.id, patch); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry)); }
    } catch (error) {
      toast({ title: 'Unable to generate illustration', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally { setIllustratingKey(''); }
  };
  const saveAiPreview = async () => {
    const valid = aiPreview.filter(
      (item) => validateItem(item, "formula").valid,
    );
    const nextOrderBySection = new Map();
    items.forEach((item) => {
      const key = `${norm(item.subject)}\u0000${formulaFolder(item)}\u0000${formulaSubFolder(item)}`;
      nextOrderBySection.set(key, Math.max(nextOrderBySection.get(key) ?? -1, Number.isFinite(item.order) ? item.order : -1));
    });
    const created = await firebaseApi.entities.Formula.bulkCreate(
      valid.map((item) => ({
        ...item,
        folder: norm(item.folder),
        subFolder: norm(item.subFolder),
        topic: norm(item.folder),
        subtopic: norm(item.subFolder),
        user_id: user.id,
        sourceType: "ai",
        order: (() => { const key = `${norm(item.subject)}\u0000${norm(item.folder)}\u0000${norm(item.subFolder)}`; const next = (nextOrderBySection.get(key) ?? -1) + 1; nextOrderBySection.set(key, next); return next; })(),
      })),
    );
    setItems((current) => [...created, ...current]);
    setAiPreview([]);
    toast({ title: `${created.length} formulas saved` });
  };
  const renameFolder = async ({ subject, folder, subFolder }) => {
    const next = window.prompt(
      `Rename ${subFolder ? "sub folder" : "folder"}`,
      subFolder || folder,
    );
    if (!next?.trim()) return;
    const field = subFolder ? "subFolder" : "folder";
    const legacy = subFolder ? "subtopic" : "topic";
    const affected = items.filter(
      (item) =>
        norm(item.subject) === subject &&
        formulaFolder(item) === folder &&
        (!subFolder || formulaSubFolder(item) === subFolder),
    );
    await Promise.all(
      affected.map((item) =>
        firebaseApi.entities.Formula.update(item.id, {
          [field]: next.trim(),
          [legacy]: next.trim(),
        }),
      ),
    );
    await Promise.all(
      folderDocs
        .filter(
          (item) =>
            norm(item.subject) === subject &&
            norm(item.folder) === folder &&
            (!subFolder || norm(item.subFolder) === subFolder),
        )
        .map((item) =>
          firebaseApi.entities.FormulaFolder.update(item.id, {
            [field]: next.trim(),
          }),
        ),
    );
    await load();
  };
  const deleteFolder = async ({ subject, folder, subFolder }) => {
    const label = subFolder || folder;
    if (
      !window.confirm(
        `Delete “${label}”? Formulas will be moved to its parent level.`,
      )
    )
      return;
    const affected = items.filter(
      (item) =>
        norm(item.subject) === subject &&
        formulaFolder(item) === folder &&
        (!subFolder || formulaSubFolder(item) === subFolder),
    );
    const updates = affected.map((item) =>
      subFolder
        ? { subFolder: "", subtopic: "" }
        : { folder: "", subFolder: "", topic: "", subtopic: "" },
    );
    await Promise.all(
      affected.map((item, index) =>
        firebaseApi.entities.Formula.update(item.id, updates[index]),
      ),
    );
    await Promise.all(
      folderDocs
        .filter(
          (item) =>
            norm(item.subject) === subject &&
            norm(item.folder) === folder &&
            (!subFolder || norm(item.subFolder) === subFolder),
        )
        .map((item) => firebaseApi.entities.FormulaFolder.delete(item.id)),
    );
    await load();
  };
  const actions = (item) => (
    <div className="flex shrink-0">
      <Button
        aria-label="Edit formula"
        variant="ghost"
        size="icon"
        onClick={() => {
          setDraft(prepareDraft(item));
          setEditing(item);
          setFormulaOpen(true);
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Duplicate formula"
        variant="ghost"
        size="icon"
        onClick={() => {
          const copy = prepareDraft(item);
          delete copy.id;
          setDraft({ ...copy, name: `${copy.name} (Copy)` });
          setEditing(null);
          setFormulaOpen(true);
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Delete formula"
        variant="ghost"
        size="icon"
        onClick={async () => {
          if (window.confirm(`Delete “${item.name}”?`)) {
            await firebaseApi.entities.Formula.delete(item.id);
            setItems((current) =>
              current.filter((entry) => entry.id !== item.id),
            );
          }
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
  const folderHeader = (subject, folder, subFolder = "") => (
    <div className="flex items-center gap-1">
      <h3 className={subFolder ? "font-medium text-sm" : "font-semibold"}>
        <LatexText value={subFolder || folder} />
      </h3>
      <Button
        aria-label="Rename folder"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => renameFolder({ subject, folder, subFolder })}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        aria-label="Delete folder"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => deleteFolder({ subject, folder, subFolder })}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
  const formulaList = (sectionKey, sectionItems, className = "mt-3") => {
    const sorted = orderedFormulas(sectionItems);
    return <DragDropContext onDragEnd={({ source, destination }) => destination && reorderFormulas(sorted, source.index, destination.index)}>
      <Droppable droppableId={sectionKey} direction="vertical">
        {(provided, snapshot) => <div ref={provided.innerRef} {...provided.droppableProps} className={`${className} grid gap-3 lg:grid-cols-2 ${snapshot.isDraggingOver ? "rounded-lg bg-primary/5 p-2 transition-colors" : ""}`}>
          {sorted.map((item, index) => <Draggable key={item.id} draggableId={item.id} index={index}>
            {(dragProvided, dragSnapshot) => <FormulaCard formula={item} actions={actions(item)} illustrating={illustratingKey === item.id} onRegenerateIllustration={() => generateIllustration(item)} innerRef={dragProvided.innerRef} draggableProps={dragProvided.draggableProps} dragHandleProps={dragProvided.dragHandleProps} isDragging={dragSnapshot.isDragging} />}
          </Draggable>)}
          {provided.placeholder}
        </div>}
      </Droppable>
    </DragDropContext>;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Formula Library</h1>
          <p className="text-sm text-muted-foreground">
            A structured engineering formula handbook.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportExport
            user={user}
            cards={orderedFormulas(items)}
            type="formula"
            onImported={(created) =>
              setItems((current) => [...created, ...current])
            }
          />
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="mr-1 h-4 w-4" /> AI Generate
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFolderDraft({ subject: "", folder: "", subFolder: "" });
              setFolderOpen(true);
            }}
          >
            <FolderPlus className="mr-1 h-4 w-4" /> Folder
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Add Formula
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search formulas, folders, variables, references, tags..."
        />
        <SubjectFilter value={subjectFilter} onChange={setSubjectFilter} />
      </div>
      {hierarchy.length ? (
        <div className="space-y-5">
          {hierarchy.map(([subject, group]) => (
            <section key={subject} className="glass-card p-4">
              <h2 className="text-lg font-bold"><LatexText value={subject} /></h2>
              {group.direct.length > 0 && (
                formulaList(`${subject}--root`, group.direct)
              )}
              {[...group.folders.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([folder, node]) => {
                const topicKey = `${subject}\u0000${folder}`;
                return <Collapsible key={folder} open={expandedTopic === topicKey} onOpenChange={(open) => { setExpandedTopic(open ? topicKey : ''); setExpandedSubTopic(''); }} className="mt-4 border-l-2 border-primary/30 pl-4">
                  <div className="flex items-center"><CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left"><ChevronDown className={`h-4 w-4 transition-transform ${expandedTopic === topicKey ? 'rotate-180' : ''}`} /><span className="font-semibold"><LatexText value={folder} /></span></CollapsibleTrigger>{folderHeader(subject, folder).props.children.slice(1)}</div>
                  <CollapsibleContent>{node.direct.length > 0 && formulaList(`${subject}--${folder}--root`, node.direct)}{[...node.subs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([subFolder, subItems]) => { const subKey = `${topicKey}\u0000${subFolder}`; return <Collapsible key={subFolder} open={expandedSubTopic === subKey} onOpenChange={(open) => setExpandedSubTopic(open ? subKey : '')} className="mt-3 border-l pl-4"><div className="flex items-center"><CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedSubTopic === subKey ? 'rotate-180' : ''}`} /><span className="text-sm font-medium"><LatexText value={subFolder} /></span></CollapsibleTrigger>{folderHeader(subject, folder, subFolder).props.children.slice(1)}</div><CollapsibleContent>{formulaList(`${subject}--${folder}--${subFolder}`, subItems, "mt-2")}</CollapsibleContent></Collapsible>; })}</CollapsibleContent>
                </Collapsible>;
              })}
            </section>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center text-muted-foreground">
          No formulas found.
        </div>
      )}
      <Dialog
        open={aiOpen}
        onOpenChange={(open) => !generating && setAiOpen(open)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Formulas with Gemini</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label><Select value={aiConfig.subject} onValueChange={(subject) => setAiConfig((current) => ({ ...current, subject }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['PSAD', 'MSTE', 'HGE'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Topic <span className="text-muted-foreground">(optional)</span></Label><Input value={aiConfig.topic} onChange={(event) => setAiConfig((current) => ({ ...current, topic: event.target.value }))} placeholder="Strength of Materials" /></div>
            <div><Label>Sub Topic <span className="text-muted-foreground">(optional)</span></Label><Input value={aiConfig.subTopic} onChange={(event) => setAiConfig((current) => ({ ...current, subTopic: event.target.value }))} placeholder="Axial Stress" /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Difficulty</Label><Select value={aiConfig.difficulty} onValueChange={(difficulty) => setAiConfig((current) => ({ ...current, difficulty }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['easy', 'medium', 'hard', 'mixed'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div><Label>Number of Formulas</Label><Input type="number" min="1" max="100" value={aiConfig.quantity} onChange={(event) => setAiConfig((current) => ({ ...current, quantity: event.target.value }))} /></div></div>
            <Collapsible open={namesOpen} onOpenChange={setNamesOpen} className="rounded-md border"><CollapsibleTrigger className="flex w-full items-center gap-2 p-3 text-left font-medium"><ChevronDown className={`h-4 w-4 transition-transform ${namesOpen ? 'rotate-180' : ''}`} />Formula Name(s) <span className="text-muted-foreground">(Optional, up to 10)</span></CollapsibleTrigger><CollapsibleContent className="space-y-3 border-t p-3">{aiConfig.formulaNames.map((value, index) => <div key={index}><Label>Formula Name {index + 1}</Label><div className="flex gap-2"><Input value={value} onChange={(event) => setAiConfig((current) => ({ ...current, formulaNames: current.formulaNames.map((item, i) => i === index ? event.target.value : item) }))} placeholder="Stress" />{aiConfig.formulaNames.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Remove formula name" onClick={() => setAiConfig((current) => ({ ...current, formulaNames: current.formulaNames.filter((_, i) => i !== index) }))}><X className="h-4 w-4" /></Button>}</div></div>)}{aiConfig.formulaNames.length < 10 && <Button type="button" variant="ghost" className="px-0" onClick={() => setAiConfig((current) => ({ ...current, formulaNames: [...current.formulaNames, ''] }))}><Plus className="mr-1 h-4 w-4" />Add Formula Name</Button>}</CollapsibleContent></Collapsible>
            <Collapsible open={exactOpen} onOpenChange={setExactOpen} className="rounded-md border"><CollapsibleTrigger className="flex w-full items-center gap-2 p-3 text-left font-medium"><ChevronDown className={`h-4 w-4 transition-transform ${exactOpen ? 'rotate-180' : ''}`} />Exact Formula(s) <span className="text-muted-foreground">(Optional)</span></CollapsibleTrigger><CollapsibleContent className="space-y-3 border-t p-3">{aiConfig.exactFormulas.map((value, index) => <div key={index}><Label>Formula {index + 1}</Label><div className="flex gap-2"><Input ref={(node) => { formulaInputRefs.current[index] = node; }} value={value} onChange={(event) => setAiConfig((current) => ({ ...current, exactFormulas: current.exactFormulas.map((item, i) => i === index ? event.target.value : item) }))} placeholder="σ=P/A" /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="shrink-0">Insert Symbol</Button></PopoverTrigger><PopoverContent className="w-80"><div className="space-y-3">{Object.entries(SYMBOLS).map(([category, symbols]) => <div key={category}><p className="mb-1 text-xs font-medium text-muted-foreground">{category}</p><div className="flex flex-wrap gap-1">{symbols.map((symbol) => <Button key={symbol} type="button" variant="ghost" size="sm" onClick={() => insertSymbol(index, symbol)}>{symbol}</Button>)}</div></div>)}</div></PopoverContent></Popover>{aiConfig.exactFormulas.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Remove formula" onClick={() => setAiConfig((current) => ({ ...current, exactFormulas: current.exactFormulas.filter((_, i) => i !== index) }))}><X className="h-4 w-4" /></Button>}</div></div>)}{aiConfig.exactFormulas.length < 5 && <Button type="button" variant="ghost" className="px-0" onClick={() => setAiConfig((current) => ({ ...current, exactFormulas: [...current.exactFormulas, ''] }))}><Plus className="mr-1 h-4 w-4" />Add Another</Button>}</CollapsibleContent></Collapsible>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-medium">Would you like to include a textbook-style engineering illustration or Free Body Diagram (FBD) with the formula explanation?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={aiConfig.includeIllustration === true ? 'default' : 'outline'} onClick={() => setAiConfig((current) => ({ ...current, includeIllustration: true }))}>
                  🖼️ Yes, Include Illustration
                </Button>
                <Button type="button" size="sm" variant={aiConfig.includeIllustration === false ? 'default' : 'outline'} onClick={() => setAiConfig((current) => ({ ...current, includeIllustration: false }))}>
                  ❌ No, Text Only
                </Button>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={generateAi}
              disabled={generating || typeof aiConfig.includeIllustration !== 'boolean'}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {aiStatus}
                </>
              ) : (
                "Generate Preview"
              )}
            </Button>
            {generating && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => aiController?.abort()}
              >
                Cancel
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={aiPreview.length > 0}
        onOpenChange={(open) => !open && setAiPreview([])}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Review Generated Formulas ({aiPreview.length})
            </DialogTitle>
          </DialogHeader>
          {aiPreview.map((item, index) => (
            <div className="border-b py-3" key={index}>
              <div className="flex justify-between">
                <b><LatexText value={item.name} /></b>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setAiPreview((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={item.name}
                onChange={(event) =>
                  setAiPreview((current) =>
                    current.map((value, i) =>
                      i === index
                        ? { ...value, name: event.target.value }
                        : value,
                    ),
                  )
                }
              />
              <Textarea
                className="mt-2"
                value={item.formula}
                onChange={(event) =>
                  setAiPreview((current) =>
                    current.map((value, i) =>
                      i === index
                        ? { ...value, formula: event.target.value }
                        : value,
                    ),
                  )
                }
              />
              <LatexFormula value={item.formula} className="mt-2 rounded bg-muted/40 px-2" />
              {item.figureUrl && <FigureViewer url={item.figureUrl} label={`${item.name} figure`} />}
              {item.description && <p className="mt-2 text-sm text-muted-foreground"><LatexText value={item.description} /></p>}
              {item.engineeringIllustrationUrl && <EngineeringIllustration imageUrl={item.engineeringIllustrationUrl} caption={item.engineeringIllustrationCaption} generating={illustratingKey === item.previewId} onRegenerate={() => generateIllustration(item, true)} />}
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => setAiPreview([])}
            >
              Discard
            </Button>
            <Button className="flex-1" onClick={saveAiPreview}>
              Save All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={formulaOpen} onOpenChange={setFormulaOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Formula" : "Add Formula"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {formulaFields.map(([key, label]) => (
              <div
                key={key}
                className={textAreas.has(key) ? "sm:col-span-2" : ""}
              >
                <Label>{label}</Label>
                {textAreas.has(key) ? (
                  <Textarea
                    value={draft[key] || ""}
                    onChange={(event) => setField(key, event.target.value)}
                  />
                ) : (
                  <Input
                    list={
                      key === "folder"
                        ? "formula-folders"
                        : key === "subFolder"
                          ? "formula-subfolders"
                          : undefined
                    }
                    value={draft[key] || ""}
                    onChange={(event) => setField(key, event.target.value)}
                  />
                )}
                {draft[key] && (key === "formula" ? <LatexFormula value={draft[key]} className="mt-1 rounded bg-muted/40 px-2" /> : <div className="mt-1 rounded bg-muted/40 p-2 text-sm"><LatexText value={draft[key]} /></div>)}
              </div>
            ))}
          </div>
          <datalist id="formula-folders">
            {folderOptions
              .filter(
                (item) => !draft.subject || item.subject === draft.subject,
              )
              .map((item) => (
                <option
                  key={`${item.subject}-${item.folder}`}
                  value={item.folder}
                />
              ))}
          </datalist>
          <datalist id="formula-subfolders">
            {subFolderOptions
              .filter(
                (item) =>
                  (!draft.subject || item.subject === draft.subject) &&
                  (!draft.folder || item.folder === draft.folder),
              )
              .map((item) => (
                <option
                  key={`${item.subject}-${item.folder}-${item.subFolder}`}
                  value={item.subFolder}
                />
              ))}
          </datalist>
          <div className="border-t pt-3">
            <p className="mb-2 font-medium">
              Where:{" "}
              <span className="text-sm font-normal text-muted-foreground">
                all fields in a row are optional
              </span>
            </p>
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => {
                const n = index + 1;
                return (
                  <div
                    className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]"
                    key={n}
                  >
                    <Input
                      placeholder={`Symbol ${n}`}
                      value={draft[`variableSymbol${n}`] || ""}
                      onChange={(event) =>
                        setField(`variableSymbol${n}`, event.target.value)
                      }
                    />
                    <Input
                      placeholder={`Meaning ${n}`}
                      value={draft[`variableMeaning${n}`] || ""}
                      onChange={(event) =>
                        setField(`variableMeaning${n}`, event.target.value)
                      }
                    />
                    <Input
                      placeholder={`Unit ${n}`}
                      value={draft[`variableUnit${n}`] || ""}
                      onChange={(event) =>
                        setField(`variableUnit${n}`, event.target.value)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <Button onClick={saveFormula}>Save Formula</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subject *</Label>
              <Input
                value={folderDraft.subject}
                onChange={(event) =>
                  setFolderDraft((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Folder *</Label>
              <Input
                value={folderDraft.folder}
                onChange={(event) =>
                  setFolderDraft((current) => ({
                    ...current,
                    folder: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Sub Folder (optional)</Label>
              <Input
                value={folderDraft.subFolder}
                onChange={(event) =>
                  setFolderDraft((current) => ({
                    ...current,
                    subFolder: event.target.value,
                  }))
                }
              />
            </div>
            <Button className="w-full" onClick={createFolder}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
