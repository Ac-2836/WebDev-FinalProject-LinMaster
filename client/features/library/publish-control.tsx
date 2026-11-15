'use client';

import {
  GetTestResponseSchema,
  LibrarySetPreviewResponseSchema,
  LibraryTestPreviewResponseSchema,
  LibraryVisibilityResponseSchema,
  type LibraryType,
  type TestSummary,
  type TestVisibility,
} from '@linmaster/shared';
import {EyeOff, Globe, Lock} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {Dialog} from 'radix-ui';
import {useEffect, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {inputClass} from '@/components/ui/input';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {libraryStatus} from './library-logic';
import {useReturnFocus} from './report-dialog';

const ICON = {private: Lock, public: Globe, hidden: EyeOff};
const dialogClass =
  'fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-card p-6 shadow-2xl';

/**
 * Publish / Unpublish on the owner's own set or test page (PLAN C5). A test needs a source first (UC40 2a), asked
 * here. A hidden item (reported) must be unpublished first, which closes its reports.
 */
export function PublishControl({
  type,
  id,
  visibility: initial,
  source,
  onSourceSaved,
}: {
  type: LibraryType;
  id: string;
  visibility: TestVisibility;
  /** Tests only: the source the library shows; asked for when missing. */
  source?: string | null;
  onSourceSaved?: (source: string) => void;
}) {
  const t = useTranslations('library.publish');
  const errors = useTranslations('library.errors');
  const errorMessage = useErrorMessage();
  const [visibility, setVisibility] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [askSource, setAskSource] = useState(false);
  const [draft, setDraft] = useState('');
  const returnFocus = useReturnFocus(askSource);
  const Icon = ICON[visibility];
  const base = `/library/${type === 'set' ? 'sets' : 'tests'}/${id}`;

  async function change(action: 'publish' | 'unpublish') {
    setBusy(true);
    try {
      const res = LibraryVisibilityResponseSchema.parse(await api(`${base}/${action}`, {method: 'POST'}));
      setVisibility(res.visibility);
      toast.success(t(res.visibility === 'public' ? 'publishedToast' : 'unpublishedToast'));
    } catch (error) {
      const status = libraryStatus(error);
      if (status === 'CONTENT_HIDDEN') setVisibility('hidden');
      if (status === 'TEST_SOURCE_REQUIRED') setAskSource(true);
      else toast.error(status ? errors(status) : errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveSourceAndPublish(e: React.FormEvent) {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    setBusy(true);
    try {
      await api(`/tests/${id}`, {method: 'PATCH', body: {source: value}});
      onSourceSaved?.(value);
      setAskSource(false);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
      return;
    }
    await change('publish');
  }

  return (
    <section
      aria-labelledby={`publish-${id}`}
      className="flex flex-wrap items-center gap-3 rounded-[20px] border bg-card p-4 shadow-soft"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={`publish-${id}`} className="font-semibold">
          {t(`${visibility}Title`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`${visibility}Body`)}{' '}
          {visibility === 'public' && (
            <Link href={base} className="font-semibold text-primary hover:underline">
              {t('view')}
            </Link>
          )}
        </p>
      </div>
      <Button
        variant={visibility === 'private' ? 'default' : 'outline'}
        className="h-11 rounded-full px-5"
        disabled={busy}
        onClick={() =>
          visibility !== 'private'
            ? void change('unpublish')
            : type === 'test' && !source
              ? setAskSource(true)
              : void change('publish')
        }
      >
        {t(visibility === 'private' ? 'publish' : 'unpublish')}
      </Button>

      <Dialog.Root open={askSource} onOpenChange={setAskSource}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
          <Dialog.Content className={dialogClass} onCloseAutoFocus={returnFocus}>
            <Dialog.Title className="text-lg font-bold">{t('sourceTitle')}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">{t('sourceBody')}</Dialog.Description>
            <form className="flex flex-col gap-4" onSubmit={saveSourceAndPublish}>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {t('sourceLabel')}
                <input
                  className={cn(inputClass, 'font-normal')}
                  maxLength={300}
                  required
                  placeholder={t('sourceHint')}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" className="h-11 rounded-full px-5">
                    {t('cancel')}
                  </Button>
                </Dialog.Close>
                <Button type="submit" className="h-11 rounded-full px-5" disabled={busy || !draft.trim()}>
                  {t('publish')}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

/**
 * The owner's set page does not know the set's visibility: the flashcard API does not return it, so the library
 * preview tells. A preview means public; 404 means private, or hidden (then Publish answers CONTENT_HIDDEN).
 */
// shortcut: one extra request per set page; drop it once FlashcardSetSchema carries `visibility`.
export function SetPublishControl({id}: {id: string}) {
  const [visibility, setVisibility] = useState<TestVisibility | null>(null);
  useEffect(() => {
    api(`/library/sets/${id}`)
      .then(res => setVisibility(LibrarySetPreviewResponseSchema.parse(res).viewer.isOwner ? 'public' : null))
      .catch(error => setVisibility(error instanceof ApiError && error.httpStatus === 404 ? 'private' : null));
  }, [id]);
  return visibility && <PublishControl type="set" id={id} visibility={visibility} />;
}

/**
 * On the owner's test page. Only the owner gets the control: a private or hidden test is readable by its owner only,
 * and the library preview tells who owns a public one.
 */
export function TestPublishControl({id}: {id: string}) {
  const [test, setTest] = useState<TestSummary | null>(null);
  useEffect(() => {
    api(`/tests/${id}`)
      .then(async res => {
        const loaded = GetTestResponseSchema.parse(res).test;
        if (loaded.visibility === 'public') {
          const preview = LibraryTestPreviewResponseSchema.parse(await api(`/library/tests/${id}`));
          if (!preview.viewer.isOwner) return;
        }
        setTest(loaded);
      })
      .catch(() => setTest(null));
  }, [id]);
  if (!test) return null;
  return (
    <PublishControl
      type="test"
      id={test.id}
      visibility={test.visibility}
      source={test.source}
      onSourceSaved={source => setTest({...test, source})}
    />
  );
}
