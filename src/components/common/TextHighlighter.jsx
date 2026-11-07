import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { readDraft, writeDraft } from '../../utils/drafts.js';
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
export default function TextHighlighter({ storageKey, children, ...props }) {
  const root = useRef(null);
  const name = `exam-highlight-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const draftKey = `${storageKey}:highlights`;
  const [saved, setSaved] = useState(() => ({ key: draftKey, data: readDraft(draftKey) }));
  const data = saved.key === draftKey ? saved.data : readDraft(draftKey);
  const supported = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
  const update = useCallback(next => {
    setSaved({ key: draftKey, data: next });
    writeDraft(draftKey, next);
  }, [draftKey]);

  // React can replace text nodes when answers or passages change; rebuild ranges.
  useLayoutEffect(() => {
    if (!supported || !root.current) return;
    const nodes = textNodes(root.current);
    const text = nodes.map(node => node.data).join('');
    const ranges = [];
    if (data?.text === text && Array.isArray(data.ranges)) {
      let offset = 0;
      for (const node of nodes) {
        for (const [start, end] of data.ranges) {
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
    let timer, dragging = false;
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
      const previous = data?.text === text && Array.isArray(data.ranges) ? data.ranges : [];
      const merged = [];
      for (const [start, end] of [...previous, ...additions].sort((a, b) => a[0] - b[0])) {
        const last = merged.at(-1);
        if (last && start <= last[1]) last[1] = Math.max(last[1], end);
        else merged.push([start, end]);
      }
      if (JSON.stringify(previous) !== JSON.stringify(merged)) update({ text, ranges: merged });
    };
    const schedule = () => { clearTimeout(timer); if (!dragging) timer = setTimeout(capture, 250); };
    const down = () => { dragging = true; clearTimeout(timer); };
    const up = () => { dragging = false; schedule(); };
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', schedule);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }, [data, draftKey, supported, update]);

  return <>
    {supported && <div className="exam-highlight-tools">
      <span>Select text to highlight</span>
      <button type="button" disabled={!data?.ranges?.length} onClick={() => {
        window.getSelection()?.removeAllRanges();
        update(null);
      }}>Clear highlights</button>
    </div>}
    {supported && <style>{`::highlight(${name}) { background-color: #ffe066; color: #151313; }`}</style>}
    <div {...props} ref={root} data-text-highlighter="">{children}</div>
  </>;
}
