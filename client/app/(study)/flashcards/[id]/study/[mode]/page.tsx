import {pageTitle} from '@/core/i18n/page-title';
import {StudyPage} from '@/features/flashcard';

export const generateMetadata = pageTitle('study');

export default async function Study({params}: {params: Promise<{id: string; mode: string}>}) {
  const {id, mode} = await params;
  return <StudyPage id={id} mode={mode} />;
}
