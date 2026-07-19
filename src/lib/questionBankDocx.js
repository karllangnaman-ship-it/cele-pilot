import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { mapSpreadsheetRow, spreadsheetValidationReasons } from '@/lib/importEngine';

const clean = (value) => String(value ?? '').trim();
const key = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const fieldNames = {
  subject: 'Subject', questionSource: 'Question Source', topic: 'Topic', subtopic: 'Subtopic',
  questionType: 'Question Type', difficulty: 'Difficulty', question: 'Question', choices: 'Choices',
  correctAnswer: 'Correct Answer', explanation: 'Explanation', formulaReferences: 'Formula (LaTeX)',
  figureLabel: 'Figure Label', imageUrl: 'Image URL', tags: 'Tags', questionNumber: 'Question Number',
  situationKey: 'Situation Number', situationDescription: 'Situation Description', situationImageUrl: 'Situation Image URL',
};
const markdownText = (node) => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  const children = [...node.childNodes].map(markdownText).join('');
  if (node.nodeName === 'A') return `[${children}](${node.getAttribute('href') || ''})`;
  if (node.nodeName === 'STRONG' || node.nodeName === 'B') return `**${children}**`;
  if (node.nodeName === 'EM' || node.nodeName === 'I') return `*${children}*`;
  if (node.nodeName === 'BR') return '\n';
  if (node.nodeName === 'LI') return `- ${children}\n`;
  if (node.nodeName === 'P') return `${children}\n`;
  return children;
};
const table = (rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map(([label, value]) => new TableRow({ children: [new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })] }), new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph(value || '')] })] })) });
const questionRows = (question) => [
  [fieldNames.subject, question.subject || 'Engineering Mechanics'], [fieldNames.questionSource, question.questionSource || 'Past Board Exam'],
  [fieldNames.topic, question.topic || 'Projectile Motion'], [fieldNames.subtopic, question.subtopic || 'Horizontal Projectile'],
  [fieldNames.questionType, question.situationId || question.situationKey ? 'Situation' : 'Standalone'], [fieldNames.difficulty, question.difficulty || 'Medium'],
  [fieldNames.questionNumber, question.questionNumber || ''], [fieldNames.question, question.question || 'A projectile is fired...'],
  ['Choice A', question.choices?.[0] || '10 m'], ['Choice B', question.choices?.[1] || '20 m'], ['Choice C', question.choices?.[2] || '30 m'], ['Choice D', question.choices?.[3] || '40 m'],
  [fieldNames.correctAnswer, question.correctAnswer || 'B'], [fieldNames.explanation, question.explanation || 'Use the projectile equation...'],
  [fieldNames.formulaReferences, question.formulaReferences || 'R=\\frac{v^2\\sin(2\\theta)}{g}'], [fieldNames.figureLabel, question.figureLabel || 'Figure 1'],
  [fieldNames.imageUrl, question.imageUrl || 'https://...'], [fieldNames.tags, Array.isArray(question.tags) ? question.tags.join(', ') : question.tags || 'Projectile, Kinematics'],
];
const situationRows = (situation) => [[fieldNames.situationKey, situation.externalId || situation.situationKey || 'SIT-001'], [fieldNames.situationDescription, situation.description || situation.situationDescription || 'Read the following situation before answering the questions.'], [fieldNames.situationImageUrl, situation.imageUrl || 'https://...'], [fieldNames.figureLabel, situation.figureLabel || 'Figure 1']];

export async function downloadQuestionBankDocx({ questions = [], situations = [], template = false }) {
  const standalone = template ? {} : questions.find((question) => !question.situationId) || {};
  const situation = template ? {} : situations[0] || {};
  const situationQuestions = template ? [{ situationKey: 'SIT-001', questionNumber: '1' }] : questions.filter((question) => question.situationId === situation.id);
  const sections = [new Paragraph({ text: 'Question Bank DOCX Template', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }), new Paragraph('Edit the field values in the tables. Keep LaTeX exactly as written. Required fields: Subject, Question, Choices A-D, Correct Answer.'), new Paragraph({ text: 'Standalone Question', heading: HeadingLevel.HEADING_1 }), table(questionRows(standalone))];
  if (template || situationQuestions.length) {
    sections.push(new Paragraph({ text: 'Situational Questions', heading: HeadingLevel.HEADING_1 }), new Paragraph({ text: 'Situation SIT-001', heading: HeadingLevel.HEADING_2 }), table(situationRows(situation)));
    (situationQuestions.length ? situationQuestions : [{}]).forEach((question, index) => sections.push(new Paragraph({ text: `Question ${question.questionNumber || index + 1}`, heading: HeadingLevel.HEADING_2 }), table(questionRows({ ...question, situationKey: question.situationKey || situation.externalId || 'SIT-001' }))));
  }
  const blob = await Packer.toBlob(new Document({ sections: [{ children: sections }] }));
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = template ? 'question-bank-docx-template.docx' : 'question-bank.docx'; link.click(); URL.revokeObjectURL(url);
}

const rowToItem = (fields, situation) => {
  const value = (...names) => names.map((name) => fields[key(name)]).find(Boolean) || '';
  const choices = ['a', 'b', 'c', 'd'].map((letter) => value(`choice${letter}`, `option${letter}`));
  const questionType = value('questiontype') || (situation ? 'Situation' : 'Standalone');
  return mapSpreadsheetRow({
    Subject: value('subject'), Topic: value('topic'), 'Sub Topic': value('subtopic'), Difficulty: value('difficulty') || 'medium',
    Question: value('question'), 'Option A': choices[0], 'Option B': choices[1], 'Option C': choices[2], 'Option D': choices[3],
    'Correct Answer': value('correctanswer'), Explanation: value('explanation'), 'Formula References': value('formulalatex', 'latex', 'formula'),
    'Question Source': value('questionsource'), 'Figure Label': value('figurelabel'), 'Image URL': value('imageurl'), Tags: value('tags'),
    'Question Type': questionType, 'Situation ID': situation?.id || value('situationnumber', 'situationid'),
    'Situation Title': situation?.title || '', 'Situation Description': situation?.description || '', 'Question Number': value('questionnumber'),
  }, 'question');
};

export async function parseQuestionBankDocx(file) {
  if (!file?.name?.toLowerCase().endsWith('.docx')) throw new Error('Choose a .docx file.');
  const mammoth = await import('mammoth/mammoth.browser');
  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const root = new DOMParser().parseFromString(html, 'text/html').body;
  const entries = []; let currentSituation = null; let currentQuestion = null; let activeField = ''; let number = 0;
  const finish = () => { if (!currentQuestion) return; const item = rowToItem(currentQuestion, currentSituation); const reasons = spreadsheetValidationReasons(item, 'question'); entries.push({ row: ++number, item, parsedRow: currentQuestion, reasons }); currentQuestion = null; activeField = ''; };
  [...root.children].forEach((node) => {
    if (/^H[1-6]$/.test(node.nodeName)) { const heading = clean(node.textContent); if (/^situation\b/i.test(heading)) { finish(); currentSituation = { id: heading.replace(/^situation\s*/i, '').trim() || `SIT-${number + 1}`, title: heading }; } else if (/^(standalone\s+)?question\b/i.test(heading)) { finish(); currentQuestion = {}; const questionNumber = heading.match(/\d+/)?.[0]; if (questionNumber) currentQuestion.questionnumber = questionNumber; } return; }
    if (node.nodeName === 'TABLE') { const fields = {}; [...node.rows].forEach((row) => { const cells = [...row.cells]; if (cells.length >= 2) fields[key(cells[0].textContent)] = clean(markdownText(cells[1])); }); if (currentQuestion) Object.assign(currentQuestion, fields); else if (currentSituation) { currentSituation = { ...currentSituation, id: fields.situationnumber || fields.situationid || currentSituation.id, description: fields.situationdescription || currentSituation.description || '', imageUrl: fields.situationimageurl || fields.imageurl || '', figureLabel: fields.figurelabel || '' }; } return; }
    const text = clean(markdownText(node));
    if ((node.nodeName === 'UL' || node.nodeName === 'OL') && currentQuestion && activeField === 'choices') {
      [...node.querySelectorAll(':scope > li')].forEach((item, index) => { currentQuestion[`choice${'abcd'[index]}`] = clean(markdownText(item)).replace(/^[A-D][.)]\s*/i, ''); });
      return;
    }
    const match = text.match(/^([^:\n]+):\s*([\s\S]*)$/);
    if (match && currentQuestion) { activeField = key(match[1]); currentQuestion[activeField] = match[2]; }
  });
  finish();
  if (!entries.length) throw new Error('No question sections were found. Use the official DOCX template.');
  return { entries, warnings: messages.map((message) => message.message) };
}
