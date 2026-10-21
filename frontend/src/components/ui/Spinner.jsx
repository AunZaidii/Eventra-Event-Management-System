export default function Spinner({ className = 'size-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.2-8.6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
