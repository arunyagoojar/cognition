import { useEffect, useRef } from 'react';
export function useDialog(open, onClose) {
  const ref = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previous = document.activeElement;
    const hidden = [];
    let branch = dialog;
    while (branch.parentElement && branch.parentElement !== document.body) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) { hidden.push([sibling, sibling.inert]); sibling.inert = true; }
      }
      branch = branch.parentElement;
    }
    const focusables = () => [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
    (focusables()[0] || dialog).focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const all = focusables(), first = all[0], last = all.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    dialog.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { dialog.removeEventListener('keydown', onKey); for (const [el, inert] of hidden) el.inert = inert; document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return ref;
}
