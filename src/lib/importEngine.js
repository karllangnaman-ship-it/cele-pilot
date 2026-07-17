import { normalizeSpreadsheetRow } from "@/lib/spreadsheetImport";

const formulaFields = ["subject", "name", "formula"];
const questionFields = ["subject", "question", "correctAnswer"];

export const blankFormula = () => ({
  name: "",
  subject: "",
  folder: "",
  subFolder: "",
  topic: "",
  subtopic: "",
  formula: "",
  description: "",
  remarks: "",
  figureUrl: "",
  difficulty: "",
  variableSymbol1: "",
  variableMeaning1: "",
  variableUnit1: "",
  variableSymbol2: "",
  variableMeaning2: "",
  variableUnit2: "",
  variableSymbol3: "",
  variableMeaning3: "",
  variableUnit3: "",
  variableSymbol4: "",
  variableMeaning4: "",
  variableUnit4: "",
  variableSymbol5: "",
  variableMeaning5: "",
  variableUnit5: "",
  variables: "",
  units: "",
  conditions: "",
  applications: "",
  exampleProblem: "",
  solution: "",
  finalAnswer: "",
  commonMistakes: "",
  relatedFormulas: "",
  references: "",
  tags: "",
  sourceType: "manual",
  visibility: "private",
});
export const blankQuestion = () => ({
  subject: "",
  topic: "",
  subtopic: "",
  difficulty: "medium",
  question: "",
  choices: ["", "", "", ""],
  correctAnswer: "",
  explanation: "",
  formulaReferences: "",
  tags: "",
  boardYear: "",
  source: "",
  imageUrl: null,
  figureLabel: "",
  situationId: null,
  situationKey: "",
  situationTitle: "",
  situationDescription: "",
  questionNumber: "",
  sourceType: "manual",
  visibility: "private",
  confidence: 1,
});

export function normalizeItem(item, type, sourceType = "imported") {
  const base = type === "formula" ? blankFormula() : blankQuestion();
  const rawChoices = item.choices ?? [
    item.choiceA || item.A || "",
    item.choiceB || item.B || "",
    item.choiceC || item.C || "",
    item.choiceD || item.D || "",
  ];
  const choices = Array.isArray(rawChoices)
    ? rawChoices
    : typeof rawChoices === "string"
      ? rawChoices.split(/\s*\|\s*|\n/).filter(Boolean)
      : [];
  return {
    ...base,
    ...item,
    ...(type === "question" ? { choices: choices.slice(0, 4) } : {}),
    sourceType,
    visibility: item.visibility || "private",
    confidence: Number(item.confidence ?? 1),
  };
}

export function validateItem(item, type) {
  const required = type === "formula" ? formulaFields : questionFields;
  const missing = required.filter((field) =>
    field === "choices"
      ? !Array.isArray(item.choices) || item.choices.filter(Boolean).length < 2
      : !item[field]?.toString().trim(),
  );
  return { valid: missing.length === 0, missing };
}

const first = (row, ...keys) =>
  keys
    .map((key) => row[key])
    .find((value) => value !== undefined && String(value).trim() !== "") || "";
const splitValues = (value) =>
  Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[|;]/)
        .map((item) => item.trim())
        .filter(Boolean);

export function mapSpreadsheetRow(row, type) {
  const values = normalizeSpreadsheetRow(row);
  if (type === "formula")
    return normalizeItem(
      {
        name: first(values, "name", "formulaname", "title"),
        subject: first(values, "subject"),
        folder: first(values, "folder", "topic", "category"),
        subFolder: first(values, "subfolder", "subtopic"),
        formula: first(values, "formula", "equation"),
        description: first(values, "description"),
        remarks: first(values, "remarks"),
        figureUrl: first(values, "figureurl", "imageurl"),
        difficulty: first(values, "difficulty"),
        variableSymbol1: first(values, "variablesymbol1"),
        variableMeaning1: first(values, "variablemeaning1"),
        variableUnit1: first(values, "variableunit1"),
        variableSymbol2: first(values, "variablesymbol2"),
        variableMeaning2: first(values, "variablemeaning2"),
        variableUnit2: first(values, "variableunit2"),
        variableSymbol3: first(values, "variablesymbol3"),
        variableMeaning3: first(values, "variablemeaning3"),
        variableUnit3: first(values, "variableunit3"),
        variableSymbol4: first(values, "variablesymbol4"),
        variableMeaning4: first(values, "variablemeaning4"),
        variableUnit4: first(values, "variableunit4"),
        variableSymbol5: first(values, "variablesymbol5"),
        variableMeaning5: first(values, "variablemeaning5"),
        variableUnit5: first(values, "variableunit5"),
        variables: first(values, "variables"),
        units: first(values, "units"),
        references: first(values, "reference", "references"),
        tags: splitValues(first(values, "tags")),
      },
      type,
      "spreadsheet",
    );
  const suppliedQuestionType = first(values, "questiontype");
  const situationKey = first(values, "situationid");
  const questionType = suppliedQuestionType
    ? suppliedQuestionType.trim().toLowerCase()
    : situationKey
      ? "situation"
      : "standalone";
  const isStandalone = questionType === "standalone";
  return normalizeItem(
    {
      questionType,
      questionTypeDetected: !suppliedQuestionType,
      situationKey: isStandalone ? "" : situationKey,
      situationTitle: isStandalone ? "" : first(values, "situationtitle"),
      situationDescription: isStandalone ? "" : first(values, "situationdescription", "situation"),
      imageUrl: isStandalone ? "" : first(values, "imageurl"),
      figureLabel: isStandalone ? "" : first(values, "figurelabel"),
      subject: first(values, "subject"),
      topic: first(values, "topic"),
      subtopic: first(values, "subtopic", "subtopic"),
      questionNumber: isStandalone ? "" : first(values, "questionnumber", "questionno"),
      difficulty: first(values, "difficulty") || "medium",
      question: first(values, "question"),
      choices: [
        first(values, "choicea", "a", "optiona"),
        first(values, "choiceb", "b", "optionb"),
        first(values, "choicec", "c", "optionc"),
        first(values, "choiced", "d", "optiond"),
      ].map(
        (value, index) =>
          value || splitValues(first(values, "choices"))[index] || "",
      ),
      correctAnswer: first(values, "correctanswer", "answer"),
      explanation: first(values, "explanation"),
      formulaReferences: first(values, "formulareferences", "formulareference"),
      tags: splitValues(first(values, "tags")),
      boardYear: first(values, "boardyear"),
      source: first(values, "source"),
    },
    type,
    "spreadsheet",
  );
}

export function spreadsheetValidationReasons(item, type) {
  if (type !== "formula") {
    const reasons = validateItem(item, type).missing.map((field) => `Missing required field: ${field}`);
    const questionType = String(item.questionType || '').trim().toLowerCase();
    if (questionType && !['standalone', 'situation'].includes(questionType)) reasons.push('Question Type must be Standalone or Situation');
    if (questionType === 'situation' && !String(item.situationKey || '').trim()) reasons.push('Situation ID is required for Situation questions');
    return reasons;
  }
  return validateItem(item, type).missing.map(
    (field) => `Missing required field: ${field}`,
  );
}
