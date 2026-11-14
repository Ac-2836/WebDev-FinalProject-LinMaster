'use client';

import type {
  AttemptSummary,
  DueSummaryResponse,
  StatsActivityResponse,
  StatsOverviewResponse,
  VocabDocument,
} from '@linmaster/shared';
import {
  ArrowRight,
  BookOpenText,
  ClipboardCheck,
  ClipboardList,
  FilePlus,
  FileText,
  Flame,
  Layers,
  Library,
  Timer,
  Upload,
} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Link from 'next/link';
import type {ComponentType} from 'react';

import {cn} from 'cn';
import {buttonVariants} from '@/components/ui/button';

import {timeLeft, vnDay} from './home-logic';

export const card = 'rounded-[20px] border bg-card shadow-soft';

export interface HomeData {
  now: Date;
  overview: StatsOverviewResponse;
  activity: StatsActivityResponse;
  due: DueSummaryResponse;
  running: AttemptSummary | null;
  documents: Omit<VocabDocument, 'paragraphs'>[];
}

export type HomeWidget = {
  id: string;
  /** Columns taken in the three-column grid on large screens. */
  span: 1 | 2 | 3;
  /** Renders null when it has nothing to show (no test in progress). */
  Component: ComponentType<{data: HomeData}>;
};

const tile = 'inline-flex shrink-0 items-center justify-center rounded-xl bg-secondary text-primary';
const linkClass = 'text-sm font-semibold text-primary hover:underline';

function ContinueWidget({data: {running, now}}: {data: HomeData}) {
  const t = useTranslations('core.home.continue');
  if (!running) return null;
  const {minutes, used} = timeLeft(running, now);
  return (
    <section aria-labelledby="home-continue" className={cn(card, 'flex flex-col gap-4 border-primary/40 p-5')}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet text-white">
          <Timer className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t('eyebrow')}</p>
          <h2 id="home-continue" className="truncate text-xl font-bold">
            {running.testTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t('left', {minutes})}</p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={t('timeUsed')}
        aria-valuenow={Math.round(used * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary" style={{width: `${used * 100}%`}} />
      </div>
      <Link href={`/exam/${running.id}`} className={buttonVariants({className: 'h-11 w-full sm:w-fit'})}>
        {t('action')}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function StreakWidget({data: {overview, activity, now}}: {data: HomeData}) {
  const t = useTranslations('core.home.streak');
  const format = useFormatter();
  const active = new Set(activity.days.filter(d => d.total > 0).map(d => d.date));
  const week = Array.from({length: 7}, (_, i) => vnDay(now, i - 6));
  const label = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      timeZone: 'UTC',
    });
  return (
    <section aria-labelledby="home-streak" className={cn(card, 'flex flex-col gap-3 p-5')}>
      <h2 id="home-streak" className="text-sm font-semibold text-muted-foreground">
        {t('title')}
      </h2>
      <p className="flex items-center gap-2 text-4xl font-bold">
        <Flame className="size-8 text-orange-500" aria-hidden="true" />
        {overview.streak.current}
        <span className="text-base font-medium text-muted-foreground">
          {t('days', {count: overview.streak.current})}
        </span>
      </p>
      <ul className="flex gap-1.5" aria-label={t('week', {count: week.filter(d => active.has(d)).length})}>
        {week.map(d => (
          <li
            key={d}
            title={label(d)}
            className={cn('h-2 flex-1 rounded-full', active.has(d) ? 'bg-orange-500' : 'bg-muted')}
          >
            <span className="sr-only">
              {label(d)}: {active.has(d) ? t('active') : t('idle')}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{t('longest', {count: overview.streak.longest})}</p>
    </section>
  );
}

function DueWidget({data: {due}}: {data: HomeData}) {
  const t = useTranslations('core.home.due');
  return (
    <section aria-labelledby="home-due" className={cn(card, 'flex flex-col gap-4 p-5')}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-due" className="text-xl font-bold">
          {t('title')}
        </h2>
        <Link href="/flashcards" className={linkClass}>
          {t('all')}
        </Link>
      </div>
      {due.sets.length === 0 ? (
        <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{t('none')}</p>
      ) : (
        <ul className="divide-y">
          {due.sets.slice(0, 3).map(s => (
            <li key={s.setId} className="flex items-center gap-3 py-3">
              <span className={cn(tile, 'size-9')}>
                <Layers className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{t('count', {count: s.dueCount})}</p>
              </div>
              <Link
                href={`/flashcards/${s.setId}/study/learn`}
                aria-label={t('studySet', {title: s.title})}
                className={buttonVariants({variant: 'outline', size: 'sm'})}
              >
                {t('study')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ShortcutsWidget() {
  const t = useTranslations('core.home.shortcuts');
  const links = [
    {href: '/read', icon: FilePlus, label: t('read')},
    {href: '/tests/new', icon: Upload, label: t('upload')},
    {href: '/library', icon: Library, label: t('library')},
  ];
  return (
    <section aria-labelledby="home-shortcuts" className={cn(card, 'flex flex-col gap-2 p-5')}>
      <h2 id="home-shortcuts" className="text-sm font-semibold text-muted-foreground">
        {t('title')}
      </h2>
      {links.map(({href, icon: Icon, label}) => (
        <Link
          key={href}
          href={href}
          className={buttonVariants({variant: 'secondary', className: 'h-11 justify-start'})}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </section>
  );
}

const SOURCE_ICON = {paste: ClipboardList, file: FileText, exam: ClipboardCheck};

function RecentWidget({data: {documents}}: {data: HomeData}) {
  const t = useTranslations('core.home.recent');
  const source = useTranslations('vocab.documents.source');
  return (
    <section aria-labelledby="home-recent" className={cn(card, 'flex flex-col gap-4 p-5')}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-recent" className="text-xl font-bold">
          {t('title')}
        </h2>
        <Link href="/read" className={linkClass}>
          {t('all')}
        </Link>
      </div>
      {documents.length === 0 ? (
        <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{t('none')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {documents.slice(0, 3).map(d => {
            const Icon = SOURCE_ICON[d.source];
            return (
              <li key={d.id} className="min-w-0">
                <Link
                  href={`/read/${d.id}`}
                  className="flex h-full items-start gap-3 rounded-xl border p-4 outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  <span className={cn(tile, 'size-9')}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{d.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {source(d.source)} · {t('words', {count: d.wordCount})}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Home widget registry (PLAN B4, C7). A widget is added here instead of editing the page; order is display order.
 */
export const homeWidgets: HomeWidget[] = [
  {id: 'continue', span: 2, Component: ContinueWidget},
  {id: 'streak', span: 1, Component: StreakWidget},
  {id: 'due', span: 2, Component: DueWidget},
  {id: 'shortcuts', span: 1, Component: ShortcutsWidget},
  {id: 'recent', span: 3, Component: RecentWidget},
];

/** First steps for a new account, shown instead of the widgets. */
export const ONBOARDING = [
  {id: 'read', href: '/read', icon: BookOpenText},
  {id: 'upload', href: '/tests/new', icon: Upload},
  {id: 'library', href: '/library', icon: Library},
] as const;
