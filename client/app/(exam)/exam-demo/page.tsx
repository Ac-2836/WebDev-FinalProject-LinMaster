import {ExamRoomDemo} from '@/features/exam';

// shortcut: temporary page to try the P3-12 shell (`/exam-demo?min=11`), delete before handover.
export default async function ExamDemoPage({searchParams}: {searchParams: Promise<{min?: string}>}) {
  const {min} = await searchParams;
  return <ExamRoomDemo minutes={Number(min) > 0 ? Number(min) : 38} />;
}
