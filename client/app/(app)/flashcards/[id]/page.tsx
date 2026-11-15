import {SetPage} from '@/features/flashcard';
import {SetPublishControl} from '@/features/library';

export default async function FlashcardSet({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <SetPage id={id} publish={<SetPublishControl id={id} />} />;
}
