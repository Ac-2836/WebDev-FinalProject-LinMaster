'use client';

import {Ellipsis} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {DropdownMenu} from 'radix-ui';

import {cn} from 'cn';
import {Logo, LogoMark} from '@/components/logo';
import {LocaleToggle} from '@/core/i18n/locale-switcher';

import {isActive, navItems} from './registry';

/** App shell navigation: top bar from 1024px, bottom tab bar below (wireframe 02-app, PLAN C0). */
export function AppNavbar() {
  const t = useTranslations('core.nav');
  const pathname = usePathname();
  const mobile = navItems.filter(n => n.mobile);
  const more = navItems.filter(n => !n.mobile);
  const moreActive = more.some(n => isActive(pathname, n.href));

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
          <Link href="/home" className="mr-4 inline-flex rounded-xl" aria-label={t('homeLink')}>
            <LogoMark size={32} className="sm:hidden" />
            <Logo className="hidden sm:inline-flex" />
          </Link>
          <nav aria-label={t('label')} className="hidden flex-1 items-center gap-1 lg:flex">
            {navItems.map(({id, href, icon: Icon}) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={id}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors',
                    active ? 'bg-secondary text-primary' : 'text-foreground/75 hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {t(id)}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <LocaleToggle />
          </div>
        </div>
      </header>

      <nav
        aria-label={t('label')}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {mobile.map(({id, href, icon: Icon}) => {
          const active = isActive(pathname, href);
          return (
            <Link key={id} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
              <span className={pillClass(active)}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {t(id)}
            </Link>
          );
        })}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className={tabClass(moreActive)}>
            <span className={pillClass(moreActive)}>
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
    'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'text-primary' : 'text-muted-foreground',
  );
}

function pillClass(active: boolean) {
  return cn('inline-flex h-7 w-12 items-center justify-center rounded-full', active && 'bg-secondary');
}
