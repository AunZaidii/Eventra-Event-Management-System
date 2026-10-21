import { Link } from 'react-router-dom';
import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
  dark: 'bg-ink text-white hover:bg-brand-700',
  secondary: 'border border-line bg-surface text-ink hover:border-brand-300',
  danger: 'bg-danger text-white hover:bg-red-800',
  ghost: 'text-brand-600 hover:bg-brand-50 hover:text-brand-800',
};

const SIZES = {
  sm: 'min-h-10 px-3.5 text-sm rounded-[10px]',
  md: 'min-h-12 px-5 text-base rounded-btn',
  lg: 'min-h-[52px] px-6 text-base rounded-btn',
};

// One button style for the whole app. Pass `to` to render a router link instead.
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  to,
  href,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  const classes = `inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:border-transparent ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }
  return (
    <button
      type={type}
      className={`${classes} ${loading ? 'cursor-progress !bg-brand-800 !text-white' : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="size-[18px]" />}
      {children}
    </button>
  );
}
