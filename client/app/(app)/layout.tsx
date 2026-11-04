// Signed-in pages. The navbar from the nav registry (P1-10) and the login guard (P1-09) go here.
export default function AppLayout({children}: {children: React.ReactNode}) {
  return <div className="min-h-dvh">{children}</div>;
}
