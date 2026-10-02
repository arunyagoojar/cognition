import React from 'react';
import { resolveMediaUrl } from '../../utils/media.js';

export default function HtmlContentRenderer({ htmlContent, answers, setAnswers }) {
  if (!htmlContent) return null;

  // We only parse once or when htmlContent changes
  const doc = React.useMemo(() => {
    if (typeof window === 'undefined') return null;
    const parser = new DOMParser();
    return parser.parseFromString(htmlContent, 'text/html');
  }, [htmlContent]);

  if (!doc) return null;

  let inputIndex = 1;

  const renderNode = (node, index) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // Handle inputs
      if (tagName === 'input') {
        const type = node.getAttribute('type');
        if (type === 'hidden') return null; // skip hidden

        // Production content wires stimulus inputs to question ids via data-qid;
        // fall back to positional ids for legacy content.
        const qId = node.getAttribute('data-qid') || `q${inputIndex++}`;
        const val = answers[qId] || '';
        
        if (type === 'radio' || type === 'checkbox') {
          return (
            <input
              key={index}
              type={type}
              name={node.getAttribute('name')}
              value={node.getAttribute('value')}
              checked={val === node.getAttribute('value')}
              onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: e.target.value }))}
              style={{ accentColor: 'var(--c-yellow)', width: 16, height: 16 }}
            />
          );
        }

        return (
          <span key={index} className="inline-blank">
            <input
              type="text"
              data-qid={qId}
              value={val}
              onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: e.target.value }))}
              className="cognition-exam-input"
              style={{ display: 'inline-block', width: '150px', margin: '0 4px' }}
            />
            {qId && /^q\d+$/.test(qId) && (
              <b className="blank-num">{qId.replace('q', '')}</b>
            )}
          </span>
        );
      }

      // Handle selects
      if (tagName === 'select') {
        const qId = `q${inputIndex++}`;
        const val = answers[qId] || '';
        
        return (
          <select
            key={index}
            value={val}
            onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: e.target.value }))}
            className="cognition-exam-input"
            style={{ display: 'inline-block', margin: '0 4px', padding: '8px' }}
          >
            <option value=""></option>
            {Array.from(node.children).map((opt, i) => (
              <option key={i} value={opt.getAttribute('value') || opt.textContent}>
                {opt.textContent}
              </option>
            ))}
          </select>
        );
      }

      // Handle standard elements
      const props = { key: index };
      
      // Map basic attributes
      if (node.id) props.id = node.id;
      if (node.className) props.className = node.className;
      if (node.getAttribute('src')) {
        props.src = resolveMediaUrl(node.getAttribute('src').replace(/^(\.\.\/)+wp-content/, '/wp-content'));
      }
      if (node.getAttribute('href')) {
        props.href = node.getAttribute('href').replace(/^(\.\.\/)+wp-content/, '/wp-content');
      }
      if (node.getAttribute('colSpan')) props.colSpan = node.getAttribute('colSpan');
      if (node.getAttribute('rowSpan')) props.rowSpan = node.getAttribute('rowSpan');

      // Recursively render children
      const children = Array.from(node.childNodes).map((child, i) => renderNode(child, i));
      
      if (tagName === 'audio' || tagName === 'script' || tagName === 'style') {
        return null; // We handle audio separately, strip scripts/styles
      }

      // React complains about rendering certain tags without proper mapping, so we safely create elements
      return React.createElement(tagName, props, children.length > 0 ? children : null);
    }
    
    return null;
  };

  return (
    <div className="cognition-html-content">
      {Array.from(doc.body.childNodes).map((node, i) => renderNode(node, i))}
    </div>
  );
}
