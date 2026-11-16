import {useRef} from 'react';

/**
 * Focus handlers for a Radix dialog opened from state instead of a `Dialog.Trigger`: Radix then has nothing to
 * return focus to and drops it on `<body>` (QA T6). Spread the result on `Dialog.Content`: on open it remembers
 * what had focus (the row or button that opened it), on close it focuses that element again if it is still there.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      if (!opener.current?.isConnected) return;
      event.preventDefault();
      opener.current.focus();
    },
  };
}
