import {pageTitle} from '@/core/i18n/page-title';
import {PreExam} from '@/features/exam';

export const generateMetadata = pageTitle('examStart');

export default async function TestStart({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <PreExam testId={id} />;
}
