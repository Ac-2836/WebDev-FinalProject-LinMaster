import {pageTitle} from '@/core/i18n/page-title';
import {TestIntroPage} from '@/features/exam';
import {TestPublishControl} from '@/features/library';

export const generateMetadata = pageTitle('test');

export default async function TestIntro({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <TestIntroPage id={id} publish={<TestPublishControl id={id} />} />;
}
