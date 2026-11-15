import {TestPreviewPage} from '@/features/library';

export default async function LibraryTest({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <TestPreviewPage id={id} />;
}
