// Exam room: full screen and no app navbar, like the real computer-based test.
export default function ExamLayout({children}: {children: React.ReactNode}) {
  return <div className="h-dvh overflow-hidden">{children}</div>;
}
