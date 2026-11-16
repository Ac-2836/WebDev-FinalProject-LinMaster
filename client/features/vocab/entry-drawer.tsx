'use client';

import {VocabEntryResponseSchema, type VocabEntry} from '@linmaster/shared';
import {FileText, LoaderCircle, Trash2, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {Dialog} from 'radix-ui';
import {useId, useState} from 'react';
import {toast} from 'sonner';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {useReturnFocus} from '@/components/ui/return-focus';
import {inputClass} from '@/components/ui/input';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';

const badge = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold';

export interface EntryDrawerProps {
  entry: VocabEntry | null;
  onClose: () => void;
  onUpdated: (entry: VocabEntry) => void;
  onDelete: (entry: VocabEntry) => void;
}

/** Word detail: side drawer on desktop, full sheet on mobile (wireframe 03-vocab/word-bank). */
export function EntryDrawer({entry, onClose, onUpdated, onDelete}: EntryDrawerProps) {
  const t = useTranslations('vocab.bank');
  const returnFocus = useReturnFocus();
  return (
    <Dialog.Root open={entry !== null} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30" />
        <Dialog.Content
          {...returnFocus}
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card shadow-2xl outline-none"
        >
          {entry && <Detail key={entry.id} entry={entry} onUpdated={onUpdated} onDelete={onDelete} />}
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" aria-label={t('close')} className="absolute top-3 right-3">
              <X aria-hidden="true" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Detail({entry, onUpdated, onDelete}: Omit<EntryDrawerProps, 'entry' | 'onClose'> & {entry: VocabEntry}) {
  const t = useTranslations('vocab.bank');
  const errorMessage = useErrorMessage();
  const ids = useId();
  const [note, setNote] = useState(entry.note ?? '');
  const [saving, setSaving] = useState(false);

  async function saveNote() {
    setSaving(true);
    try {
      const res = VocabEntryResponseSchema.parse(
        await api(`/vocab/entries/${entry.id}`, {method: 'PATCH', body: {note: note.trim() || null}}),
      );
      onUpdated(res.entry);
      toast.success(t('noteSaved'));
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setSaving(false);
  }

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <Dialog.Title className="text-lg font-semibold break-words">{entry.headword}</Dialog.Title>
      </div>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {entry.ipa && <span className="text-muted-foreground">{entry.ipa}</span>}
          <span className={cn(badge, 'bg-muted text-muted-foreground')}>{entry.partOfSpeech}</span>
          {entry.cefr && <span className={cn(badge, 'bg-secondary text-primary')}>{entry.cefr}</span>}
          {entry.topics.map(topic => (
            <span key={topic} className={cn(badge, 'bg-muted text-muted-foreground capitalize')}>
              {topic}
            </span>
          ))}
        </div>
        <div>
          <p className="text-base font-semibold">{entry.meaningVi}</p>
          {entry.definitionEn && <p className="mt-1 text-muted-foreground">{entry.definitionEn}</p>}
        </div>
        {entry.usageNote && (
          <p className="rounded-lg bg-muted p-3">
            <strong>{t('usage')}</strong> {entry.usageNote}
          </p>
        )}
        {entry.collocations.length > 0 && (
          <div>
            <p className="mb-2 font-semibold">{t('collocations')}</p>
            <ul className="flex flex-wrap gap-1.5">
              {entry.collocations.map(c => (
                <li key={c} className={cn(badge, 'bg-muted text-foreground')}>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="mb-2 font-semibold">{t('contexts', {count: entry.contexts.length})}</p>
          <ul className="flex flex-col gap-2">
            {entry.contexts.map(c => (
              <li key={c.id} className="rounded-lg border p-3">
                <p className="font-serif italic">“{c.sentence}”</p>
                {c.documentId ? (
                  <Link
                    href={`/read/${c.documentId}`}
                    className="mt-1 inline-flex min-h-8 items-center gap-1 text-[13px] text-muted-foreground hover:underline"
                  >
                    <FileText className="size-3" aria-hidden="true" />
                    {t('openDocument')}
                  </Link>
                ) : (
                  <p className="mt-1 text-[13px] text-muted-foreground">{t('noDocument')}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-note`} className="font-semibold">
            {t('note')}
          </label>
          <textarea
            id={`${ids}-note`}
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={2000}
            placeholder={t('notePlaceholder')}
            className={cn(inputClass, 'min-h-20 py-2')}
          />
        </div>
      </div>
      <div className="flex gap-2 border-t px-5 py-4">
        <Button
          variant="ghost"
          onClick={() => onDelete(entry)}
          className="h-11 rounded-full text-destructive hover:bg-danger-soft hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
          {t('deleteOne')}
        </Button>
        <Button
          onClick={saveNote}
          disabled={saving || note.trim() === (entry.note ?? '')}
          aria-busy={saving}
          className="ml-auto h-11 rounded-full px-5"
        >
          {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {t('saveNote')}
        </Button>
      </div>
    </>
  );
}
