import {AttemptRoom} from '@/features/exam';

export default async function ExamPage({params}: {params: Promise<{attemptId: string}>}) {
  const {attemptId} = await params;
  return <AttemptRoom attemptId={attemptId} />;
}
