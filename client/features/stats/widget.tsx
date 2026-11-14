'use client';

import {CloudOff, RotateCw} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useCallback, useEffect, useId, useState} from 'react';

import {cn} from 'cn';
import {Skeleton} from '@/components/ui/skeleton';
import {api} from '@/core/api/client';

export const card = 'rounded-[20px] border bg-card shadow-soft';

/** Loads one stats endpoint. Each widget loads and fails on its own, so one slow query never blanks the page. */
export function useStat<T>(path: string, schema: {parse: (res: unknown) => T}) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    setData(null);
    api<unknown>(path)
      .then(res => setData(schema.parse(res)))
      .catch(() => setFailed(true));
  }, [path, schema]);
  useEffect(load, [load]);
  return {data, failed, retry: load};
}

/**
 * Frame of one dashboard widget: title, then loading, error, empty or the content.
 * `empty` is the empty state shown when `isEmpty` is true (a new account).
 */
export function Widget<T>({
  title,
  aside,
  stat,
  isEmpty,
  empty,
  className,
  children,
}: {
  title: React.ReactNode;
  aside?: (data: T) => React.ReactNode;
  stat: {data: T | null; failed: boolean; retry: () => void};
  isEmpty: (data: T) => boolean;
  empty: React.ReactNode;
  className?: string;
  children: (data: T) => React.ReactNode;
}) {
  const t = useTranslations('stats.dashboard');
  const id = useId();
  const {data, failed, retry} = stat;
  return (
    <section className={cn(card, 'flex min-w-0 flex-col gap-3 p-5', className)} aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h2 id={id} className="flex-1 text-lg font-bold">
          {title}
        </h2>
        {data && !isEmpty(data) && aside?.(data)}
      </div>
      {failed ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/50 p-6 text-center text-sm">
          <CloudOff className="size-5 text-muted-foreground" aria-hidden="true" />
          <p>{t('loadError')}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {t('retry')}
          </button>
        </div>
      ) : !data ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">{t('loading')}</span>
          <Skeleton className="h-24" />
        </div>
      ) : isEmpty(data) ? (
        empty
      ) : (
        children(data)
      )}
    </section>
  );
}

/** Empty state inside a widget: a short line and the first step to take. */
export function WidgetEmpty({title, href, action}: {title: string; href?: string; action?: string}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg bg-muted/50 p-4 text-center">
      <p className="font-semibold">{title}</p>
      {href && action && (
        <Link href={href} className="text-sm font-semibold text-primary hover:underline">
          {action}
        </Link>
      )}
    </div>
  );
}

/** The numbers behind a chart, for screen readers and anyone who prefers a table ("Xem bảng số liệu"). */
export function DataTable({caption, head, rows}: {caption: string; head: string[]; rows: React.ReactNode[][]}) {
  const t = useTranslations('stats.dashboard');
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-semibold text-primary">{t('showTable')}</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              {head.map(h => (
                <th key={h} scope="col" className="py-1 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => (
                  <td key={j} className="py-1 pr-3 tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
