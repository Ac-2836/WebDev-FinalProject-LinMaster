import {pageTitle} from '@/core/i18n/page-title';
import {SetEditor} from '@/features/flashcard';

export const generateMetadata = pageTitle('setNew');

export default function NewSet() {
  return <SetEditor />;
}
