import "./Feedback.css";

export interface ToastMessageProps {
  kind: "success" | "error";
  message: string;
  onDismiss: () => void;
}

/** Feedback visible until dismissed: no extra toast-library dependency. */
export function ToastMessage({ kind, message, onDismiss }: ToastMessageProps) {
  return (
    <div
      className={`app-toast app-toast--${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
}
