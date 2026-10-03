import React from 'react';
import Icon from './Icon';

// ─── Tip demo renderers ──────────────────────────────────────────────────────
// Small typed blocks. Labels always carry meaning (never color alone).

function BeforeAfterDemo({ demo }) {
  return (
    <div className="tip-demo tip-demo-ba">
      <div className="tip-demo-row">
        <span className="tip-demo-label">{demo.beforeLabel || 'Before'}</span>
        <span className="tip-demo-text is-before">{demo.before}</span>
      </div>
      <div className="tip-demo-arrow" aria-hidden="true"><Icon name="arrowRight" size={13} /></div>
      <div className="tip-demo-row">
        <span className="tip-demo-label is-accent">{demo.afterLabel || 'After'}</span>
        <span className="tip-demo-text is-after">{demo.after}</span>
      </div>
      {demo.note && <div className="tip-demo-note">{demo.note}</div>}
    </div>
  );
}

function QaDemo({ demo }) {
  return (
    <div className="tip-demo tip-demo-qa">
      <div className="tip-demo-question">
        <Icon name="user" size={13} />
        <span>{demo.question}</span>
      </div>
      <div className="tip-demo-row">
        <span className="tip-demo-label">{demo.weakLabel || 'Too short'}</span>
        <span className="tip-demo-text is-before">{demo.weak}</span>
      </div>
      <div className="tip-demo-row">
        <span className="tip-demo-label is-accent">{demo.betterLabel || 'Better'}</span>
        <span className="tip-demo-text is-after">{demo.better}</span>
      </div>
      {demo.note && <div className="tip-demo-note">{demo.note}</div>}
    </div>
  );
}

function FlowDemo({ demo }) {
  return (
    <ol className="tip-demo tip-demo-flow">
      {demo.steps.map((step, i) => (
        <li key={step.label} className="tip-flow-step">
          <span className="tip-flow-num" aria-hidden="true">{i + 1}</span>
          <span className="tip-flow-body">
            <span className="tip-flow-label">{step.label}</span>
            <span className="tip-flow-text">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function LinesDemo({ demo }) {
  return (
    <div className="tip-demo tip-demo-lines">
      {demo.rows.map(row => (
        <div key={row.label} className="tip-lines-row">
          <span className="tip-lines-label">{row.label}</span>
          <span className="tip-lines-text">{row.text}</span>
        </div>
      ))}
    </div>
  );
}

const DEMO_RENDERERS = {
  beforeAfter: BeforeAfterDemo,
  qa: QaDemo,
  flow: FlowDemo,
  lines: LinesDemo,
};

// ─── Tip card ────────────────────────────────────────────────────────────────

export default function TipCard({ tip, accent }) {
  return (
    <article className="tip-card" style={{ '--tip-accent': accent }} aria-labelledby={`tip-${tip.id}`}>
      <h4 id={`tip-${tip.id}`} className="tip-card-title">{tip.title}</h4>
      {tip.short && <p className="tip-card-short">{tip.short}</p>}
      {tip.explanation && <p className="tip-card-explanation">{tip.explanation}</p>}

      {tip.demos?.map((demo, i) => {
        const Renderer = DEMO_RENDERERS[demo.type];
        return Renderer ? <Renderer key={i} demo={demo} /> : null;
      })}

      {tip.takeaway && (
        <div className="tip-card-takeaway">
          <Icon name="zap" size={13} />
          <span>{tip.takeaway}</span>
        </div>
      )}
    </article>
  );
}
