import type { ProductRecord, ProductStatus } from "../product.types";

export type StatusFilter = "ALL" | ProductStatus;
export type ProductSort = "NAME_ASC" | "NAME_DESC" | "SKU_ASC";

/** Pure calculation: search, filter, then sort a copied list. */
export function getVisibleProducts(
  products: readonly ProductRecord[],
  query: string,
  status: StatusFilter,
  sort: ProductSort,
): ProductRecord[] {
  const normalized = query.trim().toLocaleLowerCase();

  const result = products.filter((product) => {
    const matchesStatus = status === "ALL" || product.status === status;
    const fields = [product.genericName, product.brandName, product.sku];
    const matchesSearch = fields.some((field) =>
      (field ?? "").toLocaleLowerCase().includes(normalized),
    );
    return matchesStatus && matchesSearch;
  });

  return result.sort((a, b) => {
    if (sort === "SKU_ASC") return a.sku.localeCompare(b.sku);
    const compare = a.genericName.localeCompare(b.genericName);
    return sort === "NAME_DESC" ? -compare : compare;
  });
}
