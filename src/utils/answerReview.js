import { alignUnorderedAnswers, isCandidateAnswerCorrect } from './evaluation/evaluationEngine.js';

// Saved item verdicts remain authoritative. Older results that retained the
// answer sheet can still be reviewed against the original deterministic key.
export function buildAnswerReviewItems(result, test, skill) {
  const sections = skill === 'reading' ? test?.passages : test?.parts || test?.sections;
  const questions = (sections || []).flatMap((section, index) => (section.questions || []).map(question => {
    const group = (section.questionGroups || []).find(group => group.groupId === question.groupId && question.groupId
      || group.questions?.some(item => item.id === question.id));
    return {
      ...question,
      options: question.options || group?.optionPool?.options || group?.options,
      part: section.passageNumber || section.part || section.partNumber || index + 1,
    };
  }));
  const byId = Object.fromEntries(questions.map(question => [question.id, question]));
  const savedItems = result?.itemResults || {};
  const hasSavedItems = Object.keys(savedItems).length > 0;
  const hasAnswers = result?.answers && typeof result.answers === 'object';
  if (!hasSavedItems && !hasAnswers) return {};
  const answers = alignUnorderedAnswers(questions, result.answers || {});
  const ids = hasSavedItems ? Object.keys(savedItems) : questions.map(question => question.id);

  return Object.fromEntries(ids.map(id => {
    const question = byId[id];
    const saved = savedItems[id];
    const candidate = answers[id] ?? null;
    const correct = !saved && question && isCandidateAnswerCorrect(candidate, question.acceptedAnswers?.length ? question.acceptedAnswers : question.answer, {
      wordLimit: question.wordLimit || question.instruction || question.groupInstruction,
    });
    return [id, {
      ...(saved || {
        candidateAnswer: candidate,
        officialAnswer: question?.answer,
        deterministicCorrect: Boolean(correct),
        finalResult: correct ? 'CORRECT' : 'INCORRECT',
      }),
      candidateAnswer: saved?.candidateAnswer ?? candidate,
      officialAnswer: saved?.officialAnswer ?? question?.answer,
      questionNumber: saved?.questionNumber ?? question?.questionNumber,
      questionText: question?.questionText || question?.context || '',
      answerLabels: Object.fromEntries((question?.options || []).filter(option => option && typeof option === 'object' && option.id)
        .map(option => [option.id, option.label || option.text || ''])),
      part: saved?.part ?? question?.part,
      partLabel: skill === 'reading' ? 'Passage' : 'Part',
    }];
  }));
}
