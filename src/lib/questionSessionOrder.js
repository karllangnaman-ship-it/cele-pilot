const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

// A session is a snapshot of library records. Preserve one canonical figure
// contract as the snapshot is assembled so Practice and Mock never lose a
// working image while moving between Question/Situation data models.
const withFigureData = (record) => ({
  ...record,
  figureLabel: record.figureLabel || '',
  imageUrl: typeof record.imageUrl === 'string' && record.imageUrl.trim()
    ? record.imageUrl
    : (typeof record.figureUrl === 'string' && record.figureUrl.trim()
      ? record.figureUrl
      : null),
  resolvedImageUrl: typeof record.resolvedImageUrl === 'string' && record.resolvedImageUrl.trim()
    ? record.resolvedImageUrl
    : null,
});

// A unit is either one standalone question or every question belonging to a situation.
// Selecting/shuffling units is what prevents a situation from being broken apart.
export function buildQuestionSession(
  questions,
  situations,
  { count, shuffleQuestions, shuffleWithinSituation },
) {
  const sessionQuestions = questions.map(withFigureData);
  const sessionSituations = situations.map(withFigureData);
  const situationLookup = new Map(
    sessionSituations.map((situation) => [situation.id, situation]),
  );
  const grouped = new Map();

  sessionQuestions.forEach((question) => {
    if (question.situationId && situationLookup.has(question.situationId)) {
      grouped.set(question.situationId, [
        ...(grouped.get(question.situationId) || []),
        question,
      ]);
    }
  });
  const seenSituations = new Set();
  const originalUnits = [];
  sessionQuestions.forEach((question) => {
    if (!question.situationId || !situationLookup.has(question.situationId))
      return;
    if (seenSituations.has(question.situationId)) return;
    seenSituations.add(question.situationId);
    originalUnits.push({
      kind: "situation",
      situation: situationLookup.get(question.situationId),
      questions: grouped
        .get(question.situationId)
        .sort(
          (a, b) =>
            Number(a.questionNumber || 0) - Number(b.questionNumber || 0),
        ),
    });
  });
  // Rebuild in the source-list order: an encountered situation is emitted once as a whole block.
  const orderedBySource = [];
  const emitted = new Set();
  sessionQuestions.forEach((question) => {
    if (question.situationId && situationLookup.has(question.situationId)) {
      if (emitted.has(question.situationId)) return;
      emitted.add(question.situationId);
      orderedBySource.push(
        originalUnits.find(
          (unit) => unit.situation.id === question.situationId,
        ),
      );
    } else orderedBySource.push({ kind: "standalone", questions: [question] });
  });

  const orderedUnits = shuffleQuestions
    ? shuffle(orderedBySource)
    : orderedBySource;
  const selectedUnits = [];
  let total = 0;
  for (const unit of orderedUnits) {
    // Include complete situations even when that makes the final session slightly exceed count.
    if (selectedUnits.length && total >= count) break;
    selectedUnits.push({
      ...unit,
      questions:
        unit.kind === "situation" && shuffleWithinSituation
          ? shuffle(unit.questions)
          : unit.questions,
    });
    total += unit.questions.length;
  }
  return selectedUnits;
}
