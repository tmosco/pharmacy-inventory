import { useEffect, useRef } from "react";
import "./Feedback.css";

export interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A native modal dialog: keyboard focus stays inside while it is open. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="app-confirm"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      <div className="app-confirm__actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Keep active
        </button>
        <button
          type="button"
          className="app-confirm__danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Deactivating…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
