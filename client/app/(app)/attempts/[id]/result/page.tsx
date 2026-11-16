import {pageTitle} from '@/core/i18n/page-title';
import {ResultPage} from '@/features/exam';

export const generateMetadata = pageTitle('result');

export default async function AttemptResult({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <ResultPage attemptId={id} />;
}
