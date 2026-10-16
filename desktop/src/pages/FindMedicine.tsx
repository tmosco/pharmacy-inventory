import { PageHeader } from "../components/PageHeader";
import { ProductSearch } from "../components/ProductSearch";
import { searchProducts } from "../data/searchProducts";

// Reuses the local search built on Day 2.
export function FindMedicine() {
  return (
    <main className="dashboard">
      <PageHeader
        title="Find Medicine"
        subtitle="Search sample products by generic name, brand name, or SKU."
      />
      <ProductSearch products={searchProducts} />
    </main>
  );
}
