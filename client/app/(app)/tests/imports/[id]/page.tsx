import {ImportStatusPage} from '@/features/exam';

export default async function TestImport({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <ImportStatusPage id={id} />;
}
