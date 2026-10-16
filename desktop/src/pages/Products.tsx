import { useState } from "react";
import { Button } from "../components/Button";
import { ProductForm } from "../features/products/components/ProductForm";
import {
  ProductList,
  type PurchaseBatchRow,
} from "../features/products/components/ProductList";
import {
  PurchaseBatchEditForm,
  type PurchaseBatchChanges,
} from "../features/products/components/PurchaseBatchEditForm";
import { mockProducts } from "../features/products/data/mockProducts";
import { mockPurchaseBatches } from "../features/products/data/mockPurchaseBatches";
import type { ProductRecord } from "../features/products/product.types";
import type { ProductFormValues } from "../features/products/product.schema";

export function Products() {
  // Practice-only state. Reloading the app restores the mock data.
  const [products, setProducts] = useState<ProductRecord[]>(mockProducts);
  const [purchaseBatches, setPurchaseBatches] =
    useState<PurchaseBatchRow[]>(mockPurchaseBatches);

  const [formMode, setFormMode] = useState<"ADD" | "EDIT" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] =
    useState<PurchaseBatchRow | null>(null);
  const [notice, setNotice] = useState("");

  const selected = products.find((product) => product.id === editingId) ?? null;
  const editingBatchProductName = editingBatch
    ? products.find((product) => product.id === editingBatch.productId)?.genericName ?? "Product"
    : "";

  function openAdd() {
    setEditingId(null);
    setEditingBatch(null);
    setFormMode("ADD");
    setNotice("");
  }

  function openEdit(product: ProductRecord) {
    setEditingId(product.id);
    setEditingBatch(null);
    setFormMode("EDIT");
    setNotice("");
  }

  function openEditBatch(batch: PurchaseBatchRow) {
    setEditingBatch(batch);
    setEditingId(null);
    setFormMode(null);
    setNotice("");
  }

  async function saveProduct(values: ProductFormValues): Promise<void> {
    if (formMode === "EDIT" && selected) {
      setProducts((current) =>
        current.map((product) =>
          product.id === selected.id ? { ...product, ...values } : product,
        ),
      );
      setNotice(`${values.genericName} updated successfully.`);
    } else {
      setProducts((current) => [
        ...current,
        { ...values, id: crypto.randomUUID(), status: "ACTIVE" },
      ]);
      setNotice(`${values.genericName} added successfully.`);
    }
    setFormMode(null);
    setEditingId(null);
  }

  function handleSaveBatch(
    batchId: string,
    changes: PurchaseBatchChanges,
  ): void {
    // Match by stable ID, not the editable purchase name.
    if (!purchaseBatches.some((batch) => batch.id === batchId)) {
      throw new Error("The selected purchase could not be found.");
    }

    // Immutable update: only this one purchase receives the changes.
    setPurchaseBatches((current) =>
      current.map((batch) =>
        batch.id === batchId ? { ...batch, ...changes } : batch,
      ),
    );
    setEditingBatch(null);
    setNotice(`Purchase ${changes.name} updated successfully.`);
  }

  return (
    <main style={{ padding: "1.5rem", display: "grid", gap: "1.5rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Products</h1>
          <p style={{ color: "#64748b" }}>
            Manage your inventory catalog. Example data only.
          </p>
        </div>
        <Button onClick={openAdd}>Add product</Button>
      </header>

      {notice && <p role="status" style={{ color: "#166534" }}>{notice}</p>}

      {formMode && (
        <section
          aria-labelledby="product-editor-heading"
          style={{
            background: "#fff",
            padding: "1.5rem",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 id="product-editor-heading">
              {formMode === "EDIT"
                ? `Edit ${selected?.genericName ?? "product"}`
                : "Add product"}
            </h2>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setFormMode(null);
              }}
            >
              Cancel
            </Button>
          </div>
          <ProductForm
            key={editingId ?? "new-product"}
            onSave={saveProduct}
            existingSkus={products
              .filter((product) => product.id !== editingId)
              .map((product) => product.sku)}
            initialValues={formMode === "EDIT" && selected ? selected : undefined}
            submitLabel={formMode === "EDIT" ? "Save changes" : "Save product"}
          />
        </section>
      )}

      {editingBatch && (
        <PurchaseBatchEditForm
          key={editingBatch.id}
          batch={editingBatch}
          productName={editingBatchProductName}
          onCancel={() => setEditingBatch(null)}
          onSave={handleSaveBatch}
        />
      )}

      <ProductList
        products={products}
        onEdit={openEdit}
        purchaseBatches={purchaseBatches}
        branchId="branch-001"
        onEditBatch={openEditBatch}
      />
    </main>
  );
}
