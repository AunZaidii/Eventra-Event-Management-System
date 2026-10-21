// Date helpers. The API stores UTC; everything is shown in the viewer's local time.
const locale = undefined; // use the browser's locale

export const formatDateLong = (iso) =>
  new Date(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateShort = (iso) =>
  new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

export const formatTime = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

export const formatDateTime = (iso) => `${formatDateShort(iso)} · ${formatTime(iso)}`;

export const formatStamp = (iso) =>
  new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const monthShort = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

export const dayOfMonth = (iso) => String(new Date(iso).getDate()).padStart(2, '0');

// ISO string -> value for <input type="datetime-local"> in local time
export function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// <input type="datetime-local"> value (local time) -> ISO string in UTC
export function fromLocalInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export const formatNumber = (n) => Number(n || 0).toLocaleString(locale);

// "Only 6 seats left", "42 of 300 seats left", "Sold out"
export function seatsInfo(event) {
  const { seatsLeft, capacity } = event;
  const used = capacity ? Math.round(((capacity - seatsLeft) / capacity) * 100) : 0;
  if (seatsLeft <= 0) return { text: 'Sold out', tone: 'danger', percent: 100 };
  if (seatsLeft / capacity <= 0.15) {
    return { text: `Only ${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left`, tone: 'low', percent: used };
  }
  return { text: `${formatNumber(seatsLeft)} of ${formatNumber(capacity)} seats left`, tone: 'ok', percent: used };
}
