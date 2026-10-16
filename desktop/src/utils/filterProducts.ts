import type { SearchProduct } from "../data/searchProducts";

// Calculate a fresh result. Do not edit the original product array.
export function filterProducts(
  products: readonly SearchProduct[],
  query: string,
): SearchProduct[] {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) =>
    normalizedQuery === "" ||
    product.genericName.toLowerCase().includes(normalizedQuery) ||
    (product.brandName ?? "").toLowerCase().includes(normalizedQuery) ||
    product.sku.toLowerCase().includes(normalizedQuery)
  );
}
