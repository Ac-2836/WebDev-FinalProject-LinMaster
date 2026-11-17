'use client';

import {ClipboardPaste, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Dialog} from 'radix-ui';
import {useRef, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {inputClass} from '@/components/ui/input';

import {parsePasted, type PastedCard} from './paste-cards';

const dialogClass =
  'fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-card p-6 shadow-2xl sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl';

/** "Dán nhanh" (C3): many cards at once, one per line as `term<Tab>definition`, previewed before they are added. */
export function PasteDialog({onAdd}: {onAdd: (cards: PastedCard[]) => void}) {
  const t = useTranslations('flashcard.editor.paste');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const {cards, skipped} = parsePasted(text);
  const field = useRef<HTMLTextAreaElement>(null);

  function add() {
    onAdd(cards);
    setText('');
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" className="h-10 rounded-full">
          <ClipboardPaste aria-hidden="true" />
          {t('open')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Content
          className={dialogClass}
          onOpenAutoFocus={e => {
            // The field to paste into, not the close button that comes first.
            e.preventDefault();
            field.current?.focus();
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold">{t('title')}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">{t('help')}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="size-11" aria-label={t('close')}>
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">{t('label')}</span>
            <textarea
              ref={field}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={t('placeholder')}
              rows={8}
              spellCheck={false}
              className={cn(inputClass, 'min-h-40 py-2 font-mono text-sm')}
            />
          </label>
          <p className="text-[13px] text-muted-foreground" role="status">
            {text.trim() ? t('preview', {count: cards.length, skipped}) : t('empty')}
          </p>
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" className="h-11 rounded-full px-5">
                {t('cancel')}
              </Button>
            </Dialog.Close>
            <Button className="h-11 rounded-full px-5" disabled={cards.length === 0} onClick={add}>
              {t('add', {count: cards.length})}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
