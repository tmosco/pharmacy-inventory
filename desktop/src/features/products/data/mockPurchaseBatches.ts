import type { PurchaseBatchRow } from "../components/ProductList";

// Practice records: use the SAME product ID as Paracetamol in mockProducts.ts.
// In the Day 5 sample product file, Paracetamol is "p-101", not "product-001".
export const mockPurchaseBatches: PurchaseBatchRow[] = [
  {
    id: "purchase-001",
    productId: "p-101",
    branchId: "branch-001",
    name: "May-2026",
    purchasedAt: "2026-05-10",
    unitCost: 50,
    sellingPrice: 80,
    quantityRemaining: 20,
    expiresAt: "2027-12-31",
  },
  {
    id: "purchase-002",
    productId: "p-101",
    branchId: "branch-001",
    name: "Jun-2026",
    purchasedAt: "2026-06-15",
    unitCost: 500,
    sellingPrice: 650,
    quantityRemaining: 200,
    expiresAt: "2028-06-30",
  },
];
