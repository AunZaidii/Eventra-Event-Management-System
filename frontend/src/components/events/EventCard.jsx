import { Link } from 'react-router-dom';
import { CalendarDays, MapPin } from 'lucide-react';
import EventBanner from './EventBanner';
import SeatsBar from './SeatsBar';
import { categoryTint } from '../../lib/categories';
import { dayOfMonth, formatDateTime, monthShort } from '../../lib/format';

// The card used in the homepage grid.
export default function EventCard({ event }) {
  const tint = categoryTint(event.category);
  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface text-ink shadow-rest transition duration-200 hover:-translate-y-1 hover:shadow-lift focus-visible:-translate-y-1"
    >
      <EventBanner src={event.bannerUrl} category={event.category} className="aspect-video">
        <span
          className="absolute top-3.5 left-3.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold"
          style={{ color: tint.ink }}
        >
          {event.category}
        </span>
        <span className="absolute top-3.5 right-3.5 flex w-[54px] flex-col items-center rounded-[14px] bg-white py-1.5 shadow-md">
          <span className="text-[11px] font-bold tracking-widest text-danger">{monthShort(event.startsAt)}</span>
          <span className="font-display text-[22px] leading-tight font-extrabold">{dayOfMonth(event.startsAt)}</span>
        </span>
        {event.isSoldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/55">
            <span className="rounded-full bg-white px-4.5 py-2 text-sm font-bold tracking-wide text-danger uppercase">
              Sold out
            </span>
          </span>
        )}
      </EventBanner>

      <div className="flex flex-1 flex-col gap-2.5 px-5 pt-[18px] pb-5">
        <h3 className="text-[19px] leading-snug font-bold tracking-tight group-hover:text-brand-700">{event.title}</h3>
        <div className="flex flex-col gap-1.5 text-sm text-muted">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            {formatDateTime(event.startsAt)}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.location}</span>
          </span>
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <SeatsBar event={event} showText={false} />
          <div className="flex items-center justify-between text-[13px] font-semibold">
            <SeatsText event={event} />
            <span className="text-brand-600">Details →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SeatsText({ event }) {
  if (event.isSoldOut) return <span className="text-danger">Sold out</span>;
  const low = event.seatsLeft / event.capacity <= 0.15;
  return low ? (
    <span className="text-ember-700">Only {event.seatsLeft} left</span>
  ) : (
    <span>
      {event.seatsLeft} of {event.capacity} seats left
    </span>
  );
}
