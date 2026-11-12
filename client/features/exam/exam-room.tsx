'use client';

import {cn} from 'cn';
import {
  AlarmClock,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  EyeOff,
  LoaderCircle,
  Settings,
  WifiOff,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

import {Button} from '@/components/ui/button';

import {QuestionNav, type QuestionNavProps} from './question-nav';
import {COLOUR_CLASS, HelpDialog, SettingsDialog, SubmitDialog} from './room-dialogs';
import {useCountdown, useLeaveGuard, useOnline, useRoomSettings, type RoomSettings} from './room-hooks';
import {formatRemaining, isWarningTime, submitSummary, type WarningMinute} from './room-logic';

export type SaveState = 'saving' | 'saved' | 'error';

export interface ExamRoomProps extends Omit<QuestionNavProps, 'onSubmit'> {
  candidateName: string;
  /** e.g. "Practice Test 3 · Reading". */
  testTitle: string;
  /** From the attempt payload: the deadline and the server time when it was read. */
  deadlineAt: string;
  serverNow: string;
  /** Time is up: the caller submits the attempt. */
  onExpire: () => void;
  /** The candidate confirmed the submit dialog. */
  onSubmit: () => void;
  saveState: SaveState;
  /** Set once submitted so leaving no longer asks. */
  submitted?: boolean;
  /** Instruction strip above the content, e.g. "Part 2 · Read the text and answer questions 14–26". */
  partBar?: React.ReactNode;
  children: React.ReactNode;
}

const TEXT_SIZE_CLASS: Record<RoomSettings['textSize'], string> = {
  standard: 'text-[15px]',
  large: 'text-[17px]',
  xlarge: 'text-[20px]',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map(w => w[0]?.toUpperCase())
    .join('');

/**
 * Exam room frame (PLAN C4 "Phòng thi (client)", wireframe 05-exam/room-*): header with the server-synced timer,
 * Settings / Help / Hide, save state, offline banner, bottom navigation and the submit confirmation.
 * Exam text stays in English like the real computer-based test, whatever the app locale.
 */
export function ExamRoom({
  candidateName,
  testTitle,
  deadlineAt,
  serverNow,
  onExpire,
  onSubmit,
  saveState,
  submitted = false,
  partBar,
  children,
  ...nav
}: ExamRoomProps) {
  const online = useOnline();
  const [settings, updateSettings] = useRoomSettings();
  const [dialog, setDialog] = useState<'settings' | 'help' | 'submit' | null>(null);
  const [hidden, setHidden] = useState(false);
  const [warning, setWarning] = useState<WarningMinute | null>(null);
  const ms = useCountdown(deadlineAt, serverNow, onExpire, setWarning);
  const showButton = useRef<HTMLButtonElement>(null);

  useLeaveGuard(!submitted);

  useEffect(() => {
    if (warning === null) return;
    const id = setTimeout(() => setWarning(null), 8000);
    return () => clearTimeout(id);
  }, [warning]);

  useEffect(() => {
    if (hidden) showButton.current?.focus();
  }, [hidden]);

  const dialogProps = (name: NonNullable<typeof dialog>) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });
  const warn = ms !== null && isWarningTime(ms);

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold"
            aria-hidden="true"
          >
            {initials(candidateName)}
          </span>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold">{candidateName}</p>
            <p className="truncate text-xs text-muted-foreground">{testTitle}</p>
          </div>
        </div>
        <div role="timer" aria-live="off" className="flex shrink-0 items-center gap-2">
          <Clock className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
          <span
            className={cn(
              'rounded-md px-2 text-sm font-bold tabular-nums sm:text-base',
              warn && 'bg-warning-soft text-warning',
            )}
          >
            {ms === null ? '…' : formatRemaining(ms)}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-end gap-0.5">
          <SaveIndicator online={online} state={saveState} />
          <HeaderButton label="Settings" icon={Settings} onClick={() => setDialog('settings')} />
          <HeaderButton label="Help" icon={CircleHelp} onClick={() => setDialog('help')} />
          <HeaderButton label="Hide" ariaLabel="Hide screen" icon={EyeOff} onClick={() => setHidden(true)} />
        </div>
      </header>

      {!online && (
        <div role="alert" className="flex shrink-0 items-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning">
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          Connection lost. Your answers are kept on this device and will be saved when you are back online. The timer
          keeps running.
        </div>
      )}

      {partBar && <div className="shrink-0 border-b bg-muted/60 px-4 py-2.5 text-sm">{partBar}</div>}

      <main
        id="main"
        className={cn(
          'relative flex min-h-0 flex-1 flex-col',
          COLOUR_CLASS[settings.colours],
          TEXT_SIZE_CLASS[settings.textSize],
        )}
      >
        <div inert={hidden} className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
        {hidden && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-muted p-4 text-center text-foreground">
            <EyeOff className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">Your screen is hidden. The timer is still running.</p>
            <Button ref={showButton} className="h-11" onClick={() => setHidden(false)}>
              Show screen
            </Button>
          </div>
        )}
      </main>

      <div inert={hidden} className="contents">
        <QuestionNav {...nav} onSubmit={() => setDialog('submit')} />
      </div>

      {warning !== null && (
        <div
          role="alert"
          className="fixed top-16 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-warning shadow-lg"
        >
          <AlarmClock className="size-4" aria-hidden="true" />
          {warning} minutes remaining
        </div>
      )}

      <SettingsDialog {...dialogProps('settings')} settings={settings} onChange={updateSettings} />
      <HelpDialog {...dialogProps('help')} />
      <SubmitDialog
        {...dialogProps('submit')}
        summary={submitSummary(nav.parts, nav.answered, nav.flagged)}
        onConfirm={onSubmit}
      />
    </div>
  );
}

function HeaderButton({
  label,
  ariaLabel = label,
  icon: Icon,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  icon: React.ComponentType<{className?: string}>;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" className="size-11 p-0 lg:w-auto lg:px-3" aria-label={ariaLabel} onClick={onClick}>
      <Icon className="size-4" />
      <span className="hidden lg:inline">{label}</span>
    </Button>
  );
}

function SaveIndicator({online, state}: {online: boolean; state: SaveState}) {
  if (!online) {
    return (
      <span className="flex items-center gap-1 rounded-md bg-warning-soft px-2 py-1 text-xs font-semibold text-warning">
        <WifiOff className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Offline</span>
      </span>
    );
  }
  const view = {
    saving: {Icon: LoaderCircle, text: 'Saving…', className: 'text-muted-foreground', icon: 'animate-spin'},
    saved: {Icon: CircleCheck, text: 'Saved', className: 'text-muted-foreground', icon: 'text-success'},
    error: {Icon: CircleAlert, text: 'Not saved', className: 'text-warning', icon: ''},
  }[state];
  return (
    <span role="status" className={cn('hidden items-center gap-1 px-2 text-xs md:flex', view.className)}>
      <view.Icon className={cn('size-4', view.icon)} aria-hidden="true" />
      {view.text}
    </span>
  );
}
