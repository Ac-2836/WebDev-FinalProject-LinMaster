'use client';

import {AuthResponseSchema, LoginRequestSchema} from '@linmaster/shared';
import {LoaderCircle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useState} from 'react';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';
import {useSession} from '@/core/auth/session-provider';

import {BookLoader, prefersReducedMotion, type BookPhase} from './auth-motion';
import {AuthShell, Notice} from './auth-shell';
import {focusFirstInvalid, FormField, invalidFields} from './form-field';
import {PasswordInput} from './password-input';

export interface LoginPageProps {
  /** Page to return to after login (`/login?next=`). */
  next?: string;
}

/** `/login` (C1, wireframe 01-public/login). */
export function LoginPage({next}: LoginPageProps) {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const {signIn} = useSession();
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(new Set<string>());
  const [book, setBook] = useState<BookPhase | null>(null);
  const [notice, setNotice] = useState<{tone: 'error' | 'warning'; text: string} | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = LoginRequestSchema.safeParse({email: form.get('email'), password: form.get('password')});
    if (!parsed.success) {
      const fields = invalidFields(parsed.error.issues);
      setInvalid(fields);
      focusFirstInvalid(event.currentTarget, fields);
      return;
    }
    setInvalid(new Set());
    setNotice(null);
    setPending(true);
    const motion = !prefersReducedMotion();
    if (motion) setBook('closed');
    try {
      const request = api('/auth/login', {method: 'POST', body: parsed.data});
      // Let the logo fly in and fold before it opens again, however fast the server answers.
      const [res] = await Promise.all([request, motion && wait(1100)]);
      const {token, user} = AuthResponseSchema.parse(res);
      if (motion) {
        setBook('open');
        await wait(550);
      }
      await signIn(token, user, next);
    } catch (error) {
      setPending(false);
      setBook(null);
      const status = error instanceof ApiError ? error.httpStatus : 0;
      // The server does not say whether the email exists (C1), so neither do we.
      if (status === 401) setNotice({tone: 'error', text: t('login.invalidCredentials')});
      else if (status === 429) setNotice({tone: 'warning', text: t('tooManyAttempts')});
      else setNotice({tone: 'error', text: errorMessage(error)});
    }
  }

  return (
    <AuthShell title={t('login.title')} subtitle={t('login.subtitle')} aside={<LoginAside />}>
      {book && <BookLoader phase={book} />}
      {notice ? (
        <Notice tone={notice.tone}>{notice.text}</Notice>
      ) : (
        next && <Notice tone="info">{t('login.continue')}</Notice>
      )}
      <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
        <FormField label={t('fields.email')} error={invalid.has('email') && t('errors.email')}>
          {({id, describedBy, invalid: bad}) => (
            <Input
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              aria-invalid={bad}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
        <FormField
          label={t('fields.password')}
          error={invalid.has('password') && t('errors.password')}
          hint={
            <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
              {t('login.forgot')}
            </Link>
          }
        >
          {({id, describedBy, invalid: bad}) => (
            <PasswordInput
              id={id}
              name="password"
              autoComplete="current-password"
              aria-invalid={bad}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
        <Button
          type="submit"
          size="lg"
          className="mt-2 h-12 w-full rounded-full text-base"
          disabled={pending}
          aria-busy={pending}
        >
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {pending ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('login.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t('login.toRegister')}
        </Link>
      </p>
    </AuthShell>
  );
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function LoginAside() {
  const t = useTranslations('auth.login.aside');
  const stats = [
    ['18', t('due')],
    ['7', t('streak')],
    ['6.5', t('band')],
  ];
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="rounded-[20px] bg-white/90 p-5 shadow-lift backdrop-blur">
        <p className="eyebrow text-muted-foreground">{t('today')}</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          {stats.map(([value, label]) => (
            <div key={label}>
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-[13px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-10 rounded-[20px] bg-white p-5 shadow-lift">
        <div className="flex items-baseline gap-2">
          <p className="font-bold">mitigate</p>
          <p className="text-[13px] text-muted-foreground">verb</p>
          <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">C1</span>
        </div>
        <p className="mt-1 text-sm">giảm nhẹ, làm dịu (tác động xấu)</p>
        <p className="mt-2 font-serif text-[13px] text-muted-foreground italic">
          “…pressure to <mark>mitigate</mark> the effects of rising sea levels…”
        </p>
      </div>
      <p className="mt-6 text-2xl leading-snug font-semibold tracking-tight">{t('tagline')}</p>
    </div>
  );
}
