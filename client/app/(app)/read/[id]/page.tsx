import {pageTitle} from '@/core/i18n/page-title';
import {ReaderPage} from '@/features/vocab';

export const generateMetadata = pageTitle('reader');

export default async function Reader({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <ReaderPage id={id} />;
}
