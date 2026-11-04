/*
 * Shared wireframe runtime (P0-12). Load it in <head> BEFORE the Tailwind browser script:
 *   <script src="../assets/wf.js"></script>
 * It injects the theme tokens (same values as client/app/globals.css), the font and the icons,
 * renders the logo into <span data-logo="full|mark|full-light" data-size="32"></span>,
 * renders the app shell into <div data-app-nav="read"></div>, and adds a small panel to switch
 * the page between the states declared with data-state="…" (loading, empty, error…).
 * Wireframe-only helper: the real app builds these from shadcn components and the nav registry.
 *
 * Design language: airy white surfaces, deep navy text, one confident blue, soft blue→violet→pink glows
 * behind product visuals, large rounded cards with soft shadows, pill buttons, small uppercase eyebrows.
 */
(function () {
  const root = document.currentScript.src.replace(/assets\/wf\.js.*$/, '');

  // Theme: keep in sync with client/app/globals.css. Wireframes may change colours only here and there.
  document.head.insertAdjacentHTML(
    'beforeend',
    `<link rel="icon" href="${root}assets/logo-mark.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap">
<style type="text/tailwindcss">
@theme {
  --font-sans: 'Be Vietnam Pro', system-ui, sans-serif;
  --color-background: #f8f9fc;
  --color-foreground: #0b2545;
  --color-card: #ffffff;
  --color-primary: #1a5cff;
  --color-primary-strong: #0b44d6;
  --color-primary-foreground: #ffffff;
  --color-secondary: #edf3ff;
  --color-violet: #6e4bff;
  --color-sky: #3d7bff;
  --color-muted: #f1f4f9;
  --color-muted-foreground: #476788;
  --color-destructive: #c2261d;
  --color-border: #e3e8f1;
  --color-ring: #8fb2ff;
  --color-success: #0f7b4a;
  --color-success-soft: #e3f6ec;
  --color-warning: #8a4b00;
  --color-warning-soft: #fff3d6;
  --color-danger-soft: #fdeceb;
  --color-mark: #ffe7a0;
  --color-brand-yellow: #ffd25a;
  --radius-lg: 0.75rem;
  --shadow-soft: 0 1px 2px rgb(11 37 69 / 0.04), 0 8px 24px rgb(11 37 69 / 0.06);
  --shadow-lift: 0 2px 4px rgb(11 37 69 / 0.04), 0 24px 48px -12px rgb(11 37 69 / 0.16);
}
@layer base {
  * { border-color: var(--color-border); }
  html { -webkit-font-smoothing: antialiased; }
  body { background: var(--color-background); color: var(--color-foreground); font-family: var(--font-sans); }
  h1, h2, h3 { letter-spacing: -0.02em; }
  :focus-visible { outline: 3px solid var(--color-ring); outline-offset: 2px; }
  mark { background: var(--color-mark); color: inherit; border-radius: 3px; padding: 0 1px; }
  [data-state]:not(.wf-on) { display: none !important; }
}
@layer components {
  .btn { @apply inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-all disabled:opacity-50; }
  .btn-sm { @apply min-h-8 px-3.5 text-[13px]; }
  .btn-lg { @apply min-h-12 px-7 text-base; }
  .btn-icon { @apply size-10 min-h-0 px-0; }
  .btn-primary { @apply bg-primary text-white shadow-[0_6px_16px_-6px_rgb(26_92_255/0.6)] hover:bg-primary-strong; }
  .btn-dark { @apply bg-foreground text-white hover:bg-[#13345e]; }
  .btn-secondary { @apply border border-[#cfd8e6] bg-card text-foreground hover:border-foreground/40; }
  .btn-ghost { @apply text-foreground hover:bg-muted; }
  .btn-danger { @apply bg-destructive text-white hover:bg-red-800; }
  .card { @apply rounded-[20px] border bg-card shadow-soft; }
  .input { @apply min-h-11 w-full rounded-xl border border-[#cfd8e6] bg-card px-3.5 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15; }
  .label { @apply text-sm font-semibold; }
  .hint { @apply text-[13px] text-muted-foreground; }
  .eyebrow { @apply text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground; }
  .badge { @apply inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground; }
  .badge-primary { @apply bg-secondary text-primary; }
  .badge-success { @apply bg-success-soft text-success; }
  .badge-warning { @apply bg-warning-soft text-warning; }
  .badge-danger { @apply bg-danger-soft text-destructive; }
  .skeleton { @apply animate-pulse rounded-lg bg-muted; }
  .page { @apply mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10; }
  .display { @apply text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[60px]; }
  .h1 { @apply text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]; }
  .h2 { @apply text-lg font-semibold tracking-[-0.01em]; }
  .tile { @apply inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-[#f1ecff] text-primary; }
  /* Soft blue → violet → pink glow behind product visuals and hero bands. */
  .glow { background: radial-gradient(60% 80% at 15% 20%, #cfe0ff 0%, transparent 60%), radial-gradient(50% 70% at 85% 30%, #e4dcff 0%, transparent 60%), radial-gradient(60% 70% at 60% 100%, #ffe1f1 0%, transparent 60%), #f6f8ff; }
  .glow-strong { background: radial-gradient(55% 75% at 20% 25%, #9ec0ff 0%, transparent 62%), radial-gradient(50% 70% at 85% 25%, #c6b6ff 0%, transparent 60%), radial-gradient(60% 70% at 55% 100%, #ffc4e4 0%, transparent 62%), #eaf0ff; }
  .glow-dark { background: radial-gradient(60% 80% at 20% 0%, #2b5cff 0%, transparent 60%), radial-gradient(50% 70% at 90% 100%, #6e4bff 0%, transparent 60%), #0b2545; }
}
</style>`,
  );

  const icons = document.createElement('script');
  icons.src = 'https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js';
  icons.onload = () => window.lucide.createIcons({attrs: {'aria-hidden': 'true'}});
  document.head.append(icons);

  // Logo (same paths as assets/logo-mark.svg). Wordmark is live text in Be Vietnam Pro Bold.
  let logoId = 0;
  const mark = size => {
    const id = `lm-g${logoId++}`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" class="shrink-0"><defs><linearGradient id="${id}" x1="6" y1="2" x2="44" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#3D7BFF"/><stop offset=".55" stop-color="#1A5CFF"/><stop offset="1" stop-color="#6E4BFF"/></linearGradient></defs><rect width="48" height="48" rx="13" fill="url(#${id})"/><path d="M17.5 29h21.5l-2.6 8.5H15.2a1.8 1.8 0 0 1-1.7-2.3l1.2-4.4A2.6 2.6 0 0 1 17.5 29z" fill="#FFD25A"/><rect x="15" y="10" width="5.5" height="25.5" rx="2.75" fill="#fff"/><path d="M33.5 9.5l1.25 3.25L38 14l-3.25 1.25L33.5 18.5l-1.25-3.25L29 14l3.25-1.25z" fill="#fff"/></svg>`;
  };
  const logo = (kind = 'full', size = 32) =>
    kind === 'mark'
      ? mark(size)
      : `<span class="inline-flex items-center" style="gap:${size * 0.3}px">${mark(size)}<span class="font-bold leading-none tracking-[-0.03em] ${kind === 'full-light' ? 'text-white' : 'text-foreground'}" style="font-size:${size * 0.62}px">Lin<span class="${kind === 'full-light' ? 'text-[#b9cdff]' : 'text-primary'}">Master</span></span></span>`;
  function renderLogos() {
    document.querySelectorAll('[data-logo]').forEach(el => {
      el.innerHTML = logo(el.dataset.logo || 'full', +el.dataset.size || 32);
      if (!el.closest('a,button') && !el.hasAttribute('aria-hidden')) el.setAttribute('role', 'img');
      if (!el.getAttribute('aria-label') && !el.closest('a[aria-label]')) el.setAttribute('aria-label', 'LinMaster');
    });
  }

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
      `<a href="${root}${n.href}" class="${cls} ${n.id === active ? 'bg-secondary text-primary' : 'text-foreground/75 hover:bg-muted hover:text-foreground'}"${n.id === active ? ' aria-current="page"' : ''}><i data-lucide="${n.icon}" class="size-4" aria-hidden="true"></i>${n.label}</a>`;
    const tab = n =>
      `<a href="${root}${n.href}" class="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold ${n.id === active ? 'text-primary' : 'text-muted-foreground'}"${n.id === active ? ' aria-current="page"' : ''}><span class="inline-flex h-7 w-12 items-center justify-center rounded-full ${n.id === active ? 'bg-secondary' : ''}"><i data-lucide="${n.icon}" class="size-5" aria-hidden="true"></i></span>${n.label}</a>`;
    const more = NAV.filter(n => !MOBILE.includes(n.id));
    const moreActive = more.some(n => n.id === active);
    el.outerHTML = `
<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Bỏ qua tới nội dung</a>
<header class="sticky top-0 z-30 border-b bg-white/85 backdrop-blur-xl">
  <div class="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
    <a href="${root}02-app/home.html" class="mr-4 inline-flex rounded-xl" aria-label="LinMaster, về trang chủ">
      <span class="sm:hidden">${mark(32)}</span><span class="hidden sm:inline-flex">${logo('full', 30)}</span>
    </a>
    <nav aria-label="Điều hướng chính" class="hidden flex-1 items-center gap-1 lg:flex">
      ${NAV.map(n => link(n, 'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold')).join('')}
    </nav>
    <div class="ml-auto flex items-center gap-1.5">
      <button class="btn btn-ghost btn-sm" aria-label="Đổi ngôn ngữ giao diện, đang là Tiếng Việt"><i data-lucide="globe" class="size-4" aria-hidden="true"></i>VI</button>
      <details class="relative">
        <summary class="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-gradient-to-br from-sky to-violet text-sm font-bold text-white ring-2 ring-white" aria-label="Tài khoản của Khải Hưng">KH</summary>
        <div class="absolute right-0 mt-2 w-60 rounded-2xl border bg-card p-2 shadow-lift">
          <div class="px-3 py-2"><p class="text-sm font-semibold">Khải Hưng</p><p class="hint">khaihung@example.com</p></div>
          <hr class="my-1">
          <a href="${root}02-app/profile.html" class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted"><i data-lucide="user" class="size-4" aria-hidden="true"></i>Hồ sơ</a>
          <a href="${root}07-stats/dashboard.html" class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted"><i data-lucide="chart-column" class="size-4" aria-hidden="true"></i>Dashboard</a>
          <a href="${root}01-public/landing.html" class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-destructive hover:bg-danger-soft"><i data-lucide="log-out" class="size-4" aria-hidden="true"></i>Đăng xuất</a>
        </div>
      </details>
    </div>
  </div>
</header>
<nav aria-label="Điều hướng chính" class="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
  ${NAV.filter(n => MOBILE.includes(n.id)).map(tab).join('')}
  <details class="flex flex-1">
    <summary class="flex flex-1 cursor-pointer list-none flex-col items-center gap-1 py-2 text-[11px] font-semibold ${moreActive ? 'text-primary' : 'text-muted-foreground'}"><span class="inline-flex h-7 w-12 items-center justify-center rounded-full ${moreActive ? 'bg-secondary' : ''}"><i data-lucide="ellipsis" class="size-5" aria-hidden="true"></i></span>Thêm</summary>
    <div class="fixed inset-x-0 bottom-[68px] mx-3 rounded-3xl border bg-card p-2 shadow-lift">
      ${more.map(n => link(n, 'flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold')).join('')}
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
    const LABEL = {
      default: 'Bình thường', loading: 'Đang tải', empty: 'Trống', error: 'Lỗi', 'rate-limit': 'Quá số lần',
      saved: 'Đã lưu', saving: 'Đang lưu', 'save-error': 'Lưu lỗi', new: 'Hộp tạo mới', 'upload-error': 'File lỗi',
      'lookup-loading': 'AI đang tra', quota: 'Hết quota AI', 'scan-loading': 'Đang quét', scan: 'Kết quả lọc',
      detail: 'Chi tiết', 'no-result': 'Không khớp', paste: 'Dán nhanh', publish: 'Hỏi đăng lên',
      published: 'Công khai', hidden: 'Bị ẩn', front: 'Mặt trước', back: 'Mặt sau', end: 'Hết bộ',
      question: 'Câu hỏi', answer: 'Đáp án', summary: 'Tổng kết', 'review-error': 'Lỗi gửi',
      choice: 'Trắc nghiệm', correct: 'Đúng', typed: 'Tự gõ', wrong: 'Sai', truefalse: 'Đúng/Sai', result: 'Kết quả',
      playing: 'Đang chơi', finished: 'Xong', setup: 'Thiết lập', generating: 'AI đang soạn', checked: 'Đã chấm',
      menu: 'Menu chuột phải', note: 'Ghi chú', settings: 'Settings', help: 'Help', submit: 'Nộp bài', hide: 'Hide',
      warn: 'Cảnh báo giờ', offline: 'Mất mạng', 'sound-check': 'Thử âm thanh', resume: 'Vào lại', review: '2 phút cuối',
      transition: 'Chuyển Reading', invalid: 'File sai', uploading: 'Đang tải lên', parsing: 'Đang xử lý',
      done: 'Thành công', failed: 'Thất bại', 'in-progress': 'Đang làm dở', explain: 'AI giải thích',
      tests: 'Tab Đề thi', copied: 'Đã chép', report: 'Báo cáo',
    };
    const params = new URLSearchParams(location.search);
    const show = s => {
      nodes.forEach(n => n.classList.toggle('wf-on', n.dataset.state.split(' ').includes(s)));
      document.querySelectorAll('.wf-state-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === s));
    };
    if (!params.has('shot')) {
      const panel = document.createElement('div');
      panel.className =
        'group fixed right-3 top-16 z-50 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-1 rounded-xl border border-dashed border-primary/50 bg-card/95 p-1.5 text-xs shadow-lg';
      panel.setAttribute('aria-label', 'Wireframe: đổi trạng thái màn hình');
      // "WF" collapses the panel so it never hides the screen underneath.
      panel.innerHTML =
        '<button class="rounded-md px-1.5 py-1 font-semibold text-primary" aria-label="Thu gọn hoặc mở bảng trạng thái" onclick="this.parentElement.classList.toggle(\'wf-min\')">WF</button>' +
        states
          .map(
            s =>
              `<button class="wf-state-btn rounded-md px-2 py-1 group-[.wf-min]:hidden font-medium aria-pressed:bg-primary aria-pressed:text-white hover:bg-muted" data-s="${s}">${LABEL[s] ?? s}</button>`,
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
    renderLogos();
    setupStates();
    window.lucide?.createIcons({attrs: {'aria-hidden': 'true'}});
  });
})();
