'use client';

import {CreateFlashcardSetFromVocabSchema, CreateFlashcardSetResponseSchema} from '@linmaster/shared';
import {CircleAlert, LoaderCircle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {Dialog} from 'radix-ui';
import {useId, useState} from 'react';
import {toast} from 'sonner';

import {Button} from '@/components/ui/button';
import {useReturnFocus} from '@/components/ui/return-focus';
import {Input} from '@/components/ui/input';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

/** The API takes at most this many words per set (CreateFlashcardSetFromVocabSchema). */
export const MAX_SET_WORDS = 100;

export interface CreateSetDialogProps {
  vocabIds: string[] | null;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/** "Tạo bộ thẻ" from the selected words: `POST /flashcards/sets/from-vocab` (C2, C3). */
export function CreateSetDialog({vocabIds, onOpenChange, onCreated}: CreateSetDialogProps) {
  const t = useTranslations('vocab.createSet');
  const returnFocus = useReturnFocus();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const count = vocabIds?.length ?? 0;
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = CreateFlashcardSetFromVocabSchema.safeParse({title, vocabIds});
    if (!parsed.success) return setError(t('titleRequired'));
    setError(null);
    setPending(true);
    try {
      const {set} = CreateFlashcardSetResponseSchema.parse(
        await api('/flashcards/sets/from-vocab', {method: 'POST', body: parsed.data}),
      );
      // Go straight to the new set (QA T7); the toast confirms what was created.
      toast.success(t('created', {title: set.title, count: set.cards.length}));
      setTitle('');
      onCreated();
      router.push(`/flashcards/${set.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
    setPending(false);
  }

  return (
    <Dialog.Root open={vocabIds !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Content
          {...returnFocus}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-4 rounded-t-2xl bg-card p-6 shadow-2xl outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Dialog.Title className="text-lg font-semibold">{t('title')}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {t('description', {count})}
            </Dialog.Description>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-title`} className="text-sm font-semibold">
                {t('setTitle')}
              </label>
              <Input
                id={`${ids}-title`}
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={200}
                placeholder={t('setTitlePlaceholder')}
                aria-invalid={Boolean(error)}
                autoFocus
              />
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="h-11 rounded-full px-5">
                  {t('cancel')}
                </Button>
              </Dialog.Close>
              <Button type="submit" className="h-11 rounded-full px-5" disabled={pending} aria-busy={pending}>
                {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {t('submit')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
