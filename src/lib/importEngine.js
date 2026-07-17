import { normalizeSpreadsheetRow } from '@/lib/spreadsheetImport';

const formulaFields = ['subject', 'name', 'formula'];
const questionFields = ['subject', 'question', 'correctAnswer'];

export const blankFormula = () => ({ name: '', subject: '', topic: '', subtopic: '', formula: '', description: '', variables: '', units: '', conditions: '', applications: '', exampleProblem: '', solution: '', finalAnswer: '', commonMistakes: '', relatedFormulas: '', references: '', tags: '', sourceType: 'manual', visibility: 'private' });
export const blankQuestion = () => ({ subject: '', topic: '', difficulty: 'medium', question: '', choices: ['', '', '', ''], correctAnswer: '', explanation: '', formulaReferences: '', tags: '', boardYear: '', source: '', imageUrl: null, figureLabel: '', situationId: null, situationKey: '', situationTitle: '', situationDescription: '', questionNumber: '', sourceType: 'manual', visibility: 'private', confidence: 1 });

export function normalizeItem(item, type, sourceType = 'imported') {
  const base = type === 'formula' ? blankFormula() : blankQuestion();
  const choices = item.choices || [item.choiceA || item.A || '', item.choiceB || item.B || '', item.choiceC || item.C || '', item.choiceD || item.D || ''];
  return { ...base, ...item, ...(type === 'question' ? { choices: choices.slice(0, 4) } : {}), sourceType, visibility: item.visibility || 'private', confidence: Number(item.confidence ?? 1) };
}

export function validateItem(item, type) {
  const required = type === 'formula' ? formulaFields : questionFields;
  const missing = required.filter((field) => field === 'choices' ? !Array.isArray(item.choices) || item.choices.filter(Boolean).length < 2 : !item[field]?.toString().trim());
  return { valid: missing.length === 0, missing };
}

const first = (row, ...keys) => keys.map((key) => row[key]).find((value) => value !== undefined && String(value).trim() !== '') || '';
const splitValues = (value) => Array.isArray(value) ? value : String(value || '').split(/[|;]/).map((item) => item.trim()).filter(Boolean);

export function mapSpreadsheetRow(row, type) {
  const values = normalizeSpreadsheetRow(row);
  if (type === 'formula') return normalizeItem({ name: first(values, 'name', 'formulaname', 'title'), subject: first(values, 'subject'), topic: first(values, 'topic', 'category'), subtopic: first(values, 'subtopic'), formula: first(values, 'formula', 'equation'), description: first(values, 'description'), variables: first(values, 'variables'), units: first(values, 'units'), conditions: first(values, 'conditions'), applications: first(values, 'applications'), exampleProblem: first(values, 'exampleproblem'), solution: first(values, 'solution'), finalAnswer: first(values, 'finalanswer'), commonMistakes: first(values, 'commonmistakes'), relatedFormulas: first(values, 'relatedformulas'), references: first(values, 'references'), tags: splitValues(first(values, 'tags')) }, type, 'spreadsheet');
  return normalizeItem({ situationKey: first(values, 'situationid'), situationTitle: first(values, 'situationtitle'), situationDescription: first(values, 'situationdescription', 'situation'), imageUrl: first(values, 'imageurl'), figureLabel: first(values, 'figurelabel'), subject: first(values, 'subject'), topic: first(values, 'topic'), questionNumber: first(values, 'questionnumber', 'questionno'), difficulty: first(values, 'difficulty') || 'medium', question: first(values, 'question'), choices: [first(values, 'choicea', 'a', 'optiona'), first(values, 'choiceb', 'b', 'optionb'), first(values, 'choicec', 'c', 'optionc'), first(values, 'choiced', 'd', 'optiond')].map((value, index) => value || splitValues(first(values, 'choices'))[index] || ''), correctAnswer: first(values, 'correctanswer', 'answer'), explanation: first(values, 'explanation'), formulaReferences: first(values, 'formulareferences', 'formulareference'), tags: splitValues(first(values, 'tags')), boardYear: first(values, 'boardyear'), source: first(values, 'source') }, type, 'spreadsheet');
}

export function spreadsheetValidationReasons(item, type) {
  if (type !== 'formula') return validateItem(item, type).missing.map((field) => `Missing required field: ${field}`);
  return validateItem(item, type).missing.map((field) => `Missing required field: ${field}`);
}
