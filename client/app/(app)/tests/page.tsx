import {pageTitle} from '@/core/i18n/page-title';
import {TestsPage} from '@/features/exam';

export const generateMetadata = pageTitle('tests');

export default function Tests() {
  return <TestsPage />;
}
