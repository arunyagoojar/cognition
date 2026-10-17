import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../../hooks/useDialog.js';
import { resolvePracticeResource } from '../../utils/practiceResources.js';
import Icon from './Icon.jsx';
import TipCard from './TipCard.jsx';
import VocabCard from './VocabCard.jsx';
import './PracticeResourceOverlay.css';

/**
 * A resource preview that preserves the current practice/dashboard context.
 * Only the explicit lesson Play action calls onPlayLesson(lessonId).
 */
export default function PracticeResourceOverlay({ resource, onClose, onPlayLesson }) {
  const titleId = useId();
  const descriptionId = useId();
  const ref = useDialog(Boolean(resource), onClose);
  if (!resource || typeof document === 'undefined') return null;
  const selected = resolvePracticeResource(resource);
  const isLesson = selected?.kind === 'lesson';
  const title = selected ? (isLesson ? 'Play this lesson?' : selected.title) : 'Resource unavailable';

  return createPortal(
    <div className="practice-resource-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={isLesson || !selected ? descriptionId : undefined}
        tabIndex={-1} className={`practice-resource-dialog${isLesson ? ' is-lesson' : ''}`}>
        <header className="practice-resource-header">
          <div>
            {selected && <span className="practice-resource-kicker">{isLesson ? selected.lesson.skill : selected.skill.name} · {isLesson ? 'Lesson' : 'Strategy'}</span>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="practice-resource-close" aria-label="Close preview" onClick={onClose}><Icon name="x" size={20}/></button>
        </header>

        <div className="practice-resource-body">
          {!selected ? <p id={descriptionId}>This saved resource is no longer available. You can close this preview and keep practising.</p> : isLesson ? <>
            <div className="practice-resource-lesson-meta"><span className="practice-resource-play-icon" aria-hidden="true"><Icon name="play" size={20}/></span><span>{selected.lesson.duration} · Lesson {selected.lesson.lessonNumber}</span></div>
            <h3 className="practice-resource-lesson-title">{selected.lesson.title}</h3>
            <p id={descriptionId}>{selected.lesson.description}</p>
            {selected.lesson.takeaways?.length > 0 && <ul className="practice-resource-takeaways">{selected.lesson.takeaways.slice(0,3).map(item => <li key={item}>{item}</li>)}</ul>}
          </> : <>
            {selected.category.blurb && <p className="practice-resource-intro">{selected.category.blurb}</p>}
            <div className="practice-resource-tips">{selected.tips.map(tip => selected.category.kind === 'vocab'
              ? <VocabCard key={tip.id} tip={tip} accent={selected.skill.accent}/>
              : <TipCard key={tip.id} tip={tip} accent={selected.skill.accent}/>)}</div>
          </>}
        </div>

        <footer className="practice-resource-footer">
          <button type="button" className="practice-resource-secondary" onClick={onClose}>{isLesson ? 'Stay here' : 'Close'}</button>
          {isLesson && onPlayLesson && <button type="button" className="practice-resource-primary" onClick={() => onPlayLesson(selected.lesson.id)}><Icon name="play" size={14}/>Play this lesson</button>}
        </footer>
      </section>
    </div>, document.body);
}
