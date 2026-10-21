import { AlertTriangle, CalendarX } from 'lucide-react';
import Button from './Button';

// Friendly "nothing here yet" box.
export function EmptyState({ icon: Icon = CalendarX, title, message, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <span className="flex size-16 items-center justify-center rounded-[20px] bg-brand-50 text-brand-600">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h3 className="text-xl font-bold">{title}</h3>
      {message && <p className="max-w-sm text-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Error box with a retry button.
export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card border border-red-200 bg-danger-wash px-6 py-12 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-[20px] bg-danger-soft text-danger">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>
      <h3 className="text-xl font-bold text-red-900">{title}</h3>
      {message && <p className="max-w-sm text-red-900">{message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-2 !border-red-200 !text-red-900">
          Try again
        </Button>
      )}
    </div>
  );
}

// Grey shimmering placeholder blocks shown while loading.
export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface" aria-hidden="true">
      <div className="skeleton aspect-video" />
      <div className="flex flex-col gap-3 px-5 pt-5 pb-6">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

// Full-page loading indicator.
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <span className="flex items-center gap-3 font-medium text-muted">
        <span className="size-5 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
        {label}
      </span>
    </div>
  );
}
