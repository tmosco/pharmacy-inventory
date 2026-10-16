import { ProductSearch } from "../components/ProductSearch";
import { searchProducts } from "../data/searchProducts";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";

export interface DashboardProps {
  purchaseState?: "empty" | "error";
}

export function Dashboard({ purchaseState = "empty" }: DashboardProps) {
  function handleAddProduct() {
    window.alert("Demo only: the product form is not connected yet.");
  }

  function handleRetry() {
    window.alert("Demo only: no request is made. A real retry comes later.");
  }

  return (
    <main className="dashboard">
      <p className="demo-notice">
        Day 1 + Day 2 practice · Sample figures only. Nothing is saved.
      </p>

      <PageHeader
        title="Inventory dashboard"
        subtitle="Main branch · An overview of your products and stock."
        action={<Button onClick={handleAddProduct}>Add product</Button>}
      />

      <section className="stats-grid" aria-label="Inventory summary">
        <StatCard
          title="Total products"
          value={143}
          helpText="Sample catalog count"
        />
        <StatCard
          title="Stock value"
          value="₦1,250,000"
          helpText="Sample inventory valuation"
        />
        <StatCard
          title="Low-stock products"
          value={7}
          helpText="At or below their thresholds"
          tone="warning"
        />
        <StatCard
          title="Expiring soon"
          value={4}
          helpText="Within the next 30 days"
          tone="danger"
        />
      </section>

      <section className="panel" aria-labelledby="purchases-heading">
        <div className="panel-heading">
          <h2 id="purchases-heading">Recent purchases</h2>
          <span className="badge">Demo panel</span>
        </div>

        {purchaseState === "error" ? (
          <ErrorMessage
            title="Purchases unavailable"
            message="We could not load recent purchases. Please try again."
            onRetry={handleRetry}
          />
        ) : (
          <EmptyState
            title="No recent purchases"
            description="Newly received purchases will appear here. This is a practice empty state."
          />
        )}
      </section>
      <ProductSearch products={searchProducts} />
    </main>
  );
}
