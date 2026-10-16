import { Button } from "./Button";

export interface ErrorMessageProps {
  message: string;
  title?: string;
  onRetry?: () => void;
}

export function ErrorMessage({
  message,
  title = "Something went wrong",
  onRetry,
}: ErrorMessageProps) {
  return (
    <div className="error-message" role="alert">
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>

      {onRetry && (
        <Button
          variant="secondary"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}