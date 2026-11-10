import {WordBankPage} from '@/features/vocab';

export default async function Vocab({searchParams}: {searchParams: Promise<{documentId?: string | string[]}>}) {
  const {documentId} = await searchParams;
  return <WordBankPage documentId={typeof documentId === 'string' ? documentId : undefined} />;
}
