'use client';

import {AuthResponseSchema, RegisterRequestSchema} from '@linmaster/shared';
import {Layers, LoaderCircle, Monitor, Sparkles} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {Input, inputClass} from '@/components/ui/input';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';
import {useSession} from '@/core/auth/session-provider';

import {AuthShell, Notice} from './auth-shell';
import {BANDS, FormField, invalidFields} from './form-field';
import {PasswordInput} from './password-input';

/** 0–3 filled bars: 8+ characters, 12+ characters, letters mixed with digits or symbols. */
export function passwordStrength(password: string) {
  return [password.length >= 8, password.length >= 12, /[a-z]/i.test(password) && /[^a-z]/i.test(password)].filter(
    Boolean,
  ).length;
}

/** `/register` (C1, wireframe 01-public/register). */
export function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const {signIn} = useSession();
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState(new Set<string>());
  const [emailTaken, setEmailTaken] = useState(false);
  const [notice, setNotice] = useState<{tone: 'error' | 'warning'; text: string} | null>(null);
  const strength = passwordStrength(password);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const band = form.get('targetBand');
    const parsed = RegisterRequestSchema.safeParse({
      displayName: form.get('displayName'),
      email: form.get('email'),
      password: form.get('password'),
      locale,
      targetBand: band ? Number(band) : null,
    });
    if (!parsed.success) {
      const fields = invalidFields(parsed.error.issues);
      setInvalid(fields);
      event.currentTarget.querySelector<HTMLElement>(`[name="${[...fields][0]}"]`)?.focus();
      return;
    }
    setInvalid(new Set());
    setEmailTaken(false);
    setNotice(null);
    setPending(true);
    try {
      const {token, user} = AuthResponseSchema.parse(await api('/auth/register', {method: 'POST', body: parsed.data}));
      await signIn(token, user);
    } catch (error) {
      setPending(false);
      const status = error instanceof ApiError ? error.httpStatus : 0;
      if (status === 409) setEmailTaken(true);
      else if (status === 429) setNotice({tone: 'warning', text: t('tooManyAttempts')});
      else setNotice({tone: 'error', text: errorMessage(error)});
    }
  }

  const emailError = emailTaken ? (
    <>
      {t('register.emailTaken')}{' '}
      <Link href="/login" className="font-semibold underline">
        {t('register.toLogin')}
      </Link>
    </>
  ) : (
    invalid.has('email') && t('errors.email')
  );

  return (
    <AuthShell title={t('register.title')} subtitle={t('register.subtitle')} aside={<RegisterAside />}>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
        <FormField label={t('fields.displayName')} error={invalid.has('displayName') && t('errors.displayName')}>
          {({id, describedBy, invalid: bad}) => (
            <Input
              id={id}
              name="displayName"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              maxLength={80}
              aria-invalid={bad}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
        <FormField label={t('fields.email')} error={emailError}>
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
          hint={t('register.passwordHint')}
          error={invalid.has('password') && t('errors.password')}
        >
          {({id, describedBy, invalid: bad}) => (
            <>
              <PasswordInput
                id={id}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                aria-invalid={bad}
                aria-describedby={describedBy}
              />
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3].map(level => (
                  <span
                    key={level}
                    className={cn('h-1 flex-1 rounded-full', strength >= level ? 'bg-success' : 'bg-muted')}
                  />
                ))}
              </div>
            </>
          )}
        </FormField>
        <FormField
          label={
            <>
              {t('fields.targetBand')} <span className="font-normal text-muted-foreground">{t('optional')}</span>
            </>
          }
          hint={t('register.bandHint')}
        >
          {({id, describedBy}) => (
            <select id={id} name="targetBand" defaultValue="" className={inputClass} aria-describedby={describedBy}>
              <option value="">{t('noBand')}</option>
              {BANDS.map(b => (
                <option key={b} value={b}>
                  {b.toFixed(1)}
                </option>
              ))}
            </select>
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
          {pending ? t('register.submitting') : t('register.submit')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('register.hasAccount')}{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('register.toLogin')}
        </Link>
      </p>
    </AuthShell>
  );
}

function RegisterAside() {
  const t = useTranslations('auth.register.aside');
  const items = [
    [Sparkles, 'ai'],
    [Layers, 'flashcard'],
    [Monitor, 'exam'],
  ] as const;
  return (
    <div className="flex w-full max-w-md flex-col gap-5">
      <p className="eyebrow text-muted-foreground">{t('title')}</p>
      {items.map(([Icon, id], i) => (
        <div key={id} className={cn('flex gap-4 rounded-[20px] bg-white/90 p-5 shadow-lift', i === 1 && 'ml-8')}>
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="font-semibold">{t(`${id}.title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`${id}.body`)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
