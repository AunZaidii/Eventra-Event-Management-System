import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import Button from './Button';

// Accessible confirm popup built on the native <dialog> element (focus trap + Esc for free).
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', loading, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !loading) onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[24px] bg-surface p-0 shadow-modal backdrop:bg-ink/50"
    >
      <div className="flex flex-col gap-4 p-7">
        <span className="flex size-13 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <Trash2 className="size-6" aria-hidden="true" />
        </span>
        <h2 id="confirm-title" className="text-[22px] font-bold">
          {title}
        </h2>
        {message && <p className="text-muted">{message}</p>}
        <div className="mt-2 flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
