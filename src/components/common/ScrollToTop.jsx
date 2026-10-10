import { useLayoutEffect } from 'react';
import { resetWindowScroll } from './resetWindowScroll.js';

/**
 * Render as the first child of a screen (exam workspace, results, …): once
 * that screen has committed to the DOM — before the browser paints it — the
 * window is reset to the top, and again on the next frame in case late layout
 * (fonts, images, trackpad momentum from the previous screen) moved it.
 */
export default function ScrollToTop() {
  useLayoutEffect(() => {
    resetWindowScroll();
    const id = requestAnimationFrame(resetWindowScroll);
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}
