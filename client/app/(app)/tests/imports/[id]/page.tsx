import {pageTitle} from '@/core/i18n/page-title';
import {ImportStatusPage} from '@/features/exam';

export const generateMetadata = pageTitle('importStatus');

export default async function TestImport({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <ImportStatusPage id={id} />;
}
