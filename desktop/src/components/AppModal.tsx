import { useEffect, useRef, type ReactNode } from "react";
import "./AppModal.css";

interface AppModalProps {
  title: string;
  busy?: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}

/** Native modal focus management; one consistent close path for X and Escape. */
export function AppModal({ title, busy = false, onRequestClose, children }: AppModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      openerRef.current?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="inventory-modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onRequestClose();
      }}
    >
      <header className="inventory-modal__header">
        <h2>{title}</h2>
        <button
          type="button"
          className="inventory-modal__close"
          onClick={onRequestClose}
          disabled={busy}
          aria-label={`Close ${title}`}
        >×</button>
      </header>
      <div className="inventory-modal__body">{children}</div>
    </dialog>
  );
}
