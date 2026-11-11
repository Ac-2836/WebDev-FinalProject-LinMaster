import {SetPage} from '@/features/flashcard';

export default async function FlashcardSet({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <SetPage id={id} />;
}
