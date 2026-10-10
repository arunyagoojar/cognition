/**
 * Jump the window to the very top, instantly.
 *
 * A CSS `scroll-behavior: smooth` anywhere up the tree would turn a plain
 * scrollTo into an animated scroll that is still running while React swaps
 * the screen underneath it, leaving the new screen part-way down. Forcing
 * `auto` for this one call avoids that without relying on the
 * `behavior: 'instant'` enum value (not understood by every engine).
 */
export function resetWindowScroll() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const prev = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  root.style.scrollBehavior = prev;
}
