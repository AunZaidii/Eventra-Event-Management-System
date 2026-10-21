import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, downloadFile, toQuery } from '../../lib/api';
import { useDebounce, useFetch } from '../../hooks/useFetch';
import { formatDateShort, formatNumber, formatStamp } from '../../lib/format';
import Button from '../../components/ui/Button';
import Pager from '../../components/ui/Pager';
import { EmptyState, ErrorState, PageLoader, Skeleton } from '../../components/ui/States';

const PAGE_SIZE = 20;

export default function Registrations() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const q = useDebounce(search.trim(), 300);

  // Event picker options (up to 100 events, upcoming first).
  const events = useFetch((signal) => api('/admin/events?limit=100', { auth: true, signal }), []);
  const eventList = events.data?.items || [];
  const selectedId = Number(params.get('event')) || eventList[0]?.id || null;
  const selected = eventList.find((e) => e.id === selectedId);

  const regs = useFetch(
    (signal) =>
      selectedId
        ? api(`/admin/events/${selectedId}/registrations${toQuery({ q, page, limit: PAGE_SIZE })}`, { auth: true, signal })
        : Promise.resolve(null),
    [selectedId, q, page],
  );

  function pickEvent(id) {
    setParams({ event: id }, { replace: true });
    setPage(1);
    setSearch('');
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const name = await downloadFile(`/admin/events/${selectedId}/registrations/export`, 'registrations.csv');
      toast.success('CSV downloaded', { description: name });
    } catch (err) {
      toast.error('Export failed', { description: err.message });
    } finally {
      setExporting(false);
    }
  }

  if (events.loading) return <PageLoader label="Loading events…" />;
  if (events.error) return <ErrorState title="Couldn't load events" message={events.error.message} onRetry={events.reload} />;

  const items = regs.data?.items || [];
  const total = regs.data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Registrations</h1>
          <p className="mt-0.5 text-muted">See who signed up and download the list.</p>
        </div>
        <Button onClick={exportCsv} loading={exporting} disabled={!selected || selected.registeredCount === 0} className="font-bold">
          {!exporting && <Download className="size-[18px]" aria-hidden="true" />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {eventList.length === 0 ? (
        <EmptyState title="No events yet" message="Create an event first — its registrations will show up here." action={<Button to="/admin/events/new">Create event</Button>} />
      ) : (
        <>
          <div className="flex flex-wrap items-stretch gap-4 rounded-card border border-line bg-surface p-5">
            <label className="flex flex-[2_1_280px] flex-col gap-1.5 text-[13px] font-semibold text-muted">
              Event
              <select value={selectedId || ''} onChange={(e) => pickEvent(e.target.value)} className="field font-semibold">
                {eventList.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {formatDateShort(e.startsAt)}
                    {e.isPast ? ' (past)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <>
                <Summary label="Registered" value={formatNumber(selected.registeredCount)} />
                <Summary label="Seats left" value={formatNumber(selected.seatsLeft)} />
              </>
            )}
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <label className="flex min-h-[42px] flex-[0_1_320px] items-center gap-2.5 rounded-[10px] border border-line px-3 focus-within:border-brand-600">
                <Search className="size-4 text-muted" aria-hidden="true" />
                <span className="sr-only">Search registrations</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, email or code"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              {!regs.loading && regs.data && (
                <span className="text-sm text-muted">
                  {total === 0
                    ? 'No results'
                    : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${formatNumber(total)}`}
                </span>
              )}
            </div>

            {regs.error && (
              <div className="p-5">
                <ErrorState title="Couldn't load registrations" message={regs.error.message} onRetry={regs.reload} />
              </div>
            )}

            {!regs.error && regs.loading && (
              <div className="flex flex-col gap-3 p-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}

            {!regs.error && !regs.loading && items.length === 0 && (
              <div className="p-5">
                <EmptyState
                  icon={Users}
                  title={q ? 'No matching registrations' : 'No registrations yet'}
                  message={q ? 'Try a different name, email or code.' : 'When people sign up for this event, they will show up here.'}
                />
              </div>
            )}

            {!regs.error && !regs.loading && items.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] border-collapse text-[15px]">
                    <thead>
                      <tr className="text-left text-xs tracking-wider text-muted uppercase">
                        <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Email</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Phone</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Code</th>
                        <th scope="col" className="px-5 py-3 font-semibold">Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-[#F9FAFC]">
                          <td className="border-t border-[#F0F1F5] px-5 py-3">
                            <span className="flex items-center gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-bold text-brand-700">
                                {initials(r.name)}
                              </span>
                              <span className="font-semibold">{r.name}</span>
                            </span>
                          </td>
                          <td className="border-t border-[#F0F1F5] px-3 py-3 text-ink-2">{r.email}</td>
                          <td className="border-t border-[#F0F1F5] px-3 py-3 whitespace-nowrap text-ink-2">{r.phone}</td>
                          <td className="border-t border-[#F0F1F5] px-3 py-3">
                            <span className="rounded-lg bg-canvas px-2 py-1 font-mono text-[13px] font-semibold">{r.code}</span>
                          </td>
                          <td className="border-t border-[#F0F1F5] px-5 py-3 whitespace-nowrap text-muted">{formatStamp(r.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pages > 1 && <Pager page={page} pages={pages} onChange={setPage} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="flex flex-[1_1_140px] flex-col justify-center border-l border-[#F0F1F5] px-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="font-display text-[28px] font-extrabold tracking-tight">{value}</span>
    </div>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
