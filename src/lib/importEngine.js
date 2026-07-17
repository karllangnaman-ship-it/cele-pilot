import { firebaseApi } from '@/api/firebaseClient';

export const IMPORT_ACCEPT = '.pdf,.docx,.pptx,.txt,.csv,.xlsx,.png,.jpg,.jpeg,.webp';
export const DOCUMENT_IMPORT_ACCEPT = '.pdf,.docx,.pptx,.txt,.csv,.xlsx';
export const QUESTION_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';
export const FORMULA_IMPORT_ACCEPT = '.pdf,.docx,.xlsx,.csv,.txt,.jpg,.png';
const IMPORT_TIMEOUT_MS = 60_000;

export const isSupportedImportFile = (file, type) => {
  const allowed = (type === 'formula' ? FORMULA_IMPORT_ACCEPT : IMPORT_ACCEPT).split(',');
  const extension = `.${file?.name?.split('.').pop()?.toLowerCase() || ''}`;
  return allowed.includes(extension);
};
export const isSupportedQuestionImage = (file) => QUESTION_IMAGE_ACCEPT.split(',').includes(`.${file?.name?.split('.').pop()?.toLowerCase() || ''}`);

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
    images: type === 'question' ? (item.images || item.figures || base.images) : undefined,
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
  console.info('[Question Import] File selected', { name: file.name });
  console.info('[Question Import] File type', { type: file.type || 'unknown', extension: file.name.split('.').pop() });
  console.info('[Question Import] File size', { bytes: file.size });
  console.info('[Question Import] File upload started');
  const { file_url, path } = await firebaseApi.integrations.Core.UploadFile({ file, timeoutMs: IMPORT_TIMEOUT_MS, folder: type === 'formula' ? 'FormulaImports' : 'QuestionImports' });
  console.info('[Question Import] File upload finished');
  const target = type === 'formula' ? 'formulas' : 'multiple-choice questions';
  console.info('[Question Import] OCR started');
  console.info('[Question Import] AI extraction started');
  const result = await firebaseApi.integrations.Core.InvokeLLM({
    file_urls: [file_url],
    response_json_schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } } } },
    timeoutMs: IMPORT_TIMEOUT_MS,
    prompt: `You are CELE Pilot's import engine. Extract every ${target} from this file. It may be a PDF, DOCX, PPTX, TXT, CSV, XLSX, scanned page, or image. Use OCR where necessary. Run a quality check: fix OCR/formatting errors, split merged items, normalize LaTex math, correct numbering, and flag possible duplicates. Return JSON {items:[...]}. ${type === 'formula'
      ? 'Formula fields: name, subject, topic, subtopic, formula (LaTex allowed), description, variables, units, conditions, applications, relatedFormulas, references, confidence, duplicateOf. Preserve every mathematical symbol and convert equations to LaTeX where reliable.'
      : 'Map every question to the official CELE Pilot Question Bank template. Question fields: subject, topic, difficulty, question, choices (exactly four strings when available), correctAnswer (A-D or answer text), explanation, formulaReferences, tags, boardYear, source, confidence, fieldConfidence (an object keyed by field), duplicateOf. If a file already uses that template, preserve it directly. Otherwise map the closest matching labels and content to it. Detect a shared Situation Description and Figure/Image for numbered linked questions; retain that shared text in each linked result as situationDescription and situationQuestionNumber so the review UI can keep the situation together. Infer a missing answer only at high confidence; otherwise leave it blank and set confidence below 0.8.'}`,
  });
  console.info('[Question Import] OCR finished');
  console.info('[Question Import] AI extraction finished');
  const items = (result.items || []).map((item) => normalizeItem(item, type));
  console.info('[Question Import] Parsing completed', { itemCount: items.length });
  await firebaseApi.entities.Import.create({
    user_id: userId, fileName: file.name, storagePath: path, bucket: 'cele-pilot', size: file.size, mimeType: file.type,
    contentType: type, status: 'review_required', itemCount: items.length, sourceType: 'imported',
  });
  console.info('[Question Import] Preview generated', { itemCount: items.length });
  console.info('[Question Import] Import finished');
  return items;
}

export async function extractQuestionImages({ files, userId }) {
  if (!files?.length) throw new Error('Select at least one question image.');
  console.info('[Question Image Import] OCR started', { imageCount: files.length });
  const uploaded = await Promise.all(files.map(async (file) => {
    console.info('[Question Image Import] Image upload started', { name: file.name, bytes: file.size });
    const result = await firebaseApi.integrations.Core.UploadFile({ file, timeoutMs: IMPORT_TIMEOUT_MS, folder: 'QuestionImports' });
    console.info('[Question Image Import] Image upload finished', { name: file.name });
    return { ...result, file };
  }));
  console.info('[Question Image Import] AI extraction started');
  const result = await firebaseApi.integrations.Core.InvokeLLM({
    file_urls: uploaded.map(item => item.file_url), timeoutMs: IMPORT_TIMEOUT_MS,
    response_json_schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } } } },
    prompt: `You are CELE Pilot's question-image OCR and extraction engine. These ${files.length} images may be consecutive pages of ONE CELE reviewer or board-exam situation. First OCR each image, then merge continuation pages before returning JSON {items:[...]}. Extract subject/topic when detectable, situationDescription, figures/descriptions, question numbers, question, choices (four strings), correctAnswer, explanation, formulaReferences, confidence, and fieldConfidence. If a shared situation is followed by Questions 1-10 across one or multiple images, keep all questions linked by the same situationId and repeat the same situationDescription/figures on each linked item; NEVER split the situation. Preserve engineering figures, tables, graphs, structural drawings, survey maps, and equations. If a field is uncertain, leave it blank, mark its fieldConfidence below 0.8, and do not invent an answer.`,
  });
  console.info('[Question Image Import] OCR finished');
  console.info('[Question Image Import] AI extraction finished');
  const items = (result.items || []).map(item => normalizeItem(item, 'question', 'imported_image'));
  console.info('[Question Image Import] Parsing completed', { itemCount: items.length });
  if (!items.length) throw new Error('No questions could be extracted from these images. Try clearer images or enter the questions manually.');
  await firebaseApi.entities.Import.create({ user_id: userId, fileName: files.map(file => file.name).join(', '), storagePath: uploaded[0].path, bucket: uploaded[0].bucket, size: uploaded.reduce((total, item) => total + item.file.size, 0), mimeType: 'image/*', contentType: 'question', status: 'review_required', itemCount: items.length, sourceType: 'imported_image' });
  console.info('[Question Image Import] Preview generated', { itemCount: items.length });
  console.info('[Question Image Import] Import finished');
  return items;
}
