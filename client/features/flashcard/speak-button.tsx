'use client';

import {Volume2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';

import {Button} from '@/components/ui/button';

/** Reads an English term aloud with the browser voice, as the word lookup card does. */
export function speak(text: string) {
  if (!('speechSynthesis' in globalThis)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

/** Speaker button for the study modes; hidden when the browser has no speech synthesis. The S key is wired by the mode. */
export function SpeakButton({text}: {text: string}) {
  const t = useTranslations('flashcard.study');
  // Checked after mount so the server render and the first client render match.
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported('speechSynthesis' in globalThis), []);
  if (!supported) return null;
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-11 rounded-full"
      onClick={() => speak(text)}
      aria-label={t('speak', {word: text})}
      aria-keyshortcuts="S"
      title={t('speakHint')}
    >
      <Volume2 className="size-5" aria-hidden="true" />
    </Button>
  );
}
