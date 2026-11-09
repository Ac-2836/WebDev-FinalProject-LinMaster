import {CircleAlert} from 'lucide-react';
import {useId} from 'react';

export interface FormFieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Renders the control with the ids it needs for its label, hint and error. */
  children: (ids: {id: string; describedBy?: string; invalid: boolean}) => React.ReactNode;
}

/** Label + control + hint + error, wired up for screen readers. */
export function FormField({label, hint, error, children}: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children({id, describedBy, invalid: Boolean(error)})}
      {error && (
        <p id={errorId} className="flex items-center gap-1 text-[13px] text-destructive">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Field names that failed a Zod `safeParse`. */
export function invalidFields(issues: {path: PropertyKey[]}[]) {
  return new Set(issues.map(issue => String(issue.path[0])));
}

/** Target band choices allowed by the API (4.0–9.0, step 0.5). */
export const BANDS = Array.from({length: 11}, (_, i) => 4 + i * 0.5);
