import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/ui/Logo';
import Button from '../../components/ui/Button';
import Field from '../../components/ui/Field';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError({ message: 'Please enter your email and password.' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      toast.success('Welcome back', { description: 'You are signed in as admin.' });
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError({ message: err.message, limited: err.status === 429 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-wrap bg-canvas">
      <section className="relative flex min-h-[300px] flex-[1_1_420px] flex-col justify-between gap-10 overflow-hidden bg-ink p-8 text-white sm:p-12">
        <svg width="560" height="560" viewBox="0 0 560 560" className="absolute -right-44 -bottom-44" aria-hidden="true">
          <circle cx="280" cy="280" r="240" fill="none" stroke="#4F46E5" strokeWidth="60" opacity="0.5" />
          <circle cx="280" cy="280" r="110" fill="#F97316" opacity="0.9" />
        </svg>
        <div className="relative">
          <Logo dark />
        </div>
        <div className="relative flex max-w-[440px] flex-col gap-3.5">
          <h1 className="font-display text-[clamp(34px,4vw,48px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
            Run every event from one dashboard.
          </h1>
          <p className="text-[17px] text-mist">Create events, watch seats fill up, and export attendee lists in one click.</p>
        </div>
      </section>

      <section className="flex flex-[1_1_420px] items-center justify-center px-4 py-12 sm:px-6">
        <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-[400px] flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-[32px] font-bold tracking-tight">Admin sign in</h2>
            <p className="text-muted">Use the admin email and password set in the server settings.</p>
          </div>

          {error && (
            <div
              role="alert"
              className={`flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-sm ${
                error.limited ? 'bg-ember-50 text-ember-800' : 'bg-danger-wash text-red-800'
              }`}
            >
              <AlertCircle className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
              <span>{error.message}</span>
            </div>
          )}

          <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-semibold">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field !pr-13"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-[10px] text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <Button type="submit" size="lg" loading={submitting} className="font-bold">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <Link to="/" className="flex min-h-11 items-center justify-center text-[15px] font-semibold text-brand-600 hover:text-brand-800">
            ← Back to the public site
          </Link>
        </form>
      </section>
    </div>
  );
}
