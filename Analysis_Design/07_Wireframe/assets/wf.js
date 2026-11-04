/*
 * Shared wireframe runtime (P0-12). Load it in <head> BEFORE the Tailwind browser script:
 *   <script src="../assets/wf.js"></script>
 * It injects the theme tokens (same values as client/app/globals.css), the font and the icons,
 * renders the app shell into <div data-app-nav="read"></div>, and adds a small panel to switch
 * the page between the states declared with data-state="…" (loading, empty, error…).
 * Wireframe-only helper: the real app builds these from shadcn components and the nav registry.
 */
(function () {
  const root = document.currentScript.src.replace(/assets\/wf\.js.*$/, '');

  // Theme: keep in sync with client/app/globals.css. Wireframes may change colours only here and there.
  document.head.insertAdjacentHTML(
    'beforeend',
    `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap">
<style type="text/tailwindcss">
@theme {
  --font-sans: 'Be Vietnam Pro', system-ui, sans-serif;
  --color-background: #f5f6f8;
  --color-foreground: #111827;
  --color-card: #ffffff;
  --color-primary: #1d4ed8;
  --color-primary-strong: #1e3a8a;
  --color-primary-foreground: #ffffff;
  --color-secondary: #eef2ff;
  --color-muted: #eef0f3;
  --color-muted-foreground: #4b5563;
  --color-destructive: #b91c1c;
  --color-border: #e3e6eb;
  --color-ring: #93c5fd;
  --color-success: #15803d;
  --color-success-soft: #dcfce7;
  --color-warning: #92400e;
  --color-warning-soft: #fef3c7;
  --color-danger-soft: #fee2e2;
  --color-mark: #fde68a;
  --radius-lg: 0.625rem;
}
@layer base {
  * { border-color: var(--color-border); }
  body { background: var(--color-background); color: var(--color-foreground); font-family: var(--font-sans); }
  :focus-visible { outline: 3px solid var(--color-ring); outline-offset: 2px; }
  mark { background: var(--color-mark); color: inherit; border-radius: 2px; }
  [data-state]:not(.wf-on) { display: none !important; }
}
@layer components {
  .btn { @apply inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-50; }
  .btn-sm { @apply min-h-8 px-3 text-[13px]; }
  .btn-lg { @apply min-h-12 px-6 text-base; }
  .btn-icon { @apply size-10 min-h-0 px-0; }
  .btn-primary { @apply bg-primary text-white hover:bg-primary-strong; }
  .btn-secondary { @apply border bg-card text-foreground hover:bg-muted; }
  .btn-ghost { @apply text-foreground hover:bg-muted; }
  .btn-danger { @apply bg-destructive text-white hover:bg-red-800; }
  .card { @apply rounded-xl border bg-card; }
  .input { @apply min-h-10 w-full rounded-lg border bg-card px-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/50; }
  .label { @apply text-sm font-medium; }
  .hint { @apply text-[13px] text-muted-foreground; }
  .badge { @apply inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground; }
  .badge-primary { @apply bg-secondary text-primary-strong; }
  .badge-success { @apply bg-success-soft text-success; }
  .badge-warning { @apply bg-warning-soft text-warning; }
  .badge-danger { @apply bg-danger-soft text-destructive; }
  .skeleton { @apply animate-pulse rounded-md bg-muted; }
  .page { @apply mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8; }
  .h1 { @apply text-2xl font-bold tracking-tight sm:text-[28px]; }
  .h2 { @apply text-lg font-bold; }
}
</style>`,
  );

  const icons = document.createElement('script');
  icons.src = 'https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js';
  icons.onload = () => window.lucide.createIcons();
  document.head.append(icons);

  // Nav registry of the real app (PLAN B4), in order.
  const NAV = [
    {id: 'home', href: '02-app/home.html', icon: 'house', label: 'Trang chủ'},
    {id: 'read', href: '03-vocab/documents.html', icon: 'book-open-text', label: 'Đọc'},
    {id: 'vocab', href: '03-vocab/word-bank.html', icon: 'notebook-pen', label: 'Kho từ'},
    {id: 'flashcards', href: '04-flashcard/sets.html', icon: 'layers', label: 'Flashcard'},
    {id: 'tests', href: '05-exam/tests.html', icon: 'clipboard-check', label: 'Thi thử'},
    {id: 'library', href: '06-library/library.html', icon: 'library', label: 'Thư viện'},
    {id: 'dashboard', href: '07-stats/dashboard.html', icon: 'chart-column', label: 'Dashboard'},
  ];
  // Mobile bottom bar: the 4 daily destinations + "More" sheet with the rest.
  const MOBILE = ['home', 'read', 'flashcards', 'tests'];

  function renderNav(el) {
    const active = el.dataset.appNav;
    const link = (n, cls) =>
      `<a href="${root}${n.href}" class="${cls} ${n.id === active ? 'bg-secondary text-primary-strong' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"${n.id === active ? ' aria-current="page"' : ''}><i data-lucide="${n.icon}" class="size-4" aria-hidden="true"></i>${n.label}</a>`;
    const tab = n =>
      `<a href="${root}${n.href}" class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${n.id === active ? 'text-primary' : 'text-muted-foreground'}"${n.id === active ? ' aria-current="page"' : ''}><i data-lucide="${n.icon}" class="size-5" aria-hidden="true"></i>${n.label}</a>`;
    const more = NAV.filter(n => !MOBILE.includes(n.id));
    const moreActive = more.some(n => n.id === active);
    el.outerHTML = `
<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Bỏ qua tới nội dung</a>
<header class="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
  <div class="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
    <a href="${root}02-app/home.html" class="mr-3 inline-flex items-center gap-2 rounded-lg" aria-label="LinMaster, về trang chủ">
      <span class="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-white"><i data-lucide="book-open" class="size-[18px]" aria-hidden="true"></i></span>
      <span class="text-[17px] font-bold tracking-tight">LinMaster</span>
    </a>
    <nav aria-label="Điều hướng chính" class="hidden flex-1 items-center gap-0.5 lg:flex">
      ${NAV.map(n => link(n, 'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium')).join('')}
    </nav>
    <div class="ml-auto flex items-center gap-1">
      <button class="btn btn-ghost btn-sm" aria-label="Đổi ngôn ngữ giao diện, đang là Tiếng Việt"><i data-lucide="languages" class="size-4" aria-hidden="true"></i>VI</button>
      <details class="relative">
        <summary class="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary-strong" aria-label="Tài khoản của Khải Hưng">KH</summary>
        <div class="absolute right-0 mt-2 w-56 rounded-xl border bg-card p-1.5 shadow-lg">
          <div class="px-3 py-2"><p class="text-sm font-semibold">Khải Hưng</p><p class="hint">khaihung@example.com</p></div>
          <hr class="my-1">
          <a href="${root}02-app/profile.html" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><i data-lucide="user" class="size-4" aria-hidden="true"></i>Hồ sơ</a>
          <a href="${root}07-stats/dashboard.html" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><i data-lucide="chart-column" class="size-4" aria-hidden="true"></i>Dashboard</a>
          <a href="${root}01-public/landing.html" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-danger-soft"><i data-lucide="log-out" class="size-4" aria-hidden="true"></i>Đăng xuất</a>
        </div>
      </details>
    </div>
  </div>
</header>
<nav aria-label="Điều hướng chính" class="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
  ${NAV.filter(n => MOBILE.includes(n.id)).map(tab).join('')}
  <details class="flex flex-1">
    <summary class="flex flex-1 cursor-pointer list-none flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${moreActive ? 'text-primary' : 'text-muted-foreground'}"><i data-lucide="ellipsis" class="size-5" aria-hidden="true"></i>Thêm</summary>
    <div class="fixed inset-x-0 bottom-[60px] mx-3 rounded-2xl border bg-card p-2 shadow-xl">
      ${more.map(n => link(n, 'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium')).join('')}
    </div>
  </details>
</nav>`;
  }

  // State switcher: every element with data-state="x" is shown only when state x is active.
  function setupStates() {
    const nodes = [...document.querySelectorAll('[data-state]')];
    // data-state may list several states: data-state="default error".
    const states = [...new Set(nodes.flatMap(n => n.dataset.state.split(' ')))];
    if (!states.length) return;
    const LABEL = {default: 'Bình thường', loading: 'Đang tải', empty: 'Trống', error: 'Lỗi', 'rate-limit': 'Quá số lần', saved: 'Đã lưu'};
    const params = new URLSearchParams(location.search);
    const show = s => {
      nodes.forEach(n => n.classList.toggle('wf-on', n.dataset.state.split(' ').includes(s)));
      document.querySelectorAll('.wf-state-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === s));
    };
    if (!params.has('shot')) {
      const panel = document.createElement('div');
      panel.className =
        'fixed bottom-20 left-3 z-50 flex flex-wrap items-center gap-1 rounded-xl border border-dashed border-primary/50 bg-card/95 p-1.5 text-xs shadow-lg lg:bottom-3';
      panel.setAttribute('aria-label', 'Wireframe: đổi trạng thái màn hình');
      panel.innerHTML =
        '<span class="px-1.5 font-semibold text-primary">WF</span>' +
        states
          .map(
            s =>
              `<button class="wf-state-btn rounded-md px-2 py-1 font-medium aria-pressed:bg-primary aria-pressed:text-white hover:bg-muted" data-s="${s}">${LABEL[s] ?? s}</button>`,
          )
          .join('');
      panel.addEventListener('click', e => e.target.dataset.s && show(e.target.dataset.s));
      document.body.append(panel);
    }
    const first = states.includes('default') ? 'default' : states[0];
    show(states.includes(params.get('state')) ? params.get('state') : first);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-app-nav]').forEach(renderNav);
    setupStates();
    window.lucide?.createIcons();
  });
})();
