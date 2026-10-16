/**
 * Pharmacy inventory domain model (learning example).
 * One Product has many independent PurchaseBatch records.
 * FIFO means oldest eligible purchase is allocated first.
 * Dates are ISO calendar dates (YYYY-MM-DD).
 * Quantities and prices are per product base unit (e.g., tablet).
 *
 * These pure functions plan allocations; they do not save sales,
 * reserve inventory, or send notifications. A production backend
 * must validate and commit changes atomically and audit them.
 */

export type ProductStatus = "ACTIVE" | "INACTIVE" | "DISCONTINUED";
export type ShelfPosition = "TOP" | "MIDDLE" | "BOTTOM";
export type PurchaseBatchStatus = "ACTIVE" | "EXPIRED" | "DEPLETED";

export interface Branch {
  readonly id: string;
  name: string;
  code: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
  };
}

export interface Shelf {
  readonly id: string;
  branchId: string;
  code: string;
  name: string; // Rename without changing the shelf ID.
}

export interface ShelfSection {
  readonly id: string;
  shelfId: string;
  position: ShelfPosition;
}

export interface Product {
  readonly id: string;
  sku: string;
  genericName: string;
  brandName: string | null;
  category: string;
  baseUnit: string;
  status: ProductStatus;
  description?: string;
  preferredSectionId?: string;
  // This example uses one threshold per product; real multi-branch
  // systems may need separate thresholds per product and branch.
  lowStockThreshold: number;
}

export interface ProductUnit {
  readonly id: string;
  productId: string;
  name: string; // Tablet, blister, box, etc.
  quantityInBaseUnits: number;
  barcode?: string;
  packDescription?: string;
}

/** One receipt/restock, named by the pharmacy (e.g. May-2026). */
export interface PurchaseBatch {
  readonly id: string;
  productId: string;
  branchId: string;
  name: string; // Editable display label, not the unique identifier.
  purchasedAt: string; // ISO YYYY-MM-DD; determines FIFO order.
  manufacturerBatchNumber?: string; // Optional manufacturer lot number.
  shelfSectionId: string;
  readonly unitCost: number; // Original acquisition cost per base unit.
  sellingPrice: number; // Current price for future sales from this receipt.
  readonly quantityPurchased: number;
  quantityRemaining: number;
  expiresAt: string | null;
}

export interface ProductInventorySummary {
  productId: string;
  branchId: string;
  totalPurchaseBatches: number;
  physicalStock: number;
  sellableStock: number;
  expiredStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  nearestExpiryDate: string | null;
}

export interface LowStockAlert {
  productId: string;
  branchId: string;
  productName: string;
  remainingQuantity: number;
  threshold: number;
  message: string;
}

export interface SaleAllocation {
  purchaseBatchId: string;
  purchaseBatchName: string;
  quantity: number;
  unitCostAtSale: number;
  sellingPriceAtSale: number;
  costOfGoodsSold: number;
  revenue: number;
}

export interface SalePlan {
  productId: string;
  branchId: string;
  requestedQuantity: number;
  allocations: SaleAllocation[];
  totalRevenue: number;
  totalCostOfGoodsSold: number;
  grossProfit: number;
}

export function getPurchaseBatchStatus(
  batch: PurchaseBatch,
  today: string,
): PurchaseBatchStatus {
  if (batch.quantityRemaining <= 0) return "DEPLETED";
  if (batch.expiresAt !== null && batch.expiresAt < today) return "EXPIRED";
  return "ACTIVE";
}

export function getProductPurchaseBatches(
  productId: string,
  allBatches: readonly PurchaseBatch[],
  branchId: string,
): PurchaseBatch[] {
  return allBatches
    .filter(batch => batch.productId === productId && batch.branchId === branchId)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.id.localeCompare(b.id));
}

export function getProductInventorySummary(
  product: Product,
  allBatches: readonly PurchaseBatch[],
  branchId: string,
  today: string,
): ProductInventorySummary {
  const records = getProductPurchaseBatches(product.id, allBatches, branchId);
  const physicalStock = records.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  const eligible = records.filter(batch => getPurchaseBatchStatus(batch, today) === "ACTIVE");
  const sellableStock = eligible.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  const expiredStock = records
    .filter(batch => getPurchaseBatchStatus(batch, today) === "EXPIRED")
    .reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  const nearestExpiryDate = eligible
    .map(batch => batch.expiresAt)
    .filter((date): date is string => date !== null)
    .sort()[0] ?? null;

  return {
    productId: product.id,
    branchId,
    totalPurchaseBatches: records.length,
    physicalStock,
    sellableStock,
    expiredStock,
    lowStockThreshold: product.lowStockThreshold,
    isLowStock: sellableStock <= product.lowStockThreshold,
    nearestExpiryDate,
  };
}

/** Generates alert content; delivery and deduplication belong to the backend. */
export function getLowStockAlert(
  product: Product,
  summary: ProductInventorySummary,
): LowStockAlert | null {
  if (summary.productId !== product.id) throw new Error("Product/summary mismatch");
  if (!summary.isLowStock) return null;
  return {
    productId: product.id,
    branchId: summary.branchId,
    productName: product.genericName,
    remainingQuantity: summary.sellableStock,
    threshold: summary.lowStockThreshold,
    message: `${product.genericName} is low on stock: ${summary.sellableStock} ${product.baseUnit}(s) available (threshold: ${summary.lowStockThreshold}).`,
  };
}

/**
 * Plan a sale using FIFO (oldest purchasedAt first), skipping expired
 * and depleted receipts. No inventory is mutated by this function.
 * Each allocation snapshots its own cost and selling price; the UI
 * must clearly disclose batch-specific pricing before confirmation.
 */
export function planFifoSale(
  productId: string,
  branchId: string,
  quantity: number,
  allBatches: readonly PurchaseBatch[],
  today: string,
): SalePlan {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Sale quantity must be a positive whole number of base units");
  }

  const eligible = getProductPurchaseBatches(productId, allBatches, branchId)
    .filter(batch => getPurchaseBatchStatus(batch, today) === "ACTIVE");
  const available = eligible.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  if (available < quantity) {
    throw new Error(`Insufficient sellable stock: requested ${quantity}, available ${available}`);
  }

  let remainingToAllocate = quantity;
  const allocations: SaleAllocation[] = [];
  for (const batch of eligible) {
    if (remainingToAllocate === 0) break;
    const take = Math.min(remainingToAllocate, batch.quantityRemaining);
    if (take <= 0) continue;
    allocations.push({
      purchaseBatchId: batch.id,
      purchaseBatchName: batch.name,
      quantity: take,
      unitCostAtSale: batch.unitCost,
      sellingPriceAtSale: batch.sellingPrice,
      costOfGoodsSold: take * batch.unitCost,
      revenue: take * batch.sellingPrice,
    });
    remainingToAllocate -= take;
  }
  const totalRevenue = allocations.reduce((sum, allocation) => sum + allocation.revenue, 0);
  const totalCostOfGoodsSold = allocations.reduce((sum, allocation) => sum + allocation.costOfGoodsSold, 0);
  return {
    productId,
    branchId,
    requestedQuantity: quantity,
    allocations,
    totalRevenue,
    totalCostOfGoodsSold,
    grossProfit: totalRevenue - totalCostOfGoodsSold,
  };
}

/** Change one purchase's future selling price without repricing others. */
export function updatePurchaseBatchSellingPrice(
  allBatches: readonly PurchaseBatch[],
  purchaseBatchId: string,
  newSellingPrice: number,
): PurchaseBatch[] {
  if (!Number.isFinite(newSellingPrice) || newSellingPrice < 0) {
    throw new Error("Selling price must be a nonnegative finite number");
  }
  if (!allBatches.some(batch => batch.id === purchaseBatchId)) {
    throw new Error("Purchase batch not found");
  }
  return allBatches.map(batch => batch.id === purchaseBatchId
    ? { ...batch, sellingPrice: newSellingPrice }
    : batch);
}

// =====================================
// SAMPLE RECORDS
// =====================================

export const branch: Branch = {
  id: "branch-001",
  name: "Lagos Main Branch",
  code: "LAG-001",
  address: { street: "12 Pharmacy Road", city: "Ikeja", state: "Lagos", country: "Nigeria" },
};

export const shelf: Shelf = {
  id: "shelf-001",
  branchId: branch.id,
  code: "A-01",
  name: "Analgesics",
};

export const shelfSections: ShelfSection[] = [
  { id: "section-001", shelfId: shelf.id, position: "TOP" },
  { id: "section-002", shelfId: shelf.id, position: "MIDDLE" },
  { id: "section-003", shelfId: shelf.id, position: "BOTTOM" },
];

export const paracetamol: Product = {
  id: "product-001",
  sku: "PARA-500",
  genericName: "Paracetamol 500mg",
  brandName: null,
  category: "Analgesics",
  baseUnit: "TABLET",
  status: "ACTIVE",
  description: "Pain and fever relief",
  preferredSectionId: "section-001",
  lowStockThreshold: 20,
};

export const paracetamolUnits: ProductUnit[] = [
  { id: "unit-001", productId: paracetamol.id, name: "Tablet", quantityInBaseUnits: 1, packDescription: "Single tablet" },
  { id: "unit-002", productId: paracetamol.id, name: "Blister", quantityInBaseUnits: 10, packDescription: "10 tablets per blister" },
  { id: "unit-003", productId: paracetamol.id, name: "Box", quantityInBaseUnits: 100, packDescription: "10 blisters of 10 tablets" },
];

export const purchaseBatches: PurchaseBatch[] = [
  {
    id: "purchase-001",
    productId: paracetamol.id,
    branchId: branch.id,
    name: "May-2026",
    purchasedAt: "2026-05-10",
    shelfSectionId: "section-001",
    unitCost: 50,
    sellingPrice: 80,
    quantityPurchased: 200,
    quantityRemaining: 20,
    expiresAt: "2027-12-31",
  },
  {
    id: "purchase-002",
    productId: paracetamol.id,
    branchId: branch.id,
    name: "Jun-2026",
    purchasedAt: "2026-06-15",
    shelfSectionId: "section-001",
    unitCost: 500,
    sellingPrice: 650,
    quantityPurchased: 200,
    quantityRemaining: 200,
    expiresAt: "2028-06-30",
  },
];

// Example usage (uncomment in your own script):
// const today = "2026-10-12";
// const summary = getProductInventorySummary(paracetamol, purchaseBatches, branch.id, today);
// console.log(summary); // 220 sellable tablets, low-stock false
// const plan = planFifoSale(paracetamol.id, branch.id, 25, purchaseBatches, today);
// console.table(plan.allocations); // May: 20; June: 5
// console.log(plan.totalRevenue); // 4850 = (20 * 80) + (5 * 650)
// console.log(getLowStockAlert(paracetamol, summary)); // null
