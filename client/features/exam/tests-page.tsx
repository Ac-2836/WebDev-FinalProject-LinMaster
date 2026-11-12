'use client';

import {
  ListAttemptsResponseSchema,
  ListTestsResponseSchema,
  UpdateTestResponseSchema,
  type AttemptSummary,
  type TestSummary,
} from '@linmaster/shared';
import {
  BookOpen,
  ClipboardCheck,
  CloudOff,
  EllipsisVertical,
  Headphones,
  Pencil,
  RotateCw,
  Trash2,
  Upload,
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {AlertDialog, Dialog, DropdownMenu} from 'radix-ui';
import {useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {formatScores, SKILL_NAME} from './intro-logic';
import {testProgress} from './upload-logic';

const card = 'rounded-[20px] border bg-card shadow-soft';
const badge =
  'inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground';
const dialogClass =
  'fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-card p-6 shadow-2xl';

/** `/tests` (wireframe 05-exam/tests): the learner's uploaded tests, with Start / Continue, rename and delete. */
export function TestsPage() {
  const t = useTranslations('exam.tests');
  const errorMessage = useErrorMessage();
  const [tests, setTests] = useState<TestSummary[] | null>(null);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [failed, setFailed] = useState(false);
  const [renaming, setRenaming] = useState<TestSummary | null>(null);
  const [deleting, setDeleting] = useState<TestSummary | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    setTests(null);
    Promise.all([api('/tests'), api('/attempts')])
      .then(([list, history]) => {
        setAttempts(ListAttemptsResponseSchema.parse(history).attempts);
        setTests(ListTestsResponseSchema.parse(list).tests);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  async function rename(test: TestSummary, title: string) {
    try {
      const updated = UpdateTestResponseSchema.parse(
        await api(`/tests/${test.id}`, {method: 'PATCH', body: {title}}),
      ).test;
      setTests(list => list?.map(x => (x.id === updated.id ? updated : x)) ?? null);
      setRenaming(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(test: TestSummary) {
    try {
      await api(`/tests/${test.id}`, {method: 'DELETE'});
      setTests(list => list?.filter(x => x.id !== test.id) ?? null);
      toast.success(t('deleted', {title: test.title}));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const uploadButton = (
    <Button asChild className="h-11 rounded-full px-5">
      <Link href="/tests/new">
        <Upload aria-hidden="true" />
        {t('upload')}
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted-foreground">IELTS Academic</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">
            {t('title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>
        {uploadButton}
      </header>

      {failed ? (
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
      ) : !tests ? (
        <ul className="flex flex-col gap-3" aria-busy="true" aria-label={t('loading')}>
          {[0, 1, 2].map(i => (
            <li key={i} className={cn(card, 'flex items-center gap-4 p-4')}>
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : tests.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t('emptyTitle')} description={t('emptyBody')} action={uploadButton} />
      ) : (
        <ul className="flex flex-col gap-3">
          {tests.map(test => {
            const progress = testProgress(test, attempts);
            const Icon = test.skills.includes('listening') ? Headphones : BookOpen;
            const minutes = Math.round(test.durationSec / 60);
            return (
              <li key={test.id} className={cn(card, 'flex flex-wrap items-center gap-x-4 gap-y-3 p-4')}>
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/tests/${test.id}`} className="font-bold break-words hover:text-primary">
                      {test.title}
                    </Link>
                    <span className={badge}>{t(`kind.${test.kind}`)}</span>
                    {test.visibility === 'public' && <span className={badge}>{t('public')}</span>}
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    {t('meta', {
                      skills: test.skills.map(s => SKILL_NAME[s]).join(' + '),
                      questions: test.questionCount,
                      minutes,
                    })}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    progress.state === 'inProgress' && 'text-primary',
                    progress.state === 'done' && 'text-success',
                    progress.state === 'new' && 'text-muted-foreground',
                  )}
                >
                  {progress.state === 'done' ? formatScores(progress.scores) : t(`progress.${progress.state}`)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    asChild
                    variant={progress.state === 'inProgress' ? 'default' : 'outline'}
                    className="h-10 rounded-full px-4"
                  >
                    <Link href={`/tests/${test.id}`}>
                      {progress.state === 'inProgress' ? t('continue') : t('start')}
                    </Link>
                  </Button>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={t('more', {title: test.title})}
                      >
                        <EllipsisVertical aria-hidden="true" />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content align="end" className="z-40 w-64 rounded-xl border bg-card p-1 shadow-lg">
                        <DropdownMenu.Item
                          onSelect={() => setRenaming(test)}
                          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm outline-none data-highlighted:bg-muted"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          {t('rename')}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          disabled={test.attemptCount > 0}
                          onSelect={() => setDeleting(test)}
                          className="flex min-h-11 items-start gap-2 rounded-lg px-3 py-2.5 text-sm text-destructive outline-none data-disabled:opacity-60 data-highlighted:bg-danger-soft"
                        >
                          <Trash2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          <span className="flex flex-col">
                            {t('delete')}
                            {test.attemptCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {t('deleteBlocked', {count: test.attemptCount})}
                              </span>
                            )}
                          </span>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RenameDialog test={renaming} onClose={() => setRenaming(null)} onSave={rename} />

      <AlertDialog.Root open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
          <AlertDialog.Content className={dialogClass}>
            <AlertDialog.Title className="text-lg font-bold">{t('confirmTitle')}</AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground">
              {t('confirmBody', {title: deleting?.title ?? ''})}
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" className="h-11 rounded-full px-5">
                  {t('cancel')}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="destructive"
                  className="h-11 rounded-full px-5"
                  onClick={() => deleting && remove(deleting)}
                >
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

function RenameDialog({
  test,
  onClose,
  onSave,
}: {
  test: TestSummary | null;
  onClose: () => void;
  onSave: (test: TestSummary, title: string) => Promise<void>;
}) {
  const t = useTranslations('exam.tests');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (test) setTitle(test.title);
  }, [test]);

  return (
    <Dialog.Root open={!!test} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Content className={dialogClass} aria-describedby={undefined}>
          <Dialog.Title className="text-lg font-bold">{t('renameTitle')}</Dialog.Title>
          <form
            className="flex flex-col gap-4"
            onSubmit={async e => {
              e.preventDefault();
              if (!test || !title.trim()) return;
              setSaving(true);
              await onSave(test, title.trim());
              setSaving(false);
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t('titleLabel')}
              <input
                className="h-11 rounded-md border bg-background px-3 font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={title}
                maxLength={200}
                required
                onChange={e => setTitle(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="h-11 rounded-full px-5">
                  {t('cancel')}
                </Button>
              </Dialog.Close>
              <Button type="submit" className="h-11 rounded-full px-5" disabled={saving || !title.trim()}>
                {t('save')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
