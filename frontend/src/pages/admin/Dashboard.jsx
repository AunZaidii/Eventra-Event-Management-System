import { Link } from 'react-router-dom';
import { CalendarClock, CalendarDays, Plus, Ticket, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useFetch } from '../../hooks/useFetch';
import { dayOfMonth, formatNumber, monthShort } from '../../lib/format';
import Button from '../../components/ui/Button';
import { ErrorState, Skeleton } from '../../components/ui/States';
import RegistrationsChart from '../../components/admin/RegistrationsChart';

export default function Dashboard() {
  const { data, error, loading, reload } = useFetch((signal) => api('/admin/stats', { auth: true, signal }), []);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{today}</p>
          <h1 className="mt-0.5 font-display text-4xl font-extrabold tracking-[-0.03em]">Dashboard</h1>
        </div>
        <Button to="/admin/events/new" className="font-bold">
          <Plus className="size-[18px]" strokeWidth={2.5} aria-hidden="true" /> New event
        </Button>
      </div>

      {error && <ErrorState title="Couldn't load dashboard" message={error.message} onRetry={reload} />}

      {!error && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
            <StatCard loading={loading} label="Total events" value={data?.totalEvents} icon={CalendarDays} tint="bg-brand-50 text-brand-700" sub={data && `${formatNumber(data.upcomingEvents)} upcoming · ${formatNumber(data.totalEvents - data.upcomingEvents)} past`} />
            <StatCard loading={loading} label="Total registrations" value={data?.totalRegistrations} icon={Users} tint="bg-success-soft text-success" sub="across all events" />
            <StatCard loading={loading} label="Upcoming events" value={data?.upcomingEvents} icon={CalendarClock} tint="bg-ember-50 text-ember-700" sub={data?.nextEvents?.[0] ? `next: ${data.nextEvents[0].title}` : 'none scheduled'} />
            <StatCard loading={loading} label="Sold-out events" value={data?.soldOutEvents} icon={Ticket} tint="bg-danger-soft text-danger" sub="no seats left" />
          </div>

          <div className="flex flex-wrap items-start gap-5">
            {loading ? (
              <Skeleton className="h-[360px] flex-[2_1_520px] rounded-card" />
            ) : (
              <RegistrationsChart data={data.perEvent} />
            )}

            <section aria-labelledby="next-title" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-card border border-line bg-surface p-6">
              <h2 id="next-title" className="text-lg font-bold">
                Coming up next
              </h2>
              {loading &&
                Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              {!loading && data.nextEvents.length === 0 && <p className="py-6 text-muted">No upcoming events yet.</p>}
              {!loading &&
                data.nextEvents.map((e) => (
                  <Link
                    key={e.id}
                    to={`/admin/registrations?event=${e.id}`}
                    className="-mx-2.5 flex items-center gap-3.5 rounded-[14px] p-2.5 transition-colors hover:bg-canvas"
                  >
                    <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-brand-50 py-1.5">
                      <span className="text-[10px] font-bold tracking-widest text-brand-700">{monthShort(e.startsAt)}</span>
                      <span className="font-display text-lg leading-tight font-extrabold">{dayOfMonth(e.startsAt)}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{e.title}</span>
                      <span className="text-[13px] text-muted">
                        {e.registrations >= e.capacity
                          ? `Sold out · ${formatNumber(e.registrations)} / ${formatNumber(e.capacity)}`
                          : `${formatNumber(e.registrations)} / ${formatNumber(e.capacity)} seats taken`}
                      </span>
                    </span>
                  </Link>
                ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, tint, loading }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-5.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted">{label}</span>
        <span className={`flex size-10 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-10 w-20" />
      ) : (
        <span className="font-display text-[40px] leading-none font-extrabold tracking-[-0.03em]">{formatNumber(value)}</span>
      )}
      <span className="truncate text-[13px] text-muted">{loading ? ' ' : sub}</span>
    </div>
  );
}
