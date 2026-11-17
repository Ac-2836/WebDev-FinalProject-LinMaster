import {useRef} from 'react';

const DIALOG = '[role="dialog"], [role="alertdialog"]';
/** What Radix puts around an open dialog (focus guards) is not a place to return to. */
const NOT_A_PLACE = `${DIALOG}, [data-radix-focus-guard]`;

/**
 * Two things remembered before any dialog opens, because by then it may be too late to ask `document.activeElement`:
 * - the last "more options" button the user pressed (a dialog opened from its menu returns focus there, the menu
 *   item itself is gone);
 * - the last element that had focus outside a dialog (a field inside the new dialog can take focus first, such as an
 *   input with `autoFocus`, so the element that opened it would be forgotten: "Tạo bộ" in the word bank, Q-18).
 */
let lastMenuTrigger: HTMLElement | null = null;
let lastOutsideFocus: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  const rememberMenu = (event: Event) => {
    const trigger =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[aria-haspopup="menu"]') : null;
    if (trigger) lastMenuTrigger = trigger;
  };
  document.addEventListener('pointerdown', rememberMenu, true);
  document.addEventListener('keydown', rememberMenu, true);
  document.addEventListener(
    'focusin',
    event => {
      if (event.target instanceof HTMLElement && !event.target.closest(NOT_A_PLACE)) lastOutsideFocus = event.target;
    },
    true,
  );
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
      const active = document.activeElement;
      opener.current = usable(active) && !active.closest(DIALOG) ? active : (lastOutsideFocus ?? lastMenuTrigger);
    },
    onCloseAutoFocus: (event: Event) => {
      // Radix skips `onOpenAutoFocus` when something inside the dialog already took focus (an `autoFocus` input), so
      // `opener` can be empty: the last focus outside any dialog is where the dialog was opened from.
      const from = opener.current?.isConnected ? opener.current : lastOutsideFocus;
      opener.current = null;
      const target = from?.isConnected ? from : lastMenuTrigger;
      if (!target?.isConnected) return;
      event.preventDefault();
      // Radix still traps focus in the closing dialog for a moment: focus once it has let go.
      setTimeout(() => target.focus(), 0);
    },
  };
}
