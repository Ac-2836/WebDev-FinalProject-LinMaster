import {TestIntroPage} from '@/features/exam';
import {TestPublishControl} from '@/features/library';

export default async function TestIntro({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <TestIntroPage id={id} publish={<TestPublishControl id={id} />} />;
}
