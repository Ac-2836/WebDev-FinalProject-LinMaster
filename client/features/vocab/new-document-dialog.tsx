'use client';

import {CreatePastedDocumentRequestSchema, CreateVocabDocumentResponseSchema} from '@linmaster/shared';
import {CircleAlert, FileUp, LoaderCircle, X} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {Dialog, Tabs} from 'radix-ui';
import {useId, useRef, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {Input, inputClass} from '@/components/ui/input';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_WORDS = 20_000;
const ACCEPT =
  '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export interface NewDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Tài liệu mới": paste text or upload a PDF/DOCX/TXT file (≤ 5 MB), then open it in the reader. */
export function NewDocumentDialog({open, onOpenChange}: NewDocumentDialogProps) {
  const t = useTranslations('vocab.new');
  const format = useFormatter();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'paste' | 'file'>('paste');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const words = text.split(/\s+/u).filter(Boolean).length;

  function pickFile(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (next.size > MAX_FILE_BYTES) return setError(t('errors.tooLarge', {name: next.name}));
    if (!/\.(pdf|docx|txt)$/i.test(next.name)) return setError(t('errors.unsupported', {name: next.name}));
    setFile(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    let body: unknown;
    if (tab === 'paste') {
      // Empty title: take the first line of the text, like the wireframe says.
      const parsed = CreatePastedDocumentRequestSchema.safeParse({
        title: title.trim() || text.trim().split('\n')[0].slice(0, 80),
        text,
      });
      if (!parsed.success) return setError(words > MAX_WORDS ? t('errors.tooManyWords') : t('errors.emptyText'));
      body = parsed.data;
    } else {
      if (!file) return setError(t('errors.noFile'));
      const form = new FormData();
      if (title.trim()) form.append('title', title.trim());
      form.append('file', file);
      body = form;
    }
    setPending(true);
    try {
      const {document} = CreateVocabDocumentResponseSchema.parse(await api('/vocab/documents', {method: 'POST', body}));
      router.push(`/read/${document.id}`);
    } catch (err) {
      setPending(false);
      const status = err instanceof ApiError ? err.httpStatus : 0;
      const name = file?.name ?? '';
      if (status === 413) setError(tab === 'file' ? t('errors.tooLarge', {name}) : t('errors.tooManyWords'));
      else if (status === 415) setError(t('errors.unsupported', {name}));
      else if (status === 422) setError(t('errors.noText', {name}));
      else setError(errorMessage(err));
    }
  }

  const tabClass =
    'flex-1 rounded-md px-4 py-1.5 font-semibold whitespace-nowrap text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-card shadow-2xl outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(42rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <form onSubmit={submit} className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <Dialog.Title className="flex-1 text-lg font-semibold">{t('title')}</Dialog.Title>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={t('close')}>
                  <X aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>
            <Tabs.Root
              value={tab}
              onValueChange={v => {
                setTab(v as 'paste' | 'file');
                setError(null);
              }}
              className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5"
            >
              <Tabs.List
                className="inline-flex w-full rounded-lg border bg-muted p-0.5 text-sm sm:w-fit"
                aria-label={t('source')}
              >
                <Tabs.Trigger value="paste" className={tabClass}>
                  {t('paste')}
                </Tabs.Trigger>
                <Tabs.Trigger value="file" className={tabClass}>
                  {t('file')}
                </Tabs.Trigger>
              </Tabs.List>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-title`} className="text-sm font-semibold">
                  {t('docTitle')}
                </label>
                <Input
                  id={`${ids}-title`}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder={tab === 'paste' ? t('titleFromText') : t('titleFromFile')}
                />
              </div>
              <Tabs.Content value="paste" className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-text`} className="text-sm font-semibold">
                  {t('content')}
                </label>
                <textarea
                  id={`${ids}-text`}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={t('contentPlaceholder')}
                  aria-describedby={`${ids}-text-hint`}
                  className={cn(inputClass, 'min-h-48 py-2 font-serif text-base')}
                />
                <p id={`${ids}-text-hint`} className="flex justify-between gap-3 text-[13px] text-muted-foreground">
                  <span>{t('paragraphHint')}</span>
                  <span className={cn('shrink-0', words > MAX_WORDS && 'font-semibold text-destructive')}>
                    {t('wordCount', {count: format.number(words), max: MAX_WORDS})}
                  </span>
                </p>
              </Tabs.Content>
              <Tabs.Content value="file" className="flex flex-col gap-2">
                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragging(false);
                    pickFile(e.dataTransfer.files[0]);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center',
                    dragging && 'border-primary bg-secondary',
                  )}
                >
                  <FileUp className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="font-semibold text-primary hover:underline"
                    >
                      {t('chooseFile')}
                    </button>{' '}
                    {t('orDrop')}
                  </p>
                  {file && <p className="text-sm font-semibold break-all">{file.name}</p>}
                  <p className="text-[13px] text-muted-foreground">{t('fileHint')}</p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={e => pickFile(e.target.files?.[0])}
                  />
                </div>
              </Tabs.Content>
              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-destructive"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
            </Tabs.Root>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
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
