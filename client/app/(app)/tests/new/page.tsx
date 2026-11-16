import {pageTitle} from '@/core/i18n/page-title';
import {UploadPage} from '@/features/exam';

export const generateMetadata = pageTitle('upload');

export default function NewTest() {
  return <UploadPage />;
}
