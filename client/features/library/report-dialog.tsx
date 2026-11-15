'use client';

import {MAX_REPORT_DETAIL_LENGTH, ReportReasonSchema, type LibraryType, type ReportReason} from '@linmaster/shared';
import {useTranslations} from 'next-intl';
import {Dialog} from 'radix-ui';
import {useEffect, useRef, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {inputClass} from '@/components/ui/input';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

import {libraryStatus} from './library-logic';

const dialogClass =
  'fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-card p-6 shadow-2xl sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl';

/**
 * A dialog opened from state (no Radix Trigger) does not know where focus came from: remember the element focused
 * when it opens and give focus back to it on close. Pass the result to `Dialog.Content onCloseAutoFocus`.
 */
export function useReturnFocus(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);
  return (e: Event) => {
    e.preventDefault();
    opener.current?.focus();
  };
}

/** Report a public set or test of someone else (UC45): a reason and an optional detail, once per person. */
export function ReportDialog({
  type,
  id,
  open,
  onOpenChange,
  onReported,
}: {
  type: LibraryType;
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported: () => void;
}) {
  const t = useTranslations('library.report');
  const errors = useTranslations('library.errors');
  const errorMessage = useErrorMessage();
  const [reason, setReason] = useState<ReportReason>('wrong_content');
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const returnFocus = useReturnFocus(open);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api('/library/reports', {
        method: 'POST',
        body: {targetType: type, targetId: id, reason, detail: detail.trim() || null},
      });
      toast.success(t('sent'));
      onReported();
      onOpenChange(false);
    } catch (error) {
      const status = libraryStatus(error);
      // Reported already (in another tab): the button should say so too.
      if (status === 'ALREADY_REPORTED') onReported();
      toast.error(status ? errors(status) : errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Content className={dialogClass} onCloseAutoFocus={returnFocus}>
          <Dialog.Title className="text-lg font-bold">{t(type === 'set' ? 'titleSet' : 'titleTest')}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">{t('body')}</Dialog.Description>
          <form className="flex flex-col gap-4" onSubmit={send}>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">{t('reason')}</legend>
              {ReportReasonSchema.options.map(r => (
                <label
                  key={r}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-secondary"
                >
                  <input
                    type="radio"
                    name="reason"
                    className="size-4 accent-primary"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {t(`reasons.${r}`)}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              <span>
                {t('detail')} <span className="font-normal text-muted-foreground">{t('optional')}</span>
              </span>
              <textarea
                className={cn(inputClass, 'min-h-20 py-2 font-normal')}
                maxLength={MAX_REPORT_DETAIL_LENGTH}
                placeholder={t('detailHint')}
                value={detail}
                onChange={e => setDetail(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="h-11 rounded-full px-5">
                  {t('cancel')}
                </Button>
              </Dialog.Close>
              <Button type="submit" variant="destructive" className="h-11 rounded-full px-5" disabled={sending}>
                {t('send')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
