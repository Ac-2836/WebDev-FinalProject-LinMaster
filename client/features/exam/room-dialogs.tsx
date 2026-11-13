'use client';

import {cn} from 'cn';
import {X} from 'lucide-react';
import {AlertDialog, Dialog} from 'radix-ui';
import {useRef} from 'react';

import {Button} from '@/components/ui/button';

import {COLOUR_SCHEMES, TEXT_SIZES, type RoomSettings} from './room-hooks';
import type {submitSummary} from './room-logic';

const overlay = 'fixed inset-0 z-40 bg-foreground/40';
const panel =
  'fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-2xl';

/** Dialogs opened without a Radix Trigger (from state): on close, focus goes back to whatever opened them. */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement as HTMLElement | null;
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault();
      opener.current?.focus();
    },
  };
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Shell({open, onOpenChange, title, children}: DialogProps & {title: string; children: React.ReactNode}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={panel} aria-describedby={undefined} {...useReturnFocus()}>
          <div className="flex items-center">
            <Dialog.Title className="flex-1 text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const TEXT_SIZE_LABEL: Record<RoomSettings['textSize'], string> = {
  standard: 'Standard',
  large: 'Large',
  xlarge: 'Extra large',
};
const COLOUR_LABEL: Record<RoomSettings['colours'], string> = {
  bw: 'Black on white',
  wb: 'White on black',
  cream: 'Black on cream',
};
/** Colour scheme of the question area; also used by the swatches here. */
export const COLOUR_CLASS: Record<RoomSettings['colours'], string> = {
  bw: 'bg-white text-black',
  wb: 'bg-black text-white',
  cream: 'bg-[#fef9c3] text-black',
};

export function SettingsDialog({
  settings,
  onChange,
  ...props
}: DialogProps & {settings: RoomSettings; onChange: (patch: Partial<RoomSettings>) => void}) {
  return (
    <Shell {...props} title="Settings">
      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold">Text size</legend>
        <div className="grid grid-cols-3 gap-2">
          {TEXT_SIZES.map(size => (
            <button
              key={size}
              type="button"
              aria-pressed={settings.textSize === size}
              className={cn(
                'h-11 rounded-lg border bg-white px-1 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                settings.textSize === size && 'border-2 border-primary bg-secondary',
              )}
              onClick={() => onChange({textSize: size})}
            >
              {TEXT_SIZE_LABEL[size]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold">Colours</legend>
        <div className="grid grid-cols-3 gap-2">
          {COLOUR_SCHEMES.map(scheme => (
            <button
              key={scheme}
              type="button"
              aria-pressed={settings.colours === scheme}
              onClick={() => onChange({colours: scheme})}
              className={cn(
                'flex h-14 items-center justify-center rounded-lg border px-1 text-center text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                COLOUR_CLASS[scheme],
                settings.colours === scheme && 'border-2 border-primary',
              )}
            >
              {COLOUR_LABEL[scheme]}
            </button>
          ))}
        </div>
      </fieldset>
    </Shell>
  );
}

export function HelpDialog(props: DialogProps) {
  return (
    <Shell {...props} title="Help">
      <ul className="mt-4 flex flex-col gap-3 text-sm">
        <li>
          <strong>Move between questions:</strong> click a number at the bottom, or use the arrows.
        </li>
        <li>
          <strong>Review:</strong> tick Review to flag the current question; flagged numbers have a dot.
        </li>
        <li>
          <strong>Settings:</strong> change the text size and colours.
        </li>
        <li>
          <strong>Hide:</strong> cover the screen. The timer keeps running.
        </li>
        <li>
          <strong>Saving:</strong> answers save automatically. If you close the page, open it again to continue; the
          timer keeps running.
        </li>
      </ul>
    </Shell>
  );
}

export function SubmitDialog({
  summary,
  onConfirm,
  ...props
}: DialogProps & {summary: ReturnType<typeof submitSummary>; onConfirm: () => void}) {
  const left = summary.unanswered.length;
  return (
    <AlertDialog.Root {...props}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className={panel} {...useReturnFocus()}>
          <AlertDialog.Title className="text-lg font-semibold">Submit your answers?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            You have answered{' '}
            <strong className="text-foreground">
              {summary.answered} of {summary.total}
            </strong>{' '}
            questions.
            {left > 0 && ` ${left} ${left === 1 ? 'is' : 'are'} unanswered.`}
            {summary.flagged > 0 && ` ${summary.flagged} marked for review.`} You cannot change your answers after
            submitting.
          </AlertDialog.Description>
          {left > 0 && (
            <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm">Unanswered: {summary.unanswered.join(', ')}</p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" className="h-11">
                Go back
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button className="h-11" onClick={onConfirm}>
                Submit
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
