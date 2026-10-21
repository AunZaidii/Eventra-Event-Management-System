import { seatsInfo } from '../../lib/format';

const BAR = { ok: 'bg-brand-600', low: 'bg-ember-600', danger: 'bg-danger' };
const TEXT = { ok: 'text-ink', low: 'text-ember-700', danger: 'text-danger' };

// Progress bar of seats taken, with "N seats left" text.
export default function SeatsBar({ event, height = 'h-1.5', showText = true }) {
  const info = seatsInfo(event);
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`${height} overflow-hidden rounded-full bg-[#EEF0F5]`}
        role="progressbar"
        aria-label="Seats taken"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={info.percent}
      >
        <div className={`h-full rounded-full ${BAR[info.tone]} transition-[width] duration-500`} style={{ width: `${info.percent}%` }} />
      </div>
      {showText && <span className={`text-[13px] font-semibold ${TEXT[info.tone]}`}>{info.text}</span>}
    </div>
  );
}
