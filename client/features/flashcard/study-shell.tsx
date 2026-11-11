'use client';

import {X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';

import {Button} from '@/components/ui/button';

export interface StudyShellProps {
  setId: string;
  title: string;
  modeLabel: string;
  /** Runs before leaving, e.g. to end the study session. */
  onExit?: () => Promise<void> | void;
  exitLabel?: string;
  /** Extra header controls on the right (e.g. shuffle). */
  actions?: React.ReactNode;
  /** Progress line under the header. */
  progress?: React.ReactNode;
  children: React.ReactNode;
}

/** Focus layout for study modes: no app navbar, an exit button, the set title and progress (wireframe 04-flashcard/study-*). */
export function StudyShell({setId, title, modeLabel, onExit, exitLabel, actions, progress, children}: StudyShellProps) {
  const t = useTranslations('flashcard.study');
  const router = useRouter();
  async function exit() {
    await onExit?.();
    router.push(`/flashcards/${setId}`);
  }
  return (
    <div className="flex min-h-dvh flex-col glow">
      <header className="border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Button variant="ghost" size="icon" className="size-11" onClick={exit} aria-label={exitLabel ?? t('exit')}>
            <X className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="text-[13px] text-muted-foreground">{modeLabel}</p>
          </div>
          <div className="flex w-11 justify-end">{actions}</div>
        </div>
        {progress}
      </header>
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
