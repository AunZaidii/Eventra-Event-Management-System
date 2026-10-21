import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useFetch } from '../hooks/useFetch';
import { categoryTint } from '../lib/categories';
import { formatDateLong, formatNumber, formatTime, seatsInfo } from '../lib/format';
import EventBanner from '../components/events/EventBanner';
import SeatsBar from '../components/events/SeatsBar';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import { ErrorState, Skeleton } from '../components/ui/States';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

// Same rules as the API, checked first in the browser for instant feedback.
function validate(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = 'Please enter your full name';
  if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address';
  if (!PHONE_RE.test(form.phone.trim())) errors.phone = 'Enter a valid phone number';
  return errors;
}

export default function EventDetails() {
  const { id } = useParams();
  const { data: event, error, loading, reload, setData } = useFetch((signal) => api(`/events/${id}`, { signal }), [id]);

  if (loading) return <DetailsSkeleton />;
  if (error) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
        <ErrorState
          title={error.status === 404 ? 'Event not found' : "We couldn't load this event"}
          message={error.status === 404 ? 'It may have been removed or the link is wrong.' : error.message}
          onRetry={error.status === 404 ? undefined : reload}
        />
        <div className="mt-6 text-center">
          <Link to="/" className="font-semibold text-brand-600 hover:text-brand-800">
            ← Back to all events
          </Link>
        </div>
      </div>
    );
  }

  const tint = categoryTint(event.category);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-6 pb-20 sm:px-6">
      <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-brand-600 hover:text-brand-800">
        <ArrowLeft className="size-[18px]" aria-hidden="true" /> Back to all events
      </Link>

      <EventBanner
        src={event.bannerUrl}
        category={event.category}
        alt={event.title}
        iconSize="size-14"
        className="mt-3 aspect-[21/8] min-h-[220px] rounded-hero"
      />

      <div className="mt-8 flex flex-wrap items-start gap-10">
        <article className="flex min-w-0 flex-[999_1_560px] flex-col gap-7">
          <div className="flex flex-col gap-3.5">
            <span
              className="self-start rounded-full px-3 py-1 text-[13px] font-semibold"
              style={{ backgroundColor: tint.bg, color: tint.ink }}
            >
              {event.category}
            </span>
            <h1 className="font-display text-[clamp(34px,4.5vw,52px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
              {event.title}
            </h1>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
            <InfoTile icon={CalendarDays} label="Date" value={formatDateLong(event.startsAt)} />
            <InfoTile icon={Clock} label="Time" value={`${formatTime(event.startsAt)} (your time)`} />
            <InfoTile icon={MapPin} label="Location" value={event.location} />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-[22px] font-bold tracking-tight">About this event</h2>
            <p className="text-[17px] leading-[1.7] whitespace-pre-line text-ink-2">{event.description}</p>
          </section>
        </article>

        <RegistrationCard event={event} onEventChange={setData} />
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-[22px]" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="font-semibold">{value}</span>
      </span>
    </div>
  );
}

function RegistrationCard({ event, onEventChange }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const info = seatsInfo(event);
  const closed = event.isSoldOut || event.isPast;

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((err) => ({ ...err, [field]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const result = await api(`/events/${event.id}/registrations`, {
        method: 'POST',
        body: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
      });
      toast.success('Registration successful', { description: `See you at ${event.title}.` });
      navigate(`/events/${event.id}/registered?code=${encodeURIComponent(result.code)}`, {
        state: { registration: result.registration, event: result.event },
      });
    } catch (err) {
      if (err.code === 'DUPLICATE_REGISTRATION') {
        setErrors({ email: 'This email is already registered for this event.' });
        toast.error('Already registered', { description: `${form.email.trim()} is already on the list for this event.` });
      } else if (err.code === 'EVENT_FULL') {
        onEventChange((ev) => ({ ...ev, seatsLeft: 0, isSoldOut: true, registeredCount: ev.capacity }));
        toast.error('Sorry, this event is sold out', { description: 'Someone took the last seat a moment ago.' });
      } else if (err.code === 'VALIDATION_ERROR') {
        setErrors(err.fieldErrors);
      } else {
        toast.error(err.status === 429 ? 'Too many attempts' : 'Registration failed', { description: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside
      aria-label="Register"
      className="flex w-full min-w-0 flex-[1_1_360px] flex-col gap-5 rounded-[24px] border border-line bg-surface p-7 shadow-float md:max-w-[440px] lg:sticky lg:top-24"
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[22px] font-bold">Reserve your seat</h2>
          <span className={`text-sm font-semibold ${info.tone === 'danger' ? 'text-danger' : info.tone === 'low' ? 'text-ember-700' : 'text-ink'}`}>
            {event.isSoldOut ? 'Sold out' : `${formatNumber(event.seatsLeft)} seats left`}
          </span>
        </div>
        <SeatsBar event={event} height="h-2" showText={false} />
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <Users className="size-3.5" aria-hidden="true" /> Capacity {formatNumber(event.capacity)} · free entry
        </span>
      </div>

      {closed ? (
        <div className="flex flex-col items-center gap-3.5 rounded-[18px] bg-danger-wash p-5 text-center">
          <span className="rounded-full bg-danger px-4.5 py-2 text-sm font-bold tracking-wider text-white uppercase">
            {event.isPast ? 'Event ended' : 'Sold out'}
          </span>
          <p className="text-red-900">
            {event.isPast
              ? 'This event has already taken place.'
              : `All ${formatNumber(event.capacity)} seats are taken. Registration is closed for this event.`}
          </p>
          <Button disabled className="w-full" size="lg">
            Registration closed
          </Button>
          <Link to="/" className="flex min-h-11 items-center font-semibold text-brand-600 hover:text-brand-800">
            Browse other events
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Full name" autoComplete="name" placeholder="e.g. Sara Ahmed" maxLength={100} value={form.name} onChange={update('name')} error={errors.name} required />
          <Field label="Email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={255} value={form.email} onChange={update('email')} error={errors.email} required />
          <Field label="Phone" type="tel" autoComplete="tel" placeholder="+92 300 1234567" maxLength={20} value={form.phone} onChange={update('phone')} error={errors.phone} required />
          <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full font-bold">
            {submitting ? 'Registering…' : 'Register now'}
            {!submitting && <ArrowRight className="size-[18px]" aria-hidden="true" />}
          </Button>
          <p className="text-center text-[13px] text-muted">One registration per email. Your code appears on the next screen.</p>
        </form>
      )}
    </aside>
  );
}

function DetailsSkeleton() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-6 pb-20 sm:px-6" role="status" aria-label="Loading event">
      <Skeleton className="h-5 w-40" />
      <div className="skeleton mt-4 aspect-[21/8] min-h-[220px] rounded-hero" />
      <div className="mt-8 flex flex-wrap gap-10">
        <div className="flex flex-[999_1_560px] flex-col gap-4">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-[420px] flex-[1_1_360px] rounded-[24px] md:max-w-[440px]" />
      </div>
    </div>
  );
}
