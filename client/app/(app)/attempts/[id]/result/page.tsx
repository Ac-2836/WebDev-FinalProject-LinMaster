import {ResultPage} from '@/features/exam';

export default async function AttemptResult({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <ResultPage attemptId={id} />;
}
