import { Link } from "react-router";
import type { DashboardAction } from "../data/mockDashboard";

interface QuickActionsProps {
  actions: readonly DashboardAction[];
}

/** Renders navigation links. The destination page owns the actual action. */
export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <section className="overview-section" aria-labelledby="quick-actions-title">
      <div className="overview-section-heading">
        <div>
          <h2 id="quick-actions-title">Quick actions</h2>
          <p>Go straight to the task you need.</p>
        </div>
      </div>
      <div className="overview-action-grid">
        {actions.map((action) => (
          <Link className="overview-action" key={action.id} to={action.path}>
            <span className="overview-action-icon" aria-hidden="true">{action.monogram}</span>
            <span className="overview-action-copy">
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </span>
            <span className="overview-action-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
