import {useId} from 'react';

import {cn} from 'cn';

/** LinMaster mark. Same drawing as app/icon.svg (source: Analysis_Design/07_Wireframe/assets/logo-mark.svg). */
export function LogoMark({size = 32, className, star = true}: {size?: number; className?: string; star?: boolean}) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="6" y1="2" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D7BFF" />
          <stop offset=".55" stopColor="#1A5CFF" />
          <stop offset="1" stopColor="#6E4BFF" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      <path d="M17.5 29h21.5l-2.6 8.5H15.2a1.8 1.8 0 0 1-1.7-2.3l1.2-4.4A2.6 2.6 0 0 1 17.5 29z" fill="#FFD25A" />
      <rect x="15" y="10" width="5.5" height="25.5" rx="2.75" fill="#fff" />
      {star && <path d="M33.5 9.5l1.25 3.25L38 14l-3.25 1.25L33.5 18.5l-1.25-3.25L29 14l3.25-1.25z" fill="#fff" />}
    </svg>
  );
}

/** Mark + wordmark. Decorative: wrap it in a link or heading that carries the accessible name. */
export function Logo({size = 30, className}: {size?: number; className?: string}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      <span className="text-lg font-bold tracking-tight" aria-hidden="true">
        Lin<span className="text-primary">Master</span>
      </span>
    </span>
  );
}
