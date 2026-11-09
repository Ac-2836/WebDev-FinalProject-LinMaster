import {ChevronDown, type LucideIcon} from 'lucide-react';

export interface FeatureListProps {
  items: {icon: LucideIcon; title: string; body: string}[];
}

/** Collapsible feature points; the first one starts open (wireframe 01-public/landing). */
export function FeatureList({items}: FeatureListProps) {
  return (
    <div className="mt-8 divide-y border-y">
      {items.map(({icon: Icon, title, body}, i) => (
        <details key={title} open={i === 0} className="group py-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg font-semibold [&::-webkit-details-marker]:hidden">
            <Icon className="size-5 text-muted-foreground group-open:text-primary" aria-hidden="true" />
            {title}
            <ChevronDown
              className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="pb-3 pl-8 text-sm text-muted-foreground">{body}</p>
        </details>
      ))}
    </div>
  );
}
