export const blankQuestion = () => ({
  question: '', choices: ['', '', '', ''], correctAnswer: '', explanation: '', formulaReference: '',
});

export const blankGroup = (kind = 'standalone') => ({
  kind, subject: '', topic: '', difficulty: 'medium', situationDescription: '', figures: [],
  questions: [blankQuestion()], sourceType: 'manual', visibility: 'private', confidence: 1,
});

export const normalizeQuestion = (question = {}) => ({
  ...blankQuestion(), ...question,
  choices: (question.choices || [question.choiceA || question.A || '', question.choiceB || question.B || '', question.choiceC || question.C || '', question.choiceD || question.D || '']).slice(0, 4),
  formulaReference: question.formulaReference || question.formulaReferences || '',
});

export const normalizeGroup = (group = {}, sourceType = 'imported') => {
  const situationDescription = group.situationDescription || group.situation || group.stem || '';
  const questions = (group.questions || group.items || (group.question ? [group] : [])).map(normalizeQuestion).slice(0, 10);
  return {
    ...blankGroup(situationDescription || questions.length > 1 ? 'situation' : 'standalone'), ...group,
    kind: group.kind || (situationDescription || questions.length > 1 ? 'situation' : 'standalone'),
    situationDescription, questions: questions.length ? questions : [blankQuestion()],
    figures: group.figures || group.images || [], sourceType, confidence: Number(group.confidence ?? 1),
  };
};

export const validateGroup = (group) => {
  const missing = ['subject', 'topic', 'difficulty'].filter((key) => !String(group[key] || '').trim());
  if (group.kind === 'situation' && !String(group.situationDescription || '').trim()) missing.push('situation description');
  if (!group.questions?.length) missing.push('question');
  group.questions?.forEach((question, index) => {
    if (!String(question.question || '').trim()) missing.push(`question ${index + 1}`);
    if (!Array.isArray(question.choices) || question.choices.filter(Boolean).length !== 4) missing.push(`four choices for question ${index + 1}`);
    if (!String(question.correctAnswer || '').trim()) missing.push(`correct answer for question ${index + 1}`);
  });
  return { valid: !missing.length, missing };
};
