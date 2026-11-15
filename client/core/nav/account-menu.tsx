'use client';

import {ChartColumn, LogOut, User} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {DropdownMenu} from 'radix-ui';

import {Skeleton} from '@/components/ui/skeleton';
import {useSession} from '@/core/auth/session-provider';

/** Up to two initials for the avatar: "Khải Hưng" → "KH", "Lan (sample)" → "L". Words without a letter are skipped. */
export function initials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(w => /^[\p{L}\p{N}]/u.test(w));
  return words
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

const item = 'flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm outline-none data-highlighted:bg-muted';

/** Avatar button in the app navbar: profile, dashboard, log out (wireframe 02-app). */
export function AccountMenu() {
  const t = useTranslations('core.account');
  const {user, signOut} = useSession();

  if (!user) return <Skeleton className="size-9 rounded-full" />;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t('label', {name: user.displayName})}
        className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet text-sm font-bold text-white ring-2 ring-white">
          {initials(user.displayName)}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-40 w-64 rounded-2xl border bg-card p-2 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.displayName}</p>
            <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link href="/profile" className={item}>
              <User className="size-4" aria-hidden="true" />
              {t('profile')}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/dashboard" className={item}>
              <ChartColumn className="size-4" aria-hidden="true" />
              {t('dashboard')}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={signOut} className={`${item} text-destructive data-highlighted:bg-danger-soft`}>
            <LogOut className="size-4" aria-hidden="true" />
            {t('logout')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
