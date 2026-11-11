// Study modes: focus layout without the app navbar (wireframe 04-flashcard/study-*). Login is still required (proxy.ts).
export default function StudyLayout({children}: {children: React.ReactNode}) {
  return <div className="min-h-dvh">{children}</div>;
}
