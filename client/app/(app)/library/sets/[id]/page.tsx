import {pageTitle} from '@/core/i18n/page-title';
import {SetPreviewPage} from '@/features/library';

export const generateMetadata = pageTitle('librarySet');

export default async function LibrarySet({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <SetPreviewPage id={id} />;
}
