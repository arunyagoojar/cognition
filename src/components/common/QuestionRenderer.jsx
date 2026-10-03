import React from 'react';
import QuestionNumber, { stripLeadingNumber } from './QuestionNumber';

/**
 * Unified Reading/Listening question renderer (Phase 5).
 *
 * Interaction component is derived from the normalized question record:
 *  - single_select with options → radio option cards (compact pills when all
 *    options are short, full cards when any option carries substantial text)
 *  - multi_select with options → checkbox option cards (multi-select visible)
 *  - tfng / ynng → three visible radio pills (dropdowns are the exception)
 *  - everything else → text input
 * The number badge renders exactly once, here, from the canonical component.
 */
export default function QuestionRenderer({ question, value, onChange }) {
  const { questionNumber, questionType, inputType, questionText, options } = question;

  const handleChange = (e) => {
    onChange(question.id, e.target.value);
  };

  const handleCheckbox = (optId) => {
    let current = Array.isArray(value) ? [...value] : [];
    if (current.includes(optId)) {
      current = current.filter(id => id !== optId);
    } else {
      current.push(optId);
    }
    onChange(question.id, current);
  };

  const stem = stripLeadingNumber(questionText);

  const renderInput = () => {
    switch (inputType || 'text') {
      case 'dropdown':
      case 'single_select':
      case 'map_select': {
        if (options && options.length > 0) {
          if (options.length > 5) {
            return (
              <div style={{ marginTop: 6 }}>
                <select
                  value={value || ''}
                  onChange={handleChange}
                  className="cognition-exam-select"
                  style={{
                    padding: '9px 14px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    width: '100%',
                    maxWidth: 420,
                    cursor: 'pointer'
                  }}
                  aria-label={`Question ${questionNumber}`}
                >
                  <option value="">Select option / heading...</option>
                  {options.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.id}. {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          const long = options.some(o => (o.label || '').length > 28);
          return (
            <div className={long ? 'q-option-list' : 'q-option-chips'} role="radiogroup" aria-label={`Question ${questionNumber}`}>
              {options.map(o => {
                const selected = value === o.id;
                return (
                  <label key={o.id} className={`q-option-card${selected ? ' selected' : ''}${long ? '' : ' compact'}`}>
                    <input
                      type="radio"
                      name={question.id}
                      value={o.id}
                      checked={selected}
                      onChange={handleChange}
                      style={{ accentColor: 'var(--c-coral)', width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                    />
                    <span className="q-option-label">
                      <strong>{o.id}.</strong>
                      {o.label && o.id !== o.label ? ` ${o.label}` : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        }
        // No usable options in the data — typed answer fallback.
        return (
          <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder="Type your answer here..."
            className="cognition-exam-input"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
          />
        );
      }

      case 'multi_select': {
        if (options && options.length > 0) {
          const currentVals = Array.isArray(value) ? value : [];
          return (
            <div className="q-option-list" role="group" aria-label={`Question ${questionNumber} — choose all that apply`}>
              {options.map(o => {
                const selected = currentVals.includes(o.id);
                return (
                  <label key={o.id} className={`q-option-card${selected ? ' selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleCheckbox(o.id)}
                      style={{ accentColor: 'var(--c-coral)', width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                    />
                    <span className="q-option-label">
                      <strong>{o.id}.</strong>
                      {o.label && o.id !== o.label ? ` ${o.label}` : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        }
        return (
          <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder="Multiple answers (comma separated)"
            className="cognition-exam-input"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
          />
        );
      }

      case 'text':
      default: {
        if (questionType === 'true_false_not_given' || questionType === 'yes_no_not_given') {
          const opts = questionType === 'true_false_not_given'
            ? [['TRUE', 'True'], ['FALSE', 'False'], ['NOT GIVEN', 'Not Given']]
            : [['YES', 'Yes'], ['NO', 'No'], ['NOT GIVEN', 'Not Given']];
          return (
            <div className="q-option-chips" role="radiogroup" aria-label={`Question ${questionNumber}`}>
              {opts.map(([val, label]) => {
                const selected = (value || '').toUpperCase() === val;
                return (
                  <label key={val} className={`q-option-card compact${selected ? ' selected' : ''}`}>
                    <input
                      type="radio"
                      name={question.id}
                      value={val}
                      checked={selected}
                      onChange={handleChange}
                      style={{ accentColor: 'var(--c-coral)', width: 16, height: 16, flexShrink: 0 }}
                    />
                    <span className="q-option-label">{label}</span>
                  </label>
                );
              })}
            </div>
          );
        }
        return (
          <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder="Type your answer here..."
            className="cognition-exam-input"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
          />
        );
      }
    }
  };

  return (
    <div className="exam-question-block">
      <div className="exam-question-stem">
        <QuestionNumber n={questionNumber} />
        {stem && <span dangerouslySetInnerHTML={{ __html: stem }} />}
      </div>
      <div className="exam-question-input">
        {renderInput()}
      </div>
    </div>
  );
}
