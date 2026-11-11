import { alignUnorderedAnswers, isCandidateAnswerCorrect } from './evaluation/evaluationEngine.js';

function questionPrompt(question, group) {
  const n = question.questionNumber;
  const segments = values => (values || []).map(value => typeof value === 'string' ? value : `____ (Q${value.blank})`).join('');
  const blocks = group?.stimulus?.blocks || [];
  for (const block of blocks) {
    const rows = block.type === 'table' ? block.rows?.map(row => row.flat()) : [block.segments];
    for (const row of rows || []) if (row?.some(value => value?.blank === n)) return segments(row);
  }
  const sharedPrompt = group?.answerControl === 'multi_choice' || group?.selection
    ? group?.questions?.find(q => q.questionText || q.context || q.prompt?.length) : null;
  return question.questionText || question.context || question.question || segments(question.prompt) || group?.selection?.prompt
    || sharedPrompt?.questionText || sharedPrompt?.context || segments(sharedPrompt?.prompt) || '';
}

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
      reviewPrompt: questionPrompt(question, group),
      instructions: question.instruction || group?.instructions || '',
      part: section.passageNumber || section.part || section.partNumber || index + 1,
    };
  }));
  const byId = Object.fromEntries(questions.map(question => [question.id, question]));
  const savedItems = result?.itemResults || {};
  const hasSavedItems = Object.keys(savedItems).length > 0;
  const hasAnswers = result?.answers && typeof result.answers === 'object';
  if (!hasSavedItems && !hasAnswers) return {};
  const answers = alignUnorderedAnswers(questions, result.answers || {});
  const ids = [...new Set([...questions.map(question => question.id), ...Object.keys(savedItems)])];

  return Object.fromEntries(ids.map(id => {
    const question = byId[id];
    const saved = savedItems[id];
    const keyChanged = saved?.officialAnswer && question?.answer
      && String(saved.officialAnswer).toLowerCase() !== String(question.answer).toLowerCase()
      && !(question.acceptedAnswers || []).some(a => String(a).toLowerCase() === String(saved.officialAnswer).toLowerCase());
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
      officialAnswer: keyChanged ? question.answer : saved?.officialAnswer ?? question?.answer,
      keyCorrection: keyChanged ? `The answer key changed from ${saved.officialAnswer} to ${question.answer} after this attempt. Your recorded score and verdict have not been recalculated.` : null,
      questionNumber: saved?.questionNumber ?? question?.questionNumber,
      questionText: question?.reviewPrompt || saved?.questionText || '',
      instructions: question?.instructions || saved?.instructions || '',
      answerLabels: Object.fromEntries((question?.options || []).filter(option => option && typeof option === 'object' && option.id)
        .map(option => [option.id, option.label || option.text || ''])),
      part: saved?.part ?? question?.part,
      partLabel: skill === 'reading' ? 'Passage' : 'Part',
    }];
  }));
}
