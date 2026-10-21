import { useRef, useState } from "react";
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
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ToastMessage } from "../components/ToastMessage";


type Toast = { kind: "success" | "error"; message: string };

const pause = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

export function Products() {
  // Practice-only state. Reloading the app restores the mock data.
  const [products, setProducts] = useState<ProductRecord[]>(mockProducts);
  const [purchaseBatches, setPurchaseBatches] =
    useState<PurchaseBatchRow[]>(mockPurchaseBatches);

  const [formMode, setFormMode] = useState<"ADD" | "EDIT" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState<PurchaseBatchRow | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [failNextSave, setFailNextSave] = useState(false);
  const actionLock = useRef(false);
  const saveFlight = useRef<Promise<void> | null>(null);
  const target = products.find((product) => product.id === deactivateId) ?? null;

  const selected = products.find((product) => product.id === editingId) ?? null;
  const editingBatchProductName = editingBatch
    ? (products.find((product) => product.id === editingBatch.productId)
        ?.genericName ?? "Product")
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

  async function performSave(values: ProductFormValues): Promise<void> {
    // Delay is only to demonstrate isSubmitting and a disabled Save button.
    await pause(650);
    if (failNextSave) {
      setFailNextSave(false);
      throw new Error("Simulated storage failure");
    }

    if (formMode === "EDIT" && editingId) {
      setProducts((current) => current.map((product) =>
        product.id === editingId ? { ...product, ...values } : product,
      ));
      setToast({ kind: "success", message: `Changes saved for ${values.genericName}.` });
    } else {
      setProducts((current) => [
        ...current,
        { ...values, id: crypto.randomUUID(), status: "ACTIVE" },
      ]);
      setToast({ kind: "success", message: `${values.genericName} was added.` });
    }
    setFormMode(null);
    setEditingId(null);
  }

  function saveProduct(values: ProductFormValues): Promise<void> {
    // A synchronous in-flight guard prevents the same save running twice,
    // even before the disabled button has had a chance to render.
    if (saveFlight.current) return saveFlight.current;
    const operation = performSave(values).finally(() => {
      saveFlight.current = null;
    });
    saveFlight.current = operation;
    return operation;
  }

  function requestDeactivate(product: ProductRecord) {
    if (busyProductId !== null) return;
    setDeactivateId(product.id);
  }

  async function confirmDeactivate() {
    // Ref guards even against repeated clicks before React renders a new state.
    if (!deactivateId || actionLock.current) return;
    actionLock.current = true;
    const id = deactivateId;
    setBusyProductId(id);
    try {
      await pause(650);
      const current = products.find((product) => product.id === id);
      if (!current || current.status !== "ACTIVE") {
        throw new Error("Product status changed");
      }
      setProducts((previous) => previous.map((product) =>
        product.id === id ? { ...product, status: "INACTIVE" } : product,
      ));
      setToast({ kind: "success", message: `${current.genericName} is now inactive. You can reactivate it.` });
      setDeactivateId(null);
    } catch {
      setToast({ kind: "error", message: "Could not deactivate the product. Please try again." });
    } finally {
      setBusyProductId(null);
      actionLock.current = false;
    }
  }

  async function reactivateProduct(product: ProductRecord) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusyProductId(product.id);
    try {
      await pause(350);
      setProducts((previous) => previous.map((item) =>
        item.id === product.id ? { ...item, status: "ACTIVE" } : item,
      ));
      setToast({ kind: "success", message: `${product.genericName} is active again.` });
    } catch {
      setToast({ kind: "error", message: "Could not reactivate the product." });
    } finally {
      setBusyProductId(null);
      actionLock.current = false;
    }
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

         {toast && (
        <ToastMessage kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />
      )}

      {notice && (
        <p role="status" style={{ color: "#166534" }}>
          {notice}
        </p>
      )}

      <Modal
        open={formMode !== null}
        title={formMode === "EDIT" ? "Edit product" : "Add product"}
        onClose={() => {
          setFormMode(null);
          setEditingId(null);
        }}
      >
        {formMode && (
          <>
            <ProductForm
              key={editingId ?? "new-product"}
              onSave={saveProduct}
              existingSkus={products
                .filter((p) => p.id !== editingId)
                .map((p) => p.sku)}
              initialValues={
                formMode === "EDIT" && selected ? selected : undefined
              }
              submitLabel={
                formMode === "EDIT" ? "Save changes" : "Save product"
              }
            />

            <button
              type="button"
              onClick={() => {
                setFormMode(null);
                setEditingId(null);
              }}
            >
              Cancel
            </button>
          </>
        )}
      </Modal>

      {editingBatch && (
        <Modal
          open={editingBatch !== null}
          title="Edit purchase"
          onClose={() => setEditingBatch(null)}
        >
          {editingBatch && (
            <PurchaseBatchEditForm
              batch={editingBatch}
              productName={editingBatchProductName}
              onCancel={() => setEditingBatch(null)}
              onSave={handleSaveBatch}
            />
          )}  
        </Modal>
      )}
        {/* )}
        <PurchaseBatchEditForm
          key={editingBatch.id}
          batch={editingBatch}
          productName={editingBatchProductName}
          onCancel={() => setEditingBatch(null)}
          onSave={handleSaveBatch}
        />
      )} */}

      <ProductList
        products={products}
        onEdit={openEdit}
        purchaseBatches={purchaseBatches}
        branchId="branch-001"
        onEditBatch={openEditBatch}
         onDeactivate={requestDeactivate}
        onReactivate={reactivateProduct}
        busyProductId={busyProductId}
      />

       {target && (
        <ConfirmDialog
          title={`Deactivate ${target.genericName}?`}
          description="This demo will mark the product INACTIVE, not delete it. Its sample record remains in the list, and you can reactivate it. Production sales restrictions must be implemented separately."
          confirmLabel="Deactivate product"
          busy={busyProductId === target.id}
          onCancel={() => { if (busyProductId === null) setDeactivateId(null); }}
          onConfirm={confirmDeactivate}
        />
      )}
    </main>
  );
}
