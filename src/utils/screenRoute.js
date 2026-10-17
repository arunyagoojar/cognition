const VIEWS = new Set(['home','performance','learning','tips','harper-writing','listening','reading','writing','speaking','mock','drill']);
export function readScreenRoute() {
  if (typeof window === 'undefined') return {};
  const [path, query] = window.location.hash.replace(/^#\/?/, '').split('?');
  return VIEWS.has(path) ? { view: path, testId: new URLSearchParams(query).get('test') } : {};
}
export function writeScreenRoute(view, testId, replace = false) {
  const hash = `#/${view}${testId ? `?test=${encodeURIComponent(testId)}` : ''}`;
  if (window.location.hash !== hash) window.history[replace ? 'replaceState' : 'pushState']({}, '', hash);
}
