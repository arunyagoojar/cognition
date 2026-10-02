import React from 'react';

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

  const renderInput = () => {
    switch (inputType || 'text') {
      case 'single_select':
      case 'map_select':
        if (options && options.length > 0) {
          // Radio list — the exam convention (visible choices beat dropdowns).
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {options.map(o => (
                <label key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={question.id}
                    value={o.id}
                    checked={value === o.id}
                    onChange={handleChange}
                    style={{ accentColor: 'var(--c-yellow)', width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                  />
                  <span>
                    <strong>{o.id}</strong>
                    {o.label && o.id !== o.label ? ` — ${o.label}` : ''}
                  </span>
                </label>
              ))}
            </div>
          );
        }
        // Fallback to text if options are missing for some reason
        return (
          <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder="Type your answer here..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
          />
        );
      
      case 'multi_select':
        if (options && options.length > 0) {
          const currentVals = Array.isArray(value) ? value : [];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {options.map(o => (
                <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input 
                    type="checkbox"
                    checked={currentVals.includes(o.id)}
                    onChange={() => handleCheckbox(o.id)}
                  />
                  <strong>{o.id}</strong> {o.label}
                </label>
              ))}
            </div>
          );
        }
        return (
          <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder="Multiple answers (comma separated)"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
          />
        );

      case 'text':
      default:
        if (questionType === 'true_false_not_given') {
          return (
            <select
              className="cognition-exam-select"
              value={value || ''}
              onChange={handleChange}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--border)' }}
            >
              <option value="">Select…</option>
              <option value="TRUE">TRUE</option>
              <option value="FALSE">FALSE</option>
              <option value="NOT GIVEN">NOT GIVEN</option>
            </select>
          );
        }
        if (questionType === 'yes_no_not_given') {
          return (
            <select
              className="cognition-exam-select"
              value={value || ''}
              onChange={handleChange}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--border)' }}
            >
              <option value="">Select…</option>
              <option value="YES">YES</option>
              <option value="NO">NO</option>
              <option value="NOT GIVEN">NOT GIVEN</option>
            </select>
          );
        }
        return (
          <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder="Type your answer here..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
          />
        );
    }
  };

  return (
    <div className="exam-doc" style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--border-subtle)',
      marginBottom: '2px'
    }}>
      <div style={{ fontSize: 15.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        <span className="exam-q-num">{questionNumber}.</span>
        {questionText && (
          <span dangerouslySetInnerHTML={{ __html: questionText.replace(/wp-content/g, '/wp-content') }} />
        )}
      </div>
      <div style={{ marginTop: 6 }}>
        {renderInput()}
      </div>
    </div>
  );
}
