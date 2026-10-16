import { useState } from "react";
import type { ChangeEvent } from "react";
import type { SearchProduct } from "../data/searchProducts";
import { filterProducts } from "../utils/filterProducts";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import "./ProductSearch.css";

export interface ProductSearchProps {
  products: readonly SearchProduct[];
}

export function ProductSearch({ products }: ProductSearchProps) {
  // State: the value the user can change by typing.
  const [query, setQuery] = useState("");

  // Derived data: calculate it again for the current query and props.
  // Do not create a separate useState for this list or its count.
  const filteredProducts = filterProducts(products, query);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.currentTarget.value);
  }

  function handleReset() {
    setQuery("");
  }

  return (
    <section className="panel product-search" aria-labelledby="search-heading">
      <h2 id="search-heading">Find products</h2>
      <p className="muted">Day 2 practice: search a temporary local list.</p>

      <div role="search" aria-label="Product search">
        <label htmlFor="product-search-input">Search products</label>

        <div className="product-search__controls">
          <input
            id="product-search-input"
            type="search"
            placeholder="Try para, ReliefOne, or IBU-200"
            value={query}
            onChange={handleSearchChange}
            aria-describedby="product-search-hint"
          />

          <Button
            variant="secondary"
            onClick={handleReset}
            disabled={query === ""}
          >
            Reset search
          </Button>
        </div>

        <p id="product-search-hint" className="muted">
          Search by generic name, brand name, or SKU.
        </p>
      </div>

      <p role="status" aria-atomic="true">
        Showing {filteredProducts.length} of {products.length} products
      </p>

      {filteredProducts.length === 0 ? (
        <EmptyState
          title={products.length === 0 ? "No products yet" : "No matching products"}
          description={
            products.length === 0
              ? "Add sample products to the temporary list to try the search."
              : "Try another generic name, brand name, or SKU, or reset the search."
          }
        />
      ) : (
        <ul className="product-search__results">
          {filteredProducts.map((product) => (
            <li key={product.id} className="product-search__result">
              <h3>{product.genericName}</h3>
              <p>Brand: {product.brandName ?? "Unbranded"}</p>
              <p>SKU: {product.sku}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
