import {pageTitle} from '@/core/i18n/page-title';
import {TestPreviewPage} from '@/features/library';

export const generateMetadata = pageTitle('libraryTest');

export default async function LibraryTest({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <TestPreviewPage id={id} />;
}
