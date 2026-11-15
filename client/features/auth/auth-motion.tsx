'use client';

import {useTranslations} from 'next-intl';
import {createPortal} from 'react-dom';

import {cn} from 'cn';
import {LogoMark} from '@/components/logo';

const WORDS = [
  ['mitigate', 'giảm nhẹ'],
  ['resilient', 'kiên cường'],
  ['ubiquitous', 'phổ biến khắp nơi'],
  ['coherent', 'mạch lạc'],
  ['scarcity', 'sự khan hiếm'],
  ['advocate', 'ủng hộ'],
  ['diminish', 'giảm bớt'],
  ['subsidy', 'trợ cấp'],
  ['emerge', 'xuất hiện'],
  ['sustain', 'duy trì'],
  ['inevitable', 'không thể tránh'],
  ['notion', 'khái niệm'],
];
/** Each column: its first word, how long one loop takes, and a start offset so columns do not move in step. */
const COLUMNS = [
  {start: 0, seconds: 46, delay: 0},
  {start: 3, seconds: 58, delay: -20},
  {start: 6, seconds: 40, delay: -9},
  {start: 9, seconds: 52, delay: -31},
];

/**
 * Background of /login and /register: columns of word cards drifting slowly up (UX-4). Decorative. Each column holds
 * its cards twice and moves up by half its height, so the loop has no seam. Still when the user asks for less motion.
 */
export function CardDrift({className}: {className?: string}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 flex justify-around overflow-hidden', className)}
    >
      {COLUMNS.map(({start, seconds, delay}) => {
        const cards = Array.from({length: 6}, (_, i) => WORDS[(start + i) % WORDS.length]);
        return (
          <div
            key={start}
            className="flex animate-card-drift flex-col gap-4 motion-reduce:animate-none"
            style={{animationDuration: `${seconds}s`, animationDelay: `${delay}s`}}
          >
            {[...cards, ...cards].map(([word, meaning], i) => (
              <div key={i} className="w-36 rounded-2xl border border-white/70 bg-white/55 px-4 py-3 shadow-soft">
                <p className="text-sm font-bold text-foreground/80">{word}</p>
                <p className="text-xs text-muted-foreground">{meaning}</p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export type BookPhase = 'closed' | 'open';

/**
 * Shown while logging in (UX-4): the logo flies to the middle, folds shut while the request runs (`closed`), and
 * opens again when it succeeds (`open`). The right half of the mark is the page that turns.
 */
export function BookLoader({phase}: {phase: BookPhase}) {
  const t = useTranslations('auth.login');
  const half = 'absolute inset-0 [backface-visibility:hidden]';
  // Portaled to <body>: the auth shell's columns are separate stacking contexts that would cover it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-page-in items-center justify-center bg-white/80 backdrop-blur-sm">
      <p role="status" className="sr-only">
        {t('submitting')}
      </p>
      <div className="animate-book-fly">
        <div className={cn('relative size-24 [perspective:600px]', phase === 'closed' && 'animate-book-breathe')}>
          <div className={half} style={{clipPath: 'inset(0 50% 0 0)'}}>
            <LogoMark size={96} />
          </div>
          <div
            className="absolute inset-0 transition-transform duration-500 ease-in-out [transform-style:preserve-3d]"
            style={{transform: phase === 'closed' ? 'rotateY(-180deg)' : 'none'}}
          >
            <div className={half} style={{clipPath: 'inset(0 0 0 50%)'}}>
              <LogoMark size={96} />
            </div>
            {/* Back of the turning page: once folded over it is the cover, with its rounded edge on the outside. */}
            <div
              className={cn(half, 'left-1/2 rounded-l-[13px] bg-gradient-to-br from-[#1A5CFF] to-[#6E4BFF]')}
              style={{transform: 'rotateY(180deg)'}}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** True when the user asked the system for less motion. */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
