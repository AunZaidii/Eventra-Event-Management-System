import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { CATEGORIES } from '../../lib/categories';
import { fromLocalInputValue, toLocalInputValue } from '../../lib/format';
import EventCard from '../../components/events/EventCard';
import Button from '../../components/ui/Button';
import Field from '../../components/ui/Field';
import { ErrorState, PageLoader } from '../../components/ui/States';

const EMPTY = { title: '', category: 'Conference', location: '', description: '', startsAt: '', capacity: '100', bannerUrl: '' };

// Same rules as the API, checked in the browser first.
function validate(form, isNew) {
  const e = {};
  if (form.title.trim().length < 3) e.title = 'Title must be at least 3 characters';
  if (form.location.trim().length < 2) e.location = 'Location is required';
  if (form.description.trim().length < 10) e.description = 'Description must be at least 10 characters';
  const when = new Date(form.startsAt);
  if (!form.startsAt || Number.isNaN(when.getTime())) e.startsAt = 'Pick a date and time';
  else if (isNew && when.getTime() <= Date.now()) e.startsAt = 'Date must be in the future';
  const cap = Number(form.capacity);
  if (!Number.isInteger(cap) || cap < 1) e.capacity = 'Capacity must be a whole number of at least 1';
  else if (cap > 100000) e.capacity = 'Capacity is too large';
  if (form.bannerUrl.trim() && !/^https?:\/\/\S+$/i.test(form.bannerUrl.trim())) {
    e.bannerUrl = 'Banner URL must start with http:// or https://';
  }
  return e;
}

export default function EventEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return undefined;
    const controller = new AbortController();
    setLoading(true);
    api(`/admin/events/${id}`, { auth: true, signal: controller.signal })
      .then((ev) => {
        setOriginal(ev);
        setForm({
          title: ev.title,
          category: ev.category,
          location: ev.location,
          description: ev.description,
          startsAt: toLocalInputValue(ev.startsAt),
          capacity: String(ev.capacity),
          bannerUrl: ev.bannerUrl || '',
        });
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setLoadError(err);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, isNew]);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((err) => ({ ...err, [field]: undefined }));
  };

  // What the public card will look like with the current form values.
  const preview = useMemo(() => {
    const capacity = Math.max(1, Number(form.capacity) || 1);
    const registered = original?.registeredCount || 0;
    const startsAt = fromLocalInputValue(form.startsAt) || new Date(Date.now() + 86400000).toISOString();
    const seatsLeft = Math.max(0, capacity - registered);
    return {
      id: original?.id || 0,
      title: form.title.trim() || 'Your event title',
      category: form.category,
      location: form.location.trim() || 'Location',
      startsAt,
      capacity,
      seatsLeft,
      isSoldOut: seatsLeft === 0,
      bannerUrl: /^https?:\/\//i.test(form.bannerUrl.trim()) ? form.bannerUrl.trim() : null,
    };
  }, [form, original]);

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form, isNew);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    const body = {
      title: form.title.trim(),
      category: form.category,
      location: form.location.trim(),
      description: form.description.trim(),
      startsAt: fromLocalInputValue(form.startsAt),
      capacity: Number(form.capacity),
      bannerUrl: form.bannerUrl.trim() || null,
    };
    setSaving(true);
    try {
      const saved = await api(isNew ? '/admin/events' : `/admin/events/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        body,
        auth: true,
      });
      toast.success(isNew ? 'Event created' : 'Changes saved', {
        description: isNew ? `${saved.title} is now live on the homepage.` : saved.title,
      });
      navigate('/admin/events');
    } catch (err) {
      if (err.details.length) setErrors(err.fieldErrors);
      toast.error(isNew ? 'Could not create event' : 'Could not save changes', { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader label="Loading event…" />;
  if (loadError) {
    return (
      <ErrorState
        title={loadError.status === 404 ? 'Event not found' : "Couldn't load event"}
        message={loadError.status === 404 ? 'It may have been deleted.' : loadError.message}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/events" className="inline-flex min-h-9 items-center text-sm font-semibold text-brand-600 hover:text-brand-800">
          ← All events
        </Link>
        <h1 className="mt-0.5 font-display text-4xl font-extrabold tracking-[-0.03em]">{isNew ? 'New event' : 'Edit event'}</h1>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-[3_1_480px] flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:p-7">
          <Field label="Title" value={form.title} onChange={update('title')} error={errors.title} maxLength={150} required />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <Field as="select" label="Category" value={form.category} onChange={update('category')} error={errors.category}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Field>
            <Field label="Location" value={form.location} onChange={update('location')} error={errors.location} maxLength={200} placeholder="Venue name, city — or Online" required />
          </div>
          <Field as="textarea" rows={5} label="Description" value={form.description} onChange={update('description')} error={errors.description} maxLength={5000} required />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
            <Field
              type="datetime-local"
              label="Date and time"
              value={form.startsAt}
              onChange={update('startsAt')}
              error={errors.startsAt}
              hint="In your local time"
              required
            />
            <Field
              type="number"
              min={Math.max(1, original?.registeredCount || 1)}
              max={100000}
              step={1}
              label="Capacity"
              value={form.capacity}
              onChange={update('capacity')}
              error={errors.capacity}
              hint={original?.registeredCount ? `${original.registeredCount} already registered` : undefined}
              required
            />
          </div>
          <Field
            type="url"
            label="Banner image URL"
            value={form.bannerUrl}
            onChange={update('bannerUrl')}
            error={errors.bannerUrl}
            maxLength={2048}
            placeholder="https://…"
            hint="Optional. Paste a link to a wide image (16:9 works best). Images are not uploaded to the server."
          />
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#F0F1F5] pt-4">
            <Button variant="secondary" to="/admin/events">
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="font-bold">
              {saving ? 'Saving…' : isNew ? 'Create event' : 'Save changes'}
            </Button>
          </div>
        </form>

        <aside aria-label="Live preview" className="flex min-w-0 flex-[2_1_300px] flex-col gap-3 lg:sticky lg:top-8">
          <span className="text-xs font-semibold tracking-widest text-muted uppercase">Live preview</span>
          <div className="pointer-events-none" aria-hidden="true">
            <EventCard event={preview} />
          </div>
          <p className="text-[13px] text-muted">This is how the card appears on the public homepage.</p>
        </aside>
      </div>
    </div>
  );
}
