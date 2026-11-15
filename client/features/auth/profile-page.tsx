'use client';

import {
  AuthUserResponseSchema,
  StatsOverviewResponseSchema,
  UpdateProfileRequestSchema,
  type AuthPublicUser,
  type StatsOverviewResponse,
} from '@linmaster/shared';
import {
  BookMarked,
  CircleCheck,
  ClipboardCheck,
  CloudOff,
  Flame,
  Layers,
  LoaderCircle,
  LogOut,
  RotateCw,
} from 'lucide-react';
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

import {AccountSecurity} from './account-security';
import {Notice} from './auth-shell';
import {BANDS, FormField, invalidFields} from './form-field';

const card = 'flex flex-col gap-5 rounded-[20px] border bg-card p-6 shadow-soft';

/** `/profile` (C1, wireframe 02-app/profile): data from `GET/PATCH /auth/me`. */
export function ProfilePage() {
  const t = useTranslations('auth.profile');
  const {status, user, reload} = useSession();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">{t('title')}</h1>
      {status === 'ready' && user ? (
        <div className="flex flex-col gap-6">
          <ProfileHeader user={user} />
          <ProfileForm key={user.id} user={user} />
          <AccountSecurity />
          <SignOut />
        </div>
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
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const {setUser} = useSession();
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
    <form className="flex flex-col gap-6" noValidate onSubmit={onSubmit} onChange={() => setSaved(false)}>
      {error && <Notice tone="error">{error}</Notice>}
      <section className={card} aria-labelledby="profile-info">
        <h2 id="profile-info" className="text-lg font-semibold">
          {t('profile.info')}
        </h2>
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

/** Top of the profile (UX-2): who you are, since when, and a few numbers from `GET /stats/overview`. */
function ProfileHeader({user}: {user: AuthPublicUser}) {
  const t = useTranslations('auth.profile');
  const format = useFormatter();
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api('/stats/overview')
      .then(res => setStats(StatsOverviewResponseSchema.parse(res)))
      // The numbers are extra; the profile still works without them.
      .catch(() => setFailed(true));
  }, []);

  const tiles = stats && [
    {icon: Flame, value: stats.streak.current, label: t('stats.streak'), tone: 'text-orange-500'},
    {icon: BookMarked, value: stats.words, label: t('stats.words'), tone: 'text-primary'},
    {icon: Layers, value: stats.cardsReviewed, label: t('stats.cards'), tone: 'text-violet'},
    {icon: ClipboardCheck, value: stats.testsTaken, label: t('stats.tests'), tone: 'text-success'},
  ];

  return (
    <section className="glow overflow-hidden rounded-[28px] border px-6 py-7 sm:px-8" aria-labelledby="profile-name">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <span
          className="inline-flex size-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet text-2xl font-bold text-white shadow-lift"
          aria-hidden="true"
        >
          {initials(user.displayName)}
        </span>
        <div className="min-w-0 max-w-full">
          <p className="eyebrow text-muted-foreground">{t('eyebrow')}</p>
          <h2 id="profile-name" className="truncate text-2xl font-bold sm:text-3xl">
            {user.displayName}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-[13px] text-muted-foreground">
            {t('memberSince', {
              date: format.dateTime(new Date(user.createdAt), {day: '2-digit', month: '2-digit', year: 'numeric'}),
            })}
          </p>
        </div>
      </div>
      {!failed && (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy={!stats}>
          {tiles
            ? tiles.map(({icon: Icon, value, label, tone}) => (
                <div key={label} className="flex flex-col-reverse gap-1 rounded-2xl bg-white/80 p-4 shadow-soft">
                  <dt className="text-[13px] text-muted-foreground">{label}</dt>
                  <dd className="flex items-center gap-2 text-2xl font-bold">
                    <Icon className={cn('size-5', tone)} aria-hidden="true" />
                    {format.number(value)}
                  </dd>
                </div>
              ))
            : Array.from({length: 4}, (_, i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}
        </dl>
      )}
    </section>
  );
}

function SignOut() {
  const t = useTranslations('auth.profile');
  const {signOut} = useSession();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={signOut}
      className="h-11 self-start rounded-full text-destructive hover:bg-danger-soft hover:text-destructive"
    >
      <LogOut aria-hidden="true" />
      {t('logout')}
    </Button>
  );
}
