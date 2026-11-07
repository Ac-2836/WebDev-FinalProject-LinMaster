import {House} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';

import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';

// Placeholder so the app shell has a page; the real home (widgets from the home widget registry) is P4-07.
export default function HomePage() {
  const t = useTranslations('core.home');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <EmptyState
        icon={House}
        title={t('emptyTitle')}
        description={t('emptyBody')}
        action={
          <Button asChild>
            <Link href="/read">{t('emptyAction')}</Link>
          </Button>
        }
      />
    </div>
  );
}
