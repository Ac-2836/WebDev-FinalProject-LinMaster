'use client';

import {
  DeleteFlashcardSetResponseSchema,
  GetFlashcardSetResponseSchema,
  GetStudyCardsResponseSchema,
  type FlashcardSet,
  type FlashcardVisibility,
} from '@linmaster/shared';
import {ArrowLeft, CloudOff, EllipsisVertical, Layers, Pencil, RotateCw, Trash2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AlertDialog, DropdownMenu} from 'radix-ui';
import {cloneElement, useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {useReturnFocus} from '@/components/ui/return-focus';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api, isNotFound} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {studyModes} from './study-modes';

const card = 'rounded-[20px] border bg-card shadow-soft';
const badge =
  'inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground';

export interface SetPageProps {
  id: string;
  /**
   * Publish / Unpublish from the library, given by the route (a feature does not import another). The element gets
   * the set's `visibility` as a prop once the set is loaded.
   */
  publish?: React.ReactElement<{visibility?: FlashcardVisibility}>;
}

/** `/flashcards/[id]` (C3, wireframe 04-flashcard/set): set preview, study modes and the card list. */
export function SetPage({id, publish}: SetPageProps) {
  const t = useTranslations('flashcard.set');
  const deleteFocus = useReturnFocus();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [counts, setCounts] = useState<{due: number; fresh: number} | null>(null);
  const [error, setError] = useState<'notFound' | 'failed' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setSet(null);
    api(`/flashcards/sets/${id}`)
      .then(res => setSet(GetFlashcardSetResponseSchema.parse(res).set))
      .catch(err => setError(isNotFound(err) ? 'notFound' : 'failed'));
    // Counts are a hint on the Learn button; the page works without them.
    api(`/flashcards/sets/${id}/study`)
      .then(res => {
        const study = GetStudyCardsResponseSchema.parse(res);
        setCounts({due: study.dueCount, fresh: study.newCount});
      })
      .catch(() => setCounts(null));
  }, [id]);
  useEffect(load, [load]);

  async function remove() {
    try {
      DeleteFlashcardSetResponseSchema.parse(await api(`/flashcards/sets/${id}`, {method: 'DELETE'}));
      toast.success(t('deleted', {title: set?.title ?? ''}));
      router.push('/flashcards');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const back = (
    <Link
      href="/flashcards"
      className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] text-muted-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {error === 'notFound' ? (
          <EmptyState icon={Layers} title={t('notFoundTitle')} description={t('notFoundBody')} />
        ) : (
          <div role="alert" className={cn(card, 'flex flex-col items-center gap-3 p-10 text-center')}>
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
              <CloudOff className="size-6" aria-hidden="true" />
            </span>
            <p className="font-bold">{t('loadError')}</p>
            <Button variant="outline" className="h-10 rounded-full" onClick={load}>
              <RotateCw aria-hidden="true" />
              {t('retry')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!set) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        {back}
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48 w-full rounded-[20px]" />
      </div>
    );
  }

  const cards = [...set.cards].sort((a, b) => a.position - b.position);
  const modes = studyModes.map(({id: mode, icon, minCards = 0}) => ({
    mode,
    icon,
    locked: cards.length < minCards,
    minCards,
    label: t(mode),
    hint:
      cards.length < minCards
        ? t('needCards', {min: minCards})
        : mode === 'learn'
          ? counts
            ? t('learnHint', {due: counts.due, fresh: counts.fresh})
            : t('learnFallback')
          : t(`${mode}Hint`),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        {back}
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] [overflow-wrap:anywhere] sm:text-[34px]">
              {set.title}
            </h1>
            {set.description && <p className="mt-1 text-muted-foreground">{set.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={badge}>{t('cardCount', {count: cards.length})}</span>
              <span className={badge}>
                {set.termLang.toUpperCase()} → {set.definitionLang.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-11 rounded-full px-5">
              <Link href={`/flashcards/${set.id}/edit`}>
                <Pencil aria-hidden="true" />
                {t('edit')}
              </Link>
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="icon" className="size-11" aria-label={t('more')}>
                  <EllipsisVertical aria-hidden="true" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" className="z-40 w-48 rounded-xl border bg-card p-1 shadow-lg">
                  <DropdownMenu.Item
                    onSelect={() => setConfirming(true)}
                    className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-destructive outline-none data-highlighted:bg-danger-soft"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t('delete')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>
      {publish && cloneElement(publish, {visibility: set.visibility})}

      {cards.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <Button asChild className="h-11 rounded-full px-5">
              <Link href={`/flashcards/${set.id}/edit`}>{t('addCards')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="study-modes">
            <h2 id="study-modes" className="mb-3 text-xl font-semibold">
              {t('modes')}
            </h2>
            <div className="grid grid-cols-2 gap-3 md:max-w-xl">
              {modes.map(({mode, icon: Icon, label, hint, locked}, i) => {
                const body = (
                  <>
                    <Icon
                      className={cn('size-6', locked ? 'text-muted-foreground' : 'text-primary')}
                      aria-hidden="true"
                    />
                    <span className="font-bold">{label}</span>
                    <span className="text-[13px] text-muted-foreground">{hint}</span>
                  </>
                );
                // Too few cards for this mode: say why instead of opening a page that cannot work.
                return locked ? (
                  <div
                    key={mode}
                    role="group"
                    aria-disabled="true"
                    className={cn(card, 'flex flex-col gap-2 p-4 opacity-70')}
                  >
                    {body}
                  </div>
                ) : (
                  <Link
                    key={mode}
                    href={`/flashcards/${set.id}/study/${mode}`}
                    className={cn(
                      card,
                      'flex flex-col gap-2 p-4 hover:border-primary',
                      i === 0 && 'border-primary ring-1 ring-primary hover:bg-secondary',
                    )}
                  >
                    {body}
                  </Link>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="card-list">
            <h2 id="card-list" className="mb-3 text-xl font-semibold">
              {t('cards')}
            </h2>
            <ul className={cn(card, 'divide-y [overflow-wrap:anywhere]')}>
              {cards.map(c => (
                <li key={c.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_1.6fr] sm:gap-4">
                  <p className="font-semibold [overflow-wrap:anywhere]">{c.term}</p>
                  <div className="min-w-0">
                    <p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">{c.definition}</p>
                    {c.example && (
                      <p className="mt-1 font-serif text-[13px] [overflow-wrap:anywhere] italic">{c.example}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
          <AlertDialog.Content
            {...deleteFocus}
            className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-card p-6 shadow-2xl"
          >
            <AlertDialog.Title className="text-lg font-semibold">{t('confirmTitle')}</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              {t('confirmBody', {title: set.title, count: cards.length})}
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" className="h-11 rounded-full px-5">
                  {t('cancel')}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="destructive" className="h-11 rounded-full px-5" onClick={remove}>
                  {t('delete')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
