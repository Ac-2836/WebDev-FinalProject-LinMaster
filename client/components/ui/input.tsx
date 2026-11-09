import {cn} from 'cn';

/** Text field and native select share this look (wireframe `.input`). */
export const inputClass =
  'min-h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none aria-invalid:border-destructive read-only:bg-muted';

function Input({className, ...props}: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export {Input};
