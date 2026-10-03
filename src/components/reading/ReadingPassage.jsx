import React from 'react';

/**
 * Reading passage (contract v2). Renders the structured paragraphs from the
 * production bundle — no HTML parsing. Lettered paragraphs carry their label
 * in the margin so "Which paragraph contains…" questions can be answered at a
 * glance.
 */
export default function ReadingPassage({ passage }) {
  if (!passage) return null;
  return (
    <article className="rd-passage" aria-labelledby={`rd-passage-title-${passage.passageNumber}`}>
      <p className="rd-eyebrow">Reading Passage {passage.passageNumber}</p>
      <h2 className="rd-passage-title" id={`rd-passage-title-${passage.passageNumber}`}>{passage.title}</h2>
      {passage.paragraphs.map((x, i) => {
        if (x.type === 'subheading') {
          return <h3 key={i} className="rd-subheading">{x.text}</h3>;
        }
        if (x.type === 'image') {
          return (
            <figure key={i} className="rd-figure">
              <img src={x.src} alt={`Illustration for Reading Passage ${passage.passageNumber}`} loading="lazy" />
            </figure>
          );
        }
        if (x.type === 'table') {
          return (
            <div key={i} className="rd-table-wrap">
              <table className="rd-table">
                <tbody>
                  {x.rows.map((row, r) => (
                    <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i} className={`rd-para${x.label ? ' has-label' : ''}`}>
            {x.label && <span className="rd-para-label" aria-label={`Paragraph ${x.label}`}>{x.label}</span>}
            {x.text}
          </p>
        );
      })}
    </article>
  );
}
