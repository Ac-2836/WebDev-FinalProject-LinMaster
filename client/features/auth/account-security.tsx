'use client';

import {AuthUserResponseSchema, ChangeEmailRequestSchema, ChangePasswordRequestSchema} from '@linmaster/shared';
import {CircleCheck, LoaderCircle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useState} from 'react';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {api, ApiError} from '@/core/api/client';
import {useErrorMessage} from '@/core/api/use-error-message';
import {useSession} from '@/core/auth/session-provider';

import {Notice} from './auth-shell';
import {FormField, invalidFields} from './form-field';
import {PasswordInput} from './password-input';

const card = 'flex flex-col gap-5 rounded-[20px] border bg-card p-6 shadow-soft';

type Field = 'email' | 'currentPassword' | 'newPassword';

/**
 * Shared state of the two security forms. A wrong current password is a 403 `WRONG_PASSWORD`, not a 401, so the user
 * stays signed in and the error goes under that field; a taken email (409) goes under the email field.
 */
function useSecurityForm() {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [notice, setNotice] = useState<{tone: 'error' | 'warning'; text: string} | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run(form: HTMLFormElement, invalid: Partial<Record<Field, string>>, send: () => Promise<string>) {
    setDone(null);
    setNotice(null);
    setErrors(invalid);
    const first = Object.keys(invalid)[0];
    if (first) {
      form.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setPending(true);
    try {
      setDone(await send());
      form.reset();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : '';
      const http = err instanceof ApiError ? err.httpStatus : 0;
      if (status === 'WRONG_PASSWORD') {
        setErrors({currentPassword: t('errors.wrongPassword')});
        form.querySelector<HTMLInputElement>('[name="currentPassword"]')?.focus();
      } else if (http === 409) {
        setErrors({email: t('errors.emailTaken')});
        form.querySelector<HTMLInputElement>('[name="email"]')?.focus();
      } else if (http === 429) setNotice({tone: 'warning', text: t('tooManyAttempts')});
      else setNotice({tone: 'error', text: errorMessage(err)});
    } finally {
      setPending(false);
    }
  }

  return {pending, errors, notice, done, run};
}

function Status({form}: {form: ReturnType<typeof useSecurityForm>}) {
  return (
    <>
      {form.notice && <Notice tone={form.notice.tone}>{form.notice.text}</Notice>}
      <p role="status" className="flex items-center gap-1.5 text-sm text-success empty:hidden">
        {form.done && (
          <>
            <CircleCheck className="size-4" aria-hidden="true" />
            {form.done}
          </>
        )}
      </p>
    </>
  );
}

function CurrentPassword({form, email}: {form: ReturnType<typeof useSecurityForm>; email: string}) {
  const t = useTranslations('auth');
  return (
    <>
      {/* For password managers: the account these passwords belong to. Without it Chrome fills the saved login
          email into "New email", the last text field before the password. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <FormField label={t('security.currentPassword')} error={form.errors.currentPassword}>
        {({id, describedBy, invalid}) => (
          <PasswordInput
            id={id}
            name="currentPassword"
            autoComplete="current-password"
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        )}
      </FormField>
    </>
  );
}

/** `PATCH /auth/me/email` and `PATCH /auth/me/password` (UX-2), under the profile. */
export function AccountSecurity() {
  const t = useTranslations('auth');
  const {user, setUser} = useSession();
  const emailForm = useSecurityForm();
  const passwordForm = useSecurityForm();

  function onEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = ChangeEmailRequestSchema.safeParse({
      email: data.get('email'),
      currentPassword: data.get('currentPassword'),
    });
    const bad = parsed.success ? new Set<string>() : invalidFields(parsed.error.issues);
    void emailForm.run(
      event.currentTarget,
      {
        ...(bad.has('email') && {email: t('errors.email')}),
        ...(bad.has('currentPassword') && {currentPassword: t('errors.currentPassword')}),
      },
      async () => {
        const next = AuthUserResponseSchema.parse(await api('/auth/me/email', {method: 'PATCH', body: parsed.data}));
        setUser(next.user);
        return t('security.emailDone', {email: next.user.email});
      },
    );
  }

  function onPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = ChangePasswordRequestSchema.safeParse({
      currentPassword: data.get('currentPassword'),
      newPassword: data.get('newPassword'),
    });
    const bad = parsed.success ? new Set<string>() : invalidFields(parsed.error.issues);
    void passwordForm.run(
      event.currentTarget,
      {
        ...(bad.has('currentPassword') && {currentPassword: t('errors.currentPassword')}),
        ...(bad.has('newPassword') && {newPassword: t('errors.password')}),
      },
      async () => {
        await api('/auth/me/password', {method: 'PATCH', body: parsed.data});
        return t('security.passwordDone');
      },
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="profile-security">
      <h2 id="profile-security" className="text-lg font-semibold">
        {t('security.title')}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <form className={card} noValidate onSubmit={onEmail} aria-labelledby="security-email">
          <div>
            <h3 id="security-email" className="font-semibold">
              {t('security.emailTitle')}
            </h3>
            <p className="text-[13px] text-muted-foreground">{t('security.emailNow', {email: user?.email ?? ''})}</p>
          </div>
          <FormField label={t('security.newEmail')} error={emailForm.errors.email}>
            {({id, describedBy, invalid}) => (
              <Input
                id={id}
                name="email"
                type="email"
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
          <CurrentPassword form={emailForm} email={user?.email ?? ''} />
          <Status form={emailForm} />
          <Button
            type="submit"
            variant="outline"
            className="mt-auto h-11 rounded-full"
            disabled={emailForm.pending}
            aria-busy={emailForm.pending}
          >
            {emailForm.pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {t('security.emailSubmit')}
          </Button>
        </form>

        <form className={card} noValidate onSubmit={onPassword} aria-labelledby="security-password">
          <div>
            <h3 id="security-password" className="font-semibold">
              {t('security.passwordTitle')}
            </h3>
            <p className="text-[13px] text-muted-foreground">{t('security.passwordHint')}</p>
          </div>
          <CurrentPassword form={passwordForm} email={user?.email ?? ''} />
          <FormField label={t('security.newPassword')} error={passwordForm.errors.newPassword}>
            {({id, describedBy, invalid}) => (
              <PasswordInput
                id={id}
                name="newPassword"
                autoComplete="new-password"
                aria-invalid={invalid}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
          <Status form={passwordForm} />
          <Button
            type="submit"
            variant="outline"
            className="mt-auto h-11 rounded-full"
            disabled={passwordForm.pending}
            aria-busy={passwordForm.pending}
          >
            {passwordForm.pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {t('security.passwordSubmit')}
          </Button>
        </form>
      </div>
    </section>
  );
}
