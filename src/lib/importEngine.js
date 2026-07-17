import { firebaseApi } from '@/api/firebaseClient';

export const IMPORT_ACCEPT = '.pdf,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg,.webp';
export const FORMULA_IMPORT_ACCEPT = '.pdf,.docx,.xlsx,.csv,.txt,.jpg,.png';

const formulaFields = ['name', 'subject', 'topic', 'formula'];
const questionFields = ['subject', 'topic', 'difficulty', 'question', 'choices', 'correctAnswer', 'explanation'];

export const blankFormula = () => ({
  name: '', subject: '', topic: '', subtopic: '', formula: '', description: '', variables: '', units: '',
  conditions: '', applications: '', exampleProblem: '', solution: '', finalAnswer: '', commonMistakes: '',
  relatedFormulas: '', references: '', tags: '', sourceType: 'manual', visibility: 'private',
});

export const blankQuestion = () => ({
  subject: '', topic: '', difficulty: 'medium', question: '', choices: ['', '', '', ''],
  correctAnswer: '', explanation: '', formulaReferences: '', tags: '', boardYear: '', source: '',
  images: [], attachments: [], sourceType: 'manual', visibility: 'private', confidence: 1,
});

export function normalizeItem(item, type, sourceType = 'imported') {
  const base = type === 'formula' ? blankFormula() : blankQuestion();
  const choices = item.choices || [item.choiceA || item.A || '', item.choiceB || item.B || '', item.choiceC || item.C || '', item.choiceD || item.D || ''];
  return {
    ...base, ...item, choices: type === 'question' ? choices.slice(0, 4) : undefined,
    sourceType, visibility: item.visibility || 'private',
    confidence: Number(item.confidence ?? 1),
  };
}

export function validateItem(item, type) {
  const required = type === 'formula' ? formulaFields : questionFields;
  const missing = required.filter((field) => {
    if (field === 'choices') return !Array.isArray(item.choices) || item.choices.filter(Boolean).length < 2;
    return !item[field]?.toString().trim();
  });
  return { valid: missing.length === 0, missing };
}

export async function extractImport({ file, type, userId }) {
  const { file_url, path } = await firebaseApi.integrations.Core.UploadFile({ file });
  const target = type === 'formula' ? 'formulas' : 'multiple-choice questions';
  const result = await firebaseApi.integrations.Core.InvokeLLM({
    file_urls: [file_url],
    response_json_schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } } } },
    prompt: `You are CELE Pilot's import engine. Extract every ${target} from this file. It may be a PDF, DOCX, TXT, CSV, XLSX, scanned page, or image. Use OCR where necessary. Run a quality check: fix OCR/formatting errors, split merged items, normalize LaTex math, correct numbering, and flag possible duplicates. Return JSON {items:[...]}. ${type === 'formula'
      ? 'Formula fields: name, subject, topic, subtopic, formula (LaTex allowed), description, variables, units, conditions, applications, relatedFormulas, references, confidence, duplicateOf. Preserve every mathematical symbol and convert equations to LaTeX where reliable.'
      : 'Question fields: subject, topic, difficulty, question, choices (exactly four strings when available), correctAnswer (A-D or answer text), explanation, formulaReferences, tags, boardYear, source, confidence, duplicateOf. Infer a missing answer only at high confidence; otherwise leave it blank and set confidence below 0.8.'}`,
  });
  const items = (result.items || []).map((item) => normalizeItem(item, type));
  await firebaseApi.entities.Import.create({
    user_id: userId, fileName: file.name, fileUrl: file_url, storagePath: path, fileType: file.type,
    contentType: type, status: 'review_required', itemCount: items.length, sourceType: 'imported',
  });
  return items;
}
