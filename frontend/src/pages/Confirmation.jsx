import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Check, Copy, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useFetch } from '../hooks/useFetch';
import { formatDateTime, formatStamp } from '../lib/format';
import Button from '../components/ui/Button';
import { ErrorState, PageLoader } from '../components/ui/States';

// Ticket-style confirmation. The code lives in the URL, so it survives a refresh;
// the visitor's details come from the registration step (not stored by the browser).
export default function Confirmation() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { state } = useLocation();
  const code = params.get('code');
  const registration = state?.registration;
  const event = useFetch(
    (signal) => (state?.event ? Promise.resolve(state.event) : api(`/events/${id}`, { signal })),
    [id],
  );

  if (!code) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState title="No registration code" message="Open this page right after registering for an event." />
      </div>
    );
  }
  if (event.loading) return <PageLoader />;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copied', { description: code });
    } catch {
      toast.error('Could not copy', { description: 'Please select the code and copy it manually.' });
    }
  }

  const ev = event.data;
  const firstName = registration?.name?.split(' ')[0];

  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center gap-7 px-4 pt-14 pb-20 text-center">
      <span className="flex size-[76px] items-center justify-center rounded-full bg-success-soft shadow-[0_0_0_10px_#F0FDF4]">
        <Check className="size-[38px] text-success" strokeWidth={2.5} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(32px,5vw,44px)] leading-tight font-extrabold tracking-[-0.03em]">
          {firstName ? `You're in, ${firstName}!` : "You're in!"}
        </h1>
        <p className="text-[17px] text-muted">Your seat is reserved. Keep this code — you'll need it at the entrance.</p>
      </div>

      <div className="w-full overflow-hidden rounded-[28px] border border-line bg-surface text-left shadow-[0_30px_60px_-32px_rgb(15_23_42/0.35)]">
        {ev && (
          <div className="flex flex-col gap-1.5 bg-ink px-7 py-6 text-white">
            <span className="text-xs font-semibold tracking-widest text-brand-300 uppercase">{ev.category}</span>
            <span className="font-display text-[26px] font-bold tracking-tight">{ev.title}</span>
            <span className="text-sm text-mist">
              {formatDateTime(ev.startsAt)} · {ev.location}
            </span>
          </div>
        )}
        <div className="relative h-0 border-t-2 border-dashed border-line" aria-hidden="true">
          <span className="absolute -top-3.5 -left-3.5 size-7 rounded-full border-r border-line bg-canvas" />
          <span className="absolute -top-3.5 -right-3.5 size-7 rounded-full border-l border-line bg-canvas" />
        </div>
        <div className="flex flex-col gap-5.5 p-7">
          <div className="flex flex-col items-center gap-2 rounded-[18px] bg-brand-50 p-5.5">
            <span className="text-xs font-semibold tracking-widest text-brand-700 uppercase">Registration code</span>
            <span className="font-mono text-[clamp(28px,6vw,40px)] font-bold tracking-[0.12em] select-all">{code}</span>
          </div>
          {registration && (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Detail label="Name" value={registration.name} />
              <Detail label="Email" value={registration.email} />
              <Detail label="Phone" value={registration.phone} />
              <Detail label="Registered" value={formatStamp(registration.createdAt)} />
            </dl>
          )}
        </div>
      </div>

      <div className="no-print flex flex-wrap justify-center gap-3">
        <Button onClick={copyCode} className="font-bold">
          <Copy className="size-[18px]" aria-hidden="true" /> Copy code
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="size-[18px]" aria-hidden="true" /> Print ticket
        </Button>
        <Button variant="secondary" to="/">
          Back to events
        </Button>
      </div>
      {ev && (
        <Link to={`/events/${ev.id}`} className="no-print text-sm font-semibold text-brand-600 hover:text-brand-800">
          View event details
        </Link>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="font-semibold break-words">{value}</dd>
    </div>
  );
}
