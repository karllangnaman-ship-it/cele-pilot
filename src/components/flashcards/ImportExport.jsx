import React, { useRef, useState } from "react";
import { firebaseApi } from "@/api/firebaseClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  batchWriteItems,
  isSpreadsheetFile,
  normalizeSpreadsheetRow,
  readSpreadsheetRows,
} from "@/lib/spreadsheetImport";
import {
  mapSpreadsheetRow,
  spreadsheetValidationReasons,
} from "@/lib/importEngine";

const configs = {
  flashcard: {
    title: "Flashcards",
    entity: firebaseApi.entities.Flashcard,
    filename: "flashcards",
    columns: ["Question", "Answer", "Subject"],
    sample: [
      {
        Question: "What is Hooke's Law?",
        Answer: "Stress is directly proportional to strain.",
        Subject: "PSAD",
      },
      {
        Question: "What is Darcy's Law?",
        Answer: "Flow through porous media.",
        Subject: "HGE",
      },
    ],
    description: "Import question-and-answer study cards.",
    map: (row) => {
      const value = normalizeSpreadsheetRow(row);
      return {
        question: value.question || "",
        answer: value.answer || "",
        subject: value.subject || value.category || "MSTE",
        card_type: "qa",
        difficulty: "medium",
      };
    },
    validate: (item) =>
      ["question", "answer"]
        .filter((key) => !String(item[key] || "").trim())
        .map((key) => `Missing required field: ${key}`),
    export: (item) => ({
      Question: item.question || "",
      Answer: item.answer || "",
      Subject: item.subject || "",
    }),
    preview: ["Subject", "Question", "Answer"],
  },
  formula: {
    title: "Formula Library",
    entity: firebaseApi.entities.Formula,
    filename: "formula-library",
    columns: [
      "Subject",
      "Folder",
      "Sub Folder",
      "Formula Name",
      "Formula",
      "Description",
      "Remarks",
      "Figure Label",
      "Figure URL",
      "Reference",
      "Tags",
      "Difficulty",
      "Order",
      "Variable Symbol 1",
      "Variable Meaning 1",
      "Variable Unit 1",
      "Variable Symbol 2",
      "Variable Meaning 2",
      "Variable Unit 2",
      "Variable Symbol 3",
      "Variable Meaning 3",
      "Variable Unit 3",
      "Variable Symbol 4",
      "Variable Meaning 4",
      "Variable Unit 4",
      "Variable Symbol 5",
      "Variable Meaning 5",
      "Variable Unit 5",
    ],
    sample: [
      {
        Subject: "PSAD",
        Folder: "Stress Analysis",
        "Sub Folder": "Axial Stress",
        "Formula Name": "Normal Stress",
        Formula: "σ=P/A",
        Description: "Normal stress due to axial loading.",
        Remarks: "",
        "Figure Label": "",
        "Figure URL": "",
        Reference: "Mechanics of Materials",
        Tags: "stress, mechanics",
        Difficulty: "easy",
        "Variable Symbol 1": "σ",
        "Variable Meaning 1": "Normal Stress",
        "Variable Unit 1": "MPa",
        "Variable Symbol 2": "P",
        "Variable Meaning 2": "Axial Load",
        "Variable Unit 2": "N",
        "Variable Symbol 3": "A",
        "Variable Meaning 3": "Cross-sectional Area",
        "Variable Unit 3": "mm²",
      },
    ],
    description:
      "Only Subject, Formula Name, and Formula are required; all other formula fields are optional.",
    map: (row) => mapSpreadsheetRow(row, "formula"),
    validate: (item) => spreadsheetValidationReasons(item, "formula"),
    export: (item) => ({
      Subject: item.subject || "",
      Folder: item.folder || item.topic || "",
      "Sub Folder": item.subFolder || item.subtopic || "",
      "Formula Name": item.name || "",
      Formula: item.formula || "",
      Description: item.description || "",
      Remarks: item.remarks || "",
      "Figure Label": item.figureLabel || "",
      "Figure URL": item.figureUrl || "",
      Reference: item.references || "",
      Tags: Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "",
      Difficulty: item.difficulty || "",
      Order: Number.isFinite(item.order) ? item.order : "",
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => {
          const n = i + 1;
          return [
            [`Variable Symbol ${n}`, item[`variableSymbol${n}`] || ""],
            [`Variable Meaning ${n}`, item[`variableMeaning${n}`] || ""],
            [`Variable Unit ${n}`, item[`variableUnit${n}`] || ""],
          ];
        }).flat(),
      ),
    }),
    preview: ["Subject", "Formula Name", "Formula"],
  },
  question: {
    title: "Question Bank",
    entity: firebaseApi.entities.Question,
    filename: "question-bank",
    columns: [
      "Question Type",
      "Situation ID",
      "Situation Title",
      "Situation Description",
      "Figure Label",
      "Image URL",
      "Subject",
      "Topic",
      "Sub Topic",
      "Question Number",
      "Question",
      "Option A",
      "Option B",
      "Option C",
      "Option D",
      "Correct Answer",
      "Explanation",
      "Difficulty",
      "Question Source",
      "Tags",
    ],
    sample: [
      {
        "Question Type": "Standalone",
        "Situation ID": "",
        "Situation Title": "",
        "Situation Description": "",
        "Figure Label": "",
        "Image URL": "",
        Subject: "PSAD",
        Topic: "Mechanics of Materials",
        "Sub Topic": "Axial Stress",
        "Question Number": "",
        Question: "What is normal stress?",
        "Option A": "Force per unit area",
        "Option B": "Moment per unit area",
        "Option C": "Pressure × Area",
        "Option D": "Weight × Length",
        "Correct Answer": "A",
        Explanation: "Normal stress is force divided by area.",
        Difficulty: "medium",
        "Question Source": "Past Board - November 2021",
        Tags: "stress, mechanics",
      },
      {
        "Question Type": "Situation",
        "Situation ID": "SIT-001",
        "Situation Title": "Simply Supported Beam",
        "Situation Description":
          "A simply supported beam carries the loading shown in Figure 1.",
        "Figure Label": "Figure 1",
        "Image URL": "https://example.com/beam-diagram.png",
        Subject: "PSAD",
        Topic: "Mechanics of Materials",
        "Question Number": "1",
        Question: "What is the reaction at A?",
        "Option A": "10 kN",
        "Option B": "15 kN",
        "Option C": "20 kN",
        "Option D": "25 kN",
        "Correct Answer": "A",
        Explanation: "Apply equilibrium.",
        Difficulty: "medium",
        "Question Source": "Review Center",
        Tags: "beam, statics",
      },
    ],
    description:
      "Use Question Type to import standalone or grouped situation questions.",
    map: (row) => mapSpreadsheetRow(row, "question"),
    validate: (item) => spreadsheetValidationReasons(item, "question"),
    export: (item, situations = []) => {
      const situation = situations.find(
        (entry) => entry.id === item.situationId,
      );
      return {
        "Question Type": situation || item.situationKey ? "Situation" : "Standalone",
        "Situation ID": situation?.externalId || item.situationKey || "",
        "Situation Title": situation?.title || item.situationTitle || "",
        "Situation Description":
          situation?.description || item.situationDescription || "",
        "Figure Label": situation?.figureLabel || item.figureLabel || "",
        "Image URL": situation?.imageUrl || item.imageUrl || "",
        Subject: item.subject || "",
        Topic: item.topic || "",
        "Sub Topic": item.subtopic || "",
        "Question Number": item.questionNumber || "",
        Question: item.question || "",
        "Option A": item.choices?.[0] || "",
        "Option B": item.choices?.[1] || "",
        "Option C": item.choices?.[2] || "",
        "Option D": item.choices?.[3] || "",
        "Correct Answer": item.correctAnswer || "",
        Explanation: item.explanation || "",
        Difficulty: item.difficulty || "",
        "Question Source": item.questionSource || "",
        Tags: Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "",
      };
    },
    preview: [
      "Question Type",
      "Situation ID",
      "Question Number",
      "Question",
      "Option A",
      "Option B",
      "Option C",
      "Option D",
      "Correct Answer",
    ],
    importEntries: importQuestionEntries,
  },
};

const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const downloadBlob = (name, blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
async function importQuestionEntries({ entries, userId, onProgress }) {
  const groups = new Map();
  const standalone = [];
  entries.forEach((entry) => {
    const key = entry.item.questionType === "situation" ? entry.item.situationKey?.trim() : "";
    if (key) groups.set(key, [...(groups.get(key) || []), entry]);
    else standalone.push(entry);
  });
  const created = [];
  const failedRows = [];
  let completed = 0;
  for (const [situationKey, group] of groups) {
    const first = group[0].item;
    try {
      const situation = await firebaseApi.entities.Situation.create({
        user_id: userId,
        externalId: situationKey,
        title: first.situationTitle || situationKey,
        description: first.situationDescription || "",
        imageUrl: first.imageUrl || null,
        figureLabel: first.figureLabel || "",
        sourceType: "spreadsheet",
      });
      const questions = await firebaseApi.entities.Question.bulkCreate(
        group.map(({ item }) => ({
          ...item,
          user_id: userId,
          situationId: situation.id,
          imageUrl: null,
          figureLabel: "",
          situationTitle: "",
          situationDescription: "",
        })),
      );
      created.push(...questions);
      completed += group.length;
    } catch (error) {
      group.forEach((entry) =>
        failedRows.push({
          ...entry,
          reasons: [
            `Firestore write failed: ${error.message || "Unknown error"}`,
          ],
        }),
      );
    }
    onProgress?.({
      phase: "Saving to Firestore",
      progress: 50 + Math.round((completed / Math.max(entries.length, 1)) * 50),
      total: entries.length,
      imported: created.length,
    });
  }
  if (standalone.length) {
    const result = await batchWriteItems({
      entries: standalone,
      entity: firebaseApi.entities.Question,
      userId,
      total: entries.length,
      onProgress,
    });
    created.push(...result.created);
    failedRows.push(...result.failedRows);
  }
  return { created, failedRows };
}

export default function ImportExport({
  user,
  cards = [],
  relations = [],
  onImported,
  type = "flashcard",
}) {
  const config = configs[type];
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState([]);
  const [status, setStatus] = useState(null);
  const inputRef = useRef(null);
  const { toast } = useToast();
  const rowsFor = (items) =>
    items.map((item) => config.export(item, relations));
  const downloadFile = async (format, template = false) => {
    const rows = template ? config.sample : rowsFor(cards);
    if (format === "csv") {
      const csv = [
        config.columns.map(quote).join(","),
        ...rows.map((row) =>
          config.columns.map((column) => quote(row[column])).join(","),
        ),
      ].join("\n");
      downloadBlob(
        `${template ? `${config.filename}-template` : config.filename}.csv`,
        new Blob([csv], { type: "text/csv" }),
      );
      return;
    }
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rows, { header: config.columns });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, config.title);
    XLSX.writeFile(
      book,
      `${template ? `${config.filename}-template` : config.filename}.xlsx`,
    );
  };
  const selectFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isSpreadsheetFile(file)) {
      toast({
        title: "Unsupported format. Use CSV, XLS, or XLSX.",
        variant: "destructive",
      });
      return;
    }
    setStatus({ phase: "Parsing file", progress: 5 });
    try {
      const rawRows = await readSpreadsheetRows(file, setStatus);
      const entries = [];
      const skipped = [];
      let automaticallyDetected = false;
      rawRows.forEach((raw, index) => {
        const item = config.map(raw);
        automaticallyDetected ||= type === "question" && item.questionTypeDetected;
        const reasons = config.validate(item);
        const entry = { row: index + 2, item, parsedRow: raw, reasons };
        if (reasons.length) skipped.push(entry);
        else entries.push(entry);
      });
      setPreview(entries);
      setStatus({
        phase: "Validated",
        progress: 45,
        total: rawRows.length,
        skipped: skipped.length,
      });
      if (automaticallyDetected)
        toast({
          title: "Question Type automatically detected.",
          description: "Rows with a Situation ID were treated as Situation; the rest as Standalone.",
        });
      if (!entries.length)
        toast({
          title: "No valid rows found",
          description: skipped[0]?.reasons.join(", "),
          variant: "destructive",
        });
    } catch (error) {
      setStatus(null);
      toast({
        title: error.message || "Failed to parse file",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };
  const confirmImport = async () => {
    if (!preview.length || !user) return;
    setStatus({
      phase: "Saving to Firestore",
      progress: 50,
      total: preview.length,
    });
    try {
      const entriesToImport = type === "formula"
        ? (() => {
            const nextBySection = new Map();
            cards.forEach((item) => {
              const key = `${item.subject || ""}\u0000${item.folder || item.topic || ""}\u0000${item.subFolder || item.subtopic || ""}`;
              nextBySection.set(key, Math.max(nextBySection.get(key) ?? -1, Number.isFinite(item.order) ? item.order : -1));
            });
            return preview.map((entry) => {
              if (Number.isFinite(entry.item.order)) return entry;
              const key = `${entry.item.subject || ""}\u0000${entry.item.folder || entry.item.topic || ""}\u0000${entry.item.subFolder || entry.item.subtopic || ""}`;
              const order = (nextBySection.get(key) ?? -1) + 1;
              nextBySection.set(key, order);
              return { ...entry, item: { ...entry.item, order } };
            });
          })()
        : preview;
      const { created, failedRows } = await (config.importEntries
        ? config.importEntries({
            entries: entriesToImport,
            userId: user.id,
            onProgress: setStatus,
          })
        : batchWriteItems({
            entries: entriesToImport,
            entity: config.entity,
            userId: user.id,
            total: preview.length,
            onProgress: setStatus,
          }));
      onImported(created);
      toast({
        title: `${created.length} ${config.title.toLowerCase()} imported!`,
        description: failedRows.length
          ? `${failedRows.length} rows could not be saved.`
          : "Saved directly to Firestore.",
      });
      setPreview([]);
      setOpen(false);
      setStatus(null);
    } catch (error) {
      toast({
        title:
          error.message || `Unable to import ${config.title.toLowerCase()}.`,
        variant: "destructive",
      });
    }
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-1" /> Import / Export
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import & Export {config.title}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="import">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="import">
                <Upload className="w-4 h-4 mr-1" /> Import
              </TabsTrigger>
              <TabsTrigger value="export">
                <Download className="w-4 h-4 mr-1" /> Export
              </TabsTrigger>
            </TabsList>
            <TabsContent value="import" className="space-y-4 mt-4">
              {!preview.length ? (
                <>
                  {type === "question" && (
                    <section className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm space-y-2">
                      <p className="font-medium">Question Type Guide</p>
                      <p><span className="font-medium">Standalone</span> → Leave all Situation columns blank.</p>
                      <p><span className="font-medium">Situation</span> → Fill the Situation information once and use the same Situation ID for all related questions.</p>
                    </section>
                  )}
                  <section>
                    <p className="text-sm font-medium mb-2">Templates</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {["csv", "xlsx"].map((format) => (
                        <div className="rounded-lg border p-3" key={format}>
                          <div className="flex items-center gap-2 font-medium">
                            {format === "csv" ? (
                              <FileText className="w-4 h-4" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4" />
                            )}
                            {config.title.replace("Library", "")}{" "}
                            {format === "csv" ? "CSV" : "Excel"} Template
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format.toUpperCase()} · {config.columns.length}{" "}
                            columns
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {config.description}
                          </p>
                          <Button
                            className="mt-3"
                            size="sm"
                            variant="outline"
                            onClick={() => downloadFile(format, true)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" /> Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-lg bg-muted/40 p-3 overflow-x-auto">
                    <p className="text-xs font-medium mb-2">Template preview</p>
                    <table className="text-xs min-w-full">
                      <thead>
                        <tr>
                          {config.preview.map((column) => (
                            <th className="text-left pr-4 pb-1" key={column}>
                              {column.replace("Option ", "")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {config.sample.slice(0, 2).map((row, index) => (
                          <tr key={index}>
                            {config.preview.map((column) => (
                              <td
                                className="pr-4 py-1 text-muted-foreground"
                                key={column}
                              >
                                {row[column]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                  <section>
                    <p className="text-sm font-medium mb-2">Choose File</p>
                    <Button
                      onClick={() => inputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" /> Choose CSV / Excel
                    </Button>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      className="hidden"
                      onChange={selectFile}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Files are read locally and are never uploaded.
                    </p>
                  </section>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    {preview.length} {config.title.toLowerCase()} ready to
                    import
                  </p>
                  <div className="max-h-60 overflow-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          {config.preview.map((column) => (
                            <th className="text-left p-2" key={column}>
                              {column.replace("Option ", "")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map(({ item }, index) => {
                          const row = config.export(item);
                          return (
                            <tr className="border-t" key={index}>
                              {config.preview.map((column) => (
                                <td className="p-2" key={column}>
                                  {row[column]}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setPreview([]);
                        setStatus(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={confirmImport}>
                      <Check className="w-4 h-4 mr-2" /> Import {preview.length}
                    </Button>
                  </div>
                </div>
              )}
              {status && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{status.phase}</span>
                    <span>{status.progress || 0}%</span>
                  </div>
                  <Progress value={status.progress || 0} />
                </div>
              )}
            </TabsContent>
            <TabsContent value="export" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Export your {cards.length} {config.title.toLowerCase()} for
                backup or sharing.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  disabled={!cards.length}
                  onClick={() => downloadFile("csv")}
                >
                  <FileText className="w-4 h-4 mr-2" /> Export CSV
                </Button>
                <Button
                  variant="outline"
                  disabled={!cards.length}
                  onClick={() => downloadFile("xlsx")}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
