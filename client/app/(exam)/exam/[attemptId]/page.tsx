import {pageTitle} from '@/core/i18n/page-title';
import {AttemptRoom} from '@/features/exam';

export const generateMetadata = pageTitle('exam');

export default async function ExamPage({params}: {params: Promise<{attemptId: string}>}) {
  const {attemptId} = await params;
  return <AttemptRoom attemptId={attemptId} />;
}
