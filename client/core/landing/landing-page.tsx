import {
  BookmarkPlus,
  BookOpenText,
  Brain,
  ChartLine,
  Clock,
  Filter,
  Flame,
  Highlighter,
  Layers,
  Mail,
  Monitor,
  MousePointerClick,
  NotebookPen,
  PencilRuler,
  Puzzle,
  Sparkles,
  Upload,
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';

import {cn} from 'cn';
import {Logo} from '@/components/logo';
import {Button} from '@/components/ui/button';

import {FeatureList} from './feature-list';
import {LandingHeader} from './landing-header';

const STEPS = ['read', 'lookup', 'review', 'exam'] as const;
const RATINGS = [
  ['again', 'bg-danger-soft text-destructive'],
  ['hard', 'bg-warning-soft text-warning'],
  ['good', 'bg-success-soft text-success'],
  ['easy', 'bg-secondary text-primary'],
] as const;

// Same deterministic pattern as the wireframe so the decorative heatmap never changes between renders.
const HEATMAP = (() => {
  let s = 3;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({length: 7 * 26}, (_, i) => (i > 110 ? r() * 0.9 + 0.1 : r() > 0.6 ? r() * 0.5 : 0.08));
})();

const badge = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold';
const sectionGrid =
  'mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-20 sm:px-6 sm:pb-28 lg:grid-cols-2 lg:gap-16';
const h2 = 'mt-4 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[40px] sm:leading-[1.1]';

/** Public landing page `/` (P1-12, wireframe 01-public/landing). Product visuals are decorative. */
export function LandingPage() {
  const t = useTranslations('core.landing');
  const feature = (section: string, icons: (typeof Upload)[]) =>
    icons.map((icon, i) => ({
      icon,
      title: t(`${section}.items.${i}.title`),
      body: t(`${section}.items.${i}.body`),
    }));

  return (
    <div className="bg-white">
      <LandingHeader />

      <main id="main">
        {/* Hero */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-14 text-center sm:px-6 sm:pt-20">
          <p className="eyebrow text-muted-foreground">{t('hero.eyebrow')}</p>
          <h1 className="mt-4 max-w-4xl text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[60px]">
            {t.rich('hero.title', {
              hl: chunks => (
                <span className="bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent">{chunks}</span>
              ),
            })}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{t('hero.body')}</p>
          <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full bg-foreground px-7 text-base hover:bg-foreground/90">
              <Link href="/register">
                <Mail aria-hidden="true" />
                {t('hero.register')}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-7 text-base">
              <Link href="/login">{t('hero.login')}</Link>
            </Button>
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">{t('hero.note')}</p>

          <div
            className="relative mt-12 w-full overflow-hidden rounded-[28px] p-4 glow-strong sm:mt-16 sm:p-10"
            aria-hidden="true"
          >
            <div className="mx-auto grid max-w-4xl gap-4 text-left md:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[20px] bg-white/90 p-5 shadow-lift backdrop-blur sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-xl bg-secondary text-primary">
                    <BookOpenText className="size-4" />
                  </span>
                  <p className="text-sm font-semibold">Rising seas and coastal cities</p>
                </div>
                <p className="font-serif text-[16px] leading-8 sm:text-[17px]">
                  Governments are under pressure to{' '}
                  <span className="rounded bg-primary/10 px-0.5 ring-2 ring-primary">mitigate</span> the effects of
                  rising sea levels, yet funding for coastal <mark>infrastructure</mark> remains limited.
                </p>
                <div className="mt-4 rounded-2xl border bg-white p-4 shadow-soft">
                  <div className="flex items-baseline gap-2">
                    <p className="font-bold">mitigate</p>
                    <p className="text-[13px] text-muted-foreground">/ˈmɪt.ɪ.ɡeɪt/ · verb</p>
                    <span className={cn(badge, 'ml-auto bg-secondary text-primary')}>C1</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold">giảm nhẹ, làm dịu (tác động xấu)</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={cn(badge, 'bg-muted text-muted-foreground')}>mitigate the effects</span>
                    <span className={cn(badge, 'bg-muted text-muted-foreground')}>mitigate risks</span>
                  </div>
                  <span className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-[13px] font-semibold text-white">
                    <BookmarkPlus className="size-4" />
                    {t('demo.save')}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-[20px] bg-white/90 p-5 shadow-lift">
                  <p className="eyebrow text-muted-foreground">{t('demo.today')}</p>
                  <p className="mt-3 text-center text-2xl font-semibold tracking-tight">managed retreat</p>
                  <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[11px] font-semibold">
                    {RATINGS.map(([id, tone]) => (
                      <span key={id} className={cn('rounded-xl py-2', tone)}>
                        {t(`demo.${id}`)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-[20px] bg-white/90 p-5 shadow-lift">
                  <div className="flex size-14 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet text-white">
                    <span className="text-xl leading-none font-bold">7.0</span>
                    <span className="text-[10px]">band</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Reading · Practice Test 3</p>
                    <p className="text-[13px] text-muted-foreground">{t('demo.correct', {n: 31, total: 40})}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Learning loop */}
        <section id="loop" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="eyebrow text-muted-foreground">{t('loop.eyebrow')}</p>
          <h2 className={cn(h2, 'mx-auto mt-3 max-w-2xl sm:text-[44px]')}>{t('loop.title')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t('loop.body')}</p>
          <Button asChild className="mt-7 h-10 rounded-full px-5">
            <Link href="/register">{t('loop.cta')}</Link>
          </Button>
          <ol className="mt-12 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((id, i) => (
              <li
                key={id}
                className={cn(
                  'flex min-h-60 flex-col gap-2 rounded-[20px] p-6',
                  id === 'review' ? 'shadow-lift glow-strong' : 'border bg-card shadow-soft',
                )}
              >
                <span className="eyebrow text-primary">
                  {String(i + 1).padStart(2, '0')} · {t(`loop.steps.${id}.tag`)}
                </span>
                <p className="text-lg font-semibold">{t(`loop.steps.${id}.title`)}</p>
                <p className="text-sm text-muted-foreground">{t(`loop.steps.${id}.body`)}</p>
                {id === 'review' && (
                  <p className="mt-auto rounded-2xl bg-white/90 p-3 text-center text-sm font-semibold shadow-soft">
                    {t('loop.due', {n: 18})}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* Reader */}
        <section id="reader" className={cn(sectionGrid, 'scroll-mt-20')}>
          <div>
            <span className={cn(badge, 'bg-secondary text-primary')}>
              <Sparkles className="size-3" aria-hidden="true" />
              {t('reader.badge')}
            </span>
            <h2 className={h2}>{t('reader.title')}</h2>
            <FeatureList items={feature('reader', [MousePointerClick, Filter, NotebookPen])} />
          </div>
          <div className="rounded-[28px] p-6 glow sm:p-10" aria-hidden="true">
            <div className="rounded-[20px] bg-white p-5 shadow-lift">
              <p className="eyebrow text-muted-foreground">{t('demo.scan')}</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {[
                  ['relentless', 'dai dẳng', 'C1', true],
                  ['vulnerable', 'dễ tổn thương', 'B2', true],
                  ['erosion', 'sự xói mòn', 'C1', false],
                ].map(([word, meaning, level, checked]) => (
                  <li key={String(word)} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className={cn('size-4 shrink-0 rounded-md', checked ? 'bg-primary' : 'border-2')} />
                    <strong>{word}</strong>
                    <span className="truncate text-muted-foreground">{meaning}</span>
                    <span className={cn(badge, 'ml-auto bg-secondary text-primary')}>{level}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-4 flex h-8 w-full items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">
                {t('demo.saveSelected', {n: 2})}
              </span>
            </div>
          </div>
        </section>

        {/* Flashcard (mirrored) */}
        <section id="flashcard" className={cn(sectionGrid, 'scroll-mt-20')}>
          <div className="rounded-[28px] p-6 glow sm:p-10" aria-hidden="true">
            <div className="relative mx-auto max-w-sm">
              <div className="absolute inset-x-6 -top-3 h-full -rotate-4 rounded-[20px] bg-white/70 shadow-soft" />
              <div className="relative flex min-h-56 flex-col items-center justify-center gap-2 rounded-[20px] bg-white p-6 text-center shadow-lift">
                <span className={cn(badge, 'bg-warning-soft text-warning')}>{t('demo.learning')}</span>
                <p className="text-3xl font-semibold tracking-tight">exacerbate</p>
                <p className="text-[13px] text-muted-foreground">{t('demo.flipHint')}</p>
              </div>
            </div>
          </div>
          <div>
            <span className={cn(badge, 'bg-secondary text-primary')}>
              <Layers className="size-3" aria-hidden="true" />
              {t('flashcard.badge')}
            </span>
            <h2 className={h2}>{t('flashcard.title')}</h2>
            <FeatureList items={feature('flashcard', [Brain, PencilRuler, Puzzle])} />
          </div>
        </section>

        {/* Exam */}
        <section id="exam" className={cn(sectionGrid, 'scroll-mt-20')}>
          <div>
            <span className={cn(badge, 'bg-secondary text-primary')}>
              <Monitor className="size-3" aria-hidden="true" />
              {t('exam.badge')}
            </span>
            <h2 className={h2}>{t('exam.title')}</h2>
            <FeatureList items={feature('exam', [Upload, Highlighter, ChartLine])} />
          </div>
          {/* The exam room is English-only (like the real CBT), so this visual is not translated. */}
          <div className="rounded-[28px] p-6 glow sm:p-10" aria-hidden="true">
            <div className="overflow-hidden rounded-[20px] bg-white shadow-lift">
              <div className="flex items-center justify-between border-b px-4 py-2.5 text-xs font-semibold">
                <span>Part 2</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  38 minutes left
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x text-[12px]">
                <p className="p-4 font-serif leading-6">
                  The invention of the <mark>blowpipe</mark> transformed the industry…
                </p>
                <div className="flex flex-col gap-1.5 p-4">
                  <span className="font-semibold">19</span>
                  <span>◉ TRUE</span>
                  <span>○ FALSE</span>
                  <span className="text-muted-foreground line-through">○ NOT GIVEN</span>
                </div>
              </div>
              <div className="flex gap-1 border-t px-3 py-2">
                {Array.from({length: 9}, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'inline-flex size-6 items-center justify-center rounded text-[10px] font-semibold',
                      i === 3
                        ? 'bg-primary text-white'
                        : i < 3
                          ? 'bg-muted underline'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {i + 14}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard teaser */}
        <section className="text-white glow-dark">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="eyebrow text-white/70">{t('dashboard.eyebrow')}</p>
              <h2 className={cn(h2, 'mt-3 text-white')}>{t('dashboard.title')}</h2>
              <p className="mt-4 text-white/80">{t('dashboard.body')}</p>
            </div>
            <div className="rounded-[20px] bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur" aria-hidden="true">
              <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
                {HEATMAP.map((a, i) => (
                  <span
                    key={i}
                    className="aspect-square rounded-[2px]"
                    style={{background: `rgba(185,205,255,${a.toFixed(2)})`}}
                  />
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm">
                <Flame className="size-4 text-brand-yellow" />
                {t('dashboard.streak', {days: 7, count: 412})}
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
          <p className="eyebrow text-muted-foreground">{t('final.eyebrow')}</p>
          <h2 className={cn(h2, 'mx-auto mt-3 max-w-2xl sm:text-[44px]')}>{t('final.title')}</h2>
          <Button asChild size="lg" className="mt-8 h-12 rounded-full px-7 text-base">
            <Link href="/register">{t('final.cta')}</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo size={28} />
            <p className="max-w-xs text-sm text-muted-foreground">{t('footer.tagline')}</p>
          </div>
          <nav aria-label={t('footer.product')} className="flex flex-col text-sm">
            <p className="eyebrow mb-1 text-muted-foreground">{t('footer.product')}</p>
            {(['reader', 'flashcard', 'exam'] as const).map(id => (
              <a key={id} href={`#${id}`} className="py-3 hover:text-primary">
                {t(`nav.${id}`)}
              </a>
            ))}
          </nav>
          <nav aria-label={t('footer.account')} className="flex flex-col text-sm">
            <p className="eyebrow mb-1 text-muted-foreground">{t('footer.account')}</p>
            <Link href="/login" className="py-3 hover:text-primary">
              {t('login')}
            </Link>
            <Link href="/register" className="py-3 hover:text-primary">
              {t('footer.register')}
            </Link>
          </nav>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-1 border-t px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>{t('footer.copyright')}</p>
          <p className="sm:ml-auto">{t('footer.disclaimer')}</p>
        </div>
      </footer>
    </div>
  );
}
