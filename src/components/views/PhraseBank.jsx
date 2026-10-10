import React, { useDeferredValue, useId, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import Icon from '../common/Icon';
import { PHRASE_BANK, filterPhraseBank } from '../../data/tips/phraseBank';

// ─── Speaking: Band 7–9 Phrase Bank explorer ────────────────────────────────
// Rendered inside the Speaking feed of Tips & Tricks, under its own coach
// line. Search + category chips filter the data; nothing needs to be opened
// to be read.

function PhraseCard({ item, reduceMotion }) {
  return (
    <motion.article
      className="pb-card"
      aria-labelledby={item.id}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="pb-card-top">
        <h4 id={item.id} className="pb-card-phrase">{item.phrase}</h4>
        <span className="pb-card-tag">{item.tag}</span>
      </div>
      <p className="pb-card-note">{item.note}</p>
      <p className="pb-card-example">
        <span className="pb-card-example-label">Example</span>
        <span className="pb-card-example-text">“{item.example}”</span>
      </p>
    </motion.article>
  );
}

export default function PhraseBank({ reduceMotion }) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();

  const groups = useMemo(() => filterPhraseBank(deferredQuery, categoryId), [deferredQuery, categoryId]);
  const shown = groups.reduce((n, g) => n + g.phrases.length, 0);
  const filtering = deferredQuery.trim() !== '' || categoryId !== 'all';

  const reset = () => { setQuery(''); setCategoryId('all'); };

  return (
    <div className="pb-explorer tips-thread">
      <div className="pb-toolbar">
        <label className="pb-search" htmlFor={searchId}>
          <span className="pb-search-icon" aria-hidden="true"><Icon name="search" size={17} /></span>
          <span className="sr-only">Search phrases</span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search phrases, e.g. contrast, opinion, honest"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="pb-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="x" size={15} />
            </button>
          )}
        </label>
        <div className="pb-chips" role="group" aria-label="Filter by category">
          <button type="button" aria-pressed={categoryId === 'all'} onClick={() => setCategoryId('all')}>All</button>
          {PHRASE_BANK.categories.map(cat => (
            <button key={cat.id} type="button" aria-pressed={categoryId === cat.id}
              onClick={() => setCategoryId(prev => (prev === cat.id ? 'all' : cat.id))}>
              {cat.chip}
            </button>
          ))}
        </div>
      </div>

      <p className="pb-count" aria-live="polite">
        {filtering ? `${shown} ${shown === 1 ? 'phrase' : 'phrases'} match` : `${shown} phrases in ${groups.length} groups`}
      </p>

      {groups.length === 0 ? (
        <div className="pb-empty">
          <p>No phrases match “{deferredQuery.trim()}”.</p>
          <button type="button" onClick={reset}>Show all phrases</button>
        </div>
      ) : (
        groups.map(group => (
          <section key={group.id} className="pb-group" aria-labelledby={`${group.id}-title`}>
            <header className="pb-group-head">
              <h3 id={`${group.id}-title`} className="pb-group-title">{group.title}</h3>
              <p className="pb-group-intro">{group.intro}</p>
            </header>
            <div className="pb-grid">
              {group.phrases.map(item => <PhraseCard key={item.id} item={item} reduceMotion={reduceMotion} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
