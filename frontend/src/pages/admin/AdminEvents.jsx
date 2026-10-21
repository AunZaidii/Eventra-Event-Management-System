import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, toQuery } from '../../lib/api';
import { useDebounce, useFetch } from '../../hooks/useFetch';
import { categoryTint } from '../../lib/categories';
import { formatDateTime, formatNumber } from '../../lib/format';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pager from '../../components/ui/Pager';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';

const PAGE_SIZE = 20;

function statusOf(e) {
  if (e.isPast) return { label: 'Past', cls: 'bg-slate-100 text-slate-600' };
  if (e.isSoldOut) return { label: 'Sold out', cls: 'bg-danger-soft text-danger' };
  return { label: 'Upcoming', cls: 'bg-brand-50 text-brand-700' };
}

export default function AdminEvents() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search.trim(), 300);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const list = useFetch(
    (signal) => api(`/admin/events${toQuery({ q, status, page, limit: PAGE_SIZE })}`, { auth: true, signal }),
    [q, status, page],
  );
  const items = list.data?.items || [];
  const total = list.data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api(`/admin/events/${toDelete.id}`, { method: 'DELETE', auth: true });
      toast.success('Event deleted', { description: toDelete.title });
      setToDelete(null);
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else list.reload();
    } catch (err) {
      toast.error('Could not delete event', { description: err.message });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Events</h1>
          <p className="mt-0.5 text-muted">{list.loading ? 'Loading…' : `${formatNumber(total)} ${total === 1 ? 'event' : 'events'}`}</p>
        </div>
        <Button to="/admin/events/new" className="font-bold">
          <Plus className="size-[18px]" strokeWidth={2.5} aria-hidden="true" /> New event
        </Button>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <label className="flex min-h-[46px] flex-[1_1_260px] items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 focus-within:border-brand-600">
          <Search className="size-[18px] text-muted" aria-hidden="true" />
          <span className="sr-only">Search events</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title or location"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          />
        </label>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="field !min-h-[46px] !w-auto"
        >
          <option value="">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="soldout">Sold out</option>
        </select>
      </div>

      {list.error && <ErrorState title="Couldn't load events" message={list.error.message} onRetry={list.reload} />}

      {!list.error && !list.loading && items.length === 0 && (
        <EmptyState
          title={q || status ? 'No events match' : 'No events yet'}
          message={q || status ? 'Try a different search or status.' : 'Create your first event and it will appear on the homepage.'}
          action={!q && !status && <Button to="/admin/events/new">Create event</Button>}
        />
      )}

      {!list.error && (list.loading || items.length > 0) && (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-xs tracking-wider text-muted uppercase">
                  <th scope="col" className="border-b border-line px-5 py-3.5 font-semibold">Event</th>
                  <th scope="col" className="border-b border-line px-3 py-3.5 font-semibold">Date</th>
                  <th scope="col" className="border-b border-line px-3 py-3.5 font-semibold">Status</th>
                  <th scope="col" className="w-44 border-b border-line px-3 py-3.5 font-semibold">Seats</th>
                  <th scope="col" className="border-b border-line px-5 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.loading
                  ? Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="border-b border-[#F0F1F5] px-5 py-3.5">
                          <Skeleton className="h-10 w-full" />
                        </td>
                      </tr>
                    ))
                  : items.map((e) => {
                      const st = statusOf(e);
                      const pct = Math.round((e.registeredCount / e.capacity) * 100);
                      return (
                        <tr key={e.id} className="transition-colors hover:bg-[#F9FAFC]">
                          <td className="border-b border-[#F0F1F5] px-5 py-3.5">
                            <span className="flex items-center gap-3.5">
                              <span className="h-10 w-13 shrink-0 overflow-hidden rounded-[10px]" style={{ backgroundColor: categoryTint(e.category).bg }}>
                                {e.bannerUrl && (
                                  <img src={e.bannerUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" onError={(ev) => (ev.currentTarget.style.display = 'none')} />
                                )}
                              </span>
                              <span className="flex min-w-0 flex-col">
                                <span className="font-semibold">{e.title}</span>
                                <span className="text-[13px] text-muted">
                                  {e.category} · {e.location}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="border-b border-[#F0F1F5] px-3 py-3.5 whitespace-nowrap text-ink-2">{formatDateTime(e.startsAt)}</td>
                          <td className="border-b border-[#F0F1F5] px-3 py-3.5">
                            <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="border-b border-[#F0F1F5] px-3 py-3.5">
                            <span className="flex flex-col gap-1.5">
                              <span className="text-[13px] font-semibold tabular-nums">
                                {formatNumber(e.registeredCount)} / {formatNumber(e.capacity)}
                              </span>
                              <span className="block h-1.5 overflow-hidden rounded-full bg-[#EEF0F5]">
                                <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                              </span>
                            </span>
                          </td>
                          <td className="border-b border-[#F0F1F5] px-5 py-3.5">
                            <span className="flex justify-end gap-1">
                              <IconLink to={`/admin/registrations?event=${e.id}`} label={`Registrations for ${e.title}`} icon={Users} />
                              <IconLink to={`/admin/events/${e.id}/edit`} label={`Edit ${e.title}`} icon={Pencil} />
                              <button
                                type="button"
                                onClick={() => setToDelete(e)}
                                aria-label={`Delete ${e.title}`}
                                title="Delete"
                                className="flex size-10 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                              >
                                <Trash2 className="size-[18px]" aria-hidden="true" />
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {pages > 1 && <Pager page={page} pages={pages} onChange={setPage} />}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={toDelete ? `Delete “${toDelete.title}”?` : ''}
        message="This also deletes all of its registrations. This cannot be undone."
        confirmLabel="Delete event"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function IconLink({ to, label, icon: Icon }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="flex size-10 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </Link>
  );
}
