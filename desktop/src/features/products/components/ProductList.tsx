import { Fragment, useState } from "react";
import { EmptyState } from "../../../components/EmptyState";
import type { ProductRecord } from "../product.types";
import {
  getVisibleProducts,
  type ProductSort,
  type StatusFilter,
} from "../utils/productTable";
import "./ProductList.css";

/** A display-only projection of a purchase batch. Prices are per base unit. */
export interface PurchaseBatchRow {
  readonly id: string;
  productId: string;
  branchId: string;
  name: string;
  purchasedAt: string; // YYYY-MM-DD
  unitCost: number;
  sellingPrice: number;
  quantityRemaining: number;
  expiresAt: string | null;
}

export interface ProductListProps {
  products: readonly ProductRecord[];
  onEdit: (product: ProductRecord) => void;
  onDeactivate: (product: ProductRecord) => void;
  onReactivate: (product: ProductRecord) => void;
  busyProductId: string | null;
  onEditBatch?: (batch: PurchaseBatchRow) => void;
  purchaseBatches?: readonly PurchaseBatchRow[];
  branchId?: string;
  currency?: string;
}

function formatDate(date: string | null): string {
  if (!date) return "No expiry date";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const value = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function todayLocalIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function ProductList({
  products,
  onEdit,
  onDeactivate,
  onReactivate,
  busyProductId,
  onEditBatch,
  purchaseBatches,
  branchId,
  currency = "NGN",
}: ProductListProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<ProductSort>("NAME_ASC");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const visibleProducts = getVisibleProducts(products, query, status, sort);
  const noProducts = products.length === 0;
  const isAnyActionBusy = busyProductId !== null;
  const today = todayLocalIso();
  const money = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

  function batchesFor(productId: string): PurchaseBatchRow[] {
    return (purchaseBatches ?? [])
      .filter((batch) => batch.productId === productId && (branchId === undefined || batch.branchId === branchId))
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.id.localeCompare(b.id));
  }

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
    setSort("NAME_ASC");
  }

  return (
    <section className="product-list" aria-labelledby="product-list-heading">
      <div className="product-list__heading">
        <div>
          <h2 id="product-list-heading">Product catalog</h2>
          <p>Search, edit, manage status, and inspect product purchases.</p>
        </div>
        <span aria-live="polite">Showing {visibleProducts.length} of {products.length}</span>
      </div>

      <div className="product-list__controls">
        <div className="product-list__field product-list__field--search">
          <label htmlFor="catalog-search">Search by name, brand or SKU</label>
          <input id="catalog-search" type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder="Try Para or IBU-200" />
        </div>
        <div className="product-list__field">
          <label htmlFor="catalog-status">Product status</label>
          <select id="catalog-status" value={status} onChange={(e) => setStatus(e.currentTarget.value as StatusFilter)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active only</option>
            <option value="INACTIVE">Inactive only</option>
            <option value="DISCONTINUED">Discontinued only</option>
          </select>
        </div>
        <div className="product-list__field">
          <label htmlFor="catalog-sort">Sort products</label>
          <select id="catalog-sort" value={sort} onChange={(e) => setSort(e.currentTarget.value as ProductSort)}>
            <option value="NAME_ASC">Name (A–Z)</option>
            <option value="NAME_DESC">Name (Z–A)</option>
            <option value="SKU_ASC">SKU (A–Z)</option>
          </select>
        </div>
      </div>

      {noProducts ? (
        <EmptyState title="No products yet" description="Choose Add product to create the first product in this session." />
      ) : visibleProducts.length === 0 ? (
        <div>
          <EmptyState title="No matching products" description="Try a different search term or status filter." />
          <button type="button" className="product-list__reset" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <div className="product-list__scroll">
          <table className="product-list__table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">SKU</th>
                <th scope="col">Brand</th>
                <th scope="col">Status</th>
                <th scope="col">Reorder level</th>
                <th scope="col">Remaining</th>
                <th scope="col" title="Price per base unit of the oldest eligible purchase under FIFO">Next selling price</th>
                <th scope="col">Nearest expiry</th>
                <th scope="col">Purchases</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const records = batchesFor(product.id);
                const inStock = records.filter((batch) => batch.quantityRemaining > 0);
                const physicalStock = records.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
                const nearestExpiry = inStock
                  .map((batch) => batch.expiresAt)
                  .filter((date): date is string => date !== null)
                  .sort()[0] ?? null;
                const hasUnknownExpiry = inStock.some((batch) => batch.expiresAt === null);
                // Only a display estimate: actual sales must independently enforce FIFO.
                const eligiblePurchases = records.filter(
                  (batch) => batch.quantityRemaining > 0 && (batch.expiresAt === null || batch.expiresAt >= today),
                );
                const nextSellingPrice = eligiblePurchases[0]?.sellingPrice ?? null;
                const hasMultipleSellingPrices = new Set(eligiblePurchases.map((batch) => batch.sellingPrice)).size > 1;
                const expanded = expandedProductId === product.id;
                const detailsId = `purchase-details-${product.id}`;

                return (
                  <Fragment key={product.id}>
                    <tr>
                      <td><strong>{product.genericName}</strong></td>
                      <td>{product.sku}</td>
                      <td>{product.brandName || "Unbranded"}</td>
                      <td><span className={`product-list__status product-list__status--${product.status.toLowerCase()}`}>{product.status}</span></td>
                      <td>{product.reorderLevel}</td>
                      <td>{purchaseBatches === undefined ? "—" : physicalStock}</td>
                      <td>
                        {purchaseBatches === undefined ? "Not loaded" : product.status !== "ACTIVE" ? (
                          <span className="product-list__price-unavailable">Not for sale</span>
                        ) : nextSellingPrice === null ? (
                          <span className="product-list__price-unavailable">No sellable stock</span>
                        ) : (
                          <div className="product-list__price">
                            <strong>{money.format(nextSellingPrice)}</strong>
                            {hasMultipleSellingPrices && <small title="Later purchases have different selling prices; larger sales may span purchase prices">Other batch prices available</small>}
                          </div>
                        )}
                      </td>
                      <td>
                        {purchaseBatches === undefined ? "Not loaded" : nearestExpiry ? (
                          <span className={nearestExpiry < today ? "product-list__expired" : undefined}>
                            {formatDate(nearestExpiry)}{nearestExpiry < today ? " (expired stock)" : ""}
                          </span>
                        ) : hasUnknownExpiry ? "Not recorded" : "—"}
                      </td>
                      <td>{purchaseBatches === undefined ? "—" : records.length}</td>
                      <td>
                        <div className="product-list__actions">
                          <button type="button" onClick={() => onEdit(product)} disabled={isAnyActionBusy} aria-label={`Edit ${product.genericName}`}>Edit</button>
                          {product.status === "ACTIVE" ? (
                            <button type="button" className="product-list__danger" onClick={() => onDeactivate(product)} disabled={isAnyActionBusy} aria-label={`Deactivate ${product.genericName}`}>
                              {busyProductId === product.id ? "Working…" : "Deactivate"}
                            </button>
                          ) : product.status === "INACTIVE" ? (
                            <button type="button" onClick={() => onReactivate(product)} disabled={isAnyActionBusy} aria-label={`Reactivate ${product.genericName}`}>
                              {busyProductId === product.id ? "Working…" : "Reactivate"}
                            </button>
                          ) : null}
                          {purchaseBatches !== undefined && (
                            <button type="button" className="product-list__view" onClick={() => setExpandedProductId(expanded ? null : product.id)} aria-expanded={expanded} aria-controls={detailsId}>
                              {expanded ? "Hide batches" : "View batches"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded && purchaseBatches !== undefined && (
                      <tr className="product-list__detail-row">
                        <td colSpan={10}>
                          <div id={detailsId} className="product-list__detail">
                            <h3>Purchases for {product.genericName}</h3>
                            {records.length === 0 ? (
                              <p>No purchases recorded for this product in the selected branch.</p>
                            ) : (
                              <div className="product-list__scroll">
                                <table className="product-list__batches">
                                  <thead>
                                    <tr>
                                      <th scope="col">Purchase name</th>
                                      <th scope="col">Purchase date</th>
                                      <th scope="col">Remaining</th>
                                      <th scope="col">Cost / unit</th>
                                      <th scope="col">Selling / unit</th>
                                      <th scope="col">Expiry</th>
                                      {onEditBatch && <th scope="col">Action</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {records.map((batch) => (
                                      <tr key={batch.id}>
                                        <td>{batch.name}</td>
                                        <td>{formatDate(batch.purchasedAt)}</td>
                                        <td>{batch.quantityRemaining}</td>
                                        <td>{money.format(batch.unitCost)}</td>
                                        <td>{money.format(batch.sellingPrice)}</td>
                                        <td>{formatDate(batch.expiresAt)}{batch.quantityRemaining > 0 && batch.expiresAt && batch.expiresAt < today ? " (expired)" : ""}</td>
                                        {onEditBatch && (
                                          <td>
                                            <button type="button" onClick={() => onEditBatch(batch)} disabled={isAnyActionBusy} aria-label={`Edit purchase ${batch.name} for ${product.genericName}`}>Edit batch</button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
