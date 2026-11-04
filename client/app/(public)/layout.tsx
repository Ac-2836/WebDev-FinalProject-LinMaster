// Public pages: landing, login, register. No app navbar, no login required.
export default function PublicLayout({children}: {children: React.ReactNode}) {
  return <div className="min-h-dvh">{children}</div>;
}
