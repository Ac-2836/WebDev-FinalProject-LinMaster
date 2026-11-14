'use client';

import {useFormatter, useTranslations} from 'next-intl';

import {initials} from '@/core/nav/account-menu';
import {useSession} from '@/core/auth/session-provider';

import {dashboardWidgets} from './registry';

/** `/dashboard` (wireframe 07-stats/dashboard): the learner's own progress, one widget per stats endpoint. */
export function DashboardPage() {
  const t = useTranslations('stats.dashboard');
  const format = useFormatter();
  const {user} = useSession();
  const of = (place: string) => dashboardWidgets.filter(w => w.place === place);
  const side = of('side');

  return (
    <div className="flex flex-col gap-5">
      <header className="glow flex flex-wrap items-center gap-5 rounded-[28px] px-6 py-8 sm:px-10">
        <span
          aria-hidden="true"
          className="inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet text-2xl font-bold text-white ring-4 ring-white"
        >
          {initials(user?.displayName ?? '')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="mt-1 text-3xl font-bold">{user?.displayName}</h1>
          {user && (
            <p className="text-foreground/75">
              {t('since', {date: format.dateTime(new Date(user.createdAt), {dateStyle: 'short'})})}
              {user.targetBand !== null && ` · ${t('target', {band: user.targetBand.toFixed(1)})}`}
            </p>
          )}
        </div>
      </header>
      {of('wide').map(({id, Component}) => (
        <Component key={id} />
      ))}
      <div className="grid gap-5 lg:grid-cols-2">
        {of('main').map(({id, Component}) => (
          <Component key={id} />
        ))}
        {side.length > 0 && (
          <div className="flex min-w-0 flex-col gap-5">
            {side.map(({id, Component}) => (
              <Component key={id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
