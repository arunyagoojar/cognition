// Text quote anchors survive unrelated changes (answer counts, hints, etc.).
// Legacy drafts used one page fingerprint; migrate them without losing marks.
export function highlightAnchors(data) {
  if (Array.isArray(data?.anchors)) return data.anchors.filter(a => typeof a?.quote === 'string' && a.quote.length);
  if (typeof data?.text !== 'string' || !Array.isArray(data.ranges)) return [];
  return data.ranges.filter(r => Array.isArray(r) && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] >= 0 && r[1] > r[0] && r[1] <= data.text.length)
    .map(([start, end]) => anchor(data.text, start, end));
}
function anchor(text, start, end) {
  return { start, quote: text.slice(start, end), prefix: text.slice(Math.max(0, start - 32), start), suffix: text.slice(end, end + 32) };
}
export function mergeHighlightRanges(ranges) {
  const merged = [];
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
export function resolveTextHighlights(data, text) {
  const ranges = [], unresolved = [];
  for (const saved of highlightAnchors(data)) {
    const savedEnd = saved.start + saved.quote.length;
    if (Number.isInteger(saved.start) && text.slice(saved.start, savedEnd) === saved.quote
      && text.slice(Math.max(0, saved.start - (saved.prefix || '').length), saved.start) === (saved.prefix || '')
      && text.slice(savedEnd, savedEnd + (saved.suffix || '').length) === (saved.suffix || '')) {
      ranges.push([saved.start, savedEnd]);
      continue;
    }
    const candidates = [];
    for (let start = text.indexOf(saved.quote); start !== -1; start = text.indexOf(saved.quote, start + 1)) {
      const end = start + saved.quote.length;
      const prefix = saved.prefix || '', suffix = saved.suffix || '';
      const score = Number(Boolean(prefix) && text.slice(Math.max(0, start - prefix.length), start) === prefix)
        + Number(Boolean(suffix) && text.slice(end, end + suffix.length) === suffix);
      candidates.push({ start, end, score, distance: Math.abs(start - (saved.start || 0)) });
    }
    candidates.sort((a, b) => b.score - a.score || a.distance - b.distance);
    const best = candidates[0], next = candidates[1];
    if (best && (!next || best.score > next.score || best.distance < next.distance)) ranges.push([best.start, best.end]);
    else unresolved.push(saved); // Keep it saved; never erase other marks on a mismatch.
  }
  return { ranges: mergeHighlightRanges(ranges), unresolved };
}
export function addTextHighlights(data, text, additions) {
  const { ranges, unresolved } = resolveTextHighlights(data, text);
  return { version: 3, anchors: [...mergeHighlightRanges([...ranges, ...additions]).map(([start, end]) => anchor(text, start, end)), ...unresolved] };
}

export function removeTextHighlight(data, index) {
  return { version: 3, anchors: highlightAnchors(data).filter((_, i) => i !== index) };
}

function appendHistory(history, snapshot) {
  const next = [...(Array.isArray(history) ? history : []), snapshot].slice(-20);
  while (next.length > 1 && JSON.stringify(next).length > 512000) next.shift();
  return next;
}

export function changeTextHighlights(data, next) {
  const before = highlightAnchors(data), after = highlightAnchors(next);
  if (JSON.stringify(before) === JSON.stringify(after)) return data;
  const undo = appendHistory(data?.undo, { anchors: before });
  return { version: 3, anchors: after, undo, redo: [] };
}

export function undoTextHighlights(data) {
  const history = Array.isArray(data?.undo) ? data.undo : [];
  if (!history.length) return data;
  return { version: 3, anchors: highlightAnchors(history.at(-1)), undo: history.slice(0, -1), redo: appendHistory(data?.redo, { anchors: highlightAnchors(data) }) };
}

export function redoTextHighlights(data) {
  const history = Array.isArray(data?.redo) ? data.redo : [];
  if (!history.length) return data;
  return { version: 3, anchors: highlightAnchors(history.at(-1)), redo: history.slice(0, -1), undo: appendHistory(data?.undo, { anchors: highlightAnchors(data) }) };
}
