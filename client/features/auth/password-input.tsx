'use client';

import {Eye, EyeOff} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useState} from 'react';

import {Input} from '@/components/ui/input';

/** Password field with a show/hide button. */
export function PasswordInput(props: Omit<React.ComponentProps<'input'>, 'type'>) {
  const t = useTranslations('auth');
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <span className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-14" />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={t('showPassword')}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </span>
  );
}
