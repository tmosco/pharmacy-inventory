/** Day 7 sample data, not a database query or a live sync status. */
export interface DashboardMetrics {
  readonly products: number;
  /** Products with stock > 0 but at/below their low-stock threshold. */
  readonly lowStock: number;
  /** Products with zero eligible sellable stock. */
  readonly outOfStock: number;
  /** Purchase batches expiring within 30 days, not already expired. */
  readonly expiringSoon: number;
  /** Purchase batches held in quarantine. */
  readonly quarantined: number;
  /** Mock locally queued changes, not a live synchronization status. */
  readonly pendingSync: number;
}

export type ActivityKind =
  | "RECEIVING"
  | "SALE"
  | "ADJUSTMENT"
  | "PRODUCT"
  | "SYNC";

export interface DashboardActivity {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly title: string;
  readonly detail: string;
  readonly occurredAt: string; // ISO-like local timestamp for mock records
  readonly displayTime: string;
}

export interface DashboardAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly path: string;
  readonly monogram: string;
}

export interface DashboardData {
  readonly branchLabel: string;
  readonly metrics: DashboardMetrics;
  readonly recentActivity: readonly DashboardActivity[];
}

export const mockDashboard: DashboardData = {
  branchLabel: "Main Branch",
  metrics: {
    products: 143,
    lowStock: 7,
    outOfStock: 3,
    expiringSoon: 4,
    quarantined: 2,
    pendingSync: 5,
  },
  recentActivity: [
    {
      id: "activity-001",
      kind: "RECEIVING",
      title: "Purchase received",
      detail: "20 units of Paracetamol added to Main Branch",
      occurredAt: "2026-10-20T08:25:00",
      displayTime: "20 Oct · 08:25",
    },
    {
      id: "activity-002",
      kind: "SALE",
      title: "Sale recorded",
      detail: "5 items sold; allocation follows purchase order",
      occurredAt: "2026-10-20T08:02:00",
      displayTime: "20 Oct · 08:02",
    },
    {
      id: "activity-003",
      kind: "ADJUSTMENT",
      title: "Stock moved to quarantine",
      detail: "One purchase batch marked unavailable for sale",
      occurredAt: "2026-10-19T16:40:00",
      displayTime: "19 Oct · 16:40",
    },
    {
      id: "activity-004",
      kind: "PRODUCT",
      title: "Product details updated",
      detail: "Storage location changed to Shelf A-01 · Top",
      occurredAt: "2026-10-19T12:18:00",
      displayTime: "19 Oct · 12:18",
    },
  ],
};

/** Links only navigate. They do not perform a transaction. */
export const dashboardActions: readonly DashboardAction[] = [
  {
    id: "products",
    label: "Manage products",
    description: "View the catalog, add or edit products",
    path: "/products",
    monogram: "PR",
  },
  {
    id: "receiving",
    label: "Receive stock",
    description: "Record a new purchase batch",
    path: "/receiving",
    monogram: "RC",
  },
  {
    id: "find",
    label: "Find a product",
    description: "Look up a product by name or SKU",
    path: "/find-medicine",
    monogram: "FD",
  },
  {
    id: "inventory",
    label: "Review inventory",
    description: "Check stock, expiries and alerts",
    path: "/inventory",
    monogram: "IV",
  },
];
