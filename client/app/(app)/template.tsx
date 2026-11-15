// A template mounts again on every navigation, so each page in the app shell fades in (UX-5).
export default function AppTemplate({children}: {children: React.ReactNode}) {
  return <div className="animate-page-in motion-reduce:animate-none">{children}</div>;
}
