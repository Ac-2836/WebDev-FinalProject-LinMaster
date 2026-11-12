import {TestIntroPage} from '@/features/exam';

export default async function TestIntro({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <TestIntroPage id={id} />;
}
