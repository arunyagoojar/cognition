import React from 'react';

/**
 * Reading question group (contract v2).
 *
 * The answer control is fixed by the data, never inferred here:
 *   tfng / ynng     → three-way segmented control
 *   single_select   → radio cards (A–D with full option text)
 *   multi_select    → checkbox cards, limited to the group's selectCount
 *   pool_select     → the shared list is shown once; each question picks from it
 *                     (letter buttons for short lists, a native picker otherwise)
 *   text            → a text field placed exactly where the blank is
 * Every question number renders once, as the badge attached to its control.
 */

const JUDGEMENTS = {
  tfng: [['TRUE', 'True'], ['FALSE', 'False'], ['NOT GIVEN', 'Not Given']],
  ynng: [['YES', 'Yes'], ['NO', 'No'], ['NOT GIVEN', 'Not Given']],
};

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';

function Badge({ n, answered }) {
  return <span className={`rd-badge${answered ? ' is-answered' : ''}`} aria-hidden="true">{n}</span>;
}

function TextBlank({ q, value, onAnswer, inline = true }) {
  return (
    <span className={inline ? 'rd-blank' : 'rd-blank rd-blank-block'}>
      <Badge n={q.questionNumber} answered={filled(value)} />
      <input
        type="text"
        className="rd-input"
        value={value || ''}
        onChange={(e) => onAnswer(q.id, e.target.value)}
        aria-label={`Question ${q.questionNumber}`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </span>
  );
}

function PoolPicker({ q, options, value, onAnswer, inline = false, placeholder = 'Choose an answer…' }) {
  return (
    <span className={inline ? 'rd-blank' : 'rd-picker'}>
      {inline && <Badge n={q.questionNumber} answered={filled(value)} />}
      <select
        className="rd-select"
        value={value || ''}
        onChange={(e) => onAnswer(q.id, e.target.value)}
        aria-label={`Question ${q.questionNumber}`}
      >
        <option value="">{inline ? 'Choose…' : placeholder}</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>
            {o.id === o.label ? o.label : `${o.id}  ${o.label}`}
          </option>
        ))}
      </select>
    </span>
  );
}

function LetterButtons({ q, options, value, onAnswer }) {
  return (
    <div className="rd-letters" role="radiogroup" aria-label={`Question ${q.questionNumber}`}>
      {options.map(o => (
        <label key={o.id} className={`rd-letter${value === o.id ? ' is-selected' : ''}`} title={o.label}>
          <input type="radio" name={q.id} value={o.id} checked={value === o.id}
            onChange={() => onAnswer(q.id, o.id)} />
          <span>{o.id}</span>
        </label>
      ))}
    </div>
  );
}

function Segments({ segments, renderBlank }) {
  return (segments || []).map((s, i) => (typeof s === 'string'
    ? <React.Fragment key={i}>{s}</React.Fragment>
    : <React.Fragment key={i}>{' '}{renderBlank(s.blank)}{' '}</React.Fragment>));
}

function Stimulus({ group, byNumber, answers, onAnswer }) {
  const { stimulus, answerControl } = group;
  const pool = group.optionPool?.options || [];
  const renderBlank = (n) => {
    const q = byNumber.get(n);
    if (!q) return <span className="rd-gap">({n})</span>;
    return answerControl === 'pool_select'
      ? <PoolPicker q={q} options={pool} value={answers[q.id]} onAnswer={onAnswer} inline />
      : <TextBlank q={q} value={answers[q.id]} onAnswer={onAnswer} />;
  };
  return (
    <div className="rd-stimulus">
      {stimulus.title && <p className="rd-stim-title">{stimulus.title}</p>}
      {stimulus.blocks.map((b, i) => {
        if (b.type === 'heading') return <p key={i} className="rd-stim-heading">{b.text}</p>;
        if (b.type === 'image') {
          return (
            <figure key={i} className="rd-figure">
              <img src={b.src} alt={`Diagram for questions ${group.startQ}–${group.endQ}`} loading="lazy" />
            </figure>
          );
        }
        if (b.type === 'table') {
          return (
            <div key={i} className="rd-table-wrap">
              <table className="rd-table">
                <tbody>
                  {b.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c}><Segments segments={cell} renderBlank={renderBlank} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={i} className="rd-stim-line"><Segments segments={b.segments} renderBlank={renderBlank} /></p>;
      })}
    </div>
  );
}

/** A stem that ends in a gap ("…concludes that natural flavours") shows the gap, not a field. */
function Prompt({ q }) {
  return (
    <span className="rd-prompt">
      <Segments segments={q.prompt} renderBlank={() => <span className="rd-gap-mark" aria-label="blank">…</span>} />
    </span>
  );
}

function QuestionRow({ group, q, answers, onAnswer }) {
  const value = answers[q.id];
  const pool = group.optionPool?.options || [];
  const control = group.answerControl;

  if (control === 'tfng' || control === 'ynng') {
    return (
      <div className="rd-q">
        <div className="rd-q-stem"><Badge n={q.questionNumber} answered={filled(value)} /><Prompt q={q} /></div>
        <div className="rd-segmented" role="radiogroup" aria-label={`Question ${q.questionNumber}`}>
          {JUDGEMENTS[control].map(([val, label]) => (
            <label key={val} className={`rd-segment${value === val ? ' is-selected' : ''}`}>
              <input type="radio" name={q.id} value={val} checked={value === val} onChange={() => onAnswer(q.id, val)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (control === 'single_choice') {
    return (
      <div className="rd-q">
        <div className="rd-q-stem"><Badge n={q.questionNumber} answered={filled(value)} /><Prompt q={q} /></div>
        <div className="rd-choices" role="radiogroup" aria-label={`Question ${q.questionNumber}`}>
          {(q.options || []).map(o => (
            <label key={o.id} className={`rd-choice${value === o.id ? ' is-selected' : ''}`}>
              <input type="radio" name={q.id} value={o.id} checked={value === o.id} onChange={() => onAnswer(q.id, o.id)} />
              <span className="rd-choice-key">{o.id}</span>
              <span className="rd-choice-text">{o.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (control === 'pool_select') {
    // a sentence with a gap completed from a word bank: the picker sits in the gap
    if ((q.prompt || []).some(s => typeof s !== 'string')) {
      return (
        <div className="rd-q">
          <p className="rd-sentence">
            <Segments segments={q.prompt}
              renderBlank={() => <PoolPicker q={q} options={pool} value={value} onAnswer={onAnswer} inline />} />
          </p>
        </div>
      );
    }
    // short letter lists (paragraphs A–G, people A–E) → tappable letters;
    // long or textual lists (headings i–x) → a native picker showing the text
    const compact = group.groupType !== 'matching_headings' && pool.length <= 8 && pool.every(o => o.id.length <= 2);
    return (
      <div className="rd-q rd-q-inline">
        <div className="rd-q-stem"><Badge n={q.questionNumber} answered={filled(value)} /><Prompt q={q} /></div>
        {compact
          ? <LetterButtons q={q} options={pool} value={value} onAnswer={onAnswer} />
          : <PoolPicker q={q} options={pool} value={value} onAnswer={onAnswer}
            placeholder={group.groupType === 'matching_headings' ? 'Choose a heading…' : 'Choose an answer…'} />}
      </div>
    );
  }

  // text: the blank sits inside the sentence when the source marks one
  const hasBlank = (q.prompt || []).some(s => typeof s !== 'string');
  if (hasBlank) {
    return (
      <div className="rd-q">
        <p className="rd-sentence">
          <Segments segments={q.prompt} renderBlank={() => <TextBlank q={q} value={value} onAnswer={onAnswer} />} />
        </p>
      </div>
    );
  }
  return (
    <div className="rd-q">
      {q.labelInFigure
        ? <div className="rd-q-stem"><TextBlank q={q} value={value} onAnswer={onAnswer} inline={false} /></div>
        : (
          <>
            <div className="rd-q-stem"><Badge n={q.questionNumber} answered={filled(value)} /><Prompt q={q} /></div>
            <input
              type="text"
              className="rd-input rd-input-wide"
              value={value || ''}
              onChange={(e) => onAnswer(q.id, e.target.value)}
              aria-label={`Answer to question ${q.questionNumber}`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </>
        )}
    </div>
  );
}

export function MultiChoice({ group, answers, onAnswer, prompt }) {
  const slots = group.questions;
  const max = group.selectCount || slots.length;
  const chosen = slots.map(q => answers[q.id]).filter(filled);
  const toggle = (id) => {
    const set = new Set(chosen);
    if (set.has(id)) set.delete(id);
    else if (set.size < max) set.add(id);
    else return;
    const sorted = [...set].sort();
    slots.forEach((q, i) => onAnswer(q.id, sorted[i] || ''));
  };
  const stem = prompt ?? slots[0]?.questionText;
  return (
    <div className="rd-q">
      <div className="rd-q-stem">
        <span className={`rd-badge rd-badge-range${chosen.length === max ? ' is-answered' : ''}`} aria-hidden="true">
          {group.startQ}–{group.endQ}
        </span>
        {stem && <span className="rd-prompt">{stem}</span>}
      </div>
      <p className="rd-multi-count" aria-live="polite">
        Choose {max} · {chosen.length} selected
      </p>
      <div className="rd-choices" role="group" aria-label={`Questions ${group.startQ} to ${group.endQ}: choose ${max}`}>
        {(group.optionPool?.options || []).map(o => {
          const on = chosen.includes(o.id);
          const locked = !on && chosen.length >= max;
          return (
            <label key={o.id} className={`rd-choice${on ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`}>
              <input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(o.id)} />
              <span className="rd-choice-key">{o.id}</span>
              <span className="rd-choice-text">{o.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function ReadingQuestionGroup({ group, answers, onAnswer }) {
  const byNumber = React.useMemo(() => new Map(group.questions.map(q => [q.questionNumber, q])), [group]);
  const control = group.answerControl;
  const pool = group.optionPool?.options || [];
  const range = group.startQ === group.endQ ? `Question ${group.startQ}` : `Questions ${group.startQ}–${group.endQ}`;
  const showPoolList = pool.length > 0 && control === 'pool_select' && group.groupType !== 'matching_information';
  const standalone = group.questions.filter(q => !q.blankInStimulus);

  return (
    <section className="rd-group" aria-label={range}>
      <header className="rd-group-head">
        <h3 className="rd-group-range">{range}</h3>
        {group.instructions && <p className="rd-group-instr">{group.instructions}</p>}
        {group.wordLimit && <span className="rd-limit">{group.wordLimit}</span>}
        {(group.notes || []).map((n, i) => <p key={i} className="rd-group-note">{n}</p>)}
      </header>

      {showPoolList && (
        <div className="rd-pool">
          {group.optionPool.title && <p className="rd-pool-title">{group.optionPool.title}</p>}
          <ul>
            {pool.filter(o => o.id !== o.label).map(o => (
              <li key={o.id}><span className="rd-pool-key">{o.id}</span><span>{o.label}</span></li>
            ))}
          </ul>
          {pool.every(o => o.id === o.label) && (
            <p className="rd-pool-words">{pool.map(o => o.label).join(' · ')}</p>
          )}
        </div>
      )}

      {group.stimulus && <Stimulus group={group} byNumber={byNumber} answers={answers} onAnswer={onAnswer} />}

      {control === 'multi_choice'
        ? <MultiChoice group={group} answers={answers} onAnswer={onAnswer} />
        : standalone.map(q => <QuestionRow key={q.id} group={group} q={q} answers={answers} onAnswer={onAnswer} />)}
    </section>
  );
}
