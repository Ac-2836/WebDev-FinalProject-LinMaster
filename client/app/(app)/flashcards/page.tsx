import {pageTitle} from '@/core/i18n/page-title';
import {SetsPage} from '@/features/flashcard';

export const generateMetadata = pageTitle('sets');

export default function Flashcards() {
  return <SetsPage />;
}
