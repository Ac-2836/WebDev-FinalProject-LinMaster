'use client';

import {AuthUserResponseSchema, UpdateProfileRequestSchema, type AuthPublicUser} from '@linmaster/shared';
import {CircleCheck, CloudOff, LoaderCircle, LogOut, RotateCw} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';

import {cn} from 'cn';
import {Button} from '@/components/ui/button';
import {Input, inputClass} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';
import {useSession} from '@/core/auth/session-provider';
import {setLocale} from '@/core/i18n/actions';
import {locales} from '@/core/i18n/config';
import {initials} from '@/core/nav/account-menu';

import {Notice} from './auth-shell';
import {BANDS, FormField, invalidFields} from './form-field';

const card = 'flex flex-col gap-5 rounded-[20px] border bg-card p-6 shadow-soft';

/** `/profile` (C1, wireframe 02-app/profile): data from `GET/PATCH /auth/me`. */
export function ProfilePage() {
  const t = useTranslations('auth.profile');
  const {status, user, reload} = useSession();

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow text-muted-foreground">{t('eyebrow')}</p>
      <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">{t('title')}</h1>
      <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      {status === 'ready' && user ? (
        <ProfileForm key={user.id} user={user} />
      ) : status === 'error' ? (
        <div role="alert" className={cn(card, 'mt-6 items-center p-8 text-center')}>
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
            <CloudOff className="size-6" aria-hidden="true" />
          </span>
          <p className="font-bold">{t('loadError')}</p>
          <Button variant="outline" className="h-10 rounded-full" onClick={reload}>
            <RotateCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      ) : (
        <div className={cn(card, 'mt-6')} aria-busy="true" aria-label={t('loading')}>
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      )}
    </div>
  );
}

function ProfileForm({user}: {user: AuthPublicUser}) {
  const t = useTranslations('auth');
  const tLocale = useTranslations('core.localeSwitcher');
  const format = useFormatter();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const {setUser, signOut} = useSession();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [locale, setLocaleChoice] = useState(user.locale);
  const [band, setBand] = useState(user.targetBand === null ? '' : String(user.targetBand));
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The navbar language toggle also saves the locale; keep the radio in step with it.
  useEffect(() => setLocaleChoice(user.locale), [user.locale]);

  const targetBand = band ? Number(band) : null;
  const changes = {
    ...(displayName.trim() !== user.displayName && {displayName}),
    ...(locale !== user.locale && {locale}),
    ...(targetBand !== user.targetBand && {targetBand}),
  };
  const dirty = Object.keys(changes).length > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = UpdateProfileRequestSchema.safeParse(changes);
    if (!parsed.success) {
      setNameInvalid(invalidFields(parsed.error.issues).has('displayName'));
      return;
    }
    setNameInvalid(false);
    setError(null);
    setPending(true);
    try {
      const next = AuthUserResponseSchema.parse(await api('/auth/me', {method: 'PATCH', body: parsed.data})).user;
      setUser(next);
      setDisplayName(next.displayName);
      setSaved(true);
      if (next.locale !== user.locale) {
        await setLocale(next.locale);
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-6 flex flex-col gap-6" noValidate onSubmit={onSubmit} onChange={() => setSaved(false)}>
      {error && <Notice tone="error">{error}</Notice>}
      <section className={card}>
        <div className="flex items-center gap-4">
          <span
            className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-secondary text-xl font-bold text-primary"
            aria-hidden="true"
          >
            {initials(user.displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.displayName}</p>
            <p className="text-[13px] text-muted-foreground">
              {t('profile.memberSince', {
                date: format.dateTime(new Date(user.createdAt), {day: '2-digit', month: '2-digit', year: 'numeric'}),
              })}
            </p>
          </div>
        </div>
        <FormField label={t('fields.displayName')} error={nameInvalid && t('errors.displayName')}>
          {({id, describedBy, invalid}) => (
            <Input
              id={id}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={80}
              autoComplete="name"
              aria-invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
        <FormField label={t('fields.email')} hint={t('profile.emailFixed')}>
          {({id, describedBy}) => <Input id={id} value={user.email} readOnly aria-describedby={describedBy} />}
        </FormField>
      </section>

      <section className={card} aria-labelledby="profile-prefs">
        <h2 id="profile-prefs" className="text-lg font-semibold">
          {t('profile.preferences')}
        </h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">{t('fields.locale')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {locales.map(value => (
              <label
                key={value}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 has-focus-visible:ring-[3px] has-focus-visible:ring-ring',
                  locale === value ? 'border-2 border-primary bg-secondary' : 'hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="locale"
                  value={value}
                  checked={locale === value}
                  onChange={() => setLocaleChoice(value)}
                  className="size-4 accent-primary"
                />
                <span className="text-sm font-semibold">{tLocale(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:max-w-48">
          <FormField label={t('fields.targetBand')} hint={t('profile.bandHint')}>
            {({id, describedBy}) => (
              <select
                id={id}
                value={band}
                onChange={e => setBand(e.target.value)}
                className={inputClass}
                aria-describedby={describedBy}
              >
                <option value="">{t('noBand')}</option>
                {BANDS.map(b => (
                  <option key={b} value={String(b)}>
                    {b.toFixed(1)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
      </section>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={signOut}
          className="h-11 rounded-full text-destructive hover:bg-danger-soft hover:text-destructive sm:mr-auto"
        >
          <LogOut aria-hidden="true" />
          {t('profile.logout')}
        </Button>
        <p role="status" className="flex items-center justify-center gap-1.5 text-sm text-success">
          {saved && (
            <>
              <CircleCheck className="size-4" aria-hidden="true" />
              {t('profile.saved')}
            </>
          )}
        </p>
        <Button type="submit" className="h-11 rounded-full px-6" disabled={!dirty || pending} aria-busy={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {t('profile.save')}
        </Button>
      </div>
    </form>
  );
}
