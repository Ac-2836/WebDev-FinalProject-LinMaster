import {SetEditor} from '@/features/flashcard';

export default async function EditSet({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <SetEditor id={id} />;
}
