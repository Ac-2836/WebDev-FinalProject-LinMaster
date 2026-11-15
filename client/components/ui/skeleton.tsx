import {cn} from 'cn';

/** Placeholder block while data loads. Put aria-busy on the region that is loading, not on each block. */
function Skeleton({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        // A light band sweeps across the block; a plain block when the user asks for less motion.
        'animate-shimmer rounded-md bg-muted bg-[linear-gradient(90deg,var(--muted)_30%,#fafbfd_50%,var(--muted)_70%)] bg-size-[200%_100%] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export {Skeleton};
