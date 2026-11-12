import {PreExam} from '@/features/exam';

export default async function TestStart({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <PreExam testId={id} />;
}
