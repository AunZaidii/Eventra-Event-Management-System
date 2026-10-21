import Button from './Button';

// "Page X of Y" with Previous / Next buttons, used under admin tables.
export default function Pager({ page, pages, onChange }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
      <span className="mr-auto text-sm text-muted">
        Page {page} of {pages}
      </span>
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </div>
  );
}
