import {SetPreviewPage} from '@/features/library';

export default async function LibrarySet({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <SetPreviewPage id={id} />;
}
