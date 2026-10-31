import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, toQuery } from '../lib/api';
import { useDebounce, useFetch } from '../hooks/useFetch';
import { CATEGORIES } from '../lib/categories';
import { formatDateTime, formatNumber } from '../lib/format';
import EventCard from '../components/events/EventCard';
import CategoryChips from '../components/events/CategoryChips';
import Button from '../components/ui/Button';
import { EmptyState, ErrorState, EventCardSkeleton, Skeleton } from '../components/ui/States';

const PAGE_SIZE = 12;

export default function Home() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const from = params.get('from') || '';
  const sort = params.get('sort') || 'date';
  const q = params.get('q') || '';

  // The search box updates the URL shortly after typing stops.
  const [qInput, setQInput] = useState(q);
  const debouncedQ = useDebounce(qInput.trim(), 400);
  useEffect(() => {
    if (debouncedQ !== q) updateParam('q', debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  function updateParam(key, value) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const filters = { q, category, from, sort };
  const hasFilters = Boolean(q || category || from);
  const list = useFetch(
    (signal) => api(`/events${toQuery({ ...filters, page: 1, limit: PAGE_SIZE })}`, { signal }),
    [q, category, from, sort],
  );
  // Feature the soonest event that still has seats (fall back to the soonest one).
  const next = useFetch((signal) => api('/events?limit=10', { signal }), []);
  const nextEvent = next.data?.items?.find((e) => !e.isSoldOut) || next.data?.items?.[0];

  const [loadingMore, setLoadingMore] = useState(false);
  async function loadMore() {
    const page = Math.floor(list.data.items.length / PAGE_SIZE) + 1;
    setLoadingMore(true);
    try {
      const more = await api(`/events${toQuery({ ...filters, page, limit: PAGE_SIZE })}`);
      list.setData((d) => ({ ...more, items: [...d.items, ...more.items] }));
    } catch (err) {
      toast.error('Could not load more events', { description: err.message });
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setQInput('');
    setParams({}, { replace: true });
  }

  const items = list.data?.items || [];
  const total = list.data?.total || 0;

  return (
    <>
      {/* Hero */}
      <section className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-12 px-4 pt-12 pb-10 sm:px-6 lg:pt-16">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-6">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface py-1.5 pr-3 pl-1.5 text-sm font-medium text-ink-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[13px] font-semibold text-brand-700">New</span>
            Registrations are open for this season
          </span>
          <h1 className="font-display text-[clamp(40px,6vw,68px)] leading-[1.02] font-extrabold tracking-[-0.035em]">
            Find batool worth <span className="text-brand-600">showing up</span> for.
          </h1>
          <p className="max-w-[540px] text-lg text-muted">
            Conferences, workshops, meetups and concerts in one place. Pick an event, grab your seat in seconds, and get
            your registration code instantly.
          </p>

          <form
            role="search"
            aria-label="Search events"
            onSubmit={(e) => {
              e.preventDefault();
              updateParam('q', qInput.trim());
              document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex flex-wrap gap-2 rounded-[18px] border border-line bg-surface p-2 shadow-float"
          >
            <label className="flex min-h-[52px] min-w-0 flex-[2_1_160px] items-center gap-2.5 rounded-xl bg-canvas px-3.5">
              <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
              <span className="sr-only">Search</span>
              <input
                type="search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search events, venues…"
                maxLength={100}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/80"
              />
            </label>
            <label className="flex min-h-[52px] min-w-0 flex-[1_1_130px] flex-col justify-center rounded-xl bg-canvas px-3.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">Category</span>
              <select
                value={category}
                onChange={(e) => updateParam('category', e.target.value)}
                className="w-full min-w-0 bg-transparent text-[15px] font-medium outline-none"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex min-h-[52px] min-w-0 flex-[1_1_130px] flex-col justify-center rounded-xl bg-canvas px-3.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">From date</span>
              <input
                type="date"
                value={from}
                onChange={(e) => updateParam('from', e.target.value)}
                className="w-full min-w-0 bg-transparent text-[15px] font-medium outline-none"
              />
            </label>
            <Button type="submit" size="lg" className="flex-[0_0_auto] !rounded-xl">
              Search
            </Button>
          </form>
        </div>

        <NextUpCard event={nextEvent} loading={next.loading} />
      </section>

      {/* Category chips */}
      <section id="categories" className="mx-auto max-w-[1240px] px-4 pt-2 sm:px-6">
        <CategoryChips value={category} onChange={(c) => updateParam('category', c)} />
      </section>

      {/* Event grid */}
      <section id="events" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 pt-8 pb-20 sm:px-6" aria-busy={list.loading}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[34px] font-bold tracking-tight">Upcoming events</h2>
            <p className="mt-1 text-muted" aria-live="polite">
              {list.loading
                ? 'Loading events…'
                : `${formatNumber(total)} ${total === 1 ? 'event' : 'events'}${category ? ` in ${category}` : ' coming up'}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort by
              <select
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value === 'date' ? '' : e.target.value)}
                className="field !min-h-10 !w-auto !py-0 text-sm"
              >
                <option value="date">Soonest first</option>
                <option value="seats">Most seats left</option>
              </select>
            </label>
          </div>
        </div>

        {list.loading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-6">
            {Array.from({ length: 6 }, (_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!list.loading && list.error && (
          <ErrorState title="We couldn't load events" message={list.error.message} onRetry={list.reload} />
        )}

        {!list.loading && !list.error && items.length === 0 && (
          <EmptyState
            title={hasFilters ? 'No events match your filters' : 'No upcoming events yet'}
            message={
              hasFilters
                ? 'Try another category or clear the date to see everything coming up.'
                : 'New events will appear here as soon as they are announced.'
            }
            action={
              hasFilters && (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        )}

        {!list.loading && !list.error && items.length > 0 && (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-6">
              {items.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
            {items.length < total && (
              <div className="mt-10 flex justify-center">
                <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                  Load more events
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

// Dark "Next up" card + two small info tiles beside the hero.
function NextUpCard({ event, loading }) {
  return (
    <aside aria-label="Next event" className="grid min-w-0 flex-[1_1_380px] grid-cols-2 gap-3.5">
      <div className="relative col-span-2 flex flex-col gap-4.5 overflow-hidden rounded-[24px] bg-ink p-7 text-white">
        <svg width="220" height="220" viewBox="0 0 220 220" className="absolute -top-12 -right-12" aria-hidden="true">
          <circle cx="110" cy="110" r="100" fill="none" stroke="#4F46E5" strokeWidth="28" opacity="0.55" />
          <circle cx="110" cy="110" r="46" fill="#F97316" />
        </svg>
        <span className="relative self-start rounded-full bg-white/12 px-2.5 py-1 text-xs font-semibold tracking-wider uppercase">
          Next up
        </span>
        {loading ? (
          <div className="relative flex flex-col gap-3">
            <div className="h-8 w-3/4 rounded-lg bg-white/10" />
            <div className="h-4 w-1/2 rounded bg-white/10" />
          </div>
        ) : event ? (
          <>
            <div className="relative max-w-[300px] font-display text-[30px] leading-[1.1] font-bold tracking-tight">
              {event.title}
            </div>
            <div className="relative flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist">
              <span>{formatDateTime(event.startsAt)}</span>
              <span>{event.location}</span>
            </div>
            <Link
              to={`/events/${event.id}`}
              className="relative inline-flex min-h-11 items-center gap-2 self-start rounded-xl bg-white px-4.5 font-semibold text-ink transition-colors hover:bg-brand-50"
            >
              View event <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </>
        ) : (
          <p className="relative text-mist">No upcoming events right now — check back soon.</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 rounded-[20px] bg-ember-50 p-5">
        <span className="text-[13px] font-semibold text-ember-800">Seats left</span>
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <span className="font-display text-4xl font-extrabold tracking-tight">
            {event ? formatNumber(event.seatsLeft) : '—'}
          </span>
        )}
        <span className="text-[13px] text-muted">{event ? `of ${formatNumber(event.capacity)} for the next event` : 'for the next event'}</span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-[20px] bg-brand-50 p-5">
        <span className="text-[13px] font-semibold text-brand-700">Sign-up takes</span>
        <span className="font-display text-4xl font-extrabold tracking-tight">3 fields</span>
        <span className="text-[13px] text-muted">name, email, phone</span>
      </div>
    </aside>
  );
}
