import {cn} from 'cn';

/** Placeholder block while data loads. Put aria-busy on the region that is loading, not on each block. */
function Skeleton({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export {Skeleton};
