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
          return (
            <select 
              value={value || ''} 
              onChange={handleChange}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
            >
              <option value="">Select an option...</option>
              {options.map(o => (
                <option key={o.id} value={o.id}>{o.id}{o.id !== o.label ? ` - ${o.label}` : ''}</option>
              ))}
            </select>
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
              value={value || ''} 
              onChange={handleChange}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
            >
              <option value="">Select answer...</option>
              <option value="TRUE">TRUE</option>
              <option value="FALSE">FALSE</option>
              <option value="NOT GIVEN">NOT GIVEN</option>
            </select>
          );
        }
        if (questionType === 'yes_no_not_given') {
          return (
            <select 
              value={value || ''} 
              onChange={handleChange}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 8 }}
            >
              <option value="">Select answer...</option>
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
    <div style={{
      padding: '16px',
      background: 'var(--surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      marginBottom: '16px'
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{
          width: 28, height: 28, flexShrink: 0,
          background: 'var(--surface-elevated)', border: '1px solid var(--border)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)'
        }}>
          {questionNumber}
        </div>
        <div style={{ flex: 1 }}>
          {questionText && (
            <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.5 }}>
              <span dangerouslySetInnerHTML={{ __html: questionText.replace(/wp-content/g, '/wp-content') }} />
            </div>
          )}
          {renderInput()}
        </div>
      </div>
    </div>
  );
}
