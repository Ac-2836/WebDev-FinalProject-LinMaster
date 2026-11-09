import {AppNavbar} from '@/core/nav/app-navbar';

// Signed-in pages: navbar from the nav registry. Signed-out visitors never get here (client/proxy.ts).
export default function AppLayout({children}: {children: React.ReactNode}) {
  return (
    <div className="min-h-dvh">
      <AppNavbar />
      {/* Bottom padding keeps content clear of the mobile tab bar. */}
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-6 pb-28 outline-none sm:px-6 lg:pb-12">
        {children}
      </main>
    </div>
  );
}
