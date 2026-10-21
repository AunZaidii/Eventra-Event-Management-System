import { useId } from 'react';
import { AlertCircle } from 'lucide-react';

// Label + input/select/textarea + hint + error message, wired up for screen readers.
export default function Field({ label, error, hint, as = 'input', children, className = '', ...props }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const Control = as;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <Control
        id={id}
        className="field"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {children}
      </Control>
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
