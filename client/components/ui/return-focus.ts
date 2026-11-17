import {useRef} from 'react';

/** The last "more options" button the user pressed: a dialog opened from its menu returns focus there. */
let lastMenuTrigger: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  const remember = (event: Event) => {
    const trigger =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[aria-haspopup="menu"]') : null;
    if (trigger) lastMenuTrigger = trigger;
  };
  document.addEventListener('pointerdown', remember, true);
  document.addEventListener('keydown', remember, true);
}

const usable = (element: Element | null): element is HTMLElement =>
  element instanceof HTMLElement && element !== document.body && element.isConnected;

/**
 * Focus handlers for a Radix dialog opened from state instead of a `Dialog.Trigger`: Radix then has nothing to
 * return focus to and drops it on `<body>` (QA T6, Q-18). Spread the result on `Dialog.Content`: on open it remembers
 * what had focus (the row or button that opened it), on close it focuses that element again if it is still there.
 * When the dialog was opened from a dropdown menu item (which is gone by then) the button of that menu gets focus.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = usable(document.activeElement) ? document.activeElement : lastMenuTrigger;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = opener.current?.isConnected ? opener.current : lastMenuTrigger;
      if (!target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}
