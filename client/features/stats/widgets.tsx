'use client';

import {
  StatsActivityResponseSchema,
  StatsBandsResponseSchema,
  StatsOverviewResponseSchema,
  StatsVocabResponseSchema,
  StatsWeaknessesResponseSchema,
} from '@linmaster/shared';
import {Flame, Target} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';

import {cn} from 'cn';

import {bandChange, bandRange, busiestDay, calendarCells, type BandSkill} from './stats-logic';
import {DataTable, useStat, Widget, WidgetEmpty} from './widget';

const LEVEL = ['bg-muted', 'bg-primary/25', 'bg-primary/50', 'bg-primary/75', 'bg-primary'];
const band = (b: number | null) => (b === null ? '–' : b.toFixed(1));
/** Dates from the server are Vietnam days (`YYYY-MM-DD`); read them as UTC so no time zone shifts them. */
const day = (date: string) => new Date(`${date}T00:00:00Z`);

function useDay() {
  const format = useFormatter();
  return (date: string) => format.dateTime(day(date), {day: 'numeric', month: 'numeric', timeZone: 'UTC'});
}

export function ActivityWidget() {
  const t = useTranslations('stats.dashboard.activity');
  const showDay = useDay();
  const stat = useStat('/stats/activity', StatsActivityResponseSchema);
  const total = stat.data?.days.reduce((n, d) => n + d.total, 0) ?? 0;

  return (
    <Widget
      title={total ? t('title', {count: total}) : t('heading')}
      stat={stat}
      isEmpty={d => d.days.length === 0}
      empty={<WidgetEmpty title={t('empty')} href="/read" action={t('emptyAction')} />}
      aside={({streak}) => (
        <p className="flex items-center gap-1.5 text-sm">
          <Flame className="size-4 text-orange-500" aria-hidden="true" />
          {t.rich('streak', {current: streak.current, longest: streak.longest, b: s => <strong>{s}</strong>})}
        </p>
      )}
    >
      {({from, to, days}) => {
        const busiest = busiestDay(days)!;
        return (
          <>
            {/* Starts scrolled to today on narrow screens; focusable so the keyboard can scroll it. */}
            <div
              ref={el => {
                if (el) el.scrollLeft = el.scrollWidth;
              }}
              tabIndex={0}
              role="img"
              aria-label={t('label', {date: showDay(busiest.date), count: busiest.total})}
              className="overflow-x-auto rounded focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
                {calendarCells(from, to, days).map((c, i) => (
                  <span
                    key={c?.date ?? `pad${i}`}
                    title={c ? `${showDay(c.date)}: ${c.total}` : undefined}
                    className={cn('size-[11px] rounded-[2px]', c ? LEVEL[c.level] : 'invisible')}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-muted-foreground">
              <DataTable
                caption={t('tableCaption')}
                head={[t('date'), t('lookups'), t('saved'), t('reviews'), t('attempts')]}
                rows={days.toReversed().map(d => [showDay(d.date), d.lookups, d.savedWords, d.reviews, d.attempts])}
              />
              <span className="flex items-center gap-1" aria-hidden="true">
                {t('less')}
                {LEVEL.map(l => (
                  <span key={l} className={cn('size-[11px] rounded-[2px]', l)} />
                ))}
                {t('more')}
              </span>
            </div>
          </>
        );
      }}
    </Widget>
  );
}

export function OverviewWidget() {
  const t = useTranslations('stats.dashboard.overview');
  const stat = useStat('/stats/overview', StatsOverviewResponseSchema);
  return (
    <Widget
      title={t('title')}
      stat={stat}
      isEmpty={d => d.testsTaken === 0 && d.words === 0 && d.cardsReviewed === 0}
      empty={<WidgetEmpty title={t('empty')} href="/read" action={t('emptyAction')} />}
    >
      {d => {
        const hours = Math.floor(d.studyMinutes / 60);
        const tiles: [string, string, string?][] = [
          [t('tests'), String(d.testsTaken)],
          [t('reading'), band(d.bands.reading.latest), t('best', {band: band(d.bands.reading.best)})],
          [t('listening'), band(d.bands.listening.latest), t('best', {band: band(d.bands.listening.best)})],
          [t('words'), String(d.words), t('mastered', {count: d.masteredWords})],
          [t('cards'), String(d.cardsReviewed)],
          [t('time'), hours ? t('hours', {count: hours}) : t('minutes', {count: d.studyMinutes})],
        ];
        return (
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {tiles.map(([label, value, sub]) => (
              <div key={label} className="flex flex-col rounded-lg bg-muted/50 p-4">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="order-last mt-1 text-2xl font-bold">{value}</dd>
                {sub && <dd className="order-last text-xs text-muted-foreground">{sub}</dd>}
              </div>
            ))}
          </dl>
        );
      }}
    </Widget>
  );
}

const W = 400;
const H = 180;
const LEFT = 30;
const LINE: Record<BandSkill, string> = {reading: 'stroke-primary', listening: 'stroke-success'};
const DOT: Record<BandSkill, string> = {reading: 'fill-primary', listening: 'fill-success'};

export function BandsWidget() {
  const t = useTranslations('stats.dashboard.bands');
  const format = useFormatter();
  const stat = useStat('/stats/bands', StatsBandsResponseSchema);
  const key = (k: string, cls: string) => (
    <span className="flex items-center gap-1 text-xs">
      <span className={cn('w-4', cls)} />
      {t(k)}
    </span>
  );

  return (
    <Widget
      title={t('title')}
      stat={stat}
      isEmpty={d => d.points.length === 0}
      empty={<WidgetEmpty title={t('empty')} href="/tests" action={t('emptyAction')} />}
      aside={({targetBand}) => (
        <span className="flex gap-3">
          {key('reading', 'h-0.5 bg-primary')}
          {key('listening', 'h-0.5 bg-success')}
          {targetBand !== null && key('target', 'border-t-2 border-dashed border-warning')}
        </span>
      )}
    >
      {({points, targetBand}) => {
        const {lo, hi} = bandRange(points, targetBand);
        const y = (b: number) => 15 + ((hi - b) / (hi - lo)) * (H - 30);
        const x = (i: number) =>
          points.length === 1 ? (LEFT + W) / 2 : LEFT + 10 + (i / (points.length - 1)) * (W - LEFT - 20);
        const ticks = Array.from({length: hi - lo + 1}, (_, i) => hi - i);
        const change = (skill: BandSkill) => {
          const c = bandChange(points, skill);
          return c ? t('change', {skill: t(skill), first: band(c.first), last: band(c.last)}) : '';
        };
        const label = [
          t('label', {count: points.length}),
          change('reading'),
          change('listening'),
          targetBand !== null ? t('targetLabel', {band: band(targetBand)}) : '',
        ]
          .filter(Boolean)
          .join('; ');
        return (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
              {ticks.map(b => (
                <g key={b}>
                  <line x1={LEFT} x2={W - 10} y1={y(b)} y2={y(b)} className="stroke-border" />
                  <text x="0" y={y(b) + 4} className="fill-muted-foreground text-[10px]">
                    {b.toFixed(1)}
                  </text>
                </g>
              ))}
              {targetBand !== null && (
                <line
                  x1={LEFT}
                  x2={W - 10}
                  y1={y(targetBand)}
                  y2={y(targetBand)}
                  className="stroke-warning"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
              )}
              {(['reading', 'listening'] as const).map(skill => {
                const xy = points.flatMap((p, i) => (p[skill] === null ? [] : [[x(i), y(p[skill])] as const]));
                return (
                  <g key={skill}>
                    <polyline
                      points={xy.map(p => p.join(',')).join(' ')}
                      fill="none"
                      className={LINE[skill]}
                      strokeWidth="2.5"
                    />
                    {xy.map(([cx, cy]) => (
                      <circle key={cx} cx={cx} cy={cy} r="3.5" className={DOT[skill]} />
                    ))}
                  </g>
                );
              })}
            </svg>
            <DataTable
              caption={t('tableCaption')}
              head={[t('date'), t('test'), t('reading'), t('listening')]}
              rows={points.map(p => [
                format.dateTime(new Date(p.submittedAt), {dateStyle: 'short'}),
                p.testTitle,
                band(p.reading),
                band(p.listening),
              ])}
            />
          </>
        );
      }}
    </Widget>
  );
}

export function VocabWidget() {
  const t = useTranslations('stats.dashboard.vocab');
  const showDay = useDay();
  const stat = useStat('/stats/vocab', StatsVocabResponseSchema);

  return (
    <Widget
      title={t('title')}
      stat={stat}
      isEmpty={d => d.total === 0}
      empty={<WidgetEmpty title={t('empty')} href="/read" action={t('emptyAction')} />}
      aside={d => <span className="text-sm text-muted-foreground">{t('total', {count: d.total})}</span>}
    >
      {({weekly, states, total}) => {
        const max = Math.max(1, ...weekly.map(w => w.added));
        const parts = [
          ['new', 'bg-muted-foreground/30', ''],
          ['learning', 'bg-warning/70', 'text-warning'],
          ['mastered', 'bg-success', 'text-success'],
        ].map(([state, bar, text]) => ({
          state,
          bar,
          text,
          percent: Math.round(((states[state as keyof typeof states] ?? 0) / total) * 100),
        }));
        return (
          <>
            <p className="text-sm text-muted-foreground">{t('weekly')}</p>
            <div
              role="img"
              aria-label={t('weeklyLabel', {count: weekly.length, values: weekly.map(w => w.added).join(', ')})}
              className="flex h-32 items-end gap-1.5"
            >
              {weekly.map((w, i) => (
                <div key={w.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-muted-foreground">{w.added}</span>
                  <span
                    className={cn('w-full rounded-t', i === weekly.length - 1 ? 'bg-primary' : 'bg-primary/40')}
                    style={{height: `${(w.added / max) * 80}%`}}
                  />
                </div>
              ))}
            </div>
            <DataTable
              caption={t('tableCaption')}
              head={[t('week'), t('added')]}
              rows={weekly.map(w => [showDay(w.weekStart), w.added])}
            />
            <div
              role="img"
              aria-label={t('statesLabel', Object.fromEntries(parts.map(p => [p.state, p.percent])))}
              className="flex h-3 overflow-hidden rounded-full bg-muted"
            >
              {parts.map(p => (
                <span key={p.state} className={p.bar} style={{width: `${p.percent}%`}} />
              ))}
            </div>
            <p className="flex flex-wrap gap-4 text-xs" aria-hidden="true">
              {parts.map(p => (
                <span key={p.state} className={p.text}>
                  {t(p.state)} {p.percent}%
                </span>
              ))}
            </p>
          </>
        );
      }}
    </Widget>
  );
}

export function WeaknessesWidget() {
  const t = useTranslations('stats.dashboard.weaknesses');
  const kinds = useTranslations('exam.result.kinds');
  const stat = useStat('/stats/weaknesses', StatsWeaknessesResponseSchema);
  const skill = (s: string) => (s === 'reading' ? 'Reading' : 'Listening');

  return (
    <Widget
      title={t('title')}
      stat={stat}
      isEmpty={d => d.kinds.length === 0}
      empty={<WidgetEmpty title={t('empty')} href="/tests" action={t('emptyAction')} />}
    >
      {({kinds: list, weakest}) => {
        const worst = weakest && list.find(k => k.kind === weakest.kind && k.skill === weakest.skill);
        return (
          <>
            {worst && (
              <div className="flex gap-3 rounded-lg bg-danger-soft p-3 text-sm">
                <Target className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                <p>
                  {t.rich('weakest', {
                    kind: kinds(worst.kind),
                    skill: skill(worst.skill),
                    percent: Math.round(worst.accuracy * 100),
                    b: s => <strong>{s}</strong>,
                  })}{' '}
                  {t(`tips.${worst.kind}`)}
                </p>
              </div>
            )}
            <ul className="flex flex-col gap-2.5 text-sm">
              {list.map(k => {
                const percent = Math.round(k.accuracy * 100);
                return (
                  <li
                    key={`${k.skill}-${k.kind}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,13rem)_1fr_auto]"
                  >
                    <span>
                      {kinds(k.kind)} <span className="text-xs text-muted-foreground">· {skill(k.skill)}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="order-last col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1"
                    >
                      <span
                        className={cn(
                          'block h-full',
                          percent < 60 ? 'bg-destructive' : percent < 75 ? 'bg-warning' : 'bg-success',
                        )}
                        style={{width: `${percent}%`}}
                      />
                    </span>
                    <span className="text-right font-semibold">
                      {percent}%{' '}
                      <span className="sr-only">{t('answers', {correct: k.correct, answered: k.answered})}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        );
      }}
    </Widget>
  );
}

export function TopicsWidget() {
  const t = useTranslations('stats.dashboard.topics');
  const stat = useStat('/stats/vocab', StatsVocabResponseSchema);
  return (
    <Widget
      title={t('title')}
      stat={stat}
      isEmpty={d => d.topics.length === 0}
      empty={<p className="text-sm text-muted-foreground">{t('empty')}</p>}
    >
      {({topics}) => (
        <ul className="flex flex-wrap gap-2">
          {topics.map((tp, i) => (
            <li
              key={tp.topic}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-semibold',
                i < 2 ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {tp.topic} · {tp.words}
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
