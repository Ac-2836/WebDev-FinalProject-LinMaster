'use client';

import {Ellipsis} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {DropdownMenu} from 'radix-ui';
import {useLayoutEffect, useRef, useState} from 'react';

import {cn} from 'cn';
import {Logo, LogoMark} from '@/components/logo';
import {LocaleToggle} from '@/core/i18n/locale-switcher';

import {AccountMenu} from './account-menu';
import {isActive, navItems} from './registry';

/** App shell navigation: top bar from 1024px, bottom tab bar below (wireframe 02-app, PLAN C0). */
export function AppNavbar() {
  const t = useTranslations('core.nav');
  const pathname = usePathname();
  const mobile = navItems.filter(n => n.mobile);
  const more = navItems.filter(n => !n.mobile);
  const moreActive = more.some(n => isActive(pathname, n.href));
  const pill = useSlidingPill(pathname, useLocale());
  const mobileIndex = moreActive ? mobile.length : mobile.findIndex(n => isActive(pathname, n.href));

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        {t('skip')}
      </a>

      <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link
            href="/home"
            className="mr-4 inline-flex h-11 min-w-11 items-center rounded-xl"
            aria-label={t('homeLink')}
          >
            <LogoMark size={32} className="sm:hidden" />
            <Logo className="hidden sm:inline-flex" />
          </Link>
          <nav ref={pill.navRef} aria-label={t('label')} className="relative hidden flex-1 items-center gap-1 lg:flex">
            {/* One background that slides to the active tab. Before it is measured, the active tab paints its own. */}
            {pill.box && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-0 left-0 h-9 rounded-full bg-secondary',
                  pill.box.animate &&
                    'transition-[transform,width] duration-300 ease-out motion-reduce:transition-none',
                )}
                style={{width: pill.box.width, transform: `translate(${pill.box.left}px, ${pill.box.top}px)`}}
              />
            )}
            {navItems.map(({id, href, icon: Icon}) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={id}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  title={t(id)}
                  className={cn(
                    'relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors xl:px-3.5',
                    active ? 'text-primary' : 'text-foreground/75 hover:bg-muted hover:text-foreground',
                    active && !pill.box && 'bg-secondary',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {/* Labels never wrap (QA T4); from 1024 to 1279px only the icons fit, the label stays for screen readers. */}
                  <span className="sr-only xl:not-sr-only">{t(id)}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <LocaleToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <nav
        aria-label={t('label')}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {/* Tabs are equal width, so the sliding background is placed by index alone. */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-2 left-0 flex justify-center transition-transform duration-300 ease-out motion-reduce:transition-none',
            mobileIndex < 0 && 'invisible',
          )}
          style={{width: `${100 / (mobile.length + 1)}%`, transform: `translateX(${Math.max(mobileIndex, 0) * 100}%)`}}
        >
          <span className="h-7 w-12 rounded-full bg-secondary" />
        </span>
        {mobile.map(({id, href, icon: Icon}) => {
          const active = isActive(pathname, href);
          return (
            <Link key={id} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
              <span className={pillClass}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {t(id)}
            </Link>
          );
        })}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className={tabClass(moreActive)}>
            <span className={pillClass}>
              <Ellipsis className="size-5" aria-hidden="true" />
            </span>
            {t('more')}
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className="z-40 min-w-56 rounded-3xl border bg-card p-2 shadow-lg"
            >
              {more.map(({id, href, icon: Icon}) => {
                const active = isActive(pathname, href);
                return (
                  <DropdownMenu.Item key={id} asChild>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold outline-none',
                        active ? 'bg-secondary text-primary' : 'data-highlighted:bg-muted',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {t(id)}
                    </Link>
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </nav>
    </>
  );
}

function tabClass(active: boolean) {
  return cn(
    'relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'text-primary' : 'text-muted-foreground',
  );
}

const pillClass = 'inline-flex h-7 w-12 items-center justify-center rounded-full';

/**
 * Measures the active top-bar tab so one background can slide between tabs. Tabs differ in width (and change with
 * the locale), so this cannot be done in CSS alone. The first placement does not animate.
 */
function useSlidingPill(pathname: string, locale: string) {
  const navRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState<{left: number; top: number; width: number; animate: boolean} | null>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = () => {
      const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      setBox(prev =>
        active && active.offsetWidth
          ? {left: active.offsetLeft, top: active.offsetTop, width: active.offsetWidth, animate: prev !== null}
          : null,
      );
    };
    place();
    // The bar is hidden below 1024px: re-measure when it appears.
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname, locale]);
  return {navRef, box};
}
