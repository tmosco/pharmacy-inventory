export interface StatCardProps {
  title: string;
  value: number | string;
  helpText?: string;
  tone?: "neutral" | "warning" | "danger";
}

export function StatCard({
  title,
  value,
  helpText,
  tone = "neutral",
}: StatCardProps) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <h2 className="stat-card__title">{title}</h2>

      <p className="stat-card__value">{value}</p>

      {helpText && <p className="muted">{helpText}</p>}
    </article>
  );
}