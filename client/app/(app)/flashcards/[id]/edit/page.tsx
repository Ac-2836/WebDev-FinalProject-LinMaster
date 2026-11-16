import {pageTitle} from '@/core/i18n/page-title';
import {SetEditor} from '@/features/flashcard';

export const generateMetadata = pageTitle('setEdit');

export default async function EditSet({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <SetEditor id={id} />;
}
