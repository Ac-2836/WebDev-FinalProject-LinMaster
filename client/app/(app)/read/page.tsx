import {pageTitle} from '@/core/i18n/page-title';
import {DocumentsPage} from '@/features/vocab';

export const generateMetadata = pageTitle('documents');

export default function Read() {
  return <DocumentsPage />;
}
