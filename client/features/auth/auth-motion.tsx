'use client';

import {useTranslations} from 'next-intl';
import {useLayoutEffect, useMemo, useRef} from 'react';
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

export type BookPhase = 'working' | 'success' | 'fail';

/** The animation needs this long before it can settle, so the login page waits this long even if the API is faster. */
export const BOOK_MIN_WORK_MS = 900;
/** How long the settle, open, sparkle and fold back into the flat logo (success) and stop-shake-vanish (fail) take. */
export const BOOK_SUCCESS_MS = 2600;
export const BOOK_FAIL_MS = 750;

/* The book is the logo tile (S px square, rounded like the logo) with a thickness of T px: a back cover, a block of
   pages, a spine on the left and a front cover hinged on the spine that carries the flat logo. */
const S = 128;
const R = 35;
const T = 26;
const HALF = T / 2;
const CV = 3;
/** Where the logo's sparkle sits on the tile, in px. */
const STAR_X = (33.5 / 48) * S;
const STAR_Y = (14 / 48) * S;
const STAR_SIZE = (10 / 48) * S;
const MAX_SPIN = 330;
const TILT = 58;
const SPARKS = 12;

const ease = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const easeOut = (u: number) => 1 - (1 - u) ** 3;
const range = (t: number, from: number, to: number) => Math.min(1, Math.max(0, (t - from) / (to - from)));
const outBack = (u: number) => 1 + 2.6 * (u - 1) ** 3 + 1.6 * (u - 1) ** 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Point = [number, number];

/** Points around a rounded rectangle, clockwise. */
function outline(x0: number, y0: number, w: number, h: number, r: number, seg = 8): Point[] {
  const corners = [
    [x0 + w - r, y0 + r, -90],
    [x0 + w - r, y0 + h - r, 0],
    [x0 + r, y0 + h - r, 90],
    [x0 + r, y0 + r, 180],
  ];
  return corners.flatMap(([cx, cy, from]) =>
    Array.from({length: seg + 1}, (_, i): Point => {
      const a = ((from + (90 * i) / seg) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }),
  );
}

interface Facet {
  style: React.CSSProperties;
}

/** Pushes an outline from depth z0 to z1 as thin upright strips, so the edge of the slab is solid. */
function extrude(points: Point[], z0: number, z1: number, background: string, keep?: (x: number) => boolean): Facet[] {
  const thick = z1 - z0;
  const middle = (z0 + z1) / 2;
  return points.flatMap(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length];
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    if (keep && !keep(mx)) return [];
    const length = Math.hypot(bx - ax, by - ay) + 0.5;
    const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    return [
      {
        style: {
          left: mx - length / 2,
          top: my - thick / 2,
          width: length,
          height: thick,
          background,
          transform: `translateZ(${middle}px) rotateZ(${angle}deg) rotateX(90deg)`,
        },
      },
    ];
  });
}

/** The spine wraps only the left corners, not the bottom and top edges, so those show the pages. */
const SPINE_END = R * 0.45;
const BLUE = '#2f55e8';
const PAGES = 'repeating-linear-gradient(0deg,#fffaf0 0 1.4px,#e8dcbc 1.4px 2px)';
const SPINE = 'linear-gradient(90deg,#1f43d0,#3a63ff 50%,#1f43d0)';
const FACETS = (() => {
  const full = outline(0, 0, S, S, R);
  const inset = 5;
  return {
    back: extrude(full, -HALF, -HALF + CV, BLUE),
    pages: extrude(
      outline(inset, inset, S - inset * 2, S - inset * 2, R - inset),
      -HALF + CV,
      HALF - CV,
      PAGES,
      x => x > SPINE_END - 3,
    ),
    spine: extrude(full, -HALF + CV - 0.3, HALF - CV + 0.3, SPINE, x => x < SPINE_END),
    front: extrude(full, HALF - CV, HALF, BLUE),
  };
})();

interface Pose {
  /** Thickness: 0.02 is a flat logo, 1 a book. */
  depth: number;
  spin: number;
  omega: number;
  /** Lay-down angle, 0 facing us. */
  tilt: number;
  /** Front cover opening, 0 closed to 1 open at 90°. */
  cover: number;
  /** The yellow page lifting inside the book. */
  page: number;
  star: {x: number; y: number; scale: number; rotate: number; opacity: number};
  burst: number;
  /** How much of the "LinMaster" wordmark has slid out beside the logo. */
  word: number;
  shake: number;
  fade: number;
}

const startPose = (): Pose => ({
  depth: 0.02,
  spin: 0,
  omega: 0,
  tilt: 0,
  cover: 0,
  page: 0,
  star: {x: STAR_X, y: STAR_Y, scale: 1, rotate: 0, opacity: 1},
  burst: 0,
  word: 0,
  shake: 0,
  fade: 1,
});

interface Parts {
  book: HTMLElement | null;
  scaler: HTMLElement | null;
  cover: HTMLElement | null;
  page: HTMLElement | null;
  star: HTMLElement | null;
  sparks: HTMLElement | null;
  root: HTMLElement | null;
  word: HTMLElement | null;
}

function paint(parts: Parts, pose: Pose) {
  const {book, scaler, cover, page, star, sparks, root, word} = parts;
  if (!book || !scaler || !cover || !page || !star || !sparks || !root) return;
  book.style.transform = `rotateX(${pose.tilt}deg) rotate3d(1,-1,0.25,${pose.spin}deg)`;
  scaler.style.transform = `scale3d(1,1,${pose.depth})`;
  cover.style.transform = `rotateY(${-90 * pose.cover}deg)`;
  page.style.transform = `translateZ(${HALF - CV - 0.3}px) rotateY(${-16 * pose.page}deg)`;
  const s = pose.star;
  star.style.opacity = String(s.opacity);
  star.style.transform = `translate(${s.x - STAR_SIZE / 2}px,${s.y - STAR_SIZE / 2}px) scale(${s.scale}) rotate(${s.rotate}deg)`;
  const t = pose.burst;
  sparks.style.opacity = t > 0 && t < 1 ? '1' : '0';
  Array.from(sparks.children).forEach((spark, i) => {
    const a = (i / SPARKS) * Math.PI * 2;
    const d = (34 + (i % 3) * 14) * easeOut(t);
    (spark as HTMLElement).style.transform = `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(${1 - t})`;
  });
  const text = word?.firstElementChild as HTMLElement | null;
  if (word && text) {
    word.style.width = `${text.scrollWidth * pose.word}px`;
    text.style.transform = `translateX(${-105 * (1 - pose.word)}%)`;
  }
  root.style.opacity = String(pose.fade);
  root.style.transform = `translateX(${pose.shake}px) scale(${1 - (1 - pose.fade) * 0.3})`;
}

/**
 * The pose over time. Working: the logo rises into a book while its sparkle folds in, then it spins. Success: it
 * slows to a stop, lies back, opens its cover, shoots the sparkle out, then closes and flattens into the logo. Fail:
 * it stops, shakes and vanishes.
 */
function useBookTimeline(parts: React.RefObject<Parts>, phase: BookPhase) {
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useLayoutEffect(() => {
    const start = performance.now();
    const pose = startPose();
    if (parts.current) paint(parts.current, pose);
    let seen: BookPhase = 'working';
    let from = startPose();
    let at = 0;
    let dist = 0;
    let last = 0;
    let handle = 0;
    const frame = (now: number) => {
      const ms = now - start;
      const dt = Math.min(0.05, (ms - last) / 1000);
      last = ms;
      if (phaseRef.current !== seen) {
        seen = phaseRef.current;
        from = {...pose, star: {...pose.star}};
        at = ms;
        // Success: run on to the next whole turn so the book ends facing us, reaching it at rest.
        dist = Math.ceil((from.spin + from.omega * 0.8 * 0.6) / 360) * 360 - from.spin;
      }
      const t = ms - at;
      if (seen === 'working') {
        pose.depth = lerp(0.02, 1, easeOut(range(ms, 0, 700)));
        const u = ease(range(ms, 0, 500));
        pose.star = {
          x: lerp(STAR_X, S / 2, u),
          y: lerp(STAR_Y, S / 2, u),
          scale: 1 - u,
          rotate: -180 * u,
          opacity: 1 - range(ms, 0, 500),
        };
        pose.omega = MAX_SPIN * ease(range(ms, 0, 800));
        pose.spin += pose.omega * dt;
      } else if (seen === 'success') {
        const u = range(t, 0, 800);
        // Hermite curve: leaves at the current speed, ends at rest on `dist`.
        pose.spin = from.spin + dist * (3 * u * u - 2 * u ** 3) + from.omega * 0.8 * (u ** 3 - 2 * u * u + u);
        pose.omega = 0;
        const flat = ease(range(t, 1550, 1900));
        pose.tilt = TILT * ease(range(t, 280, 800)) * (1 - flat);
        pose.cover = ease(range(t, 650, 1200)) * (1 - flat);
        pose.page = outBack(range(t, 850, 1300)) * (1 - flat);
        pose.depth = lerp(1, 0.02, flat);
        const k = range(t, 1200, 1650);
        const e = easeOut(k);
        pose.star = {
          x: lerp(S / 2, STAR_X, e),
          y: lerp(S / 2 - 6, STAR_Y, e) - Math.sin(k * Math.PI) * 45,
          scale: k < 0.7 ? lerp(0.2, 1.35, k / 0.7) : lerp(1.35, 1, (k - 0.7) / 0.3),
          rotate: lerp(-360, 0, e),
          opacity: t < 1200 ? 0 : 1,
        };
        pose.burst = range(t, 1200, 1650);
        pose.word = easeOut(range(t, 1850, 2500));
      } else {
        pose.spin = from.spin + from.omega * 0.1 * (1 - (1 - range(t, 0, 200)) ** 2);
        pose.shake = t > 200 ? 7 * Math.exp(-(t - 200) / 130) * Math.sin((t - 200) * 0.07) : 0;
        pose.fade = 1 - ease(range(t, 450, 750));
      }
      if (parts.current) paint(parts.current, pose);
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, [parts]);
}

const fill: React.CSSProperties = {position: 'absolute', inset: 0};
const group: React.CSSProperties = {...fill, transformStyle: 'preserve-3d'};
const slab = (z: number, style: React.CSSProperties): React.CSSProperties => ({
  ...fill,
  borderRadius: R,
  transform: `translateZ(${z}px)`,
  ...style,
});

function Facets({list}: {list: Facet[]}) {
  return list.map((f, i) => (
    <div key={i} style={{position: 'absolute', outline: '1px solid transparent', ...f.style}} />
  ));
}

/** The 3D book itself. `paint` moves it through refs, so React renders it once. */
function Book({parts}: {parts: React.RefObject<Parts>}) {
  const ref = useMemo(() => {
    const set = (key: keyof Parts) => (el: HTMLElement | null) => {
      if (parts.current) parts.current[key] = el;
    };
    return {
      book: set('book'),
      scaler: set('scaler'),
      cover: set('cover'),
      page: set('page'),
      star: set('star'),
      sparks: set('sparks'),
    };
  }, [parts]);
  return (
    <div style={{position: 'relative', width: S, height: S, perspective: 900}}>
      <div ref={ref.book} style={{...group, willChange: 'transform'}}>
        <div ref={ref.scaler} style={group}>
          {/* back cover and its inner side */}
          <div style={group}>
            <div
              style={slab(-HALF, {
                background: 'linear-gradient(135deg,#3a6dfb,#6a4cf0)',
                backfaceVisibility: 'hidden',
                transform: `translateZ(${-HALF}px) rotateY(180deg)`,
              })}
            />
            <Facets list={FACETS.back} />
          </div>
          {/* block of pages, spine and the yellow page */}
          <div style={group}>
            <Facets list={FACETS.pages} />
            <div
              style={slab(HALF - CV - 0.4, {
                inset: 5,
                borderRadius: R - 5,
                background: 'repeating-linear-gradient(0deg,#fffdf6 0 10px,#efe8d4 10px 11px)',
              })}
            />
            <div
              ref={ref.page}
              style={slab(HALF - CV - 0.2, {
                inset: '8px 8px 8px 6px',
                borderRadius: R - 8,
                transformOrigin: '0 50%',
                background: 'linear-gradient(90deg,#ffd34d,#ffb820)',
              })}
            />
            <Facets list={FACETS.spine} />
          </div>
          {/* front cover, hinged on the spine, carrying the logo */}
          <div ref={ref.cover} style={{...group, transformOrigin: `0 50% ${HALF - CV}px`}}>
            <Facets list={FACETS.front} />
            <div style={slab(HALF, {overflow: 'hidden', backfaceVisibility: 'hidden'})}>
              <LogoMark size={S} star={false} />
            </div>
            <div
              style={slab(HALF - CV - 0.2, {
                background: 'linear-gradient(135deg,#e9eeff,#d6defc)',
                backfaceVisibility: 'hidden',
                transform: `translateZ(${HALF - CV - 0.2}px) rotateY(180deg)`,
              })}
            />
          </div>
        </div>
      </div>
      <svg
        ref={ref.star as React.Ref<SVGSVGElement>}
        viewBox="28.5 9 10 10"
        width={STAR_SIZE}
        height={STAR_SIZE}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 0 5px #fff) drop-shadow(0 0 10px #9fb6ff)',
        }}
      >
        <path d="M33.5 9.5l1.25 3.25L38 14l-3.25 1.25L33.5 18.5l-1.25-3.25L29 14l3.25-1.25z" fill="#fff" />
      </svg>
      <div ref={ref.sparks} style={{position: 'absolute', left: S / 2, top: S / 2, pointerEvents: 'none', opacity: 0}}>
        {Array.from({length: SPARKS}, (_, i) => (
          <i
            key={i}
            style={{
              position: 'absolute',
              left: -3,
              top: -3,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: i % 2 ? '#ffd25a' : '#9fb6ff',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Shown while logging in: the logo flies to the middle and rises into a book (the tile gets thick, its front cover is the
 * logo), which spins while the request runs (`working`). On `success` it slows to a stop, lies back, opens, sparkles
 * and folds back into the flat logo; on `fail` it stops, shakes and vanishes. Plain CSS 3D driven by one rAF loop; with
 * reduced motion it is just the still logo.
 */
export function BookLoader({phase}: {phase: BookPhase}) {
  const t = useTranslations('auth.login');
  const parts = useRef<Parts>({
    book: null,
    scaler: null,
    cover: null,
    page: null,
    star: null,
    sparks: null,
    root: null,
    word: null,
  });
  const reduced = prefersReducedMotion();
  useBookTimeline(parts, phase);
  // Portaled to <body>: the auth shell's columns are separate stacking contexts that would cover it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-page-in items-center justify-center bg-white/80 backdrop-blur-sm motion-reduce:animate-none">
      <p role="status" className="sr-only">
        {t('submitting')}
      </p>
      {reduced ? (
        <LogoMark size={96} />
      ) : (
        <div className="animate-book-fly" aria-hidden="true">
          <div
            className="flex items-center"
            ref={el => {
              parts.current.root = el;
            }}
          >
            <Book parts={parts} />
            {/* The wordmark slides out of the logo's right edge when the book has closed. */}
            <div
              className="w-0 flex-none overflow-hidden"
              ref={el => {
                parts.current.word = el;
              }}
            >
              <span className="inline-block pl-5 text-[clamp(1.75rem,8vw,3.75rem)] font-bold tracking-tight whitespace-nowrap">
                Lin<span className="text-primary">Master</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** True when the user asked the system for less motion. */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
