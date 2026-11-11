import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.jsx';
import { readDraft, writeDraft } from '../../utils/drafts.js';
import { addTextHighlights, changeTextHighlights, highlightAnchors, removeTextHighlight, resolveTextHighlights, undoTextHighlights, redoTextHighlights } from '../../utils/textHighlights.js';
import './textHighlighter.css';

const excluded = 'input, textarea, select, button, audio, script, style, [contenteditable], [aria-hidden="true"]';

function textNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.parentElement?.closest(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

// Paint browser ranges rather than inserting marks into React's question/input DOM.
export default function TextHighlighter({ storageKey, controlsTarget, children, ...props }) {
  const root = useRef(null);
  const name = `exam-highlight-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const draftKey = `${storageKey}:highlights`;
  const [saved, setSaved] = useState(() => ({ key: draftKey, data: readDraft(draftKey) }));
  const data = saved.key === draftKey ? saved.data : readDraft(draftKey);
  const latestData = useRef(data);
  useLayoutEffect(() => { latestData.current = data; }, [data]);
  const [menu, setMenu] = useState(null);
  const trigger = useRef(null), panel = useRef(null);
  const menuId = `${name}-tools`;
  const supported = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
  const update = useCallback(next => {
    latestData.current = next;
    setSaved({ key: draftKey, data: next });
    writeDraft(draftKey, next);
  }, [draftKey]);
  const commit = useCallback(next => {
    const changed = changeTextHighlights(latestData.current, next);
    if (changed !== latestData.current) update(changed);
  }, [update]);
  const closeMenu = () => { setMenu(null); trigger.current?.focus({ preventScroll: true }); };
  const openMenu = selected => {
    const rect = trigger.current?.getBoundingClientRect();
    setMenu({ selected, left: Math.max(12, Math.min(window.innerWidth - 316, (rect?.right || 328) - 304)), top: Math.max(12, Math.min(window.innerHeight - 200, (rect?.bottom || 60) + 8)) });
  };
  useEffect(() => {
    if (!menu) return;
    panel.current?.querySelector('button')?.focus({ preventScroll: true });
    const dismiss = event => {
      if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setMenu(null);
    };
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); setMenu(null); trigger.current?.focus({ preventScroll: true }); } };
    const moved = () => setMenu(null);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', moved);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); window.removeEventListener('scroll', moved, true); window.removeEventListener('resize', moved); };
  }, [menu]);

  useEffect(() => {
    if (!supported) return;
    const shortcut = event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z') return;
      if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
      const current = latestData.current;
      const next = event.shiftKey ? redoTextHighlights(current) : undoTextHighlights(current);
      if (next === current) return;
      event.preventDefault();
      update(next);
      setMenu(null);
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [supported, update]);

  // React can replace text nodes when answers or passages change; rebuild ranges.
  useLayoutEffect(() => {
    if (!supported || !root.current) return;
    const nodes = textNodes(root.current);
    const text = nodes.map(node => node.data).join('');
    const ranges = [];
    const resolved = resolveTextHighlights(data, text).ranges;
    if (resolved.length) {
      let offset = 0;
      let firstRange = 0;
      for (const node of nodes) {
        while (firstRange < resolved.length && resolved[firstRange][1] <= offset) firstRange++;
        for (let i = firstRange; i < resolved.length && resolved[i][0] < offset + node.length; i++) {
          const [start, end] = resolved[i];
          const from = Math.max(0, start - offset), to = Math.min(node.length, end - offset);
          if (from < to) {
            const range = document.createRange();
            range.setStart(node, from);
            range.setEnd(node, to);
            ranges.push(range);
          }
        }
        offset += node.length;
      }
    }
    CSS.highlights.set(name, new Highlight(...ranges));
    return () => CSS.highlights.delete(name);
  });

  useEffect(() => {
    if (!supported) return;
    let timer, dragging = false, keyboard = false, touch = false;
    const capture = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed || !selection.toString().trim()) return;
      const range = selection.getRangeAt(0);
      const container = root.current;
      if (!container?.contains(range.startContainer) || !container.contains(range.endContainer)) return;
      const elementFor = node => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (elementFor(range.startContainer)?.closest(excluded) || elementFor(range.endContainer)?.closest(excluded)) return;
      const nodes = textNodes(container);
      const text = nodes.map(node => node.data).join('');
      let offset = 0;
      const additions = [];
      for (const node of nodes) {
        if (range.intersectsNode(node)) {
          const start = range.startContainer === node ? range.startOffset : 0;
          const end = range.endContainer === node ? range.endOffset : node.length;
          if (start < end) additions.push([offset + start, offset + end]);
        }
        offset += node.length;
      }
      if (!additions.length) return;
      const next = addTextHighlights(latestData.current, text, additions);
      commit(next);
      // Mouse selections finish on release. Keep keyboard/touch selections live
      // so Shift+Arrow and native touch selection handles can continue extending.
      if (!keyboard && !touch) selection.removeAllRanges();
    };
    const schedule = () => { clearTimeout(timer); if (!dragging) timer = setTimeout(capture, 80); };
    const down = event => { dragging = true; keyboard = false; touch = event.pointerType === 'touch'; clearTimeout(timer); };
    const up = () => { dragging = false; schedule(); };
    const key = () => { keyboard = true; };
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    document.addEventListener('keydown', key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', schedule);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('keydown', key);
    };
  }, [draftKey, supported, commit]);

  const selectHighlight = event => {
    if (event.target.closest(excluded) || !window.getSelection()?.isCollapsed) return;
    const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const fallback = !point && document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const node = point?.offsetNode || fallback?.startContainer;
    const localOffset = point?.offset ?? fallback?.startOffset;
    if (!node || !root.current?.contains(node)) return;
    const nodes = textNodes(root.current), text = nodes.map(n => n.data).join('');
    let offset = 0;
    for (const current of nodes) { if (current === node) { offset += localOffset; break; } offset += current.length; }
    const selected = highlightAnchors(latestData.current).findIndex(anchor => resolveTextHighlights({ anchors: [anchor] }, text).ranges.some(([start, end]) => offset >= start && offset < end));
    if (selected >= 0) setMenu({ selected, left: Math.max(12, Math.min(window.innerWidth - 180, event.clientX - 84)), top: Math.max(12, event.clientY - 68) });
  };

  return <>
    {supported && controlsTarget && createPortal(
      <div className="exam-highlight-toolbar" role="group" aria-label="Highlight tools">
      <button type="button" className="exam-highlight-clear" aria-label="Undo highlight change" title="Undo highlight change (Ctrl/Cmd+Z)" disabled={!data?.undo?.length} onClick={() => update(undoTextHighlights(latestData.current))}><Icon name="arrowLeft" size={18} /></button>
      <button type="button" className="exam-highlight-clear" aria-label="Redo highlight change" title="Redo highlight change (Ctrl/Cmd+Shift+Z)" disabled={!data?.redo?.length} onClick={() => update(redoTextHighlights(latestData.current))}><Icon name="arrowRight" size={18} /></button>
      <button ref={trigger} type="button" className="exam-highlight-clear" aria-label="Highlights"
        aria-haspopup="dialog" aria-expanded={Boolean(menu)} aria-controls={menu ? menuId : undefined}
        data-highlight-count={highlightAnchors(data).length}
        title="Highlights: remove one, undo or clear all. Select text to highlight automatically."
        onClick={() => menu ? closeMenu() : openMenu(null)}><Icon name="eraser" size={18} /></button>
      {menu && <section ref={panel} id={menuId} className={`exam-highlight-menu${Number.isInteger(menu.selected) ? ' is-erase' : ''}`} role="dialog" aria-label="Highlights" style={{ left: menu.left, top: menu.top, maxHeight: Math.min(440, window.innerHeight - menu.top - 12) }}>
        {Number.isInteger(menu.selected) ? <button type="button" aria-label="Remove selected highlight" onClick={() => { commit(removeTextHighlight(latestData.current, menu.selected)); closeMenu(); }}>Erase highlight</button> : <>
        <div className="exam-highlight-menu-heading"><strong>Highlights</strong><button type="button" aria-label="Close highlight tools" onClick={closeMenu}><Icon name="x" /></button></div>
        <p>Select text to highlight. Click a highlight to erase it.</p>
        <div className="exam-highlight-menu-actions">
          <button type="button" disabled={!data?.undo?.length} onClick={() => { update(undoTextHighlights(latestData.current)); closeMenu(); }}>Undo last change</button>
          <button type="button" disabled={!data?.redo?.length} onClick={() => { update(redoTextHighlights(latestData.current)); closeMenu(); }}>Redo last change</button>
          <button type="button" disabled={!highlightAnchors(data).length} onClick={() => { window.getSelection()?.removeAllRanges(); commit(null); closeMenu(); }}>Clear all highlights</button>
        </div>
        {!highlightAnchors(data).length && <p>No highlights on this part.</p>}
        </>}
      </section>}</div>, controlsTarget)}
    {supported && <style>{`::highlight(${name}) { background-color: #ffe066; color: #151313; }`}</style>}
    <div {...props} ref={root} data-text-highlighter="" onClick={selectHighlight}>{children}</div>
  </>;
}
