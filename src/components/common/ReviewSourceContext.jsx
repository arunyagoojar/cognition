import React, { useState } from 'react';
import ReadingPassage from '../reading/ReadingPassage.jsx';
import ReadingQuestionGroup, { MultiChoice } from '../reading/ReadingQuestionGroup.jsx';
import HtmlContentRenderer from './HtmlContentRenderer.jsx';
import QuestionRenderer from './QuestionRenderer.jsx';
import SourceIdentity from './SourceIdentity.jsx';
import './reviewSourceContext.css';

const noop = () => {};

// Reuse the exam renderers so blanks, headings, figures and option pools stay
// attached to their original questions, rather than reducing them to answer keys.
export default function ReviewSourceContext({ skill, test, answers }) {
  const [index, setIndex] = useState(0);
  const sections = skill === 'reading' ? test?.passages : test?.parts || test?.sections;
  if (!sections?.length) return <p className="result-list-empty">The original source is unavailable for this saved attempt. Its recorded answers and score are preserved.</p>;
  const section = sections[index] || sections[0];
  const label = skill === 'reading' ? 'Passage' : 'Part';
  return <section className="review-source-context" aria-label="Original test content">
    <SourceIdentity skill={skill} test={test} />
    <h2>Original {skill === 'reading' ? 'passages and questions' : 'listening questions'}</h2>
    <p>Your submitted answers are shown below. This view does not change your score.</p>
    <div className="review-source-tabs" role="group" aria-label={`Review ${skill} sections`}>
      {sections.map((part, i) => <button key={i} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
        {label} {part.passageNumber || part.part || part.partNumber || i + 1}
      </button>)}
    </div>
    {skill === 'listening' && section.audioFile && <audio controls preload="none" src={section.audioFile}>Audio playback is unavailable.</audio>}
    <div className={`review-source-grid ${skill === 'reading' ? 'has-passage' : ''}`}>
      {skill === 'reading' && <ReadingPassage passage={section} />}
      <fieldset disabled className="review-source-questions">
        <legend>{label} {section.passageNumber || section.part || section.partNumber || index + 1} · Original questions and your answers</legend>
        {skill === 'reading' ? (section.questionGroups || []).map(group =>
          <ReadingQuestionGroup key={group.groupId} group={group} answers={answers} onAnswer={noop} />
        ) : (section.questionGroups?.length ? section.questionGroups.map((group, i) => {
          const inlineIds = new Set([...(group.htmlContent || '').matchAll(/data-qid="(q\d+)"/g)].map(m => m[1]));
          return <section className="review-listening-group" key={group.groupId || i}>
            <h3>Questions {group.questions?.[0]?.questionNumber}–{group.questions?.at(-1)?.questionNumber}</h3>
            <p>{group.instructions}</p>
            {group.wordLimit && <p>{group.wordLimit}</p>}
            {group.visualHtml && <div className="exam-visual" dangerouslySetInnerHTML={{ __html: group.visualHtml }} />}
            <HtmlContentRenderer htmlContent={group.htmlContent} answers={answers} setAnswers={noop} />
            {group.selection ? <MultiChoice group={{ questions: group.questions, startQ: group.questions[0]?.questionNumber,
              endQ: group.questions.at(-1)?.questionNumber, selectCount: group.selection.selectCount,
              optionPool: { options: group.selection.options } }} prompt={group.selection.prompt} answers={answers} onAnswer={noop} />
              : (group.questions || []).filter(q => !inlineIds.has(q.id)).map(q =>
                <QuestionRenderer key={q.id} question={q} value={answers[q.id]} onChange={noop} />)}
          </section>;
        }) : (section.questions || []).map(q => <QuestionRenderer key={q.id} question={q} value={answers[q.id]} onChange={noop} />))}
      </fieldset>
    </div>
  </section>;
}
