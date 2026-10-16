import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>

        {subtitle && <p className="muted">{subtitle}</p>}
      </div>

      {action && (
        <div className="page-header__action">
          {action}
        </div>
      )}
    </header>
  );
}