import { Link } from "react-router";
import type { DashboardMetrics } from "../data/mockDashboard";

interface AttentionPanelProps {
  metrics: DashboardMetrics;
}

/** Counts come from the same metrics object used by the dashboard cards. */
export function AttentionPanel({ metrics }: AttentionPanelProps) {
  const attentionItems = [
    {
      id: "stock",
      count: metrics.outOfStock,
      title: "Products out of stock",
      description: "Review items with no sellable quantity",
      path: "/inventory",
      tone: "danger",
    },
    {
      id: "expiry",
      count: metrics.expiringSoon,
      title: "Purchase batches expiring soon",
      description: "Check stock expiring within 30 days",
      path: "/inventory",
      tone: "warning",
    },
    {
      id: "sync",
      count: metrics.pendingSync,
      title: "Changes awaiting sync",
      description: "Demo queue count; synchronization is not implemented",
      path: "/sync",
      tone: "neutral",
    },
  ] as const;

  return (
    <aside className="overview-panel" aria-labelledby="attention-title">
      <div className="overview-panel-heading">
        <div>
          <h2 id="attention-title">Needs attention</h2>
          <p>A short list of priority areas</p>
        </div>
      </div>
      <div className="overview-attention-list">
        {attentionItems.map((item) => (
          <Link className="overview-attention-item" to={item.path} key={item.id}>
            <span className={`overview-attention-count overview-attention-count--${item.tone}`}>
              {item.count}
            </span>
            <span className="overview-attention-copy">
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </span>
            <span aria-hidden="true" className="overview-attention-arrow">→</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
