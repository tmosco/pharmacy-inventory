import { Link } from "react-router";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { AttentionPanel } from "../features/dashboard/components/AttentionPanel";
import { QuickActions } from "../features/dashboard/components/QuickActions";
import { RecentActivity } from "../features/dashboard/components/RecentActivity";
import {
  dashboardActions,
  mockDashboard,
  type DashboardData,
} from "../features/dashboard/data/mockDashboard";
import "./Dashboard.css";

export interface DashboardProps {
  /** Optional for practice: pass another data object to see the UI change. */
  data?: DashboardData;
}

/** Week 3 capstone: the dashboard arranges presentational components. */
export function Dashboard({ data = mockDashboard }: DashboardProps) {
  const { metrics } = data;
  return (
    <main className="dashboard overview-dashboard" id="dashboard-content">
      <p className="overview-demo-note" role="note">
        <span className="overview-demo-dot" aria-hidden="true" />
        Demo mode · Sample numbers only · No SQLite or live synchronization
      </p>
      <PageHeader
        title="Inventory overview"
        subtitle={`${data.branchLabel} · Stock, alerts and recent operations at a glance`}
        action={
          <Link className="overview-primary-action" to="/products">
            Open products <span aria-hidden="true">→</span>
          </Link>
        }
      />

      <section className="overview-metrics" aria-label="Inventory status summary">
        <div className="overview-metric-link-wrapper">
          <Link to="/products" aria-label={`Total products: ${metrics.products}. Open Products`}>
            <StatCard title="Total products" value={metrics.products} helpText="Catalog records" />
          </Link>
        </div>
        <div className="overview-metric-link-wrapper">
          <Link to="/inventory" aria-label={`Low stock: ${metrics.lowStock} products. Review Inventory`}>
            <StatCard title="Low stock" value={metrics.lowStock} helpText="Below or at reorder thresholds" tone="warning" />
          </Link>
        </div>
        <div className="overview-metric-link-wrapper">
          <Link to="/inventory" aria-label={`Out of stock: ${metrics.outOfStock} products. Review Inventory`}>
            <StatCard title="Out of stock" value={metrics.outOfStock} helpText="No sellable quantity" tone="danger" />
          </Link>
        </div>
        <div className="overview-metric-link-wrapper">
          <Link to="/inventory" aria-label={`Expiring soon: ${metrics.expiringSoon} purchase batches. Review Inventory`}>
            <StatCard title="Expiring soon" value={metrics.expiringSoon} helpText="Purchase batches · next 30 days" tone="warning" />
          </Link>
        </div>
        <div className="overview-metric-link-wrapper">
          <Link to="/inventory" aria-label={`Quarantined stock: ${metrics.quarantined} purchase batches. Review Inventory`}>
            <StatCard title="Quarantined stock" value={metrics.quarantined} helpText="Purchase batches on hold" tone="danger" />
          </Link>
        </div>
        <div className="overview-metric-link-wrapper">
          <Link to="/sync" aria-label={`Pending sync: ${metrics.pendingSync} mock queued changes. Open Sync`}>
            <StatCard title="Pending sync" value={metrics.pendingSync} helpText="Mock queued changes; not live" />
          </Link>
        </div>
      </section>

      <QuickActions actions={dashboardActions} />

      <div className="overview-lower-grid">
        <RecentActivity activities={data.recentActivity} />
        <AttentionPanel metrics={metrics} />
      </div>
      <p className="overview-footer-note">
        Figures are examples for interface review. Purchasing, stock allocation, alerts,
        and synchronization will be connected to a trusted data layer later.
      </p>
    </main>
  );
}
